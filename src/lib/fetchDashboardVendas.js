import { base44 } from '@/api/base44Client';
import { inicioDiaSistemaISO, fimDiaSistemaISO } from '@/components/utils/dateUtils';
import {
  getMonthBucketsEndingAt,
  getTemporalCutoffForMonth,
  getTemporalStartForMonth,
  getCurrentMonthKey,
} from '@/lib/dashboardVendasPeriod';
import {
  fetchDashboardVendasSnapshotsForWindow,
  planSealedMonthKeys,
  sealedMonthsFromSnapshotMap,
} from '@/lib/dashboardKpiSnapshotApi';
import {
  mergeSealedMonthsFromCelulas,
  readDashboardCelulasVendas,
} from '@/lib/dashboardCelulasApi';
import {
  isMonthFullyClosed,
  isVendasWindowFullyClosed,
  mergePedidosById,
  planDashboardVendasFetchRanges,
} from '@/lib/dashboardIncrementalCache';
import { hydratePedidosVendaItensFromSql } from '@/lib/fetchPedidoVendaItens';
import { p38Keys } from '@/lib/p38QueryConfig';
import { resolveCustoTotalUnitBaseProduto } from '@/lib/productUnits';
import { format } from 'date-fns';

const CHUNK_SIZE = 40;
const CLOSED_SEGMENT_STALE = Number.POSITIVE_INFINITY;
const CURRENT_THROUGH_ONTEM_STALE = Number.POSITIVE_INFINITY;

function normalizeList(rows) {
  return Array.isArray(rows) ? rows : [];
}

function monthWindowKeys(selectedMonthKey, months = 6) {
  const buckets = getMonthBucketsEndingAt(selectedMonthKey, months);
  if (!buckets.length) return { dataInicio: null, dataFim: null };
  const start = getTemporalStartForMonth(buckets[0].key);
  const end = getTemporalCutoffForMonth(selectedMonthKey);
  return {
    dataInicio: format(start, 'yyyy-MM-dd'),
    dataFim: format(end, 'yyyy-MM-dd'),
  };
}

export async function fetchProdutosCustoPorIds(produtoIds = []) {
  const unique = [...new Set((produtoIds || []).filter(Boolean))];
  if (!unique.length) return new Map();

  const produtoEntity = base44?.entities?.Produto;
  if (!produtoEntity?.filter) return new Map();

  const rows = [];
  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CHUNK_SIZE);
    try {
      const batch = await produtoEntity.filter({ id: { $in: chunk } }, '-created_date', chunk.length);
      if (Array.isArray(batch)) rows.push(...batch);
    } catch {
      const batches = await Promise.all(
        chunk.map((id) => produtoEntity.filter({ id }).catch(() => [])),
      );
      batches.flat().forEach((row) => rows.push(row));
    }
  }

  return new Map(
    rows.map((produto) => [
      produto.id,
      Number(resolveCustoTotalUnitBaseProduto(produto)),
    ]),
  );
}

function collectProdutoIdsFromPedidos(pedidos = []) {
  const ids = new Set();
  for (const pedido of pedidos) {
    for (const item of pedido?.itens || []) {
      const pid = item?.produto_id ?? item?.produtoId;
      if (pid) ids.add(pid);
    }
  }
  return [...ids];
}

async function fetchPedidosVendaRawRange(dataInicio, dataFim, limit = 5000) {
  if (!dataInicio || !dataFim) return [];

  const pedidosRaw = await base44.entities.PedidoVenda.filter(
    {
      created_date: {
        $gte: inicioDiaSistemaISO(dataInicio),
        $lte: fimDiaSistemaISO(dataFim),
      },
    },
    '-created_date',
    limit,
  );

  return normalizeList(pedidosRaw);
}

async function hydratePedidosLista(pedidosLista) {
  if (!pedidosLista.length) return [];
  return hydratePedidosVendaItensFromSql(base44, pedidosLista);
}

async function fetchPedidosVendaHydratedRange(dataInicio, dataFim, limit = 5000) {
  const pedidosLista = await fetchPedidosVendaRawRange(dataInicio, dataFim, limit);
  return hydratePedidosLista(pedidosLista);
}

async function ensurePedidosSegment(queryClient, segmentKey, dataInicio, dataFim, staleTime) {
  const fetchSegment = () => fetchPedidosVendaHydratedRange(dataInicio, dataFim);

  if (!queryClient) return fetchSegment();

  return queryClient.ensureQueryData({
    queryKey: p38Keys.dashboardVendasPedidosSegment(segmentKey),
    queryFn: fetchSegment,
    staleTime,
  });
}

