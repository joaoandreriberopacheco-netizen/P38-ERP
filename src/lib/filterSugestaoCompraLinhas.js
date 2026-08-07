import { produtoMatchesAbcdMultiFilter } from '@/lib/catalogAbcdEnrichment';
import {
  hasActiveNumericComparison,
  matchesNumericComparison,
} from '@/lib/catalogNumericFilters';
import {
  collectCatalogVitrineUnits,
  produtoMatchesSearchTerm,
  produtoMatchesVitrineFilter,
} from '@/lib/filterProdutos';
import { getUnidadeExibicaoSigla } from '@/lib/productUnits';
import { sugestaoPrecisaReposicao,
  sugestaoTemGiroVelocidade,
} from '@/lib/calcularSugestaoCompraVelocidade';
import { linhaExigeAcaoCompra } from '@/lib/sugestaoCompraOperationalMode';
import { searchTextIncludes } from '@/lib/normalizeSearchText';

export const SUGESTAO_STATUS_ESTOQUE_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'ok', label: 'OK' },
  { value: 'baixo', label: 'Baixo' },
  { value: 'critico', label: 'Crítico' },
];

export const SUGESTAO_HIERARQUIA_NIVEL_OPTIONS = [
  { value: 'all', label: 'Todos os níveis' },
  { value: '1', label: 'Nível 1 — grupo' },
  { value: '2', label: 'Nível 2 — tipo' },
  { value: '3', label: 'Nível 3' },
  { value: '4', label: 'Nível 4' },
  { value: '5', label: 'Nível 5 — modelo' },
];

export const DEFAULT_SUGESTAO_COMPRA_FILTERS = {
  searchTerm: '',
  searchStartsWith: false,
  categoriaId: 'all',
  fornecedorId: 'all',
  hierarquiaNivel: 'all',
  selectedAbcd: [],
  selectedTags: [],
  unidadeVitrine: 'all',
  statusEstoque: 'all',
  quantidadeOperador: 'all',
  quantidadeValor: '',
  quantidadeValorAte: '',
  sugestaoQuantidadeOperador: 'all',
  sugestaoQuantidadeValor: '',
  sugestaoQuantidadeValorAte: '',
  hidePending: false,
  considerarPedidosAprovadosEstoque: true,
  somenteAbaixoPontoFuturo: false,
  roundingMode: 'auto',
  agruparHierarquia: true,
};

function hasActiveSugestaoQuantityFilter(filters) {
  return hasActiveNumericComparison(
    filters?.sugestaoQuantidadeOperador,
    filters?.sugestaoQuantidadeValor,
    filters?.sugestaoQuantidadeValorAte,
  );
}

function produtoHierarquiaNivelPreenchido(produto, nivel) {
  const n = Number(nivel);
  if (!Number.isFinite(n) || n < 1 || n > 5) return true;
  const campos = [
    produto?.campo_hierarquico_1,
    produto?.campo_hierarquico_2,
    produto?.campo_hierarquico_3,
    produto?.campo_hierarquico_4,
    produto?.campo_hierarquico_5,
  ];
  return Boolean(String(campos[n - 1] || '').trim());
}

function linhaQuantidadeSugerida(linha, options = {}) {
  if (typeof options.quantidadeBaseLinha === 'function') {
    return Number(options.quantidadeBaseLinha(linha)) || 0;
  }
  return Number(linha?.sugestao?.quantidade_sugerida_base) || 0;
}

function linhaFornecedorId(linha, options = {}) {
  if (typeof options.resolveFornecedorId === 'function') {
    const resolved = options.resolveFornecedorId(linha);
    if (resolved) return resolved;
  }
  const sku = linha?.produto || linha?.skus?.[0];
  return sku?.fornecedor_padrao_id || '';
}

function linhaEstoqueAtual(linha) {
  return Number(linha?.sugestao?.estoque_atual ?? linha?.produto?.estoque_atual) || 0;
}

function linhaPontoPedido(linha) {
  return Number(linha?.sugestao?.ponto_pedido) || 0;
}

export function linhaAbaixoPontoFuturo(linha) {
  return linhaExigeAcaoCompra(linha);
}

export function linhaTemGiroVelocidade(linha) {
  return sugestaoTemGiroVelocidade(linha?.sugestao);
}

