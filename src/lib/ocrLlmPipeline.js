/**
 * @deprecated Substituído por `ocrImportPipeline.js` (100% local, sem Gemini).
 * Mantido para compatibilidade — redireciona para parsers locais.
 */

import { processarImportOcrLocal, OCR_IMPORT_TIPOS } from '@/lib/ocrImportPipeline';

const TIPO_POR_SOURCE = {
  import_pedido_compra: OCR_IMPORT_TIPOS.PEDIDO_COMPRA,
  import_cotacao_pdf: OCR_IMPORT_TIPOS.COTACAO_PDF,
  import_lista_foto: OCR_IMPORT_TIPOS.LISTA_FOTO,
  agefin_importador: OCR_IMPORT_TIPOS.BOLETO_AGEFIN,
  agefin_importador_retry: OCR_IMPORT_TIPOS.BOLETO_AGEFIN,
  comprovante_bancario: OCR_IMPORT_TIPOS.COMPROVANTE,
};

/** @deprecated Use processarImportOcrLocal */
export async function invokeLlmComOcrLocal({ file, telemetry } = {}) {
  const source = telemetry?.source || telemetry?.source;
  const tipo = TIPO_POR_SOURCE[source];
  if (!tipo || !file) {
    throw new Error('Importação OCR local: arquivo ou tipo de fluxo inválido.');
  }
  const { dados } = await processarImportOcrLocal({ file, tipo });
  return dados;
}
