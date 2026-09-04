import { rebuildEmbarqueItensMirror } from '@/lib/embarqueItemContract';

const CHUNK_SIZE = 40;

/** Espelho legado no cabeçalho Embarque (só leitura — gravação vai para EmbarqueItem). */
export function readLegacyEmbarqueLinhas(embarque = {}) {
  if (Array.isArray(embarque.itens_embarcados) && embarque.itens_embarcados.length) {
    return embarque.itens_embarcados;
  }
  if (Array.isArray(embarque.itens) && embarque.itens.length) {
    return embarque.itens;
  }
  return [];
}

/**
 * Linhas de embarque hidratadas (SQL `_linhas` ou espelho legado na leitura).
 */
export function getEmbarqueItensLinhas(embarque) {
  if (!embarque) return [];
  if (Array.isArray(embarque._linhas)) return embarque._linhas;
  return readLegacyEmbarqueLinhas(embarque);
}

function attachLinhasFromSqlOrLegacy(embarque, sqlRows) {
  if (sqlRows?.length) {
    return attachLinhasEmbarque(embarque, rebuildEmbarqueItensMirror(sqlRows), 'sql');
  }
  const legado = readLegacyEmbarqueLinhas(embarque);
  return attachLinhasEmbarque(embarque, legado, legado.length ? 'json-legado' : 'vazio');
}

function attachLinhasEmbarque(embarque, mirror, fonte) {
  const { itens: _i, itens_embarcados: _ie, _linhas: _l, ...rest } = embarque || {};
  return {
    ...rest,
    _linhas: mirror,
    _itens_fonte: fonte,
  };
}

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

function groupEmbarqueItemRows(allRows = []) {
  const byEmbarque = new Map();
  for (const row of allRows) {
    const eid = row?.embarque_id;
    if (!eid) continue;
    if (!byEmbarque.has(eid)) byEmbarque.set(eid, []);
    byEmbarque.get(eid).push(row);
  }
  for (const rows of byEmbarque.values()) {
    rows.sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
  }
  return byEmbarque;
}

/**
 * Busca linhas EmbarqueItem para vários pedidos (campo denormalizado).
 * @returns {Map<string, object[]>} embarque_id → linhas ordenadas
 */
export async function fetchEmbarqueItensPorPedidos(base44, pedidoIds = []) {
  const ei = base44?.entities?.EmbarqueItem;
  if (!ei?.filter) return new Map();
  const rows = await fetchRowsByCampoIn(ei, 'pedido_compra_id', pedidoIds);
  return groupEmbarqueItemRows(rows);
}

/** Embarques (cabeçalhos) ligados a pedidos de compra — com fallback por id. */
export async function fetchEmbarquesPorPedidos(base44, pedidoIds = []) {
  const emb = base44?.entities?.Embarque;
  if (!emb?.filter) return [];
  return fetchRowsByCampoIn(emb, 'pedido_compra_id', pedidoIds);
}

/**
 * Busca linhas canónicas EmbarqueItem para vários embarques.
 * @returns {Map<string, object[]>} embarque_id → linhas ordenadas
 */
export async function fetchEmbarqueItensPorEmbarques(base44, embarqueIds = []) {
  const ids = [...new Set((embarqueIds || []).filter(Boolean))];
  if (!ids.length) return new Map();

  const ei = base44?.entities?.EmbarqueItem;
  if (!ei?.filter) return new Map();

  const allRows = await fetchRowsByCampoIn(ei, 'embarque_id', ids);
  return groupEmbarqueItemRows(allRows);
}

/**
 * Busca todas as linhas de embarque de um pedido (denormalizado em EmbarqueItem).
 */
export async function fetchEmbarqueItensPorPedido(base44, pedidoCompraId) {
  if (!pedidoCompraId) return [];
  const ei = base44?.entities?.EmbarqueItem;
  if (!ei?.filter) return [];
  try {
    const rows = await ei.filter({ pedido_compra_id: pedidoCompraId }, 'ordem', 500);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/** Hidrata linhas a partir de EmbarqueItem (SQL); fallback legado só na leitura. */
export async function hydrateEmbarquesFromSql(base44, embarques = []) {
  if (!Array.isArray(embarques) || !embarques.length) return embarques || [];

  const pedidoIds = [...new Set(embarques.map((e) => e.pedido_compra_id).filter(Boolean))];
  const byEmbarque = pedidoIds.length
    ? await fetchEmbarqueItensPorPedidos(base44, pedidoIds)
    : await fetchEmbarqueItensPorEmbarques(
        base44,
        embarques.map((e) => e.id).filter(Boolean),
      );

  return embarques.map((embarque) => {
    const sqlRows = byEmbarque.get(embarque.id);
    return attachLinhasFromSqlOrLegacy(embarque, sqlRows);
  });
}

/**
 * Hidrata embarques de um pedido — útil no detalhe do pedido.
 */
export async function hydrateEmbarquesPedidoFromSql(base44, pedidoCompraId, embarques = []) {
  if (!base44 || !pedidoCompraId || !Array.isArray(embarques)) return embarques;

  const canonical = await fetchEmbarqueItensPorPedido(base44, pedidoCompraId);
  if (!canonical.length) {
    return hydrateEmbarquesFromSql(base44, embarques);
  }

  const byEmb = {};
  canonical.forEach((row) => {
    const eid = row.embarque_id;
    if (!eid) return;
    if (!byEmb[eid]) byEmb[eid] = [];
    byEmb[eid].push(row);
  });

  return embarques.map((emb) => attachLinhasFromSqlOrLegacy(emb, byEmb[emb.id]));
}
