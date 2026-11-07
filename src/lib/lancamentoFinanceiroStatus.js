import { dataHoje } from '@/components/utils/dateUtils';
import { getDataChaveLancamento } from '@/lib/financialUtils';

/** Lançamento já pago (entra no fluxo de caixa realizado). */
export function isLancamentoPago(l) {
  return l?.status === 'Pago' || !!l?.data_pagamento;
}

export function isLancamentoCancelado(l) {
  return l?.status === 'Cancelado';
}

/** Cartão de crédito aguardando liquidação automática (Contas Abertas até o job das 08:00 GMT-5). */
export function isCartaoCreditoAguardandoLiquidacao(l) {
  if (!l || isLancamentoPago(l) || isLancamentoCancelado(l)) return false;
  return l.forma_pagamento_tipo === 'Cartão Crédito' && l.status_conciliacao === 'Pendente';
}

/** Cartão débito aguardando liquidação automática (mesma rotina das 08:00 GMT-5). */
export function isCartaoDebitoAguardandoLiquidacao(l) {
  if (!l || isLancamentoPago(l) || isLancamentoCancelado(l)) return false;
  return l.forma_pagamento_tipo === 'Cartão Débito' && l.status_conciliacao === 'Pendente';
}

/** Cartão (crédito ou débito) pendente de crédito na conta. */
export function isCartaoPendenteConciliacao(l) {
  return isCartaoCreditoAguardandoLiquidacao(l) || isCartaoDebitoAguardandoLiquidacao(l);
}

/** @deprecated Use isCartaoCreditoAguardandoLiquidacao */
export function isCartaoCreditoPendenteConciliacao(l) {
  return isCartaoCreditoAguardandoLiquidacao(l);
}

/** Valor no fluxo: líquido (após taxa) para cartão; bruto nos demais. */
export function getValorFluxoCaixa(l) {
  const fpt = l?.forma_pagamento_tipo;
  if (fpt === 'Cartão Crédito' || fpt === 'Cartão Débito') {
    const liquido = l.valor_liquido;
    if (liquido != null && liquido !== '') return Number(liquido) || 0;
  }
  return Number(l?.valor || 0);
}

/** @deprecated Use getValorFluxoCaixa */
export function getValorEfetivoLancamento(l) {
  return getValorFluxoCaixa(l);
}

/** Visível no Fluxo de Caixa somente após pago (ex.: liquidação automática 08:00 GMT-5 no cartão). */
export function isLancamentoRealizadoFluxo(l) {
  return isLancamentoPago(l);
}

/** Data usada para agrupar/filtrar no Fluxo de Caixa (prioriza `data_lancamento`). */
export function getDataAncoraFluxo(l) {
  const key = getDataChaveLancamento(l);
  if (!key) return l?.data_pagamento || l?.data_vencimento || null;
  return key;
}

export function getDataAncoraFluxoKey(l) {
  return getDataChaveLancamento(l);
}

/** Conta a pagar / aberta: em aberto e não cancelada. */
export function isLancamentoEmAberto(l) {
  if (!l || isLancamentoCancelado(l)) return false;
  if (l.tipo === 'Transferência') return false;
  return !isLancamentoPago(l);
}

export function isLancamentoVencido(l, hojeKey = dataHoje()) {
  if (!isLancamentoEmAberto(l)) return false;
  const venc = (l?.data_vencimento || '').slice(0, 10);
  return !!venc && venc < hojeKey;
}

/** Status para chips/labels na lista — prioriza pago real (data_pagamento) sobre campo `status` desatualizado. */
export function statusRotuloListaFinanceiro(l) {
  if (!l) return null;
  if (isLancamentoCancelado(l)) return 'Cancelado';
  if (isLancamentoPago(l)) return 'Pago';
  if (isLancamentoVencido(l)) return 'Vencido';
  const s = String(l.status || '').trim();
  if (s === 'Vencido' || s === 'Em Aberto' || s === 'Pago' || s === 'Cancelado') return s;
  return s || 'Em Aberto';
}

/** Tag `conta_pagar` / `conta_receber` / cartão / fiado — regra das contas abertas. */
export function lancamentoPassaFiltroContasAbertas(l) {
  if (isLancamentoCancelado(l) || l?.tipo === 'Transferência') return false;
  const tags = l?.tags || [];
  if (
    tags.includes('conta_pagar') ||
    tags.includes('conta_receber') ||
    tags.includes('CARTAO') ||
    tags.includes('FIADO')
  ) {
    return true;
  }
  if (tags.length > 0) return false;
  return true;
}

/** Valor em Contas Abertas: líquido para cartão pendente. */
export function getValorContaAberta(l) {
  if (isCartaoPendenteConciliacao(l)) {
    return getValorFluxoCaixa(l);
  }
  return Number(l?.valor || 0);
}
