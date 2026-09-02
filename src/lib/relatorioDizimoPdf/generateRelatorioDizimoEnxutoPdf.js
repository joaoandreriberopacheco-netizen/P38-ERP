import { jsPDF } from 'jspdf';
import { registerJsPdfDin1451Fonts, normalizePdfText } from '@/lib/jspdfNotoFont';
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
  gutter: 8,
};

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
    return `${moeda(valor)} (${cfg.percentual}%)`;
  }
  return moeda(valor);
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
  return `${moeda(valor)} (${percentualDedutivel(item)}%)`;
}

function rotuloDescricao(item) {
  return safe(item.nome || '—');
}

function tableCols(half) {
  return {
    c1: half.x,
    c2: half.x + half.w * 0.44,
    c3: half.x + half.w * 0.66,
    c4: half.x + half.w * 0.84,
    right: half.x + half.w,
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
  const fontFamily = await registerJsPdfDin1451Fonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 10;
  const pageBottom = pageH - 10;
  const COL_W = (pageW - M * 2 - PAD.gutter) / 2;
  const dividerX = M + COL_W + PAD.gutter / 2;

  const margem = demonstrativo.margemDetalhe || {};
  const secoes = ordenarSecoes(demonstrativo.secoes || []);
  const anexoForaBase = demonstrativo.anexoForaBase || { secoes: [], totalFora: 0 };

  const leftHalf = { x: M, w: COL_W, y: PAD.colTop };
  const rightHalf = { x: M + COL_W + PAD.gutter, w: COL_W, y: PAD.colTop };
  const pageDividers = [];

  /** Coluna activa no fluxo esquerda → direita → nova página. */
  let flowCol = leftHalf;
  /** Contexto para continuação suave entre metades/páginas. */
  const flowCtx = {
    active: false,
    tableHeaders: null,
    grupoLabel: null,
  };

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
    if (flowCtx.tableHeaders) h += PAD.headerBefore + PAD.headerText + PAD.afterHeaderRule;
    if (flowCtx.grupoLabel) h += PAD.grupoBefore + PAD.grupoText + PAD.grupoAfter;
    return h;
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
    if (flowCtx.tableHeaders) {
      const tc = tableCols(flowCol);
      flowCol.y += PAD.headerBefore;
      const headerY = flowCol.y;
      setFont('normal', FONT.header, INK.muted);
      const labels = flowCtx.tableHeaders;
      doc.text(safe(labels[0].toUpperCase()), tc.c1, headerY);
      doc.text(safe(labels[1].toUpperCase()), tc.c2, headerY, { align: 'right' });
      doc.text(safe(labels[2].toUpperCase()), tc.c3, headerY, { align: 'right' });
      doc.text(safe(labels[3].toUpperCase()), tc.right, headerY, { align: 'right' });
      flowCol.y += PAD.headerText;
      strokeH(flowCol.y, tc.c1, tc.right, INK.line, LINE.fine);
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

  const drawSectionTitle = (titulo) => {
    const needed = PAD.sectionBefore + PAD.sectionAfterTitle + 4;
    ensureSpace(needed);
    flowCtx.active = false;
    flowCtx.grupoLabel = null;
    flowCol.y += PAD.sectionBefore;
    setFont('bold', FONT.section);
    doc.text(safe(titulo), flowCol.x, flowCol.y);
    flowCol.y += PAD.sectionAfterTitle;
  };

  const drawBlockLabel = (label) => {
    const needed = PAD.blockLabelBefore + PAD.blockLabelAfter + 3;
    ensureSpace(needed);
    flowCtx.grupoLabel = null;
    flowCol.y += PAD.blockLabelBefore;
    setFont('bold', FONT.grupo, INK.muted);
    doc.text(safe(label), flowCol.x, flowCol.y);
    flowCol.y += PAD.blockLabelAfter;
  };

  const drawColHeader = (labels, { remember = true } = {}) => {
    const needed = PAD.headerBefore + PAD.headerText + PAD.afterHeaderRule + 5;
    ensureSpace(needed);
    const tc = tableCols(flowCol);
    flowCol.y += PAD.headerBefore;
    const headerY = flowCol.y;
    setFont('normal', FONT.header, INK.muted);
    doc.text(safe(labels[0].toUpperCase()), tc.c1, headerY);
    doc.text(safe(labels[1].toUpperCase()), tc.c2, headerY, { align: 'right' });
    doc.text(safe(labels[2].toUpperCase()), tc.c3, headerY, { align: 'right' });
    doc.text(safe(labels[3].toUpperCase()), tc.right, headerY, { align: 'right' });
    flowCol.y += PAD.headerText;
    strokeH(flowCol.y, tc.c1, tc.right, INK.line, LINE.fine);
    flowCol.y += PAD.afterHeaderRule;
    if (remember) flowCtx.tableHeaders = [...labels];
  };

  const measureDesc = (half, descricao, { bold = false } = {}) => {
    const tc = tableCols(half);
    setFont(bold ? 'bold' : 'normal', bold ? FONT.bodyBold : FONT.body);
    const lines = doc.splitTextToSize(safe(descricao), tc.c2 - tc.c1 - 2);
    return { lines, textH: Math.max(LINE_STEP, lines.length * LINE_STEP), tc };
  };

  const drawRow4 = (descricao, v2, v3, v4, { bold = false } = {}) => {
    const { textH } = measureDesc(flowCol, descricao, { bold });
    const rowH = PAD.rowPadTop + textH + PAD.rowPadBottom + PAD.afterRowRule + 1;
    ensureSpace(rowH);
    const { lines: drawLines, textH: drawH, tc: drawTc } = measureDesc(flowCol, descricao, { bold });
    const finalH = PAD.rowPadTop + drawH + PAD.rowPadBottom;
    const textY = flowCol.y + PAD.rowPadTop + BASELINE;

    setFont(bold ? 'bold' : 'normal', bold ? FONT.bodyBold : FONT.body);
    drawLines.forEach((line, i) => doc.text(line, drawTc.c1, textY + i * LINE_STEP));
    doc.text(safe(v2), drawTc.c2, textY, { align: 'right' });
    doc.text(safe(v3), drawTc.c3, textY, { align: 'right' });
    doc.text(safe(v4), drawTc.right, textY, { align: 'right' });

    flowCol.y += finalH;
    strokeH(flowCol.y, drawTc.c1, drawTc.right, INK.lineSoft, LINE.hair);
    flowCol.y += PAD.afterRowRule;
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
      moeda(item.valorBruto),
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

  const columnsStartY = yHead + 8;
  resetColumns(columnsStartY);
  pageDividers.push({ page: 1, top: columnsStartY });

  // ═══ 1. Demonstrativo ═══
  drawSectionTitle('1. Demonstrativo');
  drawBlockLabel('RECEITAS');
  drawColHeader(['Descrição', 'Total', 'Custo', 'Lucro bruto']);

  const receita = number(margem.receita_liquida);
  const custo = number(margem.custo_total);
  const lucroBruto = number(demonstrativo.lucroBruto);

  drawRow4(
    'Venda período',
    receita > 0 ? moeda(receita) : moeda(lucroBruto),
    custo > 0 ? moeda(custo) : '—',
    moeda(lucroBruto),
    { bold: true },
  );

  advanceFlow(PAD.subBlockBetween);
  drawBlockLabel('DESPESAS');
  drawColHeader(['Descrição', 'Total', 'Não dedutível', 'Dedutível']);

  for (const secao of secoes) {
    const label = ORDEM_SECOES_PDF.find((d) => d.id === secao.id)?.label || secao.label;
    drawRow4(
      label,
      moeda(secao.valorBruto),
      secao.valorNaoDedutivel > 0 ? moeda(secao.valorNaoDedutivel) : '0,00',
      moeda(secao.valorDedutivel),
    );
  }

  advanceFlow(PAD.totalBefore);
  drawRow4('Lucro operacional', '—', '—', moeda(demonstrativo.lucroLiquidoOperacional), {
    bold: true,
  });
  drawRow4(
    `Dízimo (${demonstrativo.percentualDizimo || 10}%)`,
    '—',
    '—',
    moeda(demonstrativo.dizimo),
    { bold: true },
  );

  // ═══ 2. Despesas dedutíveis (flui esquerda → direita) ═══
  clearTableContext();
  drawSectionTitle('2. Despesas dedutíveis');
  drawColHeader(['Descrição', 'Total', 'Não ded.', 'Dedutível']);

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
    clearTableContext();
    drawSectionTitle('3. Despesas deixadas de fora do cálculo');
    drawColHeader(['Descrição', 'Total', 'Não ded.', 'Dedutível']);

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
              moeda(item.valorBruto),
              formatarCelulaNaoDedutivel(item),
              '—',
            );
          }
        }
      } else {
        for (const item of ordenarItens(secao.itens || [])) {
          const fora = number(item.valorFora ?? item.valorNaoDedutivel);
          if (fora <= 0.009) continue;
          drawRow4(rotuloDescricao(item), moeda(item.valorBruto), formatarCelulaNaoDedutivel(item), '—');
        }
      }
    }

    advanceFlow(PAD.totalBefore);
    drawRow4('Total fora da base', '—', moeda(anexoForaBase.totalFora), '—', { bold: true });
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
    version: 'dizimo_half_page_columns_v10',
  };
}
