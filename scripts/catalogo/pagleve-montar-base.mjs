#!/usr/bin/env node
/**
 * Monta a base PagLeve: PRE_OS (preço + lista vendável) × PDF 510 por marca (origem + EAN + descrição).
 *
 * npm run catalogo:montar-base-pagleve
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  MARCA_PDF_META,
  parse510EstoqueText,
  parsePreOsPdf,
  pdftotext,
  rowFromPreOsCross,
} from '../lib/paglevePdfParse.mjs';

const ROOT = process.cwd();
const FONTE_DIR = path.join(ROOT, 'files', 'pagleve', 'fonte');
const PRE_OS_NAME = process.env.PAGLEVE_PRE_OS_PDF || 'PRE_OS_0973.pdf';
const OUT_CSV = path.join(ROOT, 'files', 'pagleve', 'pagleve-base-cruzada.csv');
const OUT_RAIOX = path.join(ROOT, 'files', 'pagleve', 'raio-x-pagleve-site-verificado.csv');
const OUT_PRODUTOS = path.join(ROOT, 'files', 'pagleve', 'raio-x-produtos.csv');
const OUT_PRECOS_JSON = path.join(ROOT, 'files', 'pagleve', 'precos-pre-os.json');
const OUT_META = path.join(ROOT, 'files', 'pagleve', 'pagleve-base-meta.json');

const CSV_FIELDS = [
  'codigo',
  'codigo_loja',
  'codigo_barras',
  'formato',
  'modelo',
  'descricao_erp',
  'fabricante_grupo',
  'marca_no_site',
  'marca_erp',
  'classe_pei',
  'preco_varejo_m2',
  'disponivel',
  'cruzamento',
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

function esc(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(filePath, rows) {
  const lines = [CSV_FIELDS.join(',')];
  for (const r of rows) {
    lines.push(CSV_FIELDS.map((h) => esc(r[h] ?? '')).join(','));
  }
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (c === ',' && !q) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function loadPriorMatchByCodigo() {
  const pathPrior = fs.existsSync(OUT_CSV) ? OUT_CSV : OUT_RAIOX;
  if (!fs.existsSync(pathPrior)) return new Map();
  const text = fs.readFileSync(pathPrior, 'utf8').replace(/\r\n/g, '\n');
  const lines = text.trim().split('\n');
  if (lines.length < 2) return new Map();
  const headers = parseCsvLine(lines[0]);
  const byCodigo = new Map();
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const o = {};
    headers.forEach((h, j) => {
      o[h] = cols[j] ?? '';
    });
    if (o.codigo) byCodigo.set(String(o.codigo), o);
  }
  return byCodigo;
}

const MATCH_PRESERVE = [
  'descricao_no_site',
  'evidencia_url',
  'imagem_url',
  'imagens_json',
  'status',
  'sites_consultados',
  'match_metodo',
  'match_score',
  'observacao',
  'marca_no_site',
];

function mergePriorSiteMatch(row, prior) {
  if (!prior) return row;
  if (prior.status !== 'confirmado_site' || !String(prior.evidencia_url || '').trim()) return row;
  const merged = { ...row };
  for (const k of MATCH_PRESERVE) {
    if (prior[k]) merged[k] = prior[k];
  }
  if (prior.fabricante_grupo && !merged.fabricante_grupo) merged.fabricante_grupo = prior.fabricante_grupo;
  return merged;
}

function load510ByCodigo() {
  const byCodigo = new Map();
  if (!fs.existsSync(FONTE_DIR)) return byCodigo;
  for (const name of fs.readdirSync(FONTE_DIR)) {
    const meta = MARCA_PDF_META[name];
    if (!meta) continue;
    const pdf = path.join(FONTE_DIR, name);
    const text = pdftotext(pdf);
    const rows = parse510EstoqueText(text, meta);
    for (const row of rows) {
      if (!byCodigo.has(row.codigo_loja)) byCodigo.set(row.codigo_loja, { ...row, fonte_pdf: name });
      else {
        const prev = byCodigo.get(row.codigo_loja);
        if (row.descricao.length > (prev.descricao || '').length) {
          byCodigo.set(row.codigo_loja, { ...row, fonte_pdf: name });
        }
      }
    }
  }
  return byCodigo;
}

function main() {
  const prePath = path.join(FONTE_DIR, PRE_OS_NAME);
  if (!fs.existsSync(prePath)) {
    console.error('PDF PRE_OS não encontrado:', prePath);
    process.exit(1);
  }

  const preItens = parsePreOsPdf(prePath);
  const map510 = load510ByCodigo();
  const priorByCodigo = loadPriorMatchByCodigo();
  const preByCod = new Map(preItens.map((p) => [p.codigo_loja, p]));

  /** Catálogo = só códigos nos PDFs de fábrica (510) **e** com preço no PRE_OS. */
  const rows = [];
  let fabricaSemPreOs = 0;
  for (const [cod, marca510] of map510) {
    const pre = preByCod.get(cod);
    if (!pre) {
      fabricaSemPreOs++;
      continue;
    }
    const row = rowFromPreOsCross(pre, marca510);
    row.cruzamento = '510_marca';
    row.observacao = `lista fábrica (${marca510.marca_erp || marca510.fonte_pdf || '510'}) + PRE_OS`;
    rows.push(mergePriorSiteMatch(row, priorByCodigo.get(cod)));
  }
  rows.sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt-BR', { numeric: true }));

  const preOsForaCatalogo = preItens.filter((p) => !map510.has(p.codigo_loja)).length;

  writeCsv(OUT_CSV, rows);
  writeCsv(OUT_RAIOX, rows);
  writeCsv(
    OUT_PRODUTOS,
    rows.map((r) => ({
      codigo: r.codigo,
      formato: r.formato,
      modelo: r.modelo,
      descricao_original: r.descricao_erp,
      descricao_erp: r.descricao_erp,
      fabricante_grupo: r.fabricante_grupo,
      marca_no_site: r.marca_no_site,
    })),
  );

  const precosPayload = {
    geradoEm: new Date().toISOString(),
    fonte: prePath,
    tipo: 'pre_os',
    count: rows.length,
    itens: rows.map((r) => ({
      codigo_siah: r.codigo_loja,
      descricao: r.descricao_erp,
      preco_varejo_m2: Number(r.preco_varejo_m2),
      descricao_norm: String(r.descricao_erp || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    })),
  };
  fs.writeFileSync(OUT_PRECOS_JSON, `${JSON.stringify(precosPayload, null, 2)}\n`);

  const meta = {
    geradoEm: new Date().toISOString(),
    pre_os: PRE_OS_NAME,
    regra: 'catalogo_somente_pdf_fabrica_com_preco_pre_os',
    itens_pre_os: preItens.length,
    itens_pdf_fabrica_510: map510.size,
    itens_catalogo: rows.length,
    pre_os_fora_catalogo: preOsForaCatalogo,
    fabrica_sem_pre_os: fabricaSemPreOs,
    por_fabricante: {},
  };
  for (const r of rows) {
    const g = r.fabricante_grupo || '(sem origem)';
    meta.por_fabricante[g] = (meta.por_fabricante[g] || 0) + 1;
  }
  fs.writeFileSync(OUT_META, `${JSON.stringify(meta, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        itens: rows.length,
        pre_os: preItens.length,
        pdf_fabrica: map510.size,
        pre_os_fora_catalogo: preOsForaCatalogo,
        fabrica_sem_pre_os: fabricaSemPreOs,
        csv: OUT_CSV,
        precos: OUT_PRECOS_JSON,
        meta: OUT_META,
      },
      null,
      2,
    ),
  );
}

main();
