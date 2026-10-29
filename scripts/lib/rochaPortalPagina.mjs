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

/** Ignora OG gerado (_og) — preferir ficheiros em api…/storage/images/. */
export function isRochaOgPlaceholder(url = '') {
  return /gruporocha\.com\.br\/_og\//i.test(String(url || ''));
}

/**
 * Fotos oficiais no HTML da ficha (api.portalgruporocha.com.br/storage/images/{slug}-f1-….webp).
 * @returns {string[]} URLs únicas, principal primeiro (f1 antes de f2…)
 */
export function pickRochaImagesFromHtml(html, slug = '') {
  const raw = String(html || '');
  const s = String(slug || '').toLowerCase().replace(/\?.*$/, '');
  const slugVariants = new Set();
  if (s) slugVariants.add(s);
  if (/^r\d+$/i.test(s)) {
    slugVariants.add(`pr${s.slice(1)}`);
    slugVariants.add(s.slice(1));
  }
  if (/^pr\d+$/i.test(s)) {
    slugVariants.add(`r${s.slice(2)}`);
    slugVariants.add(s.slice(2));
  }
  const found = new Set();
  for (const variant of slugVariants) {
    const re = new RegExp(
      `https://api\\.portalgruporocha\\.com\\.br/storage/images/${variant}[^"'\\s]+\\.(webp|jpg|jpeg|png)`,
      'gi',
    );
    for (const m of raw.matchAll(re)) found.add(m[0]);
  }
  if (!found.size && s) {
    const reLoose = /https:\/\/api\.portalgruporocha\.com\.br\/storage\/images\/[^"'\\s]+\.(webp|jpg|jpeg|png)/gi;
    for (const m of raw.matchAll(reLoose)) {
      const u = m[0].toLowerCase();
      for (const variant of slugVariants) {
        if (u.includes(`/${variant}-`) || u.includes(`/${variant}.`)) {
          found.add(m[0]);
          break;
        }
      }
    }
  }
  const og = raw.match(/<meta property="og:image" content="([^"]+)"/i)?.[1]?.trim();
  if (og && !isRochaOgPlaceholder(og)) found.add(og);
  return [...found].sort((a, b) => {
    const fa = a.match(/-f(\d+)-/i)?.[1] || '9';
    const fb = b.match(/-f(\d+)-/i)?.[1] || '9';
    return Number(fa) - Number(fb);
  });
}

export function pickRochaImageFromHtml(html, slug = '') {
  return pickRochaImagesFromHtml(html, slug)[0] || '';
}

export function isRochaProductHtmlValid(html) {
  const raw = String(html || '');
  if (raw.length < 500) return false;
  if (/Page not found|__nuxt_error/i.test(raw)) return false;
  const title = rochaTitleFromHtml(raw);
  return Boolean(title);
}

/** Slug listado no índice /produtos com ?c= — ficha SSR pode falhar, mas URL é do catálogo oficial. */
/**
 * Busca HTML da ficha: muitos slugs (Fenix, Loft, Breccia) só respondem com ?c= do índice /produtos.
 */
export function fetchRochaProductPage(slug, cMap, curlGet) {
  const s = String(slug || '').toLowerCase().replace(/\?.*$/, '');
  if (!s || typeof curlGet !== 'function') return { html: '', url: '' };
  const urls = [];
  const withC = rochaProductUrl(s, cMap);
  if (withC.includes('?c=')) urls.push(withC);
  const bare = `${ROCHA_PORTAL_BASE}/produtos/${s}`;
  if (!urls.includes(bare)) urls.push(bare);
  for (const url of urls) {
    const html = curlGet(url);
    if (isRochaProductHtmlValid(html)) return { html, url };
  }
  const fallback = urls[0] || bare;
  return { html: curlGet(fallback), url: fallback };
}

/** Slugs por código Tintão / nome comercial (Rochamaxx 61×116, Loft 82×82). */
export function rochaNamedSlugCandidates(desc = '', codigoTintao = '') {
  const byCode = {
    '35486': 'loft-bege-ext',
    '35487': 'loft-cinza-ext',
  };
  const out = [];
  if (byCode[String(codigoTintao)]) out.push(byCode[String(codigoTintao)]);
  const n = String(desc || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (n.includes('fenix')) out.push('fenix');
  if (n.includes('breccia')) out.push('breccia-lux');
  if (n.includes('loft bege')) out.push('loft-bege-ext');
  if (n.includes('loft cinza')) out.push('loft-cinza-ext');
  return [...new Set(out)];
}

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
