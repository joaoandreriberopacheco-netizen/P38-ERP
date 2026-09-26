#!/usr/bin/env node
/**
 * JSON embebido no app — mapa codigo_interno → caminho 4×3 (drill + nome).
 * npm run catalogo:4x3-client-manifest
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

const XLSX = path.join(process.cwd(), 'docs', 'exports', 'P38-catalogo-4x3.xlsx');
const OUT = path.join(process.cwd(), 'src', 'data', 'catalogo4x3Skus.generated.json');

function cellStr(cell) {
  if (!cell || cell.value == null) return '';
  const v = cell.value;
  if (typeof v === 'object' && v.result != null) return String(v.result).trim();
  return String(v).trim();
}

async function main() {
  if (!fs.existsSync(XLSX)) {
    console.error(`[4x3-client] Falta ${XLSX} — corra npm run export:catalogo-4x3`);
    process.exit(1);
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX);
  const ws = wb.getWorksheet('Catálogo 4×3');
  if (!ws) throw new Error('Aba "Catálogo 4×3" não encontrada');

  const headerRow = ws.getRow(1);
  const colIndex = {};
  headerRow.eachCell((cell, col) => {
    const key = cellStr(cell).toLowerCase().replace(/\s+/g, '_');
    if (key) colIndex[key] = col;
  });

  const pick = (row, ...names) => {
    for (const n of names) {
      const idx = colIndex[n];
      if (idx != null) return cellStr(row.getCell(idx));
    }
    return '';
  };

  const skus = {};
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const cod = pick(row, 'codigo_interno').toUpperCase();
    if (!cod) return;
    skus[cod] = {
      codigo_interno: cod,
      etapa: pick(row, 'etapa'),
      categoria: pick(row, 'categoria'),
      subcategoria: pick(row, 'subcategoria'),
      linha: pick(row, 'linha'),
      comp1: pick(row, 'comp1'),
      comp2: pick(row, 'comp2'),
      comp3: pick(row, 'comp3'),
      novo_sku: pick(row, 'novo_sku'),
      sku_atual: pick(row, 'sku_atual'),
      legenda: pick(row, 'legenda'),
      codigo_4x: pick(row, 'codigo_4x'),
      caminho: pick(row, 'caminho'),
    };
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    source: path.relative(process.cwd(), XLSX),
    skuCount: Object.keys(skus).length,
    skus,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(payload)}\n`);
  console.log(`[4x3-client] ${payload.skuCount} SKUs → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
