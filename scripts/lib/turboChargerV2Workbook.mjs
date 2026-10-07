import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import pg from 'pg';
import { styleHeaderRow, styleDataCell, colLetter } from './turboChargerExcelStyle.mjs';

const SKUS_COMPLETO = path.join(process.cwd(), 'docs', 'exports', 'P38-catalogo-skus-completo.xlsx');

const SHEET_CAMINHO_4 = 'Caminho_4';
const SHEET_CATALOGO = 'Catalogo_atual';
const SHEET_4X3 = 'Catalogo_4x3';

const CAMINHO_4_COLS = [
  { key: 'codigo_interno', label: 'Cód. interno', width: 14 },
  { key: 'codigo_4x', label: 'Código caminho 4', width: 14 },
  { key: 'etapa', label: 'Etapa', width: 20 },
  { key: 'categoria', label: 'Categoria', width: 22 },
  { key: 'subcategoria', label: 'Subcategoria', width: 22 },
  { key: 'linha', label: 'Linha', width: 24 },
];

const CATALOGO_COLS = [
  { key: 'codigo_interno', label: 'Cód. interno', width: 14 },
  { key: 'comp1', label: 'comp1', width: 28 },
  { key: 'comp2', label: 'comp2', width: 18 },
  { key: 'comp3', label: 'comp3', width: 18 },
  { key: 'camp_hier_1', label: 'Camp hier 1', width: 24 },
  { key: 'camp_hier_2', label: 'Camp hier 2', width: 20 },
  { key: 'camp_hier_3', label: 'Camp hier 3', width: 20 },
  { key: 'camp_hier_4', label: 'Camp hier 4', width: 20 },
  { key: 'camp_hier_5', label: 'Camp hier 5', width: 20 },
];

/** Caminho 4× + comp 3× + Camp hier — aba única. */
const CATALOGO_4X3_COLS = [
  { key: 'codigo_interno', label: 'Cód. interno', width: 14 },
  { key: 'codigo_4x', label: 'Código caminho 4', width: 14 },
  { key: 'etapa', label: 'Etapa', width: 18 },
  { key: 'categoria', label: 'Categoria', width: 22 },
  { key: 'subcategoria', label: 'Subcategoria', width: 20 },
  { key: 'linha', label: 'Linha', width: 22 },
  { key: 'comp1', label: 'comp1', width: 28 },
  { key: 'comp2', label: 'comp2', width: 18 },
  { key: 'comp3', label: 'comp3', width: 18 },
  { key: 'camp_hier_1', label: 'Camp hier 1', width: 24 },
  { key: 'camp_hier_2', label: 'Camp hier 2', width: 20 },
  { key: 'camp_hier_3', label: 'Camp hier 3', width: 20 },
  { key: 'camp_hier_4', label: 'Camp hier 4', width: 20 },
  { key: 'camp_hier_5', label: 'Camp hier 5', width: 20 },
];

function cellStr(cell) {
  if (!cell || cell.value == null) return '';
  const v = cell.value;
  if (typeof v === 'object' && v.result != null) return String(v.result).trim();
  return String(v).trim();
}

/** @returns {Map<string, { camp_hier_1..5 }>} */
export async function loadCampHierByCodigo({ withSupabase = false } = {}) {
  const map = new Map();

  if (withSupabase && process.env.DATABASE_URL) {
    try {
      const client = new pg.Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });
      await client.connect();
      const { rows } = await client.query(`
        select upper(trim(codigo_interno)) as codigo_interno,
               coalesce(campo_hierarquico_1, '') as camp_hier_1,
               coalesce(campo_hierarquico_2, '') as camp_hier_2,
               coalesce(campo_hierarquico_3, '') as camp_hier_3,
               coalesce(campo_hierarquico_4, '') as camp_hier_4,
               coalesce(campo_hierarquico_5, '') as camp_hier_5
        from produto
        where codigo_interno is not null and trim(codigo_interno) <> ''
      `);
      await client.end();
      for (const r of rows) {
        map.set(r.codigo_interno, r);
      }
      return map;
    } catch (e) {
      console.warn('[turbocharger:v2] Supabase camp hier:', e.message);
    }
  }

  if (fs.existsSync(SKUS_COMPLETO)) {
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(SKUS_COMPLETO);
      const ws = wb.getWorksheet('Catálogo SKUs') || wb.worksheets[0];
      const header = {};
      ws.getRow(1).eachCell((c, i) => {
        header[cellStr(c).toLowerCase().replace(/\s+/g, '_')] = i;
      });
      const col = (...names) => {
        for (const n of names) {
          const idx = header[n];
          if (idx != null) return idx;
        }
        return null;
      };
      const iCod = col('codigo_interno', 'codigo_interno');
      const i1 = col('h1', 'camp_hier_1');
      const i2 = col('h2', 'camp_hier_2');
      const i3 = col('h3', 'camp_hier_3');
      const i4 = col('h4', 'camp_hier_4');
      const i5 = col('h5', 'camp_hier_5');
      if (iCod) {
        ws.eachRow((row, n) => {
          if (n === 1) return;
          const cod = cellStr(row.getCell(iCod)).toUpperCase();
          if (!cod) return;
          map.set(cod, {
            camp_hier_1: i1 ? cellStr(row.getCell(i1)) : '',
            camp_hier_2: i2 ? cellStr(row.getCell(i2)) : '',
            camp_hier_3: i3 ? cellStr(row.getCell(i3)) : '',
            camp_hier_4: i4 ? cellStr(row.getCell(i4)) : '',
            camp_hier_5: i5 ? cellStr(row.getCell(i5)) : '',
          });
        });
      }
    } catch (e) {
      console.warn('[turbocharger:v2] Excel skus-completo:', e.message);
    }
  }

  return map;
}

