/**
 * Consistência entre PedidoCompra e LancamentoFinanceiro na reabertura / reenvio ao financeiro.
 */

import { calcTotalItemCompraPedido } from '@/lib/productUnits';
import { isLancamentoCancelado, isLancamentoPago } from '@/lib/lancamentoFinanceiroStatus';
import { dataHoje, formatarLogTime } from '@/components/utils/dateUtils';

const roundToTwoDecimals = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Total da linha: prioriza `total` gravado no item (formulário); senão recalcula. */
export function getTotalLinhaPedidoCompra(item = {}) {
  const totalDireto = Number(item?.total ?? item?.valor_total_item ?? item?.subtotal);
  if (Number.isFinite(totalDireto) && totalDireto > 0) return totalDireto;
  return calcTotalItemCompraPedido(item);
}

/** Soma dos totais de linha; `valor_itens` só entra se não houver itens no espelho. */
export function calcValorItensPedidoCompra(pedido = {}) {
  const itens = pedido.itens || [];
  if (itens.length > 0) {
    return roundToTwoDecimals(
      itens.reduce((acc, item) => acc + getTotalLinhaPedidoCompra(item), 0),
    );
  }
  const valorItensDireto = Number(pedido.valor_itens);
  if (Number.isFinite(valorItensDireto) && valorItensDireto > 0) {
    return roundToTwoDecimals(valorItensDireto);
  }
  return 0;
}

/** Total do pedido: itens + frete − desconto global (mesma regra do formulário). */
export function calcValorTotalPedidoCompra(pedido = {}) {
  const itens = calcValorItensPedidoCompra(pedido);
  const frete = Number(pedido.valor_frete) || 0;
  const desconto = Number(pedido.valor_desconto) || 0;
  return roundToTwoDecimals(itens + frete - desconto);
}

const statusCancelavel = (l) =>
  l?.status === 'Em Aberto' || l?.status === 'Vencido';

export async function listarLancamentosPedidoCompra(base44, pedidoId) {
  if (!pedidoId) return [];
  const [porVinculo, porReferencia] = await Promise.all([
    base44.entities.LancamentoFinanceiro.filter({ pedido_compra_vinculado_id: pedidoId }),
    base44.entities.LancamentoFinanceiro.filter({
      referencia_id: pedidoId,
      referencia_tipo: 'PedidoCompra',
    }),
  ]);
  const merged = [...(porVinculo || []), ...(porReferencia || [])];
  return merged.filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index);
}

export function temLancamentoPagoParaPedido(lancamentos) {
  return (lancamentos || []).some(isLancamentoPago);
}

/** Parcelas CMV / conta a pagar vinculadas ao pedido (exclui canceladas). */
export function filtrarLancamentosCompraPedido(pedidoId, lancamentos = []) {
  if (!pedidoId) return [];
  return (lancamentos || []).filter(
    (l) =>
      !isLancamentoCancelado(l) &&
      (l.referencia_tipo === 'PedidoCompra' ||
        l.pedido_compra_vinculado_id === pedidoId ||
        l.is_custo_mercadoria),
  );
}

/**
 * Parcelas CMV já pagas (valor coberto ou todas quitadas).
 * Usado como evidência de que o financeiro já executou o fluxo — não é o status do pedido.
 */
export function pedidoParcelasCmvPagas(lancamentos, pedido = {}) {
  const compraLancs = filtrarLancamentosCompraPedido(pedido.id, lancamentos);
  if (!compraLancs.length) return false;

  const totalEsperado = calcValorTotalPedidoCompra(pedido);
  const totalPago = compraLancs
    .filter(isLancamentoPago)
    .reduce((sum, l) => sum + Number(l.valor || 0), 0);

  if (totalEsperado > 0 && totalPago >= totalEsperado - 0.02) return true;
  return compraLancs.every(isLancamentoPago);
}

/** @deprecated Prefer pedidoParcelasCmvPagas — nome antigo mantido por compatibilidade. */
export function pedidoPagamentoCompleto(lancamentos, pedido = {}) {
  return pedidoParcelasCmvPagas(lancamentos, pedido);
}

