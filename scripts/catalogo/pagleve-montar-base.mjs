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

  const rows = preItens.map((pre) => rowFromPreOsCross(pre, map510.get(pre.codigo_loja)));

  const cruzados = rows.filter((r) => r.cruzamento === '510_marca').length;
  const sem510 = rows.length - cruzados;

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
    count: preItens.length,
    itens: preItens.map((p) => ({
      codigo_siah: p.codigo_loja,
      descricao: p.descricao,
      preco_varejo_m2: p.preco_varejo_m2,
      descricao_norm: p.descricao
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
    itens_pre_os: preItens.length,
    itens_catalogo: rows.length,
    cruzados_510: cruzados,
    pre_os_sem_510: sem510,
    por_fabricante: {},
    por_cruzamento: {},
  };
  for (const r of rows) {
    const g = r.fabricante_grupo || '(sem origem)';
    meta.por_fabricante[g] = (meta.por_fabricante[g] || 0) + 1;
    meta.por_cruzamento[r.cruzamento] = (meta.por_cruzamento[r.cruzamento] || 0) + 1;
  }
  fs.writeFileSync(OUT_META, `${JSON.stringify(meta, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        itens: rows.length,
        cruzados_510: cruzados,
        pre_os_sem_510: sem510,
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
