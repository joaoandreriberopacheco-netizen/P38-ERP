import { roundToTwoDecimals } from '@/lib/financialUtils';

/** Chaves usadas no painel «Recebimentos do Turno». */
export const FORMA_CAIXA_KEYS = {
  dinheiro: 'dinheiro',
  pix: 'pix',
  credito: 'credito',
  debito: 'debito',
  vale: 'vale',
  fiado: 'fiado',
};

export const FORMA_CAIXA_LABELS = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  credito: 'Cartão Crédito',
  debito: 'Cartão Débito',
  vale: 'Vale Troca',
  fiado: 'Fiado',
};

/**
 * Espelha a agregação em `caixaTurnoData.js`.
 * @param {string} formaPagamento
 * @param {string} key — uma de FORMA_CAIXA_KEYS
 */
export function formaPagamentoMatchesCaixaKey(formaPagamento, key) {
  const fp = (formaPagamento || '').toLowerCase();
  switch (key) {
    case FORMA_CAIXA_KEYS.dinheiro:
      return fp === 'dinheiro';
    case FORMA_CAIXA_KEYS.pix:
      return fp === 'pix';
    case FORMA_CAIXA_KEYS.credito:
      return fp.includes('crédito') || fp.includes('credito');
    case FORMA_CAIXA_KEYS.debito:
      return fp.includes('débito') || fp.includes('debito');
    case FORMA_CAIXA_KEYS.vale:
      return fp.includes('vale');
    case FORMA_CAIXA_KEYS.fiado:
      return fp === 'conta a pagar' || fp.includes('fiado');
    default:
      return false;
  }
}

/**
 * @param {{ pagamentos?: Array<{ forma_pagamento?: string, valor?: number }> }} pedido
 * @param {string} key
 */
export function pedidoTemFormaPagamentoCaixa(pedido, key) {
  const pags = Array.isArray(pedido?.pagamentos) ? pedido.pagamentos : [];
  return pags.some((p) => formaPagamentoMatchesCaixaKey(p?.forma_pagamento, key));
}

/**
 * Soma dos valores pagos na forma indicada.
 * @param {{ pagamentos?: Array<{ forma_pagamento?: string, valor?: number }> }} pedido
 * @param {string} key
 */
export function valorFormaPagamentoNoPedido(pedido, key) {
  const pags = Array.isArray(pedido?.pagamentos) ? pedido.pagamentos : [];
  return roundToTwoDecimals(
    pags
      .filter((p) => formaPagamentoMatchesCaixaKey(p?.forma_pagamento, key))
      .reduce((acc, p) => acc + (Number(p.valor) || 0), 0),
  );
}

/**
 * @param {Array} vendas
 * @param {string} key
 */
export function filtrarVendasPorFormaPagamentoCaixa(vendas, key) {
  return (vendas || []).filter((v) => pedidoTemFormaPagamentoCaixa(v, key));
}

/**
 * @param {Array} vendas
 * @param {string} key
 */
export function totalFormaPagamentoNasVendas(vendas, key) {
  return roundToTwoDecimals(
    filtrarVendasPorFormaPagamentoCaixa(vendas, key).reduce(
      (acc, v) => acc + valorFormaPagamentoNoPedido(v, key),
      0,
    ),
  );
}

/**
 * Pagamento misto quando há mais de uma forma ou valor parcial em relação ao total.
 * @param {{ pagamentos?: Array, valor_total?: number }} pedido
 * @param {string} key
 */
export function isPagamentoMistoParaForma(pedido, key) {
  const pags = (pedido?.pagamentos || []).filter((p) => p?.forma_pagamento);
  if (pags.length > 1) return true;
  const valorForma = valorFormaPagamentoNoPedido(pedido, key);
  const total = Number(pedido?.valor_total) || 0;
  return Math.abs(valorForma - total) > 0.009;
}
