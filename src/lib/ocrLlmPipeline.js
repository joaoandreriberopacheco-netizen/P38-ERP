/**
 * Pipeline OCR local → LLM só texto (sem Gemini visão quando o texto basta).
 */

import { base44 } from '@/api/base44Client';
import { extrairTextoDocumento } from '@/lib/extrairTextoDocumento';

/** Mínimo de caracteres para confiar no OCR local e omitir file_urls. */
export const MIN_TEXTO_OCR_PARA_LLM = 120;

export function textoOcrSuficiente(texto, minChars = MIN_TEXTO_OCR_PARA_LLM) {
  const limpo = String(texto || '').replace(/\s+/g, ' ').trim();
  return limpo.length >= minChars;
}

export function buildBlocoTextoOcr(texto, { maxLen = 18000, origem = 'local' } = {}) {
  const corpo = String(texto || '').trim();
  if (!corpo) return '';
  return `

--- Texto extraído localmente (${origem}; use como fonte principal) ---
${corpo.slice(0, maxLen)}`;
}

/**
 * Extrai texto localmente e chama InvokeLLM sem visão quando possível.
 *
 * @param {object} opts
 * @param {string} opts.prompt
 * @param {File|Blob} [opts.file]
 * @param {string} [opts.fileUrl] — URL já enviada ao storage (fallback visão)
 * @param {object} [opts.response_json_schema]
 * @param {object} [opts.telemetry]
 * @param {number} [opts.minTextoChars]
 */
export async function invokeLlmComOcrLocal({
  prompt,
  file,
  fileUrl,
  response_json_schema,
  telemetry,
  minTextoChars = MIN_TEXTO_OCR_PARA_LLM,
}) {
  let texto = '';
  let origem = 'vazio';

  if (file) {
    const extracao = await extrairTextoDocumento(file);
    texto = extracao.texto;
    origem = extracao.origem;
  }

  const usarSomenteTexto = textoOcrSuficiente(texto, minTextoChars);
  const bloco = usarSomenteTexto ? buildBlocoTextoOcr(texto, { origem }) : '';
  const promptFinal = bloco
    ? `${prompt}${bloco}

IMPORTANTE: Use o texto acima como fonte principal. Não invente dados.`
    : prompt;

  const payload = {
    prompt: promptFinal,
    response_json_schema,
    telemetry: {
      ...telemetry,
      ocr_origem: origem,
      ocr_chars: texto.length,
      ocr_modo: usarSomenteTexto ? 'texto_local' : 'gemini_visao',
      file_count: usarSomenteTexto ? 0 : 1,
    },
  };

  if (!usarSomenteTexto && fileUrl) {
    payload.file_urls = [fileUrl];
  }

  return base44.integrations.Core.InvokeLLM(payload);
}
