import { jsPDF } from 'jspdf';
import { registerJsPdfBarlowFonts, normalizePdfText } from '@/lib/jspdfNotoFont';

const ENXUTO_LINE_W = 0.12;

const COLOR = {
  black: [0, 0, 0],
  muted: [72, 72, 72],
  line: [110, 110, 110],
  section: [236, 236, 236],
  accent: [74, 82, 64],
};

const FONT = {
  title: 13,
  section: 9,
  resumoLabel: 8.8,
  resumoValue: 8.8,
  grupo: 10.5,
  subgrupo: 9,
  item: 9.2,
  nota: 7.8,
  dizimo: 14.5,
  footer: 7,
};

const safe = (value) => normalizePdfText(corrigirTextoPt(value));
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
 * PDF enxuto do Dízimo — resumo + listagem por grupo (nome e valor).
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

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const fontFamily = await registerJsPdfBarlowFonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 10;
  const right = pageW - M;
  const CW = pageW - M * 2;
  const pageBottom = pageH - 10;
  let y = 12;

  const setFont = (style = 'normal', size = 9, color = COLOR.black) => {
    doc.setFont(fontFamily, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const strokeLine = (yPos, x0 = M, x1 = right, color = COLOR.line, width = ENXUTO_LINE_W) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(x0, yPos, x1, yPos);
  };

  const ensureSpace = (needed) => {
    if (y + needed <= pageBottom) return;
    doc.addPage();
    y = 12;
    setFont('bold', 8, COLOR.muted);
    doc.text(safe(`Dízimo — ${competenciaLabel} — continuação`), M, y);
    y += 6;
  };

  const advance = (dy) => {
    y += dy;
  };

  const drawResumoSecao = (titulo) => {
    ensureSpace(8);
    strokeLine(y);
    advance(3);
    setFont('bold', FONT.section, COLOR.muted);
    doc.text(safe(titulo.toUpperCase()), M, y);
    advance(4.5);
  };

  const drawResumoLinha = (label, value, { prefix = '', bold = false, sublabel = '' } = {}) => {
    const labelW = CW * 0.62;
    setFont(bold ? 'bold' : 'normal', FONT.resumoLabel, bold ? COLOR.black : COLOR.muted);
    const labelLines = doc.splitTextToSize(safe(label), labelW);
    const sublabelLines = sublabel ? doc.splitTextToSize(safe(sublabel), labelW) : [];
    const blockH = Math.max(4.2, labelLines.length * 3.8 + sublabelLines.length * 3.2 + (sublabel ? 0.8 : 0));
    ensureSpace(blockH + 1.5);

    const rowY = y;
    labelLines.forEach((line, index) => doc.text(line, M + 2, rowY + index * 3.8));
    if (sublabelLines.length) {
      const subY = rowY + labelLines.length * 3.8 + 0.6;
      setFont('normal', FONT.nota, COLOR.muted);
      sublabelLines.forEach((line, index) => doc.text(line, M + 2, subY + index * 3.2));
    }

    setFont(bold ? 'bold' : 'normal', FONT.resumoValue, COLOR.black);
    doc.text(safe(`${prefix}${moeda(value)}`), right, rowY, { align: 'right' });
    advance(blockH + 1.2);
    strokeLine(y, M + 2, right, COLOR.line, 0.06);
    advance(1.4);
  };

  /** Linha simples: despesa + valor (sem categoria nem dedutibilidade). */
  const drawItem = (item, { indent = 0 } = {}) => {
    const nomeX = M + indent;
    const nomeW = CW - indent - 30;

    setFont('normal', FONT.item);
    const nomeLines = doc.splitTextToSize(safe(item.nome || '—'), nomeW);
    const blockH = Math.max(4.8, nomeLines.length * 3.8);

    ensureSpace(blockH + 1.2);
    const rowY = y;
    nomeLines.forEach((line, index) => doc.text(line, nomeX, rowY + index * 3.8));
    setFont('bold', FONT.item);
    doc.text(moeda(item.valorBruto), right, rowY, { align: 'right' });
    advance(blockH + 1.2);
    strokeLine(y, M + indent, right, COLOR.line, 0.06);
    advance(1);
  };

  const drawItemFora = (item, { indent = 0 } = {}) => {
    drawItem({ ...item, valorBruto: item.valorFora }, { indent });
  };

  const drawGrupo = (titulo, subtotal) => {
    ensureSpace(8);
    strokeLine(y);
    advance(3.5);
    setFont('bold', FONT.grupo);
    doc.text(safe(titulo), M, y);
    setFont('bold', FONT.grupo);
    doc.text(moeda(subtotal), right, y, { align: 'right' });
    advance(4.5);
  };

  const drawSubgrupo = (titulo, subtotal) => {
    ensureSpace(7);
    setFont('bold', FONT.subgrupo, COLOR.muted);
    doc.text(safe(titulo), M + 2, y);
    setFont('bold', FONT.subgrupo);
    doc.text(moeda(subtotal), right, y, { align: 'right' });
    advance(4);
  };

  const drawAnexoTitulo = (titulo, nota = '') => {
    doc.addPage();
    y = 12;
    setFont('bold', 11);
    doc.text(safe(titulo), M, y);
    advance(5);
    if (nota) {
      setFont('normal', FONT.nota, COLOR.muted);
      const lines = doc.splitTextToSize(safe(nota), CW);
      lines.forEach((line, index) => doc.text(line, M, y + index * 3.4));
      advance(lines.length * 3.4 + 2);
    }
  };

  const margem = demonstrativo.margemDetalhe || {};
  const anexoForaBase = demonstrativo.anexoForaBase || { secoes: [], totalFora: 0 };

  // —— Página 1: cabeçalho + resumo ——
  setFont('bold', FONT.title);
  doc.text(safe('Relatório de Dízimo'), M, y);
  advance(5.5);
  setFont('normal', 8, COLOR.muted);
  doc.text(safe(`Competência ${competenciaLabel} · gerado em ${generatedAt}`), M, y);
  advance(7);

  const boxH = 20;
  ensureSpace(boxH + 6);
  const boxY = y;
  doc.setFillColor(...COLOR.section);
  doc.roundedRect(M, boxY, CW, boxH, 2.5, 2.5, 'F');
  doc.setDrawColor(...COLOR.black);
  doc.setLineWidth(ENXUTO_LINE_W);
  doc.roundedRect(M, boxY, CW, boxH, 2.5, 2.5, 'S');

  setFont('normal', 8, COLOR.muted);
  doc.text('Dízimo estimado', M + 5, boxY + 6.2);
  setFont('heavy', FONT.dizimo, COLOR.accent);
  doc.text(moeda(demonstrativo.dizimo), M + 5, boxY + 14.5);
  setFont('normal', FONT.nota, COLOR.muted);
  doc.text(
    safe(`${demonstrativo.percentualDizimo || 10}% do lucro líquido operacional`),
    M + CW / 2,
    boxY + 14.5,
    { align: 'right' },
  );
  y = boxY + boxH + 7;

  drawResumoLinha('Lucro bruto (margem)', demonstrativo.lucroBruto, { prefix: '+ ', bold: true });
  if (number(margem.receita_liquida) > 0) {
    setFont('normal', FONT.nota, COLOR.muted);
    doc.text(
      safe(`Receita líquida ${moeda(margem.receita_liquida)} · CMV ${moeda(margem.custo_total)}`),
      M + 2,
      y,
    );
    advance(5);
    strokeLine(y, M + 2, right, COLOR.line, 0.06);
    advance(2);
  }

  drawResumoSecao('Despesas dedutíveis na base');
  for (const secao of demonstrativo.secoes || []) {
    drawResumoLinha(secao.label, secao.valorDedutivel, {
      prefix: '- ',
      sublabel:
        secao.valorNaoDedutivel > 0
          ? `${moeda(secao.valorBruto)} planejado · ${moeda(secao.valorNaoDedutivel)} fora da base`
          : '',
    });
  }
  drawResumoLinha('Total dedutível', demonstrativo.totalDedutivel, { prefix: '- ', bold: true });
  drawResumoLinha('Lucro líquido operacional estimado', demonstrativo.lucroLiquidoOperacional, {
    prefix: '= ',
    bold: true,
  });
  drawResumoLinha('Dízimo', demonstrativo.dizimo, { prefix: '= ', bold: true });
  if (number(anexoForaBase.totalFora) > 0) {
    drawResumoLinha('Total fora da base (ver anexo)', anexoForaBase.totalFora, {
      sublabel: 'Despesas não dedutíveis ou parcialmente excluídas',
    });
  }

  // —— Detalhamento: grupo → subgrupo (se houver) → itens em ordem alfabética ——
  doc.addPage();
  y = 12;
  setFont('bold', 11);
  doc.text(safe('Detalhamento por despesa'), M, y);
  advance(5);
  setFont('normal', FONT.nota, COLOR.muted);
  doc.text(safe('Valores planejados da competência, agrupados por bloco.'), M, y);
  advance(7);

  for (const secao of demonstrativo.secoes || []) {
    drawGrupo(secao.label, secao.valorBruto);

    if (secao.subsecoes?.length) {
      for (const sub of secao.subsecoes) {
        if (!sub.itens?.length) continue;
        drawSubgrupo(sub.label, sub.valorBruto);
        for (const item of ordenarItens(sub.itens)) {
          drawItem(item, { indent: 4 });
        }
        advance(2);
      }
    } else {
      for (const item of ordenarItens(secao.itens || [])) {
        drawItem(item, { indent: 2 });
      }
    }
    advance(3);
  }

  if (number(anexoForaBase.totalFora) > 0) {
    drawAnexoTitulo(
      'Anexo — Despesas fora da base do dízimo',
      'Valores que não entraram no cálculo do lucro líquido operacional estimado.',
    );
    drawResumoLinha('Total fora da base', anexoForaBase.totalFora, { bold: true });
    advance(2);

    for (const secao of anexoForaBase.secoes || []) {
      drawGrupo(secao.label, secao.valorFora);

      if (secao.subsecoes?.length) {
        for (const sub of secao.subsecoes) {
          drawSubgrupo(sub.label, sub.valorFora);
          for (const item of ordenarItens(sub.itens || [])) {
            drawItemFora(item, { indent: 4 });
          }
          advance(2);
        }
      } else {
        for (const item of ordenarItens(secao.itens || [])) {
          drawItemFora(item, { indent: 2 });
        }
      }
      advance(3);
    }
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    strokeLine(pageH - 8, M, right, COLOR.line, 0.2);
    setFont('normal', FONT.footer, COLOR.muted);
    doc.text(safe(`Dízimo · ${competenciaLabel}`), M, pageH - 4.5);
    doc.text(safe(`Gerado em ${generatedAt}`), M + CW / 2, pageH - 4.5, { align: 'center' });
    doc.text(`Página ${page} de ${pageCount}`, right, pageH - 4.5, { align: 'right' });
  }

  return {
    data: doc.output('arraybuffer'),
    version: 'dizimo_enxuto_a4_v3',
  };
}
