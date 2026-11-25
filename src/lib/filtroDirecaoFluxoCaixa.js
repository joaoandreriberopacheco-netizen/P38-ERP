import {
  isMovimentoTransferenciaCaixaPDV,
  isTransferenciaEntreContas,
} from '@/lib/saldoContaFinanceira';
import { normalizarTipoFinanceiro } from '@/lib/filtroTipoFinanceiro';

/** '' = todos; 'entradas' | 'saidas' = filtro ativo no painel v8. */
export const DIRECAO_FLUXO_TODAS = '';
export const DIRECAO_FLUXO_ENTRADAS = 'entradas';
export const DIRECAO_FLUXO_SAIDAS = 'saidas';

/**
 * Transferências na lista (incl. linhas cinzas consolidadas) — nunca ocultar no filtro entrada/saída.
 */
export function linhaEhTransferenciaFluxoLista(item) {
  if (!item) return false;
  if (item.isTransferenciaConsolidada) return true;
  if (item.perspectivaTransferencia === 'neutra') return true;
  if (item.tipoExibicao === 'Transferência') return true;
  if (item.tipo === 'Transferência') return true;
  if (isMovimentoTransferenciaCaixaPDV(item)) return true;
  if (isTransferenciaEntreContas(item)) return true;
  return false;
}

/** Classifica linha não-transferência para o filtro somente entradas/saídas. */
export function classificarDirecaoLinhaFluxo(item) {
  if (!item || linhaEhTransferenciaFluxoLista(item)) return null;

  const perspectiva = item.perspectivaTransferencia;
  if (perspectiva === 'entrada') return DIRECAO_FLUXO_ENTRADAS;
  if (perspectiva === 'saida') return DIRECAO_FLUXO_SAIDAS;

  if (item.origem === 'movimento') {
    const tipo = item.tipo;
    if (tipo === 'Reforço' || tipo === 'Entrada' || tipo === 'Receita') return DIRECAO_FLUXO_ENTRADAS;
    if (
      tipo === 'Sangria'
      || tipo === 'Recolhimento de Caixa'
      || tipo === 'Saída'
      || tipo === 'Saida'
      || tipo === 'Despesa'
    ) {
      return DIRECAO_FLUXO_SAIDAS;
    }
  }

  const tipo = normalizarTipoFinanceiro(item);
  if (tipo === 'Receita') return DIRECAO_FLUXO_ENTRADAS;
  if (tipo === 'Despesa') return DIRECAO_FLUXO_SAIDAS;

  return null;
}

export function passaFiltroDirecaoFluxo(item, direcaoSel = DIRECAO_FLUXO_TODAS) {
  if (!direcaoSel) return true;
  if (linhaEhTransferenciaFluxoLista(item)) return true;
  const dir = classificarDirecaoLinhaFluxo(item);
  if (!dir) return true;
  return dir === direcaoSel;
}

export function filtrarGruposPorDirecao(grupos = [], direcaoSel = DIRECAO_FLUXO_TODAS) {
  if (!direcaoSel) return grupos;
  return grupos
    .map((g) => ({
      ...g,
      items: (g.items || []).filter((item) => passaFiltroDirecaoFluxo(item, direcaoSel)),
    }))
    .filter((g) => g.items.length > 0);
}

export function labelDirecaoFluxoSelecionada(direcaoSel) {
  if (direcaoSel === DIRECAO_FLUXO_ENTRADAS) return 'Somente entradas';
  if (direcaoSel === DIRECAO_FLUXO_SAIDAS) return 'Somente saídas';
  return null;
}
