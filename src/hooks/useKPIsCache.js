import { useQueryClient } from '@tanstack/react-query';
import { useHomeVendasHojeQuery } from '@/hooks/useP38Entities';
import { p38Keys } from '@/lib/p38QueryConfig';

const DEFAULT_VENDAS_HOJE = {
  vendasHoje: 0,
  valorVendasHoje: 0,
};

/**
 * Resumo de vendas da Home — cache via React Query.
 * @deprecated Preferir useHomeVendasHojeQuery em código novo.
 */
export function useKPIsCache(options = {}) {
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching, refetch } = useHomeVendasHojeQuery(options);

  return {
    kpis: data ?? DEFAULT_VENDAS_HOJE,
    isLoading,
    isFetching,
    isPending: isLoading,
    hasData: data != null,
    loadKPIs: refetch,
    clearCache: () => {
      queryClient.removeQueries({ queryKey: [...p38Keys.all, 'home-vendas-hoje'] });
      queryClient.removeQueries({ queryKey: [...p38Keys.all, 'home-kpis'] });
    },
  };
}
