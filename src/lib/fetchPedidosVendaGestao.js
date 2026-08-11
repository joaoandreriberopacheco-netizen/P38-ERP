import { base44 } from '@/api/base44Client';
import { inicioDiaSistemaISO, fimDiaSistemaISO } from '@/components/utils/dateUtils';

function buildCreatedDateFilter(dataInicio, dataFim) {
  if (!dataInicio && !dataFim) return null;
  const created_date = {};
  if (dataInicio) created_date.$gte = inicioDiaSistemaISO(dataInicio);
  if (dataFim) created_date.$lte = fimDiaSistemaISO(dataFim);
  return created_date;
}

/** Cabeçalhos de pedidos de venda no período — sem hidratar itens (Gestão de Vendas). */
export async function fetchPedidosVendaGestaoHeaders({
  dataInicio,
  dataFim,
  sort = '-created_date',
} = {}) {
  const created_date = buildCreatedDateFilter(dataInicio, dataFim);
  if (!created_date) {
    return base44.entities.PedidoVenda.list(sort);
  }
  return base44.entities.PedidoVenda.filter({ created_date }, sort);
}

/** Cabeçalhos de rascunhos no período — sem hidratar itens (Gestão de Vendas). */
export async function fetchRascunhosPedidoVendaGestaoHeaders({
  dataInicio,
  dataFim,
  sort = '-created_date',
} = {}) {
  const created_date = buildCreatedDateFilter(dataInicio, dataFim);
  if (!created_date) {
    return base44.entities.RascunhoPedidoVenda.list(sort);
  }
  return base44.entities.RascunhoPedidoVenda.filter({ created_date }, sort);
}
