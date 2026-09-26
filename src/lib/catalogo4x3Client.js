import manifest from '@/data/catalogo4x3Skus.generated.json';

const SKU_MAP = manifest.skus || {};

export const CATALOGO_4X3_EXPORTED_AT = manifest.exportedAt || '';
export const CATALOGO_4X3_SKU_COUNT = manifest.skuCount || Object.keys(SKU_MAP).length;

export function resolveProdutoCodigoInterno(produto) {
  return String(produto?.codigo_interno || produto?.codigo || '').trim().toUpperCase();
}

export function getCatalogo4x3Row(produtoOrCodigo) {
  const cod =
    typeof produtoOrCodigo === 'string'
      ? produtoOrCodigo.trim().toUpperCase()
      : resolveProdutoCodigoInterno(produtoOrCodigo);
  return cod ? SKU_MAP[cod] || null : null;
}

/** Nome de vitrine no modo catálogo 4×3 (Excel). */
export function getCatalogo4x3DisplayName(produto) {
  const row = getCatalogo4x3Row(produto);
  if (row?.novo_sku) return row.novo_sku;
  if (row?.sku_atual) return row.sku_atual;
  return produto?.nome || '—';
}

/** Subtítulo: comp1 · comp2 · comp3 ou caminho curto. */
export function getCatalogo4x3Subtitle(produto) {
  const row = getCatalogo4x3Row(produto);
  if (!row) return '';
  const comps = [row.comp1, row.comp2, row.comp3].filter(Boolean).join(' · ');
  if (comps) return comps;
  return row.caminho || '';
}

export function enrichProdutoCatalogo4x3(produto) {
  const row = getCatalogo4x3Row(produto);
  if (!row) {
    return { ...produto, _catalogo4x3: null, nome_catalogo: produto?.nome };
  }
  return {
    ...produto,
    _catalogo4x3: row,
    nome_catalogo: row.novo_sku || row.sku_atual || produto?.nome,
  };
}

export function enrichProdutosCatalogo4x3(produtos = []) {
  return (produtos || []).map(enrichProdutoCatalogo4x3);
}

/** Só SKUs presentes no mapa 4×3 (base Excel activa). */
export function filterProdutosComMapa4x3(produtos = []) {
  return (produtos || []).filter((p) => getCatalogo4x3Row(p));
}
