import { jsPDF } from 'jspdf';
import { registerJsPdfDin1451Fonts, normalizePdfText } from '@/lib/jspdfNotoFont';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import {
  aggregateEstoqueDisplay,
  buildCategoryTree,
  buildExpandedForLevel,
  buildTree,
  collectSkus,
  flattenTree,
  mergeAdjacentDuplicateGroupHeaders,
  TREE_GRID_EXPAND_ALL_LEVEL,
} from '@/lib/catalogTreeCore';
import { compareProdutosForCatalogSort } from '@/lib/catalogProdutoPerformance';
import {
  aggregateCatalogSalesVelocity,
  buildCatalogSalesVelocityMap,
  CATALOG_SALES_WINDOW_LABELS,
  filterProdutosComVendasNaJanela,
  normalizeCatalogSalesWindow,
} from '@/lib/catalogSalesVelocity';
import { aggregateCatalogEstoqueExibicao, resolveCatalogEstoqueExibicao } from '@/lib/catalogEstoqueVirtual';
import { formatEstoqueApresentacao, getCatalogoComercialView } from '@/lib/productUnits';

function prepareFlatRows(produtos, velocityMap, sortOrder = 'az') {
  const sorted = [...produtos].sort((a, b) => compareProdutosForCatalogSort(a, b, sortOrder));
  return sorted.map((produto) => ({
    type: 'sku',
    produto,
    key: produto.id,
    level: 1,
    velocity: velocityMap[String(produto.id)] || aggregateCatalogSalesVelocity([produto], velocityMap),
    commercial: commercialCostValues(produto),
  }));
}

function enrichTreeRows(rows, velocityMap) {
  return (rows || []).map((row) => {
    if (row.type === 'sku') {
      return {
        ...row,
        velocity: velocityMap[String(row.produto?.id)] || aggregateCatalogSalesVelocity([row.produto], velocityMap),
        commercial: commercialCostValues(row.produto),
      };
    }
    if (row.type === 'group') {
      const skus = collectSkus(row.node);
      const hideGroupTotals = isHeterogeneousGroup(skus, velocityMap);
      return {
        ...row,
        velocity: aggregateCatalogSalesVelocity(skus, velocityMap),
        skuCount: skus.length,
        stock: groupStockTexto(skus, { hideGroupTotals }),
        hideGroupTotals,
        commercial: {
          vCompra: roundToTwoDecimals(row.valorCompraMedio || 0),
          custoCalc: roundToTwoDecimals(row.custoMedio || 0),
        },
      };
    }
    return row;
  });
}

function isHeterogeneousGroup(skus = [], velocityMap = {}) {
  const disp = aggregateEstoqueDisplay(skus);
  if (disp.mode === 'mixed') return true;

  const stockUnits = new Set();
  const velocityUnits = new Set();

  for (const sku of skus) {
    const ap = formatEstoqueApresentacao(sku);
    if (ap?.sigla) stockUnits.add(String(ap.sigla).trim().toUpperCase());
    else if (sku?.unidade_principal) {
      stockUnits.add(String(sku.unidade_principal).trim().toUpperCase());
    }

    const velocity = velocityMap[String(sku?.id)];
    if (velocity?.unidade) velocityUnits.add(String(velocity.unidade).trim().toUpperCase());
  }

  return stockUnits.size > 1 || velocityUnits.size > 1;
}

function resolveExpandedKeysForCatalogView(tree, treeLevel = 1, expandedKeysFromCatalog = null) {
  if (expandedKeysFromCatalog?.length) {
    return new Set(expandedKeysFromCatalog);
  }
  const level = Number(treeLevel) || 1;
  if (level <= 1) return new Set();
  if (level >= TREE_GRID_EXPAND_ALL_LEVEL) {
    return buildExpandedForLevel(tree, TREE_GRID_EXPAND_ALL_LEVEL);
  }
  return buildExpandedForLevel(tree, level - 1);
}

/**
 * Monta linhas do relatório de vendas (plana ou hierárquica como no catálogo).
 */
