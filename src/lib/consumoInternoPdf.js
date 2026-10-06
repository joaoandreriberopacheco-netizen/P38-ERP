import { normalizePdfText, registerJsPdfNotoFonts } from '@/lib/jspdfNotoFont';
import { drawLines, ensureVerticalSpace, loadJsPDF, splitLines } from '@/lib/pdf/pdfLayoutHelpers';
import { CUPOM_PAPEL_MM } from '@/lib/cupomTermicoConstants';

const fmt = (value) =>
  `R$ ${(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function createConsumoInternoPdf({ consumo, dadosEmpresa, formato = 'a4' }) {
  const JsPDF = await loadJsPDF();
  const isA4 = formato === 'a4';
  const doc = new JsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: isA4 ? 'a4' : [CUPOM_PAPEL_MM, 200],
  });
  await registerJsPdfNotoFonts(doc);

  const M = isA4 ? 15 : 8;
  const W = isA4 ? 180 : CUPOM_PAPEL_MM - M * 2;
  let y = isA4 ? 18 : 10;
  const lh = 4.5;

  const empresaNome = dadosEmpresa?.nome_fantasia || dadosEmpresa?.razao_social || 'EMPRESA';
  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(isA4 ? 16 : 12);
  doc.text(normalizePdfText(empresaNome), M, y);
  y += lh + 2;
  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(10);
  doc.text('Minuta de Consumo Interno', M, y);
  y += lh + 4;

  const lines = [
    `Nº: ${consumo?.numero || '-'}`,
    `Destinação: ${consumo?.destinacao || '-'}`,
    `Interveniente: ${consumo?.responsavel_recebimento || '-'}`,
    consumo?.usuario_solicitante_nome ? `Registrado por: ${consumo.usuario_solicitante_nome}` : '',
    `Total: ${fmt(consumo?.valor_total)}`,
  ].filter(Boolean);

  for (const line of lines) {
    doc.text(normalizePdfText(line), M, y);
    y += lh;
  }
  y += 2;
  doc.setFont('NotoSans', 'bold');
  doc.text('Itens', M, y);
  y += lh;
  doc.setFont('NotoSans', 'normal');

  for (const item of consumo?.itens || []) {
    y = ensureVerticalSpace(doc, y, lh * 2, { top: 10, bottom: isA4 ? 280 : 190 });
    const left = `${item.produto_nome || ''} (${item.quantidade || ''} ${item.unidade_medida || ''})`;
    const wrapped = splitLines(doc, normalizePdfText(left), W * 0.65);
    drawLines(doc, wrapped, M, y, lh);
    doc.text(fmt(item.subtotal), M + W, y, { align: 'right' });
    y += wrapped.length * lh + 1;
  }

  return doc;
}
