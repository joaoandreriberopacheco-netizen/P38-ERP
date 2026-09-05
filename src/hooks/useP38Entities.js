import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, subDays, addDays } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { p38Keys, P38_GC_TIME, P38_STALE_TIME } from '@/lib/p38QueryConfig';
import { enrichProdutosComIep } from '@/lib/calcularIepProdutos';
import {
  fetchDadosVendaAbcd90d,
  fetchPedidosVenda90d,
} from '@/lib/fetchPedidosVenda90d';
import { hydratePedidosVendaItensFromSql } from '@/lib/fetchPedidoVendaItens';
import {
  fetchHomeKpis as fetchHomeKpisLight,
  fetchHomeVendasHoje,
  fetchPedidosAguardandoCaixaCount,
} from '@/lib/fetchHomeKpis';
import {
  fetchPedidosVendaGestaoHeaders,
  fetchRascunhosPedidoVendaGestaoHeaders,
  isValidGestaoDateKey,
} from '@/lib/fetchPedidosVendaGestao';
import { keepPreviousData } from '@tanstack/react-query';

export { fetchPedidosVenda90d, fetchDadosVendaAbcd90d };
import { unifyLogisticaEventos } from '@/components/logistica-sandbox/fluvialDataUtils';
import { dataHoje } from '@/components/utils/dateUtils';
import { getGestaoDateRangeStaleTime } from '@/lib/p38GestaoCache';
import { fetchPedidosCompraGestaoCompleto, fetchPedidosCompraGestaoListaRapida } from '@/lib/fetchPedidosCompraGestaoCompleto';
import { sincronizarPedidosCompraAprovacaoPendente } from '@/lib/fetchPedidosCompraGestaoSync';
import { fetchProdutosPdvCatalogo, searchClientesPdv } from '@/lib/fetchPdvCatalogo';
import { readCatalogoAnotacaoVersion, readComprasAnotacaoResumo } from '@/lib/p38AnotacaoApi';

const entityQueryDefaults = {
  staleTime: P38_STALE_TIME,
  gcTime: P38_GC_TIME,
};

export function fetchProdutosList(sort = '-created_date') {
  return base44.entities.Produto.list(sort);
}

export function fetchTerceirosList() {
  return base44.entities.Terceiro.list();
}

export function fetchFornecedores() {
  return base44.entities.Terceiro.filter({ $or: [{ tipo: 'Fornecedor' }, { tipo: 'Ambos' }] });
}

export function fetchProdutosAtivosPdv() {
  return base44.entities.Produto.filter({ ativo: true });
}

export function fetchClientesPdv() {
  return base44.entities.Terceiro.filter({ tipo: ['Cliente', 'Ambos'] });
}

export async function fetchPedidosVendaList(sort = '-created_date') {
  const pedidos = await base44.entities.PedidoVenda.list(sort);
  return hydratePedidosVendaItensFromSql(base44, pedidos);
}

export function fetchRascunhosPedidoVendaList(sort = '-created_date') {
  return base44.entities.RascunhoPedidoVenda.list(sort);
}

export async function fetchHomeKpis(dateKey, _queryClient) {
  return fetchHomeKpisLight(dateKey);
}

export { fetchHomeVendasHoje, fetchPedidosAguardandoCaixaCount };

const homeQueryDefaults = {
  staleTime: 60 * 1000,
  gcTime: P38_GC_TIME,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
};

export function useHomeVendasHojeQuery(options = {}) {
  const dateKey = dataHoje();
  const { enabled = true, ...rest } = options;

  return useQuery({
    queryKey: p38Keys.homeVendasHoje(dateKey),
    queryFn: () => fetchHomeVendasHoje(dateKey),
    enabled,
    ...homeQueryDefaults,
    ...rest,
  });
}

export function useHomePedidosPendentesQuery(options = {}) {
  const { enabled = true, ...rest } = options;

  return useQuery({
    queryKey: p38Keys.homePedidosPendentes(),
    queryFn: fetchPedidosAguardandoCaixaCount,
    enabled,
    ...homeQueryDefaults,
    ...rest,
  });
}

