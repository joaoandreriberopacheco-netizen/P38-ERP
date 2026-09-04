#!/usr/bin/env node
/**
 * Esquenta fornecedor: enriquece lista com specs + imagens (Formigres, Cerbras, Incefra…).
 * Sem Supabase.
 *
 * npm run esquenta:enriquecer
 */
import fs from 'node:fs';
import path from 'node:path';
import { findBestMatch as findFormigres, absUrl, parseDesc, buscar } from './lib/formigresCatalog.mjs';
import { findBestMatch as findCerbras } from './lib/cerbrasCatalog.mjs';
import { findByPdCode } from './lib/incefraCatalog.mjs';
import {
  ITENS,
  PRECO_LIQUIDO_M2,
  extractPdCode,
  inEsquentaScope,
  m2FromDesc,
  normFmtFromDesc,
  precoCaixa,
  routeFabricante,
} from './lib/esquentaItens.mjs';

const OUT_DIR = path.join(process.cwd(), 'docs', 'imports-local', 'esquenta-fornecedor');
const args = process.argv.slice(2);
const noImages = args.includes('--no-images');
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : null;

function safeName(s) {
  return String(s || 'sem-nome').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function csvEscape(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

async function maybeDownload(url, filePath) {
  if (!url || noImages) return false;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'P38-ERP-esquenta/1.0' } });
    if (!res.ok) return false;
    fs.writeFileSync(filePath, Buffer.from(await res.arrayBuffer()));
    return true;
  } catch {
    return false;
  }
}

async function matchFormigres(desc) {
  return findFormigres(desc, { requireFormatoSite: true, minScore: 30 });
}

async function matchCecafiEtna(desc) {
  const parsed = parseDesc(desc);
  const color = /\bBG\b/i.test(desc) ? 'BG' : /\bCZ\b/i.test(desc) ? 'CZ' : '';
  const queries = color ? [`ETNA ${color}`, 'ETNA'] : ['ETNA'];
  let best = null;
  for (const q of queries) {
    const prods = await buscar(q);
    best = prods.find((p) => /ETNA/i.test(p.titulo) && (!color || p.titulo.includes(color)));
    if (best) break;
  }
  if (!best) {
    return findFormigres(desc, { requireFormatoSite: false, minScore: 18 });
  }
  return {
    parsed,
    match: {
      titulo: best.titulo,
      formato: '45x45',
      acabamento: best.acabamento,
      imagem_url: best.imagem_url,
      marca_override: 'Cecafi',
    },
    score: 40,
    reason: null,
  };
}

async function matchFioranno(desc, parsed) {
  const r = await findFormigres(desc, { requireFormatoSite: false, minScore: 25 });
  if (r.match) return { ...r, match: { ...r.match, marca_override: 'Fioranno', formato: '45x45' } };
  return {
    parsed,
    match: {
      titulo: parsed.busca || 'GRIMES',
      formato: '45x45',
      acabamento: /ACET/i.test(desc) ? 'ACETINADO' : '',
      imagem: '',
      imagem_url: '',
    },
    score: 20,
    reason: null,
  };
}

async function matchIncefra(desc) {
  const pd = extractPdCode(desc);
  const { match, reason } = await findByPdCode(pd);
  const parsed = parseDesc(desc);
  if (!match) return { parsed, match: null, score: 0, reason: reason || 'sem_match' };
  return { parsed, match, score: match.imagem ? 40 : 25, reason: null };
}

async function processItem(desc, linha) {
  const formato = normFmtFromDesc(desc);
  const m2 = m2FromDesc(desc);
  const { preco_caixa, preco_liquido_m2 } = precoCaixa(m2);
  const fabricante = routeFabricante(desc, formato);

  const base = {
    linha,
    descricao_excel: desc,
    estoque_m2: '—',
    termo_busca: parseDesc(desc).busca,
    formato_excel: formato || '—',
    m2_excel: m2 || '—',
    encontrado: '—',
    formato_site: '—',
    acabamento_site: '—',
    fabricante_site: fabricante || '—',
    m2_caixa: m2 || '—',
    preco_liquido_m2,
    preco_caixa,
    imagem_url: '—',
    imagem_arquivo: '—',
    score: 0,
    status: 'revisar',
  };

  if (!inEsquentaScope(formato)) {
    return { ...base, status: 'ignorado (fora esquenta 45×45 / 46×46)' };
  }

  let result = { parsed: null, match: null, score: 0, reason: 'sem_match' };

  if (fabricante === 'Incefra') {
    result = await matchIncefra(desc);
  } else if (fabricante === 'Cerbras') {
    result = await findCerbras(desc);
  } else if (fabricante === 'Cecafi') {
    result = await matchCecafiEtna(desc);
  } else if (fabricante === 'Fioranno') {
    result = await matchFioranno(desc, parseDesc(desc));
  } else if (fabricante === 'Formigres') {
    result = await matchFormigres(desc);
  }

  const { parsed, match, score, reason } = result;
  if (parsed?.busca) base.termo_busca = parsed.busca;

  if (!match) {
    return { ...base, status: reason || 'revisar' };
  }

  let imgUrl = '';
  if (fabricante === 'Formigres' || fabricante === 'Cecafi') {
    imgUrl = absUrl(match.imagem_url || match.imagem);
  } else if (fabricante === 'Cerbras' || fabricante === 'Incefra') {
    imgUrl = match.imagem || '';
  }

  let imgFile = '';
  if (imgUrl) {
    try {
      const ext = path.extname(new URL(imgUrl).pathname) || '.jpg';
      imgFile = `${String(linha).padStart(3, '0')}-${safeName(match.titulo)}${ext}`;
      await maybeDownload(imgUrl, path.join(OUT_DIR, 'imagens', imgFile));
    } catch {
      imgFile = '';
    }
  }

  const marca = match.marca_override || match.marca_nome || fabricante;

  return {
    ...base,
    encontrado: match.titulo,
    formato_site: match.formato || formato,
    acabamento_site: match.acabamento || '—',
    fabricante_site: marca,
    imagem_url: imgUrl || '—',
    imagem_arquivo: imgFile || '—',
    score,
    status: 'encontrado',
  };
}

async function main() {
  fs.mkdirSync(path.join(OUT_DIR, 'imagens'), { recursive: true });

  const selected = limit ? ITENS.slice(0, limit) : ITENS;
  const results = [];
  const stats = { encontrado: 0, revisar: 0, ignorado: 0 };

  for (let i = 0; i < selected.length; i++) {
    const desc = selected[i];
    const row = await processItem(desc, i + 1);
    if (row.status === 'encontrado') stats.encontrado++;
    else if (String(row.status).startsWith('ignorado')) stats.ignorado++;
    else stats.revisar++;
    results.push(row);
    process.stderr.write(`… ${i + 1}/${selected.length} ${row.status}\n`);
  }

  const header = Object.keys(results[0] || {});
  const csv = [
    header.join(';'),
    ...results.map((r) => header.map((k) => csvEscape(r[k])).join(';')),
  ].join('\n') + '\n';

  const csvPath = path.join(OUT_DIR, 'resultado-completo.csv');
  fs.writeFileSync(csvPath, csv);

  const summary = {
    preco_tabela_m2: 28.5,
    desconto_pct: 15,
    preco_liquido_m2: PRECO_LIQUIDO_M2,
    total: results.length,
    ...stats,
    csv: csvPath,
    imagens: path.join(OUT_DIR, 'imagens'),
  };
  fs.writeFileSync(path.join(OUT_DIR, 'resumo.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
