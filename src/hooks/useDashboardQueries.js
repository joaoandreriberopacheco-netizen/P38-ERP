import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchDashboardVendasPeriodo, fetchProdutosCustoPorIds } from '@/lib/fetchDashboardVendas';
import { fetchPedidosOrigemTrocaMargem } from '@/lib/fetchPedidosVenda90d';
import { buildProdutosMargemFromCostMap } from '@/lib/dashboardMargemVendasSealed';
import { getDashboardEstoqueStaleTime, getDashboardVendasStaleTime } from '@/lib/dashboardIncrementalCache';
import { normalizeDashboardKpiConfig } from '@/lib/dashboardKpiConfig';
import { fetchDashboardEstoqueMetrics } from '@/lib/dashboardEstoqueData';
import { p38Keys, P38_GC_TIME } from '@/lib/p38QueryConfig';

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

export function useDashboardVendasQuery(selectedMonthKey, { enabled = true } = {}) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: p38Keys.dashboardVendas(selectedMonthKey),
    queryFn: async () => {
      const [dashboardData, configVendaRaw, devolucoesTroca] = await Promise.all([
        fetchDashboardVendasPeriodo({ selectedMonthKey, queryClient }),
        base44.entities.ConfiguracoesVenda.list(),
        base44.entities.DevolucaoTroca.list('-created_date', 500),
      ]);

      const devolucoes = Array.isArray(devolucoesTroca) ? devolucoesTroca : [];
      const pedidosOrigemTroca = await fetchPedidosOrigemTrocaMargem(devolucoes);
      const produtos = await buildProdutosMargemForDashboard(dashboardData, pedidosOrigemTroca);

      return {
        pedidos: dashboardData.pedidos,
        sealedMonths: dashboardData.sealedMonths,
        productCostMap: dashboardData.productCostMap,
        produtos,
        devolucoesTroca: devolucoes,
        pedidosOrigemTroca,
        kpiConfig: normalizeDashboardKpiConfig(configVendaRaw?.[0] || {}),
      };
    },
    enabled: Boolean(selectedMonthKey) && enabled,
    staleTime: getDashboardVendasStaleTime(selectedMonthKey),
    gcTime: P38_GC_TIME,
    placeholderData: keepPreviousData,
  });
}

export function useDashboardEstoqueQuery({ enabled = true } = {}) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: p38Keys.dashboardEstoque(),
    queryFn: () => fetchDashboardEstoqueMetrics(queryClient),
    enabled,
    staleTime: getDashboardEstoqueStaleTime(),
    gcTime: P38_GC_TIME,
  });
}
