/**
 * Passo ③ da cadeia OCR: texto local → Groq (Llama free) no servidor.
 */

import { invokeP38Core } from '@/lib/p38CoreInvoke';

export function isOcrCloudFallbackEnabled() {
  const flag = String(import.meta.env?.VITE_P38_OCR_CLOUD_FALLBACK || 'true').toLowerCase().trim();
  return !(flag === '0' || flag === 'false' || flag === 'no');
}

/** Pedido/cotação/lista: IA estrutura o JSON antes do parser por layout (default ligado). */
export function isOcrGroqPrimaryEnabled() {
  const flag = String(import.meta.env?.VITE_P38_OCR_GROQ_PRIMARY ?? 'true').toLowerCase().trim();
  return !(flag === '0' || flag === 'false' || flag === 'no');
}

/**
 * @param {{ texto: string, tipo: string }} params
 * @returns {Promise<{ dados: object, model?: string }>}
 */
export async function estruturarDocumentoOcrNaNuvem({ texto, tipo }) {
  const payload = await invokeP38Core({
    op: 'StructurarDocumentoOcr',
    texto: String(texto || '').trim(),
    tipo,
    telemetry: { source: `ocr_groq_${tipo}` },
  });

  if (payload?.error) {
    throw new Error(String(payload.error));
  }

  const dados = payload?.dados ?? payload;
  if (!dados || typeof dados !== 'object') {
    throw new Error('IA na nuvem não devolveu dados estruturados.');
  }

  return { dados, model: payload?.model };
}
