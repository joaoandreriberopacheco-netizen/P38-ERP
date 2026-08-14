import { isTransferenciaEntreContas } from '@/lib/saldoContaFinanceira';

export const TIPOS_LANCAMENTO_FILTRO = ['Receita', 'Despesa', 'Transferência'];

/** Normaliza tipos de movimento (PDV, legado) para o filtro de Receita/Despesa. */
export function normalizarTipoFinanceiro(item) {
  let tipo = item?.tipo;
  if (tipo === 'Reforço') tipo = 'Receita';
  if (tipo === 'Sangria' || tipo === 'Recolhimento de Caixa') tipo = 'Despesa';
  return tipo;
}

/** `tiposSel` vazio = todos os tipos; caso contrário OR entre os selecionados. */
export function passaFiltroTiposLancamento(item, tiposSel = []) {
  if (!tiposSel?.length) return true;
  const tipo = normalizarTipoFinanceiro(item);
  const matchTipo = tiposSel.includes(tipo);
  const matchTransf = tiposSel.includes('Transferência') && isTransferenciaEntreContas(item);
  return matchTipo || matchTransf;
}

export function labelTiposSelecionados(tiposSel = []) {
  if (!tiposSel.length) return null;
  return tiposSel.join(', ');
}
