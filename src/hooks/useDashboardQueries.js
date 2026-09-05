import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchDashboardVendasPeriodo, fetchProdutosCustoPorIds } from '@/lib/fetchDashboardVendas';
import { fetchPedidosOrigemTrocaMargem } from '@/lib/fetchPedidosVenda90d';
import { buildProdutosMargemFromCostMap, isMonthCoveredAteOntem } from '@/lib/dashboardMargemVendasSealed';
import { getDashboardEstoqueStaleTime, getDashboardVendasStaleTime } from '@/lib/dashboardIncrementalCache';
import { getMonthBucketsEndingAt } from '@/lib/dashboardVendasPeriod';
import { normalizeDashboardKpiConfig } from '@/lib/dashboardKpiConfig';
import {
  fetchDashboardEstoqueHistorico,
  fetchDashboardEstoqueResumo,
} from '@/lib/dashboardEstoqueData';
import { p38Keys, P38_GC_TIME, P38_STALE_TIME } from '@/lib/p38QueryConfig';

function collectProdutoIdsFromPedidosMap(pedidosMap = {}) {
  const ids = new Set();
  for (const pedido of Object.values(pedidosMap)) {
    for (const item of pedido?.itens || []) {
      const pid = item?.produto_id ?? item?.produtoId;
      if (pid) ids.add(pid);
    }
  }
  return [...ids];
}

async function buildProdutosMargemForDashboard(dashboardData, pedidosOrigemTroca = {}) {
  const costMap = new Map(dashboardData.productCostMap || []);
  const missingIds = collectProdutoIdsFromPedidosMap(pedidosOrigemTroca).filter((id) => !costMap.has(id));

  if (missingIds.length) {
    const extraCosts = await fetchProdutosCustoPorIds(missingIds);
    for (const [id, cost] of extraCosts.entries()) {
      costMap.set(id, cost);
    }
  }

  return buildProdutosMargemFromCostMap(costMap);
}

function pedidosPrecisamDevolucoesTroca(pedidos = []) {
  return (pedidos || []).some((pedido) => {
    const tipo = String(pedido?.tipo ?? pedido?.dados?.tipo ?? '').toLowerCase();
    const status = String(pedido?.status ?? pedido?.dados?.status ?? '').toLowerCase();
    return tipo.includes('troca') || tipo.includes('devolu') || status.includes('troca') || status.includes('devolu');
  });
}

function passadoAteOntemCobertoPorSnapshots(sealedMonths = {}, selectedMonthKey, months = 6) {
  const buckets = getMonthBucketsEndingAt(selectedMonthKey, months);
  if (!buckets.length) return false;
  return buckets.every((b) => isMonthCoveredAteOntem(b.key, sealedMonths));
}

async function ensureConfiguracoesVenda(queryClient) {
  return queryClient.ensureQueryData({
    queryKey: p38Keys.dashboardConfigVenda(),
    queryFn: () => base44.entities.ConfiguracoesVenda.list(),
    staleTime: P38_STALE_TIME,
  });
}

/** Carga completa da aba Vendas — exportada para prefetch no shell do Dashboard. */
export async function fetchDashboardVendasBundle(selectedMonthKey, queryClient) {
  const [dashboardData, configVendaRaw] = await Promise.all([
    fetchDashboardVendasPeriodo({ selectedMonthKey, queryClient }),
    ensureConfiguracoesVenda(queryClient),
  ]);

  const pedidos = dashboardData.pedidos || [];
  const podeOmitirDevolucoes =
    passadoAteOntemCobertoPorSnapshots(dashboardData.sealedMonths, selectedMonthKey)
    && !pedidosPrecisamDevolucoesTroca(pedidos);

  let devolucoes = [];
  let pedidosOrigemTroca = {};

  if (!podeOmitirDevolucoes) {
    const devolucoesTroca = await base44.entities.DevolucaoTroca.list('-created_date', 200);
    devolucoes = Array.isArray(devolucoesTroca) ? devolucoesTroca : [];
    pedidosOrigemTroca = await fetchPedidosOrigemTrocaMargem(devolucoes);
  }

  const produtos = await buildProdutosMargemForDashboard(dashboardData, pedidosOrigemTroca);

  return {
    pedidos,
    sealedMonths: dashboardData.sealedMonths,
    productCostMap: dashboardData.productCostMap,
    produtos,
    devolucoesTroca: devolucoes,
    pedidosOrigemTroca,
    kpiConfig: normalizeDashboardKpiConfig(configVendaRaw?.[0] || {}),
  };
}

export function useDashboardVendasQuery(selectedMonthKey, { enabled = true } = {}) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: p38Keys.dashboardVendas(selectedMonthKey),
    queryFn: () => fetchDashboardVendasBundle(selectedMonthKey, queryClient),
    enabled: Boolean(selectedMonthKey) && enabled,
    staleTime: getDashboardVendasStaleTime(selectedMonthKey),
    gcTime: P38_GC_TIME,
    placeholderData: keepPreviousData,
  });
}

/** Cards rápidos: qualidade + localização (~2–3 s). */
export function useDashboardEstoqueResumoQuery({ enabled = true } = {}) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: p38Keys.dashboardEstoqueResumo(),
    queryFn: () => fetchDashboardEstoqueResumo(queryClient),
    enabled,
    staleTime: getDashboardEstoqueStaleTime(),
    gcTime: P38_GC_TIME,
  });
}

/** Gráficos pesados: nível mensal + razão de abastecimento. */
export function useDashboardEstoqueHistoricoQuery({ enabled = true } = {}) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: p38Keys.dashboardEstoqueHistorico(),
    queryFn: () => fetchDashboardEstoqueHistorico(queryClient),
    enabled,
    staleTime: getDashboardEstoqueStaleTime(),
    gcTime: P38_GC_TIME,
  });
}

/** @deprecated Preferir resumo + histórico separados na EstoqueTab. */
export function useDashboardEstoqueQuery({ enabled = true } = {}) {
  const resumo = useDashboardEstoqueResumoQuery({ enabled });
  const historico = useDashboardEstoqueHistoricoQuery({ enabled });

  return {
    data: resumo.data && historico.data ? { ...resumo.data, ...historico.data } : null,
    isLoading: resumo.isLoading || historico.isLoading,
    isFetching: resumo.isFetching || historico.isFetching,
    error: resumo.error || historico.error,
  };
}