function writeDataSheet(wb, name, cols, rows) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = cols.map((c) => ({ header: c.label, key: c.key, width: c.width }));
  styleHeaderRow(ws.getRow(1));
  for (const row of rows) {
    const r = ws.addRow(row);
    r.eachCell({ includeEmpty: true }, (cell) => {
      styleDataCell(cell, { editavel: true });
    });
  }
  if (rows.length) {
    ws.autoFilter = { from: 'A1', to: `${colLetter(cols.length)}${rows.length + 1}` };
  }
  return ws;
}

/**
 * TurboCharger v2 — três abas de trabalho (+ README).
 * @param {object[]} factRows — normalizados (4×3)
 * @param {Map<string, object>} campHierByCod
 */
export function buildTurboChargerV2Workbook(factRows, campHierByCod = new Map()) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'P38 TurboCharger v2';
  wb.created = new Date();

  const readme = wb.addWorksheet('README');
  readme.getColumn(1).width = 22;
  readme.getColumn(2).width = 78;
  const lines = [
    ['P38 · TurboCharger v2', 'Layout simplificado — caminho 4 + catálogo 3×3 + camp hier'],
    [SHEET_CAMINHO_4, 'Cód. interno + código 4× + Etapa · Categoria · Sub · Linha (classificação)'],
    [
      SHEET_CATALOGO,
      'Catálogo actual: comp1 · comp2 · comp3 + Camp hier 1–5 (cadastro Supabase; células podem ficar vazias)',
    ],
    [
      SHEET_4X3,
      '4×3 completo: Caminho_4 + Catalogo_atual numa só aba (uma linha por SKU)',
    ],
    ['Regenerar', 'npm run turbocharger:generate:v2  (ou --with-supabase)'],
    ['Gerado em', new Date().toISOString()],
  ];
  lines.forEach(([a, b], i) => {
    readme.getCell(`A${i + 1}`).value = a;
    readme.getCell(`B${i + 1}`).value = b;
    if (i === 0) readme.getCell(`A${i + 1}`).font = { bold: true, size: 14 };
  });

  const caminhoRows = factRows.map((r) => ({
    codigo_interno: r.codigo_interno,
    codigo_4x: r.codigo_4x ?? '',
    etapa: r.etapa ?? '',
    categoria: r.categoria ?? '',
    subcategoria: r.subcategoria ?? '',
    linha: r.linha ?? '',
  }));

  const catalogoRows = factRows.map((r) => {
    const h = campHierByCod.get(r.codigo_interno) || {};
    return {
      codigo_interno: r.codigo_interno,
      comp1: r.comp1 ?? '',
      comp2: r.comp2 ?? '',
      comp3: r.comp3 ?? '',
      camp_hier_1: h.camp_hier_1 ?? '',
      camp_hier_2: h.camp_hier_2 ?? '',
      camp_hier_3: h.camp_hier_3 ?? '',
      camp_hier_4: h.camp_hier_4 ?? '',
      camp_hier_5: h.camp_hier_5 ?? '',
    };
  });

  const catalogo4x3Rows = factRows.map((r) => {
    const h = campHierByCod.get(r.codigo_interno) || {};
    return {
      codigo_interno: r.codigo_interno,
      codigo_4x: r.codigo_4x ?? '',
      etapa: r.etapa ?? '',
      categoria: r.categoria ?? '',
      subcategoria: r.subcategoria ?? '',
      linha: r.linha ?? '',
      comp1: r.comp1 ?? '',
      comp2: r.comp2 ?? '',
      comp3: r.comp3 ?? '',
      camp_hier_1: h.camp_hier_1 ?? '',
      camp_hier_2: h.camp_hier_2 ?? '',
      camp_hier_3: h.camp_hier_3 ?? '',
      camp_hier_4: h.camp_hier_4 ?? '',
      camp_hier_5: h.camp_hier_5 ?? '',
    };
  });

  writeDataSheet(wb, SHEET_CAMINHO_4, CAMINHO_4_COLS, caminhoRows);
  writeDataSheet(wb, SHEET_CATALOGO, CATALOGO_COLS, catalogoRows);
  writeDataSheet(wb, SHEET_4X3, CATALOGO_4X3_COLS, catalogo4x3Rows);

  return wb;
}
