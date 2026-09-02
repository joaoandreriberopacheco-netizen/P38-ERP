import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { obterLucroBrutoCompetencia } from '@/lib/budgetService';
import { competenciaMargemPodeUsarSnapshot } from '@/lib/margemCompetenciaSnapshot';
import { p38Keys, P38_GC_TIME, P38_STALE_TIME } from '@/lib/p38QueryConfig';

/**
 * Lucro bruto do mês (base Relatório de Margem).
 * Cache partilhado entre Dízimo, Budgets e Visão Financeira.
 * Meses fechados: snapshot persistido (Supabase) — não refetch.
 */
export function useLucroBrutoCompetencia(competencia, { enabled = true } = {}) {
  const prefix = String(competencia || '').slice(0, 7);
  const mesFechado = competenciaMargemPodeUsarSnapshot(prefix);

  return useQuery({
    queryKey: p38Keys.lucroBrutoCompetencia(prefix),
    queryFn: () => obterLucroBrutoCompetencia(prefix),
    enabled: Boolean(prefix) && enabled,
    staleTime: mesFechado ? Number.POSITIVE_INFINITY : P38_STALE_TIME,
    gcTime: P38_GC_TIME,
    placeholderData: keepPreviousData,
  });
}
