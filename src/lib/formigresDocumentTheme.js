/**
 * Paleta do catálogo Formigres (scripts/catalogo/gerar-html-tintao-catalogo.mjs — FORMIGRES_SKIN_CSS).
 * Usada em documentos A4 de compras para alinhar ao visual do catálogo.
 */
export const FORMIGRES_DOC_BG = '#ffffff';
export const FORMIGRES_DOC_SURFACE = '#f4f4f4';
export const FORMIGRES_DOC_TEXT = '#444444';
export const FORMIGRES_DOC_TEXT_STRONG = '#111111';
export const FORMIGRES_DOC_MUTED = '#666666';
export const FORMIGRES_DOC_BORDER = '#e8e8e8';
export const FORMIGRES_DOC_ACCENT = '#da1c24';

/** Injeta modo claro na árvore clonada pelo html2canvas (independente do tema do app). */
export function injectPdfLightModeClone(clonedDoc) {
  if (!clonedDoc) return;
  const html = clonedDoc.documentElement;
  if (html) {
    html.classList.remove('dark');
    html.setAttribute('data-theme', 'light');
    html.style.colorScheme = 'only light';
    html.style.background = FORMIGRES_DOC_BG;
  }
  if (clonedDoc.body) {
    clonedDoc.body.classList.remove('dark');
    clonedDoc.body.style.background = FORMIGRES_DOC_BG;
    clonedDoc.body.style.color = FORMIGRES_DOC_TEXT;
  }
  const style = clonedDoc.createElement('style');
  style.textContent = `
    html, body, .p38-documento-comercial-a4, .p38-pdf-light-root, .p38-pdf-light-root * {
      color-scheme: only light !important;
    }
    .dark, [class*="dark:"] { color: inherit !important; background-color: inherit !important; }
    .p38-documento-comercial-a4 {
      background: ${FORMIGRES_DOC_BG} !important;
      color: ${FORMIGRES_DOC_TEXT_STRONG} !important;
    }
  `;
  clonedDoc.head?.appendChild(style);
}