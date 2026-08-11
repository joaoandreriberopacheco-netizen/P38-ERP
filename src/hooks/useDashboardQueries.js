import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchDashboardVendasPeriodo } from '@/lib/fetchDashboardVendas';
import { normalizeDashboardKpiConfig } from '@/lib/dashboardKpiConfig';
import { fetchDashboardEstoqueMetrics } from '@/lib/dashboardEstoqueData';
import { p38Keys, P38_GC_TIME } from '@/lib/p38QueryConfig';

const DASHBOARD_STALE_TIME = 5 * 60 * 1000;

export function useDashboardVendasQuery(selectedMonthKey, { enabled = true } = {}) {
  return useQuery({
    queryKey: p38Keys.dashboardVendas(selectedMonthKey),
    queryFn: async () => {
      const [configVendaRaw, dashboardData] = await Promise.all([
        base44.entities.ConfiguracoesVenda.list(),
        fetchDashboardVendasPeriodo({ selectedMonthKey }),
      ]);

      return {
        pedidos: dashboardData.pedidos,
        productCostMap: dashboardData.productCostMap,
        kpiConfig: normalizeDashboardKpiConfig(configVendaRaw?.[0] || {}),
      };
    },
    enabled: Boolean(selectedMonthKey) && enabled,
    staleTime: DASHBOARD_STALE_TIME,
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
    staleTime: DASHBOARD_STALE_TIME,
    gcTime: P38_GC_TIME,
  });
}
