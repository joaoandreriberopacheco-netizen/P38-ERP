import { pedidoCompraItemToLegacyMirror } from '@/lib/pedidoCompraItemContract';
import { derivarItensPedidoDeEmbarques } from '@/lib/embarqueLogisticaHelpers';
import { hydrateEmbarquesPedidoFromSql } from '@/lib/fetchEmbarqueItens';

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

/** Hidrata `itens` a partir de PedidoCompraItem (SQL). Fallback JSON legado se SQL vazio. */
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
    const legado = Array.isArray(pedido?.itens) ? pedido.itens.filter((item) => item?.produto_id) : [];
    return attachItensPedido(pedido, legado, legado.length ? 'json-legado' : 'vazio');
  });
}

/** Recarrega cabeçalho + itens (SQL/legado/embarque) + embarques hidratados para abas Logística/Recepção. */
export async function refreshPedidoCompraComLogistica(base44, pedidoId, { filterEmbarques } = {}) {
  if (!pedidoId) return null;

  const [atualizado, embarquesAtualizados] = await Promise.all([
    base44.entities.PedidoCompra.filter({ id: pedidoId }),
    base44.entities.Embarque.filter({ pedido_compra_id: pedidoId }),
  ]);
  if (!atualizado?.[0]) return null;

  let [pedidoComItens] = await hydratePedidosCompraItensFromSql(base44, [atualizado[0]]);
  const embarquesHidratados = await hydrateEmbarquesPedidoFromSql(
    base44,
    pedidoId,
    embarquesAtualizados || [],
  );
  const embarquesVisiveis = typeof filterEmbarques === 'function'
    ? filterEmbarques(embarquesHidratados)
    : embarquesHidratados;

  if (!(pedidoComItens.itens || []).length) {
    const derivados = derivarItensPedidoDeEmbarques(embarquesVisiveis);
    if (derivados.length) {
      pedidoComItens = { ...pedidoComItens, itens: derivados, _itens_fonte: 'embarque-item' };
    }
  }

  return { ...pedidoComItens, _embarques: embarquesVisiveis };
}
