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

/** SKU com reserva legada no produto (tag antiga) — não usar portal_catalog.reserva_portal. */
export function isProdutoBloqueadoPdv(produto) {
  if (!produto) return false;
  const tags = Array.isArray(produto?.tags) ? produto.tags : [];
  return tags.some((t) => String(t).toLowerCase().replace(/^#+/, '').trim() === 'reserva-ceramica');
}

/** Disponível para busca/venda no PDV (activo e fora da reserva do portal). */
export function isProdutoDisponivelPdv(produto) {
  if (!produto || produto.ativo === false) return false;
  if (isProdutoBloqueadoPdv(produto)) return false;
  return !isProdutoReservaPortal(produto);
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
