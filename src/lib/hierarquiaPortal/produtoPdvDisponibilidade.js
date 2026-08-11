import { portalEstoqueCx } from '@/lib/hierarquiaPortal/buildPortalSupplyCeramica';
import { isProdutoReservaPortal } from '@/lib/hierarquiaPortal/portalReservaCeramica';

/** Estoque numérico do produto (entidade) ou linha enriquecida do portal. */
export function produtoEstoqueNumerico(produtoOrRow) {
  if (!produtoOrRow) return 0;
  if (produtoOrRow.produto) {
    return portalEstoqueCx(produtoOrRow);
  }
  return Number(produtoOrRow.estoque_atual) || 0;
}

/** SKU marcado como reserva cerâmica do portal — não vende no PDV. */
export function isProdutoBloqueadoPdv(produto) {
  return isProdutoReservaPortal(produto);
}

/** Disponível para busca/venda no PDV (activo e fora da reserva). */
export function isProdutoDisponivelPdv(produto) {
  if (!produto || produto.ativo === false) return false;
  return !isProdutoBloqueadoPdv(produto);
}

/** Reserva com saldo físico — indicador âmbar no portal. */
export function isProdutoReservaComEstoque(produtoOrRow) {
  const produto = produtoOrRow?.produto ?? produtoOrRow;
  if (!isProdutoReservaPortal(produto)) return false;
  return produtoEstoqueNumerico(produtoOrRow) > 0;
}

export function filterProdutosDisponiveisPdv(produtos = []) {
  return (produtos || []).filter(isProdutoDisponivelPdv);
}
