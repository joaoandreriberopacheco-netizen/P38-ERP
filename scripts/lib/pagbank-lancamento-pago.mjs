/**
 * Campos de lançamento já liquidado na conta PagBank (ERP Caixas / Fluxo).
 * Espelha a intenção de `camposCartaoCreditoPagBankImediato` em src/lib/contaPagBank.js.
 *
 * Isto actualiza a BD P38 (lançamento_financeiro), não o app/site externo da PagBank.
 */
export function camposLancamentoPagBankPago(dataPagamentoKey) {
  const dia = String(dataPagamentoKey || '').slice(0, 10);
  return {
    data_pagamento: dia,
    data_liquidacao_prevista: dia,
    status: 'Pago',
    status_conciliacao: 'Conciliado',
  };
}
