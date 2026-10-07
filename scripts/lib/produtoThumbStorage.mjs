/**
 * Gera e publica miniaturas leves de produto no Supabase Storage.
 */
import sharp from 'sharp';

export const THUMB_SIZE = 96;
export const THUMB_QUALITY = 72;
export const THUMB_BUCKET = 'produtos-imagens';
export const THUMB_PREFIX = 'catalogo/thumbs';

export async function buildThumbWebp(imageBuffer) {
  return sharp(imageBuffer)
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover', position: 'centre' })
    .webp({ quality: THUMB_QUALITY })
    .toBuffer();
}

/** Normaliza protocolo e casing de host/path — cadastros legados vêm HTTPS://HOST/... em maiúsculas. */
export function normalizeImageUrl(url) {
  let u = String(url || '').trim();
  if (!u) return '';
  if (/^HTTPS:\/\//i.test(u)) u = `https://${u.slice(8)}`;
  else if (/^HTTP:\/\//i.test(u)) u = `http://${u.slice(7)}`;
  try {
    const parsed = new URL(u);
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.pathname = parsed.pathname.toLowerCase();
    return parsed.href;
  } catch {
    return u;
  }
}

export async function fetchImageBuffer(url) {
  const normalized = normalizeImageUrl(url);
  const res = await fetch(normalized);
  if (!res.ok) throw new Error(`fetch ${normalized} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Baixa imagem mesmo quando imagem_url é signed URL expirada (Supabase Storage). */
export async function fetchImageBufferResilient(url, { supabaseUrl, supabaseKey } = {}) {
  const normalized = normalizeImageUrl(url);
  if (!normalized) throw new Error('url vazia');

  const signMatch = normalized.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+?)(?:\?|$)/i);
  if (signMatch && supabaseUrl && supabaseKey) {
    const bucket = signMatch[1];
    const objectPath = decodeURIComponent(signMatch[2]);
    const res = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  }

  return fetchImageBuffer(normalized);
}

export function buildCanonicalThumbPublicUrl(codigoInterno, supabaseUrl) {
  const base = String(supabaseUrl || '').replace(/\/+$/, '');
  if (!base || !codigoInterno) return null;
  return `${base}/storage/v1/object/public/${THUMB_BUCKET}/${thumbStoragePath(codigoInterno)}`;
}

export function thumbStoragePath(codigoInterno, prefix = THUMB_PREFIX) {
  const safe = String(codigoInterno || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-');
  return `${prefix}/${safe}.webp`;
}

export async function uploadThumbToStorage({
  supabaseUrl,
  supabaseKey,
  storagePath,
  buffer,
  bucket = THUMB_BUCKET,
}) {
  const res = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${storagePath}`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'image/webp',
      'x-upsert': 'true',
    },
    body: buffer,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`upload thumb ${storagePath} → ${res.status}: ${text}`);
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${storagePath}`;
}

/**
 * Baixa imagem completa, gera thumb WebP e publica no Storage.
 * @returns {Promise<string|null>} URL pública da miniatura
 */
export async function ensureThumbFromImageUrl({
  imageUrl,
  codigoInterno,
  supabaseUrl,
  supabaseKey,
  imageBuffer = null,
}) {
  const fullUrl = String(imageUrl || '').trim();
  if (!fullUrl) return null;

  try {
    const buf = imageBuffer || await fetchImageBufferResilient(fullUrl, { supabaseUrl, supabaseKey });
    const thumbBuf = await buildThumbWebp(buf);
    const storagePath = thumbStoragePath(codigoInterno);
    return await uploadThumbToStorage({
      supabaseUrl,
      supabaseKey,
      storagePath,
      buffer: thumbBuf,
    });
  } catch (err) {
    console.warn(`[produtoThumbStorage] thumb falhou ${codigoInterno}:`, err.message);
    return null;
  }
}
