/** Formas de pagamento padrão em pedidos de venda (PDV / caixa). */
export const FORMAS_PAGAMENTO_VENDA = [
  'Dinheiro',
  'PIX',
  'Cartão de Débito',
  'Cartão de Crédito',
  'Vale Troca',
  'Vale Compra',
  'Conta a Pagar',
];

/**
 * Verifica se o pedido possui ao menos uma forma de pagamento entre as selecionadas.
 * @param {{ pagamentos?: Array<{ forma_pagamento?: string }> }} pedido
 * @param {string[]} formasSelecionadas
 */
export function pedidoMatchesFormasPagamento(pedido, formasSelecionadas) {
  if (!formasSelecionadas?.length) return true;
  const pags = Array.isArray(pedido?.pagamentos) ? pedido.pagamentos : [];
  if (pags.length === 0) return false;
  const selecionadas = new Set(formasSelecionadas);
  return pags.some((p) => p?.forma_pagamento && selecionadas.has(p.forma_pagamento));
}

/**
 * Lista de formas para filtro: padrão + quaisquer formas já usadas nos pedidos.
 * @param {Array<{ pagamentos?: Array<{ forma_pagamento?: string }> }>} pedidos
 */
export function listarFormasPagamentoParaFiltro(pedidos = []) {
  const set = new Set(FORMAS_PAGAMENTO_VENDA);
  const lista = Array.isArray(pedidos) ? pedidos : [];
  lista.forEach((pedido) => {
    (pedido.pagamentos || []).forEach((pag) => {
      if (pag?.forma_pagamento) set.add(pag.forma_pagamento);
    });
  });
  return [...set];
}
