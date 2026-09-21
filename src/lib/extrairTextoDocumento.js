/**
 * Extração de texto de documentos no browser:
 * 1. PDF digital → pdf.js (grátis, rápido)
 * 2. PDF scan / imagem → PaddleOCR (local, sem Gemini visão)
 */

import { loadPdfJsBrowser } from '@/lib/loadPdfJsBrowser';
import { reconhecerTextoImagem } from '@/lib/paddleOcrBrowser';

const MIN_TEXTO_DIGITAL = 80;
const MAX_PAGINAS_OCR = 8;
const PDF_RENDER_SCALE = 2;

function isImageFile(file) {
  const type = String(file?.type || '').toLowerCase();
  if (type.startsWith('image/')) return true;
  const name = String(file?.name || '').toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.test(name);
}

async function blobParecePdf(blob) {
  if (!blob || typeof blob.slice !== 'function') return false;
  try {
    const buf = await blob.slice(0, 5).arrayBuffer();
    const u = new Uint8Array(buf);
    return u[0] === 0x25 && u[1] === 0x50 && u[2] === 0x44 && u[3] === 0x46;
  } catch {
    return false;
  }
}

function isPdfFile(file) {
  const type = String(file?.type || '').toLowerCase();
  const name = String(file?.name || '').toLowerCase();
  return type === 'application/pdf' || name.endsWith('.pdf');
}

async function renderPdfPageToCanvas(page, scale = PDF_RENDER_SCALE) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível para renderizar PDF.');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

async function extrairTextoDigitalPdf(pdf) {
  const partes = [];
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const linha = content.items
      .map((item) => String(item.str || '').trim())
      .filter(Boolean)
      .join(' ');
    if (linha) partes.push(linha);
  }
  return partes.join('\n').trim();
}

async function extrairTextoPdfComPaddle(file) {
  const pdfjsLib = await loadPdfJsBrowser();
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;

  const textoDigital = await extrairTextoDigitalPdf(pdf);
  if (textoDigital.replace(/\s+/g, ' ').trim().length >= MIN_TEXTO_DIGITAL) {
    return { texto: textoDigital, origem: 'pdf_digital' };
  }

  const paginas = Math.min(pdf.numPages, MAX_PAGINAS_OCR);
  const partes = [];
  for (let i = 1; i <= paginas; i += 1) {
    const page = await pdf.getPage(i);
    const canvas = await renderPdfPageToCanvas(page);
    const paginaTexto = await reconhecerTextoImagem(canvas);
    if (paginaTexto) partes.push(paginaTexto);
  }

  const texto = partes.join('\n\n').trim();
  return {
    texto,
    origem: texto ? 'paddle_pdf_scan' : 'vazio',
  };
}

/**
 * @param {File|Blob} file
 * @returns {Promise<{ texto: string, origem: string }>}
 */
export async function extrairTextoDocumento(file) {
  if (!file) return { texto: '', origem: 'vazio' };

  const parecePdf = isPdfFile(file) || await blobParecePdf(file);
  if (parecePdf) {
    return extrairTextoPdfComPaddle(file);
  }

  if (isImageFile(file)) {
    const texto = await reconhecerTextoImagem(file);
    return { texto, origem: texto ? 'paddle_imagem' : 'vazio' };
  }

  return { texto: '', origem: 'tipo_desconhecido' };
}

/**
 * Compat: devolve só a string (usado por fluxos legados).
 * @param {File|Blob} file
 * @returns {Promise<string>}
 */
export async function extrairTextoPdfBrowser(file) {
  const { texto } = await extrairTextoDocumento(file);
  return texto;
}