const NOTA_APROVACAO_FINANCEIRA_RE = /\[(Aprovado Financeiramente|Aprovado:)/i;

/**
 * Evidência de que a aprovação financeira do pedido já ocorreu (no pedido ou nos lançamentos),
 * mesmo quando `status_aprovacao_financeira` do pedido ficou desatualizado.
 */
export function evidenciaAprovacaoFinanceiraProcessada(pedido = {}, lancamentos = []) {
  if (pedido.data_aprovacao_financeira) return true;

  const historico = pedido.historico || '';
  if (NOTA_APROVACAO_FINANCEIRA_RE.test(historico)) return true;

  const compraLancs = filtrarLancamentosCompraPedido(pedido.id, lancamentos);
  if (!compraLancs.length) return false;

  if (pedidoParcelasCmvPagas(lancamentos, pedido)) return true;

  return compraLancs.some((l) => NOTA_APROVACAO_FINANCEIRA_RE.test(l.observacoes || ''));
}

/** Pedido ainda marcado como aguardando aprovação financeira nos campos de status. */
export function pedidoStatusIndicaAguardandoAprovacaoFinanceira(pedido = {}) {
  const status = pedido.status || '';
  const saf = pedido.status_aprovacao_financeira || '';
  return (
    status === 'Aguardando Aprovação Financeira' ||
    status === 'Aguardando Liberação' ||
    saf === 'Aguardando Aprovação Financeira'
  );
}

/** Pedido com status pendente mas lançamentos/histórico indicam aprovação financeira já feita. */
export function pedidoPrecisaSincronizarAprovacaoFinanceira(pedido = {}, lancamentos = []) {
  if (!pedidoStatusIndicaAguardandoAprovacaoFinanceira(pedido)) return false;
  return evidenciaAprovacaoFinanceiraProcessada(pedido, lancamentos);
}

/** Status financeiro efetivo para exibição (considera lançamentos quando o pedido está desatualizado). */
export function getPedidoCompraDisplayStatusFinanceiro(pedido = {}, lancamentos = []) {
  const aprovadoEfetivo =
    pedido._financeiro_aprovado_efetivo || evidenciaAprovacaoFinanceiraProcessada(pedido, lancamentos);

  if (aprovadoEfetivo) return 'Aprovado Financeiramente';

  const saf = pedido.status_aprovacao_financeira || '';
  if (saf === 'Rejeitado Financeiramente' || saf === 'Rejeitado') return saf;
  if (saf === 'Solicitação de Edição Pendente') return saf;
  if (pedidoStatusIndicaAguardandoAprovacaoFinanceira(pedido)) {
    return 'Aguardando Aprovação Financeira';
  }
  if (saf) return saf;
  return pedido.status || 'Rascunho';
}

/** Rótulo curto do status financeiro para cabeçalho / lista. */
export function getPedidoCompraDisplayStatusFinanceiroLabel(status = '') {
  if (
    status === 'Aguardando Liberação Financeira' ||
    status === 'Aguardando Aprovação Financeira' ||
    status === 'Aguardando Liberação'
  ) {
    return 'Aguard. Pgto';
  }
  if (status === 'Aprovado Financeiramente' || status === 'Aprovado') return 'Aprovado';
  return status;
}

export async function carregarLancamentosPedidosCompraMap(base44, pedidoIds = []) {
  const map = new Map();
  const ids = [...new Set((pedidoIds || []).filter(Boolean))];
  await Promise.all(
    ids.map(async (id) => {
      const lancs = await listarLancamentosPedidoCompra(base44, id);
      map.set(id, lancs);
    }),
  );
  return map;
}

export function enriquecerPedidoCompraFinanceiroDisplay(pedido = {}, lancamentos = []) {
  const aprovadoEfetivo = evidenciaAprovacaoFinanceiraProcessada(pedido, lancamentos);
  return {
    ...pedido,
    _lancamentos_compra: lancamentos,
    _financeiro_aprovado_efetivo: aprovadoEfetivo,
    _display_status_financeiro: getPedidoCompraDisplayStatusFinanceiro(
      { ...pedido, _financeiro_aprovado_efetivo: aprovadoEfetivo },
      lancamentos,
    ),
  };
}

/**
 * Enriquece pedidos/cards com evidência financeira para exibição (embarques, cabeçalho).
 * @returns {{ pedidos: Array, cards: Array }}
 */
export async function enriquecerPedidosCompraGestaoFinanceiro(base44, pedidos = [], cards = []) {
  const candidatos = pedidos.filter((p) => pedidoStatusIndicaAguardandoAprovacaoFinanceira(p));
  if (!candidatos.length) return { pedidos, cards };

  const lancMap = await carregarLancamentosPedidosCompraMap(
    base44,
    candidatos.map((p) => p.id),
  );

  const pedidosEnriquecidos = pedidos.map((pedido) => {
    const lancs = lancMap.get(pedido.id);
    if (!lancs) return pedido;
    return enriquecerPedidoCompraFinanceiroDisplay(pedido, lancs);
  });

  const pedidosPorId = new Map(pedidosEnriquecidos.map((p) => [p.id, p]));
  const cardsEnriquecidos = cards.map((card) => {
    const pedidoBase = pedidosPorId.get(card.id);
    if (!pedidoBase?._financeiro_aprovado_efetivo) return card;
    return {
      ...card,
      _financeiro_aprovado_efetivo: pedidoBase._financeiro_aprovado_efetivo,
      _display_status_financeiro: pedidoBase._display_status_financeiro,
      _lancamentos_compra: pedidoBase._lancamentos_compra,
    };
  });

  return { pedidos: pedidosEnriquecidos, cards: cardsEnriquecidos };
}

/**
 * Cancela parcelas Em Aberto / Vencido vinculadas ao pedido (não pagas).
 * @returns {{ cancelados: number }}
 */
export async function cancelarLancamentosNaoPagosPedidoCompra(base44, pedidoId, notaObservacao) {
  const lancamentos = await listarLancamentosPedidoCompra(base44, pedidoId);
  const alvos = lancamentos.filter((l) => statusCancelavel(l) && !isLancamentoPago(l));
  const sufixo = notaObservacao ? ` ${notaObservacao}` : '';

  await Promise.all(
    alvos.map((l) =>
      base44.entities.LancamentoFinanceiro.update(l.id, {
        status: 'Cancelado',
        observacoes: `${l.observacoes || ''}\n[Cancelado: reabertura/correção do pedido]${sufixo}`.trim(),
      })
    )
  );

  return { cancelados: alvos.length };
}

/**
 * Gera lançamento de ajuste quando um pedido com parcelas pagas muda de valor.
 * Diferenca > 0: despesa (conta a pagar). Diferenca < 0: receita (conta a receber).
 */
export async function criarLancamentoAjustePedidoCompra(base44, {
  pedido = {},
  diferenca = 0,
  valorAnterior = 0,
  valorNovo = 0,
  motivo = '',
  responsavel = '',
} = {}) {
  const diff = roundToTwoDecimals(diferenca);
  if (!pedido?.id || Math.abs(diff) < 0.01) return null;

  const contaPagar = diff > 0;
  const valorAjuste = Math.abs(diff);
  const numeroPedido = pedido.numero || pedido.id;
  const tipo = contaPagar ? 'Despesa' : 'Receita';
  const descricao = contaPagar
    ? `Ajuste de Pedido (diferença a pagar) - ${numeroPedido}`
    : `Ajuste de Pedido (diferença a receber) - ${numeroPedido}`;
  const observacoesBase = [
    '[Ajuste automático por edição de pedido com pagamento já realizado]',
    `Valor anterior: R$ ${Number(valorAnterior || 0).toFixed(2)}`,
    `Valor novo: R$ ${Number(valorNovo || 0).toFixed(2)}`,
    `Diferença: ${contaPagar ? '+' : '-'}R$ ${valorAjuste.toFixed(2)}`,
    motivo ? `Motivo: ${motivo}` : '',
    responsavel ? `Responsável: ${responsavel}` : '',
    `Data: ${formatarLogTime()}`,
  ].filter(Boolean).join('\n');

  return base44.entities.LancamentoFinanceiro.create({
    tipo,
    descricao,
    valor: valorAjuste,
    valor_liquido: valorAjuste,
    status: 'Em Aberto',
    categoria: 'Ajuste de Pedido de Compra',
    tags: [contaPagar ? 'conta_pagar' : 'conta_receber', 'ajuste_pedido_compra'],
    terceiro_id: pedido.fornecedor_id || '',
    terceiro_nome: pedido.fornecedor_nome || '',
    data_vencimento: dataHoje(),
    referencia_id: pedido.id,
    referencia_tipo: 'PedidoCompra',
    referencia_numero: numeroPedido,
    pedido_compra_vinculado_id: pedido.id,
    pedido_compra_vinculado_numero: numeroPedido,
    is_custo_mercadoria: !!contaPagar,
    observacoes: observacoesBase,
  });
}
