import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function calcularSaldo(movimentacoes) {
  return (movimentacoes || []).reduce((acc, mov) => {
    const quantidade = Number(mov.quantidade) || 0;
    if (mov.tipo === 'Entrada') return acc + quantidade;
    if (mov.tipo === 'Saída') return acc - quantidade;
    return acc;
  }, 0);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const entityId = payload?.event?.entity_id;
    const data = payload?.data;
    const oldData = payload?.old_data;

    const produtoId = data?.produto_id || oldData?.produto_id;

    if (!entityId || !produtoId) {
      return Response.json({ success: true, ignored: true, reason: 'Sem produto relacionado' });
    }

    const [produto] = await base44.asServiceRole.entities.Produto.filter({ id: produtoId });

    if (!produto) {
      return Response.json({ success: true, ignored: true, reason: 'Produto não encontrado' });
    }

    const movimentacoes = await base44.asServiceRole.entities.MovimentacaoEstoque.filter({ produto_id: produtoId }, '-created_date', 1000);
    const saldoMovimentos = calcularSaldo(movimentacoes);
    const estoqueAvariado = Number(produto.estoque_avariado) || 0;
    const estoqueCorreto = saldoMovimentos - estoqueAvariado;
    const estoqueAtual = Number(produto.estoque_atual) || 0;

    if (estoqueAtual === estoqueCorreto) {
      return Response.json({
        success: true,
        produto_id: produtoId,
        estoque_atual: estoqueAtual,
        estoque_correto: estoqueCorreto,
        atualizado: false,
      });
    }

    await base44.asServiceRole.entities.Produto.update(produtoId, {
      estoque_atual: estoqueCorreto,
    });

    return Response.json({
      success: true,
      produto_id: produtoId,
      estoque_anterior: estoqueAtual,
      estoque_atual: estoqueCorreto,
      atualizado: true,
      movimentos: movimentacoes.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});