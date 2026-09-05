/** Colunas que exigem fetch 90d + enrichProdutosComIep no mount. */
export const CATALOG_IEP_PRODUTO_COLUMNS = [
  'iep_score',
  'iep_codigo_comportamento',
  'iep_score_nivel_1',
  'iep_score_nivel_2',
  'iep_score_nivel_3',
  'iep_score_nivel_4',
  'iep_score_nivel_5',
];

export const DEFAULT_CATALOG_PRODUTO_COLUMNS = [
  'status',
  'fornecedor',
  'estoque_atual',
  'preco_venda',
  'margem',
  'show_logistica',
];

const CATALOG_PRODUTO_COLUMNS_STORAGE_KEY = 'varejosync.catalogoProdutoColumns';
const CATALOG_PRODUTO_COLUMNS_STORAGE_VERSION = 1;

const KNOWN_CATALOG_PRODUTO_COLUMNS = new Set([
  'status',
  'cadastro',
  'codigo_interno',
  'codigo_barras',
  'categoria',
  'tags',
  'fornecedor',
  'preco_venda',
  'preco_custo',
  'margem',
  'valor_compra',
  'avaria_percentual',
  'markup',
  'estoque_atual',
  'media_30d',
  'ponto_futuro',
  'ponto_esperado_lt',
  'estoque_minimo',
  'estoque_ideal',
  'estoque_maximo',
  'tempo_reposicao',
  'peso',
  'dimensoes',
  'tipo',
  'unidade',
  'unidades_pacote',
  'show_comercial',
  'show_logistica',
  'inventario_valorizado',
  'abcd',
  'iep_score',
  'iep_codigo_comportamento',
  'iep_score_nivel_1',
  'iep_score_nivel_2',
  'iep_score_nivel_3',
  'iep_score_nivel_4',
  'iep_score_nivel_5',
]);

export function normalizeCatalogProdutoColumns(raw) {
  if (!Array.isArray(raw)) return [...DEFAULT_CATALOG_PRODUTO_COLUMNS];
  const unique = [];
  for (const col of raw) {
    if (KNOWN_CATALOG_PRODUTO_COLUMNS.has(col) && !unique.includes(col)) {
      unique.push(col);
    }
  }
  return unique.length > 0 ? unique : [...DEFAULT_CATALOG_PRODUTO_COLUMNS];
}

export function loadCatalogProdutoColumns() {
  try {
    const raw = localStorage.getItem(CATALOG_PRODUTO_COLUMNS_STORAGE_KEY);
    if (!raw) return [...DEFAULT_CATALOG_PRODUTO_COLUMNS];
    const parsed = JSON.parse(raw);
    return normalizeCatalogProdutoColumns(Array.isArray(parsed) ? parsed : parsed?.columns);
  } catch {
    return [...DEFAULT_CATALOG_PRODUTO_COLUMNS];
  }
}

export function saveCatalogProdutoColumns(columns) {
  try {
    localStorage.setItem(
      CATALOG_PRODUTO_COLUMNS_STORAGE_KEY,
      JSON.stringify({
        storageVersion: CATALOG_PRODUTO_COLUMNS_STORAGE_VERSION,
        columns: normalizeCatalogProdutoColumns(columns),
      })
    );
  } catch {
    /* quota / private mode */
  }
}
