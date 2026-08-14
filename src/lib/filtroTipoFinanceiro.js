import {
  isMovimentoTransferenciaCaixaPDV,
  isTransferenciaEntreContas,
} from '@/lib/saldoContaFinanceira';

export const TIPOS_LANCAMENTO_FILTRO = ['Receita', 'Despesa', 'Transferência'];

/** Normaliza tipos de movimento (PDV, legado) para o filtro de Receita/Despesa. */
export function normalizarTipoFinanceiro(item) {
  let tipo = item?.tipo;
  if (tipo === 'Reforço') tipo = 'Receita';
  if (tipo === 'Sangria' || tipo === 'Recolhimento de Caixa') tipo = 'Despesa';
  return tipo;
}

/** Classifica item bruto (lançamento ou movimento PDV) para o filtro de tipo. */
export function classificarTipoFiltroFinanceiro(item) {
  if (isMovimentoTransferenciaCaixaPDV(item)) return 'Transferência';
  if (isTransferenciaEntreContas(item)) return 'Transferência';
  return normalizarTipoFinanceiro(item);
}

/** `tiposSel` vazio = todos os tipos; caso contrário OR entre os selecionados. */
export function passaFiltroTiposLancamento(item, tiposSel = []) {
  if (!tiposSel?.length) return true;
  return tiposSel.includes(classificarTipoFiltroFinanceiro(item));
}

/** Linha já consolidada/projetada na lista (fluxo/extrato). */
export function passaFiltroTiposItemExibicao(item, tiposSel = []) {
  if (!tiposSel?.length) return true;
  if (
    item?.isTransferenciaConsolidada
    || item?.tipoExibicao === 'Transferência'
    || item?.tipo === 'Transferência'
  ) {
    return tiposSel.includes('Transferência');
  }
  return passaFiltroTiposLancamento(item, tiposSel);
}

export function labelTiposSelecionados(tiposSel = []) {
  if (!tiposSel.length) return null;
  return tiposSel.join(', ');
}

/** Remove itens fora do filtro de tipo e grupos vazios (pós-consolidação). */
export function filtrarGruposPorTipo(grupos = [], tiposSel = []) {
  if (!tiposSel?.length) return grupos;
  return grupos
    .map((g) => ({
      ...g,
      items: (g.items || []).filter((item) => passaFiltroTiposItemExibicao(item, tiposSel)),
    }))
    .filter((g) => g.items.length > 0);
}
