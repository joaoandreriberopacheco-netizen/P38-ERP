/** Largura fixa da coluna Produto no catálogo (vista plana e árvore). */
export const CATALOG_PRODUTO_COL_WIDTH = 300;

const PRODUTO_TEXT_AREA_PX = CATALOG_PRODUTO_COL_WIDTH - 72;
const CHARS_PER_LINE = Math.max(16, Math.floor(PRODUTO_TEXT_AREA_PX / 6.5));

/** Estimativa de altura de linha quando a descrição quebra em várias linhas (virtualização). */
export function estimateCatalogProdutoRowHeight(nome = '', { codigoInterno = false, isGroup = false } = {}) {
  const lines = Math.max(1, Math.ceil(String(nome).length / CHARS_PER_LINE));
  const base = isGroup ? 36 : 32;
  const codigoExtra = codigoInterno ? 14 : 0;
  return Math.max(isGroup ? 40 : 48, base + lines * 16 + codigoExtra + 8);
}

export function catalogProdutoColStyle() {
  return {
    width: CATALOG_PRODUTO_COL_WIDTH,
    minWidth: CATALOG_PRODUTO_COL_WIDTH,
    maxWidth: CATALOG_PRODUTO_COL_WIDTH,
  };
}