export function prepareCatalogSalesReportDocument({
  produtos = [],
  pedidos = [],
  layoutMode = 'tree',
  treeLevel = 1,
  sortOrder = 'az',
  groupByCategory = false,
  expandedKeys: expandedKeysFromCatalog = null,
  salesWindow = '60d',
} = {}) {
  const list = (produtos || []).filter((p) => p && typeof p === 'object');
  const velocityMap = buildCatalogSalesVelocityMap(list, pedidos);
  const windowKey = normalizeCatalogSalesWindow(salesWindow);
  const comVenda = filterProdutosComVendasNaJanela(list, velocityMap, windowKey);

  const isFlat = layoutMode === 'plana';
  let rows;

  if (isFlat) {
    rows = prepareFlatRows(comVenda, velocityMap, sortOrder);
  } else {
    const tree = groupByCategory ? buildCategoryTree(comVenda) : buildTree(comVenda);
    const expandedKeys = resolveExpandedKeysForCatalogView(tree, treeLevel, expandedKeysFromCatalog);
    rows = mergeAdjacentDuplicateGroupHeaders(
      flattenTree(tree, expandedKeys, '', 0, sortOrder, { collapseSoloSkuBranches: false }),
    );
    rows = enrichTreeRows(rows, velocityMap);
  }

  return {
    mode: isFlat ? 'plana' : groupByCategory ? 'categoria' : 'tree',
    groupByCategory: Boolean(groupByCategory),
    treeLevel: Number(treeLevel) || 1,
    salesWindow: windowKey,
    salesWindowLabel: CATALOG_SALES_WINDOW_LABELS[windowKey],
    produtos: comVenda,
    velocityMap,
    rows,
  };
}

function stockQuantPrefix(est) {
  return est?.virtual && Number(est.pendente) > 0 ? '~' : '';
}

export function groupStockTexto(skus = [], { hideGroupTotals = false, catalogStockContext = null } = {}) {
  if (hideGroupTotals) return { texto: '—', quantText: null, unitText: null, heterogeneous: true };
  const disp = catalogStockContext
    ? aggregateCatalogEstoqueExibicao(skus, catalogStockContext)
    : aggregateEstoqueDisplay(skus);
  if (disp.mode === 'empty') return { texto: '—', quantText: null, unitText: null, heterogeneous: false };
  if (disp.mode === 'mixed') return { texto: '—', quantText: null, unitText: null, heterogeneous: true };
  const prefix = stockQuantPrefix(disp);
  const qtyText = `${prefix}${formatQty(disp.quantidade)}`;
  const unit = disp.sigla || 'UN';
  return {
    quantText: qtyText,
    unitText: unit,
    texto: `${qtyText} | ${unit}`,
    heterogeneous: false,
  };
}

export function commercialCostValues(produto) {
  const cat = getCatalogoComercialView(produto);
  return {
    vCompra: roundToTwoDecimals(cat.valorCompraNaEmbalagem),
    custoCalc: roundToTwoDecimals(cat.custoNaEmbalagem),
  };
}

export function stockQuantTexto(produto, catalogStockContext = null) {
  const est = catalogStockContext
    ? resolveCatalogEstoqueExibicao(produto, catalogStockContext)
    : null;
  if (est) {
    const prefix = stockQuantPrefix(est);
    const qtyText = `${prefix}${formatQty(est.quantidade)}`;
    const unit = est.unidade || 'UN';
    return {
      quantText: qtyText,
      unitText: unit,
      texto: `${qtyText} | ${unit}`,
      quantidade: est.quantidade,
      unidade: unit,
    };
  }

  const apresent = formatEstoqueApresentacao(produto);
  if (apresent) {
    return {
      quantText: formatQty(apresent.quantidade),
      unitText: apresent.sigla,
      texto: `${formatQty(apresent.quantidade)} | ${apresent.sigla}`,
      quantidade: apresent.quantidade,
      unidade: apresent.sigla,
    };
  }
  const qtd = Number(produto?.estoque_atual) || 0;
  const un = String(produto?.unidade_principal || 'UN').toUpperCase();
  return {
    quantText: formatQty(qtd),
    unitText: un,
    texto: `${formatQty(qtd)} | ${un}`,
    quantidade: qtd,
    unidade: un,
  };
}

export function velocityQuantTexto(velocity, { showUnit = true } = {}) {
  const qtd = Number(velocity?.qtd ?? velocity?.quantidade ?? 0) || 0;
  const un = velocity?.unidade;
  if (showUnit && un) return `${formatQty(qtd)} ${un}`;
  return formatQty(qtd);
}

