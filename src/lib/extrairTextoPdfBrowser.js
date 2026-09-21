/**
 * Utilitários para PDF no importador AGEFIN (Torre / Contas a pagar).
 *
 * Extração de texto: pdf.js (PDF digital) + PaddleOCR (scan/imagem).
 * Ver `extrairTextoDocumento.js`.
 */

import { extrairTextoDocumento } from '@/lib/extrairTextoDocumento';

/**
 * Detecta assinatura %PDF- no início do blob (partilha Web manda às vezes sem extensão / octet-stream).
 */
export async function blobParecePdf(blob) {
  if (!blob || typeof blob.slice !== 'function') return false;
  try {
    const buf = await blob.slice(0, 5).arrayBuffer();
    const u = new Uint8Array(buf);
    return u[0] === 0x25 && u[1] === 0x50 && u[2] === 0x44 && u[3] === 0x46;
  } catch {
    return false;
  }
}

/**
 * Garante `File` com nome `.pdf` e MIME `application/pdf` quando o conteúdo é PDF
 * (ex.: Android → URI sem extensão, `application/octet-stream`, importadores de compras).
 */
export async function normalizarArquivoParaImportBoleto(file) {
  if (!file) return file;
  const name = String(file.name || '').toLowerCase();
  const type = String(file.type || '').toLowerCase();
  if (name.endsWith('.pdf') || type === 'application/pdf') {
    if (file instanceof File && type !== 'application/pdf' && name.endsWith('.pdf')) {
      return new File([file], file.name, { type: 'application/pdf', lastModified: file.lastModified });
    }
    return file;
  }
  if (await blobParecePdf(file)) {
    const raw = String(file.name || 'boleto').replace(/[/\\]/g, '-');
    const base = raw.includes('.') ? raw.replace(/\.[^.]+$/, '') : raw;
    const safe = `${base || 'boleto'}.pdf`;
    return new File([file], safe, {
      type: 'application/pdf',
      lastModified: file.lastModified || Date.now(),
    });
  }
  return file;
}

/**
 * Extrai texto do PDF/imagem no browser (pdf.js + PaddleOCR).
 * @param {File|Blob} file
 * @returns {Promise<string>}
 */
export async function extrairTextoPdfBrowser(file) {
  const { texto } = await extrairTextoDocumento(file);
  return texto;
}
