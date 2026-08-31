import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchAllProdutosCatalogo, fetchProdutosAtivos } from '@/lib/fetchProdutosAtivos';
import { fetchPedidosVenda90d } from '@/lib/fetchPedidosVenda90d';
import { buildCatalogSalesVelocityMap } from '@/lib/catalogSalesVelocity';
import {
  enrichProdutoPortal,
  buildPortalTree,
  buildPortalSupplyLines,
  listPortalLinhas,
} from '@/lib/hierarquiaPortal/buildPortalModel';
import {
  buildPortalSupplyHierarchy,
  enrichSupplyLinesWithMetrics,
} from '@/lib/hierarquiaPortal/buildPortalSupplyHierarchy';
import {
  filterProdutosPortalExcel,
  getPortalCatalogSkuCount,
} from '@/lib/hierarquiaPortal/portalExcelManifest';
import { loadPortalCatalog } from '@/lib/hierarquiaPortal/fetchPortalCatalog';
import { getDefaultPortalCatalogFilters } from '@/lib/hierarquiaPortal/portalCatalogFilters';
import { filterProdutos } from '@/lib/filterProdutos';
import { createCatalogStockContext } from '@/lib/catalogEstoqueVirtual';
import { fetchPedidosCompraParaSugestaoEstoque } from '@/lib/fetchPedidosCompraParaSugestaoEstoque';
import { buildPendenteAprovadoFinanceiroPorProduto } from '@/lib/sugestaoCompraEstoquePendente';

export function useCatalogoPortalData() {
  const [loading, setLoading] = useState(true);
  const [loadingVelocity, setLoadingVelocity] = useState(true);
  const [produtos, setProdutos] = useState([]);
  const [pedidos90d, setPedidos90d] = useState([]);
  const [portalFilters, setPortalFilters] = useState(getDefaultPortalCatalogFilters);
  const [filtroLinha, setFiltroLinha] = useState('');
  const [filtroTipos, setFiltroTipos] = useState(() => new Set(['solo', 'mix', 'portfolio']));

  const loadProdutos = useCallback(async () => {
    setLoading(true);
    try {
      await loadPortalCatalog();
      const activos = await fetchProdutosAtivos(base44);
      setProdutos(activos || []);
    } catch (e) {
      console.error('[CatalogoNovo]', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProdutos();
  }, [loadProdutos]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingVelocity(true);
      try {
        const pedidos = await fetchPedidosVenda90d();
        if (!cancelled) setPedidos90d(pedidos || []);
      } catch (e) {
        console.error('[CatalogoNovo] vendas 90d', e);
      } finally {
        if (!cancelled) setLoadingVelocity(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const produtosPiloto = useMemo(() => filterProdutosPortalExcel(produtos), [produtos]);
  const velocityMap = useMemo(
    () => buildCatalogSalesVelocityMap(produtosPiloto, pedidos90d),
    [produtosPiloto, pedidos90d],
  );

  const estoqueVirtualAtivo = portalFilters.estoqueVirtual === true;
  const { data: pendentePorProduto = {} } = useQuery({
    queryKey: ['catalogo-novo', 'pendente-estoque'],
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

  const produtosFiltrados = useMemo(
    () => filterProdutos(produtosPiloto, portalFilters, { salesVelocityMap: velocityMap, catalogStockContext }),
    [produtosPiloto, portalFilters, velocityMap, catalogStockContext],
  );

  const enriched = useMemo(
    () => produtosFiltrados
      .map((p) => enrichProdutoPortal(p, catalogStockContext))
      .filter((r) => r.fonte_excel),
    [produtosFiltrados, catalogStockContext],
  );

  const tree = useMemo(() => buildPortalTree(enriched), [enriched]);
  const supplyLines = useMemo(
    () => enrichSupplyLinesWithMetrics(buildPortalSupplyLines(enriched), velocityMap),
    [enriched, velocityMap],
  );
  const linhas = useMemo(() => listPortalLinhas(enriched), [enriched]);

  const filteredSupply = useMemo(() => {
    let lines = supplyLines;
    if (filtroLinha) lines = lines.filter((l) => l.linha_codigo === filtroLinha);
    if (filtroTipos?.size) lines = lines.filter((l) => filtroTipos.has(l.linha_tipo));
    const q = (portalFilters.searchTerm || '').trim().toLowerCase();
    if (q) {
      lines = lines.filter(
        (l) =>
          l.produto_compra_nome.toLowerCase().includes(q)
          || l.linha_nome.toLowerCase().includes(q),
      );
    }
    return lines;
  }, [supplyLines, filtroLinha, filtroTipos, portalFilters.searchTerm]);

  const hierarchy = useMemo(
    () => buildPortalSupplyHierarchy(filteredSupply, velocityMap),
    [filteredSupply, velocityMap],
  );

  const tipoCounts = useMemo(() => {
    const counts = { solo: 0, mix: 0, portfolio: 0 };
    for (const l of linhas) {
      if (counts[l.tipo] != null) counts[l.tipo] += 1;
    }
    return counts;
  }, [linhas]);

  return {
    loading,
    loadingVelocity,
    reload: loadProdutos,
    portalFilters,
    setPortalFilters,
    filtroLinha,
    setFiltroLinha,
    filtroTipos,
    setFiltroTipos,
    tree,
    hierarchy,
    filteredSupply,
    linhas,
    enriched,
    produtosPiloto,
    produtosFiltrados,
    tipoCounts,
    catalogStockContext,
    estoqueVirtualAtivo,
    skuTotalPiloto: getPortalCatalogSkuCount(),
  };
}
