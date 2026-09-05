import { getCatalogoComercialView } from '@/lib/productUnits';
import { calcMarkup } from '@/components/produtos/treegrid/useTreeGrid';
import {
  getCatalogLeadTimeDias,
  getCatalogMedia30dFrom60d,
  getCatalogPontoEsperadoLt,
  getCatalogPontoFuturo,
} from '@/lib/catalogSalesVelocity';

export const NUMERIC_COMPARISON_OPERATORS = [
  { value: 'all', label: 'Qualquer valor' },
  { value: 'gt', label: 'Maior que' },
  { value: 'gte', label: 'Maior ou igual a' },
  { value: 'lt', label: 'Menor que' },
  { value: 'lte', label: 'Menor ou igual a' },
  { value: 'eq', label: 'Igual a' },
  { value: 'between', label: 'Entre' },
];

export const NUMERIC_COMPARISON_LABELS = Object.fromEntries(
  NUMERIC_COMPARISON_OPERATORS.filter((o) => o.value !== 'all').map((o) => [o.value, o.label.toLowerCase()]),
);

export const CATALOG_NUMERIC_METRIC_FIELDS = [
  { value: 'all', label: 'Selecione a métrica' },
  { value: 'markup', label: 'Markup %' },
  { value: 'margem', label: 'Margem %' },
  { value: 'preco_venda', label: 'Preço de venda' },
  { value: 'valor_compra', label: 'Valor de compra' },
  { value: 'custo_total', label: 'Custo total' },
  { value: 'iep_score', label: 'Score IEP' },
  { value: 'iep_score_nivel_1', label: 'Média nível 1' },
  { value: 'iep_score_nivel_2', label: 'Média nível 2' },
  { value: 'iep_score_nivel_3', label: 'Média nível 3' },
  { value: 'iep_score_nivel_4', label: 'Média nível 4' },
  { value: 'iep_score_nivel_5', label: 'Média nível 5' },
  { value: 'media_30d', label: 'Média 30d' },
  { value: 'ponto_futuro', label: 'Ponto futuro' },
  { value: 'ponto_esperado_lt', label: 'Ponto LT' },
  { value: 'tempo_reposicao', label: 'Lead time (dias)' },
];

export const CATALOG_VELOCITY_METRIC_FIELDS = ['media_30d', 'ponto_futuro', 'ponto_esperado_lt'];

export const CATALOG_NUMERIC_METRIC_LABELS = Object.fromEntries(
  CATALOG_NUMERIC_METRIC_FIELDS.filter((f) => f.value !== 'all').map((f) => [f.value, f.label]),
);

export const DEFAULT_CATALOG_METRIC_FILTER = {
  metricaCampo: 'all',
  metricaOperador: 'all',
  metricaValor: '',
  metricaValorAte: '',
};

export const DEFAULT_CATALOG_METRIC_FILTER_2 = {
  metrica2Campo: 'all',
  metrica2Operador: 'all',
  metrica2Valor: '',
  metrica2ValorAte: '',
};

export function getCatalogMetricFilterKeys(slot = 1) {
  const prefix = slot === 2 ? 'metrica2' : 'metrica';
  return {
    campo: `${prefix}Campo`,
    operador: `${prefix}Operador`,
    valor: `${prefix}Valor`,
    valorAte: `${prefix}ValorAte`,
  };
}

export function parseNumericFilterValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function hasActiveNumericComparison(operador, valor, valorAte) {
  if (!operador || operador === 'all') return false;
  if (operador === 'between') {
    return (
      parseNumericFilterValue(valor) !== null ||
      parseNumericFilterValue(valorAte) !== null
    );
  }
  return parseNumericFilterValue(valor) !== null;
}

