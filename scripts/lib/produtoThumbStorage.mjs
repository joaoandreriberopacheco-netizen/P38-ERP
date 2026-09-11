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

export async function fetchImageBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
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
    const buf = imageBuffer || await fetchImageBuffer(fullUrl);
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
