#!/usr/bin/env node
/**
 * Gera P38 · TurboCharger — workbook relacional (design = importador em massa).
 *
 *   npm run turbocharger:generate
 *   npm run turbocharger:generate -- --with-supabase   (preenche SKU_Completo)
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import pg from 'pg';
import {
  styleHeaderRow,
  styleDataCell,
  colLetter,
  addListValidation,
  FILL_DIM,
} from './lib/turboChargerExcelStyle.mjs';
import { TURBO_SKU_COMPLETO_COLS } from './lib/turboChargerSkuCols.mjs';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'docs', 'exports', 'P38-TurboCharger.xlsx');
const SRC_4X3 = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-4x3.xlsx');
const WITH_SB = process.argv.includes('--with-supabase');

/** Uma aba horizontal: colunas A–G = listas para dropdowns na Fact. */
const LISTAS_SHEET = 'Listas';
/** Linhas vazias no fim de cada coluna para o utilizador acrescentar valores. */
const LIST_EXTRA_ROWS = 80;

const FACT_COLS = [
  { key: 'codigo_interno', label: 'Cód. Interno (*)', editavel: true, width: 14 },
  { key: 'etapa', label: 'ETAPA (lista)', editavel: true, width: 18, listCol: 'A' },
  { key: 'categoria', label: 'CATEGORIA (lista)', editavel: true, width: 22, listCol: 'B' },
  { key: 'subcategoria', label: 'SUB (lista)', editavel: true, width: 20, listCol: 'C' },
  { key: 'linha', label: 'LINHA (lista)', editavel: true, width: 22, listCol: 'D' },
  { key: 'comp1', label: 'Produto compra (lista)', editavel: true, width: 28, listCol: 'E' },
  { key: 'comp2', label: 'Eixo A (lista)', editavel: true, width: 18, listCol: 'F' },
  { key: 'comp3', label: 'Eixo B (lista)', editavel: true, width: 18, listCol: 'G' },
  { key: 'novo_sku', label: 'Nome vitrine 4×3', editavel: true, width: 42 },
  { key: 'codigo_4x', label: 'Código caminho 4', editavel: false, width: 12, calculado: true },
  { key: 'legenda', label: 'Legenda caminho', editavel: false, width: 48, calculado: true },
];

function cellStr(cell) {
  if (!cell || cell.value == null) return '';
  const v = cell.value;
  if (typeof v === 'object' && v.result != null) return String(v.result).trim();
  return String(v).trim();
}

async function loadFactRowsFrom4x3() {
  if (!fs.existsSync(SRC_4X3)) return [];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC_4X3);
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
      codigo_4x: pick(row, 'codigo_4x'),
      legenda: pick(row, 'legenda'),
    });
  });
  return rows;
}

function uniqueSorted(values) {
  return [...new Set(values.map((v) => String(v || '').trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );
}

function buildDimensions(factRows) {
  const etapas = uniqueSorted(factRows.map((r) => r.etapa));
  const categorias = uniqueSorted(factRows.map((r) => r.categoria));
  const subs = uniqueSorted(factRows.map((r) => r.subcategoria));
  const linhas = uniqueSorted(factRows.map((r) => r.linha));
  const pc = uniqueSorted(factRows.map((r) => r.comp1));
  const c2 = uniqueSorted(factRows.map((r) => r.comp2));
  const c3 = uniqueSorted(factRows.map((r) => r.comp3));
  return { etapas, categorias, subs, linhas, pc, c2, c3 };
}

function listasColumnSpecs(dim) {
  return [
    { label: 'ETAPA', width: 20, values: dim.etapas },
    { label: 'CATEGORIA', width: 24, values: dim.categorias },
    { label: 'SUBCATEGORIA', width: 22, values: dim.subs },
    { label: 'LINHA', width: 24, values: dim.linhas },
    { label: 'PRODUTO COMPRA (comp1)', width: 30, values: dim.pc },
    { label: 'EIXO A (comp2)', width: 20, values: dim.c2 },
    { label: 'EIXO B (comp3)', width: 20, values: dim.c3 },
  ];
}

/** @returns {Record<string, number>} fim da validação por coluna (A…G) — linha Excel inclusive */
function writeListasHorizontal(wb, dim) {
  const specs = listasColumnSpecs(dim);
  const bodyRows = Math.max(...specs.map((s) => s.values.length), 1) + LIST_EXTRA_ROWS;
  const ws = wb.addWorksheet(LISTAS_SHEET, { views: [{ state: 'frozen', ySplit: 1 }] });

  specs.forEach((spec, colIdx) => {
    ws.getColumn(colIdx + 1).width = spec.width;
    ws.getCell(1, colIdx + 1).value = spec.label;
  });
  styleHeaderRow(ws.getRow(1));

  for (let r = 0; r < bodyRows; r += 1) {
    const rowNum = r + 2;
    specs.forEach((spec, colIdx) => {
      const val = spec.values[r];
      if (!val) return;
      const cell = ws.getCell(rowNum, colIdx + 1);
      cell.value = val;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL_DIM } };
    });
  }

  ws.autoFilter = { from: 'A1', to: `${colLetter(specs.length)}${bodyRows + 1}` };

  const endRowByCol = {};
  specs.forEach((spec, colIdx) => {
    const letter = colLetter(colIdx + 1);
    endRowByCol[letter] = Math.max(spec.values.length + 1, 2) + LIST_EXTRA_ROWS;
  });
  return endRowByCol;
}

