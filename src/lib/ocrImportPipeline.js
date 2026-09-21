/**
 * Pipeline de importação 100% local — PaddleOCR + parsers + match (sem Gemini).
 */

import { extrairTextoDocumento } from '@/lib/extrairTextoDocumento';
import {
  parseBoletoDocumento,
  parseComprovanteDocumento,
  parseCotacaoPdfDocumento,
  parseListaFotoDocumento,
  parsePedidoCompraDocumento,
} from '@/lib/ocrDocumentParser';

export const OCR_IMPORT_TIPOS = {
  PEDIDO_COMPRA: 'pedido_compra',
  COTACAO_PDF: 'cotacao_pdf',
  LISTA_FOTO: 'lista_foto',
  BOLETO_AGEFIN: 'boleto_agefin',
  COMPROVANTE: 'comprovante',
};

const PARSERS = {
  [OCR_IMPORT_TIPOS.PEDIDO_COMPRA]: parsePedidoCompraDocumento,
  [OCR_IMPORT_TIPOS.COTACAO_PDF]: parseCotacaoPdfDocumento,
  [OCR_IMPORT_TIPOS.LISTA_FOTO]: parseListaFotoDocumento,
  [OCR_IMPORT_TIPOS.BOLETO_AGEFIN]: parseBoletoDocumento,
  [OCR_IMPORT_TIPOS.COMPROVANTE]: parseComprovanteDocumento,
};

/**
 * @param {object} opts
 * @param {File|Blob} opts.file
 * @param {string} opts.tipo — um de OCR_IMPORT_TIPOS
 */
export async function processarImportOcrLocal({ file, tipo }) {
  if (!file) {
    throw new Error('Arquivo em falta para leitura OCR.');
  }
  const parser = PARSERS[tipo];
  if (!parser) {
    throw new Error(`Tipo de importação OCR desconhecido: ${tipo}`);
  }

  const { texto, origem } = await extrairTextoDocumento(file);
  if (!String(texto || '').trim()) {
    throw new Error(
      'Não foi possível ler texto do documento. Verifique se a imagem está legível ou preencha manualmente.',
    );
  }

  const dados = parser(texto);
  if (dados == null) {
    throw new Error(
      'Texto lido, mas não foi possível interpretar o documento. Preencha manualmente na revisão.',
    );
  }
  return {
    dados,
    texto,
    origem,
    modo: 'ocr_local',
  };
}
