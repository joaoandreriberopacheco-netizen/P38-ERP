import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  buildEstudoSupplyHierarchy,
  enrichEstudoSupplyForPanel,
} from '@/lib/estudoCatalog/buildEstudoSupplyHierarchy';
import {
  buildEstudoSupplyLines,
  buildEstudoTree,
  enrichEstudoRows,
  indexProdutosPorCodigo,
  listEstudoLinhas,
  countEstudoEstoqueEncontrado,
} from '@/lib/estudoCatalog/buildEstudoModel';
import { getEstudoCatalogManifest, getEstudoManifestMeta } from '@/lib/estudoCatalog/loadEstudoManifest';
import { getDefaultPortalCatalogFilters } from '@/lib/hierarquiaPortal/portalCatalogFilters';
import { fetchProdutosAtivos } from '@/lib/fetchProdutosAtivos';
import { createCatalogStockContext } from '@/lib/catalogEstoqueVirtual';
import { fetchPedidosCompraParaSugestaoEstoque } from '@/lib/fetchPedidosCompraParaSugestaoEstoque';
import { buildPendenteAprovadoFinanceiroPorProduto } from '@/lib/sugestaoCompraEstoquePendente';

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
 * Catálogo novo — hierarquia Excel + estoque real do cadastro (Base44/Supabase).
 */
export function useCatalogoEstudoData() {
  const [portalFilters, setPortalFilters] = useState(getDefaultPortalCatalogFilters);
  const [filtroLinha, setFiltroLinha] = useState('');
  const [tipoAtivo, setTipoAtivo] = useState('mix');

  const manifestMeta = useMemo(() => getEstudoManifestMeta(), []);
  const manifest = useMemo(() => getEstudoCatalogManifest(), []);

  const { data: produtos = [], isLoading: loadingProdutos, isFetching: fetchingProdutos } = useQuery({
    queryKey: ['catalogo-estudo', 'produtos-ativos'],
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchProdutosAtivos(),
  });

  const produtoByCodigo = useMemo(() => indexProdutosPorCodigo(produtos), [produtos]);

  const estoqueVirtualAtivo = portalFilters.estoqueVirtual === true;
  const { data: pendentePorProduto = {} } = useQuery({
    queryKey: ['catalogo-estudo', 'pendente-estoque'],
    enabled: estoqueVirtualAtivo,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const data = await fetchPedidosCompraParaSugestaoEstoque(base44);
      return buildPendenteAprovadoFinanceiroPorProduto(
        data.pedidosAbertos,
        data.recebidosPorPedidoProduto,
        { embarques: data.embarques, pedidosParaEmbarque: data.pedidosTodos },
      );
    },
  });

  const catalogStockContext = useMemo(
    () => createCatalogStockContext(estoqueVirtualAtivo, pendentePorProduto),
    [estoqueVirtualAtivo, pendentePorProduto],
  );

  const enrichedAll = useMemo(
    () => enrichEstudoRows(manifest, { produtoByCodigo, catalogStockContext }),
    [manifest, produtoByCodigo, catalogStockContext],
  );

  const estoqueStats = useMemo(() => countEstudoEstoqueEncontrado(enrichedAll), [enrichedAll]);

  const filteredRows = useMemo(() => {
    let rows = enrichedAll;
    if (filtroLinha) rows = rows.filter((r) => r.linha_codigo === filtroLinha);
    rows = rows.filter((r) => r.linha_tipo === tipoAtivo);
    const q = (portalFilters.searchTerm || '').trim().toLowerCase();
    if (q) rows = rows.filter((r) => matchSearch(r, q));
    return rows;
  }, [enrichedAll, filtroLinha, tipoAtivo, portalFilters.searchTerm]);

  const tree = useMemo(
    () => buildEstudoTree(filteredRows, { catalogStockContext }),
    [filteredRows, catalogStockContext],
  );
  const supplyLines = useMemo(() => buildEstudoSupplyLines(filteredRows), [filteredRows]);
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
    loading: loadingProdutos || fetchingProdutos,
    loadingVelocity: false,
    dataSource: produtoByCodigo.size ? 'excel-estudo+cadastro' : 'excel-estudo',
    manifestMeta,
    portalFilters,
    setPortalFilters,
    filtroLinha,
    setFiltroLinha,
    tipoAtivo,
    setTipoAtivo,
    tree,
    hierarchy,
    filteredSupply: supplyLinesPanel,
    linhas,
    enriched: filteredRows,
    totalSkus: enrichedAll.length,
    tipoCounts,
    estoqueVirtualAtivo,
    estoqueStats,
    catalogStockContext,
  };
}
