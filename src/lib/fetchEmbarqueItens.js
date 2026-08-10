import { rebuildEmbarqueItensMirror } from '@/lib/embarqueItemContract';

const CHUNK_SIZE = 40;

/**
 * Linhas de embarque hidratadas do SQL (em memória). Não lê espelho JSON da BD.
 */
export function getEmbarqueItensLinhas(embarque) {
  if (!embarque) return [];
  if (Array.isArray(embarque._linhas)) return embarque._linhas;
  if (embarque._itens_fonte === 'sql' || embarque._itens_fonte === 'virtual') {
    return Array.isArray(embarque.itens_embarcados) && embarque.itens_embarcados.length
      ? embarque.itens_embarcados
      : (Array.isArray(embarque.itens) ? embarque.itens : []);
  }
  return [];
}

function attachLinhasEmbarque(embarque, mirror, fonte) {
  const { itens: _i, itens_embarcados: _ie, _linhas: _l, ...rest } = embarque || {};
  return {
    ...rest,
    _linhas: mirror,
    itens: mirror,
    itens_embarcados: mirror,
    _itens_fonte: fonte,
  };
}

/**
 * Busca linhas canónicas EmbarqueItem para vários embarques.
 * @returns {Map<string, object[]>} embarque_id → linhas ordenadas
 */
export async function fetchEmbarqueItensPorEmbarques(base44, embarqueIds = []) {
  const ids = [...new Set((embarqueIds || []).filter(Boolean))];
  const byEmbarque = new Map();
  if (!ids.length) return byEmbarque;

  const ei = base44?.entities?.EmbarqueItem;
  if (!ei?.filter) return byEmbarque;

  const allRows = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    const batches = await Promise.all(
      chunk.map((embarqueId) => ei.filter({ embarque_id: embarqueId }).catch(() => [])),
    );
    batches.flat().forEach((row) => allRows.push(row));
  }

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

/** Hidrata linhas só a partir de EmbarqueItem (SQL). Sem fallback JSON. */
export async function hydrateEmbarquesFromSql(base44, embarques = []) {
  if (!Array.isArray(embarques) || !embarques.length) return embarques || [];

  const byEmbarque = await fetchEmbarqueItensPorEmbarques(
    base44,
    embarques.map((e) => e.id).filter(Boolean),
  );

  return embarques.map((embarque) => {
    const sqlRows = byEmbarque.get(embarque.id);
    if (sqlRows?.length) {
      return attachLinhasEmbarque(embarque, rebuildEmbarqueItensMirror(sqlRows), 'sql');
    }
    return attachLinhasEmbarque(embarque, [], 'vazio');
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

  return embarques.map((emb) => {
    const rows = byEmb[emb.id];
    if (!rows?.length) {
      return attachLinhasEmbarque(emb, [], 'vazio');
    }
    return attachLinhasEmbarque(emb, rebuildEmbarqueItensMirror(rows), 'sql');
  });
}
