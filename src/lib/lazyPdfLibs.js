/** Carrega html2canvas/jspdf só no clique (PDF/impressão) — alivia bundle inicial. */

let html2canvasPromise;
let jsPDFExport;

export function loadHtml2Canvas() {
  if (!html2canvasPromise) {
    html2canvasPromise = import('html2canvas').then((m) => m.default);
  }
  return html2canvasPromise;
}

export function loadJsPDF() {
  if (!jsPDFExport) {
    jsPDFExport = import('jspdf').then((m) => m.jsPDF);
  }
  return jsPDFExport;
}