export function useProdutosListQuery(options = {}) {
  const sort = options.sort ?? '-created_date';
  const { sort: _sort, enrichIep = false, ...rest } = options;
  return useQuery({
    queryKey: enrichIep ? [...p38Keys.produtos(sort), 'iep-enriched'] : p38Keys.produtos(sort),
    queryFn: () => fetchProdutosList(sort),
    ...entityQueryDefaults,
    ...rest,
  });
}

/** Versão do catálogo (anotação Supabase) — invalida cache PDV quando produtos mudam. */
export function useCatalogoAnotacaoVersionQuery(options = {}) {
  const { enabled = true, ...rest } = options;
  return useQuery({
    queryKey: [...p38Keys.all, 'catalogo-anotacao-version'],
    queryFn: readCatalogoAnotacaoVersion,
    staleTime: 2 * 60 * 1000,
    gcTime: P38_GC_TIME,
    enabled,
    ...rest,
  });
}

/** Catálogo PDV — Supabase SQL (Fase 7) com fallback Base44; cache 2 min. */
export function useProdutosPdvCatalogoQuery(options = {}) {
  const { enabled = true, ...rest } = options;
  const versionQuery = useCatalogoAnotacaoVersionQuery({ enabled });
  const catalogVersion = versionQuery.data ?? 'v0';

  return useQuery({
    queryKey: [...p38Keys.produtosAtivosPdv(), 'sql', catalogVersion],
    queryFn: fetchProdutosPdvCatalogo,
    enabled,
    ...entityQueryDefaults,
    ...rest,
  });
}

/** @deprecated Preferir useProdutosPdvCatalogoQuery */
export function useProdutosAtivosPdvQuery(options = {}) {
  return useProdutosPdvCatalogoQuery(options);
}

/** Busca de clientes PDV sob demanda (≥2 caracteres). */
export function useClientesPdvSearchQuery(term, options = {}) {
  const trimmed = String(term || '').trim();
  const { enabled = true, ...rest } = options;

  return useQuery({
    queryKey: [...p38Keys.clientesPdv(), 'search', trimmed],
    queryFn: () => searchClientesPdv(trimmed),
    enabled: enabled && trimmed.length >= 2,
    staleTime: 60 * 1000,
    gcTime: P38_GC_TIME,
    ...rest,
  });
}

export function useClientesPdvQuery(options = {}) {
  return useQuery({
    queryKey: p38Keys.clientesPdv(),
    queryFn: () => searchClientesPdv(''),
    enabled: false,
    ...entityQueryDefaults,
    ...options,
  });
}

export function usePedidosCompraGestaoInicialQuery(options = {}) {
  const { enabled = true, fetchFilters = {}, ...rest } = options;
  const queryClient = useQueryClient();
  const resumoQuery = useQuery({
    queryKey: [...p38Keys.all, 'compras-anotacao-resumo'],
    queryFn: readComprasAnotacaoResumo,
    staleTime: 2 * 60 * 1000,
    gcTime: P38_GC_TIME,
    enabled,
  });
  const comprasVersion = resumoQuery.data?.comprasVersion ?? 'v0';
  const fetchFiltersKey = JSON.stringify(fetchFilters);

  const listaQuery = useQuery({
    queryKey: [...p38Keys.pedidosCompraGestaoInicial(), comprasVersion, 'lista', fetchFiltersKey],
    queryFn: () => fetchPedidosCompraGestaoListaRapida(base44, fetchFilters),
    staleTime: P38_STALE_TIME,
    gcTime: P38_GC_TIME,
    enabled,
    ...rest,
  });

  const completoQuery = useQuery({
    queryKey: [...p38Keys.pedidosCompraGestaoInicial(), comprasVersion, 'completo', fetchFiltersKey],
    queryFn: () => fetchPedidosCompraGestaoCompleto(base44, { deferSyncAprovacao: true, fetchFilters }),
    staleTime: P38_STALE_TIME,
    gcTime: P38_GC_TIME,
    enabled: enabled && Boolean(listaQuery.data),
    ...rest,
  });

  useQuery({
    queryKey: [...p38Keys.pedidosCompraGestaoInicial(), comprasVersion, 'sync-aprovacao', fetchFiltersKey],
    queryFn: async () => {
      const current = queryClient.getQueryData([
        ...p38Keys.pedidosCompraGestaoInicial(),
        comprasVersion,
        'completo',
        fetchFiltersKey,
      ]);
      if (!current?.pedidos?.length) return null;
      const pedidosSync = await sincronizarPedidosCompraAprovacaoPendente(base44, current.pedidos);
      queryClient.setQueryData(
        [...p38Keys.pedidosCompraGestaoInicial(), comprasVersion, 'completo', fetchFiltersKey],
        (old) => (old ? { ...old, pedidos: pedidosSync, needsSyncAprovacao: false } : old),
      );
      return pedidosSync;
    },
    enabled: enabled && Boolean(completoQuery.data?.needsSyncAprovacao),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: P38_GC_TIME,
  });

  const data = completoQuery.data ?? listaQuery.data;
  const isLoading = listaQuery.isLoading && !data;

  return {
    ...listaQuery,
    data,
    isLoading,
    isFetching: listaQuery.isFetching || completoQuery.isFetching,
    isEnriching: Boolean(listaQuery.data && completoQuery.isFetching && !completoQuery.data),
    resumoCompras: resumoQuery.data,
  };
}

