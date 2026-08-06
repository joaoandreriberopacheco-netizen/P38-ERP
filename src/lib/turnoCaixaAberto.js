import { base44 } from '@/api/base44Client';

/**
 * Turnos abertos do caixa PDV, do mais antigo ao mais recente.
 * Só pode haver um turno operacional por caixa; se existirem duplicados (legado/bug),
 * o canónico é sempre o de abertura mais antiga.
 */
export async function listTurnosAbertosParaCaixa(caixaId) {
  const id = String(caixaId ?? '').trim();
  if (!id) return [];

  const rows = await base44.entities.TurnoCaixa.filter({
    status: 'Aberto',
    conta_caixa_pdv_id: id,
  });
  const list = Array.isArray(rows) ? rows.filter(Boolean) : rows?.id ? [rows] : [];

  return list.sort(
    (a, b) => new Date(a.data_abertura || 0).getTime() - new Date(b.data_abertura || 0).getTime()
  );
}

/** Turno canónico = o mais antigo ainda aberto neste caixa. */
export async function findTurnoAbertoParaCaixa(caixaId, { warnDuplicates = true } = {}) {
  const turnos = await listTurnosAbertosParaCaixa(caixaId);
  if (turnos.length > 1 && warnDuplicates && typeof console !== 'undefined') {
    console.warn(
      `[PDV] ${turnos.length} turnos abertos no mesmo caixa. ` +
        `Usando ${turnos[0]?.numero} (mais antigo). Duplicados: ${turnos
          .slice(1)
          .map((t) => t.numero)
          .join(', ')}`
    );
  }
  return turnos[0] ?? null;
}

export function turnoAbertoMaisAntigo(turnos = [], caixaId) {
  const id = String(caixaId ?? '').trim();
  return (turnos || [])
    .filter((t) => t?.status === 'Aberto' && String(t.conta_caixa_pdv_id ?? '') === id)
    .sort(
      (a, b) => new Date(a.data_abertura || 0).getTime() - new Date(b.data_abertura || 0).getTime()
    )[0];
}
