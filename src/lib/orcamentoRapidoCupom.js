export const ORCAMENTO_RAPIDO_AVISO_PRECO =
  'Preços sujeitos a variação. Valores informados para consulta; confirme no caixa antes da venda.';
export function quickBudgetItemsToCupomItens(items = []) {
  return (items || []).map((item) => ({
    nome: item.produto_nome || item.nome || '',
    qtd: Number(item.quantidade) || 0,
    preco_unit: Number(item.preco_unitario ?? item.preco_unit) || 0,
    unidade: item.unidade || item.unidade_medida || 'UN',
  }));
}

/** Linhas legado SQL / PedidoVendaItem → OrcamentoCupom. */
export function legacyItensToCupomItens(itens = []) {
  return (itens || []).map((item) => ({
    nome: item.produto_nome || '',
    qtd: Number(item.quantidade) || 0,
    preco_unit: Number(item.preco_unitario_praticado ?? item.preco_unitario) || 0,
    unidade: item.unidade_medida || item.unidade_apresentacao || 'UN',
  }));
}

export function orcamentoSalvoToCupomProps(orcamento = {}) {
  const itens = legacyItensToCupomItens(orcamento.itens);
  const subtotal = Number(orcamento.subtotal) || itens.reduce((s, i) => s + i.preco_unit * i.qtd, 0);
  const desconto = Number(orcamento.valor_desconto) || 0;
  const total = Number(orcamento.valor_total) || Math.max(subtotal - desconto, 0);
  const observacoesBase = orcamento.observacoes?.trim() || '';
  const observacoes = observacoesBase
    ? `${observacoesBase}\n\n${ORCAMENTO_RAPIDO_AVISO_PRECO}`
    : ORCAMENTO_RAPIDO_AVISO_PRECO;

  return {
    itens,
    subtotal,
    desconto,
    total,
    observacoes,
    clienteNome: orcamento.cliente_nome || '',
    numero: orcamento.numero || '',
  };
}

export function quickBudgetStateToCupomProps({
  items = [],
  descontoResumo = {},
  clienteNome = '',
  observacoes = '',
} = {}) {
  const itens = quickBudgetItemsToCupomItens(items);
  const subtotal = Number(descontoResumo.subtotal) || 0;
  const desconto = Number(descontoResumo.valorDesconto) || 0;
  const total = Number(descontoResumo.total) || 0;
  const observacoesBase = observacoes?.trim() || '';
  const observacoesFull = observacoesBase
    ? `${observacoesBase}\n\n${ORCAMENTO_RAPIDO_AVISO_PRECO}`
    : ORCAMENTO_RAPIDO_AVISO_PRECO;

  return {
    itens,
    subtotal,
    desconto,
    total,
    observacoes: observacoesFull,
    clienteNome,
  };
}
