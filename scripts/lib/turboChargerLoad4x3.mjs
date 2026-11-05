import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

const SRC_4X3 = path.join(process.cwd(), 'docs', 'exports', 'P38-catalogo-4x3.xlsx');

function cellStr(cell) {
  if (!cell || cell.value == null) return '';
  const v = cell.value;
  if (typeof v === 'object' && v.result != null) return String(v.result).trim();
  return String(v).trim();
}

/** Linhas do catálogo 4×3 (uma por SKU). */
export async function loadFactRowsFrom4x3(srcPath = SRC_4X3) {
  if (!fs.existsSync(srcPath)) return [];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(srcPath);
  const ws = wb.getWorksheet('Catálogo 4×3');
  if (!ws) return [];
  const header = {};
  ws.getRow(1).eachCell((c, i) => {
    header[cellStr(c).toLowerCase().replace(/\s+/g, '_')] = i;
  });
  const pick = (row, ...names) => {
    for (const n of names) {
      const idx = header[n];
      if (idx != null) return cellStr(row.getCell(idx));
    }
    return '';
  };
  const rows = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const cod = pick(row, 'codigo_interno').toUpperCase();
    if (!cod) return;
    rows.push({
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
      codigo_4x: pick(row, 'codigo_4x'),
      legenda: pick(row, 'legenda'),
    });
  });
  return rows;
}

export { SRC_4X3 };
