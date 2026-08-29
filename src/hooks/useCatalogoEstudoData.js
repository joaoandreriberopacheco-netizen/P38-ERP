import { useMemo, useState } from 'react';
import {
  buildEstudoSupplyHierarchy,
  enrichEstudoSupplyForPanel,
} from '@/lib/estudoCatalog/buildEstudoSupplyHierarchy';
import {
  buildEstudoSupplyLines,
  buildEstudoTree,
  enrichEstudoRows,
  listEstudoLinhas,
} from '@/lib/estudoCatalog/buildEstudoModel';
import { getEstudoCatalogManifest, getEstudoManifestMeta } from '@/lib/estudoCatalog/loadEstudoManifest';
import { getDefaultPortalCatalogFilters } from '@/lib/hierarquiaPortal/portalCatalogFilters';

function matchSearch(row, q) {
  const blob = [
    row.bloco,
    row.sub_bloco,
    row.linha_nome,
    row.produto_compra_nome,
    row.novo_sku,
    row.sku_atual,
    row.codigo_interno,
  ]
    .join(' ')
    .toLowerCase();
  return blob.includes(q);
}

/**
 * Catálogo novo — dados 100% do Excel de estudo (manifest JSON).
 * Não chama Supabase, Base44 nem fetch de produtos activos.
 */
export function useCatalogoEstudoData() {
  const [portalFilters, setPortalFilters] = useState(getDefaultPortalCatalogFilters);
  const [filtroLinha, setFiltroLinha] = useState('');
  const [filtroTipos, setFiltroTipos] = useState(() => new Set(['solo', 'mix', 'portfolio']));

  const manifestMeta = useMemo(() => getEstudoManifestMeta(), []);

  const enriched = useMemo(() => enrichEstudoRows(getEstudoCatalogManifest()), []);

  const filteredRows = useMemo(() => {
    let rows = enriched;
    if (filtroLinha) rows = rows.filter((r) => r.linha_codigo === filtroLinha);
    if (filtroTipos?.size) rows = rows.filter((r) => filtroTipos.has(r.linha_tipo));
    const q = (portalFilters.searchTerm || '').trim().toLowerCase();
    if (q) rows = rows.filter((r) => matchSearch(r, q));
    return rows;
  }, [enriched, filtroLinha, filtroTipos, portalFilters.searchTerm]);

  const tree = useMemo(() => buildEstudoTree(filteredRows), [filteredRows]);

  const supplyLines = useMemo(() => buildEstudoSupplyLines(filteredRows), [filteredRows]);

  const supplyLinesPanel = useMemo(
    () => enrichEstudoSupplyForPanel(supplyLines),
    [supplyLines],
  );

  const hierarchy = useMemo(
    () => buildEstudoSupplyHierarchy(supplyLinesPanel),
    [supplyLinesPanel],
  );

  const linhas = useMemo(() => listEstudoLinhas(enriched), [enriched]);

  const tipoCounts = useMemo(() => {
    const counts = { solo: 0, mix: 0, portfolio: 0 };
    for (const l of linhas) {
      if (counts[l.tipo] != null) counts[l.tipo] += 1;
    }
    return counts;
  }, [linhas]);

  return {
    loading: false,
    loadingVelocity: false,
    dataSource: 'excel-estudo',
    manifestMeta,
    portalFilters,
    setPortalFilters,
    filtroLinha,
    setFiltroLinha,
    filtroTipos,
    setFiltroTipos,
    tree,
    hierarchy,
    filteredSupply: supplyLinesPanel,
    linhas,
    enriched: filteredRows,
    totalSkus: enriched.length,
    tipoCounts,
    estoqueVirtualAtivo: false,
  };
}
