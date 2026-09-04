/**
 * Cadeia unificada de valor para relatórios Edge (espelho de src/lib/pedidoCompraValorExibicao.js).
 */
export function valorExibicaoPedidoCompra(pedido: Record<string, unknown> = {}): number {
  const consulta = Number(pedido._consulta_valor);
  if (Number.isFinite(consulta) && consulta > 0) return consulta;

  const display = Number(pedido._display_valor);
  if (Number.isFinite(display) && display > 0) return display;

  const pendente = Number(pedido.valor_pendente_entrega);
  if (Number.isFinite(pendente) && pendente > 0) return pendente;

  const total = Number(pedido.valor_total);
  if (Number.isFinite(total) && total > 0) return total;

  return 0;
}
