import { dataHoje } from '@/components/utils/dateUtils';

/** Conta a pagar reconhecida pela tag (padrão do sistema). */
export function lancamentoEhContaPagar(l) {
  return Boolean(l && Array.isArray(l.tags) && l.tags.includes('conta_pagar'));
}

/** Despesa CMV (custo mercadoria vendida). */
export function lancamentoEhCmv(l) {
  if (!l) return false;
  if (l.is_custo_mercadoria === true) return true;
  const tags = Array.isArray(l.tags) ? l.tags : [];
  if (tags.includes('cmv')) return true;
  const cat = String(l.categoria || '').toLowerCase();
  return cat.includes('cmv') || cat.includes('custo de mercadoria');
}

/**
 * Pagamento originado da aba Fretes do Itinerário Fluvial (conta vinculada ao evento logístico).
 */
export function lancamentoEhFreteItinerario(l) {
  if (!l) return false;
  if (l.referencia_tipo === 'EventosLogisticos') return true;
  const tags = Array.isArray(l.tags) ? l.tags : [];
  return tags.includes('frete') || tags.includes('conta_frete');
}

export function lancamentoPago(l) {
  return l?.status === 'Pago';
}

/** Conta encerrada administrativamente — não deve aparecer na consulta Agefin nem como dívida. */
export function lancamentoCancelado(l) {
  const tags = Array.isArray(l?.tags) ? l.tags.map((t) => String(t).toLowerCase()) : [];
  if (tags.includes('cancelado') || tags.includes('cancelada')) return true;
  const raw = l?.status;
  if (raw == null || raw === '') return false;
  const s = String(raw).trim().toLowerCase();
  return s === 'cancelado' || s === 'cancelada';
}

/**
 * Conta em atraso = não paga, não cancelada, vencimento **anterior** ao dia civil de hoje (Tabatinga).
 * O campo `status` no banco pode ficar desatualizado (ex.: «Vencido» com data futura após adiar vencimento);
 * a UI e o PDF usam só a data.
 */
export function lancamentoVencidoOuAtrasado(l, todayKey = dataHoje()) {
  if (!l?.data_vencimento || lancamentoPago(l) || lancamentoCancelado(l)) return false;
  return `${l.data_vencimento}`.slice(0, 10) < todayKey;
}

/**
 * Ao gravar, alinha status «Em Aberto» / «Vencido» ao vencimento (não altera Pago/Cancelado).
 */
export function reconciliarStatusLancamentoPorVencimento(lancamento, dataVencimentoYmd, todayKey = dataHoje()) {
  if (!lancamento || lancamentoPago(lancamento) || lancamentoCancelado(lancamento)) return {};
  const ven = `${dataVencimentoYmd ?? lancamento.data_vencimento ?? ''}`.slice(0, 10);
  if (!ven) return {};
  const s = String(lancamento.status || 'Em Aberto').trim();
  if (ven < todayKey && s === 'Em Aberto') return { status: 'Vencido' };
  if (ven >= todayKey && s === 'Vencido') return { status: 'Em Aberto' };
  return {};
}

export function lancamentoEmDia(l, todayKey = dataHoje()) {
  if (lancamentoCancelado(l)) return false;
  if (lancamentoPago(l)) return true;
  return !lancamentoVencidoOuAtrasado(l, todayKey);
}

function normalizarFormaPagamento(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/**
 * Compromissos que entram na pauta de vencimentos do mês (Visão Financeira / consulta).
 * Inclui contas pontuais, fretes de itinerário e compras de mercadoria (estas só informativas).
 */
export function lancamentoElegivelPautaMes(l) {
  if (!l || l.tipo !== 'Despesa' || lancamentoCancelado(l)) return false;
  if (lancamentoCompraMercadoriaPedidoPagamentoAVista(l)) return false;
  if (lancamentoEhFreteItinerario(l)) return true;
  if (lancamentoEhContaPagar(l)) return true;
  if (lancamentoEhCmv(l)) return true;
  if (lancamentoEhCompraMercadoriaPedido(l)) return true;
  return false;
}

/**
 * Compra de mercadoria vinculada a pedido (fluxo de aprovação financeira do PedidoCompra).
 */
export function lancamentoEhCompraMercadoriaPedido(l) {
  if (!l || l.referencia_tipo !== 'PedidoCompra') return false;
  if (l.is_custo_mercadoria === true) return true;
  const cat = String(l.categoria || '').toLowerCase();
  return cat.includes('compra de mercadoria');
}

/**
 * À vista nesse fluxo não entra na Agefin Consulta (contas a exibir para acompanhamento),
 * mesmo com tag conta_pagar.
 */
export function lancamentoCompraMercadoriaPedidoPagamentoAVista(l) {
  if (!lancamentoEhCompraMercadoriaPedido(l)) return false;
  const fp = normalizarFormaPagamento(l.forma_pagamento_tipo || l.forma_pagamento_compra || l.forma_pagamento);
  if (fp.includes('a vista') || fp === 'avista') return true;
  const d = String(l.descricao || '');
  if (/\(\s*[àa]\s*vista\s*\)/i.test(d)) return true;
  return false;
}
