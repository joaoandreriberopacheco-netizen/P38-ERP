/**
 * Pipeline de importação em série:
 * ① OCR local (pdf.js / Paddle) → ② parser regras → ③ Groq/Llama (fallback, 1 req/doc)
 */

import { extrairTextoDocumento } from '@/lib/extrairTextoDocumento';
import {
  parseBoletoDocumento,
  parseComprovanteDocumento,
  parseCotacaoPdfDocumento,
  parseListaFotoDocumento,
  parsePedidoCompraDocumento,
} from '@/lib/ocrDocumentParser';
import { estruturarDocumentoOcrNaNuvem, isOcrCloudFallbackEnabled } from '@/lib/ocrCloudFallback';
import { normalizarRespostaGroq } from '@/lib/ocrGroqNormalize';

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

/** Indica se o passo ③ (nuvem) deve tentar complementar. */
export function precisaFallbackNuvem(dados, tipo) {
  if (!dados) return true;
  switch (tipo) {
    case OCR_IMPORT_TIPOS.PEDIDO_COMPRA:
    case OCR_IMPORT_TIPOS.COTACAO_PDF:
    case OCR_IMPORT_TIPOS.LISTA_FOTO:
      return !Array.isArray(dados.itens) || dados.itens.length === 0;
    case OCR_IMPORT_TIPOS.COMPROVANTE:
      return dados.valor == null && !dados.descricao;
    case OCR_IMPORT_TIPOS.BOLETO_AGEFIN:
      return (
        dados.valor_pagamento == null
        && !dados.linha_digitavel
        && !dados.codigo_pix_copia_cola
      );
    default:
      return false;
  }
}

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
  if (dados == null && tipo === OCR_IMPORT_TIPOS.COMPROVANTE) {
    return { dados: null, texto, origem, modo: 'ocr_local' };
  }
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
    etapas: ['ocr_local', 'parser_local'],
  };
}

/**
 * Cadeia completa: local → parser → Groq (se necessário).
 * @param {object} opts
 * @param {(msg: string) => void} [opts.onProgress]
 * @param {boolean} [opts.cloudFallback]
 */
export async function processarImportOcrEmSerie({
  file,
  tipo,
  onProgress,
  cloudFallback = isOcrCloudFallbackEnabled(),
}) {
  onProgress?.('Lendo documento (local)');
  const local = await processarImportOcrLocal({ file, tipo });

  if (!precisaFallbackNuvem(local.dados, tipo)) {
    return local;
  }

  if (!cloudFallback) {
    return { ...local, fallbackIgnorado: 'desativado' };
  }

  if (!String(local.texto || '').trim()) {
    return { ...local, fallbackIgnorado: 'texto_vazio' };
  }

  onProgress?.('Complementando com IA na nuvem (grátis)');
  try {
    const { dados: raw, model } = await estruturarDocumentoOcrNaNuvem({
      texto: local.texto,
      tipo,
    });
    const dados = normalizarRespostaGroq(tipo, raw);
    if (dados && !precisaFallbackNuvem(dados, tipo)) {
      return {
        ...local,
        dados,
        modo: 'ocr_local+groq',
        modeloNuvem: model,
        etapas: ['ocr_local', 'parser_local', 'groq'],
      };
    }
    return {
      ...local,
      fallbackErro: 'IA na nuvem não identificou itens suficientes.',
      etapas: ['ocr_local', 'parser_local', 'groq_sem_resultado'],
    };
  } catch (err) {
    console.warn('[OCR série] fallback nuvem:', err);
    return {
      ...local,
      fallbackErro: err?.message || 'Fallback na nuvem falhou.',
      etapas: ['ocr_local', 'parser_local', 'groq_falhou'],
    };
  }
}
