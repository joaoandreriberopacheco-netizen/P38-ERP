import { normalizarArquivoParaImportBoleto } from '@/lib/extrairTextoPdfBrowser';
import { OCR_IMPORT_TIPOS, processarImportOcrEmSerie } from '@/lib/ocrImportPipeline';
import { parseValorMonetarioTexto } from '@/lib/ocrTextUtils';

/** Extrai número monetário de texto livre (ex.: "150,90", "R$ 1.234,56"). */
export { parseValorMonetarioTexto };

function extrairDescricaoDeTexto(texto) {
  const linhas = String(texto || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const chave = linhas.find((l) =>
    /favorecido|benefici[aá]rio|destinat[aá]rio|para:|recebedor/i.test(l)
  );
  if (chave) return chave.replace(/^[^:]+:\s*/i, '').slice(0, 120);
  return linhas.find((l) => l.length > 4 && !/^r\$/i.test(l))?.slice(0, 120) || null;
}

export function extrairDadosComprovanteDeTexto(texto) {
  const valor = parseValorMonetarioTexto(texto);
  const descricao = extrairDescricaoDeTexto(texto);
  if (!valor && !descricao) return null;
  return { valor, descricao, data_pagamento: null, origem: 'texto' };
}

async function extrairDadosComprovanteViaOcr(file) {
  const f = await normalizarArquivoParaImportBoleto(file);
  const { dados, modo } = await processarImportOcrEmSerie({
    file: f,
    tipo: OCR_IMPORT_TIPOS.COMPROVANTE,
  });
  if (!dados) return null;
  return {
    valor: dados.valor,
    descricao: dados.descricao,
    data_pagamento: dados.data_pagamento,
    origem: modo === 'ocr_local+groq' ? 'groq_fallback' : 'ocr_local',
  };
}

/**
 * Tenta extrair valor/descrição de comprovante (texto colado ou arquivo imagem/PDF).
 * @returns {Promise<{ valor: number|null, descricao: string|null, data_pagamento: string|null, origem: string }|null>}
 */
export async function extrairDadosComprovante(arquivoEntry) {
  if (!arquivoEntry) return null;

  if (arquivoEntry.texto) {
    return extrairDadosComprovanteDeTexto(arquivoEntry.texto);
  }

  const file = arquivoEntry.file;
  if (!file) return null;

  try {
    const ocr = await extrairDadosComprovanteViaOcr(file);
    if (ocr?.valor || ocr?.descricao) return ocr;
  } catch (e) {
    console.warn('[Torre] leitura do comprovante falhou:', e);
  }

  return null;
}

export function formatarValorBRL(valor) {
  if (valor == null || !Number.isFinite(Number(valor))) return '';
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
