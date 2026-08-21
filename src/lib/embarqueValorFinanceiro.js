/**
 * Fonte canónica de valores financeiros por embarque/split.
 * Lista, Consulta, viagem, relatórios e detalhe devem importar daqui.
 */
import { getEmbarqueItensLinhas } from '@/lib/fetchEmbarqueItens';
import {
  resolveEmbarqueQuantidadeComercial,
  resolveEmbarqueLinhaUnidade,
  resolveEmbarqueQuantidadeBase,
} from '@/lib/embarqueQuantityResolve';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import {
  getTotalLinhaPedidoCompra,
  calcValorItensPedidoCompra,
  calcValorTotalPedidoCompra,
} from '@/lib/pedidoCompraFinanceiro';
import { isNecessidadeRenderizada } from '@/lib/pedidoCompraNecessidade';
import {
  calculateBaseQuantity,
  getItemCompraExibicaoVitrine,
  normalizeUnitCode,
} from '@/lib/productUnits';

/** Quando comercial e base divergem (ex.: 214 CX vs 99 CX vitrine), preferir base. */
export const RATIO_DIVERGENCIA_USAR_BASE = 0.15;

function resolveQtyBasePedido(pedidoItem = {}, exibPedido = null) {
  const stored = Number(pedidoItem?.quantidade_base);
  if (stored > 0) return stored;
  const exib = exibPedido || getItemCompraExibicaoVitrine(pedidoItem);
  const qty = Number(exib?.quantidade) || Number(pedidoItem?.quantidade) || 0;
  const fator = Number(exib?.fator_conversao) || Number(pedidoItem?.fator_conversao) || 1;
  return calculateBaseQuantity(qty, fator);
}

/** Proporção linha pedido → linha embarque (CX/M² coerente). */
export function resolveValorLinhaEmbarqueProporcional(
  pedidoItem = {},
  linhaMerged = null,
  lineTotalFull = 0,
  qtyKind = 'embarcada',
  produto = null,
) {
  const exibPedido = getItemCompraExibicaoVitrine(pedidoItem, produto);
  const qtyBasePedido = resolveQtyBasePedido(pedidoItem, exibPedido);
  const qtyBaseEmbarque = linhaMerged
    ? resolveEmbarqueQuantidadeBase(linhaMerged, qtyKind)
    : qtyBasePedido;
  const ratioBase = qtyBasePedido > 0 && qtyBaseEmbarque > 0
    ? qtyBaseEmbarque / qtyBasePedido
    : null;

  const unidadePedido = normalizeUnitCode(exibPedido?.unidade_medida || pedidoItem?.unidade_medida);
  const unidadeEmbarque = linhaMerged
    ? normalizeUnitCode(resolveEmbarqueLinhaUnidade(linhaMerged))
    : unidadePedido;
  const unidadesAlinhadas = unidadePedido === unidadeEmbarque;

  const qtyComPedido = Number(exibPedido?.quantidade) || Number(pedidoItem?.quantidade) || 0;
  const qtyComEmbarque = linhaMerged
    ? resolveEmbarqueQuantidadeComercial(linhaMerged, qtyKind)
    : qtyComPedido;
  const ratioCom = unidadesAlinhadas && qtyComPedido > 0 && qtyComEmbarque > 0
    ? qtyComEmbarque / qtyComPedido
    : null;

  let ratio = null;
  if (ratioBase != null && ratioCom != null) {
    const maxRatio = Math.max(ratioBase, ratioCom, 0.001);
    const diverge = Math.abs(ratioCom - ratioBase) / maxRatio;
    ratio = diverge > RATIO_DIVERGENCIA_USAR_BASE ? ratioBase : ratioCom;
  } else if (ratioBase != null) {
    ratio = ratioBase;
  } else if (ratioCom != null) {
    ratio = ratioCom;
  }

  if (ratio == null) return lineTotalFull;

  const valor = roundToTwoDecimals(ratio * lineTotalFull);
  return roundToTwoDecimals(Math.min(valor, lineTotalFull));
}

/** Valor total do split/embarque (todas as linhas + frete/desconto proporcional). */
export function calcValorEmbarqueCard(card = {}, produtosMap = {}) {
  const pedido = card;
  const embarque = card._embarque;
  const linhas = getEmbarqueItensLinhas(embarque);
  if (!linhas.length) return calcValorTotalPedidoCompra(pedido);

  const ehNecessidade = card._is_necessidade || isNecessidadeRenderizada(embarque);
  const valorItens = roundToTwoDecimals(
    linhas.reduce((acc, sqlLine) => {
      const pedidoItem = (pedido.itens || []).find((pi) => pi.produto_id === sqlLine.produto_id);
      const produto = sqlLine.produto_id ? produtosMap[sqlLine.produto_id] || null : null;
      const lineTotal = getTotalLinhaPedidoCompra(pedidoItem || {});
      const qtyKind = ehNecessidade && resolveEmbarqueQuantidadeComercial(sqlLine, 'embarcada') <= 0
        ? 'pedida'
        : 'embarcada';
      return acc + resolveValorLinhaEmbarqueProporcional(
        pedidoItem || {},
        { ...(pedidoItem || {}), ...sqlLine },
        lineTotal,
        qtyKind,
        produto,
      );
    }, 0),
  );

  const valorItensPedido = calcValorItensPedidoCompra(pedido);
  if (!valorItensPedido) return valorItens;

  const frete = Number(pedido?.valor_frete) || 0;
  const desconto = Number(pedido?.valor_desconto) || 0;
  const proporcao = valorItens / valorItensPedido;
  const valorCard = roundToTwoDecimals(valorItens + proporcao * (frete - desconto));
  return roundToTwoDecimals(Math.min(valorCard, calcValorTotalPedidoCompra(pedido)));
}

/** Soma dos valores de todos os embarques reais do pedido (mesma regra do card). */
export function calcValorEmbarcadoPedido(pedido = {}, embarques = [], produtosMap = {}) {
  const lista = (embarques || []).filter((emb) => !isNecessidadeRenderizada(emb));
  if (!lista.length) return 0;
  return roundToTwoDecimals(
    lista.reduce((acc, embarque) => {
      return acc + calcValorEmbarqueCard(
        { ...pedido, _embarque: embarque, _embarques: embarques },
        produtosMap,
      );
    }, 0),
  );
}

/** Percentual de valor embarcado (0–100) alinhado ao card. */
export function calcPercentualValorEmbarcadoPedido(pedido = {}, embarques = [], produtosMap = {}) {
  const totalPedido = calcValorTotalPedidoCompra(pedido);
  if (!totalPedido) return 0;
  const valorEmbarcado = calcValorEmbarcadoPedido(pedido, embarques, produtosMap);
  return Math.min(100, Number(((valorEmbarcado / totalPedido) * 100).toFixed(2)));
}

/** Valor da carga de um embarque isolado (viagem fluvial, frete). */
export function calcValorCargaEmbarque(pedido = {}, embarque = {}, produtosMap = {}) {
  if (!embarque?.id && !getEmbarqueItensLinhas(embarque).length) return 0;
  return calcValorEmbarqueCard(
    {
      ...pedido,
      _embarque: embarque,
      _embarques: pedido._embarques || [embarque],
    },
    produtosMap,
  );
}
