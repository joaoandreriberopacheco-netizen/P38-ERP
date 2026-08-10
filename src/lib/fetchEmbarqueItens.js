import { rebuildEmbarqueItensMirror } from '@/lib/embarqueItemContract';

const CHUNK_SIZE = 40;

/**
 * Linhas de um embarque já hidratado (SQL → espelho) ou legado.
 * Preferir chamar hydrateEmbarquesFromSql antes de usar em fluxos críticos.
 */
export function getEmbarqueItensLinhas(embarque) {
  if (!embarque) return [];
  if (Array.isArray(embarque.itens_embarcados) && embarque.itens_embarcados.length > 0) {
    return embarque.itens_embarcados;
  }
  return Array.isArray(embarque.itens) ? embarque.itens : [];
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

/**
 * Prioriza SQL; espelho `itens` / `itens_embarcados` só como fallback.
 */
export async function hydrateEmbarquesFromSql(base44, embarques = []) {
  if (!Array.isArray(embarques) || !embarques.length) return embarques || [];

  const byEmbarque = await fetchEmbarqueItensPorEmbarques(
    base44,
    embarques.map((e) => e.id).filter(Boolean),
  );

  return embarques.map((embarque) => {
    const sqlRows = byEmbarque.get(embarque.id);
    if (sqlRows?.length) {
      const mirror = rebuildEmbarqueItensMirror(sqlRows);
      return {
        ...embarque,
        itens: mirror,
        itens_embarcados: mirror,
        _itens_fonte: 'sql',
      };
    }
    const legado =
      (Array.isArray(embarque.itens_embarcados) && embarque.itens_embarcados.length > 0
        ? embarque.itens_embarcados
        : Array.isArray(embarque.itens)
          ? embarque.itens
          : []);
    return {
      ...embarque,
      itens: legado,
      itens_embarcados: legado,
      _itens_fonte: legado.length ? 'espelho' : 'vazio',
    };
  });
}

/**
 * Hidrata embarques de um pedido — útil no detalhe do pedido.
 * Mantém compatibilidade com hydrateEmbarquesLinhasDesdeCanonical.
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
      const legado =
        (Array.isArray(emb.itens_embarcados) && emb.itens_embarcados.length > 0
          ? emb.itens_embarcados
          : Array.isArray(emb.itens)
            ? emb.itens
            : []);
      return { ...emb, _itens_fonte: legado.length ? 'espelho' : 'vazio' };
    }
    const mirror = rebuildEmbarqueItensMirror(rows);
    return {
      ...emb,
      itens: mirror,
      itens_embarcados: mirror,
      _itens_fonte: 'sql',
    };
  });
}
