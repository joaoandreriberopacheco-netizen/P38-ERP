import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { obterLucroBrutoCompetencia } from '@/lib/budgetService';
import { p38Keys, P38_GC_TIME, P38_STALE_TIME } from '@/lib/p38QueryConfig';

/**
 * Lucro bruto do mês (base Relatório de Margem).
 * Cache partilhado entre Dízimo, Budgets e Visão Financeira.
 */
export function useLucroBrutoCompetencia(competencia, { enabled = true } = {}) {
  return useQuery({
    queryKey: p38Keys.lucroBrutoCompetencia(competencia),
    queryFn: () => obterLucroBrutoCompetencia(competencia),
    enabled: Boolean(competencia) && enabled,
    staleTime: P38_STALE_TIME,
    gcTime: P38_GC_TIME,
    placeholderData: keepPreviousData,
  });
}
