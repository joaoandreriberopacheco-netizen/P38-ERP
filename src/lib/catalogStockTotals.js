import { formatEstoqueApresentacao, getCatalogoComercialView, resolveCustoTotalUnitBaseProduto } from '@/lib/productUnits';
import { createCatalogStockContext, resolveCatalogEstoqueExibicao } from '@/lib/catalogEstoqueVirtual';
import { resolveProdutoAbcdClasse } from '@/lib/catalogAbcdEnrichment';

/** Custo unitário na unidade base do cadastro (totais gerenciais / dashboard). */
export function resolveProdutoCustoUnitarioBase(produto) {
  return resolveCustoTotalUnitBaseProduto(produto);
}

function transitValorProdutoCatalogo(produto, catalogStockContext) {
  const qVirt = lineEstoqueQuantidade(produto, catalogStockContext);
  if (qVirt <= 0) return 0;
  const vVirt = lineValorCustoTotal(produto, catalogStockContext);
  const qFis = lineEstoqueQuantidade(produto, null);
  if (qFis <= 0) return vVirt;
  return vVirt - lineValorCustoTotal(produto, null);
}

/**
 * Valor em trânsito com a mesma regra do catálogo (pendente × custo na embalagem comercial).
 * Só produtos ativos — alinha ao filtro padrão do catálogo.
 */
export function sumCatalogTransitStockValue(produtos = [], pendentePorProduto = {}) {
  const catalogStockContext = createCatalogStockContext(true, pendentePorProduto);
  let total = 0;
  for (const produto of produtos) {
    if (!produto?.ativo) continue;
    total += transitValorProdutoCatalogo(produto, catalogStockContext);
  }
  return total;
}

/** Mesma regra que `valorEstoqueAtivo` no cabeçalho do catálogo (estoque virtual). */
export function sumCatalogVirtualStockValueAtivo(produtos = [], pendentePorProduto = {}) {
  const catalogStockContext = createCatalogStockContext(true, pendentePorProduto);
  let total = 0;
  for (const produto of produtos) {
    if (!produto?.ativo) continue;
    const qtd = lineEstoqueQuantidade(produto, catalogStockContext);
    if (qtd > 0) total += lineValorCustoTotal(produto, catalogStockContext);
  }
  return total;
}

/** Trânsito por curva ABCD — mesma base que o catálogo virtual. */
export function sumCatalogTransitStockValueByAbcd(
  produtos = [],
  pendentePorProduto = {},
  qualityOrder = ['A', 'B', 'C', 'D', 'E'],
) {
  const catalogStockContext = createCatalogStockContext(true, pendentePorProduto);
  const accum = Object.fromEntries(qualityOrder.map((key) => [key, 0]));
  for (const produto of produtos) {
    if (!produto?.ativo) continue;
    const valor = transitValorProdutoCatalogo(produto, catalogStockContext);
    if (valor <= 0) continue;
    const curva = resolveProdutoAbcdClasse(produto);
    if (qualityOrder.includes(curva)) accum[curva] += valor;
  }
  return accum;
}

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
  return qtd * resolveCustoTotalUnitBaseProduto(produto);
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
