import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  listarCentrosCustoRegistros,
  listarContasFinanceiras,
  listarLancamentosCompetencia,
  listarLancamentosRecorrentes,
  listarModelos,
} from '@/lib/agefinPrevisaoService';
import { listarParcelamentos } from '@/lib/agefinParcelamentoService';
import { listarOverridesCompetenciaMes, mapaOverridesCompetenciaMes } from '@/lib/agefinCompetenciaMesService';
import { listarCategoriasDespesa } from '@/lib/budgetService';
import { agefinQueryKeys } from '../constants/queryKeys';

const STALE_MODELOS = 60_000;
const STALE_PADRAO = 60_000;
const STALE_CONTAS = 300_000;

/**
 * Carrega só o necessário para a aba activa.
 * - contas: modelos (séries) + centros + categorias — fonte de verdade da recorrência
 * - previsao: + lançamentos do mês + parcelamentos + recorrentes (projeção virtual do mês)
 * - projecao: modelos + recorrentes
 * - contas financeiras: só quando o drawer pede sync
 */
export function useAgefinPrevisaoQueries({ abaAtiva, competenciaMes, precisaContas = false }) {
  const precisaCentros = abaAtiva === 'contas' || abaAtiva === 'previsao';
  const precisaCategorias = precisaCentros;
  const precisaLancamentos = abaAtiva === 'previsao';
  const precisaParcelamentos = abaAtiva === 'previsao';
  const precisaRecorrentes = abaAtiva === 'projecao' || abaAtiva === 'previsao';
  const precisaOverridesCompetencia = abaAtiva === 'previsao';

  const modelosQuery = useQuery({
    queryKey: agefinQueryKeys.modelos,
    queryFn: listarModelos,
    staleTime: STALE_MODELOS,
    refetchOnWindowFocus: true,
  });

  const centrosQuery = useQuery({
    queryKey: agefinQueryKeys.centros,
    queryFn: listarCentrosCustoRegistros,
    enabled: precisaCentros,
    staleTime: STALE_PADRAO,
  });

  const categoriasQuery = useQuery({
    queryKey: agefinQueryKeys.categorias,
    queryFn: listarCategoriasDespesa,
    enabled: precisaCategorias,
    staleTime: STALE_PADRAO,
  });

  const lancamentosQuery = useQuery({
    queryKey: agefinQueryKeys.lancamentos(competenciaMes),
    queryFn: () => listarLancamentosCompetencia(competenciaMes),
    enabled: precisaLancamentos,
    staleTime: STALE_PADRAO,
  });

  const parcelamentosQuery = useQuery({
    queryKey: agefinQueryKeys.parcelamentos,
    queryFn: listarParcelamentos,
    enabled: precisaParcelamentos,
    staleTime: STALE_PADRAO,
  });

  const overridesCompetenciaQuery = useQuery({
    queryKey: agefinQueryKeys.overridesCompetencia,
    queryFn: listarOverridesCompetenciaMes,
    enabled: precisaOverridesCompetencia,
    staleTime: STALE_PADRAO,
  });

  const recorrentesQuery = useQuery({
    queryKey: agefinQueryKeys.recorrentes,
    queryFn: listarLancamentosRecorrentes,
    enabled: precisaRecorrentes,
    staleTime: STALE_PADRAO,
  });

  const contasQuery = useQuery({
    queryKey: agefinQueryKeys.contas,
    queryFn: listarContasFinanceiras,
    enabled: precisaContas,
    staleTime: STALE_CONTAS,
  });

  const centrosRegistrados = useMemo(
    () =>
      [...(centrosQuery.data || [])]
        .filter((row) => row?.ativo !== false)
        .map((row) => String(row?.nome || '').trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })),
    [centrosQuery.data],
  );

  const overridesPorSerie = useMemo(
    () => mapaOverridesCompetenciaMes(overridesCompetenciaQuery.data, competenciaMes),
    [overridesCompetenciaQuery.data, competenciaMes],
  );

  return {
    modelos: modelosQuery.data ?? [],
    loadingModelos: modelosQuery.isLoading,
    centrosCustoRegistros: centrosQuery.data ?? [],
    centrosRegistrados,
    refetchCentros: centrosQuery.refetch,
    categorias: categoriasQuery.data ?? [],
    refetchCategorias: categoriasQuery.refetch,
    lancamentosMes: lancamentosQuery.data ?? [],
    loadingLancamentos: lancamentosQuery.isLoading,
    refetchLancamentos: lancamentosQuery.refetch,
    parcelamentos: parcelamentosQuery.data ?? [],
    overridesCompetencia: overridesCompetenciaQuery.data ?? [],
    overridesPorSerie,
    refetchOverridesCompetencia: overridesCompetenciaQuery.refetch,
    lancamentosRecorrentes: recorrentesQuery.data ?? [],
    loadingRecorrentes: recorrentesQuery.isLoading,
    contas: contasQuery.data ?? [],
    loadingContas: contasQuery.isLoading,
  };
}
