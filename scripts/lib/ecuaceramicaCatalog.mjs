/**
 * Catálogo Ecuaceramica (Equador) — PrestaShop, categoria Porcelanato.
 * Uso: portfolio white-label P38 (dados públicos do site).
 */
import { normFmt, stripAccents } from './formigresCatalog.mjs';

export const ECUA_BASE = 'https://ecuaceramica.com';
export const PORCELANATO_CATEGORY = `${ECUA_BASE}/6-porcelanato`;
export const UA = 'P38-ERP-catalogo/1.0';

function decodeHtmlEntities(raw) {
  return String(raw || '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#039;/g, "'");
}

function parseFeatures(html) {
  const feats = [...html.matchAll(/class="name">([^<]+)<\/dt>\s*<dd[^>]*>([^<]+)/g)]
    .map((m) => [m[1].trim(), m[2].trim()]);
  return Object.fromEntries(feats);
}

function parseMetaTitle(html) {
  const m = html.match(/"title":"([^"]+)"/);
  return m ? decodeHtmlEntities(m[1].replace(/\\u00e9/g, 'é').replace(/\\u00ed/g, 'í')) : '';
}

function parseFormato(metaTitle, dimension) {
  const dim = String(dimension || '').trim();
  const mDim = dim.match(/(\d{2,3})\s*[x×X]\s*(\d{2,3})/);
  if (mDim) return normFmt(`${mDim[1]}x${mDim[2]}`) || `${mDim[1]}x${mDim[2]}`.toLowerCase();
  const mTitle = String(metaTitle || '').match(/(\d{2,3})\s*[x×X]\s*(\d{2,3})/i);
  if (mTitle) return normFmt(`${mTitle[1]}x${mTitle[2]}`) || `${mTitle[1]}x${mTitle[2]}`.toLowerCase();
  return normFmt(metaTitle) || '';
}

function tituloFromMeta(metaTitle, feats) {
  const raw = String(metaTitle || '').trim();
  if (!raw) return feats?.Color ? String(feats.Color) : 'Produto';
  return raw.replace(/\s+\d{2,3}\s*[x×X]\s*\d{2,3}\s*$/i, '').trim() || raw;
}

function tokenizeTitulo(titulo) {
  return stripAccents(titulo)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length >= 2);
}

function parsePrecoCaixaFromProductJson(prodJson) {
  if (!prodJson) return { preco_caixa: null, preco_motivo_site: 'sem_data_product' };
  const amount = Number(prodJson.price_amount);
  if (Number.isFinite(amount) && amount > 0) {
    return { preco_caixa: amount, preco_motivo_site: 'price_amount' };
  }
  const raw = String(prodJson.price || '').trim();
  if (raw && !/0[,.]00/.test(raw)) {
    const cleaned = raw.replace(/[^\d,.-]/g, '');
    const normalized = cleaned.includes(',') && !cleaned.includes('.')
      ? cleaned.replace(',', '.')
      : cleaned.replace(/\./g, '').replace(',', '.');
    const v = Number(normalized);
    if (Number.isFinite(v) && v > 0) {
      return { preco_caixa: v, preco_motivo_site: 'price_string' };
    }
  }
  return { preco_caixa: null, preco_motivo_site: 'preco_oculto_site' };
}

/** URLs de produto na categoria Porcelanato (paginação PrestaShop). */
export async function fetchCategoryProductUrls({ resultsPerPage = 100 } = {}) {
  const urls = new Set();
  let page = 1;
  let prevSize = 0;

  while (page <= 20) {
    const sep = PORCELANATO_CATEGORY.includes('?') ? '&' : '?';
    const url = `${PORCELANATO_CATEGORY}${sep}resultsPerPage=${resultsPerPage}&page=${page}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`Ecuaceramica categoria ${res.status}`);
    const html = await res.text();
    const batch = [...html.matchAll(/href="(https:\/\/ecuaceramica\.com\/porcelanato\/\d+-[^"#]+\.html)"/g)]
      .map((m) => m[1]);
    for (const u of batch) urls.add(u);
    if (batch.length === 0 || urls.size === prevSize) break;
    prevSize = urls.size;
    page += 1;
  }

  return [...urls].sort((a, b) => {
    const ia = Number(a.match(/porcelanato\/(\d+)-/)?.[1] || 0);
    const ib = Number(b.match(/porcelanato\/(\d+)-/)?.[1] || 0);
    return ia - ib;
  });
}

/** Detalhe de um produto a partir da página HTML. */
export async function fetchProdutoDetalhe(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Ecuaceramica produto ${res.status}: ${url}`);
  const html = await res.text();
  const feats = parseFeatures(html);
  const metaTitle = parseMetaTitle(html);
  const id = url.match(/porcelanato\/(\d+)-/)?.[1] || '';
  const imagem_url = html.match(/data-image-large-src="([^"]+)"/)?.[1]
    || html.match(/(\d+-large_default\/[^"]+\.(?:jpg|webp|png))"/)?.[1]?.replace(/^/, `${ECUA_BASE}/`)
    || '';
  let reference = '';
  let preco_caixa = null;
  let preco_motivo_site = 'preco_oculto_site';
  const dataProduct = html.match(/data-product="([^"]+)"/);
  if (dataProduct) {
    try {
      const prodJson = JSON.parse(decodeHtmlEntities(dataProduct[1]));
      reference = prodJson.reference || '';
      ({ preco_caixa, preco_motivo_site } = parsePrecoCaixaFromProductJson(prodJson));
    } catch { /* ignore */ }
  }

  const titulo = tituloFromMeta(metaTitle, feats);
  const formato = parseFormato(metaTitle, feats.Dimensión || feats['Dimensión']);

  return {
    id,
    titulo,
    meta_title: metaTitle,
    formato,
    referencia: reference,
    imagem_url,
    produto_url: url,
    preco_caixa,
    preco_motivo_site,
    moeda: 'USD',
    tipo: feats.Material || 'Porcelanato',
    acabamento: feats.Acabado || '',
    rectificado: feats.Rectificado || '',
    tipologia: feats.Tipología || feats['Tipología'] || '',
    color: feats.Color || '',
    uso: feats.Uso || '',
    pei: feats['Alto Tráfico'] || '',
    busca_tokens: tokenizeTitulo(`${titulo} ${formato} ${feats.Tipología || ''}`),
  };
}

export async function fetchAllProdutos({ onProgress } = {}) {
  const urls = await fetchCategoryProductUrls();
  const produtos = [];
  for (let i = 0; i < urls.length; i += 1) {
    const det = await fetchProdutoDetalhe(urls[i]);
    if (det.id) produtos.push(det);
    if (onProgress) onProgress(i + 1, urls.length);
  }
  return produtos;
}
