import { loadPdfJsBrowser } from '@/lib/loadPdfJsBrowser';

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
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
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

function addSectionHeaderPage(doc, sectionTitle) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.addPage();
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text(sectionTitle, 14, 22);
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(14, 26, pageWidth - 14, 26);
  doc.setFont(undefined, 'normal');
}

/**
 * Embute anexos (imagens/PDF) num documento jsPDF existente.
 * @param {import('jspdf').jsPDF} doc
 * @param {Array} anexos
 * @param {{ sectionTitle?: string, skipSectionHeader?: boolean }} [options]
 * @returns {Promise<number>} páginas adicionadas
 */
export async function appendAnexosToPdfDoc(doc, anexos = [], options = {}) {
  const { sectionTitle, skipSectionHeader = false } = options;
  const list = (anexos || []).filter((a) => a?.url_drive);
  if (list.length === 0) return 0;

  let pagesAdded = 0;

  if (sectionTitle && !skipSectionHeader) {
    addSectionHeaderPage(doc, sectionTitle);
    pagesAdded += 1;
  }

  for (const anexo of list) {
    const isImage = anexo.mime_type?.startsWith('image/');
    const isPdf = anexo.mime_type?.includes('pdf');
    if (!isImage && !isPdf) continue;

    const tipo = anexo.tipo_documento ? `${anexo.tipo_documento} — ` : '';
    const nome = anexo.nome_arquivo || 'Anexo';

    try {
      if (isImage) {
        doc.addPage();
        pagesAdded += 1;
        await addImagePage(doc, anexo.url_drive, anexo.mime_type, `${tipo}${nome}`);
        continue;
      }

      const pages = await renderPdfPagesToImages(anexo.url_drive);
      for (let index = 0; index < pages.length; index += 1) {
        doc.addPage();
        pagesAdded += 1;
        const suffix = pages.length > 1 ? ` · pág. ${index + 1}` : '';
        await addImagePage(doc, pages[index], 'image/jpeg', `${tipo}${nome}${suffix}`);
      }
    } catch {
      doc.addPage();
      pagesAdded += 1;
      addTextFallbackPage(
        doc,
        `${tipo}${nome}`,
        'Não foi possível renderizar este arquivo dentro do PDF final. Abra o anexo original para visualizar o conteúdo completo.',
      );
    }
  }

  return pagesAdded;
}
