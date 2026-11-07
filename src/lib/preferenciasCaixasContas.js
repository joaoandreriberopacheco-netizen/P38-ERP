import { contasIdsContasPrincipaisCorte } from '@/lib/corteFinanceiroAbertura';
import { tipoContaFinanceiraEfetivo } from '@/lib/contaPagBank';
import { isContaCaixaPDVFinanceiro } from '@/lib/filtroDataFinanceiro';

const STORAGE_KEY = 'p38-financeiro-caixas-contas-sel';
const STORAGE_MIGR_CAIXAS_SEM_PDV = 'p38-financeiro-caixas-sel-sem-pdv-v1';

export function contaComTipoEfetivoGestaoCaixas(conta) {
  if (!conta) return conta;
  const tipo = tipoContaFinanceiraEfetivo(conta);
  return tipo === conta.tipo ? conta : { ...conta, tipo };
}

export function contasComTipoEfetivoGestaoCaixas(contas = []) {
  return (contas || []).map(contaComTipoEfetivoGestaoCaixas);
}

export function contasSelPadraoGestaoCaixas(contas = []) {
  const ids = contasIdsContasPrincipaisCorte(contas);
  if (ids.length) return ids;
  return (contas || []).filter((c) => c && c.ativo !== false).map((c) => c.id);
}

/** Remove Caixa PDV de preferências gravadas (lista principal sem gaveta). */
export function migrarPreferenciasCaixasSemPdv(contasIds = [], contas = []) {
  if (typeof window === 'undefined') return contasIds;
  const pdvIds = new Set(
    (contas || []).filter((c) => isContaCaixaPDVFinanceiro(c)).map((c) => c.id),
  );
  if (!pdvIds.size) return contasIds;
  const filtrado = (contasIds || []).filter((id) => !pdvIds.has(id));
  const migrou = filtrado.length !== (contasIds || []).length;
  if (migrou && !localStorage.getItem(STORAGE_MIGR_CAIXAS_SEM_PDV)) {
    try {
      localStorage.setItem(STORAGE_MIGR_CAIXAS_SEM_PDV, '1');
      gravarPreferenciasCaixasContas(filtrado);
    } catch {
      /* ignore */
    }
  }
  return filtrado;
}

/** IDs efectivos na aba Caixas; vazio = três contas principais do corte (sem PDV). */
export function contasSelEfetivoGestaoCaixas(contasSel = [], contas = []) {
  const ativas = (contas || []).filter((c) => c && c.ativo !== false);
  const allIds = new Set(ativas.map((c) => c.id));
  if (!contasSel?.length) {
    return contasSelPadraoGestaoCaixas(ativas).filter((id) => allIds.has(id));
  }
  return contasSel.filter((id) => allIds.has(id));
}

export function lerPreferenciasCaixasContas(contas = []) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const ids = Array.isArray(parsed.contasIds)
      ? parsed.contasIds.filter((id) => typeof id === 'string' && id.length > 0)
      : [];
    return migrarPreferenciasCaixasSemPdv(ids, contas);
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
