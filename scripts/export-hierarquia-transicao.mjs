#!/usr/bin/env node
/**
 * Excel de transição — 1 planilha: Categoria → LINHA → Produto compra → SKU.
 * Proposta automática para revisão (coluna STATUS); não altera a base.
 *
 * npm run export:hierarquia-transicao
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import ExcelJS from 'exceljs';
import { inferirLinhaCodigo, findLinhaMeta, LINHAS_MESTRE } from './lib/inferirLinha.mjs';
import { planLinhaCompraAnalise, norm } from './lib/planLinhaCompraAnalise.mjs';

const OUT = path.join(process.cwd(), 'docs', 'exports', 'P38-hierarquia-transicao.xlsx');

function slugCodigo(s) {
  return norm(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'ITEM';
}

function mapLinhaTipo(tipoMestre, tipoAnalise) {
  if (tipoMestre === 'solo' || tipoMestre === 'mix' || tipoMestre === 'portfolio') return tipoMestre;
  const t = String(tipoAnalise || '').toLowerCase();
  if (t.includes('solo')) return 'solo';
  if (t.includes('mix')) return 'mix';
  if (t === 'portfolio') return 'portfolio';
  return tipoMestre || 'mix';
}

function pulaProdutoCompra(tipo) {
  return tipo === 'solo';
}

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A5240' } };
  row.alignment = { vertical: 'middle', wrapText: true };
}

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const { rows: produtos } = await client.query(`
    select
      id,
      nome,
      codigo_interno,
      marca,
      categoria_nome,
      categoria_id,
      campo_hierarquico_1,
      campo_hierarquico_2,
      campo_hierarquico_3,
      campo_hierarquico_4,
      campo_hierarquico_5,
      coalesce(estoque_atual, 0) as estoque_atual
    from produto
    where ativo = true
    order by categoria_nome nulls last, nome
  `);
  await client.end();

  const rows = [];

  for (const p of produtos) {
    const plan = planLinhaCompraAnalise(p);
    const linhaCod = inferirLinhaCodigo(p);
    const linhaMeta = findLinhaMeta(linhaCod);
    const linhaTipo = mapLinhaTipo(linhaMeta.tipo, plan.linha_tipo);
    const categoria = String(p.categoria_nome || '').trim() || '(sem categoria)';

    const pcNomeRaw = String(plan.produto_compra_nome || '').trim();
    const solo = pulaProdutoCompra(linhaTipo);
    const pcNome = solo ? '' : pcNomeRaw;
    const pcCodigo = solo ? '' : slugCodigo(pcNomeRaw || linhaMeta.codigo);

    rows.push({
      categoria,
      categoria_id: p.categoria_id || '',
      linha_codigo: linhaMeta.codigo,
      linha_nome: linhaMeta.nome,
      linha_tipo: linhaTipo,
      produto_compra_codigo: pcCodigo,
      produto_compra_nome: pcNome,
      sku_id: p.id,
      sku_codigo_interno: p.codigo_interno || '',
      sku_nome: p.nome || '',
      h1: p.campo_hierarquico_1 || '',
      h2: p.campo_hierarquico_2 || '',
      h3: p.campo_hierarquico_3 || '',
      h4: p.campo_hierarquico_4 || '',
      h5: p.campo_hierarquico_5 || '',
      eixo_a: plan.eixo_a || '',
      eixo_b: plan.eixo_b || '',
      marca: p.marca || '',
      estoque_atual: Number(p.estoque_atual) || 0,
      confianca: plan.confianca || '',
      motivo: plan.motivo || '',
      status: '',
      obs: '',
      _sort: [
        categoria,
        String(linhaMeta.ordem).padStart(4, '0'),
        linhaMeta.codigo,
        pcNome || '(solo)',
        p.nome || '',
      ].join('\x00'),
    });
  }

  rows.sort((a, b) => a._sort.localeCompare(b._sort, 'pt-BR'));

  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  const ws = wb.addWorksheet('Hierarquia', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Categoria', key: 'categoria', width: 22 },
    { header: 'categoria_id', key: 'categoria_id', width: 14 },
    { header: 'linha_codigo', key: 'linha_codigo', width: 16 },
    { header: 'linha_nome', key: 'linha_nome', width: 26 },
    { header: 'linha_tipo', key: 'linha_tipo', width: 10 },
    { header: 'produto_compra_codigo', key: 'produto_compra_codigo', width: 22 },
    { header: 'produto_compra_nome', key: 'produto_compra_nome', width: 32 },
    { header: 'sku_id', key: 'sku_id', width: 14 },
    { header: 'sku_codigo_interno', key: 'sku_codigo_interno', width: 16 },
    { header: 'sku_nome', key: 'sku_nome', width: 40 },
    { header: 'h1 (legado)', key: 'h1', width: 18 },
    { header: 'h2 (legado)', key: 'h2', width: 14 },
    { header: 'h3 (legado)', key: 'h3', width: 14 },
    { header: 'h4 (legado)', key: 'h4', width: 14 },
    { header: 'h5 (legado)', key: 'h5', width: 14 },
    { header: 'eixo_a', key: 'eixo_a', width: 14 },
    { header: 'eixo_b', key: 'eixo_b', width: 14 },
    { header: 'marca', key: 'marca', width: 14 },
    { header: 'estoque_atual', key: 'estoque_atual', width: 10 },
    { header: 'confianca', key: 'confianca', width: 10 },
    { header: 'motivo', key: 'motivo', width: 18 },
    { header: 'STATUS', key: 'status', width: 10 },
    { header: 'OBS', key: 'obs', width: 24 },
  ];
  styleHeader(ws.getRow(1));

  for (const r of rows) {
    const { _sort, ...data } = r;
    ws.addRow(data);
  }

  if (rows.length) {
    ws.autoFilter = {
      from: 'A1',
      to: `W${rows.length + 1}`,
    };
  }

  // Nota curta na coluna após dados (comentário na célula A1)
  ws.getCell('A1').note = {
    texts: [
      {
        font: { size: 10, name: 'Calibri' },
        text: `Transição hierarquia P38 — ${produtos.length} SKUs · ${new Date().toLocaleString('pt-BR')}\n`
          + 'Proposta automática: revisar linha_codigo / produto_compra / STATUS.\n'
          + 'solo: produto_compra vazio (SKU direto na LINHA).\n'
          + 'Gerado: npm run export:hierarquia-transicao',
      },
    ],
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await wb.xlsx.writeFile(OUT);

  try {
    fs.copyFileSync(OUT, '/opt/cursor/artifacts/P38-hierarquia-transicao.xlsx');
  } catch { /* ok */ }

  const pcCount = new Set(
    rows.filter((r) => r.produto_compra_codigo).map((r) => `${r.linha_codigo}::${r.produto_compra_codigo}`),
  ).size;

  console.log(`[export-hierarquia-transicao] → ${OUT}`);
  console.log(`SKUs: ${rows.length} · LINHAS: ${LINHAS_MESTRE.length} · Produto compra (proposta): ${pcCount}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
