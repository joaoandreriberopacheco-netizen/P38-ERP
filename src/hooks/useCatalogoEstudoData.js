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
  countEstudoEstoqueEncontrado,
} from '@/lib/estudoCatalog/buildEstudoModel';
import { getEstudoCatalogManifest, getEstudoManifestMeta } from '@/lib/estudoCatalog/loadEstudoManifest';
import { getDefaultPortalCatalogFilters } from '@/lib/hierarquiaPortal/portalCatalogFilters';

function matchSearch(row, q) {
  const blob = [
    row.bloco,
    row.sub_bloco,
    row.grupo,
    row.core,
    row.pathway_papel,
    row.linha_nome,
    row.linha_display,
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
 * Novo Ecosistema — hierarquia + estoque 100% Excel (manifest offline).
 * Cadastro/Supabase só entra via job nocturno que actualiza o xlsx (codigo_interno).
 */
export function useCatalogoEstudoData() {
  const [portalFilters, setPortalFilters] = useState(getDefaultPortalCatalogFilters);
  const [filtroLinha, setFiltroLinha] = useState('');
  const [tipoAtivo, setTipoAtivo] = useState('mix');

  const manifestMeta = useMemo(() => getEstudoManifestMeta(), []);
  const manifest = useMemo(() => getEstudoCatalogManifest(), []);

  const enrichedAll = useMemo(() => enrichEstudoRows(manifest), [manifest]);

  const estoqueStats = useMemo(() => countEstudoEstoqueEncontrado(enrichedAll), [enrichedAll]);

  const filteredRowsBase = useMemo(() => {
    let rows = enrichedAll;
    if (filtroLinha) rows = rows.filter((r) => r.linha_codigo === filtroLinha);
    const q = (portalFilters.searchTerm || '').trim().toLowerCase();
    if (q) rows = rows.filter((r) => matchSearch(r, q));
    return rows;
  }, [enrichedAll, filtroLinha, portalFilters.searchTerm]);

  const filteredRowsCompra = useMemo(
    () => filteredRowsBase.filter((r) => r.linha_tipo === tipoAtivo),
    [filteredRowsBase, tipoAtivo],
  );

  const treeCatalogo = useMemo(() => buildEstudoTree(filteredRowsBase), [filteredRowsBase]);

  const treeCompra = useMemo(() => buildEstudoTree(filteredRowsCompra), [filteredRowsCompra]);

  const supplyLines = useMemo(() => buildEstudoSupplyLines(filteredRowsCompra), [filteredRowsCompra]);
  const supplyLinesPanel = useMemo(() => enrichEstudoSupplyForPanel(supplyLines), [supplyLines]);
  const hierarchy = useMemo(() => buildEstudoSupplyHierarchy(supplyLinesPanel), [supplyLinesPanel]);
  const linhas = useMemo(() => listEstudoLinhas(enrichedAll), [enrichedAll]);

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
    tipoAtivo,
    setTipoAtivo,
    treeCatalogo,
    treeCompra,
    /** @deprecated use treeCatalogo ou treeCompra */
    tree: treeCompra,
    hierarchy,
    filteredSupply: supplyLinesPanel,
    linhas,
    enriched: filteredRowsBase,
    enrichedCompra: filteredRowsCompra,
    totalSkus: enrichedAll.length,
    tipoCounts,
    estoqueStats,
  };
}
