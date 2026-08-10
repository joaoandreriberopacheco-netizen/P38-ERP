import { pedidoCompraItemToLegacyMirror } from '@/lib/pedidoCompraItemContract';

const CHUNK_SIZE = 40;

async function fetchRowsByCampoIn(entity, field, ids = []) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length || !entity?.filter) return [];

  const allRows = [];
  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CHUNK_SIZE);
    try {
      const rows = await entity.filter({ [field]: { $in: chunk } });
      if (Array.isArray(rows) && rows.length > 0) {
        allRows.push(...rows);
        continue;
      }
    } catch {
      /* fallback abaixo */
    }
    const batches = await Promise.all(
      chunk.map((id) => entity.filter({ [field]: id }).catch(() => [])),
    );
    batches.flat().forEach((row) => allRows.push(row));
  }
  return allRows;
}

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

  const allRows = await fetchRowsByCampoIn(pci, 'pedido_compra_id', ids);

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

function attachItensPedido(pedido, itens, fonte) {
  const { itens: _i, _itens_fonte: _f, ...rest } = pedido || {};
  return {
    ...rest,
    itens,
    _itens_fonte: fonte,
  };
}

/** Hidrata `itens` só a partir de PedidoCompraItem (SQL). Sem fallback JSON. */
export async function hydratePedidosCompraItensFromSql(base44, pedidos = []) {
  if (!Array.isArray(pedidos) || !pedidos.length) return pedidos || [];

  const byPedido = await fetchPedidoCompraItensPorPedidos(
    base44,
    pedidos.map((p) => p.id).filter(Boolean),
  );

  return pedidos.map((pedido) => {
    const sqlRows = byPedido.get(pedido.id);
    if (sqlRows?.length) {
      return attachItensPedido(pedido, linhasPedidoCompraToLegacyItens(sqlRows), 'sql');
    }
    return attachItensPedido(pedido, [], 'vazio');
  });
}
