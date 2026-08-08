import { pedidoCompraItemToLegacyMirror } from '@/lib/pedidoCompraItemContract';

const CHUNK_SIZE = 40;

/**
 * Busca linhas canónicas PedidoCompraItem para vários pedidos.
 * @returns {Map<string, object[]>} pedido_compra_id → linhas ordenadas
 */
export async function fetchPedidoCompraItensPorPedidos(base44, pedidoIds = []) {
  const ids = [...new Set((pedidoIds || []).filter(Boolean))];
  const byPedido = new Map();
  if (!ids.length) return byPedido;

  const pci = base44?.entities?.PedidoCompraItem;
  if (!pci?.filter) return byPedido;

  const allRows = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    const batches = await Promise.all(
      chunk.map((pedidoId) => pci.filter({ pedido_compra_id: pedidoId }).catch(() => [])),
    );
    batches.flat().forEach((row) => allRows.push(row));
  }

  for (const row of allRows) {
    const pid = row?.pedido_compra_id;
    if (!pid) continue;
    if (!byPedido.has(pid)) byPedido.set(pid, []);
    byPedido.get(pid).push(row);
  }

  for (const rows of byPedido.values()) {
    rows.sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
  }

  return byPedido;
}

export function linhasPedidoCompraToLegacyItens(linhas = []) {
  return (linhas || []).map(pedidoCompraItemToLegacyMirror).filter((item) => item?.produto_id);
}

/**
 * Prioriza SQL; espelho legado `pedido.itens[]` só como fallback.
 */
export async function hydratePedidosCompraItensFromSql(base44, pedidos = []) {
  if (!Array.isArray(pedidos) || !pedidos.length) return pedidos || [];

  const byPedido = await fetchPedidoCompraItensPorPedidos(
    base44,
    pedidos.map((p) => p.id).filter(Boolean),
  );

  return pedidos.map((pedido) => {
    const sqlRows = byPedido.get(pedido.id);
    if (sqlRows?.length) {
      return {
        ...pedido,
        itens: linhasPedidoCompraToLegacyItens(sqlRows),
        _itens_fonte: 'sql',
      };
    }
    const legado = Array.isArray(pedido.itens) ? pedido.itens : [];
    return {
      ...pedido,
      itens: legado,
      _itens_fonte: legado.length ? 'espelho' : 'vazio',
    };
  });
}