function formatQty(n) {
  return (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

const PDF_FONT_BOLD = "bold";
const PDF_FONT_NORMAL = "normal";
const ENXUTO_LINE_W = 0.12;
const ROW_RULE_W = 0.07;
const SUBTLE_DIVIDER_W = 0.07;
const ENXUTO = {
  black: [0, 0, 0],
  muted: [72, 72, 72],
  line: [110, 110, 110],
  rowRule: [210, 210, 210],
  subtleDivider: [225, 225, 225]
};
const FONT = {
  title: 13,
  kpi: 9.8,
  colHdr: 7.4,
  row: 8.8,
  footer: 9
};
const DESC_LINE_LEAD = 4.5;
const COL_HDR_BLOCK = 9;
const TABLE_TOP_CONTINUATION = 14;
const LEVEL_INDENT = 4.2;
const fmtN = (n) => (n ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const fmtR = (n) => (n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const safe = (text) => normalizePdfText(text);
const moedaSemSimbolo = (valor) => fmtR(Number(valor) || 0);
const moedaOuTraco = (valor) => Number.isFinite(Number(valor)) && Number(valor) > 0 ? moedaSemSimbolo(valor) : "\u2014";
const cellText = (value) => value == null || value === "" ? "\u2014" : String(value);
function splitDescriptionLines(doc, pdfFontFamily, text, maxW) {
  doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
  doc.setFontSize(FONT.row);
  const lines = doc.splitTextToSize(safe(text), maxW);
  return lines.length ? lines : [""];
}
function treeLevelLabel(treeLevel) {
  if (treeLevel <= 1) return "n\xEDvel 1";
  if (treeLevel >= 99) return "todos os n\xEDveis";
  return `n\xEDvel ${treeLevel}`;
}

/** Identificador visível no PDF/toast — confirma que o bundle novo carregou. */
export const CATALOG_SALES_PDF_BUILD = 'enxuto_vendas_compra_custo_v13';

export async function generateRelatorioCatalogoVendasPdf(payload = {}) {
  const {
    produtos = [],
    pedidos = [],
    filters_summary: filtersSummary = "",
    layout_mode: layoutMode = "tree",
    tree_level: treeLevel = 1,
    sort_order: sortOrder = "az",
    group_by_category: groupByCategory = false,
    expanded_keys: expandedKeysFromCatalog = null,
    sales_window: salesWindow = "60d",
    generated_at: generatedAt = (/* @__PURE__ */ new Date()).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
  } = payload;
  const documento = prepareCatalogSalesReportDocument({
    produtos,
    pedidos,
    layoutMode,
    treeLevel: Number(treeLevel) || 1,
    sortOrder,
    groupByCategory: Boolean(groupByCategory),
    expandedKeys: Array.isArray(expandedKeysFromCatalog) ? expandedKeysFromCatalog : null,
    salesWindow,
  });
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pdfFontFamily = await registerJsPdfDin1451Fonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 6;
  const CW = pageW - M * 2;
  const descStart = M + 4;
  const tableRight = M + CW;
  const GUTTER_DESC = 5;
  const COL_GUTTER = 2.8;
  const QUANT_COL_W = 23;
  const PIPE_PAD = 1.5;
  const VALUE_COL_COUNT = 4;
  const descEndMin = descStart + CW * 0.34;
  const numericStart = descEndMin + GUTTER_DESC;
  const numericSpan = tableRight - numericStart;
  const valueColW = (numericSpan - QUANT_COL_W - COL_GUTTER * VALUE_COL_COUNT) / VALUE_COL_COUNT;

  let colRight = tableRight;
  const v60Right = colRight;
  colRight -= valueColW;
  colRight -= COL_GUTTER;
  const v30Right = colRight;
  colRight -= valueColW;
  colRight -= COL_GUTTER;
  const custoRight = colRight;
  colRight -= valueColW;
  colRight -= COL_GUTTER;
  const vCompraRight = colRight;
  colRight -= valueColW;
  colRight -= COL_GUTTER;
  const quantRight = colRight;
  const quantLeft = quantRight - QUANT_COL_W;
  const quantPipe = quantLeft + QUANT_COL_W / 2;
  const quantQtyEnd = quantPipe - PIPE_PAD;
  const quantUnitStart = quantPipe + PIPE_PAD;
  const descEnd = quantLeft - GUTTER_DESC;
  const divider = descEnd + GUTTER_DESC / 2;
  const valueColDividers = [
    quantRight + COL_GUTTER / 2,
    vCompraRight + COL_GUTTER / 2,
    custoRight + COL_GUTTER / 2,
    v30Right + COL_GUTTER / 2,
  ];
  const X = {
    desc: descStart,
    descEnd,
    divider,
    valueColDividers,
    quant: quantRight,
    quantPipe,
    quantQtyEnd,
    quantUnitStart,
    vCompra: vCompraRight,
    custo: custoRight,
    v30: v30Right,
    v60: v60Right,
  };
  const ROW_H = 6.1;
  const ROW_GAP = 1.15;
  const ROW_STEP = ROW_H + ROW_GAP;
  const BASELINE_RATIO = 0.72;
  let y = 16;
  let dividerStartY = 0;
  let dividerStartPage = 1;
  const strokeLine = (x0, y0, x1, y1, color = ENXUTO.line, width = ENXUTO_LINE_W) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(x0, y0, x1, y1);
  };
  const drawRowSeparator = (yLine) => {
    strokeLine(descStart, yLine, tableRight, yLine, ENXUTO.rowRule, ROW_RULE_W);
  };
  const drawVerticalDivider = (x, yStart, yEnd, startPage, endPage, {
    color = ENXUTO.line,
    width = ENXUTO_LINE_W
  } = {}) => {
    const bottomPad = 10;
    const savedPage = doc.internal.getNumberOfPages();
    for (let page = startPage; page <= endPage; page += 1) {
      doc.setPage(page);
      const segTop = page === startPage ? yStart : TABLE_TOP_CONTINUATION;
      const segBottom = page === endPage ? yEnd : pageH - bottomPad;
      if (segBottom > segTop + 0.5) strokeLine(x, segTop, x, segBottom, color, width);
    }
    doc.setPage(savedPage);
  };
  const drawQuantPipe = (baselineY, rowTop, rowBottom, { restoreFont = PDF_FONT_NORMAL, restoreColor = ENXUTO.black, restoreSize = FONT.row } = {}) => {
    const tickTop = rowTop != null ? rowTop + 0.6 : baselineY - FONT.row * 0.35;
    const tickBottom = rowBottom != null ? rowBottom - 0.6 : baselineY + FONT.row * 0.1;
    strokeLine(X.quantPipe, tickTop, X.quantPipe, tickBottom, ENXUTO.line, SUBTLE_DIVIDER_W);
    doc.setFont(pdfFontFamily, restoreFont);
    doc.setFontSize(restoreSize);
    doc.setTextColor(...restoreColor);
  };
  const drawQuantUnCell = (baselineY, stockLike, rowTop, rowBottom) => {
    if (!stockLike?.quantText || !stockLike?.unitText) {
      doc.text('\u2014', X.quantPipe, baselineY, { align: 'center' });
      return;
    }
    doc.text(stockLike.quantText, X.quantQtyEnd, baselineY, { align: 'right' });
    drawQuantPipe(baselineY, rowTop, rowBottom);
    doc.text(stockLike.unitText, X.quantUnitStart, baselineY, { align: 'left' });
  };
  const drawColumnHeaders = (topY) => {
    const line1 = topY + 3.2;
    const line2 = topY + 6.8;
    const hdrTop = topY + 1.2;
    const hdrBottom = topY + COL_HDR_BLOCK - 0.4;
    doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
    doc.setFontSize(FONT.colHdr);
    doc.setTextColor(...ENXUTO.muted);
    doc.text('QUANT', X.quantQtyEnd, line1, { align: 'right' });
    doc.text('UN', X.quantUnitStart, line1, { align: 'left' });
    doc.text('V.COMPRA', X.vCompra, line1, { align: 'right' });
    doc.text('CUSTO', X.custo, line1, { align: 'right' });
    doc.text('V.30D', X.v30, line1, { align: 'right' });
    doc.text('V.60D', X.v60, line1, { align: 'right' });
    doc.setFontSize(FONT.colHdr - 0.4);
    doc.text('estoque', X.quantQtyEnd, line2, { align: 'right' });
    doc.text('unid.', X.quantUnitStart, line2, { align: 'left' });
    doc.text('compra', X.vCompra, line2, { align: 'right' });
    doc.text('calc.', X.custo, line2, { align: 'right' });
    doc.text('30 dias', X.v30, line2, { align: 'right' });
    doc.text('60 dias', X.v60, line2, { align: 'right' });
    strokeLine(X.quantPipe, hdrTop, X.quantPipe, hdrBottom, ENXUTO.line, SUBTLE_DIVIDER_W);
  };
  const beginTablePage = () => {
    drawColumnHeaders(y);
    y += COL_HDR_BLOCK;
  };
  const ensureTableSpace = (needed = ROW_STEP + 1) => {
    if (y + needed > pageH - 10) {
      doc.addPage();
      y = TABLE_TOP_CONTINUATION;
      beginTablePage();
    }
  };
  const descMaxW = (descX = X.desc) => Math.max(20, X.descEnd - descX - 1);
  const rowBaselines = (drawY, lineCount, extraH) => {
    const cellH = ROW_H + extraH;
    if (lineCount <= 1) {
      const baseline = drawY + ROW_H * BASELINE_RATIO;
      return { valuesBaseline: baseline, descFirstBaseline: baseline };
    }
    const midY = drawY + cellH / 2;
    const textLift = FONT.row * 0.36;
    const descSpan = (lineCount - 1) * DESC_LINE_LEAD;
    return {
      valuesBaseline: midY + textLift * 0.35,
      descFirstBaseline: midY - descSpan / 2 + textLift * 0.35
    };
  };
  const drawValueColumns = (baselineY, produto, velocity, commercial = {}, { isGroup = false, stock = null, hideGroupTotals = false, rowTop = null, rowBottom = null } = {}) => {
    doc.setFont(pdfFontFamily, isGroup ? PDF_FONT_BOLD : PDF_FONT_NORMAL);
    doc.setFontSize(FONT.row);
    doc.setTextColor(...ENXUTO.black);
    if (isGroup && hideGroupTotals) {
      doc.text('\u2014', X.quantPipe, baselineY, { align: 'center' });
      doc.text('\u2014', X.vCompra, baselineY, { align: 'right' });
      doc.text('\u2014', X.custo, baselineY, { align: 'right' });
      doc.text('\u2014', X.v30, baselineY, { align: 'right' });
      doc.text('\u2014', X.v60, baselineY, { align: 'right' });
      return;
    }
    const stockDisplay = produto ? stockQuantTexto(produto) : stock;
    const vals = produto ? commercialCostValues(produto) : {
      vCompra: roundToTwoDecimals(commercial.vCompra || 0),
      custoCalc: roundToTwoDecimals(commercial.custoCalc || 0),
    };
    const v30 = velocityQuantTexto({ qtd: velocity?.qtd30, unidade: velocity?.unidade }, { showUnit: false });
    const v60 = velocityQuantTexto({ qtd: velocity?.qtd60, unidade: velocity?.unidade }, { showUnit: false });
    drawQuantUnCell(baselineY, stockDisplay, rowTop, rowBottom);
    doc.text(moedaOuTraco(vals.vCompra), X.vCompra, baselineY, { align: 'right' });
    doc.text(moedaOuTraco(vals.custoCalc), X.custo, baselineY, { align: 'right' });
    doc.text(cellText(v30), X.v30, baselineY, { align: 'right' });
    doc.text(cellText(v60), X.v60, baselineY, { align: 'right' });
  };
  const drawDataRow = (y0, descricao, produto, velocity, commercial = {}, { level = 1, isGroup = false, stock = null, hideGroupTotals = false } = {}) => {
    const descX = X.desc + Math.max(0, level - 1) * LEVEL_INDENT;
    const descLines = splitDescriptionLines(doc, pdfFontFamily, descricao, descMaxW(descX));
    const lineCount = descLines.length;
    const extraH = (lineCount - 1) * DESC_LINE_LEAD;
    const rowStep = ROW_STEP + extraH;
    y = y0;
    ensureTableSpace(rowStep + 1);
    const drawY = y;
    const { valuesBaseline, descFirstBaseline } = rowBaselines(drawY, lineCount, extraH);
    const rowBottom = drawY + rowStep - ROW_GAP * 0.35;
    drawValueColumns(valuesBaseline, produto, velocity, commercial, { isGroup, stock, hideGroupTotals, rowTop: drawY, rowBottom });
    doc.setFont(pdfFontFamily, isGroup ? PDF_FONT_BOLD : PDF_FONT_NORMAL);
    doc.setTextColor(...ENXUTO.black);
    for (let i = 0; i < lineCount; i += 1) {
      doc.text(descLines[i], descX, descFirstBaseline + i * DESC_LINE_LEAD);
    }
    drawRowSeparator(drawY + rowStep - ROW_GAP * 0.35);
    return drawY + rowStep;
  };
  doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
  doc.setFontSize(FONT.title);
  doc.setTextColor(...ENXUTO.black);
  doc.text("Relatorio de vendas \u2014 ENXUTO", M, y);
  y += 5.5;
  doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
  doc.setFontSize(8);
  doc.setTextColor(...ENXUTO.muted);
  doc.text("A4   estoque + compra/custo + vendas 30/60 dias   DIN 1451", M, y);
  y += 4.5;
  const modeLabel = documento.mode === "plana" ? "Lista plana A-Z \xB7 todos os filtrados" : documento.groupByCategory ? `Agrupado por categoria \xB7 ${treeLevelLabel(documento.treeLevel)}` : `Hierarquia do cat\xE1logo \xB7 ${treeLevelLabel(documento.treeLevel)}`;
  doc.text(modeLabel, M, y);
  y += 4.2;
  doc.setFontSize(8.8);
  doc.text(safe(`${documento.produtos?.length ?? 0} SKU(s) com venda`), M, y);
  y += 4.2;
  if (documento.salesWindowLabel) {
    doc.text(safe(`Inclusão: ${documento.salesWindowLabel}`), M, y);
    y += 4.2;
  }
  if (filtersSummary) {
    doc.text(doc.splitTextToSize(safe(filtersSummary), CW)[0] || "-", M, y);
    y += 4.2;
  }
  doc.setFontSize(8.2);
  doc.text(`Gerado em ${generatedAt}`, M, y);
  y += 5;
  const totalV30 = (documento.produtos || []).reduce(
    (s, p) => s + (Number(documento.velocityMap?.[String(p.id)]?.qtd30) || 0),
    0
  );
  const totalV60 = (documento.produtos || []).reduce(
    (s, p) => s + (Number(documento.velocityMap?.[String(p.id)]?.qtd60) || 0),
    0
  );
  doc.setFontSize(FONT.kpi);
  doc.setTextColor(...ENXUTO.black);
  doc.text(`Vendas 30d: ${fmtN(totalV30)} un.`, M, y);
  doc.setTextColor(...ENXUTO.muted);
  doc.text(`Vendas 60d: ${fmtN(totalV60)} un.`, M + CW, y, { align: "right" });
  y += 8;
  if (!documento.rows?.length) {
    doc.setTextColor(...ENXUTO.muted);
    doc.text(
      safe(
        documento.salesWindowLabel
          ? `Nenhum produto com ${documento.salesWindowLabel} nos filtros actuais.`
          : 'Nenhum produto encontrado com os filtros actuais.',
      ),
      M,
      y,
    );
  } else {
    dividerStartPage = doc.internal.getNumberOfPages();
    dividerStartY = y;
    beginTablePage();
    for (const row of documento.rows) {
      if (row.type === "group") {
        const label = String(row.label || "\u2014");
        const countSuffix = row.skuCount ? `  (${row.skuCount} SKU)` : "";
        y = drawDataRow(
          y,
          `${label}${countSuffix}`,
          null,
          row.velocity || {},
          row.commercial || {},
          { level: row.level || 1, isGroup: true, stock: row.stock || null, hideGroupTotals: Boolean(row.hideGroupTotals) }
        );
        continue;
      }
      if (row.type !== "sku") continue;
      const p = row.produto;
      const nome = p?.codigo_interno ? `${p.nome || "\u2014"}  ${p.codigo_interno}` : String(p?.nome || "\u2014");
      y = drawDataRow(
        y,
        nome,
        p,
        row.velocity || {},
        row.commercial || commercialCostValues(p),
        { level: row.level || 1, isGroup: false }
      );
    }
    drawVerticalDivider(
      X.divider,
      dividerStartY,
      y,
      dividerStartPage,
      doc.internal.getNumberOfPages()
    );
    for (const colDivider of X.valueColDividers) {
      drawVerticalDivider(
        colDivider,
        dividerStartY,
        y,
        dividerStartPage,
        doc.internal.getNumberOfPages(),
        { color: ENXUTO.subtleDivider, width: SUBTLE_DIVIDER_W }
      );
    }
  }
  y += 8;
  const FOOTER_BLOCK_H = 14;
  if (y + FOOTER_BLOCK_H > pageH - M) {
    doc.addPage();
    y = TABLE_TOP_CONTINUATION + 4;
  } else {
    y += 4;
  }
  doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
  doc.setFontSize(FONT.footer);
  doc.setTextColor(...ENXUTO.muted);
  doc.text(`Filtros do cat\xE1logo \xB7 hierarquia conforme n\xEDvel seleccionado na tela.  (${CATALOG_SALES_PDF_BUILD})`, M, y);
  const pdfBytes = doc.output("arraybuffer");
  return { data: pdfBytes, version: CATALOG_SALES_PDF_BUILD };
}