export function usePedidosVenda90dQuery(options = {}) {
  const queryClient = useQueryClient();
  const cachedPedidos = queryClient.getQueryData(p38Keys.dadosVendaAbcd90d())?.pedidos90d;

  return useQuery({
    queryKey: p38Keys.pedidosVenda90d(),
    queryFn: fetchPedidosVenda90d,
    staleTime: 10 * 60 * 1000,
    gcTime: P38_GC_TIME,
    enabled: (options.enabled ?? true) && !cachedPedidos?.length,
    placeholderData: cachedPedidos,
    ...options,
  });
}

export function useDadosVendaAbcd90dQuery(options = {}) {
  return useQuery({
    queryKey: p38Keys.dadosVendaAbcd90d(),
    queryFn: fetchDadosVendaAbcd90d,
    staleTime: 10 * 60 * 1000,
    gcTime: P38_GC_TIME,
    retry: 2,
    ...options,
  });
}

/** Catálogo — métricas IEP ao vivo; curva ABCD vem do cadastro SQL (`produto.abcd`). */
export function useProdutosComIepQuery(options = {}) {
  const sort = options.sort ?? '-created_date';
  const { sort: _sort, needsIep = true, ...rest } = options;
  const produtosQuery = useProdutosListQuery({ sort, ...rest });
  const vendasQuery = useDadosVendaAbcd90dQuery({
    enabled: (rest.enabled ?? true) && needsIep && Boolean(produtosQuery.data?.length),
  });

  const data = useMemo(() => {
    if (!produtosQuery.data?.length) return produtosQuery.data ?? [];
    if (!needsIep) return produtosQuery.data;
    const vendas = vendasQuery.data;
    if (!vendas?.pedidos90d) {
      return produtosQuery.data;
    }
    return enrichProdutosComIep(produtosQuery.data, vendas);
  }, [produtosQuery.data, vendasQuery.data, needsIep]);

  return {
    ...produtosQuery,
    data,
    isLoading: produtosQuery.isLoading || (needsIep && vendasQuery.isLoading),
    isFetching: produtosQuery.isFetching || (needsIep && vendasQuery.isFetching),
  };
}

export function useFornecedoresQuery(options = {}) {
  return useQuery({
    queryKey: p38Keys.fornecedores(),
    queryFn: fetchFornecedores,
    ...entityQueryDefaults,
    ...options,
  });
}

export function useTerceirosListQuery(options = {}) {
  return useQuery({
    queryKey: p38Keys.terceiros(),
    queryFn: fetchTerceirosList,
    ...entityQueryDefaults,
    ...options,
  });
}

export function usePedidosVendaListQuery(options = {}) {
  const sort = options.sort ?? '-created_date';
  const { sort: _sort, ...rest } = options;
  return useQuery({
    queryKey: p38Keys.pedidosVenda(sort),
    queryFn: () => fetchPedidosVendaList(sort),
    ...entityQueryDefaults,
    ...rest,
  });
}

