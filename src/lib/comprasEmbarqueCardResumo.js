import { formatQuantity } from '@/lib/financialUtils';
import { formatCommercialQuantity } from '@/lib/productUnits';
import { isNecessidadeRenderizada } from '@/lib/pedidoCompraNecessidade';

function formatCardQuantity(value, unitSuffix) {
  if (!unitSuffix || unitSuffix === 'un.') return formatQuantity(value);
  return formatCommercialQuantity(value, unitSuffix);
}

function resolveItensDisplay(card = {}) {
  if (Array.isArray(card._consulta_itens) && card._consulta_itens.length > 0) {
    return card._consulta_itens;
  }
  if (Array.isArray(card._display_itens) && card._display_itens.length > 0) {
    return card._display_itens;
  }
  return Array.isArray(card.itens) ? card.itens : [];
}

function resolveSufixoUnidade(itens = []) {
  const unidades = [...new Set(itens.map((i) => String(i.unidade_medida || '').trim()).filter(Boolean))];
  return unidades.length === 1 ? unidades[0] : 'un.';
}

function isCardNecessidade(card = {}) {
  return !!card._is_necessidade || isNecessidadeRenderizada(card._embarque);
}

/** Quantidade comercial do split: embarcada (ou pendente na Necessidade). */
export function resolveQuantidadeEmbarcadaCard(card = {}) {
  if (isCardNecessidade(card)) {
    const pend = Number(card._quantidade_pendente) || 0;
    if (pend > 0) return pend;
  }

  const itens = resolveItensDisplay(card);
  const somaEmbarcada = itens.reduce((a, i) => a + (Number(i.quantidade_embarcada) || 0), 0);
  if (somaEmbarcada > 0) return somaEmbarcada;

  return itens.reduce((a, i) => a + (Number(i.quantidade) || 0), 0);
}

/** Resumo de linhas + quantidade para cards de embarque (lista e relatórios). */
export function buildEmbarqueCardQtdResumo(card = {}) {
  const itens = resolveItensDisplay(card);
  const totalLinhas = itens.length;
  const sufixoUnidade = resolveSufixoUnidade(itens);
  const qtdEmbarcada = resolveQuantidadeEmbarcadaCard(card);
  const necessidade = isCardNecessidade(card);

  const qtdLabel = necessidade
    ? (qtdEmbarcada > 0 ? `${formatCardQuantity(qtdEmbarcada, sufixoUnidade)} ${sufixoUnidade} pend.` : '')
    : (qtdEmbarcada > 0 ? `${formatCardQuantity(qtdEmbarcada, sufixoUnidade)} ${sufixoUnidade}` : '');

  return {
    totalLinhas,
    qtdEmbarcada,
    qtdLabel,
    sufixoUnidade,
    necessidade,
  };
}

/** Linha compacta da lista: `6 itens · 109 CX`. */
export function formatEmbarqueCardItensLinha(card = {}, { separator = ' · ' } = {}) {
  const { totalLinhas, qtdLabel } = buildEmbarqueCardQtdResumo(card);
  const itensTxt = `${totalLinhas} ${totalLinhas === 1 ? 'item' : 'itens'}`;
  return qtdLabel ? `${itensTxt}${separator}${qtdLabel}` : itensTxt;
}

/**
 * Cabeçalho dos relatórios PDF/mobile — mesma regra da lista (sem fração embarcado/pedido).
 * @param {{ fmtQty?: (n:number)=>string, itemWord?: string, separator?: string }} [opts]
 */
export function buildEmbarqueCardCountLabelRelatorio(card = {}, opts = {}) {
  const {
    fmtQty = (v) => String(v),
    itemWord = 'item(ns)',
    separator = ' · ',
  } = opts;
  const { totalLinhas, qtdEmbarcada, sufixoUnidade, necessidade } = buildEmbarqueCardQtdResumo(card);
  const itensTxt = `${totalLinhas} ${itemWord}`;

  if (necessidade) {
    return qtdEmbarcada > 0
      ? `${itensTxt}${separator}${fmtQty(qtdEmbarcada)} ${sufixoUnidade} pend.`
      : `${itensTxt} pendente(s)`;
  }

  if (qtdEmbarcada > 0) {
    return `${itensTxt}${separator}${fmtQty(qtdEmbarcada)} ${sufixoUnidade}`;
  }

  return itensTxt;
}
