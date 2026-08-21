/**
 * API unificada de exibição de valores — pedido, split, consulta, relatórios.
 * Todas as telas (lista, consulta, detalhe, PDF, KPIs) devem usar estas funções.
 */
import { calcValorTotalPedidoCompra } from '@/lib/pedidoCompraFinanceiro';
import {
  calcValorEmbarqueCard,
  calcValorCargaEmbarque,
} from '@/lib/embarqueValorFinanceiro';
import { calcConsultaValorEmbarque, buildConsultaItensEmbarque } from '@/lib/consultaComprasEmbarques';

/** Total integral do pedido (formulário, financeiro, aprovação). */
export function valorPedidoCompra(pedido = {}) {
  return calcValorTotalPedidoCompra(pedido);
}

/** Valor do split/embarque (lista, detalhe contextual, viagem). */
export function valorEmbarqueSplit(pedido = {}, embarque = null, produtosMap = {}) {
  if (!embarque) {
    const display = Number(pedido._display_valor);
    if (Number.isFinite(display) && display > 0) return display;
    return valorPedidoCompra(pedido);
  }
  return calcValorEmbarqueCard(
    {
      ...pedido,
      _embarque: embarque,
      _embarques: pedido._embarques || [embarque],
    },
    produtosMap,
  );
}

/** Saldo pendente na consulta (só o que falta receber neste split). */
export function valorConsultaEmbarque(card = {}, produtosMap = {}) {
  const cached = Number(card._consulta_valor);
  if (Number.isFinite(cached) && cached >= 0 && card._consulta_itens) {
    return cached;
  }
  return calcConsultaValorEmbarque(card, buildConsultaItensEmbarque(card, produtosMap));
}

/**
 * Cadeia unificada para relatórios, PDF e KPIs.
 * Prioridade: consulta → card split → pendente entrega → total pedido.
 */
export function valorExibicaoPedidoCompra(pedido = {}, produtosMap = {}) {
  const consulta = Number(pedido._consulta_valor);
  if (Number.isFinite(consulta) && consulta > 0) return consulta;

  const display = Number(pedido._display_valor);
  if (Number.isFinite(display) && display > 0) return display;

  if (pedido._embarque) {
    const split = valorEmbarqueSplit(pedido, pedido._embarque, produtosMap);
    if (split > 0) return split;
  }

  const pendente = Number(pedido.valor_pendente_entrega);
  if (Number.isFinite(pendente) && pendente > 0) return pendente;

  return valorPedidoCompra(pedido);
}

/** Valor da carga para viagem fluvial / evento logístico. */
export function valorCargaEmbarqueFluvial(pedido = {}, embarque = {}, produtosMap = {}) {
  return calcValorCargaEmbarque(pedido, embarque, produtosMap);
}

/** @deprecated alias — prefer valorExibicaoPedidoCompra */
export const getValorRelatorioPedidoCompra = valorExibicaoPedidoCompra;
