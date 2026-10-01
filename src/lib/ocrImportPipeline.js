/**
 * Pipeline de importação em série:
 * ① OCR local (pdf.js / Paddle) — só extrai texto, sem depender de layout
 * ② Groq/Llama (leitura flexível, 1 req/doc) — pedido/cotação/lista
 * ③ Parser por regras — fallback offline / boleto / comprovante
 */

import { extrairTextoDocumento } from '@/lib/extrairTextoDocumento';
import {
  parseBoletoDocumento,
  parseComprovanteDocumento,
  parseCotacaoPdfDocumento,
  parseListaFotoDocumento,
  parsePedidoCompraDocumento,
} from '@/lib/ocrDocumentParser';
import {
  estruturarDocumentoOcrNaNuvem,
  isOcrCloudFallbackEnabled,
  isOcrGroqPrimaryEnabled,
} from '@/lib/ocrCloudFallback';
import { normalizarRespostaGroq } from '@/lib/ocrGroqNormalize';
import {
  isArquivoPlanilhaPedido,
  parsePlanilhaPedidoFlexFromFile,
  planilhaPedidoParaTexto,
} from '@/lib/importarPlanilhaPedidoFlex';

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

/** Tipos em que a IA estrutura o JSON antes do parser por layout (pedido/cotação/lista). */
const TIPOS_LEITURA_FLEXIVEL = new Set([
  OCR_IMPORT_TIPOS.PEDIDO_COMPRA,
  OCR_IMPORT_TIPOS.COTACAO_PDF,
  OCR_IMPORT_TIPOS.LISTA_FOTO,
]);

export function usaLeituraFlexivelGroq(tipo) {
  return TIPOS_LEITURA_FLEXIVEL.has(tipo) && isOcrGroqPrimaryEnabled();
}

function itemPedidoMinimoValido(item) {
  const descricao = String(item?.descricao || '').trim();
  const qtd = Number(item?.quantidade);
  const preco = Number(item?.preco_unitario);
  if (!descricao || descricao.length < 3) return false;
  if (!Number.isFinite(qtd) || qtd <= 0) return false;
  if (!Number.isFinite(preco) || preco <= 0) return false;
  return true;
}

/**
 * Parser local devolveu poucos itens face ao documento — sinal para tentar IA.
 * Não usar para descartar resposta da IA (cotações têm muitas colunas R$/imposto por linha).
 */
export function pedidoExtracaoPareceIncompleta(texto, dados) {
  const itens = Array.isArray(dados?.itens) ? dados.itens : [];
  const validos = itens.filter(itemPedidoMinimoValido);
  if (!validos.length) return true;

  const flat = String(texto || '').replace(/\s+/g, ' ');
  if (flat.length > 1200 && validos.length < 2) return true;
  if (validos.length < itens.length * 0.4 && itens.length >= 3) return true;

  return false;
}

/** Resultado da IA ainda insuficiente? (só valida itens — sem heurística de “retalho” por fornecedor). */
export function precisaFallbackNuvemIa(dados, tipo) {
  if (!dados) return true;
  switch (tipo) {
    case OCR_IMPORT_TIPOS.PEDIDO_COMPRA:
    case OCR_IMPORT_TIPOS.COTACAO_PDF:
    case OCR_IMPORT_TIPOS.LISTA_FOTO: {
      const itens = Array.isArray(dados.itens) ? dados.itens : [];
      if (!itens.length) return true;
      if (tipo === OCR_IMPORT_TIPOS.PEDIDO_COMPRA) {
        return itens.filter(itemPedidoMinimoValido).length === 0;
      }
      return false;
    }
    default:
      return precisaFallbackNuvem(dados, tipo, '');
  }
}

