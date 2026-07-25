import { isCadastroIncompleto } from '@/components/produtos/ProdutosHelpers';
import { parseSearchTerms } from '@/lib/searchTokens';
import {
  produtoMatchesCategoryAreaTokens,
  splitCatalogSearchTokens,
} from '@/lib/catalogSearchArea';
import {
  DEFAULT_CATALOG_METRIC_FILTER,
  DEFAULT_CATALOG_METRIC_FILTER_2,
  describeNumericComparison,
  getCatalogMetricFilterKeys,
  getProdutoNumericMetricValue,
  hasActiveCatalogMetricFilter,
  hasActiveNumericComparison,
  matchesNumericComparison,
  parseNumericFilterValue,
  CATALOG_NUMERIC_METRIC_LABELS,
} from '@/lib/catalogNumericFilters';
import { produtoMatchesAbcdFilter } from '@/lib/catalogAbcdEnrichment';
import { getCatalogEstoqueExibicaoQuantidade } from '@/lib/catalogSalesVelocity';
import { getUnidadeExibicaoSigla } from '@/lib/productUnits';

/** Filtro de quantidade do atalho «somente positivos» (estoque > 0). */
export const CATALOG_SOMENTE_POSITIVOS_QUANTIDADE = {
  quantidadeOperador: 'gt',
  quantidadeValor: '0',
  quantidadeValorAte: '',
};

export const ABCD_FILTER_VALUES = ['A', 'B', 'C', 'D', 'E'];

export const ABCD_FILTER_LABELS = {
  A: 'Classe A',
  B: 'Classe B',
  C: 'Classe C',
  D: 'Classe D',
  E: 'Classe E (sem venda)',
};

export const DEFAULT_PRODUTO_FILTERS = {
  searchTerm: '',
  /** false = contém (substring); true = começa com (prefixo), ambos sem distinção de maiúsculas */
  searchStartsWith: false,
  categoria: 'all',
  fornecedorId: 'all',
  statusEstoque: 'all',
  abcd: 'all',
  tag: '',
  cadastroIncompleto: 'all',
  ativoStatus: 'ativos',
  unidadeVitrine: 'all',
  estoqueVirtual: false,
  ...CATALOG_SOMENTE_POSITIVOS_QUANTIDADE,
  ...DEFAULT_CATALOG_METRIC_FILTER,
  ...DEFAULT_CATALOG_METRIC_FILTER_2,
};

/** Estado inicial sempre que o utilizador abre ou reabre o catálogo. */
export function getCatalogProdutoEntryFilters() {
  return { ...DEFAULT_PRODUTO_FILTERS };
}

function getSearchTokens(rawTerm) {
  return parseSearchTerms(rawTerm);
}

function hasActiveQuantityFilter(filters) {
  return hasActiveNumericComparison(
    filters?.quantidadeOperador,
    filters?.quantidadeValor,
    filters?.quantidadeValorAte,
  );
}

/** Atalho do catálogo: somente produtos com estoque > 0 (quantidade maior que zero). */
export function isSomentePositivosFilter(filters) {
  if (!filters || filters.quantidadeOperador !== 'gt') return false;
  if (String(filters.quantidadeValorAte ?? '').trim()) return false;
  const valor = parseNumericFilterValue(filters.quantidadeValor);
  return valor === 0;
}

/** Busca por nome/descrição/códigos; espaço ou ";" exigem múltiplos termos.
 *  Termos com prefixo XX filtram pela categoria de cadastro (ex.: cuba XXmolhadas, XXj-). */
export function produtoMatchesSearchTerm(produto, rawTerm, options = {}) {
  const terms = getSearchTokens(rawTerm);
  if (terms.length === 0) return true;

  const { textTerms, areaNeedles } = splitCatalogSearchTokens(terms);
  if (!produtoMatchesCategoryAreaTokens(produto, areaNeedles)) return false;
  if (textTerms.length === 0) return true;

  const startsWith = options.startsWith ?? options.searchStartsWith ?? false;
  const haystack = [
    produto?.nome,
    produto?.descricao,
    produto?.codigo_interno,
    produto?.codigo_barras,
    produto?.marca,
    produto?.categoria_nome,
    ...(Array.isArray(produto?.tags) ? produto.tags : []),
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());
  return textTerms.every((term) =>
    haystack.some((s) => (startsWith ? s.startsWith(term) : s.includes(term)))
  );
}

