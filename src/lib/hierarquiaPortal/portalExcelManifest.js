import manifest from '@/data/portalExcelManifest.generated.json';
import { HIERARQUIA_PORTAL_FILTRAR_EXCEL } from '@/config/hierarquiaPortalFlags';

const SKU_MAP = manifest.skus || {};
const CODIGOS = new Set(Object.keys(SKU_MAP));

export const PORTAL_EXCEL_LINHAS = manifest.linhas || [];
export const PORTAL_EXCEL_SKU_COUNT = manifest.skuCount || 0;
export const PORTAL_EXCEL_SOURCE = manifest.source || '';

export function getPortalExcelSku(produto) {
  const cod = String(produto?.codigo_interno || '').trim().toUpperCase();
  if (!cod) return null;
  return SKU_MAP[cod] || null;
}

export function isProdutoNoExcelPortal(produto) {
  if (!HIERARQUIA_PORTAL_FILTRAR_EXCEL) return true;
  const cod = String(produto?.codigo_interno || '').trim().toUpperCase();
  return CODIGOS.has(cod);
}

export function filterProdutosPortalExcel(produtos) {
  if (!HIERARQUIA_PORTAL_FILTRAR_EXCEL) return produtos || [];
  return (produtos || []).filter(isProdutoNoExcelPortal);
}

export function findPortalExcelLinha(codigo) {
  return PORTAL_EXCEL_LINHAS.find((l) => l.codigo === codigo) || null;
}
