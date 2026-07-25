import { invokeRecalcularEstoqueProduto } from '@/lib/p38StockRecalc';
import { calcularSaldoExtratoProduto, parseEstoqueCadastro } from '@/lib/movimentacaoEstoqueSaldo';
import { formatCountQuantity, getEntryBaseQuantity } from '@/lib/inventoryCountUnits';
import { createContagemExpressSessionId } from '@/lib/contagemExpressStorage';

export const REFERENCIA_CONTAGEM_EXPRESS = 'ContagemExpress';

/**
 * Agrupa itens contados por produto (quantidade base).
 */
export function agruparItensContagem(itens, produtos) {
  const mapaProdutos = Object.fromEntries((produtos || []).map((p) => [p.id, p]));
  const totais = {};

  for (const item of itens || []) {
    if (!item?.produto_id) continue;
    const produto = mapaProdutos[item.produto_id];
    const base = getEntryBaseQuantity(item, produto);
    if (!totais[item.produto_id]) {
      totais[item.produto_id] = {
        produto_id: item.produto_id,
        produto_nome: item.produto_nome || produto?.nome || 'Produto',
        totalBase: 0,
      };
    }
    totais[item.produto_id].totalBase += base;
  }

  return Object.values(totais);
}

/**
 * Monta linhas comparativas (contado x saldo extrato) para o carrinho.
 */
export async function buildComparativoContagem(base44, itens, produtos) {
  const grupos = agruparItensContagem(itens, produtos);
  const mapaProdutos = Object.fromEntries((produtos || []).map((p) => [p.id, p]));

  return Promise.all(
    grupos.map(async (grupo) => {
      const produto = mapaProdutos[grupo.produto_id];
      const saldoExtrato = await calcularSaldoExtratoProduto(base44, grupo.produto_id);
      const cadastro = produto ? parseEstoqueCadastro(produto.estoque_atual) : null;
      const diferenca = grupo.totalBase - saldoExtrato;

      return {
        ...grupo,
        saldoExtrato,
        estoqueCadastro: cadastro,
        diferenca,
        temDiferenca: Math.abs(diferenca) >= 1e-6,
      };
    })
  );
}

/**
 * Cria movimentações de ajuste e recalcula estoque. Retorna resumo da operação.
 */
export async function aplicarContagemExpress(base44, {
  itens,
  produtos,
  sessionId,
  conferenciaId,
  usuarioNome,
  usuarioEmail,
}) {
  const grupos = agruparItensContagem(itens, produtos);
  const mapaProdutos = Object.fromEntries((produtos || []).map((p) => [p.id, p]));
  const referenciaNumero = sessionId || createContagemExpressSessionId();
  const responsavel = usuarioNome || 'Sistema';
  const responsavelId = usuarioEmail || usuarioNome || 'Sistema';
  const dataFim = new Date().toISOString();

  const conferenciaPayload = {
    status: 'Concluída',
    data_fim: dataFim,
    itens_conferidos: itens,
    ajuste_aplicado: true,
  };

  let conferenciaRegistroId = conferenciaId || null;
  if (conferenciaId) {
    await base44.entities.ConferenciaEstoque.update(conferenciaId, conferenciaPayload);
  } else {
    const conferencia = await base44.entities.ConferenciaEstoque.create({
      nome_conferencia: referenciaNumero,
      tipo_conferencia: 'Contagem Express',
      responsavel_id: responsavelId,
      responsavel_nome: responsavel,
      data_inicio: dataFim,
      ...conferenciaPayload,
    });
    conferenciaRegistroId = conferencia?.id || null;
  }

  const movimentacoesPayload = await Promise.all(
    grupos.map(async (grupo) => {
      const produto = mapaProdutos[grupo.produto_id];
      if (!produto) return null;

      const saldoExtrato = await calcularSaldoExtratoProduto(base44, grupo.produto_id);
      const diferenca = grupo.totalBase - saldoExtrato;
      if (Math.abs(diferenca) < 1e-6) return null;

      const cadastro = parseEstoqueCadastro(produto.estoque_atual);
      const obsExtra = cadastro !== saldoExtrato
        ? ` (saldo extrato ${formatCountQuantity(saldoExtrato)}; cadastro ${formatCountQuantity(cadastro)})`
        : '';

      return {
        produto_id: produto.id,
        produto_nome: grupo.produto_nome,
        tipo: diferenca > 0 ? 'Entrada' : 'Saída',
        motivo: 'Ajuste de Inventário',
        quantidade: Math.abs(diferenca),
        custo_unitario: Number(produto.preco_custo_calculado) || Number(produto.valor_compra) || 0,
        referencia_tipo: REFERENCIA_CONTAGEM_EXPRESS,
        referencia_id: referenciaNumero,
        referencia_numero: referenciaNumero,
        observacoes: `Contagem Express — físico ${formatCountQuantity(grupo.totalBase)}${obsExtra} · ${referenciaNumero}`,
        usuario_responsavel: responsavel,
      };
    })
  );

  const movimentacoes = movimentacoesPayload.filter(Boolean);
  const idsRecalc = [...new Set(movimentacoes.map((m) => m.produto_id).filter(Boolean))];

  await Promise.all(
    movimentacoes.map((movimentacao) => base44.entities.MovimentacaoEstoque.create(movimentacao))
  );

  for (const pid of idsRecalc) {
    await invokeRecalcularEstoqueProduto(base44, pid);
  }

  const comparativo = await buildComparativoContagem(base44, itens, produtos);

  return {
    referenciaNumero,
    conferenciaId: conferenciaRegistroId,
    produtosContados: grupos.length,
    ajustesAplicados: movimentacoes.length,
    semDiferenca: comparativo.filter((r) => !r.temDiferenca).length,
    movimentacoes,
    comparativo,
    dataLancamento: dataFim,
  };
}
