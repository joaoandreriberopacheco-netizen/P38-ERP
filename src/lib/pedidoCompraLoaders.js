import { hydratePedidosCompraItens } from '@/lib/sugestaoCompraEstoquePendente';
import {
  hydrateEmbarquesLinhasDesdeCanonical,
  hydrateEmbarquesLinhasEmLote,
} from '@/lib/embarqueLogisticaHelpers';

/**
 * Carrega pedidos com `itens[]` legado hidratados a partir de `pedido_compra_item`.
 * SQL é a fonte quando existem linhas canónicas; JSON só como fallback.
 */
export async function loadPedidosComItens(client, pedidos = []) {
  if (!client || !Array.isArray(pedidos) || !pedidos.length) return pedidos || [];
  return hydratePedidosCompraItens(client, pedidos);
}

export async function loadPedidoComItens(client, pedido) {
  if (!pedido) return pedido;
  const [hydrated] = await loadPedidosComItens(client, [pedido]);
  return hydrated || pedido;
}

/**
 * Hidrata embarques com linhas de `embarque_item` quando o JSON está vazio.
 */
export async function loadEmbarquesComItens(client, embarques = [], pedidoCompraId = null) {
  if (!client || !Array.isArray(embarques) || !embarques.length) return embarques || [];
  const pedidoIds = pedidoCompraId ? [pedidoCompraId] : [];
  const batch = await hydrateEmbarquesLinhasEmLote(client, embarques, pedidoIds);
  if (pedidoCompraId) {
    return hydrateEmbarquesLinhasDesdeCanonical(client, pedidoCompraId, batch);
  }
  return batch;
}
