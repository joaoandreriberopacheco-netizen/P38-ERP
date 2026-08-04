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

function addImagePage(doc, imageSource, mimeType = 'image/jpeg', title = 'Anexo', layout = {}) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = layout.margin ?? 12;
  const titleY = layout.titleY ?? 16;
  const contentTop = layout.contentTop ?? 20;
  const contentBottom = layout.contentBottom ?? pageHeight - 10;

  doc.setFontSize(8.5);
  doc.text(title, margin, titleY);

  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = Math.max(20, contentBottom - contentTop);
      const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
      const width = img.width * ratio;
      const height = img.height * ratio;
      const x = (pageWidth - width) / 2;
      const y = contentTop + (maxHeight - height) / 2;
      doc.addImage(imageSource, getExtensionFromMime(mimeType), x, y, width, height);
      resolve();
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem do anexo'));
    img.src = imageSource;
  });
}

function addTextFallbackPage(doc, title, message, layout = {}) {
  const margin = layout.margin ?? 14;
  const titleY = layout.titleY ?? 16;
  doc.setFontSize(9);
  doc.text(title || 'Anexo', margin, titleY);
  doc.setFontSize(8.5);
  doc.text(message, margin, titleY + 10, { maxWidth: 180 });
}

/**
 * Embute anexos (imagens/PDF) num documento jsPDF existente.
 * @param {import('jspdf').jsPDF} doc
 * @param {Array} anexos
 * @param {{
 *   sectionPrefix?: string,
 *   layout?: { margin?: number, titleY?: number, contentTop?: number, contentBottom?: number },
 *   onPageAdded?: (pageNumber: number) => void,
 * }} [options]
 * @returns {Promise<number>} páginas adicionadas
 */
export async function appendAnexosToPdfDoc(doc, anexos = [], options = {}) {
  const { sectionPrefix = 'Anexos', layout = {}, onPageAdded } = options;
  const list = (anexos || []).filter((a) => a?.url_drive);
  if (list.length === 0) return 0;

  let pagesAdded = 0;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageLayout = {
    margin: layout.margin ?? 12,
    titleY: layout.titleY ?? 16,
    contentTop: layout.contentTop ?? 20,
    contentBottom: layout.contentBottom ?? pageHeight - 12,
  };

  const registerPage = () => {
    pagesAdded += 1;
    onPageAdded?.(doc.internal.getNumberOfPages());
  };

  for (const anexo of list) {
    const isImage = anexo.mime_type?.startsWith('image/');
    const isPdf = anexo.mime_type?.includes('pdf');
    if (!isImage && !isPdf) continue;

    const tipo = anexo.tipo_documento || 'Documento';
    const nome = anexo.nome_arquivo || 'Anexo';
    const pageTitle = `${sectionPrefix} · ${tipo} — ${nome}`;

    try {
      if (isImage) {
        doc.addPage();
        registerPage();
        await addImagePage(doc, anexo.url_drive, anexo.mime_type, pageTitle, pageLayout);
        continue;
      }

      const pages = await renderPdfPagesToImages(anexo.url_drive);
      for (let index = 0; index < pages.length; index += 1) {
        doc.addPage();
        registerPage();
        const suffix = pages.length > 1 ? ` (pág. ${index + 1}/${pages.length})` : '';
        await addImagePage(doc, pages[index], 'image/jpeg', `${pageTitle}${suffix}`, pageLayout);
      }
    } catch {
      doc.addPage();
      registerPage();
      addTextFallbackPage(
        doc,
        pageTitle,
        'Não foi possível renderizar este arquivo dentro do PDF final. Abra o anexo original para visualizar o conteúdo completo.',
        pageLayout,
      );
    }
  }

  return pagesAdded;
}
