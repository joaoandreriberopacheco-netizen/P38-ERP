import { loadJsPDF } from '@/lib/lazyPdfLibs';
import { appendAnexosToPdfDoc } from '@/lib/appendAnexosToPdfDoc';

export default async function exportAnexosToPdf(anexos = []) {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const pagesAdded = await appendAnexosToPdfDoc(doc, anexos, { skipSectionHeader: true });

  if (pagesAdded === 0) {
    doc.text('Nenhum anexo compatível para exportação.', 14, 20);
  }

  doc.save('anexos.pdf');
}