/** Siglas de vitrine presentes no catálogo (para o select de filtro). */
export function collectCatalogVitrineUnits(produtos = []) {
  const siglas = new Set();
  for (const produto of produtos) {
    if (!produto || typeof produto !== 'object') continue;
    const sigla = getUnidadeExibicaoSigla(produto);
    if (sigla) siglas.add(String(sigla).trim().toUpperCase());
  }
  return Array.from(siglas).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function produtoMatchesVitrineFilter(produto, unidadeVitrine = 'all') {
  if (!unidadeVitrine || unidadeVitrine === 'all') return true;
  const sigla = getUnidadeExibicaoSigla(produto);
  return String(sigla).trim().toUpperCase() === String(unidadeVitrine).trim().toUpperCase();
}

function produtoMatchesCatalogMetricFilter(produto, filters, slot, salesVelocityMap, catalogStockContext) {
  if (!hasActiveCatalogMetricFilter(filters, slot)) return true;
  const { campo, operador, valor, valorAte } = getCatalogMetricFilterKeys(slot);
  const metricValue = getProdutoNumericMetricValue(produto, filters[campo], {
    salesVelocityMap,
    catalogStockContext,
  });
  if (metricValue === null) return false;
  return matchesNumericComparison(metricValue, filters[operador], filters[valor], filters[valorAte]);
}

function resolveProdutoEstoqueFiltro(produto, catalogStockContext) {
  if (catalogStockContext?.estoqueVirtual) {
    return getCatalogEstoqueExibicaoQuantidade(produto, catalogStockContext).quantidade;
  }
  return Number(produto?.estoque_atual || 0);
}

/** Mesma lógica de filtros do catálogo (`Produtos.jsx`). */
export function filterProdutos(produtos, filters, options = {}) {
  const { salesVelocityMap = {}, catalogStockContext = null } = options;
  if (!Array.isArray(produtos)) return [];
  return produtos.filter((p) => {
    if (!p || typeof p !== 'object') return false;

    const searchTermMatch = produtoMatchesSearchTerm(p, filters.searchTerm, {
      startsWith: !!filters.searchStartsWith,
    });
    const categoriaMatch = filters.categoria === 'all' || p.categoria_nome === filters.categoria;
    const tagMatch =
      !filters.tag ||
      (Array.isArray(p.tags) &&
        p.tags.some((t) => t && t.toLowerCase().includes(String(filters.tag).toLowerCase())));
    const fornecedorMatch =
      filters.fornecedorId === 'all' || p.fornecedor_padrao_id === filters.fornecedorId;
    const vitrineMatch = produtoMatchesVitrineFilter(p, filters.unidadeVitrine);
    const abcdMatch = produtoMatchesAbcdFilter(p, filters.abcd);
    const ativoMatch =
      !filters.ativoStatus ||
      filters.ativoStatus === 'all' ||
      (filters.ativoStatus === 'ativos' && p.ativo) ||
      (filters.ativoStatus === 'inativos' && !p.ativo);

    const quantidadeMatch = () => {
      if (!hasActiveQuantityFilter(filters)) return true;
      const estoque = resolveProdutoEstoqueFiltro(p, catalogStockContext);
      return matchesNumericComparison(
        estoque,
        filters.quantidadeOperador,
        filters.quantidadeValor,
        filters.quantidadeValorAte,
      );
    };

    const metricaMatch = () =>
      produtoMatchesCatalogMetricFilter(p, filters, 1, salesVelocityMap, catalogStockContext) &&
      produtoMatchesCatalogMetricFilter(p, filters, 2, salesVelocityMap, catalogStockContext);

    const statusMatch = () => {
      if (filters.statusEstoque === 'all') return true;
      const estoque = resolveProdutoEstoqueFiltro(p, catalogStockContext);
      const minimo = p.estoque_minimo || 0;

      if (filters.statusEstoque === 'inativo' && !p.ativo) return true;
      if (filters.statusEstoque === 'ok' && p.ativo && estoque > minimo) return true;
      if (filters.statusEstoque === 'baixo' && p.ativo && estoque > 0 && estoque <= minimo) return true;
      if (filters.statusEstoque === 'critico' && p.ativo && (estoque <= 0 || estoque <= minimo / 2))
        return true;
      return false;
    };

    const cadastroMatch = () => {
      if (filters.cadastroIncompleto === 'all') return true;
      const { incompleto } = isCadastroIncompleto(p);
      if (filters.cadastroIncompleto === 'incompleto') return incompleto;
      if (filters.cadastroIncompleto === 'completo') return !incompleto;
      return false;
    };

    return (
      searchTermMatch &&
      categoriaMatch &&
      tagMatch &&
      fornecedorMatch &&
      vitrineMatch &&
      abcdMatch &&
      ativoMatch &&
      quantidadeMatch() &&
      metricaMatch() &&
      statusMatch() &&
      cadastroMatch()
    );
  });
}

export function countActiveProdutoFilters(filters) {
  return [
    filters.searchTerm?.trim(),
    filters.categoria !== 'all' && filters.categoria,
    filters.fornecedorId !== 'all' && filters.fornecedorId,
    filters.unidadeVitrine !== 'all' && filters.unidadeVitrine,
    filters.abcd !== 'all' && filters.abcd,
    filters.statusEstoque !== 'all' && filters.statusEstoque,
    filters.tag,
    filters.cadastroIncompleto !== 'all' && filters.cadastroIncompleto,
    filters.ativoStatus !== DEFAULT_PRODUTO_FILTERS.ativoStatus && filters.ativoStatus,
    hasActiveQuantityFilter(filters) &&
      !isSomentePositivosFilter(filters) &&
      filters.quantidadeOperador,
    hasActiveCatalogMetricFilter(filters, 1) && filters.metricaCampo,
    hasActiveCatalogMetricFilter(filters, 2) && filters.metrica2Campo,
  ].filter(Boolean).length;
}

/** Texto legível para cabeçalho de impressão / relatório. */
export function describeProdutoFilters(filters, { categorias = [], fornecedores = [] } = {}) {
  const parts = [];
  const term = (filters.searchTerm || '').trim();
  if (term) {
    const modo = filters.searchStartsWith ? 'começa com' : 'contém';
    const tokens = getSearchTokens(term);
    const { textTerms, areaNeedles } = splitCatalogSearchTokens(tokens);

    if (areaNeedles.length > 0) {
      parts.push(
        areaNeedles.length > 1
          ? `área/categoria (XX): ${areaNeedles.map((needle) => `"${needle}"`).join(' + ')}`
          : `área/categoria (XX): "${areaNeedles[0]}"`
      );
    }

    if (textTerms.length > 0) {
      parts.push(
        textTerms.length > 1
          ? `nome/descrição ${modo} todos: ${textTerms.map((t) => `"${t}"`).join(' + ')}`
          : `nome/descrição ${modo} "${textTerms.join(' ')}"`
      );
    }
  }
  if (filters.categoria && filters.categoria !== 'all') parts.push(`categoria: ${filters.categoria}`);
  if (filters.fornecedorId && filters.fornecedorId !== 'all') {
    const f = fornecedores.find((x) => x.id === filters.fornecedorId);
    parts.push(`fornecedor: ${f?.nome || filters.fornecedorId}`);
  }
  if (filters.unidadeVitrine && filters.unidadeVitrine !== 'all') {
    parts.push(`unidade vitrine: ${filters.unidadeVitrine}`);
  }
  if (filters.statusEstoque && filters.statusEstoque !== 'all') {
    const labels = { ok: 'OK', baixo: 'Baixo', critico: 'Crítico', inativo: 'Inativo' };
    parts.push(`status: ${labels[filters.statusEstoque] || filters.statusEstoque}`);
  }
  if (filters.abcd && filters.abcd !== 'all') {
    parts.push(`curva ABCD: ${ABCD_FILTER_LABELS[filters.abcd] || filters.abcd}`);
  }
  if ((filters.tag || '').trim()) parts.push(`tag contém "${filters.tag.trim()}"`);
  if (filters.cadastroIncompleto === 'incompleto') parts.push('cadastro incompleto');
  if (filters.cadastroIncompleto === 'completo') parts.push('cadastro completo');
  if (filters.ativoStatus === 'ativos') parts.push('somente ativos');
  if (filters.ativoStatus === 'inativos') parts.push('somente inativos');
  if (hasActiveQuantityFilter(filters)) {
    parts.push(
      `quantidade ${describeNumericComparison(
        filters.quantidadeOperador,
        filters.quantidadeValor,
        filters.quantidadeValorAte,
      )}`
    );
  }
  if (filters.estoqueVirtual) parts.push('estoque virtual (pedidos em trânsito)');
  for (const slot of [1, 2]) {
    if (!hasActiveCatalogMetricFilter(filters, slot)) continue;
    const { campo, operador, valor, valorAte } = getCatalogMetricFilterKeys(slot);
    const metricLabel = CATALOG_NUMERIC_METRIC_LABELS[filters[campo]] || filters[campo];
    const prefix = slot === 2 ? 'métrica 2' : 'métrica';
    parts.push(
      `${prefix}: ${metricLabel} ${describeNumericComparison(
        filters[operador],
        filters[valor],
        filters[valorAte],
      )}`
    );
  }
  return parts.length ? parts.join(' · ') : 'nenhum';
}
