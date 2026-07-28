/**
 * Condição comercial (folga da tabela) — não vincula entrega operacional.
 * Com entrega: folga 5%, cartão loja até 2x.
 * Retirada: folga 10%, cartão loja até 5x.
 * Juros do comprador: sempre liberado (tarifa loja ≈ crédito à vista).
 */

export const FOLGA_COM_ENTREGA_PCT = 5;
export const FOLGA_RETIRADA_PCT = 10;
export const MAX_PARCELAS_LOJA_COM_ENTREGA = 2;
export const MAX_PARCELAS_LOJA_RETIRADA = 5;

export function getPoliticaCondicao(condicaoComEntrega) {
  if (condicaoComEntrega === true) {
    return {
      condicao_com_entrega: true,
      max_desconto_pct: FOLGA_COM_ENTREGA_PCT,
      max_parcelas_loja: MAX_PARCELAS_LOJA_COM_ENTREGA,
      folga_pct: FOLGA_COM_ENTREGA_PCT,
      label: 'Com entrega',
      resumo_caixa: `Até ${MAX_PARCELAS_LOJA_COM_ENTREGA}x no cartão (loja) ou desconto até ${FOLGA_COM_ENTREGA_PCT}%`,
    };
  }
  return {
    condicao_com_entrega: false,
    max_desconto_pct: FOLGA_RETIRADA_PCT,
    max_parcelas_loja: MAX_PARCELAS_LOJA_RETIRADA,
    folga_pct: FOLGA_RETIRADA_PCT,
    label: 'Retirada',
    resumo_caixa: `Até ${MAX_PARCELAS_LOJA_RETIRADA}x no cartão (loja) ou desconto até ${FOLGA_RETIRADA_PCT}%`,
  };
}

/** Limite de desconto = menor entre política, usuário e tabela. */
export function getLimiteDescontoEfetivo(condicaoComEntrega, limiteUsuario = 0, limiteTabela = 0) {
  const { max_desconto_pct } = getPoliticaCondicao(condicaoComEntrega);
  const candidatos = [max_desconto_pct];
  if (limiteUsuario > 0) candidatos.push(limiteUsuario);
  if (limiteTabela > 0) candidatos.push(limiteTabela);
  return Math.min(...candidatos);
}

export function getDescontoPercentual(subtotal, valorDesconto) {
  const sub = parseFloat(subtotal) || 0;
  const desc = parseFloat(valorDesconto) || 0;
  if (sub <= 0) return 0;
  return (desc / sub) * 100;
}

/** Valida cartão com taxa absorvida pela loja (sem juros do comprador). */
export function validarPagamentoCartaoLoja({
  condicaoComEntrega,
  subtotal,
  valorDesconto,
  taxaTotalPct,
  parcelas,
}) {
  const politica = getPoliticaCondicao(condicaoComEntrega);
  const n = parseInt(parcelas, 10) || 1;

  if (n > 1 && n > politica.max_parcelas_loja) {
    return {
      ok: false,
      motivo: `Parcelamento até ${politica.max_parcelas_loja}x para ${politica.label}. Use "Juros do comprador" ou devolva ao vendedor.`,
    };
  }

  const descontoPct = getDescontoPercentual(subtotal, valorDesconto);
  const taxa = parseFloat(taxaTotalPct) || 0;
  if (descontoPct + taxa > politica.folga_pct + 0.05) {
    return {
      ok: false,
      motivo: `Desconto (${descontoPct.toFixed(1)}%) + tarifa (${taxa.toFixed(1)}%) passam da folga de ${politica.folga_pct}% (${politica.label}).`,
    };
  }

  return { ok: true, politica };
}

export function politicaFromPedidoOuRascunho(pedido) {
  if (!pedido) return null;
  if (pedido.condicao_com_entrega === undefined || pedido.condicao_com_entrega === null) {
    return null;
  }
  return getPoliticaCondicao(pedido.condicao_com_entrega === true);
}
