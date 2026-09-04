/** Largura mínima/máxima da coluna Produto no catálogo. */
export const CATALOG_PRODUTO_COL_MIN = 220;
export const CATALOG_PRODUTO_COL_MAX = 480;

/** Alinhado com GlacialSidebar (recolhido). */
export const P38_SIDEBAR_COLLAPSED_PX = 64;

const PRODUTO_COL_ICON_RAIL = 48;
const PRODUTO_COL_CELL_PAD = 16;
const PRODUTO_COL_ACTIONS = 52;
const PRODUTO_COL_GROUP_BADGE = 36;

let measureCanvas;

function createTextMeasurer() {
  if (typeof document === 'undefined') {
    return (text) => String(text || '').length * 7;
  }
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  const ctx = measureCanvas.getContext('2d');
  return (text, { size = 12, weight = 400, family = 'Inter, system-ui, sans-serif' } = {}) => {
    const value = String(text ?? '');
    if (!value) return 0;
    ctx.font = `${weight} ${size}px ${family}`;
    return Math.ceil(ctx.measureText(value).width);
  };
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

/**
 * Largura fixa da coluna Produto: cobre ~80% dos nomes numa linha;
 * os 20% mais longos quebram linha dentro desta largura.
 */
export function computeCatalogProdutoColWidth(labels = [], options = {}) {
  const {
    readOnly = false,
    maxHierDepth = 0,
    hierStep = 20,
    cellPad = 4,
    includeGroupBadge = false,
  } = options;

  const measure = createTextMeasurer();
  const textWidths = labels
    .map((label) => measure(String(label || '').toUpperCase(), { size: 12, weight: 600 }))
    .filter((w) => w > 0)
    .sort((a, b) => a - b);

  const p80Text = textWidths.length > 0 ? percentile(textWidths, 0.8) : 160;

  const chrome =
    PRODUTO_COL_ICON_RAIL
    + PRODUTO_COL_CELL_PAD
    + cellPad
    + maxHierDepth * hierStep
    + (readOnly ? 0 : PRODUTO_COL_ACTIONS)
    + (includeGroupBadge ? PRODUTO_COL_GROUP_BADGE : 0);

  const total = Math.ceil(p80Text + chrome);
  return Math.min(CATALOG_PRODUTO_COL_MAX, Math.max(CATALOG_PRODUTO_COL_MIN, total));
}

/** Estimativa de altura de linha quando a descrição quebra em várias linhas (virtualização). */
export function estimateCatalogProdutoRowHeight(nome = '', { colWidth, codigoInterno = false, isGroup = false } = {}) {
  const width = colWidth || CATALOG_PRODUTO_COL_MIN;
  const textArea = Math.max(96, width - 72);
  const charsPerLine = Math.max(16, Math.floor(textArea / 6.5));
  const lines = Math.max(1, Math.ceil(String(nome).length / charsPerLine));
  const base = isGroup ? 36 : 32;
  const codigoExtra = codigoInterno ? 14 : 0;
  return Math.max(isGroup ? 40 : 48, base + lines * 16 + codigoExtra + 8);
}

export function catalogProdutoColStyle(width) {
  const w = width || CATALOG_PRODUTO_COL_MIN;
  return {
    width: w,
    minWidth: w,
    maxWidth: w,
  };
}

/** Classes para coluna Produto sticky — acima da sidebar recolhida ao rolar. */
export const CATALOG_PRODUTO_STICKY_HEAD =
  'p38-catalog-sticky-left sticky left-0 z-[45] bg-background [transform:translateZ(0)] [backface-visibility:hidden]';

export const CATALOG_PRODUTO_STICKY_CELL =
  'p38-catalog-sticky-left sticky left-0 z-[35] bg-background [transform:translateZ(0)] [backface-visibility:hidden]';
