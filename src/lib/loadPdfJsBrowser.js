/**
 * Carrega PDF.js no browser — pacote npm (Next/Vite) com fallback CDN no Vite legado.
 */
export async function loadPdfJsBrowser() {
  if (typeof window === 'undefined') {
    throw new Error('PDF.js só está disponível no browser.');
  }

  const workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';

  try {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
    return pdfjsLib;
  } catch (err) {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      console.warn('[P38] pdfjs-dist local indisponível, a usar CDN esm.sh', err);
    }
    const pdfjsLib = await import(
      /* webpackIgnore: true */
      'https://esm.sh/pdfjs-dist@4.4.168/build/pdf.min.mjs'
    );
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://esm.sh/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';
    return pdfjsLib;
  }
}
