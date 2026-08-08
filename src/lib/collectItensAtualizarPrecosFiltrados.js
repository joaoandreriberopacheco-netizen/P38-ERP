import { hydratePedidosCompraItensFromSql } from '@/lib/fetchPedidoCompraItens';

/**
 * Extrai linhas para atualização de preços a partir dos pedidos filtrados.
 * Fonte: PedidoCompraItem (SQL), com fallback no espelho legado.
 */
export async function collectItensAtualizarPrecosFiltrados(base44, pedidos = []) {
  const hydrated = await hydratePedidosCompraItensFromSql(base44, pedidos);
  const result = [];

  for (const pedido of hydrated) {
    const etaRaw = pedido.data_prevista_entrega
      || pedido._embarque_principal?.eta
      || pedido._embarque?.eta
      || '';
    const eta = etaRaw ? String(etaRaw).slice(0, 10) : '';

    for (const item of pedido.itens || []) {
      if (!item?.produto_id) continue;
      result.push({
        ...item,
        _pedido_id: pedido.id,
        _pedido_numero: pedido.numero || '',
        _fornecedor_nome: pedido.fornecedor_nome || '',
        _eta: eta,
        _data_emissao: pedido.data_emissao || (pedido.created_date ? String(pedido.created_date).slice(0, 10) : ''),
      });
    }
  }

  return result;
}

/**
 * Um produto → uma linha (pedido mais recente prevalece) para gravar no cadastro.
 */
export function deduplicarItensAtualizarPrecosPorProduto(itens = []) {
  const map = new Map();
  for (const item of itens) {
    const pid = item.produto_id;
    const prev = map.get(pid);
    if (!prev || String(item._data_emissao || '') >= String(prev._data_emissao || '')) {
      map.set(pid, item);
    }
  }
  return [...map.values()];
}

export function coletarProdutoIdsDosItens(itens = []) {
  return [...new Set(itens.map((i) => i.produto_id).filter(Boolean))];
}
