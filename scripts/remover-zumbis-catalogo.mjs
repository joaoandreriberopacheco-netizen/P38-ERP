#!/usr/bin/env node
/**
 * Remove do cadastro os SKUs marcados como ZUMBI (coluna ex_b no Excel mestre).
 *
 * Regras (iguais ao ExcluirProdutoDialog):
 * - estoque > 0, movimentação ou venda → inativa (ativo = false)
 * - caso contrário → exclui da base
 *
 * npm run catalogo:remover-zumbis              # dry-run
 * npm run catalogo:remover-zumbis -- --apply   # executa
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import ExcelJS from 'exceljs';

const EXCEL = path.join(process.cwd(), 'docs', 'exports', 'P38-catalogo-skus-completo.xlsx');
const apply = process.argv.includes('--apply');

function cellStr(cell) {
  if (!cell || cell.value == null) return '';
  const v = cell.value;
  if (typeof v === 'object' && v.result != null) return String(v.result).trim();
  return String(v).trim();
}

async function loadZumbiCodes() {
  if (!fs.existsSync(EXCEL)) {
    throw new Error(`Excel não encontrado: ${EXCEL}`);
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL);
  const ws = wb.getWorksheet('Catálogo SKUs');
  if (!ws) throw new Error('Aba "Catálogo SKUs" não encontrada');

  const codes = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    if (cellStr(row.getCell(6)).toUpperCase() === 'ZUMBI') {
      const cod = cellStr(row.getCell(2));
      if (cod) codes.push(cod);
    }
  });
  return [...new Set(codes)];
}

async function main() {
  const codes = await loadZumbiCodes();
  if (!codes.length) {
    console.log('[remover-zumbis] Nenhum SKU com ex_b=ZUMBI no Excel.');
    return;
  }

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const { rows } = await client.query(
    `
    select
      p.id,
      p.codigo_interno,
      coalesce(p.nome, '') as nome,
      coalesce(p.estoque_atual, 0)::numeric as estoque_atual,
      coalesce(p.ativo, true) as ativo,
      (select count(*)::int from movimentacao_estoque m where m.produto_id = p.id) as movs,
      (select count(*)::int from pedido_venda_item pvi where pvi.produto_id = p.id) as vendas
    from produto p
    where p.codigo_interno = any($1::text[])
    order by p.codigo_interno
    `,
    [codes],
  );

  const found = new Set(rows.map((r) => r.codigo_interno));
  const missing = codes.filter((c) => !found.has(c));

  const plan = rows.map((r) => {
    const est = Number(r.estoque_atual) || 0;
    const action =
      est > 0 || r.movs > 0 || r.vendas > 0 || !r.ativo ? 'inativar' : 'excluir';
    return { ...r, estoque_atual: est, action };
  });

  const summary = {
    excel_zumbis: codes.length,
    encontrados: rows.length,
    missing,
    inativar: plan.filter((p) => p.action === 'inativar').length,
    excluir: plan.filter((p) => p.action === 'excluir').length,
    apply,
  };

  console.log('[remover-zumbis]', JSON.stringify(summary, null, 2));
  for (const p of plan) {
    console.log(
      `  ${p.action.toUpperCase().padEnd(8)} ${p.codigo_interno} | est=${p.estoque_atual} movs=${p.movs} vendas=${p.vendas} | ${p.nome.slice(0, 50)}`,
    );
  }

  if (!apply) {
    console.log('\nDry-run. Para aplicar: npm run catalogo:remover-zumbis -- --apply');
    await client.end();
    return;
  }

  let inativados = 0;
  let excluidos = 0;
  const erros = [];

  for (const p of plan) {
    try {
      if (p.action === 'inativar') {
        if (p.ativo) {
          await client.query('update produto set ativo = false, updated_at = now() where id = $1', [p.id]);
        }
        inativados += 1;
      } else {
        await client.query('delete from produto where id = $1', [p.id]);
        excluidos += 1;
      }
    } catch (err) {
      erros.push({ codigo: p.codigo_interno, action: p.action, error: err.message });
    }
  }

  console.log('\n[remover-zumbis] Concluído:', { inativados, excluidos, erros: erros.length });
  if (erros.length) console.log(JSON.stringify(erros, null, 2));

  await client.end();
}

main().catch((err) => {
  console.error('[remover-zumbis] ERRO:', err.message);
  process.exit(1);
});
