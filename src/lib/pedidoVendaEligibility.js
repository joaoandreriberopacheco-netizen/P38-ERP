/**
 * Critério canónico: o que conta como venda nos KPIs (Home, dashboard, gestão).
 * Orçamento não é venda — ainda não tem senha nem passou no caixa.
 * Espelha `public.p38_pedido_venda_elegivel_dashboard` no Postgres.
 */

import {
  PEDIDO_VENDA_STATUS_ORCAMENTO,
  PEDIDO_VENDA_TIPO_ORCAMENTO,
  resolvePedidoVendaTipoStatus,
} from './pedidoVendaOrcamentoLabels.js';

export {
  PEDIDO_VENDA_STATUS_ORCAMENTO,
  PEDIDO_VENDA_TIPO_ORCAMENTO,
} from './pedidoVendaOrcamentoLabels.js';

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

/** Orçamento gravado em pedido_venda (rápido ou legado) — não é venda fechada. */
export function isPedidoOrcamento(pedido) {
  if (!pedido) return false;
  const dados = pedido.dados && typeof pedido.dados === 'object' ? pedido.dados : {};
  if (normalizePedidoVendaLabel(dados.origem ?? pedido.origem) === 'orcamento_rapido') {
    return true;
  }
  const { tipo, status } = resolvePedidoVendaTipoStatus(pedido);
  return tipo === PEDIDO_VENDA_TIPO_ORCAMENTO || status === PEDIDO_VENDA_STATUS_ORCAMENTO;
}

/** Linha bruta `pedido_venda` (colunas + `dados` JSON) para critério de orçamento. */
export function pedidoVendaRowEligibilityFields(row = {}) {
  const dados = row.dados && typeof row.dados === 'object' ? row.dados : {};
  return {
    tipo: row.tipo ?? dados.tipo,
    status: row.status ?? dados.status,
    origem: dados.origem,
  };
}

/** Orçamento na listagem SQL (inclui `dados.origem = orcamento_rapido`). */
export function isOrcamentoPedidoVendaRow(row) {
  if (!row) return false;
  return isPedidoOrcamento(row);
}
