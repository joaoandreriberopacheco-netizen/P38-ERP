/**
 * Critério canónico: o que conta como venda nos KPIs (Home, dashboard, gestão).
 * Orçamento não é venda — ainda não tem senha nem passou no caixa.
 * Espelha `public.p38_pedido_venda_elegivel_dashboard` no Postgres.
 */

const EXCLUDED_STATUSES = new Set(['cancelado', 'orçamento', 'orcamento']);
const EXCLUDED_TYPES = new Set(['orçamento', 'orcamento']);

export function normalizePedidoVendaLabel(value) {
  return String(value ?? '').trim().toLowerCase();
}

/** Pedido de venda que entra em totais de vendas / KPI. */
export function isPedidoVendaElegivelKpi(pedido) {
  if (!pedido) return false;
  const status = normalizePedidoVendaLabel(pedido.status);
  const tipo = normalizePedidoVendaLabel(pedido.tipo);
  if (EXCLUDED_STATUSES.has(status)) return false;
  if (EXCLUDED_TYPES.has(tipo)) return false;
  return true;
}

export function filterPedidosVendaElegiblesKpi(pedidos) {
  return (Array.isArray(pedidos) ? pedidos : []).filter(isPedidoVendaElegivelKpi);
}
