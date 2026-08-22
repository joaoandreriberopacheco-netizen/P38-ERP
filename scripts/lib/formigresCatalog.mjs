/**
 * Catálogo Formigres — busca, match e extração de imagens (compartilhado entre scripts).
 */
export const FORMIGRES_BASE = 'https://www.formigres.com.br';

export const FORMATOS_SITE = new Set([
  '20x120', '20x60', '32x45', '32x66', '33x59', '34x60', '40x81', '43x88',
  '45x45', '50x50', '60x120', '60x60', '61x61', '66x66', '81x81', '88x88',
]);

export function normFmt(s) {
  const m = String(s || '').match(/(\d{2,3})\s*[xX]\s*(\d{2,3})/);
  return m ? `${m[1]}x${m[2]}`.toLowerCase() : '';
}

export function stripAccents(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function generateAccentVariants(word) {
  const w = stripAccents(word).toUpperCase();
  const map = { A: ['Á', 'Ã'], E: ['Ê', 'É'], I: ['Í'], O: ['Ó', 'Ô'], U: ['Ú'] };
  const out = new Set([w]);
  for (let i = 0; i < w.length; i++) {
    const c = w[i];
    if (!map[c]) continue;
    for (const acc of map[c]) out.add(w.slice(0, i) + acc + w.slice(i + 1));
  }
  return [...out];
}

export function spellingAliases(text) {
  const t = String(text || '');
  const out = [];
  if (/CIMENTOCOLOR/i.test(t)) out.push('CIMENTCOLOR', 'CIMENTO');
  if (/CALENDULA/i.test(t)) out.push('CALÊNDULA');
  if (/TRAFEGO/i.test(t)) out.push('TRÁFEGO');
  if (/CORUMBA/i.test(t)) out.push('CORUMBÁ', 'CORU');
  if (/TIMBO/i.test(t)) out.push('TIMBÓ', 'TIM');
  if (/AVELA/i.test(t)) out.push('AVELÃ');
  if (/ARDOSIA/i.test(t)) out.push('ARDÓSIA');
  return out;
}

export function buildBuscaVariantes(busca, tokens) {
  const set = new Set();
  const words = [...new Set([busca, ...tokens].filter(Boolean))];
  for (const w of words) {
    set.add(w);
    set.add(stripAccents(w));
    for (const v of generateAccentVariants(w)) set.add(v);
    for (const alias of spellingAliases(w)) set.add(alias);
    if (w.length >= 4) {
      const pre4 = w.slice(0, 4);
      set.add(pre4);
      for (const v of generateAccentVariants(pre4)) set.add(v);
    }
    if (w.length >= 5) {
      const pre5 = w.slice(0, 5);
      set.add(pre5);
      for (const v of generateAccentVariants(pre5)) set.add(v);
    }
  }
  return [...set].filter(Boolean);
}

function normName(s) {
  return stripAccents(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function namesLikelyMatch(a, b) {
  const x = normName(a);
  const y = normName(b);
  if (!x || !y) return false;
  if (x.includes(y) || y.includes(x)) return true;
  const dropO = (s) => s.replace(/O/g, '');
  if (dropO(x).includes(dropO(y)) || dropO(y).includes(dropO(x))) return true;
  return false;
}

function splitGluedToken(t) {
  const m = String(t).match(/^([A-Za-zÀ-ÿ]+)(\d+)$/i);
  return m ? m[1] : t;
}

export function parseDesc(desc) {
  const raw = String(desc || '').trim();
  const formato = normFmt(raw);
  const m2Match = raw.match(/\((\d+[,.]?\d*)\)/);
  const m2_excel = m2Match ? m2Match[1].replace(',', '.') : '';

  let rest = raw.replace(/^(PISO|REVESTIMENTO|REV\.?)\s+/i, '');
  if (formato) rest = rest.replace(new RegExp(formato.replace('x', '[xX]'), 'i'), ' ').trim();
  rest = rest.replace(/\s*\([^)]*\).*/g, '').replace(/["']/g, ' ').trim();
  rest = rest.replace(/\b(RT|HD|PEI|LD|LC|JU|P|BOLD|BRILH\w*|MAT\w*|POL\w*|SEMI\w*|ANTI\w*|AD|RELEV\/?\/?OUTS?\w*|RELEVO|OUTSIDE|MR|BG|EXT|PE|ACETINADO)\b/gi, ' ');
  rest = rest.replace(/[-/]+/g, ' ').replace(/\s+/g, ' ').trim();

  const tokens = rest.split(' ').filter(Boolean).map(splitGluedToken);
  const buscaTokens = [];
  for (const t of tokens) {
    const clean = t.replace(/[^A-Za-zÀ-ÿ0-9]/g, '');
    if (!clean || clean.length < 3) continue;
    if (/^\d+$/.test(clean)) continue;
    if (/^(REV|BR|HD|BG|CZ|CL|M)$/i.test(clean)) continue;
    buscaTokens.push(clean);
    if (buscaTokens.length >= 2) break;
  }
  const busca = buscaTokens.join(' ') || splitGluedToken(tokens[0] || '') || '';

  const acab_excel = /MATE/i.test(raw) ? 'mate'
    : /POLIDO|POL\b/i.test(raw) ? 'polido'
    : /BRILH/i.test(raw) ? 'brilhante'
    : /AD\b|ADERENTE|RELEV|OUTS/i.test(raw) ? 'aderente'
    : /SEMI/i.test(raw) ? 'semiderrapante'
    : /GRANILH/i.test(raw) ? 'granilhado'
    : '';

  return {
    raw,
    formato,
    m2_excel,
    busca,
    buscaVariantes: buildBuscaVariantes(busca, buscaTokens),
    acab_excel,
    tokens,
  };
}

export function scoreMatch(prod, parsed) {
  let score = 0;
  const fmtSite = normFmt(prod.formato);
  if (parsed.formato && fmtSite === parsed.formato) score += 50;
  else if (parsed.formato && fmtSite) score -= 40;

  const title = stripAccents(prod.titulo).toUpperCase();
  const titleRaw = prod.titulo.toUpperCase();
  for (const tok of stripAccents(parsed.busca).toUpperCase().split(' ')) {
    if (tok && title.includes(tok)) score += 20;
    else if (tok && namesLikelyMatch(tok, prod.titulo)) score += 18;
  }
  for (const tok of parsed.tokens.map((t) => stripAccents(t).toUpperCase())) {
    if (tok.length >= 2 && (title.includes(tok) || titleRaw.includes(tok))) score += 5;
    else if (tok.length >= 4 && namesLikelyMatch(tok, prod.titulo)) score += 8;
  }
  for (const tok of parsed.tokens) {
    if (/^(BEGE|CAFE|CAFÉ|MARFIM|BG|CZ)$/i.test(tok) && title.includes(stripAccents(tok).toUpperCase())) score += 15;
  }
  if (/\bBG\b/i.test(parsed.raw) && /\bBG\b/i.test(prod.titulo)) score += 18;
  if (/\bBG\b/i.test(parsed.raw) && /\bBR\b/i.test(prod.titulo) && !/\bBG\b/i.test(prod.titulo)) score -= 25;
  if (/\bCZ\b/i.test(parsed.raw) && /\bCZ\b/i.test(prod.titulo)) score += 18;
  if (/CL/i.test(parsed.raw) && title.includes('CL')) score += 12;
  if (/\bM[\s-]?45\b/i.test(parsed.raw) && /\bM\s*45\b/.test(prod.titulo)) score += 12;
  if (/\bTAIKO\b/i.test(parsed.raw) && /\bBEGE\b/i.test(parsed.raw) && /\bTAIKO\b/i.test(prod.titulo) && /\bBG\b/i.test(prod.titulo)) score += 20;
  if (/\bTAIKO\b/i.test(parsed.busca) && !/\bTAIKO\b/i.test(prod.titulo)) score -= 50;

  if ((prod.marca_nome || '').toLowerCase() === 'premium') score += 3;

  const acab = (prod.acabamento || '').toUpperCase();
  if (parsed.acab_excel === 'mate' && acab.includes('MATE')) score += 8;
  if (parsed.acab_excel === 'polido' && acab.includes('POLIDO')) score += 8;
  if (parsed.acab_excel === 'brilhante' && acab.includes('BRILH')) score += 8;
  if (parsed.acab_excel === 'aderente' && (acab.includes('ADERENTE') || acab.includes('ABS'))) score += 8;
  if (parsed.acab_excel === 'granilhado' && acab.includes('GRANILH')) score += 8;

  return score;
}

export async function buscar(q) {
  const res = await fetch(`${FORMIGRES_BASE}/api/busca.php?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.produtos || [];
}

export async function buscarComVariantes(parsed) {
  const seen = new Set();
  const all = [];
  for (const q of parsed.buscaVariantes) {
    const prods = await buscar(q);
    for (const p of prods) {
      if (!seen.has(p.id)) { seen.add(p.id); all.push(p); }
    }
  }
  return all;
}

export function absUrl(rel) {
  if (!rel) return '';
  return rel.startsWith('http') ? rel : FORMIGRES_BASE + rel;
}

function isPlaceholderUrl(url) {
  return !url || /placeholder/i.test(url);
}

/** Imagens do produto Formigres — principal = cerâmica solitária. */
export function extractImagensFromDetalhe(p) {
  if (!p) return [];
  const imgs = [];

  if (!isPlaceholderUrl(p.imagem_url)) {
    imgs.push({ url: absUrl(p.imagem_url), tipo: 'principal', ordem: 0, principal: true });
  }
  if (!isPlaceholderUrl(p.imagem_amb_url)) {
    imgs.push({ url: absUrl(p.imagem_amb_url), tipo: 'ambiente', ordem: 10, principal: false });
  }
  if (!isPlaceholderUrl(p.imagem_piso_url)) {
    imgs.push({ url: absUrl(p.imagem_piso_url), tipo: 'piso', ordem: 20, principal: false });
  }
  const faces = Array.isArray(p.faces) ? p.faces : [];
  faces.forEach((u, i) => {
    if (!isPlaceholderUrl(u)) {
      imgs.push({ url: absUrl(u), tipo: 'face', ordem: 30 + i, principal: false });
    }
  });

  // dedupe por URL
  const seen = new Set();
  return imgs.filter((img) => {
    if (seen.has(img.url)) return false;
    seen.add(img.url);
    return true;
  });
}

export async function fetchProdutoDetalhe(id) {
  const res = await fetch(`${FORMIGRES_BASE}/api/produto.php?id=${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.produto || null;
}

export async function findBestMatch(desc, { minScore = 30, requireFormatoSite = true } = {}) {
  const parsed = parseDesc(desc);
  if (requireFormatoSite && parsed.formato && !FORMATOS_SITE.has(parsed.formato)) {
    return { parsed, match: null, score: 0, reason: 'formato_fora_site' };
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
    return { parsed, match: null, score: bestScore, reason: 'sem_match' };
  }
  return { parsed, match: best, score: bestScore, reason: null };
}
