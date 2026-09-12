import { cancelarPedidoVenda as invokeCancelarPedidoVenda } from '@/functions/cancelarPedidoVenda';

/**
 * Cancela um pedido de venda via Supabase Edge Function + RPC transacional.
 * Mantém o registro com status Cancelado; estorna estoque e financeiro.
 */
export async function cancelarPedidoVenda({ pedidoId, motivo }) {
  if (!pedidoId) throw new Error('Pedido não informado.');
  const motivoLimpo = String(motivo || '').trim();
  if (!motivoLimpo) throw new Error('Informe o motivo do cancelamento.');

  const response = await invokeCancelarPedidoVenda({ pedidoId, motivo: motivoLimpo });
  const payload = response?.data ?? response;
  if (payload?.error) throw new Error(payload.error);
  if (!payload?.sucesso) throw new Error('Não foi possível cancelar a venda.');
  return payload;
}

/** Pedidos que podem ser cancelados pela gestão de vendas. */
export function pedidoPodeSerCancelado(pedido) {
  if (!pedido?.id) return false;
  const status = String(pedido.status || '').trim();
  if (status === 'Cancelado') return false;
  if (status === 'Orçamento') return false;
  if (String(pedido.tipo || '').trim() === 'Orçamento') return false;
  return true;
}
