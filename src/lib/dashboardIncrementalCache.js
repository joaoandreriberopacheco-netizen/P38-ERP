/**
 * Cache incremental do dashboard — até ontem fechado, hoje só o delta.
 * Fuso Tabatinga (UTC−5); ver `dataHoje` / `dataMenosDiasSistema`.
 */

import { format } from 'date-fns';
import { dataHoje, dataMenosDiasSistema } from '@/components/utils/dateUtils';
import {
  getCurrentMonthKey,
  getMonthBucketsEndingAt,
  getTemporalCutoffForMonth,
  getTemporalStartForMonth,
} from '@/lib/dashboardVendasPeriod';

/** Meses civilmente encerrados (anteriores ao mês corrente). */
export function isMonthFullyClosed(monthKey) {
  return String(monthKey || '') < getCurrentMonthKey();
}

/** Janela de 6 meses já terminou antes do mês corrente. */
export function isVendasWindowFullyClosed(selectedMonthKey, months = 6) {
  return isMonthFullyClosed(selectedMonthKey);
}

/** staleTime React Query: infinito se nada no intervalo muda no dia a dia. */
export function getDashboardVendasStaleTime(selectedMonthKey) {
  if (isVendasWindowFullyClosed(selectedMonthKey)) {
    return Number.POSITIVE_INFINITY;
  }
  return 2 * 60 * 1000;
}

export function getDashboardEstoqueStaleTime() {
  /** Movimentos até ontem ficam em segmento ∞; o tab inteiro reutiliza 15 min. */
  return 15 * 60 * 1000;
}

export function getOntemDateKey() {
  return dataMenosDiasSistema(1);
}

export function getHojeDateKey() {
  return dataHoje();
}

/**
 * Partes da janela de vendas para fetch incremental.
 * @returns {{ closed: { dataInicio, dataFim } | null, currentThroughOntem: { dataInicio, dataFim } | null, hoje: { dataInicio, dataFim } | null }}
 */
export function planDashboardVendasFetchRanges(selectedMonthKey, months = 6) {
  const buckets = getMonthBucketsEndingAt(selectedMonthKey, months);
  if (!buckets.length) {
    return { closed: null, currentThroughOntem: null, hoje: null };
  }

  const currentKey = getCurrentMonthKey();
  const hoje = getHojeDateKey();
  const ontem = getOntemDateKey();

  const closedBuckets = buckets.filter((b) => isMonthFullyClosed(b.key));
  const includesCurrentMonth = buckets.some((b) => b.key === currentKey);

  let closed = null;
  if (closedBuckets.length > 0) {
    closed = {
      dataInicio: format(getTemporalStartForMonth(closedBuckets[0].key), 'yyyy-MM-dd'),
      dataFim: format(getTemporalCutoffForMonth(closedBuckets[closedBuckets.length - 1].key), 'yyyy-MM-dd'),
    };
  }

  let currentThroughOntem = null;
  let hojeRange = null;

  if (includesCurrentMonth) {
    const monthStart = format(getTemporalStartForMonth(currentKey), 'yyyy-MM-dd');
    if (monthStart <= ontem) {
      currentThroughOntem = { dataInicio: monthStart, dataFim: ontem };
    }
    hojeRange = { dataInicio: hoje, dataFim: hoje };
  }

  return { closed, currentThroughOntem, hoje: hojeRange };
}

/** Mescla pedidos por id (primeira ocorrência ganha). */
export function mergePedidosById(...lists) {
  const byId = new Map();
  for (const list of lists) {
    for (const pedido of list || []) {
      if (pedido?.id && !byId.has(pedido.id)) {
        byId.set(pedido.id, pedido);
      }
    }
  }
  return [...byId.values()];
}

/** Mescla movimentações por id. */
export function mergeMovimentosById(...lists) {
  const byId = new Map();
  for (const list of lists) {
    for (const row of list || []) {
      const id = row?.id;
      if (id && !byId.has(id)) {
        byId.set(id, row);
      }
    }
  }
  return [...byId.values()];
}
