import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import {
  indexProdutosPorCodigo,
  mapEstudoRowsToCatalogProdutos,
} from '@/lib/estudoCatalog/mapEstudoToProdutoCatalogRow';
import { getEstudoCatalogManifest, getEstudoManifestMeta } from '@/lib/estudoCatalog/loadEstudoManifest';
import { getDefaultPortalCatalogFilters } from '@/lib/hierarquiaPortal/portalCatalogFilters';
import { fetchProdutosAtivos } from '@/lib/fetchProdutosAtivos';
import { fetchPedidosVenda90d } from '@/lib/fetchPedidosVenda90d';
import { buildCatalogSalesVelocityMap } from '@/lib/catalogSalesVelocity';
import { base44 } from '@/api/base44Client';

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
 * Novo Ecosistema — hierarquia + estoque Excel; enrich comercial do cadastro (opcional, por codigo_interno).
 */
export function useCatalogoEstudoData() {
  const [portalFilters, setPortalFilters] = useState(getDefaultPortalCatalogFilters);
  const [filtroLinha, setFiltroLinha] = useState('');
  const [tipoAtivo, setTipoAtivo] = useState('mix');

  const manifestMeta = useMemo(() => getEstudoManifestMeta(), []);
  const manifest = useMemo(() => getEstudoCatalogManifest(), []);

  const { data: produtos = [], isLoading: loadingProdutos, refetch: refetchProdutos } = useQuery({
    queryKey: ['catalogo-estudo', 'produtos-ativos'],
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchProdutosAtivos(base44),
  });

  const { data: pedidos90d = [], isLoading: loadingVelocity } = useQuery({
    queryKey: ['catalogo-estudo', 'pedidos-90d'],
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchPedidosVenda90d(base44),
  });

  const salesVelocityMap = useMemo(
    () => buildCatalogSalesVelocityMap(pedidos90d),
    [pedidos90d],
  );

  const produtoByCodigo = useMemo(() => indexProdutosPorCodigo(produtos), [produtos]);

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

  const catalogProdutos = useMemo(
    () => mapEstudoRowsToCatalogProdutos(filteredRowsBase, produtoByCodigo),
    [filteredRowsBase, produtoByCodigo],
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
    loading: loadingProdutos,
    loadingVelocity,
    dataSource: produtoByCodigo.size ? 'excel-estudo+cadastro-comercial' : 'excel-estudo',
    manifestMeta,
    portalFilters,
    setPortalFilters,
    filtroLinha,
    setFiltroLinha,
    tipoAtivo,
    setTipoAtivo,
    treeCatalogo,
    treeCompra,
    tree: treeCompra,
    hierarchy,
    filteredSupply: supplyLinesPanel,
    linhas,
    enriched: filteredRowsBase,
    enrichedCompra: filteredRowsCompra,
    catalogProdutos,
    salesVelocityMap,
    totalSkus: enrichedAll.length,
    tipoCounts,
    estoqueStats,
    refetchProdutos,
  };
}
