#!/usr/bin/env node
/**
 * PagLeve — match por FORMATO, só com evidência no site (+ imagem quando houver).
 *
 * node scripts/catalogo/pagleve-match-por-formato.mjs
 * node scripts/catalogo/pagleve-match-por-formato.mjs --formato 70x70
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  buildSnapshot as buildFormigresSnapshot,
  fetchAllProdutos as fetchFormigresProdutos,
  findInSnapshot as findInFormigresSnapshot,
} from '../lib/formigresSnapshot.mjs';
import {
  buildSnapshot as buildCarmeloSnapshot,
  fetchAllProdutos as fetchCarmeloProdutos,
} from '../lib/carmeloFiorSnapshot.mjs';
import {
  buildSnapshot as buildCerbrasSnapshot,
  fetchSitemapUrls,
  normalizeFromUrl,
  findInSnapshot as findInCerbrasSnapshot,
} from '../lib/cerbrasSnapshot.mjs';
import {
  incopisosProdutoUrl,
  incopisosSlugCandidates,
  parseIncopisosOembedJson,
  parseIncopisosProdutoHtml,
} from '../lib/incopisosPaginaProduto.mjs';
import {
  extractImagensFromDetalhe,
  fetchProdutoDetalhe,
} from '../lib/formigresCatalog.mjs';
import { stripAccents } from '../lib/formigresCatalog.mjs';
import { raioXProdutoDescricao } from '../lib/raioXProdutoDescricao.mjs';

const ROOT = process.cwd();
const IN_CSV = process.env.PAGLEVE_RAIO_X || path.join(ROOT, 'files', 'pagleve', 'raio-x-produtos.csv');
const OUT_CSV = process.env.PAGLEVE_OUT || path.join(ROOT, 'files', 'pagleve', 'raio-x-pagleve-site-verificado.csv');
const ROCHA_BASE = 'https://www.portalgruporocha.com.br';
const LUME_BASE = 'https://lumeceramica.com.br';
const UA = 'P38-PagLeve-match/1.0';

const args = process.argv.slice(2);
const onlyFmt = args.includes('--formato') ? args[args.indexOf('--formato') + 1]?.toLowerCase() : null;
const onlyIndicacao = args.includes('--only-indicacao');

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

/** Ordem de busca conforme fabricante sugerido (João André / pagleve-fabricantes-sites-oficiais.md). */
function siteTryOrderForRow(row) {
  const g = stripAccents(row.fabricante_grupo || '').toLowerCase();
  const desc = stripAccents(row.descricao_erp || row.descricao_original || '').toLowerCase();
  const fmt = (row.formato || '').toLowerCase();
  if (g.includes('incopisos') || fmt === '32x58' || fmt === '39x75') {
    return ['incopisos', 'formigres', 'carmelo', 'lume', 'rocha', 'cerbras'];
  }
  if (g.includes('lume') || fmt === '45x89' || fmt === '62x119' || fmt === '22x90') {
    return ['lume', 'formigres', 'carmelo', 'rocha', 'cerbras'];
  }
  if (g.includes('carmelo') || g.includes('arielle')) {
    return ['carmelo', 'formigres', 'lume', 'rocha', 'cerbras'];
  }
  if (g.includes('rocha') || g.includes('rochamaxx') || g.includes('rochaforte')) {
    return ['rocha', 'formigres', 'lume', 'carmelo', 'cerbras'];
  }
  if (g.includes('cecafi') || g.includes('etna') || fmt === '38x75' || fmt === '57x57') {
    return ['carmelo', 'formigres', 'cerbras', 'lume', 'rocha'];
  }
  if (g.includes('cedasa') || fmt === '58x58') {
    return ['cerbras', 'formigres', 'carmelo', 'lume', 'rocha'];
  }
  if (g.includes('cerbras')) return ['cerbras', 'formigres', 'carmelo', 'lume', 'rocha'];
  if (desc.includes('rochaprime') || desc.includes('rochamaxx') || g.includes('formigres')) {
    return ['formigres', 'rocha', 'carmelo', 'lume', 'cerbras'];
  }
  return ['formigres', 'rocha', 'lume', 'carmelo', 'cerbras'];
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

function loadCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const lines = text.trim().split('\n');
  const headers = parseCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCsvLine(lines[i]);
    const o = {};
    headers.forEach((h, j) => {
      o[h] = cols[j] ?? '';
    });
    rows.push(o);
  }
  return rows;
}

