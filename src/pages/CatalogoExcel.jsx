import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/components/utils';
import { fetchProdutosAtivos } from '@/lib/fetchProdutosAtivos';
import { fetchPedidosCompraParaSugestaoEstoque } from '@/lib/fetchPedidosCompraParaSugestaoEstoque';
import { buildPendenteAprovadoFinanceiroPorProduto } from '@/lib/sugestaoCompraEstoquePendente';
import { createCatalogStockContext } from '@/lib/catalogEstoqueVirtual';
import { buildPortalTree, listPortalLinhas } from '@/lib/hierarquiaPortal/buildPortalModel';
import {
  buildEnrichedFromPortalCatalog,
  indexProdutosByCodigo,
} from '@/lib/hierarquiaPortal/buildExcelCatalogEnriched';
import { loadPortalCatalog } from '@/lib/hierarquiaPortal/fetchPortalCatalog';
import {
  getPortalCatalogSkuCount,
  PORTAL_EXCEL_SKU_COUNT,
} from '@/lib/hierarquiaPortal/portalExcelManifest';
import { getPortalCatalogSource } from '@/lib/hierarquiaPortal/portalCatalogStore';
import PortalTreeGrid from '@/components/hierarquia-portal/PortalTreeGrid';
import PortalTipoFilter from '@/components/hierarquia-portal/PortalTipoFilter';
import PortalCatalogFilters from '@/components/hierarquia-portal/PortalCatalogFilters';
import ExcelCatalogDrillPanel from '@/components/hierarquia-portal/ExcelCatalogDrillPanel';
import { getDefaultPortalCatalogFilters } from '@/lib/hierarquiaPortal/portalCatalogFilters';
import { filterProdutos, isSomentePositivosFilter } from '@/lib/filterProdutos';
import { buildCatalogSalesVelocityMap } from '@/lib/catalogSalesVelocity';
import { fetchPedidosVenda90d } from '@/lib/fetchPedidosVenda90d';

