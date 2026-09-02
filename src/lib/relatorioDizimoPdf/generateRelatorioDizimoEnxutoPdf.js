import { jsPDF } from 'jspdf';
import { registerJsPdfDin1451Fonts, normalizePdfText } from '@/lib/jspdfNotoFont';
import { formatarNomeItemDizimoLista } from '@/lib/dizimoCalculos';

const LINE_W = 0.12;
const SPINE_W = 0.06;

const ENXUTO = {
  black: [0, 0, 0],
  muted: [72, 72, 72],
  line: [110, 110, 110],
  section: [236, 236, 236],
};

/** Mind map: 1 grupo → 2 subgrupo → 3 item (como embarque → pedido → produto). */
const INDENT = {
  grupo: 0,
  spine: 3,
  subgrupo: 10,
  item: 16,
};

const PAD = {
  bandTextY: 5.5,
  bandH: 9,
  layerGap: 2.8,
  headerBottom: 3.5,
  itemsAfterRule: 2.5,
  itemBottom: 3.2,
  grupoGap: 4,
  sectionGap: 2,
};

const FONT = {
  title: 13,
  meta: 8,
  filtros: 8.8,
  kpiLabel: 8.2,
  kpiValue: 14.5,
  grupo: 10.5,
  grupoMeta: 8.5,
  subgrupoCodigo: 9,
  subgrupoNome: 12,
  subgrupoTotal: 12,
  subgrupoMeta: 8.8,
  resumoLabel: 8.6,
  resumoValue: 8.6,
  itemNome: 10,
  itemTotal: 11,
  nota: 7.6,
  footer: 9.5,
  cont: 8,
};

