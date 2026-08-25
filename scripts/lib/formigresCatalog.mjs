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

/** Remove lixo de rodapé dos PDFs Tintão antes do parse. */
export function sanitizeTintaoDesc(desc) {
  return String(desc || '')
    .replace(/\s*Usu[aá]rio:\s*.*/i, '')
    .replace(/\s*Impresso em:\s*.*/i, '')
    .replace(/\s*SIAH\s+Software.*/i, '')
    .replace(/\s*A7\s+ERP.*/i, '')
    .replace(/\s+P[aá]gina:\s*\d+.*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Distância Manhattan entre formatos (ex.: 87×87 ≈ 88×88 → 2). */
export function formatoDist(a, b) {
  const ma = normFmt(a);
  const mb = normFmt(b);
  if (!ma || !mb) return 999;
  const [a1, a2] = ma.split('x').map(Number);
  const [b1, b2] = mb.split('x').map(Number);
  return Math.abs(a1 - b1) + Math.abs(a2 - b2);
}

export function formatosProximos(a, b, maxDist = 2) {
  return formatoDist(a, b) <= maxDist;
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
  if (/NATURALE/i.test(t)) out.push('NATURALLE');
  if (/NATURALLE/i.test(t)) out.push('NATURALE');
  if (/BRANCO/i.test(t)) out.push('BR');
  if (/CLARO/i.test(t)) out.push('CL');
  if (/PRETO/i.test(t)) out.push('PR');
  if (/GREY/i.test(t)) out.push('GRAY');
  if (/GRAY/i.test(t)) out.push('GREY');
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

const STRIP_NOISE_RE = /\b(RT|HD|PEI\d*|LD|LC|JU|P|BOLD|BRILH\w*|MAT\w*|POL\w*|SEMI\w*|ANTI\w*|AD|RELEV\/?\/?OUTS?\w*|RELEVO|OUTSIDE|EXT|PE|ACETINADO|CX[\d,.]*M2?|EXTRA|F-\d+)\b/gi;
const TOKEN_NOISE_RE = /^(PEI\d*|HD\d*|CX[\d,.]*M2?|\d{4}PE|\d+[,.]?\d*M2|\d+D?|F\d+|EXTRA|USUARIO|USUÁRIO|IMPRESSO|SIAH|SOFTWARE|JOSI)$/i;

/** Códigos de cor na lista Tintão → palavras no título Formigres. */
const COR_MAP = {
  BG: ['BG', 'BEGE'],
  BEGE: ['BG', 'BEGE'],
  VD: ['VD', 'VERDE'],
  VERDE: ['VD', 'VERDE'],
  CZ: ['CZ', 'CINZA'],
  CINZA: ['CZ', 'CINZA'],
  MR: ['MR', 'MARROM'],
  MRM: ['MR', 'MARROM', 'MRM'],
  MARROM: ['MR', 'MARROM', 'MRM'],
  AZ: ['AZ', 'AZUL'],
  AZUL: ['AZ', 'AZUL'],
  CL: ['CL', 'CLARO'],
  CLARO: ['CL', 'CLARO'],
  GREY: ['GREY', 'GRAY'],
  GRAY: ['GREY', 'GRAY'],
  PRETO: ['PRETO', 'PR'],
  PR: ['PRETO', 'PR'],
  BP: ['BP', 'BRANCO', 'PRETO'],
  BRANCO: ['BRANCO', 'BR'],
  BR: ['BRANCO', 'BR'],
  CAFE: ['CAFE', 'CAFÉ', 'CF'],
  CAFÉ: ['CAFE', 'CAFÉ', 'CF'],
  MARFIM: ['MARFIM', 'MRM'],
};

function titleWords(titulo) {
  return stripAccents(titulo)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w.length >= 2);
}

function extractCorTokens(raw) {
  const upper = stripAccents(raw).toUpperCase();
  const found = new Set();
  const patterns = [
    [/\bBG\b|\bBEGE\b/, 'BG'],
    [/\bVD\b|\bVERDE\b/, 'VD'],
    [/\bCZ\b|\bCINZA\b/, 'CZ'],
    [/\bMRM\b|\bMARROM\b/, 'MRM'],
    [/\bMR\b/, 'MR'],
    [/\bAZUL\b|\bAZ\b/, 'AZ'],
    [/\bCL\b|\bCLARO\b/, 'CL'],
    [/\bGREY\b|\bGRAY\b/, 'GREY'],
    [/\bPRETO\b/, 'PR'],
    [/\bBRANCO\b/, 'BR'],
    [/\bBRILHANTE\b|\bBR\b(?![A-Z])/, 'BR'],
    [/\bCAFE\b|\bCAFÉ\b/, 'CAFE'],
    [/\bMARFIM\b/, 'MARFIM'],
  ];
  for (const [re, code] of patterns) {
    if (re.test(upper)) found.add(code);
  }
  return [...found];
}

function isNoiseToken(clean) {
  if (!clean || clean.length < 2) return true;
  if (/^\d+$/.test(clean)) return true;
  if (/^CX\d/i.test(clean)) return true;
  if (/^\d{4}PE$/i.test(clean)) return true;
  return TOKEN_NOISE_RE.test(clean);
}

const WORD_ALIASES = {
  NATURALE: ['NATURALLE'],
  NATURALLE: ['NATURALE'],
  BRANCO: ['BR'],
  BR: ['BRANCO'],
  CLARO: ['CL'],
  CL: ['CLARO'],
  PRETO: ['PR'],
  PR: ['PRETO'],
  GREY: ['GRAY'],
  GRAY: ['GREY'],
};

function scoreWordMatch(queryWord, titleWord) {
  if (!queryWord || !titleWord) return 0;
  if (queryWord === titleWord) return 30;
  const aliases = WORD_ALIASES[queryWord] || [];
  if (aliases.includes(titleWord)) return 28;

  const q = queryWord;
  const t = titleWord;
  const shorter = q.length <= t.length ? q : t;
  const longer = q.length > t.length ? q : t;

  if (longer.startsWith(shorter)) {
    const diff = longer.length - shorter.length;
    if (diff === 0) return 30;
    // MADEIRO↔MADEIRADO, MONT↔MONTANA — prefixo enganoso
    if (diff <= 3 && shorter.length >= 4) return -40;
    if (diff === 1) return 8;
    return -20;
  }

  if (namesLikelyMatch(q, t)) return 10;
  return -15;
}

function scoreNameTokens(nameTokens, titulo) {
  if (!nameTokens.length) return 0;
  const words = titleWords(titulo);
  let score = 0;
  for (const token of nameTokens) {
    const q = stripAccents(token).toUpperCase();
    let best = -999;
    for (const tw of words) {
      best = Math.max(best, scoreWordMatch(q, tw));
    }
    if (best > 0) score += best;
    else {
      score -= 25;
      if (q.length >= 4) score -= 40;
    }
  }
  return score;
}

function scoreCorTokens(corTokens, titulo, raw) {
  const title = stripAccents(titulo).toUpperCase();
  const rawU = stripAccents(raw).toUpperCase();
  let score = 0;

  for (const code of corTokens) {
    const aliases = COR_MAP[code] || [code];
    const hit = aliases.some((a) => title.includes(a));
    if (hit) score += 22;
    else score -= 35;
  }

  if (corTokens.includes('CL')) {
    if (title.includes('CL')) score += 18;
    else score -= 30;
  } else if (/\bCL\b/.test(title) && !/\bCL\b/i.test(rawU)) {
    score -= 38;
  }

  if (/\bBRILHANTE\b/i.test(rawU) && !corTokens.includes('CL')) {
    if (/BRILHANTE|BRILH/.test(title)) score += 12;
    if (title.includes('CL') && !/\bCL\b/i.test(rawU)) score -= 20;
  }

  return score;
}

function extractVariantTokens(tokens, raw) {
  const variants = [];
  for (let i = 1; i < tokens.length; i++) {
    const prev = String(tokens[i - 1]).replace(/[^A-Za-zÀ-ÿ]/g, '');
    const clean = String(tokens[i]).replace(/[^0-9]/g, '');
    if (!prev || prev.length < 3) continue;
    if (!/^\d{2,3}$/.test(clean)) continue;
    if (TOKEN_NOISE_RE.test(String(tokens[i]))) continue;
    if (/PEI/i.test(raw) && new RegExp(`PEI\\s*${clean}\\b`, 'i').test(raw)) continue;
    variants.push(clean);
  }
  return [...new Set(variants)];
}

function scoreVariantTokens(variantTokens, titulo) {
  if (!variantTokens.length) return 0;
  const words = titleWords(titulo);
  let score = 0;
  for (const v of variantTokens) {
    if (words.includes(v)) score += 40;
    else {
      const nums = words.filter((w) => /^\d{2,3}$/.test(w));
      if (nums.some((n) => n !== v)) score -= 50;
      else score -= 15;
    }
  }
  return score;
}

export function parseDesc(desc) {
  const raw = sanitizeTintaoDesc(desc);
  const formato = normFmt(raw);
  const m2Match = raw.match(/\((\d+[,.]?\d*)\)/);
  const m2_excel = m2Match ? m2Match[1].replace(',', '.') : '';

  let rest = raw.replace(/^(PISO|REVESTIMENTO|REV\.?)\s+/i, '');
  if (formato) rest = rest.replace(new RegExp(formato.replace('x', '[xX]'), 'i'), ' ').trim();
  rest = rest.replace(/\s*\([^)]*\).*/g, '').replace(/["']/g, ' ').trim();
  rest = rest.replace(STRIP_NOISE_RE, ' ');
  rest = rest.replace(/[-/]+/g, ' ').replace(/\s+/g, ' ').trim();

  const tokens = rest.split(' ').filter(Boolean).map(splitGluedToken);
  const cor_tokens = extractCorTokens(raw);
  if (/\bBRANCO\s+PRETO\b/i.test(raw)) cor_tokens.push('BP');
  const variant_tokens = extractVariantTokens(tokens, raw);
  const variantSet = new Set(variant_tokens);
  const corSet = new Set(cor_tokens.flatMap((c) => [c, ...(COR_MAP[c] || [])]).map((x) => stripAccents(x).toUpperCase()));

  const name_tokens = [];
  for (const t of tokens) {
    const clean = t.replace(/[^A-Za-zÀ-ÿ0-9]/g, '');
    if (isNoiseToken(clean)) continue;
    const up = stripAccents(clean).toUpperCase();
    if (corSet.has(up)) continue;
    if (variantSet.has(clean)) continue;
    if (/^(REV|BR)$/i.test(clean) && /BRILH/i.test(raw)) continue;
    name_tokens.push(clean);
  }

  const buscaTokens = name_tokens.slice(0, 3);
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
    name_tokens: buscaTokens,
    cor_tokens,
    variant_tokens,
  };
}

export function scoreMatch(prod, parsed) {
  let score = 0;
  const fmtSite = normFmt(prod.formato);
  if (parsed.formato && fmtSite === parsed.formato) score += 50;
  else if (parsed.formato && fmtSite && formatosProximos(parsed.formato, fmtSite)) score += 38;
  else if (parsed.formato && fmtSite) score -= 40;

  const title = stripAccents(prod.titulo).toUpperCase();
  const nameTokens = parsed.name_tokens?.length ? parsed.name_tokens : parsed.busca.split(' ').filter(Boolean);

  score += scoreNameTokens(nameTokens, prod.titulo);
  score += scoreCorTokens(parsed.cor_tokens || [], prod.titulo, parsed.raw);
  score += scoreVariantTokens(parsed.variant_tokens || [], prod.titulo);

  // Tokens soltos (reforço leve)
  for (const tok of parsed.tokens.map((t) => stripAccents(t).toUpperCase())) {
    if (tok.length >= 3 && !TOKEN_NOISE_RE.test(tok) && title.includes(tok)) score += 3;
  }

  if (/\bTAIKO\b/i.test(parsed.raw) && /\bBEGE\b/i.test(parsed.raw) && /\bTAIKO\b/i.test(prod.titulo) && /\bBG\b/i.test(prod.titulo)) score += 15;
  if (/\bTAIKO\b/i.test(parsed.busca) && !/\bTAIKO\b/i.test(prod.titulo)) score -= 50;

  if ((prod.marca_nome || '').toLowerCase() === 'premium') score += 3;

  if (/\bHD\b/i.test(parsed.raw) && /\bHD\d+\b/i.test(title)) score += 12;
  if (parsed.formato === '50x50' && /\bHD50\b/i.test(title)) score += 8;

  if (parsed.cor_tokens?.includes('BP') && /\bBP\b/.test(title)) score += 25;

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
