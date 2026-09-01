import { pedidoVendaItemToLegacyMirror } from '@/lib/pedidoVendaItemContract';

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
 * Busca linhas canónicas PedidoVendaItem para vários pedidos.
 * @returns {Map<string, object[]>} pedido_venda_id → linhas ordenadas
 */
export async function fetchPedidoVendaItensPorPedidos(base44, pedidoIds = []) {
  const ids = [...new Set((pedidoIds || []).filter(Boolean))];
  const byPedido = new Map();
  if (!ids.length) return byPedido;

  const pvi = base44?.entities?.PedidoVendaItem;
  if (!pvi?.filter) return byPedido;

  const allRows = await fetchRowsByCampoIn(pvi, 'pedido_venda_id', ids);

  for (const row of allRows) {
    const pid = row?.pedido_venda_id;
    if (!pid) continue;
    if (!byPedido.has(pid)) byPedido.set(pid, []);
    byPedido.get(pid).push(row);
  }

  for (const rows of byPedido.values()) {
    rows.sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
  }

  return byPedido;
}

export function linhasPedidoVendaToLegacyItens(linhas = []) {
  return (linhas || []).map(pedidoVendaItemToLegacyMirror).filter((item) => item?.produto_id);
}

function attachItensPedido(pedido, itens, fonte) {
  const { itens: _i, _itens_fonte: _f, ...rest } = pedido || {};
  return {
    ...rest,
    itens,
    _itens_fonte: fonte,
  };
}

function readLegacyItensEspelho(pedido = {}) {
  if (Array.isArray(pedido?.itens) && pedido.itens.length > 0) {
    return pedido.itens;
  }
  const dadosItens = pedido?.dados?.itens;
  if (Array.isArray(dadosItens) && dadosItens.length > 0) {
    return dadosItens;
  }
  return [];
}

/** Hidrata um pedido antes de devolução/troca (itens em PedidoVendaItem SQL). */
export async function hydratePedidoVendaParaDevolucao(base44, pedido) {
  if (!pedido?.id) return pedido;
  const [hydrated] = await hydratePedidosVendaItensFromSql(base44, [pedido]);
  return hydrated || pedido;
}

/** Hidrata `itens`: SQL (PedidoVendaItem) primeiro; fallback JSON legado só na leitura. */
export async function hydratePedidosVendaItensFromSql(base44, pedidos = []) {
  if (!Array.isArray(pedidos) || !pedidos.length) return pedidos || [];

  const byPedido = await fetchPedidoVendaItensPorPedidos(
    base44,
    pedidos.map((p) => p.id).filter(Boolean),
  );

  return pedidos.map((pedido) => {
    const pid = String(pedido?.id ?? '');
    const sqlRows = byPedido.get(pedido.id) ?? byPedido.get(pid);
    if (sqlRows?.length) {
      return attachItensPedido(pedido, linhasPedidoVendaToLegacyItens(sqlRows), 'sql');
    }
    const legado = readLegacyItensEspelho(pedido);
    if (legado.length) {
      return attachItensPedido(pedido, legado, 'json-legado');
    }
    return attachItensPedido(pedido, [], 'vazio');
  });
}