function linhaMatchesStatusEstoque(linha, statusEstoque = 'all') {
  if (!statusEstoque || statusEstoque === 'all') return true;

  const estoque = linhaEstoqueAtual(linha);
  const minimo = linhaPontoPedido(linha);

  if (statusEstoque === 'ok') return minimo > 0 ? estoque > minimo : estoque > 0;
  if (statusEstoque === 'baixo') {
    return minimo > 0 && estoque > 0 && estoque <= minimo;
  }
  if (statusEstoque === 'critico') {
    return estoque <= 0 || (minimo > 0 && estoque <= minimo / 2);
  }
  return true;
}

function linhaMatchesSearch(linha, filters) {
  const term = String(filters?.searchTerm || '').trim();
  if (!term) return true;

  const haystackLabel = searchTextIncludes(linha?.label || '', term);
  if (haystackLabel) return true;

  return (linha?.skus || []).some((produto) =>
    produtoMatchesSearchTerm(produto, term, {
      startsWith: !!filters?.searchStartsWith,
    }),
  );
}

function linhaMatchesSkuPredicate(linha, predicate) {
  return (linha?.skus || []).some((produto) => predicate(produto));
}

/** Unidades de vitrine presentes nas linhas de sugestão. */
export function collectSugestaoVitrineUnits(linhas = []) {
  const produtos = linhas.flatMap((linha) => linha?.skus || []);
  return collectCatalogVitrineUnits(produtos);
}

export function filterSugestaoCompraLinhas(
  linhas,
  filters = DEFAULT_SUGESTAO_COMPRA_FILTERS,
  options = {},
) {
  if (!Array.isArray(linhas)) return [];

  return linhas.filter((linha) => {
    if (filters.somenteAbaixoPontoFuturo === true && !linhaAbaixoPontoFuturo(linha)) return false;
    if (filters.hidePending && linha.quantidade_pendente > 0) return false;
    if (!linhaMatchesSearch(linha, filters)) return false;

    if (
      filters.categoriaId !== 'all' &&
      !linhaMatchesSkuPredicate(linha, (p) => p.categoria_id === filters.categoriaId)
    ) {
      return false;
    }

    if (
      filters.hierarquiaNivel &&
      filters.hierarquiaNivel !== 'all' &&
      !linhaMatchesSkuPredicate(linha, (p) =>
        produtoHierarquiaNivelPreenchido(p, filters.hierarquiaNivel),
      )
    ) {
      return false;
    }

    if (filters.fornecedorId !== 'all') {
      const fid = filters.fornecedorId;
      if (linhaFornecedorId(linha, options) !== fid) return false;
    }

    if (
      Array.isArray(filters.selectedTags) &&
      filters.selectedTags.length > 0 &&
      !linhaMatchesSkuPredicate(linha, (p) =>
        filters.selectedTags.every((t) => p.tags?.includes(t)),
      )
    ) {
      return false;
    }

    if (
      Array.isArray(filters.selectedAbcd) &&
      filters.selectedAbcd.length > 0 &&
      !linhaMatchesSkuPredicate(linha, (p) => produtoMatchesAbcdMultiFilter(p, filters.selectedAbcd))
    ) {
      return false;
    }

    if (
      filters.unidadeVitrine !== 'all' &&
      !linhaMatchesSkuPredicate(linha, (p) =>
        produtoMatchesVitrineFilter(p, filters.unidadeVitrine),
      )
    ) {
      return false;
    }

    if (!linhaMatchesStatusEstoque(linha, filters.statusEstoque)) return false;

    if (hasActiveQuantityFilter(filters)) {
      const estoque = linhaEstoqueAtual(linha);
      if (
        !matchesNumericComparison(
          estoque,
          filters.quantidadeOperador,
          filters.quantidadeValor,
          filters.quantidadeValorAte,
        )
      ) {
        return false;
      }
    }

    if (hasActiveSugestaoQuantityFilter(filters)) {
      const qtd = linhaQuantidadeSugerida(linha, options);
      if (
        !matchesNumericComparison(
          qtd,
          filters.sugestaoQuantidadeOperador,
          filters.sugestaoQuantidadeValor,
          filters.sugestaoQuantidadeValorAte,
        )
      ) {
        return false;
      }
    }

    return true;
  });
}

