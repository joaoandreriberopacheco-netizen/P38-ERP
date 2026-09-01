import { jsPDF } from 'jspdf';
import { registerJsPdfDin1451Fonts, normalizePdfText } from '@/lib/jspdfNotoFont';
import { labelModoDedutivel, normalizarConfigItemDizimo, DIZIMO_MODOS } from '@/lib/dizimoCalculos';

const COLOR = {
  black: [0, 0, 0],
  muted: [72, 72, 72],
  line: [110, 110, 110],
  lightLine: [220, 220, 220],
  accent: [74, 82, 64],
};

const FONT = {
  title: 13,
  section: 9,
  resumoLabel: 8.8,
  resumoValue: 8.8,
  grupo: 10.5,
  itemTitle: 9.2,
  itemDetail: 8,
  nota: 7.8,
  dizimo: 16,
};

const safe = (value) => normalizePdfText(value);
const number = (value) => Number(value) || 0;
const moeda = (value) =>
  `R$ ${number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function labelDedutibilidadePdf(config = {}) {
  const normalizado = normalizarConfigItemDizimo(config);
  if (normalizado.modo === DIZIMO_MODOS.PARCIAL) {
    return `Parcial ${normalizado.percentual}%`;
  }
  return labelModoDedutivel(normalizado.modo);
}

/**
 * PDF enxuto do Dízimo — resumo + detalhamento por item com dedutibilidade.
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
  const font = await registerJsPdfDin1451Fonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const right = pageW - margin;
  const pageBottom = pageH - 10;
  let y = 12;
  const contentLeft = margin;
  const contentWidth = pageW - margin * 2;

  const setFont = (style = 'normal', size = 9, color = COLOR.black) => {
    doc.setFont(font, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const strokeH = (yPos, x0 = contentLeft, x1 = right, color = COLOR.lightLine, width = 0.06) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(x0, yPos, x1, yPos);
  };

  const ensureSpace = (needed) => {
    if (y + needed <= pageBottom) return;
    doc.addPage();
    y = 12;
    setFont('bold', 8, COLOR.muted);
    doc.text(safe(`DÍZIMO — ${competenciaLabel} — continuação`), contentLeft, y);
    y += 6;
  };

  const advance = (dy) => {
    y += dy;
  };

  const drawResumoSecao = (titulo) => {
    ensureSpace(8);
    strokeH(y, contentLeft, right, COLOR.line, 0.1);
    advance(3);
    setFont('bold', FONT.section, COLOR.muted);
    doc.text(safe(titulo.toUpperCase()), contentLeft, y);
    advance(4.5);
  };

  const drawResumoLinha = (label, value, { prefix = '', bold = false, sublabel = '' } = {}) => {
    const labelW = contentWidth * 0.62;
    setFont(bold ? 'bold' : 'normal', FONT.resumoLabel, bold ? COLOR.black : COLOR.muted);
    const labelLines = doc.splitTextToSize(safe(label), labelW);
    const sublabelLines = sublabel ? doc.splitTextToSize(safe(sublabel), labelW) : [];
    const blockH = Math.max(4.2, labelLines.length * 3.8 + sublabelLines.length * 3.2 + (sublabel ? 0.8 : 0));
    ensureSpace(blockH + 1.5);

    const rowY = y;
    labelLines.forEach((line, index) => doc.text(line, contentLeft + 2, rowY + index * 3.8));
    if (sublabelLines.length) {
      const subY = rowY + labelLines.length * 3.8 + 0.6;
      setFont('normal', FONT.nota, COLOR.muted);
      sublabelLines.forEach((line, index) => doc.text(line, contentLeft + 2, subY + index * 3.2));
    }

    setFont(bold ? 'bold' : 'normal', FONT.resumoValue, COLOR.black);
    doc.text(safe(`${prefix}${moeda(value)}`), right, rowY, { align: 'right' });
    advance(blockH + 1.2);
    strokeH(y, contentLeft + 2, right);
    advance(1.4);
  };

  const drawItem = (item, { indent = 0 } = {}) => {
    const dedLabel = labelDedutibilidadePdf(item.config);
    const detalhe = [
      item.categoria,
      item.detalhe && item.detalhe !== 'Sócio' ? item.detalhe : '',
      `Dedutível: ${dedLabel}`,
      item.valorDedutivel !== item.valorBruto
        ? `Na base: ${moeda(item.valorDedutivel)}`
        : '',
    ]
      .filter(Boolean)
      .join(' · ');

    const nomeX = contentLeft + indent;
    const nomeW = contentWidth - indent - 28;

    setFont('normal', FONT.itemTitle);
    const nomeLines = doc.splitTextToSize(safe(item.nome || '—'), nomeW);
    setFont('normal', FONT.itemDetail, COLOR.muted);
    const detalheLines = detalhe ? doc.splitTextToSize(safe(detalhe), nomeW) : [];
    const blockH = Math.max(
      5.5,
      nomeLines.length * 3.8 + (detalheLines.length ? detalheLines.length * 3.4 + 0.8 : 0),
    );

    ensureSpace(blockH + 1.2);
    const rowY = y;
    setFont('normal', FONT.itemTitle);
    nomeLines.forEach((line, index) => doc.text(line, nomeX, rowY + index * 3.8));
    setFont('bold', FONT.itemTitle);
    doc.text(moeda(item.valorBruto), right, rowY, { align: 'right' });
    if (detalheLines.length) {
      const detalheY = rowY + nomeLines.length * 3.8 + 0.5;
      setFont('normal', FONT.itemDetail, COLOR.muted);
      detalheLines.forEach((line, index) => doc.text(line, nomeX, detalheY + index * 3.4));
    }
    advance(blockH + 1.4);
    strokeH(y, contentLeft + indent, right);
    advance(1.2);
  };

  const drawGrupo = (titulo, subtotal, subtotalDedutivel) => {
    ensureSpace(9);
    strokeH(y, contentLeft, right, COLOR.line, 0.12);
    advance(3.5);
    setFont('bold', FONT.grupo);
    doc.text(safe(titulo), contentLeft, y);
    setFont('bold', FONT.grupo);
    doc.text(moeda(subtotal), right, y, { align: 'right' });
    advance(4);
    if (subtotalDedutivel != null && subtotalDedutivel !== subtotal) {
      setFont('normal', FONT.nota, COLOR.muted);
      doc.text(safe(`Dedutível na base: ${moeda(subtotalDedutivel)}`), contentLeft + 2, y);
      advance(4);
    }
  };

  const drawSubgrupo = (titulo, subtotal, subtotalDedutivel) => {
    ensureSpace(7);
    setFont('bold', 9, COLOR.muted);
    doc.text(safe(titulo), contentLeft + 2, y);
    setFont('bold', 9);
    doc.text(moeda(subtotal), right, y, { align: 'right' });
    advance(3.5);
    if (subtotalDedutivel != null && subtotalDedutivel !== subtotal) {
      setFont('normal', FONT.nota, COLOR.muted);
      doc.text(safe(`Dedutível: ${moeda(subtotalDedutivel)}`), contentLeft + 4, y);
      advance(3.5);
    }
  };

  const drawItemFora = (item, { indent = 0 } = {}) => {
    const detalhe = [
      item.categoria,
      item.centroCusto ? `Centro: ${item.centroCusto}` : '',
      item.detalhe && item.detalhe !== 'Sócio' ? item.detalhe : '',
      `Configuração: ${item.motivoFora}`,
      item.valorBruto !== item.valorFora ? `Planejado: ${moeda(item.valorBruto)}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    const nomeX = contentLeft + indent;
    const nomeW = contentWidth - indent - 28;

    setFont('normal', FONT.itemTitle);
    const nomeLines = doc.splitTextToSize(safe(item.nome || '—'), nomeW);
    setFont('normal', FONT.itemDetail, COLOR.muted);
    const detalheLines = detalhe ? doc.splitTextToSize(safe(detalhe), nomeW) : [];
    const blockH = Math.max(
      5.5,
      nomeLines.length * 3.8 + (detalheLines.length ? detalheLines.length * 3.4 + 0.8 : 0),
    );

    ensureSpace(blockH + 1.2);
    const rowY = y;
    setFont('normal', FONT.itemTitle);
    nomeLines.forEach((line, index) => doc.text(line, nomeX, rowY + index * 3.8));
    setFont('bold', FONT.itemTitle);
    doc.text(moeda(item.valorFora), right, rowY, { align: 'right' });
    if (detalheLines.length) {
      const detalheY = rowY + nomeLines.length * 3.8 + 0.5;
      setFont('normal', FONT.itemDetail, COLOR.muted);
      detalheLines.forEach((line, index) => doc.text(line, nomeX, detalheY + index * 3.4));
    }
    advance(blockH + 1.4);
    strokeH(y, contentLeft + indent, right);
    advance(1.2);
  };

  const drawAnexoTitulo = (titulo, nota = '') => {
    doc.addPage();
    y = 12;
    setFont('bold', 11);
    doc.text(safe(titulo), contentLeft, y);
    advance(5);
    if (nota) {
      setFont('normal', FONT.nota, COLOR.muted);
      const lines = doc.splitTextToSize(safe(nota), contentWidth);
      lines.forEach((line, index) => doc.text(line, contentLeft, y + index * 3.4));
      advance(lines.length * 3.4 + 2);
    }
  };

  const margem = demonstrativo.margemDetalhe || {};
  const anexoForaBase = demonstrativo.anexoForaBase || { secoes: [], totalFora: 0 };

  // —— Página 1: resumo ——
  setFont('bold', FONT.title);
  doc.text(safe('Relatório de Dízimo'), contentLeft, y);
  advance(5.5);
  setFont('normal', 8.5, COLOR.muted);
  doc.text(safe(`Competência ${competenciaLabel} · gerado em ${generatedAt}`), contentLeft, y);
  advance(8);

  setFont('bold', FONT.dizimo, COLOR.accent);
  doc.text(moeda(demonstrativo.dizimo), contentLeft, y);
  advance(5);
  setFont('normal', FONT.nota, COLOR.muted);
  doc.text(
    safe(`${demonstrativo.percentualDizimo || 10}% sobre o lucro líquido operacional estimado`),
    contentLeft,
    y,
  );
  advance(8);

  drawResumoLinha('Lucro bruto (margem)', demonstrativo.lucroBruto, { prefix: '+ ', bold: true });
  if (number(margem.receita_liquida) > 0) {
    setFont('normal', FONT.nota, COLOR.muted);
    doc.text(
      safe(`Receita líquida ${moeda(margem.receita_liquida)} · CMV ${moeda(margem.custo_total)}`),
      contentLeft + 2,
      y,
    );
    advance(5);
    strokeH(y, contentLeft + 2, right);
    advance(2);
  }

  drawResumoSecao('Despesas dedutíveis na base');
  for (const secao of demonstrativo.secoes || []) {
    drawResumoLinha(secao.label, secao.valorDedutivel, {
      prefix: '− ',
      sublabel:
        secao.valorNaoDedutivel > 0
          ? `${moeda(secao.valorBruto)} planejado · ${moeda(secao.valorNaoDedutivel)} fora da base`
          : '',
    });
  }
  drawResumoLinha('Total dedutível', demonstrativo.totalDedutivel, { prefix: '− ', bold: true });
  drawResumoLinha('Lucro líquido operacional estimado', demonstrativo.lucroLiquidoOperacional, {
    prefix: '= ',
    bold: true,
  });
  drawResumoLinha('Dízimo', demonstrativo.dizimo, { prefix: '= ', bold: true });
  if (number(anexoForaBase.totalFora) > 0) {
    drawResumoLinha('Total fora da base (ver anexo)', anexoForaBase.totalFora, {
      prefix: ' ',
      sublabel: 'Despesas não dedutíveis ou parcialmente excluídas',
    });
  }

  // —— Detalhamento ——
  doc.addPage();
  y = 12;
  setFont('bold', 11);
  doc.text(safe('Detalhamento por item'), contentLeft, y);
  advance(5);
  setFont('normal', FONT.nota, COLOR.muted);
  doc.text(
    safe('Cada linha indica o valor planejado e a dedutibilidade configurada para a base do dízimo.'),
    contentLeft,
    y,
  );
  advance(6);

  for (const secao of demonstrativo.secoes || []) {
    drawGrupo(secao.label, secao.valorBruto, secao.valorDedutivel);

    if (secao.subsecoes?.length) {
      for (const sub of secao.subsecoes) {
        if (!sub.itens?.length) continue;
        drawSubgrupo(sub.label, sub.valorBruto, sub.valorDedutivel);
        for (const item of sub.itens) {
          drawItem(item, { indent: 4 });
        }
        advance(2);
      }
    } else {
      for (const item of secao.itens || []) {
        drawItem(item, { indent: 2 });
      }
    }
    advance(3);
  }

  if (number(anexoForaBase.totalFora) > 0) {
    drawAnexoTitulo(
      'Anexo — Despesas fora da base do dízimo',
      'Valores planejados que não entraram no cálculo do lucro líquido operacional estimado (total, parcial ou não dedutível).',
    );
    drawResumoLinha('Total fora da base', anexoForaBase.totalFora, { prefix: ' ', bold: true });
    advance(2);

    for (const secao of anexoForaBase.secoes || []) {
      drawGrupo(secao.label, secao.valorFora, secao.valorFora);

      if (secao.subsecoes?.length) {
        for (const sub of secao.subsecoes) {
          drawSubgrupo(sub.label, sub.valorFora, sub.valorFora);
          for (const item of sub.itens || []) {
            drawItemFora(item, { indent: 4 });
          }
          advance(2);
        }
      } else {
        for (const item of secao.itens || []) {
          drawItemFora(item, { indent: 2 });
        }
      }
      advance(3);
    }
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    setFont('normal', 7, COLOR.muted);
    doc.text(safe(`Dízimo · ${competenciaLabel}`), margin, pageH - 5);
    doc.text(`${page}/${pageCount}`, right, pageH - 5, { align: 'right' });
  }

  return {
    data: doc.output('arraybuffer'),
    version: 'dizimo_enxuto_a4_v2',
  };
}