export function usePedidosVendaGestaoQuery({ dataInicio, dataFim, enabled = true, ...rest } = {}) {
  const datesOk = isValidGestaoDateKey(dataInicio) && isValidGestaoDateKey(dataFim);
  return useQuery({
    queryKey: p38Keys.pedidosVendaGestao(dataInicio, dataFim),
    queryFn: () => fetchPedidosVendaGestaoHeaders({ dataInicio, dataFim }),
    enabled: enabled && datesOk,
    placeholderData: keepPreviousData,
    staleTime: getGestaoDateRangeStaleTime(dataFim),
    gcTime: P38_GC_TIME,
    ...rest,
  });
}

export function useRascunhosPedidoVendaGestaoQuery({ dataInicio, dataFim, enabled = true, ...rest } = {}) {
  const datesOk = isValidGestaoDateKey(dataInicio) && isValidGestaoDateKey(dataFim);
  return useQuery({
    queryKey: p38Keys.rascunhosPedidoVendaGestao(dataInicio, dataFim),
    queryFn: () => fetchRascunhosPedidoVendaGestaoHeaders({ dataInicio, dataFim }),
    enabled: enabled && datesOk,
    placeholderData: keepPreviousData,
    staleTime: getGestaoDateRangeStaleTime(dataFim),
    gcTime: P38_GC_TIME,
    ...rest,
  });
}

export function useRascunhosPedidoVendaListQuery(options = {}) {
  const sort = options.sort ?? '-created_date';
  const { sort: _sort, ...rest } = options;
  return useQuery({
    queryKey: p38Keys.rascunhosPedidoVenda(sort),
    queryFn: () => fetchRascunhosPedidoVendaList(sort),
    ...entityQueryDefaults,
    ...rest,
  });
}

export function useHomeKpisQuery(options = {}) {
  const dateKey = dataHoje();
  const queryClient = useQueryClient();
  const { enabled = true, ...rest } = options;

  return useQuery({
    queryKey: p38Keys.homeKpis(dateKey),
    queryFn: () => fetchHomeKpis(dateKey, queryClient),
    enabled,
    staleTime: 30 * 1000,
    gcTime: P38_GC_TIME,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    ...rest,
  });
}

function mergeEventoRows(arrays) {
  const mapa = new Map();
  arrays.flat().forEach((item) => {
    const row = item?.data || item;
    if (row?.id) mapa.set(row.id, row);
  });
  return Array.from(mapa.values());
}

export async function fetchLogisticaEventosList() {
  const inicio = format(subDays(new Date(), 120), 'yyyy-MM-dd');
  const fim = format(addDays(new Date(), 120), 'yyyy-MM-dd');
  const dateRange = { $gte: inicio, $lte: fim };

  const [
    bySaida,
    byManaus,
    byDestino,
    byReferencia,
    listRecent,
    listOldest,
    fromProd,
  ] = await Promise.all([
    base44.entities.EventoLogisticoSandbox.filter({ data_saida_origem: dateRange }, 'data_saida_origem', 500).catch(() => []),
    base44.entities.EventoLogisticoSandbox.filter({ data_chegada_manaus: dateRange }, 'data_saida_origem', 500).catch(() => []),
    base44.entities.EventoLogisticoSandbox.filter({ data_chegada_destino: dateRange }, 'data_saida_origem', 500).catch(() => []),
    base44.entities.EventoLogisticoSandbox.filter({ data_referencia: dateRange }, 'data_saida_origem', 500).catch(() => []),
    base44.entities.EventoLogisticoSandbox.list('-data_saida_origem', 250).catch(() => []),
    base44.entities.EventoLogisticoSandbox.list('data_saida_origem', 250).catch(() => []),
    base44.entities.EventosLogisticos.list('-created_date', 300).catch(() => []),
  ]);

  const sandboxRows = mergeEventoRows([bySaida, byManaus, byDestino, byReferencia, listRecent, listOldest]);
  const eventos = unifyLogisticaEventos(sandboxRows, fromProd);

  if (eventos.length > 0) {
    return eventos;
  }

  const [sandboxFallback, prodFallback] = await Promise.all([
    base44.entities.EventoLogisticoSandbox.list('-created_date', 300).catch(() => []),
    base44.entities.EventosLogisticos.list('-created_date', 300).catch(() => []),
  ]);

  return unifyLogisticaEventos(sandboxFallback, prodFallback);
}

