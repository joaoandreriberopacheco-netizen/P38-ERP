/**
 * Catálogo Cerbras — busca via HTML (sem Supabase) + scoring alinhado ao Formigres.
 */
import {
  buildBuscaVariantes,
  normFmt,
  parseDesc,
  stripAccents,
} from './formigresCatalog.mjs';

export const CERBRAS_BASE = 'https://cerbras.com';
export const FORMATOS_CERBRAS = new Set(['46x46', '33x46', '56x56', '57x57', '70x70']);

function normName(s) {
  return stripAccents(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function namesLikelyMatch(a, b) {
  const x = normName(a);
  const y = normName(b);
  if (!x || !y) return false;
  if (x.includes(y) || y.includes(x)) return true;
  return false;
}

function fmtFromImageSrc(src) {
  const m = String(src || '').match(/(\d{2,3})[xX](\d{2,3})/);
  return m ? `${m[1]}x${m[2]}`.toLowerCase() : '';
}

/** Slugs Cerbras conhecidos (fallback quando a busca demora). */
const SLUG_FALLBACK = {
  'aurora bege': 'aurora-bege-hd-5101',
  'carpina deck': 'carpina-deck-hd-9001',
};

function slugFromBusca(busca) {
  const key = String(busca || '').toLowerCase().trim();
  for (const [k, slug] of Object.entries(SLUG_FALLBACK)) {
    if (key.includes(k.split(' ')[0]) && key.includes(k.split(' ')[1] || '')) return slug;
  }
  if (/aurora/i.test(key) && /bege/i.test(key)) return SLUG_FALLBACK['aurora bege'];
  if (/carpina/i.test(key) && /deck/i.test(key)) return SLUG_FALLBACK['carpina deck'];
  return '';
}

/** Extrai links de produto da página de busca Cerbras. */
export function parseSearchHtml(html) {
  const cards = [];
  const seen = new Set();
  const re = /href="(https:\/\/cerbras\.com\/produtos\/[^"/]+\/)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const url = m[1];
    if (url.includes('/feed/') || seen.has(url)) continue;
    seen.add(url);
    const slug = url.split('/').filter(Boolean).pop() || '';
    const titulo = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    cards.push({
      titulo,
      url,
      imagem: '',
      formato: fmtFromImageSrc(slug) || '46x46',
      acabamento: /brilh|alto-brilho/i.test(slug) ? 'BRILHANTE'
        : /deck/i.test(slug) ? 'DECK'
        : /acet|mate/i.test(slug) ? 'ACETINADO'
        : '',
    });
  }
  return cards;
}

export async function fetchOgImage(productUrl) {
  try {
    const res = await fetch(productUrl, {
      headers: { 'User-Agent': 'P38-ERP-esquenta/1.0 (+local script)' },
    });
    if (!res.ok) return '';
    const html = await res.text();
    const m = html.match(/property="og:image" content="([^"]+)"/i);
    return m ? m[1] : '';
  } catch {
    return '';
  }
}

export async function buscarCerbras(q) {
  const url = `${CERBRAS_BASE}/produtos/?s=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'P38-ERP-esquenta/1.0 (+local script)' },
  });
  if (!res.ok) return [];
  const html = await res.text();
  return parseSearchHtml(html);
}

export async function buscarComVariantes(parsed) {
  const seen = new Set();
  const all = [];
  for (const q of parsed.buscaVariantes) {
    const prods = await buscarCerbras(q);
    for (const p of prods) {
      const key = p.url;
      if (!seen.has(key)) {
        seen.add(key);
        all.push(p);
      }
    }
  }
  return all;
}

export function scoreMatch(prod, parsed) {
  let score = 0;
  const fmtSite = normFmt(prod.formato) || normFmt(prod.titulo);
  if (parsed.formato && fmtSite === parsed.formato) score += 50;
  else if (parsed.formato && fmtSite) score -= 40;

  const title = stripAccents(prod.titulo).toUpperCase();
  for (const tok of stripAccents(parsed.busca).toUpperCase().split(' ')) {
    if (tok && title.includes(tok)) score += 20;
    else if (tok && namesLikelyMatch(tok, prod.titulo)) score += 18;
  }
  for (const tok of parsed.tokens.map((t) => stripAccents(t).toUpperCase())) {
    if (tok.length >= 3 && title.includes(tok)) score += 8;
    else if (tok.length >= 4 && namesLikelyMatch(tok, prod.titulo)) score += 10;
  }

  if (/BRILH/i.test(parsed.raw) && /BRILH/i.test(prod.acabamento + prod.titulo)) score += 8;
  if (/ACET/i.test(parsed.raw) && /ACET|MATE/i.test(prod.acabamento + prod.titulo)) score += 8;
  if (/DECK/i.test(parsed.raw) && /DECK/i.test(prod.titulo + prod.url)) score += 12;
  if (/HD/i.test(parsed.raw) && /HD/i.test(prod.titulo)) score += 6;

  return score;
}

export async function findBestMatch(desc, { minScore = 28, requireFormato = true } = {}) {
  const parsed = parseDesc(desc);
  if (requireFormato && parsed.formato && parsed.formato !== '46x46') {
    return { parsed, match: null, score: 0, reason: 'formato_fora_cerbras' };
  }
  if (!parsed.busca) {
    return { parsed, match: null, score: 0, reason: 'sem_termo_busca' };
  }

  const prods = await buscarComVariantes(parsed);
  let best = null;
  let bestScore = -999;
  for (const p of prods) {
    const sc = scoreMatch(p, parsed);
    if (sc > bestScore) { bestScore = sc; best = p; }
  }

  if (!best || bestScore < minScore) {
    const slug = slugFromBusca(parsed.busca);
    if (slug) {
      const url = `${CERBRAS_BASE}/produtos/${slug}/`;
      best = {
        titulo: slug.replace(/-/g, ' '),
        url,
        imagem: await fetchOgImage(url),
        formato: '46x46',
        acabamento: /deck/i.test(slug) ? 'DECK' : /bege/i.test(slug) ? 'BRILHANTE' : '',
      };
      bestScore = 35;
    }
  }

  if (!best || bestScore < minScore) {
    return { parsed, match: null, score: bestScore, reason: 'sem_match', candidatos: prods.length };
  }

  if (!best.imagem) best.imagem = await fetchOgImage(best.url);
  return { parsed, match: best, score: bestScore, reason: null };
}