function dimListFormula(sheetName, col = 'A', start = 2, end = 500) {
  return `${sheetName}!$${col}$${start}:$${col}$${end}`;
}

async function fetchProdutosSupabase() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL em falta para --with-supabase');
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const { rows } = await client.query(`
    select codigo_interno, nome, categoria_nome, valor_compra, preco_venda_padrao,
           preco_custo_calculado as custo_total_calculado, estoque_atual, unidade_principal,
           case when ativo then 'true' else 'false' end as ativo
    from produto
    where codigo_interno is not null and trim(codigo_interno) <> ''
    order by categoria_nome nulls last, nome
  `);
  await client.end();
  return rows;
}

async function main() {
  const factRows = await loadFactRowsFrom4x3();
  const dim = buildDimensions(factRows);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'P38 TurboCharger';
  wb.created = new Date();

  // ── README ──
  const readme = wb.addWorksheet('README');
  readme.getColumn(1).width = 28;
  readme.getColumn(2).width = 72;
  const lines = [
    ['P38 · TurboCharger', 'Base de catálogo 4×3 — interface alimentada por Excel'],
    ['Design', 'Igual importador em massa: cabeçalho cinza, células editáveis claras, Supabase em azul'],
    ['Aba «Listas»', '7 colunas horizontais (ETAPA → … → comp3) — edite ou preencha linhas vazias no fim'],
    ['Fact_Catalogo_4x3', 'Uma linha por SKU — alimenta a UI Catálogo 4×3 após publicar'],
    ['SKU_Completo', 'Snapshot do cadastro (Supabase) — npm run turbocharger:generate -- --with-supabase'],
    ['Regenerar', 'npm run turbocharger:generate'],
    ['Fonte fact (seed)', fs.existsSync(SRC_4X3) ? path.relative(ROOT, SRC_4X3) : '(4×3 em falta)'],
    ['Gerado em', new Date().toISOString()],
  ];
  lines.forEach(([a, b], i) => {
    readme.getCell(`A${i + 1}`).value = a;
    readme.getCell(`B${i + 1}`).value = b;
    if (i === 0) readme.getCell(`A${i + 1}`).font = { bold: true, size: 14 };
  });

  const listEndRowByCol = writeListasHorizontal(wb, dim);

  // ── Fact ──
  const factWs = wb.addWorksheet('Fact_Catalogo_4x3', { views: [{ state: 'frozen', ySplit: 1 }] });
  factWs.columns = FACT_COLS.map((c) => ({ header: c.label, key: c.key, width: c.width }));
  styleHeaderRow(factWs.getRow(1));

  const extraBlank = 200;
  const maxFactRow = 1 + Math.max(factRows.length, 1) + extraBlank;

  FACT_COLS.forEach((col, idx) => {
    if (!col.listCol) return;
    const factLetter = colLetter(idx + 1);
    const endRow = listEndRowByCol[col.listCol] ?? 500;
    addListValidation(
      factWs,
      `${factLetter}2:${factLetter}${maxFactRow}`,
      dimListFormula(LISTAS_SHEET, col.listCol, 2, endRow),
    );
  });

  for (const row of factRows) {
    const r = factWs.addRow(row);
    r.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const cfg = FACT_COLS[colNumber - 1];
      styleDataCell(cell, {
        editavel: cfg?.editavel !== false,
        calculado: cfg?.calculado === true,
      });
    });
  }

  factWs.autoFilter = {
    from: 'A1',
    to: `${colLetter(FACT_COLS.length)}${Math.max(2, factRows.length + 1)}`,
  };

  // ── SKU_Completo ──
  const skuWs = wb.addWorksheet('SKU_Completo', { views: [{ state: 'frozen', ySplit: 1 }] });
  skuWs.columns = TURBO_SKU_COMPLETO_COLS.map((c) => ({
    header: c.label,
    key: c.key,
    width: c.width,
  }));
  styleHeaderRow(skuWs.getRow(1));

  const factByCod = new Map(factRows.map((r) => [r.codigo_interno, r]));
  let skuRows = [];
  if (WITH_SB) {
    try {
      skuRows = await fetchProdutosSupabase();
    } catch (e) {
      console.warn('[turbocharger] Supabase:', e.message);
    }
  }

  const rowsToWrite = skuRows.length ? skuRows : [];
  for (const p of rowsToWrite) {
    const cod = String(p.codigo_interno || '').trim().toUpperCase();
    const fact = factByCod.get(cod);
    const rowData = { ...p, novo_sku_4x3: fact?.novo_sku || '' };
    const r = skuWs.addRow(rowData);
    r.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const cfg = TURBO_SKU_COMPLETO_COLS[colNumber - 1];
      styleDataCell(cell, {
        editavel: false,
        calculado: cfg?.calculado !== false,
        numero: cfg?.tipo === 'numero',
      });
    });
  }

  if (!rowsToWrite.length) {
    skuWs.getCell('A2').value =
      '(vazio — corra com --with-supabase ou export futuro; colunas = espelho importador massa)';
    skuWs.mergeCells(`A2:${colLetter(TURBO_SKU_COMPLETO_COLS.length)}2`);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await wb.xlsx.writeFile(OUT);
  console.log(
    `[turbocharger] ${OUT}\n  Fact: ${factRows.length} SKU(s) · dims: ${dim.etapas.length} etapas · SKU_Completo: ${rowsToWrite.length} linha(s)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
