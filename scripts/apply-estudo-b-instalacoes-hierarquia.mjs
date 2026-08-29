#!/usr/bin/env node
/**
 * Reestrutura bloco B: sub_bloco B1/B2 + grupo (C&C…).
 * Insere colunas grupo/grupo_ordem deslocando dados existentes (sem corromper core/linha/PC).
 *
 *   npm run estudo:catalog-b-hierarquia
 */
import path from 'node:path';
import ExcelJS from 'exceljs';

const EXCEL_PATH = path.join(process.cwd(), 'docs', 'exports', 'P38-sku-hierarquia-ab.xlsx');

const SHEETS = ['A — Edificações', 'B — Hidráulica', 'B — Elétrica', 'C — Acabamentos (prévia)', 'C prévia — elétrica visível'];

const B_SUB_GRUPO = {
  '01 — Soldável': { sub_bloco: 'B1 — Hidráulica', grupo: 'C&C — Canos e Conexões · Soldável', grupo_ordem: 1 },
  '02 — Esgoto': { sub_bloco: 'B1 — Hidráulica', grupo: 'C&C — Canos e Conexões · Esgoto', grupo_ordem: 2 },
  '03 — Roscável': { sub_bloco: 'B1 — Hidráulica', grupo: 'C&C — Canos e Conexões · Roscável', grupo_ordem: 3 },
  '04 — Captação': { sub_bloco: 'B1 — Hidráulica', grupo: 'Captação', grupo_ordem: 4 },
  '05 — Componentes': { sub_bloco: 'B1 — Hidráulica', grupo: 'Componentes', grupo_ordem: 5 },
  '06 — Padrão de entrada': { sub_bloco: 'B2 — Elétrica', grupo: 'Padrão de entrada', grupo_ordem: 1 },
  '07 — Infra (eletroduto e fios)': { sub_bloco: 'B2 — Elétrica', grupo: 'Infra (eletroduto e fios)', grupo_ordem: 2 },
  '08 — Quadro e proteção': { sub_bloco: 'B2 — Elétrica', grupo: 'Quadro e proteção', grupo_ordem: 3 },
  '09 — Caixas de espera': { sub_bloco: 'B2 — Elétrica', grupo: 'Caixas de espera', grupo_ordem: 4 },
};

function cellStr(cell) {
  if (!cell || cell.value == null) return '';
  const v = cell.value;
  if (typeof v === 'object' && v.result != null) return String(v.result).trim();
  return String(v).trim();
}

function readHeaders(ws) {
  const headerRow = ws.getRow(1);
  const headers = [];
  for (let c = 1; c <= headerRow.cellCount; c += 1) {
    const h = cellStr(headerRow.getCell(c));
    if (h) headers.push({ name: h, col: c });
  }
  return headers;
}

function headerNames(headers) {
  return headers.map((h) => h.name);
}

function insertColumnsAfter(ws, afterColName, newColNames) {
  const headers = readHeaders(ws);
  const names = headerNames(headers);
  if (newColNames.every((n) => names.includes(n))) return names;

  const after = headers.find((h) => h.name === afterColName);
  if (!after) throw new Error(`Coluna âncora não encontrada: ${afterColName}`);

  const insertAt = after.col + 1;
  const insertCount = newColNames.length;
  const lastRow = ws.rowCount;
  const lastCol = Math.max(ws.columnCount, headers[headers.length - 1].col);

  for (let r = 1; r <= lastRow; r += 1) {
    const row = ws.getRow(r);
    for (let c = lastCol; c >= insertAt; c -= 1) {
      row.getCell(c + insertCount).value = row.getCell(c).value;
      if (c < insertAt + insertCount) row.getCell(c).value = null;
    }
    if (r === 1) {
      newColNames.forEach((name, i) => {
        row.getCell(insertAt + i).value = name;
      });
    }
  }

  return headerNames(readHeaders(ws));
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);

  let updated = 0;

  for (const sheetName of SHEETS) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) continue;

    const headers = insertColumnsAfter(ws, 'sub_bloco', ['grupo', 'grupo_ordem']);
    const idx = Object.fromEntries(readHeaders(ws).map((h) => [h.name, h.col]));

    const isB = sheetName.startsWith('B —');

    for (let r = 2; r <= ws.rowCount; r += 1) {
      const row = ws.getRow(r);
      const get = (k) => cellStr(row.getCell(idx[k]));
      if (!get('codigo_interno')) continue;

      if (isB) {
        const oldSub = get('sub_bloco');
        const map = B_SUB_GRUPO[oldSub];
        if (!map) {
          console.warn(`[estudo-b-hier] ${sheetName} L${r}: sub_bloco desconhecido "${oldSub}"`);
          continue;
        }
        row.getCell(idx.sub_bloco).value = map.sub_bloco;
        row.getCell(idx.grupo).value = map.grupo;
        row.getCell(idx.grupo_ordem).value = map.grupo_ordem;
        updated += 1;
      } else {
        row.getCell(idx.grupo).value = '';
        row.getCell(idx.grupo_ordem).value = '';
      }
    }
  }

  await wb.xlsx.writeFile(EXCEL_PATH);
  console.log(`[estudo-b-hier] ${EXCEL_PATH}`);
  console.log(`  · ${updated} SKU(s) B → B1/B2 + grupo`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
