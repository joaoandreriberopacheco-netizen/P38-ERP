/**
 * API Carmel Fior (Cerâmica) — produtos por marca.
 * Arielle = id_category 4.
 */
import { normFmt, stripAccents } from './formigresCatalog.mjs';

export const CARMELO_FIOR_BASE = 'https://www.carmelofior.com.br';
export const IMAGE_BASE = `${CARMELO_FIOR_BASE}/public/images/product`;
export const ARIELLE_CATEGORY_ID = 4;
export const UA = 'P38-ERP-catalogo/1.0';

const ATTR = {
  tamanho: 1,
  superficie: 2,
  acabamento: 4,
};

function parseSetCookie(headers) {
  const raw = headers.getSetCookie ? headers.getSetCookie() : [];
  return raw.map((c) => c.split(';')[0]).join('; ');
}

/** @returns {Promise<{ token: string, cookies: string }>} */
export async function bootstrapSession() {
  const res = await fetch(`${CARMELO_FIOR_BASE}/produtos`, {
    headers: { 'User-Agent': UA },
  });
  const text = await res.text();
  const token = text.match(/request\.tk="([^"]+)"/)?.[1];
  if (!token) throw new Error('Carmelo Fior: Transaction-Token não encontrado');
  return { token, cookies: parseSetCookie(res.headers) };
}

