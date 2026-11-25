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
/** Lê quantidades já baixadas na linha de histórico do pedido para um lançamento. */
export function parseQtdBaixaAcordoHistorico(historico = '', lancamentoId = '') {
  const line = String(historico || '')
    .split('\n')
    .find((ln) => ln.includes('[ACORDO FINANCEIRO ÓRFÃOS') && ln.includes(`lançamento=${lancamentoId}`));
  if (!line) return [];
  const marker = `lançamento=${lancamentoId} | `;
  const start = line.indexOf(marker);
  if (start < 0) return [];
  const rest = line.slice(start + marker.length);
  const end = rest.lastIndexOf(' | ');
  const blob = (end > 0 ? rest.slice(0, end) : rest).trim();
  const out = [];
  for (const chunk of blob.split(';').map((s) => s.trim()).filter(Boolean)) {
    const m = chunk.match(/^(.+?):\s*[-−](\d+(?:\.\d+)?)\s*base/i);
    if (m) out.push({ produto_nome: m[1].trim(), qtd_baixa_base: Number(m[2]) });
  }
  return out;
}

export function listarAcordosOrfaoComBaixaPendente(pedido = {}, lancamentos = []) {
  const historico = pedido.historico || '';
  return (lancamentos || [])
    .filter((l) => isLancamentoAcordoFinanceiroOrfao(l))
    .filter((l) => !pedidoTemBaixaLogisticaAcordo(historico, l.id))
    .map((l) => ({ lancamento: l, baixaPendente: true }));
}
