import { DATA_CORTE_FINANCEIRO_ABERTURA } from '@/lib/corteFinanceiroAbertura';

/** Cartão crédito passa a creditar na PagBank na data do corte financeiro. */
export const DATA_INICIO_PAGBANK_CARTAO_CREDITO = DATA_CORTE_FINANCEIRO_ABERTURA;

export function normalizarNomeContaFinanceira(nome) {
  return String(nome || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function isNomeContaPagBank(nome) {
  const n = normalizarNomeContaFinanceira(nome);
  return n.includes('pagbank') || n.includes('pag bank');
}

export function findContaPagBank(contas = []) {
  return (contas || []).find((c) => c && isNomeContaPagBank(c.nome)) || null;
}

export function isContaPagBank(conta) {
  return conta ? isNomeContaPagBank(conta.nome) : false;
}

export function findContaBancoBrasil(contas = []) {
  return (contas || []).find((c) => {
    if (!c?.nome) return false;
    const n = normalizarNomeContaFinanceira(c.nome);
    return n.includes('brasil') && n.includes('banco');
  }) || null;
}

export function cartaoCreditoUsaPagBankImediato(dataVendaKey) {
  if (!dataVendaKey) return false;
  return String(dataVendaKey).slice(0, 10) >= DATA_INICIO_PAGBANK_CARTAO_CREDITO;
}

/** Lançamento de cartão crédito após o corte: PagBank, pago no mesmo dia. */
export function camposCartaoCreditoPagBankImediato(hojeKey) {
  if (!cartaoCreditoUsaPagBankImediato(hojeKey)) return null;
  const dia = String(hojeKey).slice(0, 10);
  return {
    data_vencimento: dia,
    data_liquidacao_prevista: dia,
    data_pagamento: dia,
    status: 'Pago',
    status_conciliacao: 'Conciliado',
    prazoDias: 0,
  };
}
