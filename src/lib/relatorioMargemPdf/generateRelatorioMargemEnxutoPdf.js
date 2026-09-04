import { jsPDF } from 'jspdf';
import { registerJsPdfDin1451Fonts, normalizePdfText } from '@/lib/jspdfNotoFont';
import { formatCommercialQuantity } from '@/lib/productUnits';
import { formatMarginGroupUnidadeLabel } from '@/lib/marginTree';
import { resolvePrecoVendaLiquidoUnitarioMargem } from '@/lib/relatorioMargemCalculos';

const PDF_FONT_BOLD = 'bold';
const PDF_FONT_NORMAL = 'normal';
const ENXUTO_LINE_W = 0.12;
const ROW_RULE_W = 0.07;
const ENXUTO = {
  black: [0, 0, 0],
  muted: [72, 72, 72],
  line: [110, 110, 110],
  rowRule: [210, 210, 210],
};
const FONT = {
  title: 13,
  kpi: 9.8,
  colHdr: 7.6,
  row: 9,
  footer: 9,
};
const DESC_LINE_LEAD = 4.5;
const COL_HDR_BLOCK = 9;
const TABLE_TOP_CONTINUATION = 14;

/** Espelha `RelatorioMargem.jsx`: seta à esquerda; pais e solteiros no mesmo alinhamento. */
const INDENT_GROUP_MM = 3.7;
const CHEVRON_SLOT_MM = 3.7;
const CHEVRON_GAP_MM = 1.6;
const CHEVRON_PULL_MM = CHEVRON_SLOT_MM + CHEVRON_GAP_MM;

function marginDescTextStartMm(level = 1) {
  return CHEVRON_PULL_MM + Math.max(0, (level ?? 1) - 1) * INDENT_GROUP_MM;
}

function marginDescChevronLeftMm(textStartMm) {
  return Math.max(0, textStartMm - CHEVRON_PULL_MM);
}

function getMarginRowTier(treeRow) {
  if (treeRow?.type === 'group') return 'pai';
  return (treeRow?.level ?? 1) <= 1 ? 'solteiro' : 'filho';
}

const fmtR = (n) => (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n) => `${(n ?? 0).toFixed(1)}%`;
const safe = (text) => normalizePdfText(text);
const moeda = (valor = 0) => `R$ ${fmtR(Number(valor) || 0)}`;
const moedaSemSimbolo = (valor) => fmtR(Number(valor) || 0);

function getRowMarkup(row) {
  if (row?.markup_percentual != null && !Number.isNaN(row.markup_percentual)) {
    return row.markup_percentual;
  }
  const custo = row?.custo_total ?? 0;
  return custo > 0 ? ((row.lucro_total || 0) / custo) * 100 : 0;
}

function getRowPrecoMedio(row) {
  return resolvePrecoVendaLiquidoUnitarioMargem(row);
}

function getRowCustoUnitCalc(row) {
  const qtd = row?.quantidade_vendida || 0;
  if (qtd > 0 && row?.custo_total != null) {
    return (row.custo_total || 0) / qtd;
  }
  return row?.custo_unitario_cadastro ?? 0;
}

function formatMarginTreeUnidade(row, { isGroup = false } = {}) {
  if (isGroup) return formatMarginGroupUnidadeLabel(row?.unidade_exibicao);
  return row?.unidade_exibicao || 'UN';
}

function linhaMargemPdf(dataRow, { isGroup = false } = {}) {
  const qtd = dataRow?.quantidade_vendida || 0;
  const unidade = formatMarginTreeUnidade(dataRow, { isGroup });
  const custoUnit = getRowCustoUnitCalc(dataRow);
  const preco = getRowPrecoMedio(dataRow);
  const markup = getRowMarkup(dataRow);
  const custoTotal = dataRow?.custo_total || 0;
  const receita = dataRow?.receita_liquida || 0;
  const lucro = dataRow?.lucro_total || 0;
  return {
    quantTexto: formatCommercialQuantity(qtd, unidade),
    unidade: safe(unidade),
    custoUnit,
    preco,
    markup,
    custoTotal,
    receita,
    lucro,
  };
}

