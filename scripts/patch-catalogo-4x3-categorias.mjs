#!/usr/bin/env node
/** Aplica taxonomia canónica de categorias no P38-catalogo-4x3.xlsx (Fact). */
import path from 'node:path';
import ExcelJS from 'exceljs';
import { buildCodigosCaminho4x, pathKey4 } from './lib/catalogo3x3Map.mjs';
import { normalizeFactRowTaxonomy } from './lib/turboChargerCategorias.mjs';

const ROOT = process.cwd();
const XLSX = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-4x3.xlsx');

function cellStr(cell) {
  if (!cell || cell.value == null) return '';
  const v = cell.value;
  if (typeof v === 'object' && v.result != null) return String(v.result).trim();
  return String(v).trim();
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX);
  const ws = wb.getWorksheet('Catálogo 4×3');
  if (!ws) throw new Error('Aba Catálogo 4×3 em falta');

  const header = {};
  ws.getRow(1).eachCell((c, i) => {
    header[cellStr(c).toLowerCase().replace(/\s+/g, '_')] = i;
  });
  const col = (name) => header[name];

  const rows = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const cod = cellStr(row.getCell(col('codigo_interno'))).toUpperCase();
    if (!cod) return;
    const r = {
      codigo_interno: cod,
      etapa: cellStr(row.getCell(col('etapa'))),
      categoria: cellStr(row.getCell(col('categoria'))),
      subcategoria: cellStr(row.getCell(col('subcategoria'))),
      linha: cellStr(row.getCell(col('linha'))),
    };
    normalizeFactRowTaxonomy(r);
    rows.push({ row, data: r });
  });

  const codigos = buildCodigosCaminho4x(
    rows.map(({ data }) => ({
      etapa: data.etapa,
      categoria: data.categoria,
      subcategoria: data.subcategoria,
      linha: data.linha,
    })),
  );

  let changed = 0;
  for (const { row, data } of rows) {
    const codigo4x =
      codigos.get(pathKey4(data.etapa, data.categoria, data.subcategoria, data.linha)) ??
      cellStr(row.getCell(col('codigo_4x')));

    const before = cellStr(row.getCell(col('categoria')));
    row.getCell(col('categoria')).value = data.categoria;
    row.getCell(col('legenda')).value = data.legenda;
    if (col('codigo_4x') != null) row.getCell(col('codigo_4x')).value = codigo4x;
    if (before !== data.categoria) changed += 1;
  }

  await wb.xlsx.writeFile(XLSX);
  console.log(`[patch:categorias] ${XLSX} — ${changed} linha(s) com categoria alterada`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
