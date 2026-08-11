#!/usr/bin/env node
/**
 * Excel — catálogo completo (SKUs activos): categoria, código, h1–h5, nome, estoque.
 *
 * npm run export:catalogo-skus
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import ExcelJS from 'exceljs';

const OUT = path.join(process.cwd(), 'docs', 'exports', 'P38-catalogo-skus-completo.xlsx');

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

  const { rows } = await client.query(`
    select
      coalesce(nullif(trim(categoria_nome), ''), '(sem categoria)') as categoria,
      coalesce(codigo_interno, '') as codigo_interno,
      coalesce(campo_hierarquico_1, '') as h1,
      coalesce(campo_hierarquico_2, '') as h2,
      coalesce(campo_hierarquico_3, '') as h3,
      coalesce(campo_hierarquico_4, '') as h4,
      coalesce(campo_hierarquico_5, '') as h5,
      coalesce(nome, '') as descricao_completa,
      coalesce(estoque_atual, 0)::numeric as estoque_atual
    from produto
    where ativo = true
    order by categoria_nome nulls last, campo_hierarquico_1, campo_hierarquico_2, nome
  `);
  await client.end();

  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  const ws = wb.addWorksheet('Catálogo SKUs', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'categoria', key: 'categoria', width: 28 },
    { header: 'codigo interno', key: 'codigo_interno', width: 16 },
    { header: 'h1', key: 'h1', width: 22 },
    { header: 'h2', key: 'h2', width: 18 },
    { header: 'h3', key: 'h3', width: 18 },
    { header: 'h4', key: 'h4', width: 18 },
    { header: 'h5', key: 'h5', width: 18 },
    { header: 'descrição completa (sku)', key: 'descricao_completa', width: 48 },
    { header: 'estoque atual', key: 'estoque_atual', width: 14 },
  ];
  styleHeader(ws.getRow(1));

  for (const r of rows) {
    ws.addRow({
      ...r,
      estoque_atual: Number(r.estoque_atual) || 0,
    });
  }

  if (rows.length) {
    ws.autoFilter = { from: 'A1', to: `I${rows.length + 1}` };
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await wb.xlsx.writeFile(OUT);

  try {
    fs.copyFileSync(OUT, '/opt/cursor/artifacts/P38-catalogo-skus-completo.xlsx');
  } catch { /* ok */ }

  console.log(`[export-catalogo-skus] ${rows.length} SKUs → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
