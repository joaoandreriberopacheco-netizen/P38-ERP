import { conferenciaItemRowToCountEntry } from '@/lib/conferenciaItemContract';

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

export async function fetchConferenciaItensPorConferencias(base44, conferenciaIds = []) {
  const ids = [...new Set((conferenciaIds || []).filter(Boolean))];
  const byConferencia = new Map();
  if (!ids.length) return byConferencia;

  const ci = base44?.entities?.ConferenciaItem;
  if (!ci?.filter) return byConferencia;

  const allRows = await fetchRowsByCampoIn(ci, 'conferencia_id', ids);

  for (const row of allRows) {
    const cid = row?.conferencia_id;
    if (!cid) continue;
    if (!byConferencia.has(cid)) byConferencia.set(cid, []);
    byConferencia.get(cid).push(row);
  }

  for (const rows of byConferencia.values()) {
    rows.sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
  }

  return byConferencia;
}

function attachItensConferidos(conferencia, itens, fonte) {
  const { itens_conferidos: _i, _itens_fonte: _f, ...rest } = conferencia || {};
  return {
    ...rest,
    itens_conferidos: itens,
    _itens_fonte: fonte,
  };
}

/** Hidrata `itens_conferidos` a partir de ConferenciaItem (SQL). Fallback JSON só se SQL vazio. */
export async function hydrateConferenciasItensFromSql(base44, conferencias = []) {
  if (!Array.isArray(conferencias) || !conferencias.length) return conferencias || [];

  const byConferencia = await fetchConferenciaItensPorConferencias(
    base44,
    conferencias.map((c) => c.id).filter(Boolean),
  );

  return conferencias.map((conferencia) => {
    const sqlRows = byConferencia.get(conferencia.id);
    if (sqlRows?.length) {
      return attachItensConferidos(
        conferencia,
        sqlRows.map(conferenciaItemRowToCountEntry),
        'sql',
      );
    }
    const legado = Array.isArray(conferencia?.itens_conferidos) ? conferencia.itens_conferidos : [];
    return attachItensConferidos(conferencia, legado, legado.length ? 'json-legado' : 'vazio');
  });
}
