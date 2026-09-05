import { base44 } from '@/api/base44Client';
import { inicioDiaSistemaISO, fimDiaSistemaISO } from '@/components/utils/dateUtils';
import { readVendasGestaoAnotacaoPartial } from '@/lib/p38AnotacaoApi';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidGestaoDateKey(value) {
  return typeof value === 'string' && DATE_KEY_RE.test(value);
}

function buildCreatedDateFilter(dataInicio, dataFim) {
  const inicio = isValidGestaoDateKey(dataInicio) ? dataInicio : null;
  const fim = isValidGestaoDateKey(dataFim) ? dataFim : null;
  if (!inicio && !fim) return null;
  const created_date = {};
  if (inicio) created_date.$gte = inicioDiaSistemaISO(inicio);
  if (fim) created_date.$lte = fimDiaSistemaISO(fim);
  return created_date;
}

function normalizeListResult(rows) {
  return Array.isArray(rows) ? rows : [];
}

function sortGestaoRows(rows, sort = '-created_date') {
  const list = [...rows];
  if (sort === '-created_date') {
    list.sort((a, b) => String(b.created_date || '').localeCompare(String(a.created_date || '')));
  }
  return list;
}

function mergeGestaoRowsById(sealed = [], live = []) {
  const byId = new Map();
  for (const row of [...sealed, ...live]) {
    if (row?.id) byId.set(row.id, row);
  }
  return [...byId.values()];
}

async function fetchLivePedidosHeaders(dataInicio, dataFim, sort) {
  const created_date = buildCreatedDateFilter(dataInicio, dataFim);
  if (!created_date) return [];
  const rows = await base44.entities.PedidoVenda.filter({ created_date }, sort);
  return normalizeListResult(rows);
}

async function fetchLiveRascunhosHeaders(dataInicio, dataFim, sort) {
  const created_date = buildCreatedDateFilter(dataInicio, dataFim);
  if (!created_date) return [];
  const rows = await base44.entities.RascunhoPedidoVenda.filter({ created_date }, sort);
  return normalizeListResult(rows);
}

/** Cabeçalhos de pedidos de venda no período — sem hidratar itens (Gestão de Vendas). */
export async function fetchPedidosVendaGestaoHeaders({
  dataInicio,
  dataFim,
  sort = '-created_date',
} = {}) {
  if (!isValidGestaoDateKey(dataInicio) || !isValidGestaoDateKey(dataFim)) {
    return [];
  }

  const partial = await readVendasGestaoAnotacaoPartial(dataInicio, dataFim);
  if (partial?.complete) {
    return sortGestaoRows(partial.headers, sort);
  }

  if (partial?.liveRange) {
    const live = await fetchLivePedidosHeaders(
      partial.liveRange.dataInicio,
      partial.liveRange.dataFim,
      sort,
    );
    return sortGestaoRows(mergeGestaoRowsById(partial.headers, live), sort);
  }

  if (partial?.headers?.length) {
    return sortGestaoRows(partial.headers, sort);
  }

  return fetchLivePedidosHeaders(dataInicio, dataFim, sort);
}

/** Cabeçalhos de rascunhos no período — sem hidratar itens (Gestão de Vendas). */
export async function fetchRascunhosPedidoVendaGestaoHeaders({
  dataInicio,
  dataFim,
  sort = '-created_date',
} = {}) {
  if (!isValidGestaoDateKey(dataInicio) || !isValidGestaoDateKey(dataFim)) {
    return [];
  }

  const partial = await readVendasGestaoAnotacaoPartial(dataInicio, dataFim);
  if (partial?.complete) {
    return sortGestaoRows(partial.rascunhos, sort);
  }

  if (partial?.liveRange) {
    const live = await fetchLiveRascunhosHeaders(
      partial.liveRange.dataInicio,
      partial.liveRange.dataFim,
      sort,
    );
    return sortGestaoRows(mergeGestaoRowsById(partial.rascunhos, live), sort);
  }

  if (partial?.rascunhos?.length) {
    return sortGestaoRows(partial.rascunhos, sort);
  }

  return fetchLiveRascunhosHeaders(dataInicio, dataFim, sort);
}
