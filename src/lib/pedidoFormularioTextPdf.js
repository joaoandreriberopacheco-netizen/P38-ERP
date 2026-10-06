import { normalizePdfText, registerJsPdfNotoFonts } from '@/lib/jspdfNotoFont';
import { drawLines, loadJsPDF, splitLines } from '@/lib/pdf/pdfLayoutHelpers';

/**
 * PDF A4 com texto a partir do conteúdo textual do formulário de pedido.
 */
export async function createPedidoFormularioTextPdf(textContent, { titulo = 'Pedido' } = {}) {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await registerJsPdfNotoFonts(doc);
  const M = 15;
  const W = 180;
  doc.setFont('NotoSans', 'bold');
  doc.setFontSize(14);
  doc.text(normalizePdfText(titulo), M, 20);
  doc.setFont('NotoSans', 'normal');
  doc.setFontSize(10);
  const lines = splitLines(doc, normalizePdfText(textContent || ''), W);
  drawLines(doc, lines, M, 28, 4.5);
  return doc;
}
