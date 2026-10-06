/** Utilitários partilhados para PDF com texto (jsPDF). */

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

export function splitLines(doc, text, maxWidthMm) {
  const raw = String(text ?? '');
  if (!raw) return [];
  return doc.splitTextToSize(raw, maxWidthMm);
}

export function drawLines(doc, lines, x, y, lineHeightMm) {
  let cy = y;
  const lh = lineHeightMm ?? doc.getLineHeightFactor() * doc.getFontSize() * 0.352778;
  for (const line of lines) {
    doc.text(line, x, cy);
    cy += lh;
  }
  return cy;
}

export function ensureVerticalSpace(doc, y, neededMm, { top = 18, bottom = 282 } = {}) {
  if (y + neededMm <= bottom) return y;
  doc.addPage();
  return top;
}

export async function loadJsPDF() {
  const { jsPDF } = await import('jspdf');
  return jsPDF;
}
