import {
  buildSaleUnitOptions,
  calculateBaseQuantity,
  normalizeUnitCode,
  pickDefaultSaleUnit,
} from '@/lib/productUnits';

/** Chave estável para mapear linha do pedido → quantidade devolvida. */
export function pedidoItemKey(item) {
  return `${item.produto_id}_${item.produto_nome}`;
}

/** Quantidade máxima devolvível em unidade base (fator-1). */
export function getQuantidadeBaseMaxItem(item) {
  const qb = Number(item?.quantidade_base);
  if (qb > 0) return qb;
  return calculateBaseQuantity(Number(item?.quantidade) || 0, Number(item?.fator_conversao) || 1);
}

/** Converte teto em base para quantidade máxima na embalagem escolhida. */
export function maxQuantidadeNaUnidade(quantidadeBaseMax, fatorConversao = 1) {
  const base = Number(quantidadeBaseMax) || 0;
  const fator = Number(fatorConversao) || 1;
  if (fator <= 0) return base;
  return base / fator;
}

/**
 * Unidade de venda inicial para devolução/troca: respeita a do pedido; senão vitrine/principal.
 */
export function resolveUnidadeDevolucaoInicial(item, produto, priceMultiplier = 1) {
  const options = buildSaleUnitOptions(produto || {}, priceMultiplier);
  if (!options.length) {
    return {
      unidade: item?.unidade_medida || 'UN',
      fator_conversao: Number(item?.fator_conversao) || 1,
      valor_unitario: Number(item?.preco_unitario_apresentacao) || Number(item?.preco_unitario_praticado) || 0,
    };
  }
  const siglaPedido = normalizeUnitCode(item?.unidade_medida);
  const match = options.find((o) => normalizeUnitCode(o.unidade) === siglaPedido);
  return match || pickDefaultSaleUnit(produto, priceMultiplier) || options[0];
}

/** Crédito por linha usando preço da tabela na embalagem escolhida. */
export function calcularLinhaCreditoTabela(unitOption, qty) {
  const q = Number(qty) || 0;
  const precoTabela = Number(unitOption?.valor_unitario) || 0;
  const fator = Number(unitOption?.fator_conversao) || 1;
  return {
    qty: q,
    unitLista: precoTabela,
    unitCredito: precoTabela,
    total: q * precoTabela,
    quantidade_base: calculateBaseQuantity(q, fator),
    unidade_medida: unitOption?.unidade || 'UN',
    fator_conversao: fator,
  };
}

export function calcularCreditoDevolucaoTabela(pedido, qtdsPorKey, unidadePorKey) {
  return (pedido?.itens || []).reduce((sum, item) => {
    const key = pedidoItemKey(item);
    const qtd = qtdsPorKey[key] || 0;
    if (qtd <= 0) return sum;
    const unit = unidadePorKey[key];
    if (!unit) {
      return sum + calcularLinhaCreditoDevolucao(item, pedido, qtd).total;
    }
    return sum + calcularLinhaCreditoTabela(unit, qtd).total;
  }, 0);
}

export function calcularSubtotalPedidoLegacy(pedido) {
  const itens = pedido?.itens || [];
  if (Number(pedido?.subtotal) > 0) return Number(pedido.subtotal);
  return itens.reduce(
    (sum, item) => sum + (Number(item.quantidade) || 0) * (Number(item.preco_unitario_praticado) || 0),
    0
  );
}

/**
 * Preço unitário que o cliente efetivamente pagou (considera desconto por item ou rateio do pedido).
 * Ex.: lista R$ 100, desconto R$ 10 no pedido → crédito R$ 90/un.
 */
export function calcularPrecoUnitarioCredito(item, pedido) {
  const unitList = Number(item.preco_unitario_praticado) || 0;
  const descontoItem = Number(item.desconto_unitario) || 0;

  if (descontoItem > 0) {
    return Math.max(0, unitList - descontoItem);
  }

  const subtotal = calcularSubtotalPedidoLegacy(pedido);
  const valorTotal = Number(pedido?.valor_total);

  if (subtotal > 0 && Number.isFinite(valorTotal) && valorTotal >= 0 && valorTotal < subtotal) {
    return unitList * (valorTotal / subtotal);
  }

  return unitList;
}

export function calcularLinhaCreditoDevolucao(item, pedido, qty) {
  const q = Number(qty) || 0;
  const unitCredito = calcularPrecoUnitarioCredito(item, pedido);
  return {
    qty: q,
    unitCredito,
    unitLista: Number(item.preco_unitario_praticado) || 0,
    total: q * unitCredito,
  };
}

export function calcularCreditoDevolucao(pedido, qtdsPorKey) {
  return (pedido?.itens || []).reduce((sum, item) => {
    const key = pedidoItemKey(item);
    const qtd = qtdsPorKey[key] || 0;
    if (qtd <= 0) return sum;
    return sum + calcularLinhaCreditoDevolucao(item, pedido, qtd).total;
  }, 0);
}

export function formatValorBRL(value) {
  return `R$ ${(Number(value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}
