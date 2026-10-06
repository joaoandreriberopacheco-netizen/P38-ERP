/**
 * Mobile/tablet: popups e `window.print()` em iframe costumam falhar ou ser bloqueados.
 * PDFs são gerados com jsPDF (texto seleccionável), não captura de ecrã.
 */
import { CUPOM_LARGURA_IMPRESSAO_MM, CUPOM_MARGEM_LATERAL_MM, CUPOM_PAPEL_MM } from '@/lib/cupomTermicoConstants';
import { ORCAMENTO_CUPOM_PAPEL_MM } from '@/lib/orcamentoCupomFormato';

export function shouldUseMobileDocumentExport() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia('(pointer: coarse)').matches) return true;
    if (window.matchMedia('(max-width: 768px)').matches) return true;
  } catch (_) {
    /* ignore */
  }
  return /Android|iPhone|iPad|iPod|webOS|Mobile/i.test(navigator.userAgent || '');
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * @returns {'shared'|'downloaded'|'aborted'}
 */
export async function shareOrDownloadBlob(blob, filename, mimeType, title) {
  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: title || filename });
        return 'shared';
      }
    } catch (e) {
      if (e?.name === 'AbortError') return 'aborted';
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

/**
 * Gera PDF via função async que devolve instância jsPDF.
 * @param {() => Promise<import('jspdf').jsPDF>} createPdfDocument
 */
export async function pdfDocumentToBlob(createPdfDocument) {
  const pdf = await createPdfDocument();
  return pdf.output('blob');
}

/**
 * Partilha ou descarrega PDF criado com texto (jsPDF).
 */
export async function exportPdfDocumentAndShare({
  createPdfDocument,
  fileBaseName = 'documento',
  title,
} = {}) {
  if (!createPdfDocument) throw new Error('createPdfDocument é obrigatório');
  const blob = await pdfDocumentToBlob(createPdfDocument);
  const name = `${fileBaseName}.pdf`;
  return shareOrDownloadBlob(blob, name, 'application/pdf', title || name);
}

/**
 * @deprecated Use exportPdfDocumentAndShare com createPdfDocument. Mantido para migração gradual.
 */
export async function renderElementToPdfBlob(_element, { createPdfDocument } = {}) {
  if (typeof createPdfDocument === 'function') {
    return pdfDocumentToBlob(createPdfDocument);
  }
  throw new Error(
    'PDF por captura de ecrã foi descontinuado. Passe createPdfDocument (jsPDF com texto).',
  );
}

/**
 * @param elementId {string|HTMLElement} — ignorado se createPdfDocument for passado
 */
export async function exportCupomToPdfAndShareOrDownload(elementId, {
  formato = '80mm',
  fileBaseName = 'documento',
  title,
  createPdfDocument,
} = {}) {
  if (!createPdfDocument) {
    throw new Error('exportCupomToPdfAndShareOrDownload requer createPdfDocument (PDF com texto).');
  }
  return exportPdfDocumentAndShare({ createPdfDocument, fileBaseName, title });
}

/**
 * Exporta HTML completo (orçamentos leves, etc.): partilha ou descarrega .html
 */
export async function shareOrDownloadHtmlDocument(htmlString, filename, title) {
  const blob = new Blob([htmlString], { type: 'text/html;charset=utf-8' });
  return shareOrDownloadBlob(blob, filename, 'text/html', title || filename);
}

/**
 * Desktop: abre HTML numa janela e imprime (opcionalmente fecha).
 * Mobile: partilha ou descarrega ficheiro .html (sem popups).
 */
export async function openPrintWindowOrShareHtml(htmlString, filename, title, opts = {}) {
  const {
    windowFeatures = '',
    printDelayMs = 300,
    closeAfterPrint = true,
  } = opts;

  const doc =
    /<\s*html[\s>]/i.test(htmlString)
      ? htmlString
      : `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${(title || filename || '').replace(/</g, '')}</title></head><body>${htmlString}</body></html>`;

  if (shouldUseMobileDocumentExport()) {
    return shareOrDownloadHtmlDocument(doc, filename.endsWith('.html') ? filename : `${filename}.html`, title);
  }

  const w = window.open('', '_blank', windowFeatures);
  if (!w) {
    const err = new Error('popup-blocked');
    err.name = 'PopupBlocked';
    throw err;
  }
  w.document.open();
  w.document.write(doc);
  w.document.close();
  w.focus();
  await new Promise((r) => setTimeout(r, printDelayMs));
  try {
    w.print();
  } catch {
    /* empty */
  }
  if (closeAfterPrint) {
    try {
      w.close();
    } catch {
      /* empty */
    }
  }
  return 'printed';
}

/**
 * Mobile: PDF com texto (createPdfDocument).
 * Desktop: chama `onDesktopPrint()` (por defeito `window.print()`).
 */
export async function printOrShareElementAsPdf(_elementId, {
  fileBaseName = 'documento',
  title,
  onDesktopPrint,
  createPdfDocument,
} = {}) {
  if (shouldUseMobileDocumentExport()) {
    if (!createPdfDocument) {
      throw new Error('printOrShareElementAsPdf no mobile requer createPdfDocument.');
    }
    return exportPdfDocumentAndShare({ createPdfDocument, fileBaseName, title });
  }
  if (typeof onDesktopPrint === 'function') {
    onDesktopPrint();
  } else {
    window.print();
  }
  return 'printed';
}

/** Metadados de formato (referência para geradores). */
export const PDF_FORMATO_CUPOM_80MM = {
  pageWidthMm: CUPOM_PAPEL_MM,
  contentWidthMm: CUPOM_LARGURA_IMPRESSAO_MM,
  marginMm: CUPOM_MARGEM_LATERAL_MM,
};

export const PDF_FORMATO_CUPOM_72MM = {
  pageWidthMm: ORCAMENTO_CUPOM_PAPEL_MM,
};
