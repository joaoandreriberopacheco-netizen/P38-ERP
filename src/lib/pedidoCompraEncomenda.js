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
