/**
 * PaddleOCR no browser (ppu-paddle-ocr) — extração local de texto em PT-BR.
 * Modelo Latin v5 para documentos brasileiros (NF, boleto, listas impressas).
 */

let servicePromise = null;

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

async function loadPaddleModule() {
  const mod = await import('ppu-paddle-ocr/web');
  return mod;
}

/**
 * Singleton do serviço OCR — primeira chamada baixa ~6–15 MB de modelos.
 */
export async function getPaddleOcrService() {
  if (!isBrowser()) {
    throw new Error('PaddleOCR só está disponível no browser.');
  }
  if (!servicePromise) {
    servicePromise = (async () => {
      const { PaddleOcrService, V5_LATIN_MOBILE_MODEL } = await loadPaddleModule();
      const service = new PaddleOcrService({
        model: V5_LATIN_MOBILE_MODEL,
        recognition: {
          strategy: 'per-line',
          mainThreadYieldMs: 16,
        },
      });
      await service.initialize();
      return service;
    })();
  }
  return servicePromise;
}

/**
 * Pré-carrega modelos em background (opcional — melhora UX no primeiro import).
 */
export function preloadPaddleOcr() {
  if (!isBrowser()) return;
  void getPaddleOcrService().catch((err) => {
    console.warn('[P38][PaddleOCR] preload falhou:', err);
  });
}

async function fileToCanvas(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível para OCR.');
    ctx.drawImage(img, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * OCR em imagem (File/Blob/canvas/ArrayBuffer).
 * @returns {Promise<string>}
 */
export async function reconhecerTextoImagem(source) {
  const service = await getPaddleOcrService();
  let input = source;

  if (source instanceof Blob && !(source instanceof HTMLCanvasElement)) {
    input = await fileToCanvas(source);
  }

  const result = await service.recognize(input, { flatten: true });
  return String(result?.text || '').trim();
}