/** Lista ampla para seletor de viagem (despacho) — sem janela de datas, como antes do React Query. */
export async function fetchLogisticaEventosSelectorList() {
  const [fromSandbox, fromProd] = await Promise.all([
    base44.entities.EventoLogisticoSandbox.list('-data_saida_origem', 500).catch(() => []),
    base44.entities.EventosLogisticos.list('-created_date', 300).catch(() => []),
  ]);
  return unifyLogisticaEventos(fromSandbox, fromProd);
}

export function useLogisticaEventosQuery(options = {}) {
  return useQuery({
    queryKey: p38Keys.logistica.eventos(),
    queryFn: () => fetchLogisticaEventosList(),
    ...entityQueryDefaults,
    ...options,
  });
}

export function useLogisticaEventosSelectorQuery(options = {}) {
  return useQuery({
    queryKey: [...p38Keys.logistica.eventos(), 'selector'],
    queryFn: fetchLogisticaEventosSelectorList,
    ...entityQueryDefaults,
    refetchOnMount: 'always',
    ...options,
  });
}

export function useLogisticaEmbarquesQuery(options = {}) {
  return useQuery({
    queryKey: p38Keys.logistica.embarques(),
    queryFn: () => base44.entities.Embarque.list('-created_date', 500),
    ...entityQueryDefaults,
    ...options,
  });
}

export function useLogisticaLancamentosFretesQuery(options = {}) {
  return useQuery({
    queryKey: p38Keys.logistica.lancamentosFretes(),
    queryFn: () =>
      base44.entities.LancamentoFinanceiro.filter({ referencia_tipo: 'EventosLogisticos' }, '-created_date', 500),
    ...entityQueryDefaults,
    ...options,
  });
}

export function useLogisticaContasPrevistasQuery(options = {}) {
  return useQuery({
    queryKey: p38Keys.logistica.contasPrevistas(),
    queryFn: () => base44.entities.ContaPrevista.list('-data_vencimento', 500),
    ...entityQueryDefaults,
    ...options,
  });
}

export async function fetchTransportadorasFluvialList() {
  const data = await base44.entities.Transportadora.list('-updated_date', 200);
  return Array.isArray(data) ? data : [];
}

export function useTransportadorasFluvialQuery(options = {}) {
  return useQuery({
    queryKey: p38Keys.logistica.transportadorasFluvial(),
    queryFn: fetchTransportadorasFluvialList,
    ...entityQueryDefaults,
    ...options,
  });
}

export function useP38QueryInvalidation() {
  const queryClient = useQueryClient();

  return {
    invalidateProdutos: () =>
      queryClient.invalidateQueries({ queryKey: [...p38Keys.all, 'produto'] }),
    invalidateTerceiros: () =>
      queryClient.invalidateQueries({ queryKey: [...p38Keys.all, 'terceiro'] }),
    invalidatePedidosVenda: () =>
      queryClient.invalidateQueries({ queryKey: [...p38Keys.all, 'pedido-venda'] }),
    invalidateRascunhosPedidoVenda: () =>
      queryClient.invalidateQueries({ queryKey: [...p38Keys.all, 'rascunho-pedido-venda'] }),
    invalidateHomeKpis: () => {
      queryClient.invalidateQueries({ queryKey: [...p38Keys.all, 'home-kpis'] });
      queryClient.invalidateQueries({ queryKey: [...p38Keys.all, 'home-vendas-hoje'] });
      queryClient.invalidateQueries({ queryKey: [...p38Keys.all, 'home-pedidos-pendentes'] });
    },
    invalidateLogistica: () =>
      queryClient.invalidateQueries({ queryKey: [...p38Keys.all, 'logistica'] }),
  };
}
