/**
 * Orçamento cupom 72mm — PDF com texto (jsPDF).
 */
import { ORCAMENTO_CUPOM_PAPEL_MM } from '@/lib/orcamentoCupomFormato';
import { normalizePdfText, registerJsPdfNotoFonts } from '@/lib/jspdfNotoFont';
import { drawLines, ensureVerticalSpace, loadJsPDF, splitLines } from '@/lib/pdf/pdfLayoutHelpers';

const fmtR = (n) => (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtData = () =>
  new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const HIFEN = '------------------------------------------------';

/**
 * @param {{
 *   itens: Array,
 *   total: number,
 *   desconto?: number,
 *   subtotal?: number,
 *   observacoes?: string,
 *   clienteNome?: string,
 *   empresa?: object,
 * }} params
 */
export async function createOrcamentoCupom72Pdf(params) {
  const JsPDF = await loadJsPDF();
  const pageW = ORCAMENTO_CUPOM_PAPEL_MM;
  const margin = 10;
  const contentW = pageW - margin * 2;
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: [pageW, 320] });
  await registerJsPdfNotoFonts(doc);

  let y = 6;
  const x = margin;
  const xR = pageW - margin;
  const lh = 4;

  const hr = () => {
    doc.setFontSize(7);
    doc.text(HIFEN, x, y);
    y += lh;
  };

  const center = (text, size = 9) => {
    doc.setFontSize(size);
    const lines = splitLines(doc, normalizePdfText(text), contentW);
    for (const line of lines) {
      doc.text(line, pageW / 2, y, { align: 'center' });
      y += lh;
    }
  };

  const { empresa, clienteNome, itens = [], subtotal = 0, desconto = 0, total = 0, observacoes } = params;

  if (empresa?.nome) {
    doc.setFont('NotoSans', 'bold');
    center(empresa.nome, 10);
    doc.setFont('NotoSans', 'normal');
    if (empresa.cnpj) center(`CNPJ: ${empresa.cnpj}`, 8);
    if (empresa.telefone) center(empresa.telefone, 8);
    if (empresa.cidade) center(`${empresa.cidade} - ${empresa.estado || ''}`, 8);
  }
  hr();
  doc.setFont('NotoSans', 'bold');
  center('ORÇAMENTO', 11);
  doc.setFont('NotoSans', 'normal');
  center(fmtData(), 8);
  if (clienteNome) {
    doc.text(`CLIENTE: ${normalizePdfText(clienteNome.toUpperCase())}`, x, y);
    y += lh;
  }
  hr();

  doc.setFontSize(8);
  doc.setFont('NotoSans', 'bold');
  doc.text('DESCRIÇÃO', x, y);
  doc.text('QTD', x + contentW * 0.55, y, { align: 'right' });
  doc.text('PREÇO', x + contentW * 0.75, y, { align: 'right' });
  doc.text('TOTAL', xR, y, { align: 'right' });
  y += lh;
  doc.setFont('NotoSans', 'normal');

  for (const item of itens) {
    y = ensureVerticalSpace(doc, y, 12, { top: 6, bottom: 310 });
    const nomeLines = splitLines(doc, normalizePdfText(item.nome || ''), contentW);
    drawLines(doc, nomeLines, x, y, lh);
    y += nomeLines.length * lh;
    const qtd = String(item.qtd ?? '');
    const preco = fmtR(item.preco_unit);
    const tot = fmtR((Number(item.preco_unit) || 0) * (Number(item.qtd) || 0));
    doc.text(item.unidade || 'UN', x, y);
    doc.text(qtd, x + contentW * 0.55, y, { align: 'right' });
    doc.text(preco, x + contentW * 0.75, y, { align: 'right' });
    doc.text(tot, xR, y, { align: 'right' });
    y += lh + 1.5;
  }

  hr();
  if (subtotal > 0) {
    doc.text('Subtotal', x, y);
    doc.text(`R$ ${fmtR(subtotal)}`, xR, y, { align: 'right' });
    y += lh;
    if (desconto > 0) {
      doc.text('Desconto', x, y);
      doc.text(`-R$ ${fmtR(desconto)}`, xR, y, { align: 'right' });
      y += lh;
    }
  }
  hr();
  doc.setFont('NotoSans', 'bold');
  doc.text('TOTAL', x, y);
  doc.text(`R$ ${fmtR(total)}`, xR, y, { align: 'right' });
  y += lh + 1;
  doc.setFont('NotoSans', 'normal');
  hr();

  if (observacoes) {
    const obs = splitLines(doc, `OBS: ${normalizePdfText(observacoes)}`, contentW);
    y = drawLines(doc, obs, x, y, lh) + 1;
    hr();
  }
  center('Nao possui validade fiscal.', 7);

  return doc;
}
