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
 * Lista rápida — só fetch inicial Base44 (Fase 8 paint antes da vitrine/financeiro).
 */
export async function fetchPedidosCompraGestaoListaRapida(base44, filters = {}) {
  const gestao = await fetchPedidosCompraGestaoInicial(base44, filters);
  return {
    pedidos: gestao.pedidos,
    embarques: gestao.embarques,
    produtosMap: {},
    needsSyncAprovacao: false,
    isListaParcial: true,
  };
}

/**
 * Carga inicial da gestão de compras (pedidos + embarques + vitrine).
 * Partilhável via React Query entre visitas ao ecrã.
 * @param {{ deferSyncAprovacao?: boolean }} options
 */
export async function fetchPedidosCompraGestaoCompleto(base44, options = {}) {
  const { deferSyncAprovacao = true, fetchFilters = {}, gestaoPrefetch = null } = options;
  const gestao = gestaoPrefetch ?? await fetchPedidosCompraGestaoInicial(base44, fetchFilters);

  const pcs = gestao.pedidos;
  const embarquesHeaders = gestao.embarques;

  const pedidoProdutoRefs = pcs.flatMap((p) => (p.itens || []).map((i) => ({ produto_id: i.produto_id })));

  const [embarquesDb, produtosMapPedidos] = await Promise.all([
    hydrateEmbarquesFromSql(base44, embarquesHeaders),
    carregarProdutosMap(pedidoProdutoRefs),
  ]);

  const produtoIdsEmbarque = [
    ...new Set(
      embarquesDb.flatMap((e) => getEmbarqueItensLinhas(e).map((i) => i.produto_id).filter(Boolean)),
    ),
  ];
  const missingProdutoIds = produtoIdsEmbarque.filter((id) => !produtosMapPedidos[id]);
  const produtosMapExtras = missingProdutoIds.length
    ? await carregarProdutosMap(missingProdutoIds.map((id) => ({ produto_id: id })))
    : {};
  const produtosMap = { ...produtosMapPedidos, ...produtosMapExtras };
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
    isListaParcial: false,
  };
}
