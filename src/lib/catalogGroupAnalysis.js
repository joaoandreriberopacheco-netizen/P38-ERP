import {
  getCatalogMetricFilterKeys,
  getProdutoNumericMetricValue,
  hasActiveCatalogMetricFilter,
  hasActiveNumericComparison,
  matchesNumericComparison,
} from '@/lib/catalogNumericFilters';
import {
  aggregateCatalogPontoEsperadoLt,
  aggregateCatalogSalesVelocity,
  getCatalogMedia30dFrom60d,
} from '@/lib/catalogSalesVelocity';
import { aggregateCatalogEstoqueExibicao } from '@/lib/catalogEstoqueVirtual';
import { isSomentePositivosFilter } from '@/lib/filterProdutos';
import { aggregateSkus, collectSkus } from '@/components/produtos/treegrid/useTreeGrid';

export const CATALOG_GROUP_ANALYSIS_LEVELS = [
  { value: '1', label: 'Nível 1' },
  { value: '2', label: 'Nível 2' },
  { value: '3', label: 'Nível 3' },
  { value: '4', label: 'Nível 4' },
];

export function isAnalisePorAgrupamento(filters) {
  return filters?.analisePorAgrupamento === true;
}

export function getAnaliseAgrupamentoNivel(filters) {
  const n = Number(filters?.analiseAgrupamentoNivel);
  if (Number.isFinite(n) && n >= 1 && n <= 4) return n;
  return 2;
}

export function hasActiveGroupAggregateFilters(filters) {
  if (!filters) return false;
  if (isSomentePositivosFilter(filters)) return true;
  if (
    hasActiveNumericComparison(
      filters.quantidadeOperador,
      filters.quantidadeValor,
      filters.quantidadeValorAte,
    ) &&
    !isSomentePositivosFilter(filters)
  ) {
    return true;
  }
  return hasActiveCatalogMetricFilter(filters, 1) || hasActiveCatalogMetricFilter(filters, 2);
}

/** Métrica agregada do grupo — alinhada às colunas com prefixo ~ na TreeGrid. */
export function getGroupNumericMetricValue(skus, campo, { salesVelocityMap = {}, catalogStockContext = null } = {}) {
  if (!Array.isArray(skus) || !skus.length || !campo || campo === 'all') return null;

  const agg = aggregateSkus(skus);
  const velAgg = aggregateCatalogSalesVelocity(skus, salesVelocityMap);

  switch (campo) {
    case 'markup':
      return agg.markupMedio || 0;
    case 'margem':
      return agg.margemMedia || 0;
    case 'preco_venda':
      return agg.precoMedio || 0;
    case 'valor_compra':
      return agg.valorCompraMedio || 0;
    case 'custo_total':
      return agg.custoMedio || 0;
    case 'iep_score':
      return agg.iepScoreMedio || 0;
    case 'iep_score_nivel_1':
      return agg.iepScoreNivel1Medio || 0;
    case 'iep_score_nivel_2':
      return agg.iepScoreNivel2Medio || 0;
    case 'iep_score_nivel_3':
      return agg.iepScoreNivel3Medio || 0;
    case 'iep_score_nivel_4':
      return agg.iepScoreNivel4Medio || 0;
    case 'iep_score_nivel_5':
      return agg.iepScoreNivel5Medio || 0;
    case 'media_30d':
      return getCatalogMedia30dFrom60d(velAgg);
    case 'ponto_futuro': {
      const est = aggregateCatalogEstoqueExibicao(skus, catalogStockContext);
      if (est.mode === 'empty') return 0;
      return est.quantidade - getCatalogMedia30dFrom60d(velAgg);
    }
    case 'ponto_esperado_lt':
      return aggregateCatalogPontoEsperadoLt(skus, salesVelocityMap).quantidade || 0;
    case 'tempo_reposicao': {
      const values = skus.map((p) => Number(p?.tempo_reposicao_dias) || 0);
      if (!values.length) return 0;
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    }
    default:
      return null;
  }
}

