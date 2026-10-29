/**
 * Portal Grupo Rocha — slugs, query ?c= e título da ficha (SSR).
 */
export const ROCHA_PORTAL_BASE = 'https://www.portalgruporocha.com.br';

/** PR701001 no SIAH → pr70100 (remove dígito final opcional; não truncar a 4 dígitos). */
export function rochaSlugFromSiahDesc(desc) {
  const m = String(desc || '').match(/\b(PR|R)(\d{4,})\b/i);
  if (!m) return '';
  let digits = m[2];
  if (digits.length >= 5 && digits.endsWith('1')) digits = digits.slice(0, -1);
  return `${m[1].toLowerCase()}${digits}`;
}

/** Slugs a tentar no portal (código completo, SIAH sem 1 final, núcleo 4 dígitos). */
export function rochaSlugCandidatesFromErp(desc) {
  const m = String(desc || '').match(/\b(PR|R)(\d{4,})\b/i);
  if (!m) return [];
  const prefix = m[1].toLowerCase();
  let digits = m[2];
  const out = new Set();
  out.add(`${prefix}${digits}`);
  if (digits.length >= 5 && digits.endsWith('1')) out.add(`${prefix}${digits.slice(0, -1)}`);
  if (digits.length > 4) out.add(`${prefix}${digits.slice(0, 4)}`);
  return [...out];
}

export function parseRochaCMapFromProdutosHtml(html) {
  const map = new Map();
  for (const m of String(html || '').matchAll(/produtos\/([a-z0-9-]+)\?c=(\d+)/gi)) {
    map.set(m[1].toLowerCase(), m[2]);
  }
  return map;
}

export function rochaProductUrl(slug, cMap, cOverride) {
  const s = String(slug || '').replace(/^\/+|\/+$/g, '');
  if (!s) return '';
  const c = cOverride || cMap?.get(s.toLowerCase());
  return c ? `${ROCHA_PORTAL_BASE}/produtos/${s}?c=${c}` : `${ROCHA_PORTAL_BASE}/produtos/${s}`;
}

export function rochaTitleFromHtml(html) {
  const raw = String(html || '');
  const og = raw.match(/<meta property="og:title" content="([^"]+)"/i)?.[1]?.trim();
  if (og && !isBadRochaTitle(og)) {
    return og.replace(/\s*\|\s*Grupo Rocha\s*$/i, '').trim();
  }
  const title = raw.match(/<title>([^<]+)/i)?.[1]?.trim() || '';
  const cleaned = title
    .replace(/^Grupo Rocha\s*\|\s*/i, '')
    .replace(/\s*\|\s*Grupo Rocha\s*$/i, '')
    .replace(/^404\s*-\s*/i, '')
    .trim();
  if (isBadRochaTitle(cleaned)) return '';
  return cleaned;
}

export function isBadRochaTitle(title) {
  const t = String(title || '').trim();
  if (!t || t.length < 2) return true;
  if (/404|não encontrad|not found|pagina nao encontrada/i.test(t)) return true;
  if (/^grupo rocha$/i.test(t)) return true;
  return false;
}

export function isRochaProductHtmlValid(html) {
  const raw = String(html || '');
  if (raw.length < 500) return false;
  if (/Page not found|__nuxt_error/i.test(raw)) return false;
  const title = rochaTitleFromHtml(raw);
  return Boolean(title);
}

/** Slug listado no índice /produtos com ?c= — ficha SSR pode falhar, mas URL é do catálogo oficial. */
export function rochaCatalogFallbackHit(slug, cMap, label = '') {
  const s = String(slug || '').toLowerCase();
  if (!s || !cMap?.has(s)) return null;
  const url = rochaProductUrl(s, cMap);
  const name =
    label ||
    s
      .split('-')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  return {
    fabricante_grupo: 'Grupo Rocha',
    marca_no_site: 'Rochamaxx',
    descricao_no_site: name,
    evidencia_url: url,
    status: 'confirmado_site',
    match_metodo: `rocha_portal_indice:${s}`,
  };
}
