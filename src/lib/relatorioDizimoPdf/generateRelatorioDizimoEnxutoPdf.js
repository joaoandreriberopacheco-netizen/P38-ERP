import { jsPDF } from 'jspdf';
import { registerJsPdfBarlowFonts, normalizePdfText } from '@/lib/jspdfNotoFont';
import { DIZIMO_MODOS, normalizarConfigItemDizimo } from '@/lib/dizimoCalculos';

const LINE = { hair: 0.035, fine: 0.05 };

const PAD = {
  sectionBefore: 12,
  sectionAfterTitle: 6.5,
  blockLabelBefore: 4.5,
  blockLabelAfter: 4,
  subBlockBetween: 6,
  headerBefore: 1.5,
  headerText: 3.8,
  afterHeaderRule: 3,
  rowPadTop: 2.8,
  rowPadBottom: 3.2,
  afterRowRule: 0.4,
  grupoBefore: 4.5,
  grupoText: 4,
  grupoAfter: 2,
  totalBefore: 4.5,
  colTop: 13,
};

/** Padding horizontal dentro de cada célula da tabela. */
const CELL_PAD = 1.8;

const INK = {
  black: [0, 0, 0],
  muted: [100, 100, 100],
  line: [198, 198, 198],
  lineSoft: [214, 214, 214],
  divider: [220, 220, 220],
};

const FONT = {
  title: 12.5,
  meta: 7.8,
  section: 9.8,
  grupo: 8.4,
  header: 6.8,
  body: 8.4,
  bodyBold: 8.4,
  footer: 7.8,
};

const LINE_STEP = 3.5;
const BASELINE = 3;

const ORDEM_SECOES_PDF = [
  { id: 'fixas_recorrentes', label: 'Contas fixas' },
  { id: 'folha', label: 'Folha' },
  { id: 'pontuais', label: 'Contas ocasionais' },
  { id: 'budgets', label: 'Budgets' },
];

const safe = (value) => normalizePdfText(value);
const number = (value) => Number(value) || 0;
/** Valor numérico sem prefixo — o R$ fica no cabeçalho da coluna. */
const valorMoeda = (value) =>
  number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const moeda = (value) => `R$ ${valorMoeda(value)}`;

const compararNome = (a, b) =>
  String(a?.nome || '').localeCompare(String(b?.nome || ''), 'pt-BR', { sensitivity: 'base' });

function ordenarItens(itens = []) {
  return [...itens].sort(compararNome);
}

function ordenarSecoes(secoes = []) {
  const mapa = new Map((secoes || []).map((s) => [s.id, s]));
  return ORDEM_SECOES_PDF.map((def) => mapa.get(def.id)).filter(Boolean);
}

function* iterarItensSecao(secao) {
  if (secao.subsecoes?.length) {
    for (const sub of secao.subsecoes) {
      if (!sub.itens?.length) continue;
      for (const item of ordenarItens(sub.itens)) {
        yield { item };
      }
    }
    return;
  }
  for (const item of ordenarItens(secao.itens || [])) {
    yield { item };
  }
}

function formatarCelulaNaoDedutivel(item) {
  const valor = number(item.valorNaoDedutivel ?? item.valorFora);
  if (valor <= 0.009) return '0,00';
  const cfg = normalizarConfigItemDizimo(item.config);
  if (cfg.modo === DIZIMO_MODOS.PARCIAL) {
    return `${valorMoeda(valor)} (${cfg.percentual}%)`;
  }
  return valorMoeda(valor);
}

function percentualDedutivel(item) {
  const cfg = normalizarConfigItemDizimo(item.config);
  if (cfg.modo === DIZIMO_MODOS.TOTAL) return 100;
  if (cfg.modo === DIZIMO_MODOS.NAO_DEDUTIVEL) return 0;
  return cfg.percentual;
}

function formatarCelulaDedutivel(item) {
  const valor = number(item.valorDedutivel);
  if (valor <= 0.009) return '—';
  return `${valorMoeda(valor)} (${percentualDedutivel(item)}%)`;
}

