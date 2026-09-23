#!/usr/bin/env node
/**
 * Benchmark catálogo P38 vs referência Leroy Merlin (agrupamento).
 *
 * Lê o export de hierarquia e acrescenta colunas LM para o agente comparar
 * família no site vs LINHA portal inferida.
 *
 * Uso:
 *   npm run export:sku-hierarquia-estudo
 *   npm run benchmark:leroy-merlin
 *   npm run benchmark:leroy-merlin -- --only-divergencias
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  sugerirReferenciaLeroyMerlin,
  linhasEquivalentes,
  LEROY_MERLIN_ARVORE_FIXACAO,
} from './lib/leroyMerlinReferencia.mjs';

const DEFAULT_IN = path.join(process.cwd(), 'docs', 'exports', 'P38-sku-hierarquia-estudo.csv');
const DEFAULT_OUT = path.join(process.cwd(), 'docs', 'exports', 'P38-leroy-merlin-benchmark.csv');

function parseArgs(argv) {
  const inArg = argv.find((a) => a.startsWith('--in='));
  const outArg = argv.find((a) => a.startsWith('--out='));
  return {
    inPath: inArg ? inArg.slice(5) : DEFAULT_IN,
    outPath: outArg ? outArg.slice(6) : DEFAULT_OUT,
    onlyDivergencias: argv.includes('--only-divergencias'),
  };
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

function csvCell(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function loadExportCsv(filePath) {
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
      novo_sku: get('novo_sku'),
      h1: get('h1'),
      h2: get('h2'),
      h3: get('h3'),
      sku_atual: get('sku_atual'),
    };
  });
}

const OUT_HEADERS = [
  'codigo_interno',
  'categoria_atual',
  'linha_nossa',
  'produto_compra',
  'sku_atual',
  'lm_departamento',
  'lm_caminho',
  'lm_familia',
  'linha_portal_sugerida',
  'divergencia_linha',
  'lm_url_pesquisa',
  'nota_lm',
];

function buildBenchmarkRows(rows) {
  return rows.map((row) => {
    const lm = sugerirReferenciaLeroyMerlin(row);
    const divergencia = lm.linhaPortalSugerida
      ? linhasEquivalentes(row.linha, lm.linhaPortalSugerida) ? 'NAO' : 'SIM'
      : '';

    return [
      row.codigo_interno,
      row.categoria_atual,
      row.linha,
      row.produto_compra,
      row.sku_atual,
      lm.departamento,
      lm.caminho,
      lm.familiaLm,
      lm.linhaPortalSugerida,
      divergencia,
      lm.lmUrl,
      lm.nota || '',
    ];
  });
}

function main() {
  const { inPath, outPath, onlyDivergencias } = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(inPath)) {
    throw new Error(`Export em falta: ${inPath}\nCorra primeiro: npm run export:sku-hierarquia-estudo`);
  }

  const resolvedOut = onlyDivergencias && outPath === DEFAULT_OUT
    ? outPath.replace(/\.csv$/i, '-divergencias.csv')
    : outPath;

  const rows = loadExportCsv(inPath);
  let outRows = buildBenchmarkRows(rows);
  if (onlyDivergencias) {
    outRows = outRows.filter((r) => r[9] === 'SIM');
  }

  const lines = [OUT_HEADERS.map(csvCell).join(','), ...outRows.map((r) => r.map(csvCell).join(','))];
  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
  fs.writeFileSync(resolvedOut, `\ufeff${lines.join('\n')}\n`, 'utf8');

  const divergencias = outRows.filter((r) => r[9] === 'SIM').length;
  const comLm = outRows.filter((r) => r[5]).length;

  console.log('[benchmark-leroy-merlin] OK');
  console.log(`  entrada: ${inPath}`);
  console.log(`  saída: ${resolvedOut}`);
  console.log(`  skus: ${outRows.length}`);
  console.log(`  com referência LM: ${comLm}`);
  console.log(`  divergências linha (nossa vs LM): ${divergencias}`);
  console.log('');
  console.log('Árvore LM — Fixação (referência):');
  for (const l of LEROY_MERLIN_ARVORE_FIXACAO) console.log(`  ${l}`);
  console.log('');
  console.log('Workflow agente:');
  console.log('  1. Filtrar divergencia_linha=SIM no CSV');
  console.log('  2. Abrir lm_url_pesquisa e confirmar breadcrumb no site');
  console.log('  3. Ajustar regras em scripts/lib/inferencia*.mjs');
}

main();
