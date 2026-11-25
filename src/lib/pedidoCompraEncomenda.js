/** Visibilidade de pedidos de encomenda na lista de embarques. */
export const FILTRO_COMPRAS_ENCOMENDA_TODOS = 'todos';
export const FILTRO_COMPRAS_ENCOMENDA_OCULTAR = 'ocultar';
export const FILTRO_COMPRAS_ENCOMENDA_SOMENTE = 'somente';
export const FILTRO_COMPRAS_ENCOMENDA_DEFAULT = FILTRO_COMPRAS_ENCOMENDA_TODOS;

/** Pedido de compra marcado como encomenda (não reposição de vitrine). */
export function isPedidoCompraEncomenda(pedido = {}) {
  if (typeof pedido?.is_encomenda === 'boolean') return pedido.is_encomenda;
  const raw = pedido?.dados?.is_encomenda;
  if (typeof raw === 'boolean') return raw;
  const s = String(raw ?? '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'sim' || s === 'yes';
}

export function pedidosCompraReposicaoEstoque(pedidos = []) {
  return (pedidos || []).filter((p) => !isPedidoCompraEncomenda(p));
}

export function passaFiltroEncomendaPedidoCompra(pedido, modo = FILTRO_COMPRAS_ENCOMENDA_DEFAULT) {
  if (!modo || modo === FILTRO_COMPRAS_ENCOMENDA_TODOS) return true;
  const encomenda = isPedidoCompraEncomenda(pedido);
  if (modo === FILTRO_COMPRAS_ENCOMENDA_SOMENTE) return encomenda;
  if (modo === FILTRO_COMPRAS_ENCOMENDA_OCULTAR) return !encomenda;
  return true;
}
