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

function measureImageLayout(imageSource, mimeType, layout) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const pageWidth = layout.pageWidth;
      const maxWidth = pageWidth - layout.margin * 2;
      const maxHeight = Math.max(20, layout.contentBottom - layout.contentTop);
      const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
      resolve({
        width: img.width * ratio,
        height: img.height * ratio,
        mimeType: getExtensionFromMime(mimeType),
        source: imageSource,
      });
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem do anexo'));
    img.src = imageSource;
  });
}

function drawImageBlock(doc, measured, layout) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const x = (pageWidth - measured.width) / 2;
  const y = layout.contentTop + Math.max(0, (layout.contentBottom - layout.contentTop - measured.height) / 2);
  doc.addImage(measured.source, measured.mimeType, x, y, measured.width, measured.height);
  return y + measured.height;
}

function addTextFallbackPage(doc, title, message, layout = {}) {
  const margin = layout.margin ?? 14;
  const titleY = layout.titleY ?? 16;
  doc.setFontSize(9);
  doc.text(title || 'Anexo', margin, titleY);
  doc.setFontSize(8.5);
  doc.text(message, margin, titleY + 10, { maxWidth: 180 });
  return titleY + 18;
}

/**
 * Embute anexos (imagens/PDF) num documento jsPDF existente.
 * @param {import('jspdf').jsPDF} doc
 * @param {Array} anexos
 * @param {{
 *   sectionPrefix?: string,
 *   layout?: { margin?: number, titleY?: number, contentTop?: number, contentBottom?: number },
 *   flow?: { initialY?: number, gapBefore?: number, newPageY?: number, bottomPad?: number },
 *   onPageAdded?: (pageNumber: number) => void,
 * }} [options]
 * @returns {Promise<{ pagesAdded: number, endPage: number, endY: number }>}
 */
export async function appendAnexosToPdfDoc(doc, anexos = [], options = {}) {
  const { sectionPrefix = 'Anexos', layout = {}, flow, onPageAdded, useFirstPage = false } = options;
  const list = (anexos || []).filter((a) => a?.url_drive);
  if (list.length === 0) {
    return {
      pagesAdded: 0,
      endPage: doc.internal.getNumberOfPages(),
      endY: flow?.initialY ?? layout.contentTop ?? 20,
    };
  }

  let pagesAdded = 0;
  let cursorY = typeof flow?.initialY === 'number' ? flow.initialY : null;
  let isFirstBlock = true;

  const registerPage = () => {
    pagesAdded += 1;
    onPageAdded?.(doc.internal.getNumberOfPages());
  };

  const beginDedicatedPage = (title, margin, titleY, contentTop, contentBottom) => {
    if (!(useFirstPage && pagesAdded === 0 && doc.internal.getNumberOfPages() === 1)) {
      doc.addPage();
      registerPage();
    } else if (useFirstPage && pagesAdded === 0) {
      pagesAdded += 1;
    }
    doc.setFontSize(7.5);
    doc.text(title, margin, titleY);
    return { titleY, contentTop, contentBottom };
  };

  for (const anexo of list) {
    const isImage = anexo.mime_type?.startsWith('image/');
    const isPdf = anexo.mime_type?.includes('pdf');
    if (!isImage && !isPdf) continue;

    const tipo = anexo.tipo_documento || 'Documento';
    const nome = anexo.nome_arquivo || 'Anexo';
    const pageTitle = `${sectionPrefix} · ${tipo} — ${nome}`;

    try {
      const blocks = isImage
        ? [{ source: anexo.url_drive, mime: anexo.mime_type, title: pageTitle }]
        : (await renderPdfPagesToImages(anexo.url_drive)).map((source, index, arr) => ({
            source,
            mime: 'image/jpeg',
            title: arr.length > 1 ? `${pageTitle} (pág. ${index + 1}/${arr.length})` : pageTitle,
          }));

      for (const block of blocks) {
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = layout.margin ?? 12;
        const bottomPad = flow?.bottomPad ?? 12;
        const contentBottom = layout.contentBottom ?? pageHeight - bottomPad;
        const newPageY = flow?.newPageY ?? 16;
        const gapBefore = isFirstBlock && flow ? (flow.gapBefore ?? 3) : 0;
        let placedInline = false;

        if (cursorY != null) {
          const candidateTitleY = cursorY + gapBefore;
          const candidateContentTop = candidateTitleY + 4.5;
          const availableHeight = contentBottom - candidateContentTop;

          if (availableHeight >= 35) {
            try {
              const measured = await measureImageLayout(block.source, block.mime, {
                pageWidth,
                margin,
                contentTop: candidateContentTop,
                contentBottom,
              });

              if (measured.height <= availableHeight) {
                doc.setFontSize(7.5);
                doc.text(block.title, margin, candidateTitleY);
                const endY = drawImageBlock(doc, measured, {
                  contentTop: candidateContentTop,
                  contentBottom,
                });
                cursorY = endY + 2;
                placedInline = true;
                isFirstBlock = false;
                continue;
              }
            } catch {
              // segue para página dedicada
            }
          }
        }

        const titleY = newPageY + 1;
        const contentTop = titleY + 4.5;
        beginDedicatedPage(block.title, margin, titleY, contentTop, contentBottom);
        cursorY = null;

        const measured = await measureImageLayout(block.source, block.mime, {
          pageWidth,
          margin,
          contentTop,
          contentBottom,
        });
        const endY = drawImageBlock(doc, measured, { contentTop, contentBottom });
        cursorY = endY + 2;
        isFirstBlock = false;
      }
    } catch {
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = layout.margin ?? 12;
      const titleY = flow?.newPageY != null ? flow.newPageY + 1 : (layout.titleY ?? 16);
      beginDedicatedPage(
        pageTitle,
        margin,
        titleY,
        titleY + 4.5,
        layout.contentBottom ?? pageHeight - 12,
      );
      cursorY = addTextFallbackPage(
        doc,
        pageTitle,
        'Não foi possível renderizar este arquivo dentro do PDF final. Abra o anexo original para visualizar o conteúdo completo.',
        { margin, titleY },
      );
      isFirstBlock = false;
    }
  }

  const endPage = doc.internal.getNumberOfPages();
  const endY = cursorY ?? (layout.contentBottom ?? doc.internal.pageSize.getHeight() - 12);
  return { pagesAdded, endPage, endY };
}
