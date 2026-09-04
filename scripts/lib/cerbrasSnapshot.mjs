/**
 * Snapshot + match local Cerbras (catálogo B) — sitemap WordPress.
 */
import {
  CERBRAS_BASE,
  fetchOgImage,
  scoreMatch,
} from './cerbrasCatalog.mjs';
import { normFmt, parseDesc, stripAccents } from './formigresCatalog.mjs';

const UA = 'P38-ERP-catalogo-local/1.0';
const SITEMAP = `${CERBRAS_BASE}/produtos-sitemap.xml`;

export const FABRICANTE = {
  slug: 'cerbras',
  nome: 'Cerbras',
  site: CERBRAS_BASE,
  categoria: 'revestimentos',
};

function tokenizeTitulo(titulo) {
  return stripAccents(titulo)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length >= 2);
}

function tituloFromSlug(slug) {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtFromSlug(slug) {
  const m = String(slug || '').match(/(\d{2,3})[xX](\d{2,3})/);
  if (m) return `${m[1]}x${m[2]}`.toLowerCase();
  if (/deck|hd|46|5101|9001/i.test(slug)) return '46x46';
  return normFmt(slug) || '';
}

function acabFromSlug(slug) {
  if (/deck/i.test(slug)) return 'DECK';
  if (/brilh|alto-brilho|polido/i.test(slug)) return 'BRILHANTE';
  if (/acet|mate|granilh/i.test(slug)) return 'ACETINADO';
  return '';
}

export function normalizeFromUrl(url, imagemUrl = '') {
  const slug = url.replace(/\/$/, '').split('/').pop() || '';
  if (!slug || slug === 'produtos') return null;

  return {
    id: slug,
    slug,
    titulo: tituloFromSlug(slug),
    formato: fmtFromSlug(slug),
    acabamento: acabFromSlug(slug),
    imagem_url: imagemUrl || '',
    produto_url: url.endsWith('/') ? url : `${url}/`,
    busca_tokens: tokenizeTitulo(tituloFromSlug(slug)),
  };
}

export async function fetchSitemapUrls() {
  const res = await fetch(SITEMAP, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Cerbras sitemap ${res.status}`);
  const xml = await res.text();
  const urls = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const url = m[1].trim();
    if (!url.includes('/produtos/') || url.endsWith('/produtos/')) continue;
    urls.push(url.endsWith('/') ? url : `${url}/`);
  }
  return [...new Set(urls)];
}

async function mapPool(items, fn, concurrency = 8) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return out;
}

/** Busca catálogo via sitemap; imagens opcionais (og:image por produto). */
export async function fetchAllProdutos({ withImages = false, onProgress } = {}) {
  const urls = await fetchSitemapUrls();
  if (!withImages) {
    return urls.map((url) => normalizeFromUrl(url)).filter(Boolean);
  }

  let done = 0;
  return mapPool(urls, async (url) => {
    const imagem = await fetchOgImage(url);
    done += 1;
    if (onProgress && done % 25 === 0) onProgress(done, urls.length);
    return normalizeFromUrl(url, imagem);
  }, 8).then((rows) => rows.filter(Boolean));
}

export function buildSnapshot(produtosRaw) {
  const produtos = produtosRaw.filter(Boolean);
  const por_formato = {};
  for (const p of produtos) {
    const fmt = p.formato || '—';
    if (!por_formato[fmt]) por_formato[fmt] = [];
    por_formato[fmt].push(p.id);
  }

  return {
    fabricante: FABRICANTE.slug,
    exportedAt: new Date().toISOString(),
    source: SITEMAP,
    count: produtos.length,
    produtos,
    por_formato,
  };
}

export function loadSnapshotFromFile(snapshot) {
  if (!snapshot?.produtos?.length) return null;
  return snapshot;
}

export function findInSnapshot(snapshot, desc, { minScore = 28, requireFormato = true } = {}) {
  const parsed = parseDesc(desc);
  const produtos = snapshot.produtos || [];

  const pool = requireFormato && parsed.formato
    ? produtos.filter((p) => p.formato === parsed.formato)
    : produtos;

  let best = null;
  let bestScore = -999;
  for (const p of pool) {
    const sc = scoreMatch(
      { ...p, url: p.produto_url, imagem: p.imagem_url },
      parsed,
    );
    if (sc > bestScore) {
      bestScore = sc;
      best = p;
    }
  }

  if (!best || bestScore < minScore) {
    return { parsed, match: null, score: bestScore, reason: 'sem_match', pool: pool.length };
  }

  return { parsed, match: best, score: bestScore, reason: null, pool: pool.length };
}
