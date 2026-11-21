#!/usr/bin/env node
/**
 * Varredura oficial PagLeve (228) — URL + contagem de imagens no domínio do fabricante.
 * Saída JSON em /opt/cursor/artifacts (não altera CSV nem preços).
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
} from '../lib/cerbrasSnapshot.mjs';
import {
  extractImagensFromDetalhe,
  fetchProdutoDetalhe,
  stripAccents,
} from '../lib/formigresCatalog.mjs';
import { extractImagensFromProduto } from '../lib/carmeloFiorCatalog.mjs';
import { raioXProdutoDescricao } from '../lib/raioXProdutoDescricao.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const CSV = path.join(ROOT, 'files/pagleve/raio-x-pagleve-site-verificado.csv');
const CLS = path.join(ROOT, 'files/pagleve/classificacao/pagleve-estoque-2026-11-21.json');
const OUT =
  process.env.PAGLEVE_SWEEP_OUT ||
  '/opt/cursor/artifacts/pagleve-official-sweep-2026-11-21.json';
const ROCHA_BASE = 'https://www.portalgruporocha.com.br';
const LUME_BASE = 'https://lumeceramica.com.br';
const UA = 'P38-PagLeve-official-sweep/2.0';

const OFFICIAL = new Set([
  'formigres.com.br',
  'portalgruporocha.com.br',
  'carmelofior.com.br',
  'lumeceramica.com.br',
  'grupoincopisos.com.br',
  'novo.cerbras.com',
  'cedasa.com.br',
]);

const URL_OVERRIDES = {
  '35486': 'https://www.portalgruporocha.com.br/produtos/loft-beg-ext',
  '35487': 'https://www.portalgruporocha.com.br/produtos/loft-cinza-ext',
};

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').trim().split('\n');
  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = parseLine(line);
    const o = {};
    headers.forEach((h, i) => {
      o[h] = cols[i] ?? '';
    });
    return o;
  });
}

function parseLine(line) {
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

function curl(url) {
  const k = url.includes('lumeceramica') ? '-k ' : '';
  try {
    return execSync(`curl ${k}-sL --max-time 30 -A ${JSON.stringify(UA)} ${JSON.stringify(url)}`, {
      encoding: 'utf8',
      maxBuffer: 12 * 1024 * 1024,
    });
  } catch {
    return '';
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isOfficial(url) {
  if (!url) return false;
  const h = hostOf(url);
  return [...OFFICIAL].some((d) => h === d.replace(/^www\./, '') || h === d);
}

function canonicalProductUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    u.search = '';
    u.hash = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return String(url).split('?')[0].split('#')[0];
  }
}

function metaOg(html, prop) {
  const re = new RegExp(`<meta property="${prop}" content="([^"]+)"`, 'i');
  return html.match(re)?.[1] || '';
}

function pageIs404(html) {
  if (!html || html.length < 300) return true;
  if (/"statusCode":\s*404/.test(html)) return true;
  if (/Página não encontrada|Page not found|404 Not Found/i.test(html)) return true;
  const title = metaOg(html, 'og:title');
  if (title && /not found/i.test(title)) return true;
  return false;
}

function rochaSlugFromUrl(url) {
  const m = String(url).match(/portalgruporocha\.com\.br\/produtos\/([a-z0-9-]+)/i);
  return m?.[1]?.toLowerCase() || '';
}

/** Galeria Rocha: imagens do produto (api.storage), sem duplicar miniaturas nem ícones do layout. */
function extractRochaImages(html, url) {
  if (pageIs404(html)) {
    return { count: 0, urls: [], method: '404', motivo: 'pagina_404' };
  }
  const slug = rochaSlugFromUrl(url);
  const title = metaOg(html, 'og:title').replace(/\s*\|\s*Grupo Rocha\s*$/i, '').trim();
  const urls = new Set();

  if (title) {
    const esc = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const altRe = new RegExp(`alt="${esc} - Imagem \\d+"`, 'gi');
    if (altRe.test(html)) {
      const imgRe = new RegExp(
        `https://api\\.portalgruporocha\\.com\\.br/storage/images/[^"'\\s]+\\.(webp|jpg|jpeg|png)`,
        'gi',
      );
      const section = html.slice(
        Math.max(0, html.search(altRe)),
        html.search(altRe) + 120_000,
      );
      let m;
      while ((m = imgRe.exec(section))) {
        const u = m[0].split('?')[0];
        if (!/\.svg$/i.test(u)) urls.add(u);
      }
    }
  }

  if (!urls.size && slug) {
    const slugParts = slug.split('-').filter((p) => p.length >= 3);
    const imgRe =
      /https:\/\/api\.portalgruporocha\.com\.br\/storage\/images\/([^"'\\\s]+)\.(webp|jpg|jpeg|png)/gi;
    let m;
    while ((m = imgRe.exec(html))) {
      const fname = m[1].toLowerCase();
      if (/\.svg$/i.test(fname)) continue;
      const hitsSlug =
        fname.includes(slug) ||
        slugParts.filter((p) => p.length >= 4).every((p) => {
          const token = p === 'beg' ? 'bege' : p;
          return fname.includes(token);
        });
      if (!hitsSlug) continue;
      if (slug.startsWith('loft') && !/loft/.test(fname)) continue;
      urls.add(m[0].split('?')[0]);
    }
  }

  const list = [...urls];
  const og = metaOg(html, 'og:image');
  if (!list.length && og && !og.includes('_og/')) {
    return {
      count: 1,
      urls: [og],
      method: 'rocha_og_only',
      motivo: '',
    };
  }
  return {
    count: list.length,
    urls: list,
    method: list.length ? 'rocha_storage_galeria' : 'rocha_sem_imagem',
    motivo: list.length ? '' : 'galeria_vazia_no_html',
  };
}

function extractLumeImages(html) {
  if (pageIs404(html)) return { count: 0, urls: [], method: '404', motivo: 'pagina_404' };
  const urls = new Set();
  const re =
    /https:\/\/lumeceramica\.com\.br\/wp-content\/uploads\/[^"'\s]+\.(jpg|jpeg|png|webp)/gi;
  let m;
  while ((m = re.exec(html))) {
    const u = m[0].split('?')[0];
    if (!/logo|icon|favicon|placeholder/i.test(u)) urls.add(u);
  }
  const list = [...urls];
  return {
    count: list.length || (metaOg(html, 'og:image') ? 1 : 0),
    urls: list.length ? list : metaOg(html, 'og:image') ? [metaOg(html, 'og:image')] : [],
    method: list.length ? 'lume_uploads' : 'lume_og_only',
    motivo: list.length ? '' : 'sem_uploads_wp',
  };
}

function extractIncopisosImages(html) {
  if (pageIs404(html)) return { count: 0, urls: [], method: '404', motivo: 'pagina_404' };
  const urls = new Set();
  const re = /https:\/\/grupoincopisos\.com\.br\/wp-content\/uploads\/[^"'\s]+\.(jpg|jpeg|png|webp)/gi;
  let m;
  while ((m = re.exec(html))) {
    const u = m[0].split('?')[0];
    if (!/logo|icon|cookie|banner/i.test(u)) urls.add(u);
  }
  const list = [...urls];
  return {
    count: list.length || (metaOg(html, 'og:image') ? 1 : 0),
    urls: list.length ? list : metaOg(html, 'og:image') ? [metaOg(html, 'og:image')] : [],
    method: list.length ? 'incopisos_uploads' : 'incopisos_og_only',
    motivo: list.length ? '' : 'sem_uploads_wp',
  };
}

async function resolveOfficialImages(url, ctx) {
  const canonical = canonicalProductUrl(url);
  const html = curl(canonical);
  const host = hostOf(canonical);

  if (pageIs404(html)) {
    return { count: 0, urls: [], method: '404', motivo: 'pagina_404_ou_vazia' };
  }

  if (host.includes('formigres')) {
    const id = canonical.match(/produto\/(\d+)/i)?.[1];
    if (id) {
      try {
        const det = await fetchProdutoDetalhe(id);
        const imgs = extractImagensFromDetalhe(det);
        return {
          count: imgs.length,
          urls: imgs.map((i) => i.url),
          method: 'formigres_api_detalhe',
          motivo: imgs.length ? '' : 'formigres_api_sem_imagens',
        };
      } catch (e) {
        return { count: 0, urls: [], method: 'formigres_api_erro', motivo: e.message };
      }
    }
  }

  if (host.includes('portalgruporocha')) {
    return extractRochaImages(html, canonical);
  }

  if (host.includes('carmelofior')) {
    const slug = canonical.match(/produto\/([^/]+)/i)?.[1]?.toLowerCase();
    const prod = slug ? ctx.carmeloBySlug.get(slug) : null;
    if (prod) {
      const imgs = extractImagensFromProduto(prod);
      return {
        count: imgs.length,
        urls: imgs.map((i) => i.url),
        method: 'carmelo_api_snapshot',
        motivo: imgs.length ? '' : 'carmelo_api_sem_imagens',
      };
    }
    const urls = new Set();
    const re =
      /https:\/\/www\.carmelofior\.com\.br\/public\/images\/product\/[^"'\s]+\.(jpg|jpeg|png|webp)/gi;
    let m;
    while ((m = re.exec(html))) urls.add(m[0].split('?')[0]);
    const list = [...urls];
    return {
      count: list.length,
      urls: list,
      method: 'carmelo_html_product',
      motivo: list.length ? '' : 'carmelo_sem_imagem_html',
    };
  }

  if (host.includes('lumeceramica')) return extractLumeImages(html);
  if (host.includes('incopisos')) return extractIncopisosImages(html);

  const generic = new Set();
  const re2 = /https:\/\/[^"'\s]+\/uploads\/[^"'\s]+\.(jpg|jpeg|png|webp)/gi;
  let m2;
  while ((m2 = re2.exec(html))) generic.add(m2[0].split('?')[0]);
  const list = [...generic];
  return {
    count: list.length || (metaOg(html, 'og:image') ? 1 : 0),
    urls: list,
    method: 'generic_uploads',
    motivo: list.length ? '' : 'sem_imagens_genericas',
  };
}

function nameSlug(text) {
  return stripAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/-+/g, '-');
}

function modeloParaBusca(row) {
  const desc = row.descricao_erp || row.descricao_original || '';
  const rx = raioXProdutoDescricao(row.codigo, desc);
  let modelo = rx.modelo || row.modelo || '';
  modelo = modelo
    .replace(/\([^)]*$/g, ' ')
    .replace(/\(\d+[,.]?\d*\)?/g, ' ')
    .replace(/\b0X\d+\b/gi, ' ')
    .replace(/\b(PR\d{3,}|R\d{3,})\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!modelo || modelo.length < 4) {
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

function rochaSlugFromSiahDesc(desc) {
  const m = String(desc || '').match(/\b(PR|R)(\d{4,})\b/i);
  if (!m) return '';
  let digits = m[2];
  if (digits.length >= 5 && digits.endsWith('1')) digits = digits.slice(0, -1);
  const core = digits.length > 4 ? digits.slice(0, 4) : digits;
  return `${m[1].toLowerCase()}${core}`;
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
  const desc = stripAccents(row.descricao_erp || '').toLowerCase();
  if (desc.includes('loft bege')) out.push('loft-beg-ext', 'loft-bege-ext');
  if (desc.includes('loft cinza')) out.push('loft-cinza-ext');
  if (/^metrop/.test(stripAccents(modelo).toLowerCase())) out.push('metropole');
  return [...new Set(out)];
}

function siteTryOrderForRow(row) {
  const g = stripAccents(row.fabricante_grupo || '').toLowerCase();
  const desc = stripAccents(row.descricao_erp || '').toLowerCase();
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
  if (g.includes('rocha') || desc.includes('rochamaxx') || desc.includes('rochaprime')) {
    if (
      fmt === '90x90' &&
      /plus|albury|narbona|sidney|vinci|amon|dream|fortunata|cronos|dacito|pissis|solaria|alaska|verne|panis|lelis|varena/i.test(
        desc,
      )
    ) {
      return ['carmelo', 'formigres', 'lume', 'rocha', 'cerbras'];
    }
    return ['rocha', 'formigres', 'lume', 'carmelo', 'cerbras'];
  }
  if (g.includes('cecafi') || fmt === '38x75' || fmt === '57x57') {
    return ['formigres', 'carmelo', 'cerbras', 'lume', 'rocha'];
  }
  if (fmt === '58x58') return ['cerbras', 'formigres', 'incopisos', 'carmelo', 'lume', 'rocha'];
  if (desc.includes('rochaprime') || desc.includes('rochamaxx')) {
    if (fmt === '61x116' || fmt === '82x82' || fmt === '37x59' || fmt === '76x76') {
      return ['rocha', 'formigres', 'lume', 'carmelo', 'cerbras'];
    }
    return ['formigres', 'carmelo', 'lume', 'rocha', 'cerbras'];
  }
  return ['formigres', 'rocha', 'lume', 'carmelo', 'cerbras', 'incopisos'];
}

async function loadRochaSlugIndex() {
  const html = curl(`${ROCHA_BASE}/produtos`);
  const slugs = new Set();
  const re = /\/produtos\/([a-z0-9-]+)/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[1].length >= 3) slugs.add(m[1].toLowerCase());
  }
  return { slugs };
}

function tryRocha(row, rochaSlugs) {
  const candidates = rochaSlugCandidates(row);
  const codeSlug = rochaSlugFromSiahDesc(row.descricao_erp);
  if (codeSlug) candidates.unshift(codeSlug);
  if (URL_OVERRIDES[row.codigo]) candidates.unshift(URL_OVERRIDES[row.codigo].split('/').pop());

  const desc = stripAccents(row.descricao_erp || '').toLowerCase();
  for (let c of [...new Set(candidates)]) {
    if (/^(pr|r)\d+$/i.test(c) && !rochaSlugs.has(c)) continue;
    const url = `${ROCHA_BASE}/produtos/${c}`;
    const html = curl(url);
    if (pageIs404(html)) continue;
    const title = metaOg(html, 'og:title').replace(/\s*\|\s*Grupo Rocha\s*$/i, '').trim();
    if (!title) continue;
    const imgs = extractRochaImages(html, url);
    return {
      fabricante_grupo: 'Grupo Rocha',
      marca_no_site: desc.includes('rochamaxx') ? 'Rochamaxx' : 'Rochaforte / portal',
      descricao_no_site: title,
      evidencia_url: url,
      status: 'confirmado_site',
      match_metodo: `rocha_slug:${c}`,
      imagens_count_hint: imgs.count,
    };
  }
  return null;
}

async function tryFormigres(row, snap) {
  if (!temNomeComercial(row)) return null;
  const desc = `${row.formato} ${modeloParaBusca(row)}`;
  const { match, score } = findInFormigresSnapshot(snap, desc, { minScore: 45, requireFormato: true });
  if (!match) return null;
  let imagens_json = '';
  let imgCount = 0;
  try {
    const det = await fetchProdutoDetalhe(match.id);
    const imgs = extractImagensFromDetalhe(det);
    imgCount = imgs.length;
    if (imgs.length) imagens_json = JSON.stringify(imgs.map((i) => i.url));
  } catch {
    /* ignore */
  }
  return {
    fabricante_grupo: 'Grupo Formigres',
    marca_no_site: match.marca_nome || 'Formigres',
    descricao_no_site: [match.titulo, match.formato, match.tipo].filter(Boolean).join(' · '),
    evidencia_url: match.produto_url,
    imagens_json,
    imagens_count_hint: imgCount,
    status: 'confirmado_site',
    match_metodo: `formigres_snapshot:${score}`,
    match_score: String(score),
  };
}

function tryCarmelo(row, snap) {
  if (!temNomeComercial(row)) return null;
  const desc = `${row.formato} ${modeloParaBusca(row)}`;
  const { match, score } = findInFormigresSnapshot(snap, desc, { minScore: 32, requireFormato: true });
  if (!match) return null;
  const imgs = extractImagensFromProduto(match);
  return {
    fabricante_grupo: 'Carmelo Fior',
    marca_no_site: match.marca_nome || 'Arielle',
    descricao_no_site: [match.titulo, match.formato, match.tipo].filter(Boolean).join(' · '),
    evidencia_url: match.produto_url,
    imagem_url: match.imagem_url || '',
    imagens_count_hint: imgs.length,
    status: 'confirmado_site',
    match_metodo: `carmelo_snapshot:${score}`,
    match_score: String(score),
  };
}

function tryLume(row) {
  if (!temNomeComercial(row)) return null;
  const nome = modeloParaBusca(row);
  const q = [row.formato, nome].filter(Boolean).join(' ').trim();
  const html = curl(`${LUME_BASE}/?s=${encodeURIComponent(q.split(/\s+/).slice(0, 5).join(' '))}`);
  if (!html || /0\s+resultados|Nenhum resultado/i.test(html)) return null;
  const want = stripAccents(nome).toLowerCase().split(/\s+/).filter((w) => w.length > 3)[0];
  const linkRe = /href="(https:\/\/lumeceramica\.com\.br\/portfolio-item\/[^"]+)"/gi;
  let best = null;
  let m;
  while ((m = linkRe.exec(html))) {
    if (want && !stripAccents(m[1]).toLowerCase().includes(want.slice(0, Math.min(5, want.length)))) continue;
    best = m[1];
    break;
  }
  if (!best) return null;
  return {
    fabricante_grupo: 'Lume Cerâmica',
    marca_no_site: 'Lume',
    descricao_no_site: nome,
    evidencia_url: best,
    status: 'confirmado_site',
    match_metodo: `lume_busca:${q}`,
  };
}

function tryIncopisos(row) {
  if (!temNomeComercial(row)) return null;
  const nome = modeloParaBusca(row);
  const q = [row.formato, nome].filter(Boolean).join(' ').trim();
  const html = curl(`https://grupoincopisos.com.br/?s=${encodeURIComponent(q.split(/\s+/).slice(0, 4).join(' '))}`);
  if (!html) return null;
  const linkRe = /href="(https:\/\/grupoincopisos\.com\.br\/produto\/[^"?#]+)/gi;
  let best = null;
  let m;
  const want = stripAccents(nome).toLowerCase().split(/\s+/).filter((w) => w.length > 3)[0];
  while ((m = linkRe.exec(html))) {
    const url = m[1].replace(/\/$/, '') + '/';
    if (want && !stripAccents(url).toLowerCase().includes(want.slice(0, 5))) continue;
    best = url;
    break;
  }
  if (!best) return null;
  return {
    fabricante_grupo: 'Grupo Incopisos',
    marca_no_site: 'Incopisos',
    descricao_no_site: nome,
    evidencia_url: best,
    status: 'confirmado_site',
    match_metodo: 'incopisos_busca',
  };
}

async function tryMatchersForRow(row, ctx) {
  const order = siteTryOrderForRow(row);
  for (const key of order) {
    let hit = null;
    if (key === 'rocha') hit = tryRocha(row, ctx.rochaSlugs);
    else if (key === 'formigres') hit = await tryFormigres(row, ctx.snapFg);
    else if (key === 'lume') hit = tryLume(row);
    else if (key === 'carmelo' && ctx.snapCf) hit = tryCarmelo(row, ctx.snapCf);
    else if (key === 'incopisos') hit = tryIncopisos(row);
    if (hit?.status === 'confirmado_site') return hit;
  }
  return null;
}

function buildCarmeloSlugIndex(snap) {
  const map = new Map();
  for (const p of snap?.produtos || []) {
    const slug = p.slug || p.produto_url?.match(/produto\/([^/]+)/i)?.[1];
    if (slug) map.set(String(slug).toLowerCase(), p);
  }
  return map;
}

async function main() {
  const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
  const cls = JSON.parse(fs.readFileSync(CLS, 'utf8'));
  const clsBy = new Map(cls.itens.map((i) => [String(i.codigo_tintao), i]));

  console.log('Loading catalogs...');
  const snapFg = buildFormigresSnapshot(await fetchFormigresProdutos());
  let snapCf = null;
  try {
    snapCf = buildCarmeloSnapshot(await fetchCarmeloProdutos());
  } catch (e) {
    console.warn('Carmelo:', e.message);
  }
  const cbUrls = await fetchSitemapUrls();
  buildCerbrasSnapshot(cbUrls.map((u) => normalizeFromUrl(u)).filter(Boolean));
  const { slugs: rochaSlugs } = await loadRochaSlugIndex();
  const carmeloBySlug = buildCarmeloSlugIndex(snapCf);
  const ctx = { snapFg, snapCf, rochaSlugs, carmeloBySlug };

  const report = [];
  let n = 0;
  for (const row of rows) {
    n++;
    const code = row.codigo;
    const clsRow = clsBy.get(code) || {};
    let url = URL_OVERRIDES[code] || row.evidencia_url || clsRow.produto_url || '';
    url = canonicalProductUrl(url);
    let commercial = row.descricao_no_site || clsRow.catalogo_nome_modelo || modeloParaBusca(row);
    let fabricante = row.fabricante_grupo || clsRow.fabricante_grupo || '';
    let matchMetodo = row.match_metodo || '';

    if (url && pageIs404(curl(url))) {
      url = '';
    }

    if (!url || !isOfficial(url) || row.status === 'nao_encontrado') {
      const hit = await tryMatchersForRow(row, ctx);
      if (hit) {
        url = canonicalProductUrl(URL_OVERRIDES[code] || hit.evidencia_url);
        commercial = hit.descricao_no_site || commercial;
        fabricante = hit.fabricante_grupo || fabricante;
        matchMetodo = hit.match_metodo || matchMetodo;
      }
    }

    if (URL_OVERRIDES[code]) {
      url = canonicalProductUrl(URL_OVERRIDES[code]);
    }

    let imgCount = 0;
    let imgUrls = [];
    let imgSource = '';
    let semFotoMotivo = '';

    if (url && isOfficial(url)) {
      const live = await resolveOfficialImages(url, ctx);
      imgCount = live.count;
      imgUrls = live.urls || [];
      imgSource = live.method;
      semFotoMotivo = live.motivo || (imgCount ? '' : 'extracao_zero');
    } else {
      semFotoMotivo = url ? 'url_nao_oficial' : 'sem_url_oficial';
    }

    report.push({
      codigo: code,
      formato: row.formato,
      nome_comercial: commercial,
      fabricante: fabricante || '—',
      url_oficial: url || '',
      url_e_oficial: isOfficial(url),
      imagens_oficial_count: imgCount,
      imagens_urls: imgUrls,
      imagens_fonte: imgSource,
      sem_foto_motivo: semFotoMotivo,
      match_metodo: matchMetodo,
      csv_status_anterior: row.status,
    });
    if (n % 25 === 0) console.log(`... ${n}/${rows.length}`);
  }

  const summary = {
    geradoEm: new Date().toISOString(),
    versao_script: '2.0',
    total: report.length,
    com_foto: report.filter((r) => r.url_e_oficial && r.imagens_oficial_count > 0).length,
    sem_foto: report.filter((r) => !r.imagens_oficial_count || !r.url_e_oficial).length,
    sem_url_oficial: report.filter((r) => !r.url_e_oficial).length,
    itens: report,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));

  const prevPath = '/opt/cursor/artifacts/pagleve-official-sweep-pre-v2-stats.json';
  if (fs.existsSync('/opt/cursor/artifacts/pagleve-official-sweep-2026-11-21.json')) {
    try {
      const prev = JSON.parse(fs.readFileSync('/opt/cursor/artifacts/pagleve-official-sweep-2026-11-21.json', 'utf8'));
      const prevWith = (prev.itens || prev).filter?.((r) => r.imagens_oficial_count > 0)?.length;
      fs.writeFileSync(prevPath, JSON.stringify({ prev_com_foto: prevWith }, null, 2));
    } catch {
      /* ignore */
    }
  }

  console.log('Done.', {
    com_foto: summary.com_foto,
    sem_foto: summary.sem_foto,
    sem_url: summary.sem_url_oficial,
    out: OUT,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});