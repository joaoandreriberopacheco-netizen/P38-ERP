import { jsPDF } from 'jspdf';
import { registerJsPdfDin1451Fonts, normalizePdfText } from '@/lib/jspdfNotoFont';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import {
  aggregateEstoqueDisplay,
  buildCategoryTree,
  buildExpandedForLevel,
  buildTree,
  calcMarkup,
  collectSkus,
  flattenTree,
  mergeAdjacentDuplicateGroupHeaders,
  TREE_GRID_EXPAND_ALL_LEVEL,
} from '@/components/produtos/treegrid/useTreeGrid';
import { compareProdutosForCatalogSort } from '@/lib/catalogProdutoPerformance';
import {
  aggregateCatalogSalesVelocity,
  buildCatalogSalesVelocityMap,
  filterProdutosRelatorioVendasV2,
} from '@/lib/catalogSalesVelocity';
import { formatEstoqueApresentacao, getCatalogoComercialView } from '@/lib/productUnits';
import {
  commercialCostValues,
  groupStockTexto,
  stockQuantTexto,
  velocityQuantTexto,
} from '@/lib/relatorioCatalogoVendasPdf/generateRelatorioCatalogoVendasPdf.js';
import { sumCatalogStockTotals } from '@/lib/catalogStockTotals';

const PDF_FONT_BOLD = 'bold';
const PDF_FONT_NORMAL = 'normal';
const ENXUTO_LINE_W = 0.12;
const ROW_RULE_W = 0.07;
const SUBTLE_DIVIDER_W = 0.07;
const QUANT_PIPE_W = 0.04;
const ENXUTO = {
  black: [0, 0, 0],
  muted: [72, 72, 72],
  line: [110, 110, 110],
  rowRule: [210, 210, 210],
  subtleDivider: [225, 225, 225],
};
const FONT = {
  title: 15.5,
  meta: 9.2,
  kpi: 10.8,
  colHdr: 7.8,
  row: 9.2,
  footer: 9,
};
const DESC_LINE_LEAD = 5.1;
const COL_HDR_BLOCK = 10.2;
const TABLE_TOP_CONTINUATION = 15;
const PAGE_FOOTER_Y_OFFSET = 6;
const PAGE_BOTTOM_RESERVE = 12;
const LEVEL_INDENT = 2.8;
const DESC_COL_SHARE = 0.38;
const VALUE_COL_KEYS = ['vCompra', 'custo', 'preco', 'markup', 'v30', 'v60'];

