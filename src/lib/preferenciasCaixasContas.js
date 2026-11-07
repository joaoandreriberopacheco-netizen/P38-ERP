import { contasIdsContasPrincipaisCorte } from '@/lib/corteFinanceiroAbertura';

const STORAGE_KEY = 'p38-financeiro-caixas-contas-sel';

export function contasSelPadraoGestaoCaixas(contas = []) {
  const ids = contasIdsContasPrincipaisCorte(contas);
  if (ids.length) return ids;
  return (contas || []).filter((c) => c && c.ativo !== false).map((c) => c.id);
}

/** IDs efectivos na aba Caixas; vazio = quatro contas principais do corte. */
export function contasSelEfetivoGestaoCaixas(contasSel = [], contas = []) {
  const ativas = (contas || []).filter((c) => c && c.ativo !== false);
  const allIds = new Set(ativas.map((c) => c.id));
  if (!contasSel?.length) {
    return contasSelPadraoGestaoCaixas(ativas).filter((id) => allIds.has(id));
  }
  return contasSel.filter((id) => allIds.has(id));
}

export function lerPreferenciasCaixasContas() {
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

export function gravarPreferenciasCaixasContas(contasIds = []) {
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
