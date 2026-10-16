#!/usr/bin/env node
/**
 * Extrai Código + Preço Varejo (R$/m²) dos scans SIAH — relatório que o fornecedor mandou.
 * npm run catalogo:extrair-precos-pagleve
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { stripAccents } from '../lib/formigresCatalog.mjs';

const ROOT = process.cwd();
const SCAN_DIRS = [
  path.join(ROOT, 'files', 'pagleve', 'fornecedor-siah-scans'),
];
const OUT_CSV = path.join(ROOT, 'files', 'pagleve', 'precos-siah-fornecedor.csv');
const OUT_JSON = path.join(ROOT, 'files', 'pagleve', 'precos-siah-fornecedor.json');

function findScanPngs() {
  const files = [];
  for (const dir of SCAN_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (/\.png$/i.test(name)) {
        files.push(path.join(dir, name));
      }
    }
  }
  return [...new Set(files)].sort();
}

function ocrPng(filePath) {
  return execSync(`tesseract "${filePath}" stdout -l por 2>/dev/null`, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

/** Saldo físico + preço varejo no fim da linha OCR. */
const ITEM_RE = /(\d{5})\s+(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{3})\s+(\d{1,3},\d{2})/g;

function parsePrecosFromText(text) {
  const map = new Map();
  const rows = [];
  let m;
  const re = new RegExp(ITEM_RE.source, 'g');
  while ((m = re.exec(text)) !== null) {
    const codigo = m[1];
    const descricao = m[2].replace(/\s+/g, ' ').trim();
    const preco = Number(m[4].replace(',', '.'));
    if (!Number.isFinite(preco) || preco <= 0) continue;
    const norm = normDesc(descricao);
    const row = {
      codigo_siah: codigo,
      descricao,
      descricao_norm: norm,
      preco_varejo_m2: preco,
      saldo_ocr: m[3],
    };
    rows.push(row);
    map.set(codigo, row);
    if (!map.has(`desc:${norm}`)) map.set(`desc:${norm}`, row);
  }
  return { rows, map };
}

function normDesc(s) {
  return stripAccents(String(s || ''))
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function main() {
  const pngs = findScanPngs();
  if (!pngs.length) {
    console.error('Nenhum scan PNG encontrado. Coloque em files/pagleve/fornecedor-siah-scans/');
    process.exit(1);
  }
  let allText = '';
  for (const p of pngs) {
    console.error('OCR:', path.basename(p));
    allText += `\n${ocrPng(p)}`;
  }
  const { rows } = parsePrecosFromText(allText);
  const byCode = new Map();
  for (const r of rows) byCode.set(r.codigo_siah, r);

  fs.mkdirSync(path.dirname(OUT_CSV), { recursive: true });
  const header = 'codigo_siah,descricao,preco_varejo_m2,descricao_norm\n';
  const lines = rows.map((r) =>
    [r.codigo_siah, `"${r.descricao.replace(/"/g, '""')}"`, r.preco_varejo_m2, r.descricao_norm].join(','),
  );
  fs.writeFileSync(OUT_CSV, header + lines.join('\n') + '\n');
  fs.writeFileSync(OUT_JSON, `${JSON.stringify({
    geradoEm: new Date().toISOString(),
    fonte: pngs,
    total: rows.length,
    itens: rows,
  }, null, 2)}\n`);

  console.log(JSON.stringify({
    ok: true,
    scans: pngs.length,
    precos: rows.length,
    csv: OUT_CSV,
    json: OUT_JSON,
  }, null, 2));
}

main();
