import { pedidoLiberadoParaLogistica } from '@/lib/aprovarPedidoCompraFinanceiro';

/** Visibilidade por pagamento aprovado (financeiro liberou compra/logística). */
export const FILTRO_COMPRAS_PAGAMENTO_APROV_TODOS = 'todos';
export const FILTRO_COMPRAS_PAGAMENTO_APROV_OCULTAR = 'ocultar';
export const FILTRO_COMPRAS_PAGAMENTO_APROV_SOMENTE = 'somente';
export const FILTRO_COMPRAS_PAGAMENTO_APROV_DEFAULT = FILTRO_COMPRAS_PAGAMENTO_APROV_TODOS;

/**
 * Pagamento «aprovado» na lista de embarques: mesma regra da logística (`pedidoLiberadoParaLogistica`).
 * Considera `status_aprovacao_financeira` (Aprovado / Aprovado Financeiramente), `status` pós-aprovacao,
 * flag `_financeiro_aprovado_efetivo` — não usa `data_primeiro_vencimento` (isso é data de vencimento/pagamento).
 */
export function pedidoCompraComPagamentoAprovado(pedido = {}) {
  return pedidoLiberadoParaLogistica(pedido);
}

export function passaFiltroPagamentoAprovadoPedidoCompra(
  pedido,
  modo = FILTRO_COMPRAS_PAGAMENTO_APROV_DEFAULT,
) {
  if (!modo || modo === FILTRO_COMPRAS_PAGAMENTO_APROV_TODOS) return true;
  const aprovado = pedidoCompraComPagamentoAprovado(pedido);
  if (modo === FILTRO_COMPRAS_PAGAMENTO_APROV_SOMENTE) return aprovado;
  if (modo === FILTRO_COMPRAS_PAGAMENTO_APROV_OCULTAR) return !aprovado;
  return true;
}