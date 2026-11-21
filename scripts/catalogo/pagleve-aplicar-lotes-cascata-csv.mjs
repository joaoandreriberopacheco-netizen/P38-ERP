#!/usr/bin/env node
/**
 * Aplica itens dos JSON cascata (lotes 8–17) em raio-x-pagleve-site-verificado.csv
 * npm run catalogo:aplicar-cascata-lotes -- 8 17
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ART = process.env.PAGLEVE_ARTIFACTS_DIR || '/opt/cursor/artifacts';
const OUT_CSV =
  process.env.PAGLEVE_OUT || path.join(ROOT, 'files', 'pagleve', 'raio-x-pagleve-site-verificado.csv');

const argv = process.argv.slice(2).map(Number).filter((n) => n > 0);
const LOTE_INICIO = argv[0] || Number(process.env.PAGLEVE_LOTE_INICIO || 8);
const LOTE_FIM = argv[1] || Number(process.env.PAGLEVE_LOTE_FIM || 17);

const CSV_FIELDS = [
  'codigo',
  'formato',
  'modelo',
  'descricao_erp',
  'fabricante_grupo',
  'marca_no_site',
  'descricao_no_site',
  'evidencia_url',
  'imagem_url',
  'imagens_json',
  'status',
  'sites_consultados',
  'match_metodo',
  'match_score',
  'observacao',
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
  return lines.slice(1).map((line) => {
    const vals = parseCsvLine(line);
    const row = {};
    header.forEach((h, i) => {
      row[h] = vals[i] ?? '';
    });
    return row;
  });
}

function escCell(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(p, rows) {
  const lines = [CSV_FIELDS.join(',')];
  for (const row of rows) {
    lines.push(CSV_FIELDS.map((f) => escCell(row[f])).join(','));
  }
  fs.writeFileSync(p, lines.join('\n') + '\n');
}

function siteFromUrl(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function applySweepItem(row, item) {
  const imgs = (item.imagens || []).map((i) => (typeof i === 'string' ? i : i.url)).filter(Boolean);
  if (item.status === 'confirmado_site') {
    row.fabricante_grupo = item.fabricante_grupo || row.fabricante_grupo;
    row.marca_no_site = item.marca_no_site || row.marca_no_site;
    row.descricao_no_site = item.nome_comercial || row.descricao_no_site;
    row.evidencia_url = item.produto_url || row.evidencia_url;
    row.imagem_url = imgs[0] || row.imagem_url;
    row.imagens_json = imgs.length ? JSON.stringify(imgs) : row.imagens_json;
    row.status = 'confirmado_site';
    row.sites_consultados = siteFromUrl(item.produto_url) || row.sites_consultados;
    row.match_metodo = item.match_metodo || row.match_metodo;
    row.match_score = String(item.match_score || row.match_score || '');
    row.observacao = (row.observacao ? `${row.observacao}; ` : '') + `cascata_lotes_${LOTE_INICIO}-${LOTE_FIM}`;
  } else {
    row.status = item.status || 'nao_encontrado';
    row.match_metodo = item.match_metodo || row.match_metodo;
    row.observacao = (row.observacao ? `${row.observacao}; ` : '') + (item.sem_foto_motivo || item.status);
  }
  if (item.formato) row.formato = item.formato;
}

function main() {
  const items = [];
  for (let n = LOTE_INICIO; n <= LOTE_FIM; n++) {
    const p = path.join(ART, `pagleve-lote${n}-cascata.json`);
    if (!fs.existsSync(p)) {
      console.warn('JSON ausente (skip):', p);
      continue;
    }
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const it of d.itens || []) items.push(it);
  }
  if (!items.length) {
    console.error('Nenhum item cascata nos lotes', LOTE_INICIO, '-', LOTE_FIM);
    process.exit(1);
  }

  const rows = loadCsv(OUT_CSV);
  const byCode = new Map(rows.map((r) => [String(r.codigo), r]));
  let updated = 0;
  let missing = [];
  for (const item of items) {
    const row = byCode.get(String(item.codigo));
    if (!row) {
      missing.push(item.codigo);
      continue;
    }
    applySweepItem(row, item);
    updated++;
  }
  writeCsv(OUT_CSV, rows);

  const report = {
    geradoEm: new Date().toISOString(),
    lotes: `${LOTE_INICIO}-${LOTE_FIM}`,
    itens_cascata: items.length,
    linhas_atualizadas: updated,
    codigos_ausentes_csv: missing,
    csv: OUT_CSV,
  };
  const repPath = path.join(ART, 'pagleve-lotes-8-17-csv-aplicado.json');
  fs.writeFileSync(repPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main();