export function matchesNumericComparison(actual, operador, valor, valorAte) {
  if (!operador || operador === 'all') return true;
  const numericActual = Number(actual);
  if (!Number.isFinite(numericActual)) return false;

  const bound = parseNumericFilterValue(valor);
  const boundAte = parseNumericFilterValue(valorAte);

  switch (operador) {
    case 'gt':
      return bound === null ? true : numericActual > bound;
    case 'gte':
      return bound === null ? true : numericActual >= bound;
    case 'lt':
      return bound === null ? true : numericActual < bound;
    case 'lte':
      return bound === null ? true : numericActual <= bound;
    case 'eq':
      return bound === null ? true : numericActual === bound;
    case 'between': {
      const min = bound !== null ? bound : -Infinity;
      const max = boundAte !== null ? boundAte : Infinity;
      return numericActual >= Math.min(min, max) && numericActual <= Math.max(min, max);
    }
    default:
      return true;
  }
}

export function hasActiveCatalogMetricFilter(filters, slot = 1) {
  const { campo, operador, valor, valorAte } = getCatalogMetricFilterKeys(slot);
  if (!filters || filters[campo] === 'all') return false;
  return hasActiveNumericComparison(filters[operador], filters[valor], filters[valorAte]);
}

export function catalogMetricNeedsSalesVelocity(campo) {
  return CATALOG_VELOCITY_METRIC_FIELDS.includes(campo);
}

export function filtersNeedSalesVelocity(filters) {
  if (!filters) return false;
  for (const slot of [1, 2]) {
    const { campo } = getCatalogMetricFilterKeys(slot);
    if (hasActiveCatalogMetricFilter(filters, slot) && catalogMetricNeedsSalesVelocity(filters[campo])) {
      return true;
    }
  }
  return false;
}

const CATALOG_IEP_METRIC_FIELDS = [
  'iep_score',
  'iep_score_nivel_1',
  'iep_score_nivel_2',
  'iep_score_nivel_3',
  'iep_score_nivel_4',
  'iep_score_nivel_5',
];

export function catalogMetricNeedsIep(campo) {
  return CATALOG_IEP_METRIC_FIELDS.includes(campo);
}

export function filtersNeedIep(filters) {
  if (!filters) return false;
  for (const slot of [1, 2]) {
    const { campo } = getCatalogMetricFilterKeys(slot);
    if (hasActiveCatalogMetricFilter(filters, slot) && catalogMetricNeedsIep(filters[campo])) {
      return true;
    }
  }
  return false;
}

export function getProdutoNumericMetricValue(produto, campo, { salesVelocityMap = {}, catalogStockContext = null } = {}) {
  if (!produto || !campo || campo === 'all') return null;
  const cat = getCatalogoComercialView(produto);
  const velocity = salesVelocityMap[String(produto?.id)];

  switch (campo) {
    case 'markup':
      return calcMarkup(produto);
    case 'margem':
      return cat.precoVenda > 0 && cat.custoNaEmbalagem >= 0 ? cat.margemContribuicaoPct : 0;
    case 'preco_venda':
      return cat.precoVenda;
    case 'valor_compra':
      return cat.valorCompraNaEmbalagem;
    case 'custo_total':
      return cat.custoNaEmbalagem;
    case 'iep_score':
    case 'iep_score_nivel_1':
    case 'iep_score_nivel_2':
    case 'iep_score_nivel_3':
    case 'iep_score_nivel_4':
    case 'iep_score_nivel_5':
      return Number(produto?.[campo]) || 0;
    case 'media_30d':
      return getCatalogMedia30dFrom60d(velocity);
    case 'ponto_futuro':
      return getCatalogPontoFuturo(produto, velocity, catalogStockContext);
    case 'ponto_esperado_lt':
      return getCatalogPontoEsperadoLt(velocity, getCatalogLeadTimeDias(produto));
    case 'tempo_reposicao':
      return Number(produto?.tempo_reposicao_dias) || 0;
    default:
      return null;
  }
}

export function describeNumericComparison(operador, valor, valorAte) {
  const inicio = String(valor ?? '').trim();
  const fim = String(valorAte ?? '').trim();
  if (operador === 'between') {
    return `entre ${inicio || '-∞'} e ${fim || '+∞'}`;
  }
  return `${NUMERIC_COMPARISON_LABELS[operador] || operador} ${inicio}`;
}
