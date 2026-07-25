import { formatEstoqueApresentacao, formatQuantidadeCatalogoApresentacao } from '@/lib/productUnits';

export function createCatalogStockContext(estoqueVirtual = false, pendentePorProduto = {}) {
  return {
    estoqueVirtual: estoqueVirtual === true,
    pendentePorProduto: pendentePorProduto || {},
  };
}

export function isCatalogEstoqueVirtualAtivo(catalogStockContext) {
  return catalogStockContext?.estoqueVirtual === true;
}

export function getCatalogPendenteBase(produto, pendentePorProduto = {}) {
  return Number(pendentePorProduto[String(produto?.id)]) || 0;
}

/** Estoque físico na unidade exibida no catálogo (sem pedidos em trânsito). */
export function getCatalogEstoqueFisicoExibicao(produto) {
  const apresent = formatEstoqueApresentacao(produto);
  if (apresent) {
    return {
      quantidade: Number(apresent.quantidade) || 0,
      unidade: apresent.sigla,
      rotulo: apresent.rotulo || '',
    };
  }
  const unidade = String(produto?.unidade_principal || 'UN').trim().toUpperCase() || 'UN';
  return {
    quantidade: Number(produto?.estoque_atual) || 0,
    unidade,
    rotulo: '',
  };
}

/**
 * Estoque exibido no catálogo.
 * Com estoque virtual, soma pedidos aprovados/em trânsito ainda não recebidos.
 */
export function resolveCatalogEstoqueExibicao(produto, catalogStockContext = null) {
  const fisico = getCatalogEstoqueFisicoExibicao(produto);
  if (!isCatalogEstoqueVirtualAtivo(catalogStockContext)) {
    return {
      ...fisico,
      fisico: fisico.quantidade,
      pendente: 0,
      virtual: false,
    };
  }

  const pendenteBase = getCatalogPendenteBase(produto, catalogStockContext.pendentePorProduto);
  if (pendenteBase <= 0) {
    return {
      ...fisico,
      fisico: fisico.quantidade,
      pendente: 0,
      virtual: true,
    };
  }

  const pendenteDisp = formatQuantidadeCatalogoApresentacao(produto, pendenteBase);
  const pendente = Number(pendenteDisp.quantidade) || 0;

  return {
    quantidade: fisico.quantidade + pendente,
    unidade: fisico.unidade || pendenteDisp.sigla,
    rotulo: fisico.rotulo,
    fisico: fisico.quantidade,
    pendente,
    virtual: true,
  };
}

/** Soma estoque de SKUs para linhas de grupo (respeita estoque virtual). */
export function aggregateCatalogEstoqueExibicao(skus = [], catalogStockContext = null) {
  if (!skus?.length) return { mode: 'empty', quantidade: 0 };

  const rows = skus.map((sku) => resolveCatalogEstoqueExibicao(sku, catalogStockContext));
  const units = [...new Set(rows.map((row) => row.unidade).filter(Boolean))];

  if (units.length === 1) {
    const quantidade = rows.reduce((sum, row) => sum + (Number(row.quantidade) || 0), 0);
    const pendente = rows.reduce((sum, row) => sum + (Number(row.pendente) || 0), 0);
    return {
      mode: 'display',
      quantidade,
      sigla: units[0],
      pendente,
      virtual: isCatalogEstoqueVirtualAtivo(catalogStockContext),
    };
  }

  const quantidade = rows.reduce((sum, row) => sum + (Number(row.quantidade) || 0), 0);
  return { mode: 'mixed', quantidade, virtual: isCatalogEstoqueVirtualAtivo(catalogStockContext) };
}