/** Indica se o passo na nuvem deve tentar complementar (resultado do parser local ainda incompleto). */
export function precisaFallbackNuvem(dados, tipo, texto = '') {
  if (!dados) return true;
  switch (tipo) {
    case OCR_IMPORT_TIPOS.PEDIDO_COMPRA:
    case OCR_IMPORT_TIPOS.COTACAO_PDF:
    case OCR_IMPORT_TIPOS.LISTA_FOTO:
      if (!Array.isArray(dados.itens) || dados.itens.length === 0) return true;
      if (tipo === OCR_IMPORT_TIPOS.PEDIDO_COMPRA && pedidoExtracaoPareceIncompleta(texto, dados)) {
        return true;
      }
      return false;
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

async function extrairTextoLocal(file) {
  const { texto, origem } = await extrairTextoDocumento(file);
  if (!String(texto || '').trim()) {
    throw new Error(
      'Não foi possível ler texto do documento. Verifique se a imagem está legível ou preencha manualmente.',
    );
  }
  return { texto, origem };
}

function parsearComRegrasLocais(texto, tipo) {
  const parser = PARSERS[tipo];
  if (!parser) {
    throw new Error(`Tipo de importação OCR desconhecido: ${tipo}`);
  }
  return parser(texto);
}

async function estruturarComGroq(texto, tipo, onProgress) {
  onProgress?.('Interpretando documento (IA flexível)');
  const { dados: raw, model } = await estruturarDocumentoOcrNaNuvem({ texto, tipo });
  const dados = normalizarRespostaGroq(tipo, raw);
  if (!dados || precisaFallbackNuvemIa(dados, tipo)) return null;
  return { dados, model };
}

function resultadoBase({ dados, texto, origem, modo, etapas, extras = {} }) {
  return { dados, texto, origem, modo, etapas, ...extras };
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

  const { texto, origem } = await extrairTextoLocal(file);
  const dados = parsearComRegrasLocais(texto, tipo);

  if (dados == null && tipo === OCR_IMPORT_TIPOS.COMPROVANTE) {
    return resultadoBase({
      dados: null,
      texto,
      origem,
      modo: 'ocr_local',
      etapas: ['ocr_local', 'parser_local'],
    });
  }
  if (dados == null) {
    throw new Error(
      'Texto lido, mas não foi possível interpretar o documento. Preencha manualmente na revisão.',
    );
  }
  return resultadoBase({
    dados,
    texto,
    origem,
    modo: 'ocr_local',
    etapas: ['ocr_local', 'parser_local'],
  });
}

/**
 * Cadeia completa: texto local → IA flexível (pedido/cotação) → parser regras → IA fallback.
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
  if (!file) {
    throw new Error('Arquivo em falta para leitura OCR.');
  }

  onProgress?.('Lendo documento (local)');

  let textoPlanilhaPreload = '';
  if (isArquivoPlanilhaPedido(file)) {
    onProgress?.('Interpretando planilha (colunas flexíveis)');
    try {
      const flex = await parsePlanilhaPedidoFlexFromFile(file);
      textoPlanilhaPreload = await planilhaPedidoParaTexto(file);
      if (flex?.itens?.length) {
        return resultadoBase({
          dados: flex,
          texto: textoPlanilhaPreload,
          origem: 'planilha_flex',
          modo: 'planilha_colunas',
          etapas: ['planilha_flex'],
        });
      }
    } catch (err) {
      console.warn('[OCR série] planilha flex:', err);
    }
  }

  const { texto, origem } = textoPlanilhaPreload
    ? { texto: textoPlanilhaPreload, origem: 'planilha_tsv' }
    : await extrairTextoLocal(file);

  const leituraFlexivel = usaLeituraFlexivelGroq(tipo);

  let groqPrimarioErro = '';

  if (leituraFlexivel && cloudFallback) {
    try {
      const groq = await estruturarComGroq(texto, tipo, onProgress);
      if (groq) {
        return resultadoBase({
          dados: groq.dados,
          texto,
          origem,
          modo: 'ocr_local+groq_primario',
          modeloNuvem: groq.model,
          etapas: ['ocr_local', 'groq_primario'],
        });
      }
      groqPrimarioErro = 'IA não devolveu itens suficientes.';
    } catch (err) {
      groqPrimarioErro = err?.message || 'IA indisponível.';
      console.warn('[OCR série] leitura flexível Groq:', err);
    }
    onProgress?.('IA sem itens — tentando interpretação local');
  }

  let dadosLocal = null;
  try {
    dadosLocal = parsearComRegrasLocais(texto, tipo);
  } catch (err) {
    if (!cloudFallback || leituraFlexivel) {
      throw err;
    }
    console.warn('[OCR série] parser local:', err);
  }

  if (dadosLocal != null && !precisaFallbackNuvem(dadosLocal, tipo, texto)) {
    return resultadoBase({
      dados: dadosLocal,
      texto,
      origem,
      modo: leituraFlexivel ? 'ocr_local+parser_fallback' : 'ocr_local',
      etapas: leituraFlexivel
        ? ['ocr_local', 'groq_primario_vazio', 'parser_local']
        : ['ocr_local', 'parser_local'],
    });
  }

  if (
    cloudFallback
    && leituraFlexivel
    && tipo === OCR_IMPORT_TIPOS.PEDIDO_COMPRA
    && dadosLocal != null
    && pedidoExtracaoPareceIncompleta(texto, dadosLocal)
  ) {
    onProgress?.('Resultado local incompleto — reforçando com IA');
    try {
      const groq = await estruturarComGroq(texto, tipo, onProgress);
      if (groq && !precisaFallbackNuvem(groq.dados, tipo, texto)) {
        return resultadoBase({
          dados: groq.dados,
          texto,
          origem,
          modo: 'ocr_local+groq_reforco',
          modeloNuvem: groq.model,
          etapas: ['ocr_local', 'parser_local_parcial', 'groq_reforco'],
        });
      }
    } catch (err) {
      console.warn('[OCR série] reforço Groq:', err);
    }
  }

  if (tipo === OCR_IMPORT_TIPOS.COMPROVANTE && dadosLocal == null) {
    return resultadoBase({
      dados: null,
      texto,
      origem,
      modo: 'ocr_local',
      etapas: ['ocr_local', 'parser_local'],
    });
  }

  if (!cloudFallback) {
    if (dadosLocal == null) {
      throw new Error(
        'Texto lido, mas não foi possível interpretar o documento. Preencha manualmente na revisão.',
      );
    }
    return resultadoBase({
      dados: dadosLocal,
      texto,
      origem,
      modo: 'ocr_local',
      etapas: ['ocr_local', 'parser_local'],
      fallbackIgnorado: 'desativado',
    });
  }

  if (!leituraFlexivel) {
    onProgress?.('Complementando com IA na nuvem (grátis)');
    try {
      const groq = await estruturarComGroq(texto, tipo, onProgress);
      if (groq) {
        return resultadoBase({
          dados: groq.dados,
          texto,
          origem,
          modo: 'ocr_local+groq',
          modeloNuvem: groq.model,
          etapas: ['ocr_local', 'parser_local', 'groq'],
        });
      }
      if (dadosLocal != null) {
        return resultadoBase({
          dados: dadosLocal,
          texto,
          origem,
          modo: 'ocr_local',
          etapas: ['ocr_local', 'parser_local', 'groq_sem_resultado'],
          fallbackErro: 'IA na nuvem não identificou itens suficientes.',
        });
      }
    } catch (err) {
      console.warn('[OCR série] fallback nuvem:', err);
      if (dadosLocal != null) {
        return resultadoBase({
          dados: dadosLocal,
          texto,
          origem,
          modo: 'ocr_local',
          etapas: ['ocr_local', 'parser_local', 'groq_falhou'],
          fallbackErro: err?.message || 'Fallback na nuvem falhou.',
        });
      }
      throw err;
    }
  }

  if (dadosLocal != null && !precisaFallbackNuvem(dadosLocal, tipo)) {
    return resultadoBase({
      dados: dadosLocal,
      texto,
      origem,
      modo: 'ocr_local+parser_fallback',
      etapas: ['ocr_local', 'groq_primario_vazio', 'parser_local'],
    });
  }

  if (dadosLocal != null) {
    return resultadoBase({
      dados: dadosLocal,
      texto,
      origem,
      modo: 'ocr_local+parser_fallback',
      etapas: ['ocr_local', 'groq_primario_vazio', 'parser_local'],
      fallbackErro:
        groqPrimarioErro || 'Não foi possível identificar itens. Revise manualmente na tela seguinte.',
    });
  }

  const detalheGroq = groqPrimarioErro ? ` ${groqPrimarioErro}` : '';
  throw new Error(
    `Texto lido, mas não foi possível interpretar o documento.${detalheGroq} Preencha manualmente na revisão.`,
  );
}
