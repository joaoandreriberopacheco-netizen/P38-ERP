/**
 * Snapshot Ecuaceramica (Equador) — portfolio P38.
 */
import {
  ECUA_BASE,
  PORCELANATO_CATEGORY,
  fetchAllProdutos,
} from './ecuaceramicaCatalog.mjs';

export const FABRICANTE = {
  slug: 'ecuaceramica',
  nome: 'Ecuaceramica',
  site: ECUA_BASE,
  categoria: 'revestimentos',
  pais: 'EC',
  nota: 'Exemplo ilustrativo de portfolio — dados públicos do site ecuaceramica.com',
};

export { fetchAllProdutos };

export function buildSnapshot(produtosRaw) {
  const produtos = produtosRaw.filter((p) => p?.id);
  const por_formato = {};
  for (const p of produtos) {
    const fmt = p.formato || '—';
    if (!por_formato[fmt]) por_formato[fmt] = [];
    por_formato[fmt].push(p.id);
  }

  return {
    fabricante: FABRICANTE.slug,
    exportedAt: new Date().toISOString(),
    source: PORCELANATO_CATEGORY,
    count: produtos.length,
    produtos,
    por_formato,
  };
}

export function loadSnapshotFromFile(snapshot) {
  if (!snapshot?.produtos?.length) return null;
  return snapshot;
}
