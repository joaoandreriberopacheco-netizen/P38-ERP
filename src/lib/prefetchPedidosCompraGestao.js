import { base44 } from '@/api/base44Client';
import { fetchPedidosCompraGestaoCompleto } from '@/lib/fetchPedidosCompraGestaoCompleto';
import {
  buildComprasGestaoFetchFilters,
  FILTRO_COMPRAS_SOMENTE_NAO_CONCLUIDOS_DEFAULT,
  FILTRO_COMPRAS_ULTIMOS_30_DIAS_DEFAULT,
} from '@/lib/filtroVisibilidadePedidosCompra';
import { p38Keys, P38_GC_TIME, P38_STALE_TIME } from '@/lib/p38QueryConfig';
import { readComprasAnotacaoResumo } from '@/lib/p38AnotacaoApi';
import {
  readPedidosCompraGestaoWarmCache,
  writePedidosCompraGestaoWarmCache,
} from '@/lib/pedidosCompraGestaoWarmCache';

const DEFAULT_FETCH_FILTERS = buildComprasGestaoFetchFilters({
  somenteNaoConcluidos: FILTRO_COMPRAS_SOMENTE_NAO_CONCLUIDOS_DEFAULT,
  ultimos30Dias: FILTRO_COMPRAS_ULTIMOS_30_DIAS_DEFAULT,
});

/**
 * Prefetch da gestão de embarques (filtros default) — ex.: ao abrir hub Compras.
 */
export async function prefetchPedidosCompraGestao(queryClient, fetchFilters = DEFAULT_FETCH_FILTERS) {
  if (!queryClient) return;
  const resumo = await readComprasAnotacaoResumo().catch(() => null);
  const comprasVersion = resumo?.comprasVersion ?? 'v0';
  const fetchFiltersKey = JSON.stringify(fetchFilters);
  const queryKey = [...p38Keys.pedidosCompraGestaoInicial(), comprasVersion, 'completo', fetchFiltersKey];

  const cached = queryClient.getQueryData(queryKey)
    ?? readPedidosCompraGestaoWarmCache(fetchFiltersKey, comprasVersion);
  if (cached && !cached.isListaParcial) return;

  await queryClient.prefetchQuery({
    queryKey,
    queryFn: async () => {
      const data = await fetchPedidosCompraGestaoCompleto(base44, {
        deferSyncAprovacao: true,
        fetchFilters,
      });
      writePedidosCompraGestaoWarmCache(fetchFiltersKey, comprasVersion, data);
      return data;
    },
    staleTime: P38_STALE_TIME,
    gcTime: P38_GC_TIME,
  });
}
