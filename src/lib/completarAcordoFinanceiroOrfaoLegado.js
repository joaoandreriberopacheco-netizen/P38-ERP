import { listarLancamentosPedidoCompra } from '@/lib/pedidoCompraFinanceiro';
import { listarAcordosOrfaoComBaixaPendente } from '@/lib/acordoFinanceiroOrfaoLancamento';
import { aplicarBaixaLogisticaAcordoFinanceiroOrfaos } from '@/lib/aplicarAcordoFinanceiroOrfaos';
import { invokeRecalcularConclusaoPedidoCompra } from '@/lib/p38StockRecalc';

/**
 * Completa só a baixa logística (folha 4 colunas) usando lançamento já existente.
 * Não cria novo LancamentoFinanceiro nem altera estoque.
 */
export async function completarBaixaLogisticaAcordoExistente(
  base44,
  {
    pedido,
    embarques = [],
    itensOrfaos = [],
    lancamentoId,
    produtosMap = {},
  },
) {
  if (!pedido?.id || !lancamentoId) {
    return { ok: false, error: 'Pedido ou lançamento não informado.' };
  }

  const lancamentos = await listarLancamentosPedidoCompra(base44, pedido.id);
  const lanc = lancamentos.find((l) => l.id === lancamentoId);
  if (!lanc) {
    return { ok: false, error: 'Lançamento não encontrado neste pedido.' };
  }

  const pendentes = listarAcordosOrfaoComBaixaPendente(pedido, [lanc]);
  if (!pendentes.length) {
    return { ok: false, error: 'Este lançamento já tem baixa logística registrada no pedido.' };
  }

  const baixa = await aplicarBaixaLogisticaAcordoFinanceiroOrfaos(base44, {
    pedido,
    embarques,
    itensOrfaos,
    lancamentoId,
    produtosMap,
    baixarQuantidades: true,
  });

  if (!baixa.ok) return baixa;

  const nota =
    '\n[Baixa logística completada retroativamente — acordo financeiro já existia | sem novo lançamento]';
  const obsAtual = String(lanc.observacoes || '');
  if (!obsAtual.includes('Baixa logística completada retroativamente')) {
    await base44.entities.LancamentoFinanceiro.update(lancamentoId, {
      observacoes: (obsAtual + nota).trim(),
    });
  }

  await invokeRecalcularConclusaoPedidoCompra(base44, pedido.id);

  return { ok: true, resumo: baixa.resumo, lancamentoId, reutilizouLancamento: true };
}

/** Escolhe o acordo órfão mais recente com baixa pendente (se houver). */
export async function resolverAcordoOrfaoLegadoParaCompletar(base44, pedido) {
  const lancamentos = await listarLancamentosPedidoCompra(base44, pedido.id);
  const pendentes = listarAcordosOrfaoComBaixaPendente(pedido, lancamentos);
  if (!pendentes.length) return null;
  return pendentes.sort(
    (a, b) =>
      new Date(b.lancamento.created_at || b.lancamento.created_date || 0)
      - new Date(a.lancamento.created_at || a.lancamento.created_date || 0),
  )[0].lancamento;
}