async function postTransaction(token, cookies, module, action, body = {}) {
  const res = await fetch(`${CARMELO_FIOR_BASE}/transaction/${module}/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Transaction-Token': token,
      'User-Agent': UA,
      Cookie: cookies,
      Referer: `${CARMELO_FIOR_BASE}/produtos`,
      Origin: CARMELO_FIOR_BASE,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.status !== 200) {
    throw new Error(`Carmelo Fior ${module}/${action}: ${json.error?.message || json.status}`);
  }
  return json.data;
}

/** Lista produtos paginados (marca Arielle por defeito). */
export async function listProdutos(session, { idCategory = ARIELLE_CATEGORY_ID, pag = 1, prp = 50 } = {}) {
  return postTransaction(session.token, session.cookies, 'Product', 'list', {
    ord: 'recent',
    id_category: idCategory,
    attributes: {},
    features: [],
    title: '',
    status: 1,
    pag,
    prp,
  });
}

export async function fetchAllProdutosArielle({ onProgress } = {}) {
  const session = await bootstrapSession();
  const all = [];
  let pag = 1;
  let size = Infinity;
  while (all.length < size) {
    const data = await listProdutos(session, { pag, prp: 50 });
    size = data.size ?? data.results?.length ?? 0;
    const batch = data.results || [];
    all.push(...batch);
    if (onProgress) onProgress(all.length, size);
    if (!batch.length) break;
    pag += 1;
  }
  return all;
}

function attrById(attributes, idAttribute) {
  return (attributes || []).find((a) => Number(a.id_attribute) === idAttribute) || null;
}

/** "84x84 cm RT" → { formato: "84x84", retificada: true } */
export function parseTamanhoAttr(text = '') {
  const raw = String(text || '').trim();
  const rt = /\bRT\b/i.test(raw);
  const m = raw.match(/(\d+(?:[.,]\d+)?)\s*[x×X]\s*(\d+(?:[.,]\d+)?)/);
  if (!m) return { formato: '', retificada: rt };
  const a = m[1].replace(',', '.');
  const b = m[2].replace(',', '.');
  const fmt = normFmt(`${a}x${b}`) || `${Math.round(Number(a))}x${Math.round(Number(b))}`.toLowerCase();
  return { formato: fmt, retificada: rt };
}

function mapSuperficie(title = '') {
  const t = String(title || '').trim().toUpperCase();
  if (t === 'POLIDO') return 'POLIDO';
  if (t === 'BRILHANTE') return 'BRILHANTE';
  if (t === 'ACETINADO' || t === 'SOFT' || t === 'NATURAL') return 'MATE';
  if (t.includes('GRANILH') || t.includes('ESCORREG')) return 'GRANILHADO ABS';
  return t || '';
}

/** Carmel Fior por vezes marca superfície errada; regras de negócio Arielle. */
function resolveSuperficie(prodTitle = '', superficieTitle = '') {
  const titulo = String(prodTitle || '');
  const sup = String(superficieTitle || '').trim();
  // Linha Plus AC = acetinado (mate) — ex. Tinharé Plus AC vinha como Polido na API.
  if (/\bPLUS\s+AC\b/i.test(titulo)) return 'Acetinado';
  return sup;
}

/** Formatos arbitrados quando Carmel Fior não informa tamanho (referência → formato). */
const FORMATO_OVERRIDE_BY_CODE = {
  56819: '84x84', // RETIF Laredo — tamanho ausente na API
};

function resolveFormato(raw, parsedFormato = '') {
  const code = Number(String(raw?.code || '').trim());
  const override = FORMATO_OVERRIDE_BY_CODE[code];
  if (override) return override;
  return parsedFormato || '';
}

function mapAcabamentoTipo(title = '', retificada = false) {
  const t = String(title || '').trim().toUpperCase();
  if (t === 'RETIFICADO' || retificada) return 'RETIFICADO';
  if (t === 'BOLD') return 'BOLD';
  return retificada ? 'RETIFICADO' : 'BOLD';
}

export function imageUrl(imageFile) {
  if (!imageFile) return '';
  if (String(imageFile).startsWith('http')) return imageFile;
  return `${IMAGE_BASE}/${imageFile}`;
}

function pickThumbImage(images = []) {
  const faceImg = images.find((i) => Number(i.face) === 1);
  const mainImg = images.find((i) => Number(i.main) === 1);
  return faceImg || mainImg || images[0] || null;
}

/** Galeria no formato do catálogo P38 — cerâmica (face) primeiro, ambiente depois. */
export function extractImagensFromProduto(prod) {
  const images = prod?.images || [];
  const faceImg = images.find((i) => Number(i.face) === 1);
  const mainImg = images.find((i) => Number(i.main) === 1);
  const out = [];
  const seen = new Set();

  function push(img, tipo) {
    if (!img) return;
    const url = imageUrl(img.image || img.thumb);
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push({ url, tipo });
  }

  if (faceImg) {
    push(faceImg, 'principal');
    if (mainImg && mainImg !== faceImg) push(mainImg, 'ambiente');
  } else if (mainImg) {
    push(mainImg, 'principal');
  }

  for (const img of images) {
    if (img === faceImg || img === mainImg) continue;
    push(img, 'detalhe');
  }

  if (!out.length && prod?.imagem_url) {
    out.push({ url: prod.imagem_url, tipo: 'principal' });
  }
  return out;
}

export function normalizeProduto(raw) {
  if (!raw?.id) return null;
  const tamanho = attrById(raw.attributes, ATTR.tamanho);
  const superficie = attrById(raw.attributes, ATTR.superficie);
  const acabamento = attrById(raw.attributes, ATTR.acabamento);
  const { formato: formatoParsed, retificada } = parseTamanhoAttr(tamanho?.option_title || tamanho?.text || '');
  const formato = resolveFormato(raw, formatoParsed);
  const superficieRaw = superficie?.option_title || superficie?.text || '';
  const superficieResolved = resolveSuperficie(raw.title, superficieRaw);
  const acabSup = mapSuperficie(superficieResolved);
  const tipo = mapAcabamentoTipo(acabamento?.option_title || acabamento?.text || '', retificada);
  const thumbImg = pickThumbImage(raw.images || []);
  const imagem_url = imageUrl(thumbImg?.image || thumbImg?.thumb || '');

  return {
    id: String(raw.id),
    titulo: raw.title || '',
    codigo: raw.code || '',
    slug: raw.slug || '',
    formato,
    acabamento: acabSup,
    acabamento_info: superficieResolved || superficieRaw,
    tipo,
    referencia: raw.code || '',
    marca_nome: 'Arielle',
    categoria: 'Arielle',
    imagem_url,
    imagem_amb_url: '',
    produto_url: `${CARMELO_FIOR_BASE}/produto/${raw.slug || raw.id}`,
    busca_tokens: stripAccents(raw.title || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, ' ')
      .split(' ')
      .filter((t) => t.length >= 2),
    images: raw.images || [],
    attributes: raw.attributes || [],
  };
}