function rotuloDescricao(item) {
  return safe(item.nome || '—');
}

function tableCols(half) {
  const c1 = half.x;
  const right = half.x + half.w;
  const c2 = half.x + half.w * 0.4;
  const c3 = half.x + half.w * 0.62;
  const c4 = half.x + half.w * 0.8;
  return {
    c1,
    c2,
    c3,
    c4,
    right,
    w1: c2 - c1 - CELL_PAD * 2,
    w2: c3 - c2 - CELL_PAD * 2,
    w3: c4 - c3 - CELL_PAD * 2,
    w4: right - c4 - CELL_PAD * 2,
  };
}

/**
 * PDF do Dízimo — A4 paisagem dividido ao meio: fluxo coluna esquerda → direita → nova página.
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
  const pageBottom = pageH - M;
  /** Margem central = margem das extremidades (linha divisória = “fim da página”). */
  const halfW = pageW / 2 - M * 2;
  const dividerX = pageW / 2;

  const margem = demonstrativo.margemDetalhe || {};
  const secoes = ordenarSecoes(demonstrativo.secoes || []);
  const anexoForaBase = demonstrativo.anexoForaBase || { secoes: [], totalFora: 0 };

  const leftHalf = { x: M, w: halfW, y: PAD.colTop };
  const rightHalf = { x: pageW / 2 + M, w: halfW, y: PAD.colTop };
  const pageDividers = [];

  /** Coluna activa no fluxo esquerda → direita → nova página. */
  let flowCol = leftHalf;
  /** Contexto para continuação suave entre metades/páginas. */
  const flowCtx = {
    active: false,
    tableHeaders: null,
    grupoLabel: null,
    sectionTitle: null,
  };

  let columnsStartY = PAD.colTop;

  const setFont = (style = 'normal', size = FONT.body, color = INK.black) => {
    doc.setFont(fontFamily, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const strokeH = (yPos, x0, x1, color = INK.lineSoft, width = LINE.hair) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(x0, yPos, x1, yPos);
  };

  const strokeV = (x, y0, y1, color = INK.divider, width = LINE.hair) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(x, y0, x, y1);
  };

  const strokeTableVerticals = (tc, y0, y1, color = INK.lineSoft) => {
    strokeV(tc.c2, y0, y1, color, LINE.hair);
    strokeV(tc.c3, y0, y1, color, LINE.hair);
    strokeV(tc.c4, y0, y1, color, LINE.hair);
  };

  const splitCellLines = (text, width, { bold = false } = {}) => {
    setFont(bold ? 'bold' : 'normal', bold ? FONT.bodyBold : FONT.body);
    const raw = safe(text ?? '');
    if (!raw || raw === '—') return [];
    return doc.splitTextToSize(raw, Math.max(4, width));
  };

  const resetColumns = (topY = PAD.colTop) => {
    leftHalf.y = topY;
    rightHalf.y = topY;
    flowCol = leftHalf;
  };

  const newPage = (topY = PAD.colTop) => {
    doc.addPage();
    resetColumns(topY);
    setFont('normal', FONT.meta, INK.muted);
    doc.text(safe(`Dízimo — ${competenciaLabel}`), M, topY - 4);
    pageDividers.push({ page: doc.internal.getNumberOfPages(), top: topY + 2 });
  };

  const continuationHeight = () => {
    let h = 5.5;
    if (flowCtx.sectionTitle) h += PAD.sectionAfterTitle + 2;
    if (flowCtx.tableHeaders) h += PAD.headerBefore + PAD.headerText + PAD.afterHeaderRule;
    if (flowCtx.grupoLabel) h += PAD.grupoBefore + PAD.grupoText + PAD.grupoAfter;
    return h;
  };

  const minRowHeight = () =>
    PAD.rowPadTop + LINE_STEP + PAD.rowPadBottom + PAD.afterRowRule + 1;

  const sectionTitleHeight = () => PAD.sectionBefore + PAD.sectionAfterTitle + 4;

  const colHeaderHeight = () => PAD.headerBefore + PAD.headerText + PAD.afterHeaderRule + 5;

  const blockLabelHeight = () => PAD.blockLabelBefore + PAD.blockLabelAfter + 3;

  const leftColumnUnused = () => leftHalf.y <= columnsStartY + 1.5;

  /** Evita cabeçalho órfão: título + header + ≥1 linha na mesma metade. */
  const ensureTableBlockFits = (blockHeight) => {
    if (flowCol.y + blockHeight <= pageBottom) return;

    if (flowCol === leftHalf) {
      if (rightHalf.y + blockHeight <= pageBottom && !leftColumnUnused()) {
        flowCol = rightHalf;
        return;
      }
      newPage();
      return;
    }

    newPage();
  };

  const drawContinuationBanner = (col) => {
    col.y += 1.5;
    setFont('normal', FONT.header, INK.muted);
    doc.text(safe('Continuação'), col.x, col.y);
    col.y += 4;
  };

  const replayContinuationContext = () => {
    if (!flowCtx.active) return;
    drawContinuationBanner(flowCol);
    if (flowCtx.sectionTitle) {
      setFont('bold', FONT.section);
      doc.text(safe(flowCtx.sectionTitle), flowCol.x, flowCol.y);
      flowCol.y += PAD.sectionAfterTitle;
    }
    if (flowCtx.tableHeaders) {
      const tc = tableCols(flowCol);
      flowCol.y += PAD.headerBefore;
      const headerY = flowCol.y;
      setFont('normal', FONT.header, INK.muted);
      const labels = flowCtx.tableHeaders;
      doc.text(safe(labels[0].toUpperCase()), tc.c1 + CELL_PAD, headerY);
      doc.text(safe(labels[1].toUpperCase()), tc.c3 - CELL_PAD, headerY, { align: 'right' });
      doc.text(safe(labels[2].toUpperCase()), tc.c4 - CELL_PAD, headerY, { align: 'right' });
      doc.text(safe(labels[3].toUpperCase()), tc.right - CELL_PAD, headerY, { align: 'right' });
      flowCol.y += PAD.headerText;
      const ruleY = flowCol.y;
      strokeH(ruleY, tc.c1, tc.right, INK.line, LINE.fine);
      strokeTableVerticals(tc, headerY - 0.5, ruleY, INK.line);
      flowCol.y += PAD.afterHeaderRule;
    }
    if (flowCtx.grupoLabel) {
      const tc = tableCols(flowCol);
      flowCol.y += PAD.grupoBefore;
      setFont('bold', FONT.grupo, INK.muted);
      doc.text(safe(`${String(flowCtx.grupoLabel).toUpperCase()} — CONTINUAÇÃO`), tc.c1, flowCol.y);
      flowCol.y += PAD.grupoText;
      strokeH(flowCol.y, tc.c1, tc.right, INK.lineSoft, LINE.hair);
      flowCol.y += PAD.grupoAfter;
    }
  };

  /**
   * Garante espaço na coluna activa; se não couber, passa à metade direita ou nova página
   * e repete contexto (cabeçalhos/grupo) para continuar de onde parou.
   */
  const ensureSpace = (needed) => {
    if (flowCol.y + needed <= pageBottom) return flowCol;

    const contH = flowCtx.active ? continuationHeight() : 0;
    const totalNeeded = needed + contH;

    if (flowCol === leftHalf) {
      if (rightHalf.y + totalNeeded <= pageBottom) {
        flowCol = rightHalf;
        replayContinuationContext();
        return flowCol;
      }
      newPage();
      replayContinuationContext();
      return flowCol;
    }

    newPage();
    replayContinuationContext();
    return flowCol;
  };

  const drawSectionTitle = (titulo, { remember = true } = {}) => {
    flowCtx.active = false;
    flowCtx.grupoLabel = null;
    if (remember) flowCtx.sectionTitle = titulo;
    flowCol.y += PAD.sectionBefore;
    setFont('bold', FONT.section);
    doc.text(safe(titulo), flowCol.x, flowCol.y);
    flowCol.y += PAD.sectionAfterTitle;
  };

  const drawBlockLabel = (label) => {
    flowCtx.grupoLabel = null;
    flowCol.y += PAD.blockLabelBefore;
    setFont('bold', FONT.grupo, INK.muted);
    doc.text(safe(label), flowCol.x, flowCol.y);
    flowCol.y += PAD.blockLabelAfter;
  };

  const beginNumberedSection = (titulo, headerLabels) => {
    clearTableContext();
    const blockH = sectionTitleHeight() + colHeaderHeight() + minRowHeight();
    ensureTableBlockFits(blockH);
    drawSectionTitle(titulo);
    drawColHeader(headerLabels);
  };

  const beginDemonstrativoTable = (blockLabel, headerLabels) => {
    const blockH = blockLabelHeight() + colHeaderHeight() + minRowHeight();
    ensureTableBlockFits(blockH);
    drawBlockLabel(blockLabel);
    drawColHeader(headerLabels, { remember: false });
  };

  const drawColHeader = (labels, { remember = true } = {}) => {
    const needed = PAD.headerBefore + PAD.headerText + PAD.afterHeaderRule + 5;
    ensureSpace(needed);
    const tc = tableCols(flowCol);
    flowCol.y += PAD.headerBefore;
    const headerY = flowCol.y;
    setFont('normal', FONT.header, INK.muted);
    doc.text(safe(labels[0].toUpperCase()), tc.c1 + CELL_PAD, headerY);
    doc.text(safe(labels[1].toUpperCase()), tc.c3 - CELL_PAD, headerY, { align: 'right' });
    doc.text(safe(labels[2].toUpperCase()), tc.c4 - CELL_PAD, headerY, { align: 'right' });
    doc.text(safe(labels[3].toUpperCase()), tc.right - CELL_PAD, headerY, { align: 'right' });
    flowCol.y += PAD.headerText;
    const ruleY = flowCol.y;
    strokeH(ruleY, tc.c1, tc.right, INK.line, LINE.fine);
    strokeTableVerticals(tc, headerY - 0.5, ruleY, INK.line);
    flowCol.y += PAD.afterHeaderRule;
    if (remember) flowCtx.tableHeaders = [...labels];
  };

  const measureRowCells = (descricao, v2, v3, v4, { bold = false } = {}) => {
    const tc = tableCols(flowCol);
    const descLines = splitCellLines(descricao, tc.w1, { bold });
    const l2 = splitCellLines(v2, tc.w2, { bold });
    const l3 = splitCellLines(v3, tc.w3, { bold });
    const l4 = splitCellLines(v4, tc.w4, { bold });
    const descCount = Math.max(descLines.length, 1);
    const valCount = Math.max(l2.length, l3.length, l4.length);
    return { tc, descLines, l2, l3, l4, descCount, valCount };
  };

  const maxLinesInColumn = () => {
    const avail = pageBottom - flowCol.y - PAD.rowPadTop - PAD.rowPadBottom;
    return Math.max(1, Math.floor(avail / LINE_STEP));
  };

  const drawRowCellChunk = (
    { tc, descLines, l2, l3, l4 },
    descOffset,
    descChunk,
    rowLines,
    { bold = false, showValues = false } = {},
  ) => {
    const chunkH = PAD.rowPadTop + rowLines * LINE_STEP + PAD.rowPadBottom;
    const yTop = flowCol.y;
    const textY = flowCol.y + PAD.rowPadTop + BASELINE;
    const style = bold ? 'bold' : 'normal';

    setFont(style, bold ? FONT.bodyBold : FONT.body);
    for (let i = 0; i < descChunk; i += 1) {
      const li = descOffset + i;
      const line = descLines[li];
      if (line) doc.text(line, tc.c1 + CELL_PAD, textY + i * LINE_STEP);
    }

    if (showValues) {
      const valLines = Math.max(l2.length, l3.length, l4.length);
      for (let vi = 0; vi < valLines; vi += 1) {
        const lineY = textY + vi * LINE_STEP;
        if (l2[vi]) doc.text(l2[vi], tc.c3 - CELL_PAD, lineY, { align: 'right' });
        if (l3[vi]) doc.text(l3[vi], tc.c4 - CELL_PAD, lineY, { align: 'right' });
        if (l4[vi]) doc.text(l4[vi], tc.right - CELL_PAD, lineY, { align: 'right' });
      }
    }

    flowCol.y += chunkH;
    const yBottom = flowCol.y;
    strokeH(yBottom, tc.c1, tc.right, INK.lineSoft, LINE.hair);
    strokeTableVerticals(tc, yTop, yBottom, INK.lineSoft);
    flowCol.y += PAD.afterRowRule;
  };

  const drawRow4 = (descricao, v2, v3, v4, { bold = false } = {}) => {
    const cells = measureRowCells(descricao, v2, v3, v4, { bold });
    let descOffset = 0;

    while (descOffset < cells.descCount) {
      const descRemaining = cells.descCount - descOffset;
      const fitDesc = Math.min(maxLinesInColumn(), descRemaining);
      const isLast = descOffset + fitDesc >= cells.descCount;
      const rowLines = isLast ? Math.max(fitDesc, cells.valCount) : fitDesc;
      const chunkH =
        PAD.rowPadTop + rowLines * LINE_STEP + PAD.rowPadBottom + PAD.afterRowRule + 1;
      ensureSpace(chunkH);

      const fresh = measureRowCells(descricao, v2, v3, v4, { bold });
      drawRowCellChunk(fresh, descOffset, fitDesc, rowLines, {
        bold,
        showValues: isLast,
      });
      descOffset += fitDesc;
    }

    flowCtx.active = true;
  };

  const drawGrupoRow = (label) => {
    const needed = PAD.grupoBefore + PAD.grupoText + PAD.grupoAfter + 2;
    ensureSpace(needed);
    const tc = tableCols(flowCol);
    flowCol.y += PAD.grupoBefore;
    setFont('bold', FONT.grupo, INK.muted);
    doc.text(safe(String(label).toUpperCase()), tc.c1, flowCol.y);
    flowCol.y += PAD.grupoText;
    strokeH(flowCol.y, tc.c1, tc.right, INK.lineSoft, LINE.hair);
    flowCol.y += PAD.grupoAfter;
    flowCtx.grupoLabel = label;
    flowCtx.active = true;
  };

  const drawDespesaItemRow = (item) => {
    drawRow4(
      rotuloDescricao(item),
      valorMoeda(item.valorBruto),
      formatarCelulaNaoDedutivel(item),
      formatarCelulaDedutivel(item),
    );
  };

  const advanceFlow = (dy) => {
    ensureSpace(dy);
    flowCol.y += dy;
  };

  const clearTableContext = () => {
    flowCtx.active = false;
    flowCtx.tableHeaders = null;
    flowCtx.grupoLabel = null;
    flowCtx.sectionTitle = null;
  };

  // —— Cabeçalho (largura total, só página 1) ——
  let yHead = 14;
  setFont('bold', FONT.title);
  doc.text(safe('Relatório de Dízimo'), M, yHead);
  yHead += 5.5;
  setFont('normal', FONT.meta, INK.muted);
  doc.text(safe(competenciaLabel), M, yHead);
  yHead += 3.5;
  doc.text(safe(`Gerado em ${generatedAt}`), M, yHead);

  columnsStartY = yHead + 8;
  resetColumns(columnsStartY);
  pageDividers.push({ page: 1, top: columnsStartY });

  const HDR_RECEITAS = ['Descrição', 'Total R$', 'Custo R$', 'Lucro bruto R$'];
  const HDR_DESPESAS = ['Descrição', 'Total R$', 'Não dedutível R$', 'Dedutível R$'];
  const HDR_DETALHE = ['Descrição', 'Total R$', 'Não ded. R$', 'Dedutível R$'];

  // ═══ 1. Demonstrativo ═══
  ensureTableBlockFits(sectionTitleHeight() + blockLabelHeight() + colHeaderHeight() + minRowHeight());
  drawSectionTitle('1. Demonstrativo', { remember: false });
  beginDemonstrativoTable('RECEITAS', HDR_RECEITAS);

  const receita = number(margem.receita_liquida);
  const custo = number(margem.custo_total);
  const lucroBruto = number(demonstrativo.lucroBruto);

  drawRow4(
    'Venda período',
    receita > 0 ? valorMoeda(receita) : valorMoeda(lucroBruto),
    custo > 0 ? valorMoeda(custo) : '—',
    valorMoeda(lucroBruto),
    { bold: true },
  );

  advanceFlow(PAD.subBlockBetween);
  beginDemonstrativoTable('DESPESAS', HDR_DESPESAS);

  for (const secao of secoes) {
    const label = ORDEM_SECOES_PDF.find((d) => d.id === secao.id)?.label || secao.label;
    drawRow4(
      label,
      valorMoeda(secao.valorBruto),
      secao.valorNaoDedutivel > 0 ? valorMoeda(secao.valorNaoDedutivel) : '0,00',
      valorMoeda(secao.valorDedutivel),
    );
  }

  advanceFlow(PAD.totalBefore);
  drawRow4('Lucro operacional', '—', '—', valorMoeda(demonstrativo.lucroLiquidoOperacional), {
    bold: true,
  });
  drawRow4(
    `Dízimo (${demonstrativo.percentualDizimo || 10}%)`,
    '—',
    '—',
    valorMoeda(demonstrativo.dizimo),
    { bold: true },
  );

  // ═══ 2. Despesas dedutíveis (flui esquerda → direita) ═══
  beginNumberedSection('2. Despesas dedutíveis', HDR_DETALHE);

  for (const secao of secoes) {
    const label = ORDEM_SECOES_PDF.find((d) => d.id === secao.id)?.label || secao.label;
    drawGrupoRow(label);
    for (const { item } of iterarItensSecao(secao)) {
      if (number(item.valorDedutivel) <= 0.009) continue;
      drawDespesaItemRow(item);
    }
  }

  // ═══ 3. Fora do cálculo ═══
  const secoesFora = ordenarSecoes(anexoForaBase.secoes || []);
  if (number(anexoForaBase.totalFora) > 0 && secoesFora.length) {
    beginNumberedSection('3. Despesas deixadas de fora do cálculo', HDR_DETALHE);

    for (const secao of secoesFora) {
      const label = ORDEM_SECOES_PDF.find((d) => d.id === secao.id)?.label || secao.label;
      drawGrupoRow(label);

      if (secao.subsecoes?.length) {
        for (const sub of secao.subsecoes) {
          for (const item of ordenarItens(sub.itens || [])) {
            const fora = number(item.valorFora ?? item.valorNaoDedutivel);
            if (fora <= 0.009) continue;
            drawRow4(
              rotuloDescricao(item),
              valorMoeda(item.valorBruto),
              formatarCelulaNaoDedutivel(item),
              '—',
            );
          }
        }
      } else {
        for (const item of ordenarItens(secao.itens || [])) {
          const fora = number(item.valorFora ?? item.valorNaoDedutivel);
          if (fora <= 0.009) continue;
          drawRow4(rotuloDescricao(item), valorMoeda(item.valorBruto), formatarCelulaNaoDedutivel(item), '—');
        }
      }
    }

    advanceFlow(PAD.totalBefore);
    drawRow4('Total fora da base', '—', valorMoeda(anexoForaBase.totalFora), '—', { bold: true });
  }

  // Divisor vertical ao meio de cada página (metade esquerda | metade direita)
  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    const div = pageDividers.find((d) => d.page === page);
    if (div) {
      strokeV(dividerX, div.top, pageBottom - 2, INK.divider, LINE.hair);
    }
    setFont('normal', FONT.footer, INK.muted);
    doc.text(`Página ${page}/${pageCount}`, pageW / 2, pageH - 6, { align: 'center' });
  }

  return {
    data: doc.output('arraybuffer'),
    version: 'dizimo_half_page_columns_v12',
  };
}
