/**
 * Tipografia do PDF de cotação de referência: Segoe UI (Regular / Semibold / Bold).
 * No Windows o sistema usa Segoe UI; em outros ambientes carregamos Inter (substituto web próximo).
 */
export const DOCUMENTO_COMERCIAL_A4_FONT =
  'ui-sans-serif, "Segoe UI", Inter, -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif';

export const DOCUMENTO_COMERCIAL_A4_FONT_GOOGLE =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';

let loadPromise = null;

/** Garante Inter no preview/PDF quando Segoe UI não está disponível. */
export function ensureDocumentoComercialA4FontLoaded() {
  if (typeof document === 'undefined') return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const id = 'p38-documento-comercial-a4-font';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = DOCUMENTO_COMERCIAL_A4_FONT_GOOGLE;
      document.head.appendChild(link);
    }
    if (document.fonts?.load) {
      await document.fonts.load('400 13px Inter');
      await document.fonts.load('600 13px Inter');
    }
  })().catch(() => {});

  return loadPromise;
}
