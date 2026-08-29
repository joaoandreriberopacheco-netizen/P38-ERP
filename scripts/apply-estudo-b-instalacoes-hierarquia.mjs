#!/usr/bin/env node
/**
 * Reestrutura bloco B no Excel: sub_bloco B1/B2 + grupo (C&C soldável/roscável/esgoto…).
 * Fonte canónica — correr uma vez ou quando resetar folhas B.
 *
 *   node scripts/apply-estudo-b-instalacoes-hierarquia.mjs
 */
import path from 'node:path';
import ExcelJS from 'exceljs';

const EXCEL_PATH = path.join(process.cwd(), 'docs', 'exports', 'P38-sku-hierarquia-ab.xlsx');

const SHEETS = ['A — Edificações', 'B — Hidráulica', 'B — Elétrica', 'C — Acabamentos (prévia)', 'C prévia — elétrica visível'];

/** Legenda B01–B09 → sub_bloco + grupo + ordem */
const B_SUB_GRUPO = {
  '01 — Soldável': {
    sub_bloco: 'B1 — Hidráulica',
    grupo: 'C&C — Canos e Conexões · Soldável',
    grupo_ordem: 1,
  },
  '02 — Esgoto': {
    sub_bloco: 'B1 — Hidráulica',
    grupo: 'C&C — Canos e Conexões · Esgoto',
    grupo_ordem: 2,
  },
  '03 — Roscável': {
    sub_bloco: 'B1 — Hidráulica',
    grupo: 'C&C — Canos e Conexões · Roscável',
    grupo_ordem: 3,
  },
  '04 — Captação': {
    sub_bloco: 'B1 — Hidráulica',
    grupo: 'Captação',
    grupo_ordem: 4,
  },
  '05 — Componentes': {
    sub_bloco: 'B1 — Hidráulica',
    grupo: 'Componentes',
    grupo_ordem: 5,
  },
  '06 — Padrão de entrada': {
    sub_bloco: 'B2 — Elétrica',
    grupo: 'Padrão de entrada',
    grupo_ordem: 1,
  },
  '07 — Infra (eletroduto e fios)': {
    sub_bloco: 'B2 — Elétrica',
    grupo: 'Infra (eletroduto e fios)',
    grupo_ordem: 2,
  },
  '08 — Quadro e proteção': {
    sub_bloco: 'B2 — Elétrica',
    grupo: 'Quadro e proteção',
    grupo_ordem: 3,
  },
  '09 — Caixas de espera': {
    sub_bloco: 'B2 — Elétrica',
    grupo: 'Caixas de espera',
    grupo_ordem: 4,
  },
};

function cellStr(cell) {
  if (!cell || cell.value == null) return '';
  const v = cell.value;
  if (typeof v === 'object' && v.result != null) return String(v.result).trim();
  return String(v).trim();
}

function ensureColumn(ws, headers, afterCol, colName) {
  if (headers.includes(colName)) return headers;
  const afterIdx = headers.indexOf(afterCol);
  if (afterIdx < 0) throw new Error(`Coluna âncora não encontrada: ${afterCol}`);
  headers.splice(afterIdx + 1, 0, colName);
  const row = ws.getRow(1);
  headers.forEach((h, i) => {
    row.getCell(i + 1).value = h;
  });
  return headers;
}

function readHeaders(ws) {
  const headerRow = ws.getRow(1);
  const headers = [];
  for (let c = 1; c <= headerRow.cellCount; c += 1) {
    const h = cellStr(headerRow.getCell(c));
    if (h) headers.push(h);
  }
  return headers;
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);

  let updated = 0;

  for (const sheetName of SHEETS) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) continue;

    let headers = readHeaders(ws);
    headers = ensureColumn(ws, headers, 'sub_bloco', 'grupo');
    headers = ensureColumn(ws, headers, 'grupo', 'grupo_ordem');
    const idx = Object.fromEntries(headers.map((h, i) => [h, i + 1]));

    const isB = sheetName.startsWith('B —');

    for (let r = 2; r <= ws.rowCount; r += 1) {
      const row = ws.getRow(r);
      const get = (k) => cellStr(row.getCell(idx[k]));
      if (!get('codigo_interno')) continue;

      if (isB) {
        const oldSub = get('sub_bloco');
        const map = B_SUB_GRUPO[oldSub];
        if (!map) {
          console.warn(`[estudo-b-hier] ${sheetName} linha ${r}: sub_bloco desconhecido "${oldSub}"`);
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

  // Legenda — ramos B1/B2
  const leg = wb.getWorksheet('Legenda A-B');
  if (leg) {
    const append = (tipo, codigo, desc) => {
      const r = leg.rowCount + 1;
      leg.getRow(r).values = [null, tipo, codigo, desc];
    };
    append('Sub B', 'B1', 'B1 — Hidráulica — soldável, esgoto, roscável, captação, componentes');
    append('Sub B', 'B2', 'B2 — Elétrica — padrão, infra, quadro, caixas de espera');
    append('Grupo B1', 'C&C·S', 'C&C — Canos e Conexões · Soldável');
    append('Grupo B1', 'C&C·E', 'C&C — Canos e Conexões · Esgoto');
    append('Grupo B1', 'C&C·R', 'C&C — Canos e Conexões · Roscável');
  }

  await wb.xlsx.writeFile(EXCEL_PATH);
  console.log(`[estudo-b-hier] ${EXCEL_PATH}`);
  console.log(`  · ${updated} SKU(s) B actualizados (B1/B2 + grupo)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
