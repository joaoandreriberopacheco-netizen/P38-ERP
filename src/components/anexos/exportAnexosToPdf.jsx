import { loadJsPDF } from '@/lib/lazyPdfLibs';
import { appendAnexosToPdfDoc } from '@/lib/appendAnexosToPdfDoc';
import { exportPedidoAnexosComMinutaPdf } from '@/lib/exportPedidoAnexosComMinutaPdf';

export default async function exportAnexosToPdf(anexos = [], options = {}) {
  const { pedidoId, pedidoNumero } = options;

  if (pedidoId) {
    await exportPedidoAnexosComMinutaPdf({
      pedidoId,
      pedidoNumero,
      anexos,
      fileName: pedidoNumero ? `anexos-${pedidoNumero}.pdf` : 'anexos.pdf',
    });
    return;
  }

  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const { pagesAdded } = await appendAnexosToPdfDoc(doc, anexos, {
    useFirstPage: true,
  });

  if (pagesAdded === 0) {
    doc.text('Nenhum anexo compatível para exportação.', 14, 20);
  }

  doc.save('anexos.pdf');
}
