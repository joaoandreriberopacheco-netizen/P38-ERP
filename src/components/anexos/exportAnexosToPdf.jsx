import { loadPdfJsBrowser } from '@/lib/loadPdfJsBrowser';
import { loadJsPDF } from '@/lib/lazyPdfLibs';

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function renderPdfPagesToImages(fileUrl) {
  const pdfjsLib = await loadPdfJsBrowser();

  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error('Falha ao baixar o PDF');
  }

  const bytes = await response.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.6 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport }).promise;
    pages.push(canvas.toDataURL('image/jpeg', 0.92));
  }

  return pages;
}

function getExtensionFromMime(mimeType = '') {
  if (mimeType.includes('png')) return 'PNG';
  return 'JPEG';
}

function addImagePage(doc, imageSource, mimeType = 'image/jpeg', title = 'Anexo') {
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 12;
  doc.setFontSize(11);
  doc.text(title, margin, 12);

  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - 24;
      const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
      const width = img.width * ratio;
      const height = img.height * ratio;
      const x = (pageWidth - width) / 2;
      const y = 18 + (maxHeight - height) / 2;
      doc.addImage(imageSource, getExtensionFromMime(mimeType), x, y, width, height);
      resolve();
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem do anexo'));
    img.src = imageSource;
  });
}

function addTextFallbackPage(doc, title, message) {
  doc.setFontSize(11);
  doc.text(title || 'Anexo', 14, 14);
  doc.setFontSize(10);
  doc.text(message, 14, 28, { maxWidth: 180 });
}

export default async function exportAnexosToPdf(anexos = []) {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  let hasPage = false;

  for (const anexo of anexos) {
    if (!anexo?.url_drive) continue;

    const isImage = anexo.mime_type?.startsWith('image/');
    const isPdf = anexo.mime_type?.includes('pdf');
    if (!isImage && !isPdf) continue;

    try {
      if (isImage) {
        if (hasPage) doc.addPage();
        hasPage = true;
        await addImagePage(doc, anexo.url_drive, anexo.mime_type, anexo.nome_arquivo || 'Imagem');
        continue;
      }

      const pages = await renderPdfPagesToImages(anexo.url_drive);
      for (let index = 0; index < pages.length; index += 1) {
        if (hasPage) doc.addPage();
        hasPage = true;
        await addImagePage(doc, pages[index], 'image/jpeg', `${anexo.nome_arquivo || 'PDF'} · pág. ${index + 1}`);
      }
    } catch {
      if (hasPage) doc.addPage();
      hasPage = true;
      addTextFallbackPage(doc, anexo.nome_arquivo || 'Anexo', 'Não foi possível renderizar este arquivo dentro do PDF final. Abra o anexo original para visualizar o conteúdo completo.');
    }
  }

  if (!hasPage) {
    doc.text('Nenhum anexo compatível para exportação.', 14, 20);
  }

  doc.save('anexos.pdf');
}