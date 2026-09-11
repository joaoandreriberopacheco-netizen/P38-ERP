import { normalizeSupabaseProjectUrl } from '@/lib/supabaseBrowserClient';
import { p38PublicEnv } from '@/lib/p38PublicEnv';

export const THUMB_BUCKET = 'produtos-imagens';
export const THUMB_PREFIX = 'catalogo/thumbs';

export function thumbStoragePath(codigoInterno) {
  const safe = String(codigoInterno || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-');
  return `${THUMB_PREFIX}/${safe}.webp`;
}

export function getSupabaseProjectBaseUrl() {
  return normalizeSupabaseProjectUrl(p38PublicEnv('VITE_SUPABASE_URL') || '');
}

/** URL pública canónica da miniatura (~96px WebP) no Storage. */
export function buildCanonicalThumbPublicUrl(codigoInterno) {
  const base = getSupabaseProjectBaseUrl();
  if (!base || !codigoInterno) return null;
  return `${base}/storage/v1/object/public/${THUMB_BUCKET}/${thumbStoragePath(codigoInterno)}`;
}

/**
 * Miniatura para listas — nunca devolve imagem_url (foto completa).
 * Ordem: imagem_thumb_url → caminho canónico no Storage (backfill).
 */
export function resolveProdutoThumbUrl(produto) {
  const explicit = String(produto?.imagem_thumb_url || '').trim();
  if (explicit) return explicit;

  const hasFoto = Boolean(String(produto?.imagem_url || '').trim());
  if (!hasFoto) return null;

  const codigo = produto?.codigo_interno || produto?.codigo;
  return buildCanonicalThumbPublicUrl(codigo);
}
