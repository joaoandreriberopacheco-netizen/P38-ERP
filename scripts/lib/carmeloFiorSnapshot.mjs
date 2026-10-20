/**
 * Snapshot Carmelo Fior — grupo completo (Cecafi, Fiorano, Idealle, Arielle…).
 */
import {
  CARMELO_FIOR_BASE,
  CARMELO_TODAS_MARCAS_CATEGORY_ID,
  fetchAllProdutosGrupoCarmelo,
  normalizeProduto,
} from './carmeloFiorCatalog.mjs';

export const FABRICANTE = {
  slug: 'arielle',
  nome: 'Carmelo Fior',
  marca: 'Grupo Carmelo Fior',
  grupo: 'Carmelo Fior',
  site: CARMELO_FIOR_BASE,
  categoria: 'revestimentos',
  categoryId: CARMELO_TODAS_MARCAS_CATEGORY_ID,
};

export async function fetchAllProdutos(opts = {}) {
  return fetchAllProdutosGrupoCarmelo(opts);
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
    source: `${CARMELO_FIOR_BASE}/transaction/Product/list?id_category=${CARMELO_TODAS_MARCAS_CATEGORY_ID}`,
    count: produtos.length,
    produtos,
    por_formato,
    meta: {
      grupo: FABRICANTE.grupo,
      marca: FABRICANTE.marca,
      categoryId: CARMELO_TODAS_MARCAS_CATEGORY_ID,
    },
  };
}

export function loadSnapshotFromFile(snapshot) {
  if (!snapshot?.produtos?.length) return null;
  return snapshot;
}
