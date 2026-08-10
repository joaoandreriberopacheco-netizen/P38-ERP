import { calcularSaldoMovimentacoes, fetchMovimentacoesEstoqueProduto } from '@/lib/movimentacaoEstoqueSaldo';

/**
 * Substitui Edge Functions Base44 que podem não existir em Supabase (`recalcularEstoqueProduto`,
 * `recalcularConclusaoPedidoCompra`). Mantém o mesmo algoritmo que `base44/functions/recalcularEstoqueProduto`.
 */
export async function invokeRecalcularEstoqueProduto(base44, produtoId) {
  if (!produtoId) return;
  try {
    await base44.functions.invoke('recalcularEstoqueProduto', { produtoId });
    return;
  } catch (err) {
    const msg = String(err?.message || err || '');
    if (!/não foi migrada|404|not\.found|FunctionsHttpError|BOOT_ERROR|failed to start/i.test(msg)) {
      console.warn('[P38] recalcularEstoqueProduto edge:', msg);
    }
  }

  const rows = await base44.entities.Produto.filter({ id: produtoId });
  const produto = Array.isArray(rows) ? rows[0] : rows;
  if (!produto) return;

  const movimentacoes = await fetchMovimentacoesEstoqueProduto(base44, produtoId);
  const saldoMovimentos = calcularSaldoMovimentacoes(movimentacoes);

  const estoqueAvariado = Number(produto.estoque_avariado) || 0;
  const estoqueAtual = saldoMovimentos - estoqueAvariado;

  await base44.entities.Produto.update(produtoId, {
    estoque_atual: estoqueAtual,
  });
}

function statusRecebimentoGeralFromEmbarques(embarques = []) {
  if (!embarques.length) return 'Nenhum';
  const recebimentos = embarques.map((e) => e?.status_recebimento).filter(Boolean);
  if (recebimentos.some((s) => s === 'Com Divergência')) return 'Concluído com Divergência';
  if (recebimentos.length > 0 && recebimentos.every((s) => s === 'Recebido OK')) return 'Concluído OK';
  if (recebimentos.some((s) => s === 'Recebido Parcial')) return 'Recebido Parcial';
  return 'Pendente';
}

/**
 * Cloud preferencial; se a Edge falhar (BOOT_ERROR / 401 / etc.), actualiza o pedido
 * localmente a partir dos embarques — mesma regra da lista em PedidosCompra.
 */
export async function invokeRecalcularConclusaoPedidoCompra(base44, pedidoId) {
  if (!pedidoId) return null;

  try {
    const data = await base44.functions.invoke('recalcularConclusaoPedidoCompra', { pedidoId });
    return data;
  } catch (err) {
    console.warn('[P38] recalcularConclusaoPedidoCompra (edge):', err?.message || err);
  }

  const pedidos = await base44.entities.PedidoCompra.filter({ id: pedidoId });
  const pedido = Array.isArray(pedidos) ? pedidos[0] : pedidos;
  if (!pedido) return null;

  let embarques = [];
  try {
    embarques = await base44.entities.Embarque.filter({ pedido_compra_id: pedidoId }, '-created_date', 500);
  } catch {
    embarques = Array.isArray(pedido.embarques_registrados) ? pedido.embarques_registrados : [];
  }
  if (!Array.isArray(embarques)) embarques = [];

  const statusReceb = statusRecebimentoGeralFromEmbarques(embarques);
  const concluido = statusReceb === 'Concluído OK' || statusReceb === 'Concluído com Divergência';
  const nowIso = new Date().toISOString();
  const patch = {
    status_recebimento_geral: statusReceb,
    historico:
      String(pedido.historico || '') +
      `\n[RECALCULO CONCLUSAO LOCAL | status=${concluido ? 'Concluído' : pedido.status} | recebimento=${statusReceb} | ${nowIso}]`,
  };
  if (concluido) {
    patch.status = 'Concluído';
    patch.data_conclusao = nowIso;
  }

  await base44.entities.PedidoCompra.update(pedidoId, patch);
  return { success: true, fallback: true, ...patch };
}
