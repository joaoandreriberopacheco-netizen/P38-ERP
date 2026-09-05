import { base44 } from '@/api/base44Client';
import { inicioDiaSistemaISO, fimDiaSistemaISO } from '@/components/utils/dateUtils';
import { readVendasGestaoAnotacaoForRange } from '@/lib/p38AnotacaoApi';

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

/** Cabeçalhos de pedidos de venda no período — sem hidratar itens (Gestão de Vendas). */
export async function fetchPedidosVendaGestaoHeaders({
  dataInicio,
  dataFim,
  sort = '-created_date',
} = {}) {
  if (!isValidGestaoDateKey(dataInicio) || !isValidGestaoDateKey(dataFim)) {
    return [];
  }

  const sealed = await readVendasGestaoAnotacaoForRange(dataInicio, dataFim);
  if (sealed?.complete) {
    return sealed.headers;
  }

  const created_date = buildCreatedDateFilter(dataInicio, dataFim);
  if (!created_date) {
    return [];
  }
  const rows = await base44.entities.PedidoVenda.filter({ created_date }, sort);
  return normalizeListResult(rows);
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

  const sealed = await readVendasGestaoAnotacaoForRange(dataInicio, dataFim);
  if (sealed?.complete) {
    return sealed.rascunhos;
  }

  const created_date = buildCreatedDateFilter(dataInicio, dataFim);
  if (!created_date) {
    return [];
  }
  const rows = await base44.entities.RascunhoPedidoVenda.filter({ created_date }, sort);
  return normalizeListResult(rows);
}