function hasActiveQuantityFilter(filters) {
  return hasActiveNumericComparison(
    filters?.quantidadeOperador,
    filters?.quantidadeValor,
    filters?.quantidadeValorAte,
  );
}

export function countActiveSugestaoCompraFilters(filters = DEFAULT_SUGESTAO_COMPRA_FILTERS) {
  return [
    filters.searchTerm?.trim(),
    filters.searchStartsWith,
    filters.categoriaId !== 'all',
    filters.fornecedorId !== 'all',
    filters.hierarquiaNivel !== 'all',
    filters.selectedAbcd?.length > 0,
    filters.selectedTags?.length > 0,
    filters.unidadeVitrine !== 'all',
    filters.statusEstoque !== 'all',
    hasActiveQuantityFilter(filters),
    hasActiveSugestaoQuantityFilter(filters),
    filters.hidePending,
    filters.considerarPedidosAprovadosEstoque === true,
    filters.somenteAbaixoPontoFuturo === true,
    filters.roundingMode !== 'auto',
    filters.agruparHierarquia === false,
  ].filter(Boolean).length;
}

export function collectSugestaoTags(linhas = []) {
  const tags = new Set();
  linhas.forEach((linha) => {
    (linha?.skus || []).forEach((produto) => {
      produto?.tags?.forEach((tag) => tags.add(tag));
    });
  });
  return [...tags].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** Rótulo curto da unidade vitrine para chips. */
export function formatSugestaoVitrineLabel(sigla) {
  return getUnidadeExibicaoSigla({ unidade_vitrine: sigla }) || sigla;
}

/** Texto legível para cabeçalho de relatório / exportação. */
export function describeSugestaoCompraFilters(
  filters = DEFAULT_SUGESTAO_COMPRA_FILTERS,
  { categorias = [], fornecedores = [] } = {},
) {
  const parts = [];
  const term = String(filters?.searchTerm || '').trim();
  if (term) {
    parts.push(filters.searchStartsWith ? `busca começa com "${term}"` : `busca "${term}"`);
  }
  if (filters.categoriaId !== 'all') {
    const cat = categorias.find((c) => c.id === filters.categoriaId);
    parts.push(`categoria: ${cat?.nome || filters.categoriaId}`);
  }
  if (filters.hierarquiaNivel !== 'all') {
    const nivel = SUGESTAO_HIERARQUIA_NIVEL_OPTIONS.find((o) => o.value === filters.hierarquiaNivel);
    parts.push(nivel?.label || `nível ${filters.hierarquiaNivel}`);
  }
  if (filters.fornecedorId !== 'all') {
    const f = fornecedores.find((x) => x.id === filters.fornecedorId);
    parts.push(`fornecedor: ${f?.nome || filters.fornecedorId}`);
  }
  if (filters.unidadeVitrine !== 'all') parts.push(`vitrine: ${filters.unidadeVitrine}`);
  if (filters.statusEstoque !== 'all') {
    const status = SUGESTAO_STATUS_ESTOQUE_OPTIONS.find((o) => o.value === filters.statusEstoque);
    parts.push(`estoque: ${status?.label || filters.statusEstoque}`);
  }
  if (Array.isArray(filters.selectedAbcd) && filters.selectedAbcd.length > 0) {
    parts.push(`curvas ${filters.selectedAbcd.join(', ')}`);
  }
  if (Array.isArray(filters.selectedTags) && filters.selectedTags.length > 0) {
    parts.push(`tags: ${filters.selectedTags.join(', ')}`);
  }
  if (filters.somenteAbaixoPontoFuturo === true) parts.push('com sugestão');
  if (filters.considerarPedidosAprovadosEstoque === true) parts.push('incluir pedidos');
  if (filters.hidePending) parts.push('sem em trânsito');
  if (filters.roundingMode !== 'auto') parts.push(`arredondamento: ${filters.roundingMode}`);
  if (filters.agruparHierarquia === false) parts.push('por SKU');
  if (hasActiveQuantityFilter(filters)) parts.push('filtro qtd estoque');
  if (hasActiveSugestaoQuantityFilter(filters)) parts.push('filtro qtd sugerida');
  return parts.length ? parts.join(' · ') : 'nenhum';
}
