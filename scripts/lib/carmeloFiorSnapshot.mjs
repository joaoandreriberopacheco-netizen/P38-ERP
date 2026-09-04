/**
 * Snapshot Carmel Fior — marca Arielle (id_category 4).
 */
import {
  ARIELLE_CATEGORY_ID,
  CARMELO_FIOR_BASE,
  fetchAllProdutosArielle,
  normalizeProduto,
} from './carmeloFiorCatalog.mjs';

export const FABRICANTE = {
  slug: 'arielle',
  nome: 'Arielle',
  marca: 'Arielle',
  grupo: 'Carmelo Fior',
  site: CARMELO_FIOR_BASE,
  categoria: 'revestimentos',
  categoryId: ARIELLE_CATEGORY_ID,
};

export async function fetchAllProdutos(opts = {}) {
  return fetchAllProdutosArielle(opts);
}

export function buildSnapshot(produtosRaw) {
  const produtos = produtosRaw.map(normalizeProduto).filter(Boolean);
  const por_formato = {};
  for (const p of produtos) {
    const fmt = p.formato || '—';
    if (!por_formato[fmt]) por_formato[fmt] = [];
    por_formato[fmt].push(p.id);
  }

  return {
    fabricante: FABRICANTE.slug,
    exportedAt: new Date().toISOString(),
    source: `${CARMELO_FIOR_BASE}/transaction/Product/list?id_category=${ARIELLE_CATEGORY_ID}`,
    count: produtos.length,
    produtos,
    por_formato,
    meta: {
      grupo: FABRICANTE.grupo,
      marca: FABRICANTE.marca,
      categoryId: ARIELLE_CATEGORY_ID,
    },
  };
}

export function loadSnapshotFromFile(snapshot) {
  if (!snapshot?.produtos?.length) return null;
  return snapshot;
}
