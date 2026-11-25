import {
  contasSelModoTodasContas,
  isContaOcultaSaldoPadrao,
  isContaTransicao,
} from '@/lib/filtroDataFinanceiro';

const STORAGE_KEY = 'p38-financeiro-contas-saldo';
const STORAGE_MIGRACAO_FLUXO_OCULTAS = 'p38-financeiro-contas-saldo-mig-fluxo-ocultas-v1';

/** Remove PP/PJ gravados por engano; vazio volta ao padrão do Fluxo. */
export function sanitizarPreferenciasSaldoContas(contasIds = [], contas = []) {
  if (!contasIds?.length) return [];
  const operacionais = (contas || []).filter((c) => c && c.ativo !== false && !isContaTransicao(c));
  const allIds = new Set(operacionais.map((c) => c.id));
  const ocultas = new Set(
    operacionais.filter((c) => isContaOcultaSaldoPadrao(c)).map((c) => c.id),
  );
  const valid = contasIds.filter((id) => allIds.has(id));
  if (valid.some((id) => ocultas.has(id))) {
    return valid.filter((id) => !ocultas.has(id));
  }
  return valid;
}

/**
 * Preferência antiga gravava todos os IDs (PP/PJ) quando vazio = "todas".
 * Uma vez: volta ao padrão operacional (`[]`) se ainda incluir contas ocultas em modo "todas".
 */
export function migrarPreferenciasSaldoLegadoFluxo(contasIds = [], contas = []) {
  if (!contasIds?.length || typeof window === 'undefined') return contasIds;
  if (localStorage.getItem(STORAGE_MIGRACAO_FLUXO_OCULTAS)) return contasIds;
  const operacionais = (contas || []).filter((c) => c && c.ativo !== false && !isContaTransicao(c));
  if (!contasSelModoTodasContas(contasIds, operacionais)) return contasIds;
  const ocultas = operacionais.filter((c) => isContaOcultaSaldoPadrao(c));
  if (!ocultas.some((c) => contasIds.includes(c.id))) return contasIds;
  try {
    localStorage.setItem(STORAGE_MIGRACAO_FLUXO_OCULTAS, '1');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ contasIds: [] }));
  } catch {
    /* ignore */
  }
  return [];
}

/** IDs incluídos no chip de saldo; vazio = padrão operacional (ver contasSelEfetivoFluxo). */
export function lerPreferenciasSaldoContas() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.contasIds)
      ? parsed.contasIds.filter((id) => typeof id === 'string' && id.length > 0)
      : [];
  } catch {
    return [];
  }
}

export function gravarPreferenciasSaldoContas(contasIds = []) {
  if (typeof window === 'undefined') return;
  try {
    const ids = Array.isArray(contasIds)
      ? contasIds.filter((id) => typeof id === 'string' && id.length > 0)
      : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ contasIds: ids }));
  } catch {
    /* ignore */
  }
}

/** Contas que compõem o total do chip carteira/saldo. */
export function contasParaSaldoKpi(contasSaldoSel = [], contas = []) {
  const operacionais = (contas || []).filter((c) => c && !isContaTransicao(c));
  if (!contasSaldoSel?.length) {
    return operacionais.filter((c) => !isContaOcultaSaldoPadrao(c));
  }
  const ids = new Set(contasSaldoSel);
  return operacionais.filter((c) => ids.has(c.id));
}

export function labelContasSaldoSelecionadas(contasSaldoSel = [], contas = []) {
  const opcoes = (contas || []).filter((c) => c && !isContaTransicao(c));
  if (!opcoes.length) return 'Saldo';
  if (!contasSaldoSel?.length || contasSaldoSel.length >= opcoes.length) {
    return 'Todas no saldo';
  }
  if (contasSaldoSel.length === 1) {
    const nome = opcoes.find((c) => c.id === contasSaldoSel[0])?.nome;
    return nome ? `Saldo: ${nome}` : '1 conta no saldo';
  }
  return `${contasSaldoSel.length} contas no saldo`;
}