const fmtN = (n) => (n ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const fmtR = (n) => (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n) => `${(Number(n) || 0).toFixed(1)}%`;
const safe = (text) => normalizePdfText(text);
const moedaSemSimbolo = (valor) => fmtR(Number(valor) || 0);
const moedaComSimbolo = (valor) => `R$ ${moedaSemSimbolo(valor)}`;
const moedaOuTraco = (valor) => Number.isFinite(Number(valor)) && Number(valor) > 0 ? moedaSemSimbolo(valor) : '\u2014';
const markupOuTraco = (valor, preco) => Number(valor) > 0 && Number(preco) > 0 ? fmtPct(valor) : '\u2014';
const cellText = (value) => (value == null || value === '' ? '\u2014' : String(value));

function commercialSaleValues(produto) {
  const base = commercialCostValues(produto);
  const cat = getCatalogoComercialView(produto);
  return {
    ...base,
    preco: roundToTwoDecimals(cat.precoVenda),
    markup: calcMarkup(produto),
  };
}

function splitDescriptionLines(doc, pdfFontFamily, text, maxW) {
  doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
  doc.setFontSize(FONT.row);
  const lines = doc.splitTextToSize(safe(text), maxW);
  return lines.length ? lines : [''];
}

function treeLevelLabel(treeLevel) {
  if (treeLevel <= 1) return 'nível 1';
  if (treeLevel >= 99) return 'todos os níveis';
  return `nível ${treeLevel}`;
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

function prepareFlatRows(produtos, velocityMap, sortOrder = 'az') {
  const sorted = [...produtos].sort((a, b) => compareProdutosForCatalogSort(a, b, sortOrder));
  return sorted.map((produto) => ({
    type: 'sku',
    produto,
    key: produto.id,
    level: 1,
    velocity: velocityMap[String(produto.id)] || aggregateCatalogSalesVelocity([produto], velocityMap),
    commercial: commercialSaleValues(produto),
  }));
}

function enrichTreeRows(rows, velocityMap) {
  return (rows || []).map((row) => {
    if (row.type === 'sku') {
      return {
        ...row,
        velocity: velocityMap[String(row.produto?.id)] || aggregateCatalogSalesVelocity([row.produto], velocityMap),
        commercial: commercialSaleValues(row.produto),
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
          preco: roundToTwoDecimals(row.precoMedio || 0),
          markup: roundToTwoDecimals(row.markupMedio || 0),
        },
      };
    }
    return row;
  });
}

export function prepareCatalogSalesReportDocumentV2({
  produtos = [],
  pedidos = [],
  layoutMode = 'tree',
  treeLevel = 1,
  sortOrder = 'az',
  groupByCategory = false,
  expandedKeys: expandedKeysFromCatalog = null,
} = {}) {
  const list = (produtos || []).filter((p) => p && typeof p === 'object');
  const velocityMap = buildCatalogSalesVelocityMap(list, pedidos);
  const comVenda = filterProdutosRelatorioVendasV2(list, velocityMap);

  const isFlat = layoutMode === 'plana';
  let rows;

  if (isFlat) {
    rows = prepareFlatRows(comVenda, velocityMap, sortOrder);
  } else {
    const tree = groupByCategory ? buildCategoryTree(comVenda) : buildTree(comVenda);
    const expandedKeys = resolveExpandedKeysForCatalogView(tree, treeLevel, expandedKeysFromCatalog);
    rows = mergeAdjacentDuplicateGroupHeaders(
      flattenTree(tree, expandedKeys, '', 0, sortOrder),
    );
    rows = enrichTreeRows(rows, velocityMap);
  }

  return {
    mode: isFlat ? 'plana' : groupByCategory ? 'categoria' : 'tree',
    groupByCategory: Boolean(groupByCategory),
    treeLevel: Number(treeLevel) || 1,
    inclusionLabel: 'venda nos últimos 30 ou 60 dias, ou estoque > 0',
    produtos: comVenda,
    velocityMap,
    rows,
  };
}

/** Layout numérico com o mesmo respiro (gutter) entre todas as colunas. */
export function buildUniformSalesPdfColumns({
  descStart,
  tableRight,
  quantColWidth,
  valueColCount,
  gutter,
}) {
  const descEndMin = descStart + (tableRight - descStart) * DESC_COL_SHARE;
  const numericStart = descEndMin + gutter;
  const numericSpan = tableRight - numericStart;
  const valueColWidth = (numericSpan - quantColWidth - gutter * valueColCount) / valueColCount;

  const colRight = {};
  let cursor = tableRight;
  for (let i = valueColCount - 1; i >= 0; i -= 1) {
    colRight[VALUE_COL_KEYS[i]] = cursor;
    cursor -= valueColWidth;
    cursor -= gutter;
  }

  const quantRight = cursor + gutter;
  const quantLeft = quantRight - quantColWidth;
  const quantPipe = quantLeft + quantColWidth / 2;
  const descEnd = quantLeft - gutter;
  const divider = descEnd + gutter / 2;

  const valueColDividers = [quantRight + gutter / 2];
  for (let i = 0; i < valueColCount - 1; i += 1) {
    const leftKey = VALUE_COL_KEYS[i];
    valueColDividers.push(colRight[leftKey] - valueColWidth - gutter / 2);
  }

  return {
    gutter,
    valueColWidth,
    descEnd,
    divider,
    quantRight,
    quantPipe,
    quantQtyEnd: quantPipe - 1.4,
    quantUnitStart: quantPipe + 1.4,
    valueColDividers,
    ...colRight,
  };
}

export const CATALOG_SALES_PDF_V2_BUILD = 'enxuto_vendas_preco_mkup_v5';

export async function generateRelatorioCatalogoVendasPdfV2(payload = {}) {
  const {
    produtos = [],
    pedidos = [],
    filters_summary: filtersSummary = '',
    layout_mode: layoutMode = 'tree',
    tree_level: treeLevel = 1,
    sort_order: sortOrder = 'az',
    group_by_category: groupByCategory = false,
    expanded_keys: expandedKeysFromCatalog = null,
    generated_at: generatedAt = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
  } = payload;

  const documento = prepareCatalogSalesReportDocumentV2({
    produtos,
    pedidos,
    layoutMode,
    treeLevel: Number(treeLevel) || 1,
    sortOrder,
    groupByCategory: Boolean(groupByCategory),
    expandedKeys: Array.isArray(expandedKeysFromCatalog) ? expandedKeysFromCatalog : null,
  });

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pdfFontFamily = await registerJsPdfDin1451Fonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 6;
  const CW = pageW - M * 2;
  const descStart = M + 4;
  const tableRight = M + CW;
  const COL_GUTTER = 2.5;
  const QUANT_COL_W = 21;
  const X = buildUniformSalesPdfColumns({
    descStart,
    tableRight,
    quantColWidth: QUANT_COL_W,
    valueColCount: VALUE_COL_KEYS.length,
    gutter: COL_GUTTER,
  });

  const ROW_H = 6.8;
  const ROW_GAP = 1.25;
  const ROW_STEP = ROW_H + ROW_GAP;
  const BASELINE_RATIO = 0.72;
  let y = 16;
  let dividerStartY = 0;
  let dividerStartPage = 1;

  const drawPageNumbers = () => {
    const pageCount = doc.internal.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(FONT.footer);
      doc.setTextColor(...ENXUTO.muted);
      doc.text(
        safe(`Página ${page} / ${pageCount}`),
        pageW - M,
        pageH - PAGE_FOOTER_Y_OFFSET,
        { align: 'right' },
      );
    }
  };

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
    width = ENXUTO_LINE_W,
  } = {}) => {
    const bottomPad = PAGE_BOTTOM_RESERVE;
    const savedPage = doc.internal.getNumberOfPages();
    for (let page = startPage; page <= endPage; page += 1) {
      doc.setPage(page);
      const segTop = page === startPage ? yStart : TABLE_TOP_CONTINUATION;
      const segBottom = page === endPage ? yEnd : pageH - bottomPad;
      if (segBottom > segTop + 0.5) strokeLine(x, segTop, x, segBottom, color, width);
    }
    doc.setPage(savedPage);
  };
  const drawQuantPipe = (baselineY, rowTop, rowBottom) => {
    const tickTop = rowTop != null ? rowTop + 0.6 : baselineY - FONT.row * 0.35;
    const tickBottom = rowBottom != null ? rowBottom - 0.6 : baselineY + FONT.row * 0.1;
    strokeLine(X.quantPipe, tickTop, X.quantPipe, tickBottom, ENXUTO.subtleDivider, QUANT_PIPE_W);
    doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
    doc.setFontSize(FONT.row);
    doc.setTextColor(...ENXUTO.black);
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
    const line1 = topY + 3.6;
    const line2 = topY + 7.4;
    const hdrTop = topY + 1.2;
    const hdrBottom = topY + COL_HDR_BLOCK - 0.4;
    doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
    doc.setFontSize(FONT.colHdr);
    doc.setTextColor(...ENXUTO.muted);
    doc.text('QUANT', X.quantQtyEnd, line1, { align: 'right' });
    doc.text('UN', X.quantUnitStart, line1, { align: 'left' });
    doc.text('V.COMPRA', X.vCompra, line1, { align: 'right' });
    doc.text('CUSTO', X.custo, line1, { align: 'right' });
    doc.text('PREÇO', X.preco, line1, { align: 'right' });
    doc.text('MKUP', X.markup, line1, { align: 'right' });
    doc.text('V.30D', X.v30, line1, { align: 'right' });
    doc.text('V.60D', X.v60, line1, { align: 'right' });
    doc.setFontSize(FONT.colHdr - 0.4);
    doc.text('estoque', X.quantQtyEnd, line2, { align: 'right' });
    doc.text('unid.', X.quantUnitStart, line2, { align: 'left' });
    doc.text('compra', X.vCompra, line2, { align: 'right' });
    doc.text('calc.', X.custo, line2, { align: 'right' });
    doc.text('venda', X.preco, line2, { align: 'right' });
    doc.text('s/custo', X.markup, line2, { align: 'right' });
    doc.text('30 dias', X.v30, line2, { align: 'right' });
    doc.text('60 dias', X.v60, line2, { align: 'right' });
    strokeLine(X.quantPipe, hdrTop, X.quantPipe, hdrBottom, ENXUTO.subtleDivider, QUANT_PIPE_W);
  };
  const beginTablePage = () => {
    drawColumnHeaders(y);
    y += COL_HDR_BLOCK;
  };
  const ensureTableSpace = (needed = ROW_STEP + 1) => {
    if (y + needed > pageH - PAGE_BOTTOM_RESERVE) {
      doc.addPage();
      y = TABLE_TOP_CONTINUATION;
      beginTablePage();
    }
  };
  const descMaxW = (descX = descStart) => Math.max(18, X.descEnd - descX - 1);
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
      descFirstBaseline: midY - descSpan / 2 + textLift * 0.35,
    };
  };
  const drawDashRow = (baselineY) => {
    doc.text('\u2014', X.quantPipe, baselineY, { align: 'center' });
    for (const key of VALUE_COL_KEYS) {
      doc.text('\u2014', X[key], baselineY, { align: 'right' });
    }
  };
  const drawValueColumns = (baselineY, produto, velocity, commercial = {}, {
    isGroup = false,
    stock = null,
    hideGroupTotals = false,
    rowTop = null,
    rowBottom = null,
  } = {}) => {
    doc.setFont(pdfFontFamily, isGroup ? PDF_FONT_BOLD : PDF_FONT_NORMAL);
    doc.setFontSize(FONT.row);
    doc.setTextColor(...ENXUTO.black);
    if (isGroup && hideGroupTotals) {
      drawDashRow(baselineY);
      return;
    }
    const stockDisplay = produto ? stockQuantTexto(produto) : stock;
    const vals = produto
      ? commercialSaleValues(produto)
      : {
        vCompra: roundToTwoDecimals(commercial.vCompra || 0),
        custoCalc: roundToTwoDecimals(commercial.custoCalc || 0),
        preco: roundToTwoDecimals(commercial.preco || 0),
        markup: roundToTwoDecimals(commercial.markup || 0),
      };
    const v30 = velocityQuantTexto({ qtd: velocity?.qtd30, unidade: velocity?.unidade }, { showUnit: false });
    const v60 = velocityQuantTexto({ qtd: velocity?.qtd60, unidade: velocity?.unidade }, { showUnit: false });
    drawQuantUnCell(baselineY, stockDisplay, rowTop, rowBottom);
    doc.text(moedaOuTraco(vals.vCompra), X.vCompra, baselineY, { align: 'right' });
    doc.text(moedaOuTraco(vals.custoCalc), X.custo, baselineY, { align: 'right' });
    doc.text(moedaOuTraco(vals.preco), X.preco, baselineY, { align: 'right' });
    doc.text(markupOuTraco(vals.markup, vals.preco), X.markup, baselineY, { align: 'right' });
    doc.text(cellText(v30), X.v30, baselineY, { align: 'right' });
    doc.text(cellText(v60), X.v60, baselineY, { align: 'right' });
  };
  const drawDataRow = (y0, descricao, produto, velocity, commercial = {}, {
    level = 1,
    isGroup = false,
    stock = null,
    hideGroupTotals = false,
  } = {}) => {
    const descX = descStart + Math.max(0, level - 1) * LEVEL_INDENT;
    const descLines = splitDescriptionLines(doc, pdfFontFamily, descricao, descMaxW(descX));
    const lineCount = descLines.length;
    const extraH = (lineCount - 1) * DESC_LINE_LEAD;
    const rowStep = ROW_STEP + extraH;
    y = y0;
    ensureTableSpace(rowStep + 1);
    const drawY = y;
    const { valuesBaseline, descFirstBaseline } = rowBaselines(drawY, lineCount, extraH);
    const rowBottom = drawY + rowStep - ROW_GAP * 0.35;
    drawValueColumns(valuesBaseline, produto, velocity, commercial, {
      isGroup,
      stock,
      hideGroupTotals,
      rowTop: drawY,
      rowBottom,
    });
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
  doc.text('Relatorio de vendas — ENXUTO v2 (beta)', M, y);
  y += 6.2;
  doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
  doc.setFontSize(FONT.meta);
  doc.setTextColor(...ENXUTO.muted);
  doc.text('A4   estoque + compra/custo + preço/MKUP + vendas 30/60 dias   DIN 1451', M, y);
  y += 5;
  const modeLabel = documento.mode === 'plana'
    ? 'Lista plana A-Z · todos os filtrados'
    : documento.groupByCategory
      ? `Agrupado por categoria · ${treeLevelLabel(documento.treeLevel)}`
      : `Hierarquia do catálogo · ${treeLevelLabel(documento.treeLevel)}`;
  doc.text(modeLabel, M, y);
  y += 4.8;
  doc.text(safe(`${documento.produtos?.length ?? 0} SKU(s) no relatório`), M, y);
  y += 4.8;
  doc.text(safe(`Inclusão: ${documento.inclusionLabel}`), M, y);
  y += 4.8;
  if (filtersSummary) {
    doc.text(doc.splitTextToSize(safe(filtersSummary), CW)[0] || '-', M, y);
    y += 4.8;
  }
  doc.setFontSize(FONT.meta - 0.6);
  doc.text(`Gerado em ${generatedAt}`, M, y);
  y += 5.5;
  const totalV30 = (documento.produtos || []).reduce(
    (s, p) => s + (Number(documento.velocityMap?.[String(p.id)]?.qtd30) || 0),
    0,
  );
  const totalV60 = (documento.produtos || []).reduce(
    (s, p) => s + (Number(documento.velocityMap?.[String(p.id)]?.qtd60) || 0),
    0,
  );
  const stockTotals = sumCatalogStockTotals(documento.produtos || []);
  doc.setFontSize(FONT.kpi);
  doc.setTextColor(...ENXUTO.black);
  doc.text(`Vendas 30d: ${fmtN(totalV30)} un.`, M, y);
  doc.setTextColor(...ENXUTO.muted);
  doc.text(`Vendas 60d: ${fmtN(totalV60)} un.`, M + CW, y, { align: 'right' });
  y += 5.2;
  doc.setTextColor(...ENXUTO.black);
  doc.text(`Total custo (estoque): ${moedaComSimbolo(stockTotals.totalCusto)}`, M, y);
  doc.setTextColor(...ENXUTO.muted);
  doc.text(`Total venda (estoque): ${moedaComSimbolo(stockTotals.totalVenda)}`, M + CW, y, { align: 'right' });
  y += 8;

  if (!documento.rows?.length) {
    doc.setTextColor(...ENXUTO.muted);
    doc.text(
      safe(`Nenhum produto com ${documento.inclusionLabel} nos filtros actuais.`),
      M,
      y,
    );
  } else {
    dividerStartPage = doc.internal.getNumberOfPages();
    dividerStartY = y;
    beginTablePage();
    for (const row of documento.rows) {
      if (row.type === 'group') {
        const label = String(row.label || '\u2014');
        const countSuffix = row.skuCount ? `  (${row.skuCount} SKU)` : '';
        y = drawDataRow(
          y,
          `${label}${countSuffix}`,
          null,
          row.velocity || {},
          row.commercial || {},
          {
            level: row.level || 1,
            isGroup: true,
            stock: row.stock || null,
            hideGroupTotals: Boolean(row.hideGroupTotals),
          },
        );
        continue;
      }
      if (row.type !== 'sku') continue;
      const p = row.produto;
      const nome = p?.codigo_interno ? `${p.nome || '\u2014'}  ${p.codigo_interno}` : String(p?.nome || '\u2014');
      y = drawDataRow(
        y,
        nome,
        p,
        row.velocity || {},
        row.commercial || commercialSaleValues(p),
        { level: row.level || 1, isGroup: false },
      );
    }
    drawVerticalDivider(X.divider, dividerStartY, y, dividerStartPage, doc.internal.getNumberOfPages());
    for (const colDivider of X.valueColDividers) {
      drawVerticalDivider(
        colDivider,
        dividerStartY,
        y,
        dividerStartPage,
        doc.internal.getNumberOfPages(),
        { color: ENXUTO.subtleDivider, width: SUBTLE_DIVIDER_W },
      );
    }
  }

  y += 8;
  const FOOTER_BLOCK_H = 14;
  if (y + FOOTER_BLOCK_H > pageH - PAGE_BOTTOM_RESERVE) {
    doc.addPage();
    y = TABLE_TOP_CONTINUATION + 4;
  } else {
    y += 4;
  }
  doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
  doc.setFontSize(FONT.footer);
  doc.setTextColor(...ENXUTO.muted);
  doc.text(
    `Versão beta v2 · filtros do catálogo · hierarquia conforme nível na tela.  (${CATALOG_SALES_PDF_V2_BUILD})`,
    M,
    y,
  );
  drawPageNumbers();
  const pdfBytes = doc.output('arraybuffer');
  return { data: pdfBytes, version: CATALOG_SALES_PDF_V2_BUILD };
}
