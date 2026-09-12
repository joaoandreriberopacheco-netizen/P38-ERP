import { invokeFunction } from './_invokeHelper';

export function cancelarPedidoVenda(body) {
  return invokeFunction('cancelarPedidoVenda', body);
}
