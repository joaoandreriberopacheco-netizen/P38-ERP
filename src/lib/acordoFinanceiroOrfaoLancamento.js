/**
 * Identifica lançamentos de acordo por órfãos e se a baixa logística já foi aplicada.
 * Não existe tabela `acordo_financeiro` — o “documento” é o vínculo entre
 * lancamento_financeiro + pedido.historico + embarque_item.acordo_financeiro_lancamento_id.
 */

const PADRAO_TEXTO_ACORDO_ORFAO =
  /itens não entregues|acordo financeiro por itens órfãos|conta a receber por não entrega/i;

export function isLancamentoAcordoFinanceiroOrfao(lancamento = {}) {
  const blob = `${lancamento.descricao || ''} ${lancamento.observacoes || ''}`;
  return PADRAO_TEXTO_ACORDO_ORFAO.test(blob);
}

/** Baixa logística já registrada no histórico do pedido para este lançamento. */
export function pedidoTemBaixaLogisticaAcordo(historico = '', lancamentoId = '') {
  if (!lancamentoId) return false;
  const h = String(historico || '');
  return h.includes('[ACORDO FINANCEIRO ÓRFÃOS') && h.includes(`lançamento=${lancamentoId}`);
}

/**
 * Lançamentos de acordo órfão do pedido cuja baixa logística ainda não foi feita.
 * @returns {Array<{ lancamento, baixaPendente: true }>}
 */
export function listarAcordosOrfaoComBaixaPendente(pedido = {}, lancamentos = []) {
  const historico = pedido.historico || '';
  return (lancamentos || [])
    .filter((l) => isLancamentoAcordoFinanceiroOrfao(l))
    .filter((l) => !pedidoTemBaixaLogisticaAcordo(historico, l.id))
    .map((l) => ({ lancamento: l, baixaPendente: true }));
}
