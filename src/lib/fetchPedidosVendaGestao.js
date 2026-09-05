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

/**
 * Passado selado na anotação + só hoje live; se o cache do passado estiver incompleto,
 * busca live do buraco (ex.: dia 1–4 do mês) e mantém cabeçalhos parciais de outros meses.
 */
async function resolveGestaoRowsFromPartial(
  partial,
  dataInicio,
  dataFim,
  sort,
  fetchLive,
  getSealedRows,
) {
  if (!partial) {
    return sortGestaoRows(await fetchLive(dataInicio, dataFim, sort), sort);
  }

  const sealedRows = getSealedRows(partial);
  const { pastComplete, pastGapRange, liveRange } = partial;

  if (partial.complete) {
    return sortGestaoRows(sealedRows, sort);
  }

  if (pastComplete && liveRange) {
    const live = await fetchLive(liveRange.dataInicio, liveRange.dataFim, sort);
    return sortGestaoRows(mergeGestaoRowsById(sealedRows, live), sort);
  }

  if (pastComplete && !liveRange) {
    return sortGestaoRows(sealedRows, sort);
  }

  const liveStart = pastGapRange?.dataInicio ?? dataInicio;
  const liveEnd = liveRange?.dataFim ?? pastGapRange?.dataFim ?? dataFim;
  const live = await fetchLive(liveStart, liveEnd, sort);
  return sortGestaoRows(mergeGestaoRowsById(sealedRows, live), sort);
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
  return resolveGestaoRowsFromPartial(
    partial,
    dataInicio,
    dataFim,
    sort,
    fetchLivePedidosHeaders,
    (p) => p.headers ?? [],
  );
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
  return resolveGestaoRowsFromPartial(
    partial,
    dataInicio,
    dataFim,
    sort,
    fetchLiveRascunhosHeaders,
    (p) => p.rascunhos ?? [],
  );
}