const safe = (value) => normalizePdfText(value);
const number = (value) => Number(value) || 0;
const moeda = (value) =>
  `R$ ${number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const compararNome = (a, b) =>
  String(a?.nome || '').localeCompare(String(b?.nome || ''), 'pt-BR', { sensitivity: 'base' });

function ordenarItens(itens = []) {
  return [...itens].sort(compararNome);
}

function contarDespesas(secoes = []) {
  return secoes.reduce((acc, secao) => {
    if (secao.subsecoes?.length) {
      return acc + secao.subsecoes.reduce((subAcc, sub) => subAcc + (sub.itens?.length || 0), 0);
    }
    return acc + (secao.itens?.length || 0);
  }, 0);
}

/**
 * PDF enxuto do Dízimo — diagramação inspirada no relatório de compras/embarques ENXUTO.
 * A4 paisagem, duas colunas no detalhamento, mind map vertical, DIN 1451.
 */
export async function generateRelatorioDizimoEnxutoPdf(payload = {}) {
  const {
    competenciaLabel = '',
    demonstrativo = {},
    generatedAt = new Date().toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }),
  } = payload;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const fontFamily = await registerJsPdfDin1451Fonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 9;
  const GUTTER = 6;
  const CW = pageW - M * 2;
  const COL_W = (CW - GUTTER) / 2;
  const LEFT_X = M;
  const RIGHT_X = M + COL_W + GUTTER;
  const pageBottom = pageH - 8;
  const contentTop = 12;
  let yFull = contentTop;

  const setFont = (style = 'normal', size = 9, color = ENXUTO.black) => {
    doc.setFont(fontFamily, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const strokeH = (yPos, x0, x1, color = ENXUTO.line, width = LINE_W) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(x0, yPos, x1, yPos);
  };

  const strokeV = (x, y0, y1, color = ENXUTO.line, width = SPINE_W) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(x, y0, x, y1);
  };

  const colRight = (col) => col.x + col.w;

  const leftCol = { x: LEFT_X, w: COL_W, y: contentTop };
  const rightCol = { x: RIGHT_X, w: COL_W, y: contentTop };

  const newPage = () => {
    doc.addPage();
    yFull = contentTop;
    return contentTop;
  };

  const drawVerticalSpan = (col, x, yStart, yEnd, startPage, endPage) => {
    const topPad = 12;
    const bottomPad = 9;
    const savedPage = doc.internal.getNumberOfPages();
    for (let page = startPage; page <= endPage; page += 1) {
      doc.setPage(page);
      const segTop = page === startPage ? yStart : topPad;
      const segBottom = page === endPage ? yEnd : pageH - bottomPad;
      if (segBottom > segTop + 0.5) strokeV(x, segTop, segBottom);
    }
    doc.setPage(savedPage);
  };

  const drawContinuationBand = (col) => {
    setFont('bold', FONT.cont, ENXUTO.muted);
    doc.text(safe(`Dízimo — ${competenciaLabel}`), col.x, col.y);
    col.y += 4.8;
    strokeH(col.y, col.x, colRight(col), ENXUTO.line, 0.08);
    col.y += PAD.itemsAfterRule;
  };

  const startColumnsOnNewPage = () => {
    newPage();
    leftCol.y = contentTop;
    rightCol.y = contentTop;
    drawContinuationBand(leftCol);
    rightCol.y = leftCol.y;
  };

  const ensureColSpace = (col, needed) => {
    if (col.y + needed <= pageBottom) return;
    startColumnsOnNewPage();
  };

  const ensureFullSpace = (needed) => {
    if (yFull + needed <= pageBottom) return;
    newPage();
  };

  const advanceFull = (dy) => {
    yFull += dy;
  };

  const secoes = demonstrativo.secoes || [];
  const anexoForaBase = demonstrativo.anexoForaBase || { secoes: [], totalFora: 0 };
  const margem = demonstrativo.margemDetalhe || {};
  const qtdDespesas = contarDespesas(secoes);

  // ═══ Cabeçalho (estilo compras enxuto) ═══
  setFont('bold', FONT.title);
  doc.text(safe('Relatório de Dízimo — ENXUTO'), M, yFull);
  advanceFull(5.5);
  setFont('normal', FONT.meta, ENXUTO.muted);
  doc.text(safe('A4 paisagem   mind map vertical   DIN 1451'), M, yFull);
  advanceFull(4.5);
  setFont('normal', FONT.filtros);
  doc.text(safe(`Competência ${competenciaLabel}`), M, yFull);
  advanceFull(4.5);
  setFont('normal', FONT.meta);
  doc.text(safe(`Gerado em ${generatedAt}`), M, yFull);
  advanceFull(7);

  // ═══ KPI (caixa cinza — Pedidos listados / Total) ═══
  const boxH = 20;
  ensureFullSpace(boxH + 6);
  const boxY = yFull;
  const boxPadX = 5;
  const kpiColW = (CW - boxPadX * 2) / 2;

  doc.setFillColor(...ENXUTO.section);
  doc.roundedRect(M, boxY, CW, boxH, 2.5, 2.5, 'F');
  doc.setDrawColor(...ENXUTO.black);
  doc.setLineWidth(LINE_W);
  doc.roundedRect(M, boxY, CW, boxH, 2.5, 2.5, 'S');

  const labelY = boxY + 6.2;
  const valueY = boxY + 14.5;
  const kpiLeftX = M + boxPadX;

  setFont('normal', FONT.kpiLabel, ENXUTO.muted);
  doc.text('Despesas listadas', kpiLeftX, labelY);
  doc.text('Dízimo estimado', kpiLeftX + kpiColW, labelY);

  setFont('bold', FONT.kpiValue);
  doc.setTextColor(...ENXUTO.black);
  doc.text(String(qtdDespesas), kpiLeftX, valueY);
  doc.text(moeda(demonstrativo.dizimo), M + CW - boxPadX, valueY, { align: 'right' });

  setFont('normal', FONT.nota, ENXUTO.muted);
  doc.text(
    safe(`${demonstrativo.percentualDizimo || 10}% do lucro líquido operacional`),
    kpiLeftX + kpiColW,
    valueY,
  );
  doc.text(moeda(demonstrativo.lucroLiquidoOperacional), kpiLeftX + kpiColW, valueY + 3.6);

  yFull = boxY + boxH + 6;

  // ═══ Demonstrativo compacto (largura total, entre KPI e detalhe) ═══
  const drawResumoLinha = (label, value, { prefix = '', bold = false, sublabel = '' } = {}) => {
    const labelW = CW * 0.55;
    setFont(bold ? 'bold' : 'normal', FONT.resumoLabel, bold ? ENXUTO.black : ENXUTO.muted);
    const labelLines = doc.splitTextToSize(safe(label), labelW);
    const sublabelLines = sublabel ? doc.splitTextToSize(safe(sublabel), labelW) : [];
    const blockH = Math.max(
      4,
      labelLines.length * 3.6 + sublabelLines.length * 3 + (sublabel ? 0.6 : 0),
    );
    ensureFullSpace(blockH + 2);

    const rowY = yFull;
    labelLines.forEach((line, index) => doc.text(line, M + 1.5, rowY + index * 3.6));
    if (sublabelLines.length) {
      const subY = rowY + labelLines.length * 3.6 + 0.5;
      setFont('normal', FONT.nota, ENXUTO.muted);
      sublabelLines.forEach((line, index) => doc.text(line, M + 1.5, subY + index * 3));
    }

    setFont(bold ? 'bold' : 'normal', FONT.resumoValue);
    doc.setTextColor(...ENXUTO.black);
    doc.text(safe(`${prefix}${moeda(value)}`), M + CW, rowY, { align: 'right' });
    yFull += blockH + 1;
    strokeH(yFull, M + 1.5, M + CW, ENXUTO.line, 0.06);
    yFull += PAD.itemsAfterRule;
  };

  const resumoTop = yFull;
  strokeH(resumoTop, M, M + CW);
  yFull += PAD.layerGap;
  setFont('bold', FONT.grupo);
  doc.text(safe('Demonstrativo'), M + INDENT.grupo, yFull + PAD.bandTextY - 2);
  setFont('normal', FONT.grupoMeta, ENXUTO.muted);
  doc.text(
    safe(`Lucro líquido ${moeda(demonstrativo.lucroLiquidoOperacional)}`),
    M + CW,
    yFull + PAD.bandTextY - 2,
    { align: 'right' },
  );
  yFull += PAD.bandH;
  strokeH(yFull, M, M + CW);
  yFull += PAD.layerGap + 1;

  drawResumoLinha('Lucro bruto (margem)', demonstrativo.lucroBruto, { prefix: '+ ', bold: true });
  if (number(margem.receita_liquida) > 0) {
    setFont('normal', FONT.nota, ENXUTO.muted);
    doc.text(
      safe(`Receita ${moeda(margem.receita_liquida)} · CMV ${moeda(margem.custo_total)}`),
      M + 1.5,
      yFull,
    );
    yFull += 4.2;
    strokeH(yFull, M + 1.5, M + CW, ENXUTO.line, 0.06);
    yFull += PAD.itemsAfterRule;
  }

  for (const secao of secoes) {
    drawResumoLinha(secao.label, secao.valorDedutivel, {
      prefix: '- ',
      sublabel:
        secao.valorNaoDedutivel > 0
          ? `${moeda(secao.valorBruto)} planejado · ${moeda(secao.valorNaoDedutivel)} fora`
          : '',
    });
  }
  drawResumoLinha('Total dedutível', demonstrativo.totalDedutivel, { prefix: '- ', bold: true });
  drawResumoLinha('Lucro líquido operacional', demonstrativo.lucroLiquidoOperacional, {
    prefix: '= ',
    bold: true,
  });
  drawResumoLinha('Dízimo', demonstrativo.dizimo, { prefix: '= ', bold: true });
  if (number(anexoForaBase.totalFora) > 0) {
    drawResumoLinha('Total fora da base', anexoForaBase.totalFora, {
      sublabel: 'Despesas não dedutíveis ou parcialmente excluídas',
    });
  }
  strokeH(yFull + 0.5, M, M + CW);
  yFull += PAD.grupoGap + 2;

  // ═══ Detalhamento em duas colunas (mind map compras) ═══
  leftCol.y = yFull;
  rightCol.y = yFull;

  const pickShorterCol = () => (leftCol.y <= rightCol.y ? leftCol : rightCol);

  const drawItem = (col, item, { valor = null } = {}) => {
    const itemX = col.x + INDENT.item;
    const nomeW = col.w - INDENT.item - 26;
    const rotulo = formatarNomeItemDizimoLista(item);
    const valorExibir = valor != null ? valor : item.valorBruto;

    setFont('normal', FONT.itemNome);
    const nomeLines = doc.splitTextToSize(safe(rotulo), nomeW);
    const nomeLineStep = 4.2;
    const blockH = Math.max(5, nomeLines.length * nomeLineStep);
    ensureColSpace(col, blockH + PAD.itemBottom);

    const rowY = col.y;
    const branchY = rowY + 2.8;
    strokeV(col.x + INDENT.spine, rowY, rowY + blockH + PAD.itemBottom);
    strokeH(branchY, col.x + INDENT.spine, col.x + INDENT.spine + 1.8);

    nomeLines.forEach((line, index) => doc.text(line, itemX, rowY + index * nomeLineStep));
    setFont('bold', FONT.itemTotal);
    doc.text(moeda(valorExibir), colRight(col), rowY, { align: 'right' });
    col.y += blockH + 0.6;
    strokeH(col.y, itemX, colRight(col), ENXUTO.line, 0.06);
    col.y += PAD.itemBottom;
  };

  const drawSubgrupoBloco = (col, sub) => {
    const pedidoX = col.x + INDENT.subgrupo;
    const pedidoW = col.w - INDENT.subgrupo;
    const blockTop = col.y;
    const startPage = doc.internal.getNumberOfPages();

    ensureColSpace(col, 18);
    setFont('normal', FONT.subgrupoCodigo, ENXUTO.muted);
    doc.text(safe(sub.label), pedidoX, blockTop + 6);
    setFont('normal', FONT.subgrupoCodigo, ENXUTO.muted);
    doc.text('Total', pedidoX, blockTop + 10.5);
    setFont('bold', FONT.subgrupoTotal);
    doc.setTextColor(...ENXUTO.black);
    doc.text(moeda(sub.valorBruto), pedidoX + pedidoW, blockTop + 10.5, { align: 'right' });

    const itemsTop = blockTop + 13.5;
    strokeH(itemsTop, pedidoX, colRight(col));
    col.y = itemsTop + PAD.itemsAfterRule;

    for (const item of ordenarItens(sub.itens || [])) {
      drawItem(col, item);
    }

    const endPage = doc.internal.getNumberOfPages();
    drawVerticalSpan(col, col.x + INDENT.spine, blockTop, col.y, startPage, endPage);
    col.y += PAD.sectionGap;
  };

  const drawSecaoDetalhe = (col, secao) => {
    const itemCount = secao.subsecoes?.length
      ? secao.subsecoes.reduce((acc, sub) => acc + (sub.itens?.length || 0), 0)
      : (secao.itens?.length || 0);
    const blockTop = col.y;
    const startPage = doc.internal.getNumberOfPages();

    ensureColSpace(col, PAD.bandH + 8);
    strokeH(blockTop, col.x, colRight(col));
    setFont('bold', FONT.grupo);
    doc.setTextColor(...ENXUTO.black);
    doc.text(safe(secao.label), col.x + INDENT.grupo, blockTop + PAD.bandTextY);
    setFont('normal', FONT.grupoMeta, ENXUTO.muted);
    doc.text(
      safe(`${itemCount} desp.   ${moeda(secao.valorBruto)}`),
      colRight(col),
      blockTop + PAD.bandTextY,
      { align: 'right' },
    );
    const bandBottom = blockTop + PAD.bandH;
    strokeH(bandBottom, col.x, colRight(col));
    col.y = bandBottom + PAD.layerGap;

    if (secao.subsecoes?.length) {
      for (const sub of secao.subsecoes) {
        if (!sub.itens?.length) continue;
        drawSubgrupoBloco(col, sub);
      }
    } else {
      const itemsTop = col.y;
      strokeH(itemsTop, col.x + INDENT.subgrupo, colRight(col));
      col.y = itemsTop + PAD.itemsAfterRule;
      for (const item of ordenarItens(secao.itens || [])) {
        drawItem(col, item);
      }
    }

    strokeH(col.y + 0.5, col.x, colRight(col));
    const endPage = doc.internal.getNumberOfPages();
    drawVerticalSpan(col, col.x + INDENT.spine, blockTop, col.y + 0.5, startPage, endPage);
    col.y += PAD.grupoGap;
  };

  ensureColSpace(leftCol, 8);
  rightCol.y = leftCol.y;
  setFont('bold', FONT.grupo);
  doc.text(safe('Detalhamento por despesa'), M, leftCol.y);
  leftCol.y += 4.5;
  setFont('normal', FONT.nota, ENXUTO.muted);
  doc.text(safe('Valores planejados da competência.'), M, leftCol.y);
  leftCol.y += 5;
  strokeH(leftCol.y, M, M + CW);
  leftCol.y += PAD.itemsAfterRule + 1;
  rightCol.y = leftCol.y;

  for (const secao of secoes) {
    drawSecaoDetalhe(pickShorterCol(), secao);
  }

  if (number(anexoForaBase.totalFora) > 0 && anexoForaBase.secoes?.length) {
    const anexoCol = pickShorterCol();
    anexoCol.y += 3;
    ensureColSpace(anexoCol, PAD.bandH + 6);
    const anexoTop = anexoCol.y;
    strokeH(anexoTop, anexoCol.x, colRight(anexoCol));
    setFont('bold', FONT.grupo);
    doc.text(safe('Fora da base'), anexoCol.x + INDENT.grupo, anexoTop + PAD.bandTextY);
    setFont('normal', FONT.grupoMeta, ENXUTO.muted);
    doc.text(moeda(anexoForaBase.totalFora), colRight(anexoCol), anexoTop + PAD.bandTextY, {
      align: 'right',
    });
    const anexoBottom = anexoTop + PAD.bandH;
    strokeH(anexoBottom, anexoCol.x, colRight(anexoCol));
    anexoCol.y = anexoBottom + PAD.layerGap;

    for (const secao of anexoForaBase.secoes) {
      const secaoAdaptada = {
        ...secao,
        valorBruto: secao.valorFora,
        subsecoes: (secao.subsecoes || []).map((sub) => ({
          ...sub,
          valorBruto: sub.valorFora,
          itens: (sub.itens || []).map((item) => ({ ...item, valorBruto: item.valorFora })),
        })),
        itens: (secao.itens || []).map((item) => ({ ...item, valorBruto: item.valorFora })),
      };
      drawSecaoDetalhe(anexoCol, secaoAdaptada);
    }
  }

  // ═══ Rodapé (só página, como compras enxuto) ═══
  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    setFont('normal', FONT.footer, ENXUTO.muted);
    doc.text(`Página ${page}/${pageCount}`, pageW / 2, pageH - 6, { align: 'center' });
  }

  return {
    data: doc.output('arraybuffer'),
    version: 'dizimo_enxuto_compras_landscape_v5',
  };
}
