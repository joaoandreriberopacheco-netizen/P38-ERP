import { hydrateEmbarquesFromSql, getEmbarqueItensLinhas } from '@/lib/fetchEmbarqueItens';
import { fetchPedidosCompraGestaoInicial } from '@/lib/fetchPedidosCompraGestao';
import { carregarProdutosMap } from '@/lib/embarqueVitrineHelpers';
import { materializePedidosCompraView, getBorrowedStatus } from '@/lib/comprasEmbarqueCards';
import {
  enriquecerPedidosCompraGestaoFinanceiro,
  pedidoStatusIndicaAguardandoAprovacaoFinanceira,
} from '@/lib/pedidoCompraFinanceiro';

import { sincronizarPedidosCompraAprovacaoPendente } from '@/lib/fetchPedidosCompraGestaoSync';

/**
 * Carga inicial da gestão de compras (pedidos + embarques + vitrine).
 * Partilhável via React Query entre visitas ao ecrã.
 * @param {{ deferSyncAprovacao?: boolean }} options
 */
export async function fetchPedidosCompraGestaoCompleto(base44, options = {}) {
  const { deferSyncAprovacao = true } = options;
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

  let pedidosBase = refinado.pedidosComResumoReal;

  if (!deferSyncAprovacao) {
    pedidosBase = await sincronizarPedidosCompraAprovacaoPendente(base44, pedidosBase);
  }

  const { pedidos: pedidosFin, cards: cardsFin } = await enriquecerPedidosCompraGestaoFinanceiro(
    base44,
    pedidosBase,
    refinado.cardsDeEmbarque,
  );
  const embarques = cardsFin.map((card) => ({
    ...card,
    _display_status: getBorrowedStatus(card, card._embarque, produtosMap, card._embarques || []),
  }));

  const needsSyncAprovacao = deferSyncAprovacao
    && pedidosBase.some((pedido) => pedidoStatusIndicaAguardandoAprovacaoFinanceira(pedido));

  return {
    pedidos: pedidosFin,
    embarques,
    produtosMap,
    needsSyncAprovacao,
  };
}
