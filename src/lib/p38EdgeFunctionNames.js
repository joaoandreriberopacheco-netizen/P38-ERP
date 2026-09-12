/** Mapeia nomes camelCase do Base44 para pastas kebab-case das Edge Functions Supabase. */
export const EDGE_FUNCTION_ALIASES = {
  gerenciarPin: 'gerenciar-pin',
  p38Auth: 'p38-auth',
  processarVendaCaixa: 'processar-venda-caixa',
  cancelarLancamentoFinanceiro: 'cancelar-lancamento-financeiro',
  auditarSaldosContas: 'auditar-saldos-contas',
  enviarFinanceiroLote: 'enviar-financeiro-lote',
  corrigirMovimentosRecepcaoRetroativos: 'corrigir-movimentos-recepcao-retroativos',
  gerarNumeroSequencial: 'gerar-numero-sequencial',
  savePedidoCompraItem: 'save-pedido-compra-item',
  savePedidoVendaItem: 'save-pedido-venda-item',
  recalcularConclusaoPedidoCompra: 'recalcular-conclusao-pedido-compra',
  recalcularEstoqueProduto: 'recalcular-estoque-produto',
};

export function toSupabaseEdgeFunctionName(name) {
  if (EDGE_FUNCTION_ALIASES[name]) return EDGE_FUNCTION_ALIASES[name];
  return String(name).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