function escapeCsv(val) {
  const s = String(val ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(filePath, rows, fieldnames) {
  const lines = [fieldnames.join(',')];
  for (const r of rows) {
    lines.push(fieldnames.map((k) => escapeCsv(r[k])).join(','));
  }
  fs.writeFileSync(filePath, lines.join('\n') + '\n');
}

function curlGet(url) {
  const tls = String(url).includes('lumeceramica.com.br') ? '-k ' : '';
  try {
    return execSync(`curl ${tls}-sL --max-time 25 -A ${JSON.stringify(UA)} ${JSON.stringify(url)}`, {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch {
    return '';
  }
}

function metaOg(html, prop) {
  const re = new RegExp(`<meta property="${prop}" content="([^"]+)"`, 'i');
  const m = html.match(re);
  return m ? m[1] : '';
}

function pickRochaImage(html, slug) {
  const og = metaOg(html, 'og:image');
  if (og && !og.includes('_og/')) return og;
  const re = new RegExp(
    `https://api\\.portalgruporocha\\.com\\.br/storage/images/${slug}[^"'\\s]+\\.(webp|jpg|png)`,
    'i',
  );
  const m = html.match(re);
  return m ? m[0] : og || '';
}

async function loadRochaSlugIndex() {
  const html = curlGet(`${ROCHA_BASE}/produtos`);
  const slugs = new Set();
  const re = /\/produtos\/([a-z0-9-]+)/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1].length >= 3) slugs.add(m[1].toLowerCase());
  }
  return { slugs, html };
}

function nameSlug(text) {
  return stripAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/-+/g, '-');
}

/** Nome comercial para busca no site — só texto da descrição, sem códigos internos do fornecedor (PR…, R…). */
function modeloParaBusca(row) {
  const desc = row.descricao_erp || row.descricao_original || '';
  const rx = raioXProdutoDescricao(row.codigo, desc);
  let modelo = rx.modelo || '';
  modelo = modelo
    .replace(/\([^)]*$/g, ' ')
    .replace(/\(\d+[,.]?\d*\)?/g, ' ')
    .replace(/\b0X\d+\b/gi, ' ')
    .replace(/\b(PR\d{3,}|R\d{3,})\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!modelo || /^[a-z]?\d+$/i.test(modelo.replace(/\s/g, ''))) {
    modelo = stripAccents(desc)
      .replace(/\b\d{2,5}\b/g, ' ')
      .replace(/\b(PR\d+|R\d+)\b/gi, ' ')
      .replace(/[^a-zA-Z ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 3 && !/^(PISO|ROCHAPRIME|ROCHAMAXX|HD|MRE)$/i.test(w))
      .slice(0, 4)
      .join(' ');
  }
  return modelo;
}

function temNomeComercial(row) {
  const m = modeloParaBusca(row);
  if (!m || m.length < 4) return false;
  const tokens = m.split(/\s+/).filter((t) => t.length >= 4 && !/^(rochaprime|rochamaxx)$/i.test(t));
  return tokens.length > 0;
}

function rochaSlugCandidates(row) {
  const modelo = modeloParaBusca(row);
  const out = [];
  const ns = nameSlug(modelo);
  if (ns.length >= 4) out.push(ns);
  const words = stripAccents(modelo)
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3 && !/^(rocha|prime|hd|mre|rochaprime)$/i.test(w));
  if (words.length >= 2) out.push(`${words[0]}-${words[1]}`);
  for (const w of words) {
    if (w.length >= 5) out.push(w);
  }
  const norm = stripAccents(modelo).toLowerCase();
  if (/^metrop/.test(norm) && !norm.includes('metropole')) out.push('metropole');
  return [...new Set(out)];
}

/** PR70001 no ERP → pr7000 no portal (regra João André; não é busca por código interno aleatório). */
function rochaSlugFromSiahDesc(desc) {
  const m = String(desc || '').match(/\b(PR|R)(\d{4,})\b/i);
  if (!m) return '';
  let digits = m[2];
  if (digits.length >= 5 && digits.endsWith('1')) digits = digits.slice(0, -1);
  const core = digits.length > 4 ? digits.slice(0, 4) : digits;
  return `${m[1].toLowerCase()}${core}`;
}

function tryRocha(row, rochaSlugs) {
  const candidates = rochaSlugCandidates(row);
  const codeSlug = rochaSlugFromSiahDesc(row.descricao_erp || row.descricao_original);
  if (codeSlug) candidates.unshift(codeSlug);
  const tried = [];
  for (let c of candidates) {
    if (/^(pr|r)\d+$/i.test(c) && c !== codeSlug) {
      tried.push(c);
      continue;
    }
    if (!rochaSlugs.has(c) && /^\d/.test(c)) {
      tried.push(c);
      continue;
    }
    const url = `${ROCHA_BASE}/produtos/${c}`;
    const html = curlGet(url);
    if (!html || html.includes('Page not found') || html.length < 500) {
      tried.push(c);
      continue;
    }
    const title = metaOg(html, 'og:title') || '';
    if (!title || /not found/i.test(title)) {
      tried.push(c);
      continue;
    }
    const img = pickRochaImage(html, c);
    return {
      fabricante_grupo: 'Grupo Rocha',
      marca_no_site: 'Rochaforte / Rocha Cerâmica',
      descricao_no_site: title.replace(/\s*\|\s*Grupo Rocha\s*$/i, '').trim(),
      evidencia_url: url,
      imagem_url: img,
      status: 'confirmado_site',
      sites_consultados: 'portalgruporocha.com.br',
      match_metodo: `rocha_slug:${c}`,
      tried,
    };
  }
  return { tried, sites_consultados: 'portalgruporocha.com.br' };
}

async function tryFormigres(row, snap) {
  const nome = modeloParaBusca(row);
  if (!temNomeComercial(row) && !nome) {
    return { reason: 'sem_nome', sites_consultados: 'formigres.com.br' };
  }
  const desc = nome ? `${row.formato} ${nome}` : row.descricao_original || '';
  const { match, score, reason } = findInFormigresSnapshot(snap, desc, {
    minScore: 32,
    requireFormato: true,
  });
  if (!match) return { reason, score, sites_consultados: 'formigres.com.br' };
  let detalhe = null;
  try {
    detalhe = await fetchProdutoDetalhe(match.id);
  } catch {
    detalhe = null;
  }
  const imgs = extractImagensFromDetalhe(detalhe || match);
  const principal = imgs.find((i) => i.principal) || imgs[0];
  return {
    fabricante_grupo: 'Grupo Formigres',
    marca_no_site: match.marca_nome || '',
    descricao_no_site: [match.titulo, match.formato, match.tipo, match.acabamento]
      .filter(Boolean)
      .join(' · '),
    evidencia_url: match.produto_url || `https://www.formigres.com.br/produto/${match.id}`,
    imagem_url: principal?.url || match.imagem_url || '',
    imagens_json: JSON.stringify(imgs.map((i) => i.url).slice(0, 6)),
    status: 'confirmado_site',
    sites_consultados: 'formigres.com.br',
    match_metodo: `formigres_snapshot:${score}`,
    match_score: String(score),
  };
}

function tryLume(row) {
  if (!temNomeComercial(row)) {
    return { sites_consultados: 'lumeceramica.com.br', reason: 'sem_nome' };
  }
  const q = stripAccents(modeloParaBusca(row) || '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(' ');
  if (!q) return { sites_consultados: 'lumeceramica.com.br' };
  const html = curlGet(`${LUME_BASE}/?s=${encodeURIComponent(q)}`);
  if (!html) return { sites_consultados: 'lumeceramica.com.br' };
  if (/0\s+resultados\s+para|Nenhum resultado encontrado/i.test(html)) {
    return { sites_consultados: 'lumeceramica.com.br', tried: q, reason: 'zero_resultados' };
  }
  const fmt = (row.formato || '').replace('x', '[x×]');
  const linkRe = new RegExp(
    `href=\"(https://lumeceramica\\.com\\.br/produto/[^\"]+)\"[^>]*>([^<]{4,120})<`,
    'gi',
  );
  let best = null;
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    const title = m[2].replace(/\s+/g, ' ').trim();
    if (!new RegExp(fmt, 'i').test(title) && !new RegExp(fmt, 'i').test(m[1])) continue;
    if (!stripAccents(title).toLowerCase().includes(stripAccents(q.split(' ')[0]).toLowerCase())) continue;
    best = { url: m[1], title };
    break;
  }
  if (!best) return { sites_consultados: 'lumeceramica.com.br', tried: q };
  const imgM = html.match(/https:\/\/[^"'\s]+lume[^"'\s]+\.(webp|jpg|png)/i);
  return {
    fabricante_grupo: 'Lume Cerâmica',
    marca_no_site: 'Lume',
    descricao_no_site: best.title,
    evidencia_url: best.url,
    imagem_url: imgM ? imgM[0] : '',
    status: 'confirmado_site',
    sites_consultados: 'lumeceramica.com.br',
    match_metodo: `lume_busca:${q}`,
  };
}

function tryCarmelo(row, snap) {
  if (!temNomeComercial(row)) {
    return { sites_consultados: 'carmelofior.com.br', reason: 'sem_nome' };
  }
  const nome = modeloParaBusca(row);
  const desc = `${row.formato} ${nome}`;
  const { match, score } = findInFormigresSnapshot(snap, desc, {
    minScore: 32,
    requireFormato: true,
  });
  if (!match) return { sites_consultados: 'carmelofior.com.br', score };
  return {
    fabricante_grupo: 'Carmelo Fior',
    marca_no_site: match.marca_nome || 'Arielle',
    descricao_no_site: [match.titulo, match.formato, match.tipo].filter(Boolean).join(' · '),
    evidencia_url: match.produto_url,
    imagem_url: match.imagem_url || '',
    status: 'confirmado_site',
    sites_consultados: 'carmelofior.com.br',
    match_metodo: `carmelo_snapshot:${score}`,
    match_score: String(score),
  };
}

function tryIncopisosSlugDirect(row) {
  const nome = modeloParaBusca(row);
  for (const slug of incopisosSlugCandidates(row, nome)) {
    const url = incopisosProdutoUrl(slug);
    const page = curlGet(url);
    let ficha = parseIncopisosProdutoHtml(page);
    if (!ficha && (/^\d+$/.test(String(slug)) || /^hd-\d+$/i.test(String(slug)))) {
      const oembedUrl = `https://grupoincopisos.com.br/wp-json/oembed/1.0/embed?url=${encodeURIComponent(url)}`;
      ficha = parseIncopisosOembedJson(curlGet(oembedUrl), url);
    }
    if (!ficha) continue;
    return {
      fabricante_grupo: 'Grupo Incopisos',
      marca_no_site: ficha.marca_site,
      descricao_no_site: ficha.descricao_no_site,
      evidencia_url: url,
      imagem_url: ficha.imagem_url || '',
      status: 'confirmado_site',
      sites_consultados: 'grupoincopisos.com.br',
      match_metodo: `incopisos_slug:${slug}`,
    };
  }
  return null;
}

function tryIncopisos(row) {
  const direct = tryIncopisosSlugDirect(row);
  if (direct) return direct;

  if (!temNomeComercial(row)) {
    return { sites_consultados: 'grupoincopisos.com.br', reason: 'sem_nome' };
  }
  const nome = modeloParaBusca(row);
  const q = [row.formato, nome].filter(Boolean).join(' ').trim();
  const html = curlGet(`https://grupoincopisos.com.br/?s=${encodeURIComponent(q.split(/\s+/).slice(0, 4).join(' '))}`);
  if (!html) return { sites_consultados: 'grupoincopisos.com.br', tried: q };
  const linkRe = /href="(https:\/\/grupoincopisos\.com\.br\/produto\/[^"?#]+)/gi;
  let best = null;
  let m;
  const want = stripAccents(nome).toLowerCase().split(/\s+/).filter((w) => w.length > 3)[0];
  while ((m = linkRe.exec(html)) !== null) {
    const url = m[1].replace(/\/$/, '') + '/';
    if (want && !stripAccents(url).toLowerCase().includes(want.slice(0, 5))) continue;
    best = url;
    break;
  }
  if (!best) return { sites_consultados: 'grupoincopisos.com.br', tried: q };
  const page = curlGet(best);
  const title = (metaOg(page, 'og:title') || '').replace(/\s*\|.*$/i, '').trim();
  const img = metaOg(page, 'og:image') || '';
  return {
    fabricante_grupo: 'Grupo Incopisos',
    marca_no_site: 'Incopisos',
    descricao_no_site: title || nome,
    evidencia_url: best,
    imagem_url: img,
    status: 'confirmado_site',
    sites_consultados: 'grupoincopisos.com.br',
    match_metodo: 'incopisos_busca',
  };
}

function tryCerbras(row, snap) {
  if (!temNomeComercial(row)) {
    return { sites_consultados: 'novo.cerbras.com', reason: 'sem_nome' };
  }
  const nome = modeloParaBusca(row);
  const desc = `${row.formato} ${nome}`;
  const { match, score } = findInCerbrasSnapshot(snap, desc, {
    minScore: 30,
    requireFormato: true,
  });
  if (!match) return { sites_consultados: 'novo.cerbras.com', score };
  return {
    fabricante_grupo: 'Cerbras',
    marca_no_site: 'Cerbras',
    descricao_no_site: [match.titulo, match.formato].filter(Boolean).join(' · '),
    evidencia_url: match.produto_url,
    imagem_url: match.imagem_url || '',
    status: 'confirmado_site',
    sites_consultados: 'novo.cerbras.com',
    match_metodo: `cerbras_snapshot:${score}`,
    match_score: String(score),
  };
}

function cacheKey(row) {
  return `${(row.formato || '').toLowerCase()}|${nameSlug(modeloParaBusca(row))}`;
}

function applyHit(row, hit) {
  row.fabricante_grupo = hit.fabricante_grupo;
  row.marca_no_site = hit.marca_no_site;
  row.descricao_no_site = hit.descricao_no_site;
  row.evidencia_url = hit.evidencia_url;
  row.imagem_url = hit.imagem_url || '';
  row.imagens_json = hit.imagens_json || '';
  row.status = hit.status;
  row.sites_consultados = hit.sites_consultados;
  row.match_metodo = hit.match_metodo || '';
  row.match_score = hit.match_score || '';
  row.observacao = hit.observacao || '';
}

async function tryMatchersForRow(row, ctx, order) {
  const sites = [];
  for (const key of order) {
    let hit = null;
    if (key === 'rocha') {
      hit = tryRocha(row, ctx.rochaSlugs);
      sites.push('portalgruporocha.com.br');
    } else if (key === 'formigres') {
      hit = await tryFormigres(row, ctx.snapFg);
      sites.push('formigres.com.br');
    } else if (key === 'lume') {
      hit = tryLume(row);
      sites.push('lumeceramica.com.br');
    } else if (key === 'carmelo' && ctx.snapCf) {
      hit = tryCarmelo(row, ctx.snapCf);
      sites.push('carmelofior.com.br');
    } else if (key === 'cerbras') {
      hit = tryCerbras(row, ctx.snapCb);
      sites.push('novo.cerbras.com');
    } else if (key === 'incopisos') {
      hit = tryIncopisos(row);
      sites.push('grupoincopisos.com.br');
    }
    if (hit?.status === 'confirmado_site') {
      hit.sites_consultados = [...new Set([...sites, hit.sites_consultados].filter(Boolean))].join(';');
      return hit;
    }
  }
  return { sites_consultados: sites.join(';') };
}

async function loadMatchContext() {
  console.log('Carregando Formigres...');
  const snapFg = buildFormigresSnapshot(await fetchFormigresProdutos());
  let snapCf = null;
  try {
    console.log('Carregando Carmelo Fior (Arielle)...');
    snapCf = buildCarmeloSnapshot(await fetchCarmeloProdutos());
  } catch (e) {
    console.warn('Carmelo Fior indisponível:', e.message);
  }
  console.log('Carregando Cerbras (sitemap)...');
  const cbUrls = await fetchSitemapUrls();
  const snapCb = buildCerbrasSnapshot(cbUrls.map((u) => normalizeFromUrl(u)).filter(Boolean));
  console.log('Carregando índice Grupo Rocha...');
  const { slugs: rochaSlugs } = await loadRochaSlugIndex();
  console.log('Slugs Rocha:', rochaSlugs.size);
  return { snapFg, snapCf, snapCb, rochaSlugs };
}

async function resolveIndicacoesJoao() {
  if (!fs.existsSync(OUT_CSV)) {
    console.error('CSV não encontrado:', OUT_CSV);
    process.exit(1);
  }
  const rows = loadCsv(OUT_CSV);
  const targets = rows.filter((r) => r.status === 'indicacao_joao');
  console.log(`Reprocessar indicações João: ${targets.length} itens (ordem por fabricante sugerido)`);
  const ctx = await loadMatchContext();
  let ok = 0;
  for (const row of targets) {
    const order = siteTryOrderForRow(row);
    const hit = await tryMatchersForRow(row, ctx, order);
    if (hit.status === 'confirmado_site') {
      applyHit(row, hit);
      ok++;
      console.log(' OK', row.codigo, row.fabricante_grupo, (row.descricao_no_site || '').slice(0, 48));
    } else {
      row.sites_consultados = hit.sites_consultados || order.join(';');
      row.observacao = `indicacao João; buscou (${order.join('→')}) sem ficha`;
      console.log(' --', row.codigo, row.fabricante_grupo, order.join('→'));
    }
  }
  writeCsv(OUT_CSV, rows, CSV_FIELDS);
  console.log('\nNovos confirmado_site:', ok, 'ainda indicacao_joao:', targets.length - ok);
  console.log('Arquivo:', OUT_CSV);
}

async function main() {
  if (onlyIndicacao) {
    await resolveIndicacoesJoao();
    return;
  }

  const inputRows = loadCsv(IN_CSV);
  const fieldnames = CSV_FIELDS;

  const prior = fs.existsSync(OUT_CSV) ? loadCsv(OUT_CSV) : [];
  const priorByCode = new Map(prior.map((p) => [p.codigo, p]));

  const rows = inputRows.map((r) => {
    const prev = priorByCode.get(r.codigo);
    const reprocessFmt = onlyFmt && (r.formato || '').toLowerCase() === onlyFmt;
    const keep =
      prev &&
      !reprocessFmt &&
      ((prev.status === 'confirmado_site' && prev.evidencia_url) ||
        prev.status === 'nao_encontrado');
    const base = {
      codigo: r.codigo,
      formato: (r.formato || '').toLowerCase(),
      modelo: r.modelo,
      descricao_erp: r.descricao_original || r.descricao_erp || '',
      fabricante_grupo: '',
      marca_no_site: '',
      descricao_no_site: '',
      evidencia_url: '',
      imagem_url: '',
      imagens_json: '',
      status: 'pendente',
      sites_consultados: '',
      match_metodo: '',
      match_score: '',
      observacao: '',
      descricao_original: r.descricao_original,
    };
    if (keep) {
      for (const k of [
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
      ]) {
        if (prev[k]) base[k] = prev[k];
      }
    }
    return base;
  });

  const byFmt = new Map();
  for (const r of rows) {
    if (!r.formato) {
      const desc = r.descricao_erp || r.descricao_original || '';
      const rx = raioXProdutoDescricao(r.codigo, desc);
      if (rx.formato) r.formato = rx.formato.toLowerCase();
      else if (/\bX81\b/i.test(desc)) r.formato = '81x81';
    }
    if (!r.formato) continue;
    if (onlyFmt && r.formato !== onlyFmt) continue;
    if (!byFmt.has(r.formato)) byFmt.set(r.formato, []);
    byFmt.get(r.formato).push(r);
  }

  console.log('Formatos a processar:', byFmt.size, onlyFmt ? `(só ${onlyFmt})` : '');
  const ctx = await loadMatchContext();

  const patternCache = new Map();
  let ok = 0;
  let pend = 0;

  for (const [fmt, list] of [...byFmt.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`\n=== formato ${fmt} (${list.length} itens) ===`);
    for (const row of list) {
      const ck = cacheKey(row);
      if (patternCache.has(ck)) {
        applyHit(row, patternCache.get(ck));
        row.observacao = 'padrao_mesmo_formato_modelo';
        ok++;
        continue;
      }

      const order = siteTryOrderForRow(row);
      const hit = await tryMatchersForRow(row, ctx, order);
      row.sites_consultados = hit.sites_consultados || order.join(';');

      if (hit.status === 'confirmado_site') {
        applyHit(row, hit);
        patternCache.set(ck, hit);
        ok++;
        console.log(' OK', row.codigo, hit.fabricante_grupo, hit.descricao_no_site?.slice(0, 50));
      } else {
        row.status = 'nao_encontrado';
        row.observacao = temNomeComercial(row)
          ? `sem_ficha;ordem:${order.join('→')}`
          : 'sem_nome_comercial_soh_codigo_interno;consultado:' + order.join(',');
        pend++;
        console.log(' --', row.codigo, row.modelo);
      }
    }
    writeCsv(OUT_CSV, rows, fieldnames);
  }

  writeCsv(OUT_CSV, rows, fieldnames);
  console.log('\nTotal confirmado_site:', ok, 'nao_encontrado/pendente:', pend);
  console.log('Arquivo:', OUT_CSV);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
