import { hydrateEmbarquesFromSql, getEmbarqueItensLinhas } from '@/lib/fetchEmbarqueItens';
import { fetchPedidosCompraGestaoInicial } from '@/lib/fetchPedidosCompraGestao';
import { carregarProdutosMap } from '@/lib/embarqueVitrineHelpers';
import { materializePedidosCompraView, getBorrowedStatus } from '@/lib/comprasEmbarqueCards';
import {
  enriquecerPedidosCompraGestaoFinanceiro,
  listarLancamentosPedidoCompra,
  pedidoPrecisaSincronizarAprovacaoFinanceira,
  pedidoStatusIndicaAguardandoAprovacaoFinanceira,
} from '@/lib/pedidoCompraFinanceiro';
import { sincronizarPedidoCompraAprovacaoFinanceira } from '@/lib/aprovarPedidoCompraFinanceiro';

/**
 * Carga inicial da gestão de compras (pedidos + embarques + vitrine).
 * Partilhável via React Query entre visitas ao ecrã.
 */
export async function fetchPedidosCompraGestaoCompleto(base44) {
  const gestao = await fetchPedidosCompraGestaoInicial(base44);

  const pcs = gestao.pedidos;
  const embarquesHeaders = gestao.embarques;

  const embarquesDb = await hydrateEmbarquesFromSql(base44, embarquesHeaders);
  const produtoIds = [
    ...new Set([
      ...pcs.flatMap((p) => (p.itens || []).map((i) => i.produto_id).filter(Boolean)),
      ...embarquesDb.flatMap((e) => getEmbarqueItensLinhas(e).map((i) => i.produto_id).filter(Boolean)),
    ]),
  ];
  const produtosMap = await carregarProdutosMap(produtoIds.map((id) => ({ produto_id: id })));
  const refinado = materializePedidosCompraView(pcs, embarquesDb, produtosMap);

  for (const pedido of refinado.pedidosComResumoReal) {
    if (!pedidoStatusIndicaAguardandoAprovacaoFinanceira(pedido)) continue;
    try {
      const lancs = await listarLancamentosPedidoCompra(base44, pedido.id);
      if (!pedidoPrecisaSincronizarAprovacaoFinanceira(pedido, lancs)) continue;
      await sincronizarPedidoCompraAprovacaoFinanceira({ base44, pedido, lancamentos: lancs });
      const [atualizado] = await base44.entities.PedidoCompra.filter({ id: pedido.id });
      if (atualizado) {
        pedido.status = atualizado.status;
        pedido.status_aprovacao_financeira = atualizado.status_aprovacao_financeira;
        pedido.data_aprovacao_financeira = atualizado.data_aprovacao_financeira;
      }
    } catch {
      /* exibição segue com enriquecimento abaixo */
    }
  }

  const { pedidos: pedidosFin, cards: cardsFin } = await enriquecerPedidosCompraGestaoFinanceiro(
    base44,
    refinado.pedidosComResumoReal,
    refinado.cardsDeEmbarque,
  );
  const embarques = cardsFin.map((card) => ({
    ...card,
    _display_status: getBorrowedStatus(card, card._embarque, produtosMap, card._embarques || []),
  }));

  return { pedidos: pedidosFin, embarques, produtosMap };
}
