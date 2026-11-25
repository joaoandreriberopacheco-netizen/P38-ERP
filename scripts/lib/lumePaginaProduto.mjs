/**
 * Ficha pública Lume (portfolio-item no site lumeceramica.com.br).
 */
const LUME = 'https://lumeceramica.com.br';

export function lumePortfolioUrl(slug) {
  const s = String(slug || '').replace(/^\/+|\/+$/g, '');
  return `${LUME}/portfolio-item/${s}/`;
}

export function parseLumePortfolioHtml(html, pageUrl = '') {
  const raw = String(html || '');
  if (raw.length < 400) return null;
  const title =
    raw
      .match(/<title>([^<]+)/i)?.[1]
      ?.replace(/&#\d+;/g, '×')
      .replace(/\s*[–-]\s*Grupo Lume.*$/i, '')
      .trim() || '';
  if (!title || /404|não encontrad/i.test(title)) return null;

  const imagens = [];
  const seen = new Set();
  const isGenericLumeAsset = (u) => /logo|padrao-produtos-site|lume-logo/i.test(u);
  const productImageScore = (u) => {
    if (isGenericLumeAsset(u)) return -10;
    if (/-\d{2,4}x\d{2,4}\./i.test(u)) return 1;
    if (/\bF\d+\b/i.test(u) || /pol-|portoro|portorio/i.test(u)) return 5;
    if (/\/site[-.]?\d*\./i.test(u)) return 0;
    return 2;
  };
  const add = (url) => {
    const u = String(url || '').trim();
    if (!u || seen.has(u) || /logo/i.test(u)) return;
    seen.add(u);
    imagens.push(u);
  };

  const og = raw.match(/property="og:image" content="([^"]+)"/i)?.[1];
  if (og) add(og);

  for (const m of raw.matchAll(/https:\/\/lumeceramica\.com\.br\/wp-content\/uploads\/[^"'\s]+\.(?:webp|jpe?g|png)/gi)) {
    add(m[0]);
  }

  imagens.sort((a, b) => productImageScore(b) - productImageScore(a));

  return {
    titulo: title,
    descricao_no_site: title,
    imagem_url: imagens.find((u) => productImageScore(u) > 0) || imagens[0] || '',
    imagens,
    evidencia_url: pageUrl || '',
    fabricante_grupo: 'Lume Cerâmica',
    marca_site: 'Lume',
  };
}

export function imagensJsonFromLumeFicha(ficha) {
  const urls = ficha?.imagens?.length ? ficha.imagens : ficha?.imagem_url ? [ficha.imagem_url] : [];
  return JSON.stringify(urls.slice(0, 8));
}

/** Slugs oficiais (sitemap / catálogo Lume). Site usa PORTORO; ERP costuma PORTORIO. */
export const LUME_PORTFOLIO_BY_CODE = {
  'INDF-030': 'pol-nero-portoro-45x89',
  'INDF-032': 'pol-nero-portoro-75x75',
  'INDF-041': 'legno-castanho-22x90',
  'INDF-042': 'peroba',
  'INDF-043': 'sugi-ban-carvalho-2',
  'INDF-044': 'teca-natural-22x90',
};

export function lumePortfolioSlugFromRow(row) {
  const fixed = LUME_PORTFOLIO_BY_CODE[row.codigo];
  if (fixed) return fixed;
  const n = String(row.descricao_erp || row.modelo || '').toLowerCase();
  const fmt = String(row.formato || '').toLowerCase();
  if (/portor/i.test(n)) {
    if (fmt === '45x89') return 'pol-nero-portoro-45x89';
    if (fmt === '75x75') return 'pol-nero-portoro-75x75';
  }
  return '';
}
