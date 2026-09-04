import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchDashboardVendasPeriodo } from '@/lib/fetchDashboardVendas';
import { fetchPedidosOrigemTrocaMargem } from '@/lib/fetchPedidosVenda90d';
import { fetchAllProdutosCatalogo } from '@/lib/fetchProdutosAtivos';
import { buildProdutosMargemFromCostMap } from '@/lib/dashboardMargemVendasSealed';
import { getDashboardEstoqueStaleTime, getDashboardVendasStaleTime } from '@/lib/dashboardIncrementalCache';
import { normalizeDashboardKpiConfig } from '@/lib/dashboardKpiConfig';
import { fetchDashboardEstoqueMetrics } from '@/lib/dashboardEstoqueData';
import { p38Keys, P38_GC_TIME } from '@/lib/p38QueryConfig';

export function useDashboardVendasQuery(selectedMonthKey, { enabled = true } = {}) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: p38Keys.dashboardVendas(selectedMonthKey),
    queryFn: async () => {
      const dashboardData = await fetchDashboardVendasPeriodo({ selectedMonthKey, queryClient });
      const sealedCount = Object.keys(dashboardData.sealedMonths || {}).length;
      const pedidosCount = dashboardData.pedidos?.length || 0;
      const useLightCatalog = sealedCount > 0 && pedidosCount <= 300;

      const [configVendaRaw, produtos, devolucoesTroca] = await Promise.all([
        base44.entities.ConfiguracoesVenda.list(),
        useLightCatalog
          ? Promise.resolve(buildProdutosMargemFromCostMap(dashboardData.productCostMap))
          : fetchAllProdutosCatalogo(),
        base44.entities.DevolucaoTroca.list('-created_date', 500),
      ]);

      const pedidosOrigemTroca = await fetchPedidosOrigemTrocaMargem(
        Array.isArray(devolucoesTroca) ? devolucoesTroca : [],
      );

      return {
        pedidos: dashboardData.pedidos,
        sealedMonths: dashboardData.sealedMonths,
        productCostMap: dashboardData.productCostMap,
        produtos,
        devolucoesTroca: Array.isArray(devolucoesTroca) ? devolucoesTroca : [],
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
