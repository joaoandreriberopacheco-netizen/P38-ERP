#!/usr/bin/env node
/**
 * Exporta linhas do catálogo (campo_hierarquico_1) ordenadas por categoria.
 *
 * Uso:
 *   node scripts/export-linhas-por-categoria.mjs
 *   node scripts/export-linhas-por-categoria.mjs --out /caminho/linhas.xlsx
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import ExcelJS from 'exceljs';

const OUT_DEFAULT = path.resolve(
  process.env.EXPORT_LINHAS_OUT
  || '/opt/cursor/artifacts/linhas-por-categoria.xlsx',
);

function parseOutArg() {
  const idx = process.argv.indexOf('--out');
  if (idx >= 0 && process.argv[idx + 1]) return path.resolve(process.argv[idx + 1]);
  return OUT_DEFAULT;
}

async function fetchLinhas(client) {
  const { rows } = await client.query(`
    select
      coalesce(nullif(trim(categoria_nome), ''), '(sem categoria)') as categoria,
      coalesce(nullif(trim(categoria_id), ''), '') as categoria_id,
      coalesce(nullif(trim(campo_hierarquico_1), ''), '(sem linha)') as linha,
      count(*)::int as skus_ativos,
      count(*) filter (where coalesce(estoque_atual, 0) > 0)::int as skus_com_estoque,
      string_agg(distinct nullif(trim(campo_hierarquico_2), ''), ' | '
        order by nullif(trim(campo_hierarquico_2), '')) filter (where nullif(trim(campo_hierarquico_2), '') is not null) as subtipos_h2,
      min(nome) as exemplo_sku
    from produto
    where ativo = true
    group by 1, 2, 3
    order by categoria asc, linha asc
  `);
  return rows;
}

async function fetchTotais(client) {
  const { rows } = await client.query(`
    select
      count(*)::int as produtos_ativos,
      count(distinct coalesce(nullif(trim(categoria_nome), ''), '(sem categoria)'))::int as categorias,
      count(distinct coalesce(nullif(trim(campo_hierarquico_1), ''), '(sem linha)'))::int as linhas
    from produto
    where ativo = true
  `);
  return rows[0];
}

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A5240' } };
  row.alignment = { vertical: 'middle', wrapText: true };
}

async function main() {
  const outPath = parseOutArg();
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const [linhas, totais] = await Promise.all([
    fetchLinhas(client),
    fetchTotais(client),
  ]);
  await client.end();

  const wb = new ExcelJS.Workbook();
  wb.creator = 'P38 ERP';
  wb.created = new Date();

  const ws = wb.addWorksheet('Linhas por categoria', {
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  ws.mergeCells('A1:G1');
  ws.getCell('A1').value = 'Linhas do catálogo (campo hierárquico 1) — ordenadas por categoria';
  ws.getCell('A1').font = { bold: true, size: 12 };

  ws.mergeCells('A2:G2');
  ws.getCell('A2').value = `Gerado em ${new Date().toLocaleString('pt-BR')} · ${totais.linhas} linhas · ${totais.categorias} categorias · ${totais.produtos_ativos} SKUs ativos`;

  ws.columns = [
    { header: 'Categoria', key: 'categoria', width: 34 },
    { header: 'Linha (h1)', key: 'linha', width: 36 },
    { header: 'SKUs ativos', key: 'skus_ativos', width: 12 },
    { header: 'Com estoque', key: 'skus_com_estoque', width: 12 },
    { header: 'Subtipos (h2)', key: 'subtipos_h2', width: 48 },
    { header: 'Exemplo SKU', key: 'exemplo_sku', width: 42 },
    { header: 'Categoria ID', key: 'categoria_id', width: 28 },
  ];

  const headerRow = ws.getRow(3);
  headerRow.values = ws.columns.map((c) => c.header);
  styleHeader(headerRow);

  let categoriaAtual = '';
  for (const row of linhas) {
    const excelRow = ws.addRow({
      categoria: row.categoria,
      linha: row.linha,
      skus_ativos: row.skus_ativos,
      skus_com_estoque: row.skus_com_estoque,
      subtipos_h2: row.subtipos_h2 || '',
      exemplo_sku: row.exemplo_sku || '',
      categoria_id: row.categoria_id || '',
    });
    if (row.categoria !== categoriaAtual) {
      categoriaAtual = row.categoria;
      excelRow.getCell('categoria').font = { bold: true };
      excelRow.getCell('categoria').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF4F5F0' },
      };
    }
    excelRow.getCell('skus_ativos').alignment = { horizontal: 'center' };
    excelRow.getCell('skus_com_estoque').alignment = { horizontal: 'center' };
  }

  ws.autoFilter = { from: 'A3', to: `G${3 + linhas.length}` };

  const resumo = wb.addWorksheet('Resumo categorias');
  resumo.columns = [
    { header: 'Categoria', key: 'categoria', width: 34 },
    { header: 'Qtd linhas', key: 'qtd_linhas', width: 12 },
    { header: 'SKUs ativos', key: 'skus', width: 12 },
  ];
  styleHeader(resumo.getRow(1));

  const porCat = new Map();
  for (const row of linhas) {
    const cur = porCat.get(row.categoria) || { categoria: row.categoria, qtd_linhas: 0, skus: 0 };
    cur.qtd_linhas += 1;
    cur.skus += row.skus_ativos;
    porCat.set(row.categoria, cur);
  }
  [...porCat.values()]
    .sort((a, b) => a.categoria.localeCompare(b.categoria, 'pt-BR'))
    .forEach((r) => resumo.addRow(r));

  await wb.xlsx.writeFile(outPath);
  console.log(`[export-linhas] ${linhas.length} linha(s) → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
