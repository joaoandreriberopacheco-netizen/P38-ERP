import { CUPOM_FONT_GOOGLE } from '@/lib/cupomTermicoConstants';

const LINK_ID = 'p38-cupom-barlow';

let loadPromise = null;

/** Garante Barlow no documento (preview, PDF html2canvas e impressão). */
export function ensureCupomTermicoFontLoaded() {
  if (typeof document === 'undefined') return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    if (!document.getElementById(LINK_ID)) {
      const link = document.createElement('link');
      link.id = LINK_ID;
      link.rel = 'stylesheet';
      link.href = CUPOM_FONT_GOOGLE;
      document.head.appendChild(link);
    }

    try {
      if (document.fonts?.load) {
        await document.fonts.load('400 12px "Barlow"');
        await document.fonts.load('400 18px "Barlow"');
        await document.fonts.ready;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    } catch {
      /* fallback sans-serif */
    }
  })();

  return loadPromise;
}
