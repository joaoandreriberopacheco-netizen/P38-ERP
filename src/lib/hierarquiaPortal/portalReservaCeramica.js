import { CERAM_META_VAGAS } from '@/lib/modeloCatalogo/regrasCeramica';
import { portalEstoqueCx } from '@/lib/hierarquiaPortal/buildPortalSupplyCeramica';
import { resolvePortalProdutoCodigo } from '@/lib/hierarquiaPortal/portalExcelManifest';
import {
  enviarPortalCatalogParaReserva,
  reativarPortalCatalogReserva,
} from '@/lib/hierarquiaPortal/fetchPortalCatalog';
import {
  isProdutoReservaPortalSync,
  patchPortalCatalogReservaLocal,
} from '@/lib/hierarquiaPortal/portalCatalogStore';

/** Legado — reserva antiga gravava tag no produto; só para limpeza. */
export const PORTAL_RESERVA_TAG = 'reserva-ceramica';

function normalizeTag(tag) {
  return String(tag || '')
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ');
}

export function getProdutoTags(produto) {
  return Array.isArray(produto?.tags) ? produto.tags : [];
}

function hasLegacyReservaTag(produto) {
  if (!produto) return false;
  const tags = getProdutoTags(produto).map((t) => normalizeTag(t).toLowerCase());
  return tags.includes(PORTAL_RESERVA_TAG);
}

/** Reserva do portal — flag em portal_catalog (não altera public.produto). */
export function isProdutoReservaPortal(produto) {
  if (!produto) return false;
  if (produto.reserva_portal === true) return true;
  if (isProdutoReservaPortalSync(produto)) return true;
  return hasLegacyReservaTag(produto);
}

export function mergeTags(existing = [], { add = [], remove = [] } = {}) {
  const removeSet = new Set(remove.map((t) => normalizeTag(t).toLowerCase()).filter(Boolean));
  const out = [];
  const seen = new Set();

  for (const tag of existing) {
    const cleaned = normalizeTag(tag);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (removeSet.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }

  for (const tag of add) {
    const cleaned = normalizeTag(tag);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }

  return out;
}

/** SKUs activos sugeridos para reserva quando a esquadra excede a meta de posições (menor estoque primeiro). */
export function sugerirSkusExcedente(line, metaVagas = CERAM_META_VAGAS) {
  const skus = (line?.skus || []).filter((s) => !isProdutoReservaPortal(s.produto));
  if (skus.length <= metaVagas) return [];

  const ordenados = [...skus].sort((a, b) => {
    const ea = portalEstoqueCx(a);
    const eb = portalEstoqueCx(b);
    if (ea !== eb) return ea - eb;
    return String(a.produto?.nome || '').localeCompare(String(b.produto?.nome || ''), 'pt-BR');
  });

  const excesso = skus.length - metaVagas;
  return ordenados.slice(0, excesso).map((s) => s.produto.id).filter(Boolean);
}

export function contagemReservaLine(line) {
  const skus = line?.skus || [];
  const reservados = skus.filter((s) => isProdutoReservaPortal(s.produto));
  const activos = skus.filter((s) => !isProdutoReservaPortal(s.produto));
  return {
    total: skus.length,
    activos: activos.length,
    reservados: reservados.length,
    meta_vagas: line?.meta_vagas ?? CERAM_META_VAGAS,
    excedente: Math.max(0, activos.length - (line?.meta_vagas ?? CERAM_META_VAGAS)),
  };
}

function codigosFromProdutos(produtos) {
  return (produtos || [])
    .map((p) => resolvePortalProdutoCodigo(p))
    .filter(Boolean);
}

/** Marca reserva só em portal_catalog.reserva_portal (não toca public.produto). */
export async function enviarSkusParaReserva(_base44, produtos, { onProgress } = {}) {
  const lista = (produtos || []).filter((p) => p?.id && !isProdutoReservaPortal(p));
  const codigos = codigosFromProdutos(lista);
  if (!codigos.length) return 0;

  let done = 0;
  const batchSize = 25;
  for (let i = 0; i < codigos.length; i += batchSize) {
    const batch = codigos.slice(i, i + batchSize);
    await enviarPortalCatalogParaReserva(batch);
    done += batch.length;
    onProgress?.(done, codigos.length);
  }
  return codigos.length;
}

/** Remove reserva do portal_catalog (produto real permanece intacto). */
export async function reativarSkusDaReserva(_base44, produtos, { onProgress } = {}) {
  const lista = (produtos || []).filter((p) => p?.id && isProdutoReservaPortal(p));
  const codigos = codigosFromProdutos(lista);
  if (!codigos.length) return 0;

  let done = 0;
  const batchSize = 25;
  for (let i = 0; i < codigos.length; i += batchSize) {
    const batch = codigos.slice(i, i + batchSize);
    await reativarPortalCatalogReserva(batch);
    done += batch.length;
    onProgress?.(done, codigos.length);
  }
  return codigos.length;
}

/** Atualiza cache local quando Supabase offline. */
export { patchPortalCatalogReservaLocal };
