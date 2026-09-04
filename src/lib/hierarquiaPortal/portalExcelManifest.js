import manifest from '@/data/portalExcelManifest.generated.json';
import {
  filterProdutosPortalCatalog,
  getPortalCatalogLinhasSync,
  getPortalCatalogSkuCountSync,
  getPortalCatalogSkuSync,
  isPortalCatalogLoaded,
  isProdutoInPortalCatalogSync,
} from '@/lib/hierarquiaPortal/portalCatalogStore';

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
  const fromCatalog = getPortalCatalogSkuSync(cod);
  if (fromCatalog) return fromCatalog;
  return SKU_MAP[cod] || null;
}

export function isProdutoNoExcelPortal(produto) {
  if (isPortalCatalogLoaded()) {
    return isProdutoInPortalCatalogSync(produto);
  }
  return CODIGOS.has(resolvePortalProdutoCodigo(produto));
}

export function filterProdutosPortalExcel(produtos) {
  if (isPortalCatalogLoaded()) {
    return filterProdutosPortalCatalog(produtos);
  }
  return (produtos || []).filter(isProdutoNoExcelPortal);
}

export function findPortalExcelLinha(codigo) {
  const linhas = isPortalCatalogLoaded() ? getPortalCatalogLinhasSync() : PORTAL_EXCEL_LINHAS;
  return linhas.find((l) => l.codigo === codigo) || null;
}

export function getPortalCatalogLinhas() {
  if (isPortalCatalogLoaded()) return getPortalCatalogLinhasSync();
  return PORTAL_EXCEL_LINHAS;
}

export function getPortalCatalogSkuCount() {
  if (isPortalCatalogLoaded()) return getPortalCatalogSkuCountSync();
  return PORTAL_EXCEL_SKU_COUNT;
}