async function fetchDashboardVendasIncremental({
  selectedMonthKey,
  months = 6,
  queryClient,
  sealedMonthKeys = new Set(),
} = {}) {
  const plan = planDashboardVendasFetchRanges(selectedMonthKey, months);
  const currentKey = getCurrentMonthKey();
  const segmentFetches = [];

  if (plan.closed) {
    const closedBuckets = getMonthBucketsEndingAt(selectedMonthKey, months).filter((b) =>
      isMonthFullyClosed(b.key),
    );
    const allClosedSealed = closedBuckets.length > 0
      && closedBuckets.every((b) => sealedMonthKeys.has(b.key));

    if (!allClosedSealed) {
      const { dataInicio, dataFim } = plan.closed;
      segmentFetches.push(
        ensurePedidosSegment(
          queryClient,
          `closed-${dataInicio}_${dataFim}`,
          dataInicio,
          dataFim,
          CLOSED_SEGMENT_STALE,
        ),
      );
    }
  }

  if (plan.currentThroughOntem && !sealedMonthKeys.has(currentKey)) {
    const { dataInicio, dataFim } = plan.currentThroughOntem;
    segmentFetches.push(
      ensurePedidosSegment(
        queryClient,
        `cm-ate-ontem-${dataInicio}_${dataFim}`,
        dataInicio,
        dataFim,
        CURRENT_THROUGH_ONTEM_STALE,
      ),
    );
  }

  if (plan.hoje) {
    const { dataInicio, dataFim } = plan.hoje;
    segmentFetches.push(fetchPedidosVendaHydratedRange(dataInicio, dataFim, 500));
  }

  if (!segmentFetches.length) {
    return [];
  }

  const segments = await Promise.all(segmentFetches);
  return mergePedidosById(...segments);
}

/** Pedidos de venda do dashboard (janela de N meses) com fetch incremental até ontem + hoje. */
export async function fetchDashboardVendasPeriodo({
  selectedMonthKey,
  months = 6,
  queryClient,
} = {}) {
  const { dataInicio, dataFim } = monthWindowKeys(selectedMonthKey, months);
  if (!dataInicio || !dataFim) {
    return { pedidos: [], productCostMap: new Map(), sealedMonths: {} };
  }

  const [snapshotMap, celulasVendas] = await Promise.all([
    fetchDashboardVendasSnapshotsForWindow(selectedMonthKey, months),
    readDashboardCelulasVendas(selectedMonthKey, months),
  ]);

  const sealedMonthsFromKpi = sealedMonthsFromSnapshotMap(snapshotMap);
  const sealedMonths = mergeSealedMonthsFromCelulas(
    celulasVendas?.complete ? celulasVendas.sealedMonths : (celulasVendas?.sealedMonths || {}),
    sealedMonthsFromKpi,
  );

  const sealedMonthKeys = new Set([
    ...planSealedMonthKeys(snapshotMap, selectedMonthKey, months),
    ...getMonthBucketsEndingAt(selectedMonthKey, months)
      .map((b) => b.key)
      .filter((key) => Boolean(sealedMonths[key]?.monthlyTotals)),
  ]);

  const buckets = getMonthBucketsEndingAt(selectedMonthKey, months);
  const allMonthsSealed = buckets.length > 0 && buckets.every((b) => sealedMonthKeys.has(b.key));
  const plan = planDashboardVendasFetchRanges(selectedMonthKey, months);

  let pedidos;

  if (allMonthsSealed) {
    pedidos = plan.hoje
      ? await fetchPedidosVendaHydratedRange(plan.hoje.dataInicio, plan.hoje.dataFim, 500)
      : [];
  } else if (isVendasWindowFullyClosed(selectedMonthKey, months)) {
    pedidos = await ensurePedidosSegment(
      queryClient,
      `window-${dataInicio}_${dataFim}`,
      dataInicio,
      dataFim,
      CLOSED_SEGMENT_STALE,
    );
  } else {
    pedidos = await fetchDashboardVendasIncremental({
      selectedMonthKey,
      months,
      queryClient,
      sealedMonthKeys,
    });
  }

  const productCostMap = await fetchProdutosCustoPorIds(collectProdutoIdsFromPedidos(pedidos));

  return { pedidos, productCostMap, sealedMonths };
}