function groupMatchesQuantityFilter(skus, filters, catalogStockContext) {
  if (!hasActiveNumericComparison(
    filters?.quantidadeOperador,
    filters?.quantidadeValor,
    filters?.quantidadeValorAte,
  )) {
    return true;
  }

  const est = aggregateCatalogEstoqueExibicao(skus, catalogStockContext);
  const qty = est.mode === 'empty' ? 0 : Number(est.quantidade) || 0;
  return matchesNumericComparison(
    qty,
    filters.quantidadeOperador,
    filters.quantidadeValor,
    filters.quantidadeValorAte,
  );
}

function groupMatchesMetricSlot(skus, filters, slot, context) {
  if (!hasActiveCatalogMetricFilter(filters, slot)) return true;
  const { campo, operador, valor, valorAte } = getCatalogMetricFilterKeys(slot);
  const metricValue = getGroupNumericMetricValue(skus, filters[campo], context);
  if (metricValue === null) return false;
  return matchesNumericComparison(metricValue, filters[operador], filters[valor], filters[valorAte]);
}

/** Filtros dinâmicos (estoque, métricas) avaliados no total do grupo. */
export function groupMatchesAggregateFilters(skus, filters, context = {}) {
  if (!Array.isArray(skus) || !skus.length) return false;
  if (!groupMatchesQuantityFilter(skus, filters, context.catalogStockContext)) return false;
  if (!groupMatchesMetricSlot(skus, filters, 1, context)) return false;
  if (!groupMatchesMetricSlot(skus, filters, 2, context)) return false;
  return true;
}

function visitGroupNode(node, filterLevel, context) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return null;

  const newChildren = {};
  for (const [key, child] of Object.entries(node.children || {})) {
    const pruned = visitGroupNode(child, filterLevel, context);
    if (pruned) newChildren[key] = pruned;
  }

  const nextNode = { ...node, children: newChildren };
  const nodeLevel = Number(node.level);

  if (nodeLevel === filterLevel) {
    const skus = collectSkus(nextNode);
    if (!groupMatchesAggregateFilters(skus, context.filters, context)) return null;
    return nextNode;
  }

  if (Number.isFinite(nodeLevel) && nodeLevel < filterLevel) {
    const hasChildren = Object.keys(newChildren).length > 0;
    const hasSkus = (nextNode.skus || []).length > 0;
    if (!hasChildren && !hasSkus) return null;
    if (!hasChildren && hasSkus) return null;
    return nextNode;
  }

  return nextNode;
}

/** Remove ramos cujo agregado no nível escolhido não cumpre os filtros dinâmicos. */
export function pruneTreeForGroupAnalysis(tree, options = {}) {
  const { filters } = options;
  if (!isAnalisePorAgrupamento(filters) || !hasActiveGroupAggregateFilters(filters)) {
    return tree;
  }

  const filterLevel = getAnaliseAgrupamentoNivel(filters);
  const context = {
    filters,
    salesVelocityMap: options.salesVelocityMap || {},
    catalogStockContext: options.catalogStockContext || null,
  };

  const out = {};
  for (const [key, node] of Object.entries(tree || {})) {
    if (key === '_rootSkus') {
      out._rootSkus = [];
      continue;
    }
    const pruned = visitGroupNode(node, filterLevel, context);
    if (pruned) out[key] = pruned;
  }
  return out;
}

export function getCatalogFlattenOptions(filters) {
  return {
    collapseSoloSkuBranches: !isAnalisePorAgrupamento(filters),
  };
}

/** Assinatura para reiniciar expansão quando filtros de grupo mudam. */
export function catalogGroupAnalysisSig(filters) {
  if (!isAnalisePorAgrupamento(filters) || !hasActiveGroupAggregateFilters(filters)) return '';
  const { campo: c1, operador: o1, valor: v1, valorAte: va1 } = getCatalogMetricFilterKeys(1);
  const { campo: c2, operador: o2, valor: v2, valorAte: va2 } = getCatalogMetricFilterKeys(2);
  return JSON.stringify({
    nivel: getAnaliseAgrupamentoNivel(filters),
    ev: Boolean(filters?.estoqueVirtual),
    q: [filters?.quantidadeOperador, filters?.quantidadeValor, filters?.quantidadeValorAte],
    m1: [filters?.[c1], filters?.[o1], filters?.[v1], filters?.[va1]],
    m2: [filters?.[c2], filters?.[o2], filters?.[v2], filters?.[va2]],
  });
}
