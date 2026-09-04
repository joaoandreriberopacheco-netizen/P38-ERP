/**
 * Mobile/tablet: popups e `window.print()` em iframe costumam falhar ou ser bloqueados.
 * Preferimos PDF/HTML via blob + Web Share API ou download.
 */
import { CUPOM_LARGURA_IMPRESSAO_MM, CUPOM_MARGEM_LATERAL_MM, CUPOM_PAPEL_MM } from '@/lib/cupomTermicoConstants';
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
 * Mesma lógica dos comprovantes: captura do DOM → PDF (térmica 60mm útil ou A4).
 */
async function loadPdfCaptureLibs() {
  const [html2canvasModule, jspdfModule] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  return {
    html2canvas: html2canvasModule.default,
    jsPDF: jspdfModule.jsPDF,
  };
}

export async function renderElementToPdfBlob(element, { formato = '80mm' } = {}) {
  if (!element) throw new Error('Elemento inválido');
  const { html2canvas, jsPDF } = await loadPdfCaptureLibs();
  const isA4 = formato === 'a4';
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    ignoreElements: (node) =>
      typeof node?.classList?.contains === 'function' && node.classList.contains('no-pdf-capture'),
  });
  const imgData = canvas.toDataURL('image/png');
  let pdf;
  if (isA4) {
    pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210;
    const pageH = 297;
    const ratio = canvas.width / canvas.height;
    const imgH = pageW / ratio;
    pdf.addImage(imgData, 'PNG', 0, 0, pageW, Math.min(imgH, pageH));
  } else {
    const widthMm = CUPOM_LARGURA_IMPRESSAO_MM;
    const pageWidthMm = CUPOM_PAPEL_MM;
    const heightMm = (canvas.height / canvas.width) * widthMm;
    pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pageWidthMm, heightMm] });
    pdf.addImage(imgData, 'PNG', CUPOM_MARGEM_LATERAL_MM, 0, widthMm, heightMm);
  }
  return pdf.output('blob');
}

/**
 * @param elementId {string|HTMLElement}
 */
export async function exportCupomToPdfAndShareOrDownload(elementId, {
  formato = '80mm',
  fileBaseName = 'documento',
  title,
} = {}) {
  const el = typeof elementId === 'string' ? document.getElementById(elementId) : elementId;
  if (!el) throw new Error('Elemento não encontrado');
  const blob = await renderElementToPdfBlob(el, { formato: formato === 'a4' ? 'a4' : '80mm' });
  const name = `${fileBaseName}.pdf`;
  return shareOrDownloadBlob(blob, name, 'application/pdf', title || name);
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
 *
 * @param {string} htmlString documento completo ou fragmento (usa-se como corpo se não tiver <html)
 * @param {string} filename ex.: `relatorio-${Date.now()}.html`
 * @param {string} [title]
 * @param {{ windowFeatures?: string, printDelayMs?: number, closeAfterPrint?: boolean }} [opts]
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
 * Mobile: PDF a partir de um elemento (cupom, modal, etc.).
 * Desktop: chama `onDesktopPrint()` (por defeito `window.print()`).
 */
export async function printOrShareElementAsPdf(elementId, {
  formato = 'a4',
  fileBaseName = 'documento',
  title,
  onDesktopPrint,
} = {}) {
  if (shouldUseMobileDocumentExport()) {
    return exportCupomToPdfAndShareOrDownload(elementId, { formato, fileBaseName, title });
  }
  if (typeof onDesktopPrint === 'function') {
    onDesktopPrint();
  } else {
    window.print();
  }
  return 'printed';
}
