#!/usr/bin/env node
/**
 * Export catálogo delimitado: etapa → core → linha(·N|·C|·R) → produto compra → eixos.
 *
 * Camadas (5 + identificadores):
 *   etapa | core | linha | produto_compra | eixo_a | eixo_b
 *   + codigo_interno | novo_sku | sku_atual
 *
 * Subfolhas xlsx: Etapas (categorias ERP renomeadas), Referência cores, Legenda linha.
 *
 * Uso:
 *   npm run export:sku-hierarquia-core
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import ExcelJS from 'exceljs';
import { inferirCoreObra, listarCoresObra } from './lib/inferenciaCoreObra.mjs';
import {
  getLegendaLinha,
  getMapaEtapasCategoria,
  resolverEtapaSku,
  linhaComGlitch,
} from './lib/etapaCategoriaMap.mjs';

const DEFAULT_DIR = path.join(process.cwd(), 'docs', 'exports');
const DEFAULT_BASENAME = 'P38-sku-hierarquia-core';
const DEFAULT_IN = path.join(DEFAULT_DIR, 'P38-sku-hierarquia-estudo.csv');

/** Colunas principais — sem categoria ERP, sem h1–h3, sem papel_core solto. */
const EXPORT_HEADERS = [
  'codigo_interno',
  'etapa',
  'core',
  'linha',
  'produto_compra',
  'eixo_a',
  'eixo_b',
  'novo_sku',
  'sku_atual',
];

function parseArgs(argv) {
  const outArg = argv.find((a) => a.startsWith('--out='));
  const formatArg = argv.find((a) => a.startsWith('--format='));
  const inArg = argv.find((a) => a.startsWith('--in='));
  const format = (formatArg?.slice(9) || 'both').toLowerCase();
  if (!['xlsx', 'csv', 'both'].includes(format)) {
    throw new Error('--format deve ser xlsx, csv ou both');
  }
  const out = outArg ? outArg.slice(6) : path.join(DEFAULT_DIR, DEFAULT_BASENAME);
  return {
    inPath: inArg ? inArg.slice(5) : DEFAULT_IN,
    out,
    format,
    skipRegen: argv.includes('--skip-regen'),
  };
}

function csvCell(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseCSVLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      q = !q;
      continue;
    }
    if (c === ',' && !q) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

function loadEstudoCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, '');
  const lines = raw.trim().split('\n');
  const headers = parseCSVLine(lines[0]);
  const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
  return lines.slice(1).map((line) => {
    const cols = parseCSVLine(line);
    const get = (k) => (cols[idx[k]] ?? '').trim();
    return {
      codigo_interno: get('codigo_interno'),
      categoria_atual: get('categoria_atual'),
      linha: get('linha'),
      produto_compra: get('produto_compra'),
      eixo_a: get('eixo_a'),
      eixo_b: get('eixo_b'),
      novo_sku: get('novo_sku'),
      h1: get('h1'),
      h2: get('h2'),
      h3: get('h3'),
      sku_atual: get('sku_atual'),
    };
  });
}

function buildCatalogRows(rows) {
  return rows.map((row) => {
    const c = inferirCoreObra(row);
    const etapa = resolverEtapaSku(row.categoria_atual, c);
    const linha = linhaComGlitch(row.linha, c.papel_core);
    return [
      row.codigo_interno,
      etapa,
      c.core,
      linha,
      row.produto_compra,
      row.eixo_a,
      row.eixo_b,
      row.novo_sku,
      row.sku_atual,
    ];
  });
}

function resolveOutputPaths(out, format) {
  if (format === 'both') {
    const base = out.endsWith('.csv') || out.endsWith('.xlsx') ? out.replace(/\.(csv|xlsx)$/i, '') : out;
    return { xlsx: `${base}.xlsx`, csv: `${base}.csv` };
  }
  if (format === 'csv') return { csv: out.endsWith('.csv') ? out : `${out}.csv` };
  return { xlsx: out.endsWith('.xlsx') ? out : `${out}.xlsx` };
}

async function writeCsv(filePath, headers, dataRows) {
  const lines = [headers.map(csvCell).join(','), ...dataRows.map((r) => r.map(csvCell).join(','))];
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `\ufeff${lines.join('\n')}\n`, 'utf8');
}

async function writeXlsx(filePath, headers, dataRows) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'P38 export-sku-hierarquia-core';
  wb.created = new Date();

  const ws = wb.addWorksheet('Catálogo', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  ws.addRow(headers);
  for (const row of dataRows) ws.addRow(row);
  ws.getRow(1).font = { bold: true };
  const widths = [14, 28, 22, 26, 28, 12, 24, 42, 42];
  headers.forEach((_, i) => {
    ws.getColumn(i + 1).width = widths[i] ?? 16;
  });
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1 + dataRows.length, column: headers.length },
  };

  const etapas = wb.addWorksheet('Etapas');
  etapas.addRow(['categoria_erp', 'etapa', 'etapa_codigo']);
  for (const m of getMapaEtapasCategoria()) {
    etapas.addRow([m.categoria_erp, m.etapa, m.etapa_codigo]);
  }
  etapas.getRow(1).font = { bold: true };
  etapas.getColumn(1).width = 36;
  etapas.getColumn(2).width = 32;

  const legenda = wb.addWorksheet('Legenda linha');
  legenda.addRow(['sufixo', 'significado']);
  for (const [suf, desc] of Object.entries(getLegendaLinha())) {
    legenda.addRow([suf, desc]);
  }
  legenda.getRow(1).font = { bold: true };

  const ref = wb.addWorksheet('Referência cores');
  ref.addRow(['core', 'etapa', 'descricao']);
  for (const c of listarCoresObra()) {
    ref.addRow([c.codigo, c.etapa, c.descricao]);
  }
  ref.getRow(1).font = { bold: true };

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  await wb.xlsx.writeFile(filePath);
}

function printStats(dataRows) {
  let comCore = 0;
  let comGlitch = 0;
  for (const r of dataRows) {
    if (r[2]) comCore++;
    if (String(r[3]).includes('·')) comGlitch++;
  }
  console.log(`  com core: ${comCore} / ${dataRows.length}`);
  console.log(`  linha com glitch ·N/·C/·R: ${comGlitch}`);
}

async function main() {
  const { inPath, out, format, skipRegen } = parseArgs(process.argv.slice(2));

  if (!skipRegen) {
    console.log('[export-sku-hierarquia-core] Regenerar base estudo…');
    execSync('node scripts/export-sku-hierarquia-estudo.mjs --format=csv', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  }

  if (!fs.existsSync(inPath)) {
    throw new Error(`Export base em falta: ${inPath}`);
  }

  const rows = loadEstudoCsv(inPath);
  const dataRows = buildCatalogRows(rows);
  const paths = resolveOutputPaths(out, format);
  const written = [];

  if (paths.xlsx) {
    await writeXlsx(paths.xlsx, EXPORT_HEADERS, dataRows);
    written.push(paths.xlsx);
  }
  if (paths.csv) {
    await writeCsv(paths.csv, EXPORT_HEADERS, dataRows);
    written.push(paths.csv);
  }

  console.log('[export-sku-hierarquia-core] OK');
  for (const f of written) console.log(`  ficheiro: ${f}`);
  console.log(`  colunas: ${EXPORT_HEADERS.join(' → ')}`);
  console.log(`  skus: ${dataRows.length}`);
  printStats(dataRows);
}

main().catch((err) => {
  console.error('[export-sku-hierarquia-core]', err.message);
  process.exit(1);
});
