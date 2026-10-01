import { ensureDocumentoComercialA4FontLoaded } from '@/lib/documentoComercialA4Font';

const OFFSCREEN_HOST_ID = 'p38-documento-a4-pdf-capture-host';

/**
 * html2canvas falha ou gera PDF em branco quando o alvo está com transform:scale no preview.
 * Clona o nó em host off-screen, 1:1, com fontes carregadas.
 */
export async function html2canvasDocumentoComercialA4(element, html2canvas, options = {}) {
  if (!element || !html2canvas) {
    throw new Error('Elemento ou html2canvas inválido');
  }

  await ensureDocumentoComercialA4FontLoaded();
  try {
    await document.fonts?.ready;
  } catch {
    /* ignore */
  }

  let host = document.getElementById(OFFSCREEN_HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = OFFSCREEN_HOST_ID;
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = [
      'position:fixed',
      'left:-20000px',
      'top:0',
      'width:210mm',
      'z-index:-1',
      'opacity:1',
      'pointer-events:none',
      'overflow:visible',
    ].join(';');
    document.body.appendChild(host);
  }

  host.replaceChildren();
  const clone = element.cloneNode(true);
  clone.style.transform = 'none';
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';
  host.appendChild(clone);

  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  try {
    return await html2canvas(clone, {
      scale: options.scale ?? 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: clone.scrollWidth || clone.offsetWidth,
      height: clone.scrollHeight || clone.offsetHeight,
      windowWidth: clone.scrollWidth || 794,
      ...options.html2canvas,
    });
  } finally {
    host.replaceChildren();
  }
}
