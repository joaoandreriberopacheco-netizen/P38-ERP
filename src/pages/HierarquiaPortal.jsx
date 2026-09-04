import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { GlacialTabsList, GlacialTabsTrigger } from '@/components/ui/GlacialTabs';
import { createPageUrl } from '@/components/utils';
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
  enrichSupplyLinesWithMetrics,
} from '@/lib/hierarquiaPortal/buildPortalSupplyHierarchy';
import {
  filterProdutosPortalExcel,
  getPortalCatalogLinhas,
  getPortalCatalogSkuCount,
} from '@/lib/hierarquiaPortal/portalExcelManifest';
import { loadPortalCatalog } from '@/lib/hierarquiaPortal/fetchPortalCatalog';
import PortalTreeGrid from '@/components/hierarquia-portal/PortalTreeGrid';
import PortalSmartSupplyPanel from '@/components/hierarquia-portal/PortalSmartSupplyPanel';
import PortalReservaPanel from '@/components/hierarquia-portal/PortalReservaPanel';
import PortalMassaCriticaRelatorioButton from '@/components/hierarquia-portal/PortalMassaCriticaRelatorioButton';
import PortalTipoFilter from '@/components/hierarquia-portal/PortalTipoFilter';
import PortalCatalogFilters from '@/components/hierarquia-portal/PortalCatalogFilters';
import CadastroProdutoV2Form from '@/components/cadastro-produto-v2/CadastroProdutoV2Form';
import { isProdutoReservaPortal, contagemReservaLine } from '@/lib/hierarquiaPortal/portalReservaCeramica';
import { getDefaultPortalCatalogFilters } from '@/lib/hierarquiaPortal/portalCatalogFilters';
import { filterProdutos, isSomentePositivosFilter, describeProdutoFilters } from '@/lib/filterProdutos';
import { createCatalogStockContext } from '@/lib/catalogEstoqueVirtual';
import { fetchPedidosCompraParaSugestaoEstoque } from '@/lib/fetchPedidosCompraParaSugestaoEstoque';
import { buildPendenteAprovadoFinanceiroPorProduto } from '@/lib/sugestaoCompraEstoquePendente';
import { isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';
import { CADASTRO_PRODUTO_V2_ENABLED } from '@/config/cadastroProdutoV2Flags';
import {
  HIERARQUIA_PORTAL_PILOTO_LINHAS,
} from '@/config/hierarquiaPortalFlags';
import { MODELO_PILOTO_LINHAS_PLANEADAS } from '@/config/modeloCatalogoFlags';
import { matchesLinhaTipoFilter } from '@/lib/smartSupply/linhaTipoFilter';
import {
  NOVO_ECOSSISTEMA_SUBTITLE,
  NOVO_ECOSSISTEMA_TITLE,
} from '@/config/novoEcosistemaFlags';
import { SMART_SUPPLY_PORTAL_PREVIEW_LABEL } from '@/config/smartSupplyFlags';

const PORTAL_TABS = ['cadastro', 'hierarquia', 'supply', 'reserva'];

function resolvePortalTab(tabParam) {
  if (!PORTAL_TABS.includes(tabParam)) {
    return CADASTRO_PRODUTO_V2_ENABLED ? 'cadastro' : 'hierarquia';
  }
  if (tabParam === 'cadastro' && !CADASTRO_PRODUTO_V2_ENABLED) return 'hierarquia';
  return tabParam;
}

function HierarquiaPortalInner() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab = resolvePortalTab(tabParam);

  const setTab = useCallback(
    (value) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!value || value === 'cadastro') next.delete('tab');
          else next.set('tab', value);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const supabaseOk = isSupabaseBrowserConfigured();
  const showCatalogFilters = tab !== 'cadastro';
  const [loading, setLoading] = useState(true);
  const [loadingVelocity, setLoadingVelocity] = useState(true);
  const [produtos, setProdutos] = useState([]);
  const [pedidos90d, setPedidos90d] = useState([]);
  const [filtroLinha, setFiltroLinha] = useState('');
  const [filtroTipos, setFiltroTipos] = useState(() => new Set(['portfolio']));
  const [portalFilters, setPortalFilters] = useState(getDefaultPortalCatalogFilters);
  const [somenteAlerta, setSomenteAlerta] = useState(false);
  const [reservados, setReservados] = useState([]);

  const loadProdutos = useCallback(async () => {
    setLoading(true);
    try {
      await loadPortalCatalog();
      const [activos, todos] = await Promise.all([
        fetchProdutosAtivos(base44),
        fetchAllProdutosCatalogo(),
      ]);
      setProdutos(activos || []);
      const reservaRows = filterProdutosPortalExcel(todos || []).filter((p) => isProdutoReservaPortal(p));
      setReservados(reservaRows);
    } catch (e) {
      console.error('[HierarquiaPortal]', e);
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
        console.error('[HierarquiaPortal] vendas 90d', e);
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
    queryKey: ['portal', 'pendente-estoque'],
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

  const produtosPilotoFiltrados = useMemo(
    () => filterProdutos(produtosPiloto, portalFilters, { salesVelocityMap: velocityMap, catalogStockContext }),
    [produtosPiloto, portalFilters, velocityMap, catalogStockContext],
  );

  const enriched = useMemo(
    () => produtosPilotoFiltrados
      .map((p) => enrichProdutoPortal(p, catalogStockContext))
      .filter((r) => r.fonte_excel),
    [produtosPilotoFiltrados, catalogStockContext],
  );
  const tree = useMemo(() => buildPortalTree(enriched), [enriched]);
  const supplyLines = useMemo(
    () => enrichSupplyLinesWithMetrics(buildPortalSupplyLines(enriched), velocityMap),
    [enriched, velocityMap],
  );
  const linhas = useMemo(() => listPortalLinhas(enriched), [enriched]);

  const reservadosEnriched = useMemo(
    () => reservados
      .map((p) => enrichProdutoPortal(p, catalogStockContext))
      .filter((r) => r.fonte_excel),
    [reservados, catalogStockContext],
  );

  const enrichedComReserva = useMemo(() => {
    const byId = new Map();
    for (const row of enriched) byId.set(row.produto.id, row);
    for (const row of reservadosEnriched) {
      if (!byId.has(row.produto.id)) byId.set(row.produto.id, row);
    }
    return [...byId.values()];
  }, [enriched, reservadosEnriched]);

  const supplyLinesReserva = useMemo(
    () => enrichSupplyLinesWithMetrics(buildPortalSupplyLines(enrichedComReserva), velocityMap),
    [enrichedComReserva, velocityMap],
  );

  const filteredSupply = useMemo(() => {
    let lines = tab === 'reserva' ? supplyLinesReserva : supplyLines;
    if (filtroLinha) lines = lines.filter((l) => l.linha_codigo === filtroLinha);
    if (filtroTipos?.size) lines = lines.filter((l) => matchesLinhaTipoFilter(l.linha_tipo, filtroTipos));
    const q = (portalFilters.searchTerm || '').trim().toLowerCase();
    if (q) {
      lines = lines.filter(
        (l) =>
          l.produto_compra_nome.toLowerCase().includes(q) ||
          l.linha_nome.toLowerCase().includes(q) ||
          l.categoria.toLowerCase().includes(q),
      );
    }
    return lines;
  }, [supplyLines, supplyLinesReserva, tab, filtroLinha, filtroTipos, portalFilters.searchTerm]);

  const excedentesReserva = useMemo(
    () => filteredSupply.filter((line) => contagemReservaLine(line).excedente > 0).length,
    [filteredSupply],
  );

  const tipoCounts = useMemo(() => {
    const counts = { solo: 0, mix: 0, portfolio: 0, portfolio_kit: 0 };
    const source = tab === 'supply' ? supplyLines : linhas;
    for (const l of source) {
      const tipo = l.linha_tipo ?? l.tipo;
      if (tipo === 'portfolio_kit') counts.portfolio_kit += 1;
      else if (counts[tipo] != null) counts[tipo] += 1;
    }
    return counts;
  }, [linhas, supplyLines, tab]);

  const linhasPilotoLabel = HIERARQUIA_PORTAL_PILOTO_LINHAS.map((l) => l.nome).join(' · ');
  const searchTerm = portalFilters.searchTerm || '';
  const somentePositivos = isSomentePositivosFilter(portalFilters);

  const supplyParaRelatorio = useMemo(() => {
    if (tab !== 'supply' || !somenteAlerta) return filteredSupply;
    return filteredSupply.filter((l) => l.alerta);
  }, [filteredSupply, somenteAlerta, tab]);

  const filterSummaryRelatorio = useMemo(() => {
    const parts = [];
    const catalogo = describeProdutoFilters(portalFilters);
    if (catalogo && catalogo !== 'nenhum') parts.push(catalogo);
    if (filtroLinha) {
      const ln = linhas.find((l) => l.codigo === filtroLinha);
      parts.push(`LINHA: ${ln?.nome || filtroLinha}`);
    }
    if (filtroTipos?.size && filtroTipos.size < 3) {
      parts.push(`tipo: ${[...filtroTipos].join(', ')}`);
    }
    if (tab === 'supply' && somenteAlerta) parts.push('só alertas');
    if (tab === 'reserva') parts.push('tab reserva');
    else if (tab === 'supply') parts.push('tab SMART SUPPLY');
    else if (tab === 'hierarquia') parts.push('tab hierarquia');
    return parts.join(' · ') || 'piloto completo';
  }, [portalFilters, filtroLinha, filtroTipos, linhas, somenteAlerta, tab]);

  return (
    <div className="flex flex-col min-h-full w-full max-w-full font-din-1451 bg-background -mx-4 md:-mx-6 tablet-landscape:-mx-7">
      {/* Barra fixa — filtros + tabs (estilo catálogo) */}
      <div className="sticky top-0 z-30 bg-background border-b border-border/40 shadow-sm">
        <div className="w-full px-3 md:px-4 py-3 space-y-3">
          <div className="flex flex-wrap items-start gap-3 justify-between">
            <div className="space-y-1 min-w-0">
              <Button variant="ghost" size="sm" className="h-8 -ml-2 gap-1 text-muted-foreground" asChild>
                <Link to={createPageUrl('Compras')}>
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Voltar a Compras
                </Link>
              </Button>
              <h1 className="text-xl md:text-2xl font-semibold font-glacial text-foreground">
                {NOVO_ECOSSISTEMA_TITLE}
              </h1>
              <p className="text-sm text-muted-foreground max-w-3xl hidden md:block">
                {NOVO_ECOSSISTEMA_SUBTITLE}
              </p>
            </div>
            <div className="rounded-lg border border-violet-500/40 bg-violet-50/80 dark:bg-violet-950/30 px-3 py-2 text-xs text-violet-900 dark:text-violet-100 max-w-sm space-y-1 shrink-0">
              <p>
                <strong>Piloto:</strong> {enriched.length}
                {produtosPilotoFiltrados.length !== produtosPiloto.length && (
                  <span className="opacity-80"> / {produtosPiloto.length}</span>
                )}
                {' '}SKUs{estoqueVirtualAtivo ? ' ~' : ''} · {linhasPilotoLabel}
              </p>
              <p className="opacity-80 hidden sm:block">
                Em breve: {MODELO_PILOTO_LINHAS_PLANEADAS.map((l) => l.nome).join(' · ')}
              </p>
            </div>
          </div>

          {showCatalogFilters && (
            <PortalTipoFilter activeTipos={filtroTipos} onChange={setFiltroTipos} counts={tipoCounts} />
          )}

          {showCatalogFilters && (
          <PortalCatalogFilters
            filters={portalFilters}
            setFilters={setPortalFilters}
            filtroLinha={filtroLinha}
            onFiltroLinhaChange={(v) => setFiltroLinha(v === 'all' ? '' : v)}
            linhas={linhas}
            extra={(
              <>
                {tab === 'supply' && (
                  <Button
                    variant={somenteAlerta ? 'secondary' : 'outline'}
                    size="sm"
                    className="h-9"
                    onClick={() => setSomenteAlerta((v) => !v)}
                  >
                    Só alertas
                  </Button>
                )}
                {tab === 'reserva' && excedentesReserva > 0 && (
                  <span className="text-xs text-amber-800 dark:text-amber-200 px-2 py-1 rounded bg-amber-100/80 dark:bg-amber-950/40">
                    {excedentesReserva} esquadra(s) acima de 12 pos.
                  </span>
                )}
                {tab !== 'cadastro' && (
                  <PortalMassaCriticaRelatorioButton
                    filteredSupply={supplyParaRelatorio}
                    filterSummary={filterSummaryRelatorio}
                    disabled={loading}
                  />
                )}
              </>
            )}
          />
          )}

          <GlacialTabsList className="w-full">
            {CADASTRO_PRODUTO_V2_ENABLED && (
              <GlacialTabsTrigger
                value="cadastro"
                activeValue={tab}
                onSelect={setTab}
                label="Cadastro (eixos)"
              />
            )}
            <GlacialTabsTrigger
              value="hierarquia"
              activeValue={tab}
              onSelect={setTab}
              label="Hierarquia"
            />
            <GlacialTabsTrigger
              value="supply"
              activeValue={tab}
              onSelect={setTab}
              label={SMART_SUPPLY_PORTAL_PREVIEW_LABEL}
            />
            <GlacialTabsTrigger
              value="reserva"
              activeValue={tab}
              onSelect={setTab}
              label="Reserva (12 pos.)"
            />
          </GlacialTabsList>
        </div>
      </div>

      {/* Conteúdo — scroll da página (sem caixa max-h) */}
      <div className="flex-1 w-full min-w-0 px-3 md:px-4 py-4 pb-10">
        {tab === 'cadastro' ? (
          !CADASTRO_PRODUTO_V2_ENABLED ? (
            <div className="p-8 text-center text-muted-foreground">Cadastro com eixos indisponível.</div>
          ) : !supabaseOk ? (
            <div className="p-8 text-center text-muted-foreground">
              Supabase não configurado — cadastro com eixos indisponível.
            </div>
          ) : (
            <div className="max-w-5xl mx-auto">
              <CadastroProdutoV2Form />
            </div>
          )
        ) : loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Montando {NOVO_ECOSSISTEMA_TITLE}…
          </div>
        ) : tab === 'hierarquia' ? (
          <PortalTreeGrid
            tree={tree}
            filtroLinha={filtroLinha}
            filtroTipos={filtroTipos}
            search={searchTerm}
            catalogStockContext={catalogStockContext}
          />
        ) : tab === 'supply' ? (
          <PortalSmartSupplyPanel
            supplyLines={filteredSupply}
            flatLines={filteredSupply}
            somenteAlerta={somenteAlerta}
            loadingVelocity={loadingVelocity}
            velocityMap={velocityMap}
          />
        ) : (
          <PortalReservaPanel
            supplyLines={filteredSupply}
            reservadosEnriched={reservadosEnriched}
            onRefresh={loadProdutos}
          />
        )}

        {tab !== 'cadastro' && (
        <p className="text-[11px] text-muted-foreground text-center mt-4">
          {enriched.length} SKUs visíveis
          {produtosPiloto.length !== enriched.length ? ` (${produtosPiloto.length} no piloto)` : ''}
          · {supplyLines.length} esquadras · {getPortalCatalogLinhas().length} LINHAS
          {somentePositivos ? ' · só positivos' : ''}
          {estoqueVirtualAtivo ? ' · estoque virtual ~' : ''}
        </p>
        )}
      </div>
    </div>
  );
}

export default function HierarquiaPortalPage() {
  return <HierarquiaPortalInner />;
}
