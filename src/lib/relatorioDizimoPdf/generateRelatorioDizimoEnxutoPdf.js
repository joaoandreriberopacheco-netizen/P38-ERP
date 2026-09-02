import { jsPDF } from 'jspdf';
import { registerJsPdfBarlowFonts, normalizePdfText } from '@/lib/jspdfNotoFont';
import { formatarNomeItemDizimoLista } from '@/lib/dizimoCalculos';

const ENXUTO_LINE_W = 0.12;
const ENXUTO_SPINE_W = 0.06;

const ENXUTO = {
  black: [0, 0, 0],
  muted: [72, 72, 72],
  line: [110, 110, 110],
  section: [236, 236, 236],
  accent: [74, 82, 64],
};

const INDENT = {
  grupo: 0,
  spine: 3,
  subgrupo: 8,
  item: 14,
};

const PAD = {
  headerBottom: 3.5,
  afterRule: 2.2,
  itemBottom: 2.8,
  grupoGap: 3.5,
  sectionGap: 2,
};

const FONT = {
  title: 13,
  subtitle: 8,
  kpiLabel: 8.2,
  kpiValue: 14.5,
  section: 8.5,
  grupo: 10.5,
  grupoMeta: 8.5,
  subgrupo: 9,
  resumoLabel: 8.6,
  resumoValue: 8.6,
  item: 9.2,
  nota: 7.6,
  footer: 7.5,
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

/**
 * PDF enxuto do Dízimo — A4 paisagem, duas colunas, diagramação inspirada no relatório de embarques.
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
  const fontFamily = await registerJsPdfBarlowFonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 10;
  const GUTTER = 7;
  const CW = pageW - M * 2;
  const COL_W = (CW - GUTTER) / 2;
  const LEFT_X = M;
  const RIGHT_X = M + COL_W + GUTTER;
  const pageBottom = pageH - 9;
  const contentTop = 12;
  let yFull = contentTop;

  const setFont = (style = 'normal', size = 9, color = ENXUTO.black) => {
    doc.setFont(fontFamily, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const strokeH = (yPos, x0, x1, color = ENXUTO.line, width = ENXUTO_LINE_W) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(x0, yPos, x1, yPos);
  };

  const strokeV = (x, y0, y1, color = ENXUTO.line, width = ENXUTO_SPINE_W) => {
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

  const drawContinuationBand = (col) => {
    setFont('bold', FONT.cont, ENXUTO.muted);
    doc.text(safe(`Dízimo — ${competenciaLabel}`), col.x, col.y);
    col.y += 5;
    strokeH(col.y, col.x, colRight(col), ENXUTO.line, 0.08);
    col.y += PAD.afterRule;
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

  // —— Cabeçalho (largura total) ——
  setFont('bold', FONT.title);
  doc.text(safe('Relatório de Dízimo'), M, yFull);
  advanceFull(5.2);
  setFont('normal', FONT.subtitle, ENXUTO.muted);
  doc.text(safe('A4 paisagem · resumo e detalhamento em duas colunas'), M, yFull);
  advanceFull(4.2);
  doc.text(safe(`Competência ${competenciaLabel} · gerado em ${generatedAt}`), M, yFull);
  advanceFull(6.5);

  // —— KPI (largura total, estilo embarques enxuto) ——
  const boxH = 19;
  ensureFullSpace(boxH + 5);
  const boxY = yFull;
  const boxPadX = 5;
  const kpiColW = (CW - boxPadX * 2) / 2;

  doc.setFillColor(...ENXUTO.section);
  doc.roundedRect(M, boxY, CW, boxH, 2.5, 2.5, 'F');
  doc.setDrawColor(...ENXUTO.black);
  doc.setLineWidth(ENXUTO_LINE_W);
  doc.roundedRect(M, boxY, CW, boxH, 2.5, 2.5, 'S');

  const labelY = boxY + 6;
  const valueY = boxY + 14.2;
  const kpiLeftX = M + boxPadX;
  const kpiRightX = M + boxPadX + kpiColW;

  setFont('normal', FONT.kpiLabel, ENXUTO.muted);
  doc.text('Dízimo estimado', kpiLeftX, labelY);
  doc.text('Lucro líquido operacional', kpiRightX, labelY);

  setFont('heavy', FONT.kpiValue, ENXUTO.accent);
  doc.text(moeda(demonstrativo.dizimo), kpiLeftX, valueY);
  setFont('bold', FONT.kpiValue);
  doc.setTextColor(...ENXUTO.black);
  doc.text(moeda(demonstrativo.lucroLiquidoOperacional), M + CW - boxPadX, valueY, { align: 'right' });

  setFont('normal', FONT.nota, ENXUTO.muted);
  doc.text(
    safe(`${demonstrativo.percentualDizimo || 10}% do lucro líquido`),
    kpiLeftX,
    valueY + 3.8,
  );

  yFull = boxY + boxH + 5.5;

  const columnsStartY = yFull;
  leftCol.y = columnsStartY;
  rightCol.y = columnsStartY;

  const drawResumoSecao = (col, titulo) => {
    ensureColSpace(col, 7);
    strokeH(col.y, col.x, colRight(col));
    col.y += 2.8;
    setFont('bold', FONT.section, ENXUTO.muted);
    doc.text(safe(titulo.toUpperCase()), col.x, col.y);
    col.y += 4;
  };

  const drawResumoLinha = (col, label, value, { prefix = '', bold = false, sublabel = '' } = {}) => {
    const labelW = col.w * 0.58;
    setFont(bold ? 'bold' : 'normal', FONT.resumoLabel, bold ? ENXUTO.black : ENXUTO.muted);
    const labelLines = doc.splitTextToSize(safe(label), labelW);
    const sublabelLines = sublabel ? doc.splitTextToSize(safe(sublabel), labelW) : [];
    const blockH = Math.max(
      4,
      labelLines.length * 3.6 + sublabelLines.length * 3 + (sublabel ? 0.6 : 0),
    );
    ensureColSpace(col, blockH + 2);

    const rowY = col.y;
    labelLines.forEach((line, index) => doc.text(line, col.x + 1.5, rowY + index * 3.6));
    if (sublabelLines.length) {
      const subY = rowY + labelLines.length * 3.6 + 0.5;
      setFont('normal', FONT.nota, ENXUTO.muted);
      sublabelLines.forEach((line, index) => doc.text(line, col.x + 1.5, subY + index * 3));
    }

    setFont(bold ? 'bold' : 'normal', FONT.resumoValue);
    doc.setTextColor(...ENXUTO.black);
    doc.text(safe(`${prefix}${moeda(value)}`), colRight(col), rowY, { align: 'right' });
    col.y += blockH + 1;
    strokeH(col.y, col.x + 1.5, colRight(col), ENXUTO.line, 0.06);
    col.y += PAD.afterRule;
  };

  const drawGrupoBand = (col, titulo, subtotal, meta = '') => {
    const bandH = 7;
    ensureColSpace(col, bandH + PAD.grupoGap);
    const bandY = col.y;
    setFont('bold', FONT.grupo);
    doc.setTextColor(...ENXUTO.black);
    doc.text(safe(titulo), col.x + INDENT.grupo, bandY + 4.2);
    if (meta) {
      setFont('normal', FONT.grupoMeta, ENXUTO.muted);
      doc.text(safe(meta), col.x + col.w * 0.42, bandY + 4.2);
    }
    setFont('bold', FONT.grupo);
    doc.setTextColor(...ENXUTO.black);
    doc.text(moeda(subtotal), colRight(col), bandY + 4.2, { align: 'right' });
    col.y += bandH + 1.2;
    strokeH(col.y, col.x + INDENT.subgrupo, colRight(col));
    col.y += PAD.afterRule;
    return bandY;
  };

  const drawSubgrupo = (col, titulo, subtotal) => {
    ensureColSpace(col, 6);
    setFont('bold', FONT.subgrupo, ENXUTO.muted);
    doc.text(safe(titulo), col.x + INDENT.subgrupo, col.y);
    setFont('bold', FONT.subgrupo);
    doc.setTextColor(...ENXUTO.black);
    doc.text(moeda(subtotal), colRight(col), col.y, { align: 'right' });
    col.y += 3.8;
  };

  const drawItem = (col, item, { indent = INDENT.item, valor = null } = {}) => {
    const nomeX = col.x + indent;
    const nomeW = col.w - indent - 28;
    const rotulo = formatarNomeItemDizimoLista(item);
    const valorExibir = valor != null ? valor : item.valorBruto;

    setFont('normal', FONT.item);
    const nomeLines = doc.splitTextToSize(safe(rotulo), nomeW);
    const blockH = Math.max(4.2, nomeLines.length * 3.5);
    ensureColSpace(col, blockH + PAD.itemBottom);

    const rowY = col.y;
    nomeLines.forEach((line, index) => doc.text(line, nomeX, rowY + index * 3.5));
    setFont('bold', FONT.item);
    doc.text(moeda(valorExibir), colRight(col), rowY, { align: 'right' });
    col.y += blockH + 0.8;
    strokeH(col.y, nomeX, colRight(col), ENXUTO.line, 0.06);
    col.y += PAD.itemBottom;
  };

  const drawSecaoDetalhe = (col, secao) => {
    const itemCount = secao.subsecoes?.length
      ? secao.subsecoes.reduce((acc, sub) => acc + (sub.itens?.length || 0), 0)
      : (secao.itens?.length || 0);
    const meta = `${itemCount} desp.`;
    const grupoTop = col.y;
    const grupoStartPage = doc.internal.getNumberOfPages();
    drawGrupoBand(col, secao.label, secao.valorBruto, meta);

    if (secao.subsecoes?.length) {
      for (const sub of secao.subsecoes) {
        if (!sub.itens?.length) continue;
        drawSubgrupo(col, sub.label, sub.valorBruto);
        for (const item of ordenarItens(sub.itens)) {
          drawItem(col, item);
        }
        col.y += PAD.sectionGap;
      }
    } else {
      for (const item of ordenarItens(secao.itens || [])) {
        drawItem(col, item, { indent: INDENT.subgrupo });
      }
    }

    const grupoEndPage = doc.internal.getNumberOfPages();
    const spineX = col.x + INDENT.spine;
    for (let page = grupoStartPage; page <= grupoEndPage; page += 1) {
      doc.setPage(page);
      const yStart = page === grupoStartPage ? grupoTop : contentTop + 2;
      const yEnd = page === grupoEndPage ? col.y : pageBottom;
      if (yEnd > yStart + 2) strokeV(spineX, yStart, yEnd);
    }
    doc.setPage(grupoEndPage);
    col.y += PAD.grupoGap;
  };

  const margem = demonstrativo.margemDetalhe || {};
  const anexoForaBase = demonstrativo.anexoForaBase || { secoes: [], totalFora: 0 };

  // —— Coluna esquerda: resumo financeiro ——
  drawResumoSecao(leftCol, 'Demonstrativo');
  drawResumoLinha(leftCol, 'Lucro bruto (margem)', demonstrativo.lucroBruto, { prefix: '+ ', bold: true });
  if (number(margem.receita_liquida) > 0) {
    ensureColSpace(leftCol, 5);
    setFont('normal', FONT.nota, ENXUTO.muted);
    doc.text(
      safe(`Receita ${moeda(margem.receita_liquida)} · CMV ${moeda(margem.custo_total)}`),
      leftCol.x + 1.5,
      leftCol.y,
    );
    leftCol.y += 4.2;
    strokeH(leftCol.y, leftCol.x + 1.5, colRight(leftCol), ENXUTO.line, 0.06);
    leftCol.y += PAD.afterRule;
  }

  drawResumoSecao(leftCol, 'Despesas dedutíveis');
  for (const secao of demonstrativo.secoes || []) {
    drawResumoLinha(leftCol, secao.label, secao.valorDedutivel, {
      prefix: '- ',
      sublabel:
        secao.valorNaoDedutivel > 0
          ? `${moeda(secao.valorBruto)} planejado · ${moeda(secao.valorNaoDedutivel)} fora`
          : '',
    });
  }
  drawResumoLinha(leftCol, 'Total dedutível', demonstrativo.totalDedutivel, { prefix: '- ', bold: true });
  drawResumoLinha(leftCol, 'Lucro líquido operacional', demonstrativo.lucroLiquidoOperacional, {
    prefix: '= ',
    bold: true,
  });
  drawResumoLinha(leftCol, 'Dízimo', demonstrativo.dizimo, { prefix: '= ', bold: true });

  if (number(anexoForaBase.totalFora) > 0) {
    leftCol.y += 2;
    drawResumoSecao(leftCol, 'Fora da base');
    drawResumoLinha(leftCol, 'Total excluído do cálculo', anexoForaBase.totalFora, {
      sublabel: 'Despesas não dedutíveis ou parcialmente excluídas',
    });
  }

  // —— Detalhamento: fluxo em duas colunas (coluna mais curta recebe o próximo bloco) ——
  const syncColsY = () => {
    const y = Math.max(leftCol.y, rightCol.y);
    leftCol.y = y;
    rightCol.y = y;
  };

  syncColsY();
  ensureColSpace(leftCol, 10);
  rightCol.y = leftCol.y;
  setFont('bold', FONT.grupo);
  doc.text(safe('Detalhamento por despesa'), M, leftCol.y);
  leftCol.y += 4;
  setFont('normal', FONT.nota, ENXUTO.muted);
  doc.text(safe('Valores planejados da competência, agrupados por bloco.'), M, leftCol.y);
  leftCol.y += 5;
  strokeH(leftCol.y, M, pageW - M);
  leftCol.y += PAD.afterRule + 1;
  rightCol.y = leftCol.y;

  const pickShorterCol = () => (leftCol.y <= rightCol.y ? leftCol : rightCol);

  for (const secao of demonstrativo.secoes || []) {
    drawSecaoDetalhe(pickShorterCol(), secao);
  }

  // Anexo compacto na coluna com mais espaço livre
  if (number(anexoForaBase.totalFora) > 0 && anexoForaBase.secoes?.length) {
    const anexoCol = pickShorterCol();
    anexoCol.y += 4;
    ensureColSpace(anexoCol, 10);
    setFont('bold', FONT.subgrupo);
    doc.text(safe('Despesas fora da base'), anexoCol.x, anexoCol.y);
    anexoCol.y += 4;
    setFont('normal', FONT.nota, ENXUTO.muted);
    doc.text(safe('Valores excluídos do lucro líquido operacional.'), anexoCol.x, anexoCol.y);
    anexoCol.y += 4.5;
    strokeH(anexoCol.y, anexoCol.x, colRight(anexoCol));
    anexoCol.y += PAD.afterRule + 1;

    for (const secao of anexoForaBase.secoes) {
      drawGrupoBand(anexoCol, secao.label, secao.valorFora);
      if (secao.subsecoes?.length) {
        for (const sub of secao.subsecoes) {
          drawSubgrupo(anexoCol, sub.label, sub.valorFora);
          for (const item of ordenarItens(sub.itens || [])) {
            drawItem(anexoCol, item, { valor: item.valorFora });
          }
          anexoCol.y += PAD.sectionGap;
        }
      } else {
        for (const item of ordenarItens(secao.itens || [])) {
          drawItem(anexoCol, item, { indent: INDENT.subgrupo, valor: item.valorFora });
        }
      }
      anexoCol.y += PAD.sectionGap;
    }

    if (anexoCol === leftCol) leftCol.y = anexoCol.y;
    else rightCol.y = anexoCol.y;
  }

  // Divisor vertical suave entre colunas na primeira página
  doc.setPage(1);
  const firstPageSplitY = Math.min(
    pageBottom,
    Math.max(columnsStartY, Math.max(leftCol.y, rightCol.y)),
  );
  if (firstPageSplitY > columnsStartY + 8) {
    strokeV(M + COL_W + GUTTER / 2, columnsStartY, firstPageSplitY, [200, 200, 200], 0.08);
  }

  // Rodapé
  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    strokeH(pageH - 7.5, M, pageW - M, ENXUTO.line, 0.18);
    setFont('normal', FONT.footer, ENXUTO.muted);
    doc.text(safe(`Dízimo · ${competenciaLabel}`), M, pageH - 4);
    doc.text(safe(`Gerado em ${generatedAt}`), pageW / 2, pageH - 4, { align: 'center' });
    doc.text(`Página ${page} de ${pageCount}`, pageW - M, pageH - 4, { align: 'right' });
  }

  return {
    data: doc.output('arraybuffer'),
    version: 'dizimo_enxuto_a4_landscape_v4',
  };
}
