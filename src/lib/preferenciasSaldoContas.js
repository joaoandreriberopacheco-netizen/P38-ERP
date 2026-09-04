import { isContaTransicao } from '@/lib/filtroDataFinanceiro';

const STORAGE_KEY = 'p38-financeiro-contas-saldo';

/** IDs incluídos no chip de saldo; vazio = todas as contas operacionais. */
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
  if (!contasSaldoSel?.length) return operacionais;
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
