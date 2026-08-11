import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, subDays, addDays } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { p38Keys, P38_GC_TIME, P38_STALE_TIME } from '@/lib/p38QueryConfig';
import { enrichProdutosComIep, stripAbcdIepCadastro } from '@/lib/calcularIepProdutos';
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

export { fetchPedidosVenda90d, fetchDadosVendaAbcd90d };
import { unifyLogisticaEventos } from '@/components/logistica-sandbox/fluvialDataUtils';
import { dataHoje } from '@/components/utils/dateUtils';

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
  staleTime: 30 * 1000,
  gcTime: P38_GC_TIME,
  refetchOnMount: 'always',
  refetchOnWindowFocus: true,
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

export function usePedidosVenda90dQuery(options = {}) {
  return useQuery({
    queryKey: p38Keys.pedidosVenda90d(),
    queryFn: fetchPedidosVenda90d,
    staleTime: 10 * 60 * 1000,
    gcTime: P38_GC_TIME,
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

/** Catálogo — ABCD/IEP ao vivo; ignora valores gravados pelo job. */
export function useProdutosComIepQuery(options = {}) {
  const sort = options.sort ?? '-created_date';
  const { sort: _sort, ...rest } = options;
  const produtosQuery = useProdutosListQuery({ sort, ...rest });
  const vendasQuery = useDadosVendaAbcd90dQuery({
    enabled: (rest.enabled ?? true) && Boolean(produtosQuery.data?.length),
  });

  const data = useMemo(() => {
    if (!produtosQuery.data?.length) return produtosQuery.data ?? [];
    const vendas = vendasQuery.data;
    if (!vendas?.pedidos90d) {
      return produtosQuery.data.map(stripAbcdIepCadastro);
    }
    return enrichProdutosComIep(produtosQuery.data, vendas);
  }, [produtosQuery.data, vendasQuery.data]);

  return {
    ...produtosQuery,
    data,
    isLoading: produtosQuery.isLoading || vendasQuery.isLoading,
    isFetching: produtosQuery.isFetching || vendasQuery.isFetching,
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
