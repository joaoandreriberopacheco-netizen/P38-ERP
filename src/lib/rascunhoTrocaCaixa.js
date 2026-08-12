import { base44 } from '@/api/base44Client';
import { gerarProximaSenhaAtendimento } from '@/lib/senhaAtendimento';

/**
 * Cria pré-venda (rascunho) na fila do caixa quando a troca tem diferença a pagar.
 * O caixa homologa o pagamento e vincula ao pedido original via processarVendaCaixa.
 */
export async function criarRascunhoTrocaParaCaixa({
  pedido,
  itensSubstitutos,
  creditoDevolucao,
  valorSubstitutos,
  diferencaPagar,
  numeroDev,
  operador,
  motivo,
}) {
  if (!diferencaPagar || diferencaPagar <= 0) return null;

  const senhaAtendimento = await gerarProximaSenhaAtendimento();
  const itens = (itensSubstitutos || []).map((sub) => ({
    produto_id: sub.produto_id,
    produto_nome: sub.produto_nome,
    quantidade: sub.quantidade,
    preco_unitario_praticado: sub.preco_unitario,
    total: sub.total,
  }));

  const rascunhoData = {
    senha_atendimento: senhaAtendimento,
    tipo: 'PDV',
    cliente_id: pedido.cliente_id,
    cliente_nome: pedido.cliente_nome,
    vendedor_id: operador?.id,
    vendedor_nome: operador?.full_name,
    tabela_preco_id: pedido.tabela_preco_id,
    status: 'Aguardando Caixa',
    metodo_entrega: 'Retirada',
    itens,
    subtotal: valorSubstitutos,
    valor_desconto: creditoDevolucao,
    valor_frete: 0,
    valor_total: diferencaPagar,
    observacoes: `Troca ${numeroDev} — pedido ${pedido.numero}${motivo ? ` — ${motivo}` : ''}`,
  };

  const rascunho = await base44.entities.RascunhoPedidoVenda.create(rascunhoData);
  return { ...rascunho, senha_atendimento: rascunho.senha_atendimento || senhaAtendimento };
}
