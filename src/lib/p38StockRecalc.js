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
    if (!/não foi migrada|404|not\.found|FunctionsHttpError/i.test(msg)) {
      console.warn('[P38] recalcularEstoqueProduto edge:', msg);
    }
  }

  const rows = await base44.entities.Produto.filter({ id: produtoId });
  const produto = Array.isArray(rows) ? rows[0] : rows;
  if (!produto) return;

  const movimentacoes = await fetchMovimentacoesEstoqueProduto(base44, produtoId);
  const saldoMovimentos = calcularSaldoMovimentacoes(movimentacoes);

  const estoqueAvariado = Number(produto.estoque_avariado) || 0;
  const estoqueAtual = Math.max(0, saldoMovimentos - estoqueAvariado);

  await base44.entities.Produto.update(produtoId, {
    estoque_atual: estoqueAtual,
  });
}

/** Cloud opcional: falha silenciosa para não bloquear recepção/despacho em casa-nova. */
export async function invokeRecalcularConclusaoPedidoCompra(base44, pedidoId) {
  if (!pedidoId) return;
  try {
    await base44.functions.invoke('recalcularConclusaoPedidoCompra', { pedidoId });
  } catch (err) {
    console.warn('[P38] recalcularConclusaoPedidoCompra (edge opcional):', err?.message || err);
  }
}
