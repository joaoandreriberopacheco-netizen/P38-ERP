import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchDashboardVendasPeriodo } from '@/lib/fetchDashboardVendas';
import {
  getDashboardEstoqueStaleTime,
  getDashboardVendasStaleTime,
} from '@/lib/dashboardIncrementalCache';
import { normalizeDashboardKpiConfig } from '@/lib/dashboardKpiConfig';
import { fetchDashboardEstoqueMetrics } from '@/lib/dashboardEstoqueData';
import { p38Keys, P38_GC_TIME } from '@/lib/p38QueryConfig';

export function useDashboardVendasQuery(selectedMonthKey, { enabled = true } = {}) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: p38Keys.dashboardVendas(selectedMonthKey),
    queryFn: async () => {
      const [configVendaRaw, dashboardData] = await Promise.all([
        base44.entities.ConfiguracoesVenda.list(),
        fetchDashboardVendasPeriodo({ selectedMonthKey, queryClient }),
      ]);

      return {
        pedidos: dashboardData.pedidos,
        productCostMap: dashboardData.productCostMap,
        sealedMonths: dashboardData.sealedMonths || {},
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
