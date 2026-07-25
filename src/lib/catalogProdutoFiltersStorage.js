import {
  CATALOG_SOMENTE_POSITIVOS_QUANTIDADE,
  DEFAULT_PRODUTO_FILTERS,
} from '@/lib/filterProdutos';
import { DEFAULT_CATALOG_METRIC_FILTER_2 } from '@/lib/catalogNumericFilters';

/** Filtros do catálogo partilhados entre Produtos e Relatório de estoque (sessionStorage). */
export const CATALOG_PRODUTO_FILTERS_STORAGE_KEY = 'varejosync.catalogoProdutoFilters';
const CATALOG_PRODUTO_FILTERS_STORAGE_VERSION = 7;

export function normalizeCatalogProdutoFilters(raw) {
  const base = { ...DEFAULT_PRODUTO_FILTERS };
  if (!raw || typeof raw !== 'object') return base;
  const isCurrentVersion = raw.storageVersion === CATALOG_PRODUTO_FILTERS_STORAGE_VERSION;
  return {
    storageVersion: CATALOG_PRODUTO_FILTERS_STORAGE_VERSION,
    searchTerm: String(raw.searchTerm ?? ''),
    searchStartsWith: Boolean(raw.searchStartsWith),
    categoria: raw.categoria || 'all',
    fornecedorId: raw.fornecedorId || 'all',
    unidadeVitrine: isCurrentVersion
      ? (raw.unidadeVitrine || DEFAULT_PRODUTO_FILTERS.unidadeVitrine)
      : DEFAULT_PRODUTO_FILTERS.unidadeVitrine,
    statusEstoque: raw.statusEstoque || 'all',
    abcd: isCurrentVersion ? (raw.abcd || DEFAULT_PRODUTO_FILTERS.abcd) : DEFAULT_PRODUTO_FILTERS.abcd,
    tag: String(raw.tag ?? ''),
    cadastroIncompleto: raw.cadastroIncompleto || 'all',
    ativoStatus: isCurrentVersion ? (raw.ativoStatus || DEFAULT_PRODUTO_FILTERS.ativoStatus) : DEFAULT_PRODUTO_FILTERS.ativoStatus,
    quantidadeOperador: isCurrentVersion
      ? (raw.quantidadeOperador || DEFAULT_PRODUTO_FILTERS.quantidadeOperador)
      : CATALOG_SOMENTE_POSITIVOS_QUANTIDADE.quantidadeOperador,
    quantidadeValor: isCurrentVersion
      ? String(raw.quantidadeValor ?? '')
      : CATALOG_SOMENTE_POSITIVOS_QUANTIDADE.quantidadeValor,
    quantidadeValorAte: isCurrentVersion
      ? String(raw.quantidadeValorAte ?? '')
      : CATALOG_SOMENTE_POSITIVOS_QUANTIDADE.quantidadeValorAte,
    metricaCampo: isCurrentVersion
      ? (raw.metricaCampo || DEFAULT_PRODUTO_FILTERS.metricaCampo)
      : DEFAULT_PRODUTO_FILTERS.metricaCampo,
    metricaOperador: isCurrentVersion
      ? (raw.metricaOperador || DEFAULT_PRODUTO_FILTERS.metricaOperador)
      : DEFAULT_PRODUTO_FILTERS.metricaOperador,
    metricaValor: isCurrentVersion
      ? String(raw.metricaValor ?? '')
      : DEFAULT_PRODUTO_FILTERS.metricaValor,
    metricaValorAte: isCurrentVersion
      ? String(raw.metricaValorAte ?? '')
      : DEFAULT_PRODUTO_FILTERS.metricaValorAte,
    metrica2Campo: isCurrentVersion
      ? (raw.metrica2Campo || DEFAULT_PRODUTO_FILTERS.metrica2Campo)
      : DEFAULT_CATALOG_METRIC_FILTER_2.metrica2Campo,
    metrica2Operador: isCurrentVersion
      ? (raw.metrica2Operador || DEFAULT_PRODUTO_FILTERS.metrica2Operador)
      : DEFAULT_CATALOG_METRIC_FILTER_2.metrica2Operador,
    metrica2Valor: isCurrentVersion
      ? String(raw.metrica2Valor ?? '')
      : DEFAULT_CATALOG_METRIC_FILTER_2.metrica2Valor,
    metrica2ValorAte: isCurrentVersion
      ? String(raw.metrica2ValorAte ?? '')
      : DEFAULT_CATALOG_METRIC_FILTER_2.metrica2ValorAte,
  };
}

export function loadCatalogProdutoFilters() {
  try {
    const raw = sessionStorage.getItem(CATALOG_PRODUTO_FILTERS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PRODUTO_FILTERS };
    return normalizeCatalogProdutoFilters(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PRODUTO_FILTERS };
  }
}

export function saveCatalogProdutoFilters(filters) {
  try {
    sessionStorage.setItem(
      CATALOG_PRODUTO_FILTERS_STORAGE_KEY,
      JSON.stringify(normalizeCatalogProdutoFilters(filters))
    );
  } catch {
    /* quota / private mode */
  }
}
