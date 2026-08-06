import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { produtoId } = await req.json();

    if (!produtoId) {
      return Response.json({ error: 'produtoId é obrigatório' }, { status: 400 });
    }

    const [produto] = await base44.entities.Produto.filter({ id: produtoId });
    if (!produto) {
      return Response.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    const movimentacoes = await base44.entities.MovimentacaoEstoque.filter({ produto_id: produtoId }, '-created_date', 1000);

    const saldoMovimentos = (movimentacoes || []).reduce((acc, mov) => {
      const quantidade = Number(mov.quantidade) || 0;
      if (mov.tipo === 'Entrada') return acc + quantidade;
      if (mov.tipo === 'Saída') return acc - quantidade;
      return acc;
    }, 0);

    const estoqueAvariado = Number(produto.estoque_avariado) || 0;
    const estoqueAtual = saldoMovimentos - estoqueAvariado;

    await base44.entities.Produto.update(produtoId, {
      estoque_atual: estoqueAtual,
    });

    return Response.json({ success: true, produtoId, estoque_atual: estoqueAtual, movimentos: movimentacoes.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});