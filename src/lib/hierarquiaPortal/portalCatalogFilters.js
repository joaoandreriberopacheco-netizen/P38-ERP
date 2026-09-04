import { DEFAULT_PRODUTO_FILTERS } from '@/lib/filterProdutos';

/** Filtros do catálogo adaptados ao portal — por defeito mostra todos os SKUs do piloto. */
export function getDefaultPortalCatalogFilters() {
  return {
    ...DEFAULT_PRODUTO_FILTERS,
    searchTerm: '',
    quantidadeOperador: 'all',
    quantidadeValor: '',
    quantidadeValorAte: '',
    ativoStatus: 'ativos',
    estoqueVirtual: false,
    statusEstoque: 'all',
    categoria: 'all',
    fornecedorId: 'all',
    tag: '',
    abcd: 'all',
    cadastroIncompleto: 'all',
    unidadeVitrine: 'all',
  };
}
