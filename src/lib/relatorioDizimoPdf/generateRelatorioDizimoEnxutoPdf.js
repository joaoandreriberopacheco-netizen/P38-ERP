import { jsPDF } from 'jspdf';
import { registerJsPdfDin1451Fonts, normalizePdfText } from '@/lib/jspdfNotoFont';
import { DIZIMO_MODOS, normalizarConfigItemDizimo } from '@/lib/dizimoCalculos';

/** Traços mais finos que o peso visual do texto (estilo tabela clean). */
const LINE = {
  hair: 0.035,
  fine: 0.05,
};

const PAD = {
  sectionBefore: 14,
  sectionAfterTitle: 7,
  blockLabelBefore: 5,
  blockLabelAfter: 4.5,
  subBlockBetween: 7,
  headerBefore: 1.5,
  headerText: 4,
  afterHeaderRule: 3.2,
  rowPadTop: 3,
  rowPadBottom: 3.4,
  afterRowRule: 0.4,
  grupoBefore: 5,
  grupoText: 4.2,
  grupoAfter: 2.2,
  totalBefore: 5,
  contTop: 14,
};

const INK = {
  black: [0, 0, 0],
  muted: [100, 100, 100],
  line: [198, 198, 198],
  lineSoft: [214, 214, 214],
};

const FONT = {
  title: 12.5,
  meta: 7.8,
  section: 10,
  grupo: 8.6,
  header: 7.2,
  body: 8.8,
  bodyBold: 8.8,
  footer: 7.8,
};

const LINE_STEP = 3.7;
const BASELINE = 3.2;

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