function splitDescriptionLines(doc, pdfFontFamily, text, maxW, fontStyle = PDF_FONT_NORMAL) {
  doc.setFont(pdfFontFamily, fontStyle);
  doc.setFontSize(FONT.row);
  const lines = doc.splitTextToSize(safe(text), maxW);
  return lines.length ? lines : [''];
}

async function generateRelatorioMargemEnxutoPdf(payload = {}) {
  const {
    displayRows = [],
    totals = {},
    totalMarkup = 0,
    productCount = 0,
    filtersDesc = '',
    generatedAt = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
  } = payload;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pdfFontFamily = await registerJsPdfDin1451Fonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 6;
  const CW = pageW - M * 2;
  const QUANT_COL_W = 14;
  const UN_COL_W = 9;
  const GUTTER_W = 5;
  const descStart = M + 4;
  const vendRight = M + CW;
  const quantRight = M + 88;
  const quantLeft = quantRight - QUANT_COL_W;
  const unRight = quantLeft - 1;
  const unLeft = unRight - UN_COL_W;
  const descEnd = unLeft - GUTTER_W;
  const divider = descEnd + GUTTER_W / 2;
  const VALUE_COL_STEP = (vendRight - quantRight) / 6;
  const valueColX = (index) => quantRight + VALUE_COL_STEP * (index + 1);
  const X = {
    desc: descStart,
    divider,
    quant: quantRight,
    un: unRight,
    custoUnit: valueColX(0),
    preco: valueColX(1),
    markup: valueColX(2),
    custoTot: valueColX(3),
    receita: valueColX(4),
    lucro: vendRight,
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
    strokeLine(descStart, yLine, vendRight, yLine, ENXUTO.rowRule, ROW_RULE_W);
  };

  const drawVerticalDivider = (x, yStart, yEnd, startPage, endPage) => {
    const bottomPad = 10;
    const savedPage = doc.internal.getNumberOfPages();
    for (let page = startPage; page <= endPage; page += 1) {
      doc.setPage(page);
      const segTop = page === startPage ? yStart : TABLE_TOP_CONTINUATION;
      const segBottom = page === endPage ? yEnd : pageH - bottomPad;
      if (segBottom > segTop + 0.5) strokeLine(x, segTop, x, segBottom);
    }
    doc.setPage(savedPage);
  };

  const drawColumnHeaders = (topY) => {
    const line1 = topY + 3.2;
    const line2 = topY + 6.8;
    doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
    doc.setFontSize(FONT.colHdr);
    doc.setTextColor(...ENXUTO.muted);
    doc.text('QUANT', X.quant, line1, { align: 'right' });
    doc.text('UN', X.un, line1, { align: 'right' });
    doc.text('CUSTO UN', X.custoUnit, line1, { align: 'right' });
    doc.text('PRECO', X.preco, line1, { align: 'right' });
    doc.text('MK%', X.markup, line1, { align: 'right' });
    doc.text('C.TOTAL', X.custoTot, line1, { align: 'right' });
    doc.text('RECEITA', X.receita, line1, { align: 'right' });
    doc.text('LUCRO', X.lucro, line1, { align: 'right' });
    doc.setFontSize(FONT.colHdr - 0.4);
    doc.text('unit.', X.custoUnit, line2, { align: 'right' });
    doc.text('venda', X.preco, line2, { align: 'right' });
    doc.text('qtdxc', X.custoTot, line2, { align: 'right' });
    doc.text('qtdxv', X.receita, line2, { align: 'right' });
    doc.text('liq.', X.lucro, line2, { align: 'right' });
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

  const descMaxW = (descX = X.desc, reserveBadgeMm = 0) =>
    Math.max(18, descEnd - descX - 1 - reserveBadgeMm);

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

  const drawValueColumns = (baselineY, vals) => {
    doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
    doc.setFontSize(FONT.row);
    doc.setTextColor(...ENXUTO.black);
    doc.text(vals.quantTexto, X.quant, baselineY, { align: 'right' });
    doc.text(vals.unidade, X.un, baselineY, { align: 'right' });
    doc.text(moedaSemSimbolo(vals.custoUnit), X.custoUnit, baselineY, { align: 'right' });
    doc.text(moedaSemSimbolo(vals.preco), X.preco, baselineY, { align: 'right' });
    doc.text(fmtPct(vals.markup), X.markup, baselineY, { align: 'right' });
    doc.text(moedaSemSimbolo(vals.custoTotal), X.custoTot, baselineY, { align: 'right' });
    doc.text(moedaSemSimbolo(vals.receita), X.receita, baselineY, { align: 'right' });
    doc.text(moedaSemSimbolo(vals.lucro), X.lucro, baselineY, { align: 'right' });
  };

  const drawCountBadge = (badgeX, baselineY, count) => {
    const label = String(count ?? 0);
    doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
    doc.setFontSize(FONT.row - 1.6);
    const textW = doc.getTextWidth(label);
    const padX = 1.4;
    const badgeW = textW + padX * 2;
    const badgeH = 3.4;
    const badgeY = baselineY - badgeH * 0.72;
    strokeLine(badgeX, badgeY, badgeX + badgeW, badgeY, ENXUTO.line, ENXUTO_LINE_W);
    strokeLine(badgeX, badgeY + badgeH, badgeX + badgeW, badgeY + badgeH, ENXUTO.line, ENXUTO_LINE_W);
    strokeLine(badgeX, badgeY, badgeX, badgeY + badgeH, ENXUTO.line, ENXUTO_LINE_W);
    strokeLine(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + badgeH, ENXUTO.line, ENXUTO_LINE_W);
    doc.setTextColor(...ENXUTO.muted);
    doc.text(label, badgeX + badgeW / 2, baselineY - 0.15, { align: 'center' });
    return badgeW;
  };

  const drawChevron = (chevronX, baselineY, expanded = false) => {
    doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
    doc.setFontSize(FONT.row - 0.8);
    doc.setTextColor(...ENXUTO.muted);
    doc.text(expanded ? 'v' : '>', chevronX + CHEVRON_SLOT_MM * 0.42, baselineY);
  };

  const descStyleForTier = (tier) => {
    if (tier === 'filho') {
      return { font: PDF_FONT_NORMAL, color: ENXUTO.muted };
    }
    return { font: PDF_FONT_BOLD, color: ENXUTO.black };
  };

  const drawDataRow = (
    y0,
    descricao,
    dataRow,
    {
      level = 1,
      showMetrics = true,
      tier = 'solteiro',
      showChevron = false,
      expanded = false,
      count = null,
    } = {}
  ) => {
    const textStartMm = marginDescTextStartMm(level);
    const descX = X.desc + textStartMm;
    const reserveBadgeMm = count != null ? 8 : 0;
    const { font, color } = descStyleForTier(tier);
    const descLines = splitDescriptionLines(doc, pdfFontFamily, descricao, descMaxW(descX, reserveBadgeMm), font);
    const lineCount = descLines.length;
    const extraH = (lineCount - 1) * DESC_LINE_LEAD;
    const rowStep = ROW_STEP + extraH;
    y = y0;
    ensureTableSpace(rowStep + 1);
    const drawY = y;
    const { valuesBaseline, descFirstBaseline } = rowBaselines(drawY, lineCount, extraH);

    if (showMetrics) {
      const vals = linhaMargemPdf(dataRow, { isGroup: tier === 'pai' });
      drawValueColumns(valuesBaseline, vals);
    }

    if (showChevron) {
      const chevronX = X.desc + marginDescChevronLeftMm(textStartMm);
      drawChevron(chevronX, descFirstBaseline, expanded);
    }

    doc.setFont(pdfFontFamily, font);
    doc.setFontSize(FONT.row);
    doc.setTextColor(...color);
    for (let i = 0; i < lineCount; i += 1) {
      doc.text(descLines[i], descX, descFirstBaseline + i * DESC_LINE_LEAD);
    }

    if (count != null && lineCount > 0) {
      const firstLineW = doc.getTextWidth(descLines[0]);
      drawCountBadge(descX + firstLineW + 1.6, descFirstBaseline, count);
    }

    drawRowSeparator(drawY + rowStep - ROW_GAP * 0.35);
    return drawY + rowStep;
  };

  doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
  doc.setFontSize(FONT.title);
  doc.setTextColor(...ENXUTO.black);
  doc.text('Relatorio de margem — ENXUTO', M, y);
  y += 5.5;
  doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
  doc.setFontSize(8);
  doc.setTextColor(...ENXUTO.muted);
  doc.text('A4   vendas PDV   custo e receita por quantidade   DIN 1451', M, y);
  y += 4.5;
  doc.setFontSize(8.8);
  doc.text(safe(`${productCount} produto(s)`), M, y);
  y += 4.2;
  if (filtersDesc) {
    const filterLines = doc.splitTextToSize(safe(filtersDesc), CW);
    filterLines.slice(0, 2).forEach((line) => {
      doc.text(line, M, y);
      y += 4.2;
    });
  }
  doc.setFontSize(8.2);
  doc.text(`Gerado em ${generatedAt}`, M, y);
  y += 5;

  const tReceita = Number(totals.receita_liquida) || 0;
  const tCusto = Number(totals.custo_total) || 0;
  const tLucro = Number(totals.lucro_total) || 0;
  doc.setFontSize(FONT.kpi);
  doc.setTextColor(...ENXUTO.black);
  doc.text(`Receita: ${moeda(tReceita)}`, M, y);
  doc.text(`Custo: ${moeda(tCusto)}`, M + 58, y);
  doc.setTextColor(...ENXUTO.muted);
  doc.text(`Lucro: ${moeda(tLucro)}   MK ${fmtPct(totalMarkup)}`, M + CW, y, { align: 'right' });
  y += 8;

  if (!displayRows.length) {
    doc.setTextColor(...ENXUTO.muted);
    doc.text('Nenhum produto encontrado com os filtros actuais.', M, y);
  } else {
    dividerStartPage = doc.internal.getNumberOfPages();
    dividerStartY = y;
    beginTablePage();

    for (const treeRow of displayRows) {
      if (treeRow.type === 'group') {
        const label = String(treeRow.label || '').toUpperCase();
        y = drawDataRow(y, label, treeRow, {
          level: treeRow.level ?? 1,
          showMetrics: treeRow.showMetrics !== false,
          tier: 'pai',
          showChevron: !treeRow.isLeafGroup,
          expanded: treeRow.showMetrics === false,
          count: treeRow.count ?? null,
        });
        continue;
      }
      if (treeRow.type !== 'produto') continue;
      const item = treeRow.item || {};
      const nome = String(item.nome || '—').toUpperCase();
      const tier = getMarginRowTier(treeRow);
      y = drawDataRow(y, nome, item, {
        level: treeRow.level ?? 1,
        showMetrics: true,
        tier,
      });
    }

    drawVerticalDivider(
      X.divider,
      dividerStartY,
      y,
      dividerStartPage,
      doc.internal.getNumberOfPages()
    );
  }

  const FOOTER_BLOCK_H = 10;
  if (y + FOOTER_BLOCK_H > pageH - M) {
    doc.addPage();
    y = TABLE_TOP_CONTINUATION;
  }
  doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
  doc.setFontSize(FONT.footer);
  doc.setTextColor(...ENXUTO.muted);
  doc.text('Totais do periodo — receita, custo e lucro das vendas filtradas.', M, y);
  y += 4;
  doc.setTextColor(...ENXUTO.black);
  doc.text(
    `Receita: ${moeda(tReceita)}   Custo: ${moeda(tCusto)}   Lucro: ${moeda(tLucro)}   MK ${fmtPct(totalMarkup)}`,
    M,
    y
  );

  const pdfBytes = doc.output('arraybuffer');
  return { data: pdfBytes, version: 'enxuto_margem_vendas_a4_v2_desc_hierarquia' };
}

export { generateRelatorioMargemEnxutoPdf };
