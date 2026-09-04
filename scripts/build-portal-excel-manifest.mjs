#!/usr/bin/env node
/**
 * Gera manifest JSON do Excel mestre (docs/P38-catalogo-skus-completo.xlsx)
 * + opcional CSV piloto FORRO PVC (docs/exports/P38-forro-pvc-smart-supply-exemplo.csv)
 *
 * npm run portal:excel-manifest
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

const EXCEL_CANDIDATES = [
  path.join(process.cwd(), 'docs', 'P38-catalogo-skus-completo.xlsx'),
  path.join(process.cwd(), 'docs', 'exports', 'P38-catalogo-skus-completo.xlsx'),
];

const FORRO_CSV = path.join(process.cwd(), 'docs', 'exports', 'P38-forro-pvc-smart-supply-exemplo.csv');

const OUT = path.join(process.cwd(), 'src', 'data', 'portalExcelManifest.generated.json');

/** LINHAs activas no portal / Smart Supply piloto. */
const LINHA_CANON = {
  CERAMICA_BOLD: { codigo: 'CERAMICA_BOLD', nome: 'CERÂMICA BOLD', tipo: 'portfolio', ordem: 10 },
  CERAMICA_RETIF: { codigo: 'CERAMICA_RETIF', nome: 'CERÂMICA RETIF', tipo: 'portfolio', ordem: 20 },
  FORRO_PVC: { codigo: 'FORRO_PVC', nome: 'FORRO PVC', tipo: 'portfolio_kit', ordem: 30 },
};

function resolveExcel() {
  for (const p of EXCEL_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`Excel não encontrado: ${EXCEL_CANDIDATES.join(', ')}`);
}

function cellStr(cell) {
  if (!cell || cell.value == null) return '';
  const v = cell.value;
  if (typeof v === 'object' && v.result != null) return String(v.result).trim();
  return String(v).trim();
}

function slugLinha(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'LINHA';
}

function slugPc(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'PC';
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === ',' && !inQ) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function ingestSkuRow(row, skus, linhasMap) {
  const categoria = row.categoria || '';
  const codigo = row.codigo_interno || '';
  const linhaNome = row.linha || '';
  const faixa = row.faixa || '';
  const modeloPortfolio = row.modelo_portfolio || '';
  const kitPapel = row.kit_papel || '';
  const produtoCompra = row.produto_compra || '';
  const exA = row.ex_a || '';
  const exB = row.ex_b || '';
  const novoSku = row.novo_sku || '';

  if (!codigo || !linhaNome) return;
  if (exB.toUpperCase() === 'ZUMBI') return;

  const linhaCodigo = slugLinha(linhaNome);
  const canon = LINHA_CANON[linhaCodigo];
  if (!canon) return;

  if (!linhasMap.has(linhaCodigo)) {
    linhasMap.set(linhaCodigo, { ...canon });
  }

  skus[codigo.toUpperCase()] = {
    codigo_interno: codigo,
    categoria: categoria || 'E - PISOS E REVESTIMENTOS',
    linha_codigo: canon.codigo,
    linha_nome: canon.nome,
    faixa: faixa || '',
    modelo_portfolio: modeloPortfolio || '',
    kit_papel: kitPapel || '',
    produto_compra: produtoCompra,
    produto_compra_codigo: slugPc(produtoCompra),
    ex_a: exA,
    ex_b: exB,
    novo_sku: novoSku || [produtoCompra, exA, exB].filter(Boolean).join(' '),
  };
}

function loadForroCsvSupplement(skus, linhasMap) {
  if (!fs.existsSync(FORRO_CSV)) return 0;
  const text = fs.readFileSync(FORRO_CSV, 'utf8').trim();
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return 0;

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  let added = 0;
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const row = {};
    header.forEach((key, idx) => {
      row[key] = cols[idx] || '';
    });
    const before = Object.keys(skus).length;
    ingestSkuRow(row, skus, linhasMap);
    if (Object.keys(skus).length > before) added += 1;
  }
  return added;
}

function detectColumnMap(headerRow) {
  const labels = headerRow.map((c) => cellStr(c).toLowerCase());
  const idx = (name, fallback) => {
    const i = labels.indexOf(name);
    return i >= 0 ? i + 1 : fallback;
  };
  const hasFaixa = labels.includes('faixa');
  if (!hasFaixa) {
    return {
      categoria: 1,
      codigo: 2,
      linha: 3,
      produto_compra: 4,
      ex_a: 5,
      ex_b: 6,
      novo_sku: 7,
      faixa: null,
      modelo_portfolio: null,
      kit_papel: null,
    };
  }
  return {
    categoria: idx('categoria', 1),
    codigo: idx('codigo_interno', 2),
    linha: idx('linha', 3),
    faixa: idx('faixa', 4),
    modelo_portfolio: idx('modelo_portfolio', 5),
    kit_papel: idx('kit_papel', 6),
    produto_compra: idx('produto_compra', 7),
    ex_a: idx('ex_a', 8),
    ex_b: idx('ex_b', 9),
    novo_sku: idx('novo_sku', 10),
  };
}

async function main() {
  const excelPath = resolveExcel();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(excelPath);
  const ws = wb.getWorksheet('Catálogo SKUs');
  if (!ws) throw new Error('Aba "Catálogo SKUs" não encontrada');

  const skus = {};
  const linhasMap = new Map();
  let colMap = null;

  ws.eachRow((row, n) => {
    if (n === 1) {
      colMap = detectColumnMap(row.values.slice(1));
      return;
    }
    if (!colMap) return;

    const get = (key) => cellStr(row.getCell(colMap[key]));
    ingestSkuRow(
      {
        categoria: get('categoria'),
        codigo_interno: get('codigo'),
        linha: get('linha'),
        faixa: colMap.faixa ? get('faixa') : '',
        modelo_portfolio: colMap.modelo_portfolio ? get('modelo_portfolio') : '',
        kit_papel: colMap.kit_papel ? get('kit_papel') : '',
        produto_compra: get('produto_compra'),
        ex_a: get('ex_a'),
        ex_b: get('ex_b'),
        novo_sku: get('novo_sku'),
      },
      skus,
      linhasMap,
    );
  });

  const csvAdded = loadForroCsvSupplement(skus, linhasMap);

  const linhas = [...linhasMap.values()].sort((a, b) => a.ordem - b.ordem);
  const payload = {
    exportedAt: new Date().toISOString(),
    source: path.relative(process.cwd(), excelPath),
    forroCsvSupplement: csvAdded > 0 ? path.relative(process.cwd(), FORRO_CSV) : null,
    skuCount: Object.keys(skus).length,
    linhaCount: linhas.length,
    linhas,
    skus,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    `[portal:excel-manifest] ${payload.skuCount} SKUs · ${payload.linhaCount} LINHA(s)`
    + (csvAdded ? ` (+${csvAdded} forro CSV)` : '')
    + ` → ${OUT}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
