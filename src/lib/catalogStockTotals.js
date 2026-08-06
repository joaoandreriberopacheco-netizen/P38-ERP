import { formatEstoqueApresentacao, getCatalogoComercialView } from '@/lib/productUnits';
import { calcCusto } from '@/components/produtos/treegrid/useTreeGrid';
import { resolveCatalogEstoqueExibicao } from '@/lib/catalogEstoqueVirtual';

/** Quantidade de estoque nos totais (vitrine comercial; respeita estoque virtual quando activo). */
export function lineEstoqueQuantidade(produto, catalogStockContext = null) {
  if (catalogStockContext) {
    return Number(resolveCatalogEstoqueExibicao(produto, catalogStockContext).quantidade) || 0;
  }
  const ap = formatEstoqueApresentacao(produto);
  return ap ? ap.quantidade : produto?.estoque_atual || 0;
}

/** Quantidade usada em KPIs de valorização (ignora saldo negativo). */
export function lineEstoqueQuantidadeValorizada(produto, catalogStockContext = null) {
  const qtd = lineEstoqueQuantidade(produto, catalogStockContext);
  return qtd > 0 ? qtd : 0;
}

/** estoque × valor de compra (alinha coluna Vl. Compra do TreeGrid). */
export function lineValorCompraTotal(produto, catalogStockContext = null) {
  const qtd = lineEstoqueQuantidadeValorizada(produto, catalogStockContext);
  const ap = formatEstoqueApresentacao(produto);
  if (ap) {
    return qtd * getCatalogoComercialView(produto).valorCompraNaEmbalagem;
  }
  return qtd * (produto?.valor_compra || 0);
}

/** estoque × custo total (alinha coluna Custo Total / Inventário R$). */
export function lineValorCustoTotal(produto, catalogStockContext = null) {
  const qtd = lineEstoqueQuantidadeValorizada(produto, catalogStockContext);
  const ap = formatEstoqueApresentacao(produto);
  if (ap) {
    return qtd * getCatalogoComercialView(produto).custoNaEmbalagem;
  }
  return qtd * calcCusto(produto);
}

/** estoque × preço de venda (alinha coluna Preço de venda do TreeGrid). */
export function lineValorVendaTotal(produto, catalogStockContext = null) {
  const qtd = lineEstoqueQuantidadeValorizada(produto, catalogStockContext);
  const cat = getCatalogoComercialView(produto);
  return qtd * (cat.precoVenda || 0);
}

/**
 * Totais do inventário filtrado (soma por SKU, sem duplicar grupos da árvore).
 * Com vitrine activa usa quantidade e preços da embalagem comercial; senão unidade base.
 */
export function sumCatalogStockTotals(produtos, catalogStockContext = null) {
  let totalCompra = 0;
  let totalCusto = 0;
  let totalVenda = 0;
  let count = 0;
  const list = Array.isArray(produtos) ? produtos : [];
  for (const p of list) {
    if (!p || typeof p !== 'object') continue;
    count += 1;
    totalCompra += lineValorCompraTotal(p, catalogStockContext);
    totalCusto += lineValorCustoTotal(p, catalogStockContext);
    totalVenda += lineValorVendaTotal(p, catalogStockContext);
  }
  return {
    count,
    totalCompra,
    totalCusto,
    totalVenda,
  };
}