/**
 * PDF do Dízimo — tabelas abertas clean: linhas finas, respiro generoso, fluxo contínuo.
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
  const M = 12;
  const CW = pageW - M * 2;
  const pageBottom = pageH - 10;
  let y = 14;

  const margem = demonstrativo.margemDetalhe || {};
  const secoes = ordenarSecoes(demonstrativo.secoes || []);
  const anexoForaBase = demonstrativo.anexoForaBase || { secoes: [], totalFora: 0 };

  const cols = {
    c1: M,
    c2: M + CW * 0.42,
    c3: M + CW * 0.62,
    c4: M + CW * 0.8,
    right: M + CW,
  };

  const setFont = (style = 'normal', size = FONT.body, color = INK.black) => {
    doc.setFont(fontFamily, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const strokeH = (yPos, x0 = M, x1 = cols.right, color = INK.line, width = LINE.hair) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(x0, yPos, x1, yPos);
  };

  const ensureSpace = (needed) => {
    if (y + needed <= pageBottom) return;
    doc.addPage();
    y = PAD.contTop;
    setFont('normal', FONT.meta, INK.muted);
    doc.text(safe(`Dízimo — ${competenciaLabel}`), M, y);
    y += 4.5;
    strokeH(y, M, cols.right, INK.lineSoft, LINE.fine);
    y += 5;
  };

  const advance = (dy) => {
    y += dy;
  };

  const drawSectionTitle = (titulo) => {
    ensureSpace(PAD.sectionBefore + PAD.sectionAfterTitle + 4);
    advance(PAD.sectionBefore);
    setFont('bold', FONT.section);
    doc.text(safe(titulo), M, y);
    advance(PAD.sectionAfterTitle);
  };

  const drawBlockLabel = (label) => {
    ensureSpace(PAD.blockLabelBefore + PAD.blockLabelAfter + 4);
    advance(PAD.blockLabelBefore);
    setFont('bold', FONT.grupo, INK.muted);
    doc.text(safe(label), M, y);
    advance(PAD.blockLabelAfter);
  };

  const drawColHeader = (labels) => {
    ensureSpace(PAD.headerBefore + PAD.headerText + PAD.afterHeaderRule + 6);
    advance(PAD.headerBefore);
    const headerY = y;
    setFont('normal', FONT.header, INK.muted);
    doc.text(safe(labels[0].toUpperCase()), cols.c1, headerY);
    doc.text(safe(labels[1].toUpperCase()), cols.c2, headerY, { align: 'right' });
    doc.text(safe(labels[2].toUpperCase()), cols.c3, headerY, { align: 'right' });
    doc.text(safe(labels[3].toUpperCase()), cols.right, headerY, { align: 'right' });
    advance(PAD.headerText);
    strokeH(y, cols.c1, cols.right, INK.line, LINE.fine);
    advance(PAD.afterHeaderRule);
  };

  const measureDescBlock = (descricao, { bold = false } = {}) => {
    setFont(bold ? 'bold' : 'normal', bold ? FONT.bodyBold : FONT.body);
    const lines = doc.splitTextToSize(safe(descricao), cols.c2 - cols.c1 - 4);
    return { lines, textH: Math.max(LINE_STEP, lines.length * LINE_STEP) };
  };

  const drawRow4 = (descricao, v2, v3, v4, { bold = false } = {}) => {
    const { lines, textH } = measureDescBlock(descricao, { bold });
    const rowH = PAD.rowPadTop + textH + PAD.rowPadBottom;
    ensureSpace(rowH + PAD.afterRowRule + 1);
    const textY = y + PAD.rowPadTop + BASELINE;

    setFont(bold ? 'bold' : 'normal', bold ? FONT.bodyBold : FONT.body);
    lines.forEach((line, i) => doc.text(line, cols.c1, textY + i * LINE_STEP));
    doc.text(safe(v2), cols.c2, textY, { align: 'right' });
    doc.text(safe(v3), cols.c3, textY, { align: 'right' });
    doc.text(safe(v4), cols.right, textY, { align: 'right' });

    y += rowH;
    strokeH(y, cols.c1, cols.right, INK.lineSoft, LINE.hair);
    y += PAD.afterRowRule;
  };

  const drawGrupoRow = (label) => {
    ensureSpace(PAD.grupoBefore + PAD.grupoText + PAD.grupoAfter + 2);
    advance(PAD.grupoBefore);
    setFont('bold', FONT.grupo, INK.muted);
    doc.text(safe(String(label).toUpperCase()), cols.c1, y);
    advance(PAD.grupoText);
    strokeH(y, cols.c1, cols.right, INK.lineSoft, LINE.hair);
    advance(PAD.grupoAfter);
  };

  const drawDespesaItemRow = (item) => {
    drawRow4(
      rotuloDescricao(item),
      moeda(item.valorBruto),
      formatarCelulaNaoDedutivel(item),
      formatarCelulaDedutivel(item),
    );
  };

  // —— Cabeçalho ——
  setFont('bold', FONT.title);
  doc.text(safe('Relatório de Dízimo'), M, y);
  advance(5.5);
  setFont('normal', FONT.meta, INK.muted);
  doc.text(safe(competenciaLabel), M, y);
  advance(3.5);
  doc.text(safe(`Gerado em ${generatedAt}`), M, y);
  advance(10);

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

  advance(PAD.subBlockBetween);
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

  advance(PAD.totalBefore);
  drawRow4('Lucro operacional', '—', '—', moeda(demonstrativo.lucroLiquidoOperacional), { bold: true });
  drawRow4(
    `Dízimo (${demonstrativo.percentualDizimo || 10}%)`,
    '—',
    '—',
    moeda(demonstrativo.dizimo),
    { bold: true },
  );

  // ═══ 2. Despesas dedutíveis ═══
  drawSectionTitle('2. Despesas dedutíveis');
  drawColHeader(['Descrição', 'Total', 'Não dedutível', 'Dedutível']);

  for (const secao of secoes) {
    const label = ORDEM_SECOES_PDF.find((d) => d.id === secao.id)?.label || secao.label;
    drawGrupoRow(label);
    for (const { item } of iterarItensSecao(secao)) {
      if (number(item.valorDedutivel) <= 0.009) continue;
      drawDespesaItemRow(item);
    }
  }

  // ═══ 3. Despesas fora do cálculo ═══
  const secoesFora = ordenarSecoes(anexoForaBase.secoes || []);
  if (number(anexoForaBase.totalFora) > 0 && secoesFora.length) {
    drawSectionTitle('3. Despesas deixadas de fora do cálculo');
    drawColHeader(['Descrição', 'Total', 'Não dedutível', 'Dedutível']);

    for (const secao of secoesFora) {
      const label = ORDEM_SECOES_PDF.find((d) => d.id === secao.id)?.label || secao.label;
      drawGrupoRow(label);

      if (secao.subsecoes?.length) {
        for (const sub of secao.subsecoes) {
          for (const item of ordenarItens(sub.itens || [])) {
            const fora = number(item.valorFora ?? item.valorNaoDedutivel);
            if (fora <= 0.009) continue;
            drawRow4(rotuloDescricao(item), moeda(item.valorBruto), formatarCelulaNaoDedutivel(item), '—');
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

    advance(PAD.totalBefore);
    drawRow4('Total fora da base', '—', moeda(anexoForaBase.totalFora), '—', { bold: true });
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    setFont('normal', FONT.footer, INK.muted);
    doc.text(`Página ${page}/${pageCount}`, pageW / 2, pageH - 6, { align: 'center' });
  }

  return {
    data: doc.output('arraybuffer'),
    version: 'dizimo_clean_tables_v8',
  };
}
