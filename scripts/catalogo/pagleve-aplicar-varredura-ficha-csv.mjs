#!/usr/bin/env node
/** FASE 3 — Grava local de uso / textura / borda da varredura no CSV raio-x. */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ART = process.env.PAGLEVE_ARTIFACTS_DIR || '/opt/cursor/artifacts';
const IN_VARREDURA = path.join(ART, 'pagleve-lotes-8-17-varredura-ficha.json');
const OUT_CSV = path.join(ROOT, 'files', 'pagleve', 'raio-x-pagleve-site-verificado.csv');

const EXTRA = [
  'local_uso_erp',
  'local_uso_nbr',
  'local_uso_fonte',
  'textura_erp',
  'textura_site',
  'tipo_borda_erp',
  'tipo_borda_site',
  'ficha_varredura_ok',
];

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function loadCsv(p) {
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const vals = parseCsvLine(line);
    const row = {};
    header.forEach((h, i) => {
      row[h] = vals[i] ?? '';
    });
    return row;
  });
  return { header, rows };
}

function escCell(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(p, header, rows) {
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(header.map((f) => escCell(row[f])).join(','));
  }
  fs.writeFileSync(p, lines.join('\n') + '\n');
}

function main() {
  if (!fs.existsSync(IN_VARREDURA)) {
    console.error('Varredura em falta:', IN_VARREDURA);
    process.exit(1);
  }
  const v = JSON.parse(fs.readFileSync(IN_VARREDURA, 'utf8'));
  const { header, rows } = loadCsv(OUT_CSV);
  const fields = [...new Set([...header, ...EXTRA])];
  const byCode = new Map(rows.map((r) => [String(r.codigo), r]));

  let updated = 0;
  for (const it of v.itens || []) {
    const row = byCode.get(String(it.codigo));
    if (!row) continue;
    row.local_uso_erp = it.local_uso_erp || '';
    row.local_uso_nbr = it.local_uso_site_nbr || '';
    row.local_uso_fonte = it.local_uso_fonte || '';
    row.textura_erp = it.textura_erp || '';
    row.textura_site = it.textura_site || '';
    row.tipo_borda_erp = it.borda_erp || '';
    row.tipo_borda_site = it.borda_site || '';
    const ok =
      it.divergencias?.length === 0 &&
      it.local_uso_ok !== false &&
      it.textura_ok !== false &&
      it.borda_ok !== false;
    row.ficha_varredura_ok = ok ? 'sim' : 'revisar';
    const alertas = (it.divergencias || [])
      .map((d) => `${d.campo}:${d.motivo}`)
      .join('; ');
    if (alertas) {
      row.observacao = (row.observacao ? `${row.observacao}; ` : '') + `varredura: ${alertas}`;
    }
    updated++;
  }
  writeCsv(OUT_CSV, fields, rows);
  console.log(JSON.stringify({ updated, csv: OUT_CSV }, null, 2));
}

main();