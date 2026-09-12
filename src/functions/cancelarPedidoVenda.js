import { cancelarPedidoVenda as cancelarPedidoVendaLocal } from '@/lib/cancelarPedidoVenda';

/** Wrapper legado — executa cancelamento via entidades (sem Edge Function). */
export function cancelarPedidoVenda(body) {
  return cancelarPedidoVendaLocal(body).then((data) => ({ data }));
}
