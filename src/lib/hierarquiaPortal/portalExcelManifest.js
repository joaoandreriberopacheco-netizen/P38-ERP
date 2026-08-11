import manifest from '@/data/portalExcelManifest.generated.json';
import { HIERARQUIA_PORTAL_FILTRAR_EXCEL } from '@/config/hierarquiaPortalFlags';

const SKU_MAP = manifest.skus || {};
const CODIGOS = new Set(Object.keys(SKU_MAP));

export const PORTAL_EXCEL_LINHAS = manifest.linhas || [];
export const PORTAL_EXCEL_SKU_COUNT = manifest.skuCount || 0;
export const PORTAL_EXCEL_SOURCE = manifest.source || '';

/** Normaliza código interno (Excel ↔ Base44). */
export function resolvePortalProdutoCodigo(produto) {
  const raw =
    produto?.codigo_interno
    ?? produto?.codigo
    ?? produto?.Codigo_Interno
    ?? '';
  return String(raw).trim().toUpperCase();
}

export function getPortalExcelSku(produto) {
  const cod = resolvePortalProdutoCodigo(produto);
  if (!cod) return null;
  return SKU_MAP[cod] || null;
}

export function isProdutoNoExcelPortal(produto) {
  if (!HIERARQUIA_PORTAL_FILTRAR_EXCEL) return true;
  return CODIGOS.has(resolvePortalProdutoCodigo(produto));
}

export function filterProdutosPortalExcel(produtos) {
  if (!HIERARQUIA_PORTAL_FILTRAR_EXCEL) return produtos || [];
  return (produtos || []).filter(isProdutoNoExcelPortal);
}

export function findPortalExcelLinha(codigo) {
  return PORTAL_EXCEL_LINHAS.find((l) => l.codigo === codigo) || null;
}
