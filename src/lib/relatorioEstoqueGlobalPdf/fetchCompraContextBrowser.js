import { fetchPedidosCompraParaSugestaoEstoque } from '@/lib/fetchPedidosCompraParaSugestaoEstoque';
import { getEmbarqueItensLinhas } from '@/lib/fetchEmbarqueItens';
import {
  buildPendenteAprovadoFinanceiroPorProduto,
  pedidoCompraAprovadoNaoConcluido,
  resolveQuantidadeBaseItemEmbarque,
} from '@/lib/sugestaoCompraEstoquePendente';

function embarqueEmTransito(embarque = {}) {
  const statusReceb = String(embarque.status_recebimento || '').trim().toLowerCase();
  const statusEmb = String(embarque.status || '').trim().toLowerCase();
  if (statusReceb.includes('recebido ok') || statusReceb.includes('diverg') || statusEmb.includes('conclu')) {
    return false;
  }
  return true;
}

export async function fetchCompraContextBrowser(base44) {
  const data = await fetchPedidosCompraParaSugestaoEstoque(base44);
  const pedidosMap = new Map(data.pedidosTodos.map((pedido) => [String(pedido.id), pedido]));
  const embarquesTransito = data.embarques.filter((embarque) => {
    const pedido = pedidosMap.get(String(embarque.pedido_compra_id));
    if (!pedido) return false;
    if (!pedidoCompraAprovadoNaoConcluido(pedido)) return false;
    return embarqueEmTransito(embarque);
  });

  return {
    getEmbarqueItensLinhas,
    resolveQuantidadeBaseItemEmbarque,
    pedidosMap,
    pedidosAbertos: data.pedidosAbertos,
    embarquesHydrated: data.embarques,
    embarquesTransito,
    recebidosPorPedidoProduto: data.recebidosPorPedidoProduto,
    buildPendenteAprovadoFinanceiroPorProduto,
  };
}
