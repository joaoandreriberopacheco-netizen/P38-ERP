import { savePedidoVendaItem } from '@/functions/savePedidoVendaItem';

/** Converte linha legado (carrinho / espelho UI) para input canónico PedidoVendaItem. */
export function legacyVendaItemToCanonicalInput(item = {}, idx = 0) {
  return {
    id: item?.pedido_venda_item_id || item?.id || undefined,
    produto_id: item?.produto_id || '',
    produto_unidade_id: item?.produto_unidade_id || '',
    unidade_sigla: item?.unidade_medida || item?.unidade_apresentacao || item?.unidade_sigla || '',
    quantidade_comercial: Number(item?.quantidade) || 0,
    preco_unitario_fator1: Number(item?.preco_unitario_praticado ?? item?.preco_unitario_fator1) || 0,
    desconto_unitario_fator1: Number(item?.desconto_unitario ?? item?.desconto_unitario_fator1) || 0,
    tabela_preco_id: typeof item?.tabela_preco_id === 'string' ? item.tabela_preco_id : '',
    tabela_preco_multiplicador: Number(item?.tabela_preco_multiplicador) || 1,
    ordem: idx,
    observacoes: typeof item?.observacoes === 'string' ? item.observacoes : '',
  };
}

/** Grava linhas em PedidoVendaItem (replaceAll). Cabeçalho PedidoVenda não deve incluir `itens[]`. */
export async function syncPedidoVendaItens(pedidoVendaId, itens = []) {
  const items = (itens || [])
    .map(legacyVendaItemToCanonicalInput)
    .filter((it) => it.produto_id && it.quantidade_comercial > 0);

  if (!pedidoVendaId || !items.length) return null;

  return savePedidoVendaItem({
    action: 'replaceAll',
    pedido_venda_id: pedidoVendaId,
    items,
  });
}