function CatalogoExcelInner() {
  const [loading, setLoading] = useState(true);
  const [produtos, setProdutos] = useState([]);
  const [catalogMeta, setCatalogMeta] = useState({ source: 'none', count: 0 });
  const [filtroLinha, setFiltroLinha] = useState('');
  const [filtroTipos, setFiltroTipos] = useState(() => new Set(['solo', 'mix', 'portfolio']));
  const [portalFilters, setPortalFilters] = useState(getDefaultPortalCatalogFilters);
  const [selectedRow, setSelectedRow] = useState(null);
  const [pedidos90d, setPedidos90d] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const meta = await loadPortalCatalog();
      setCatalogMeta(meta);
      const activos = await fetchProdutosAtivos(base44);
      setProdutos(activos || []);
    } catch (e) {
      console.error('[CatalogoExcel]', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pedidos = await fetchPedidosVenda90d();
        if (!cancelled) setPedidos90d(pedidos || []);
      } catch (e) {
        console.error('[CatalogoExcel] vendas 90d', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const produtosIndex = useMemo(() => indexProdutosByCodigo(produtos), [produtos]);
  const velocityMap = useMemo(
    () => buildCatalogSalesVelocityMap(produtos, pedidos90d),
    [produtos, pedidos90d],
  );

  const estoqueVirtualAtivo = portalFilters.estoqueVirtual === true;
  const { data: pendentePorProduto = {} } = useQuery({
    queryKey: ['catalogo-excel', 'pendente-estoque'],
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
    () => buildEnrichedFromPortalCatalog(produtosIndex, catalogStockContext),
    [produtosIndex, catalogStockContext],
  );

  const enrichedFiltrados = useMemo(() => {
    const filteredIds = new Set(
      filterProdutos(
        enrichedAll.map((r) => r.produto),
        portalFilters,
        { salesVelocityMap: velocityMap, catalogStockContext },
      ).map((p) => p.id),
    );
    return enrichedAll.filter((r) => filteredIds.has(r.produto.id));
  }, [enrichedAll, portalFilters, velocityMap, catalogStockContext]);

  const tree = useMemo(() => buildPortalTree(enrichedFiltrados), [enrichedFiltrados]);
  const linhas = useMemo(() => listPortalLinhas(enrichedFiltrados), [enrichedFiltrados]);

  const tipoCounts = useMemo(() => {
    const counts = { solo: 0, mix: 0, portfolio: 0 };
    for (const l of linhas) {
      if (counts[l.tipo] != null) counts[l.tipo] += 1;
    }
    return counts;
  }, [linhas]);

  const cadastrados = useMemo(
    () => enrichedFiltrados.filter((r) => r.cadastrado_erp).length,
    [enrichedFiltrados],
  );

  const searchTerm = portalFilters.searchTerm || '';
  const somentePositivos = isSomentePositivosFilter(portalFilters);
  const fonte = catalogMeta.source || getPortalCatalogSource();

  return (
    <div className="flex flex-col min-h-full w-full max-w-full font-din-1451 bg-background -mx-4 md:-mx-6 tablet-landscape:-mx-7">
      <div className="sticky top-0 z-30 bg-background border-b border-border/40 shadow-sm">
        <div className="w-full px-3 md:px-4 py-3 space-y-3">
          <div className="flex flex-wrap items-start gap-3 justify-between">
            <div className="space-y-1 min-w-0">
              <Button variant="ghost" size="sm" className="h-8 -ml-2 gap-1 text-muted-foreground" asChild>
                <Link to={createPageUrl('HierarquiaPortal')}>
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Portal hierarquia
                </Link>
              </Button>
              <h1 className="text-xl md:text-2xl font-semibold font-glacial text-foreground flex items-center gap-2">
                <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
                Catálogo Excel — TreeGrid + drill-down
              </h1>
              <p className="text-sm text-muted-foreground max-w-3xl hidden md:block">
                Mesma TreeGrid do portal, mas a árvore vem inteira do Excel / portal_catalog — clique num nível para ver a camada.
              </p>
            </div>
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-50/80 dark:bg-emerald-950/30 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-100 max-w-sm space-y-1 shrink-0">
              <p>
                <strong>{enrichedFiltrados.length}</strong> SKU(s) na árvore
                {' · '}
                <strong>{cadastrados}</strong> com cadastro ERP
              </p>
              <p className="opacity-80">
                Fonte: {fonte === 'supabase' ? 'portal_catalog' : 'manifest Excel'}
                {' · '}
                total manifest: {getPortalCatalogSkuCount() || PORTAL_EXCEL_SKU_COUNT}
              </p>
            </div>
          </div>

          <PortalTipoFilter activeTipos={filtroTipos} onChange={setFiltroTipos} counts={tipoCounts} />
          <PortalCatalogFilters
            filters={portalFilters}
            setFilters={setPortalFilters}
            filtroLinha={filtroLinha}
            onFiltroLinhaChange={(v) => setFiltroLinha(v === 'all' ? '' : v)}
            linhas={linhas}
          />
        </div>
      </div>

      <div className="flex-1 w-full min-w-0 px-3 md:px-4 py-4 pb-10">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            A carregar catálogo Excel…
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_min(360px,32%)] gap-4 items-start">
            <PortalTreeGrid
              tree={tree}
              filtroLinha={filtroLinha}
              filtroTipos={filtroTipos}
              search={searchTerm}
              catalogStockContext={catalogStockContext}
              selectedRowId={selectedRow?.id}
              onRowSelect={setSelectedRow}
            />
            <ExcelCatalogDrillPanel row={selectedRow} onClear={() => setSelectedRow(null)} />
          </div>
        )}

        <p className="text-[11px] text-muted-foreground text-center mt-4">
          {linhas.length} LINHA(s)
          {somentePositivos ? ' · só positivos' : ''}
          {estoqueVirtualAtivo ? ' · estoque virtual ~' : ''}
        </p>
      </div>
    </div>
  );
}

export default function CatalogoExcelPage() {
  return <CatalogoExcelInner />;
}
