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

/**
 * Escala o anexo para ocupar a largura útil da página.
 * Comprovantes altos (ex.: screenshot mobile) não devem ser reduzidos pela altura
 * disponível — isso gera miniaturas ilegíveis.
 */
function measureImageWidthFirst(img, layout) {
  const maxWidth = layout.pageWidth - layout.margin * 2;
  const ratio = maxWidth / img.width;
  return {
    width: maxWidth,
    height: img.height * ratio,
    ratio,
  };
}

function sliceImageToDataUrls(img, measured, chunkHeightMm) {
  const chunkHeightPx = chunkHeightMm / measured.ratio;
  const slices = [];
  let offsetY = 0;

  while (offsetY < img.height) {
    const slicePx = Math.min(chunkHeightPx, img.height - offsetY);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = Math.ceil(slicePx);
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, offsetY, img.width, slicePx, 0, 0, img.width, slicePx);
    slices.push({
      dataUrl: canvas.toDataURL('image/jpeg', 0.92),
      heightMm: slicePx * measured.ratio,
    });
    offsetY += slicePx;
  }

  return slices;
}

async function prepareImageBlock(source, mimeType, layout) {
  const img = await loadImage(source);
  const measured = measureImageWidthFirst(img, layout);
  return {
    img,
    measured,
    mimeType: getExtensionFromMime(mimeType),
  };
}

async function drawImageBlockPaginated(doc, block, layout, renderOptions = {}) {
  const { img, measured } = block;
  const {
    contentTop,
    contentBottom,
    newPageContentTop,
    onNeedNewPage,
    startY,
    centerSingleSlice = false,
  } = layout;

  const pageWidth = doc.internal.pageSize.getWidth();
  const x = (pageWidth - measured.width) / 2;
  const maxChunkHeight = contentBottom - contentTop;
  const slices = sliceImageToDataUrls(img, measured, maxChunkHeight);

  let y = typeof startY === 'number' ? startY : contentTop;

  for (let index = 0; index < slices.length; index += 1) {
    const slice = slices[index];
    const availableOnPage = contentBottom - y;

    if (slice.heightMm > availableOnPage) {
      onNeedNewPage?.();
      y = newPageContentTop ?? contentTop;
    }

    if (
      index === 0
      && centerSingleSlice
      && slices.length === 1
      && slice.heightMm <= maxChunkHeight
      && typeof startY !== 'number'
    ) {
      y = contentTop + Math.max(0, (maxChunkHeight - slice.heightMm) / 2);
    }

    doc.addImage(slice.dataUrl, 'JPEG', x, y, measured.width, slice.heightMm);
    y += slice.heightMm;

    if (index < slices.length - 1) {
      onNeedNewPage?.();
      y = newPageContentTop ?? contentTop;
    }
  }

  return y;
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

  const addContinuationPage = () => {
    doc.addPage();
    registerPage();
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
        const dedicatedTitleY = newPageY + 1;
        const dedicatedContentTop = dedicatedTitleY + 4.5;
        const newPageContentTop = dedicatedContentTop;

        const blockPrepared = await prepareImageBlock(block.source, block.mime, {
          pageWidth,
          margin,
        });

        if (cursorY != null) {
          const candidateTitleY = cursorY + gapBefore;
          const candidateContentTop = candidateTitleY + 4.5;
          const availableHeight = contentBottom - candidateContentTop;

          if (availableHeight >= 35 && blockPrepared.measured.height <= availableHeight) {
            doc.setFontSize(7.5);
            doc.text(block.title, margin, candidateTitleY);
            const endY = await drawImageBlockPaginated(doc, blockPrepared, {
              contentTop: candidateContentTop,
              contentBottom,
              newPageContentTop,
              onNeedNewPage: addContinuationPage,
              startY: candidateContentTop,
            });
            cursorY = endY + 2;
            isFirstBlock = false;
            continue;
          }
        }

        beginDedicatedPage(block.title, margin, dedicatedTitleY, dedicatedContentTop, contentBottom);
        cursorY = null;

        const endY = await drawImageBlockPaginated(doc, blockPrepared, {
          contentTop: dedicatedContentTop,
          contentBottom,
          newPageContentTop,
          onNeedNewPage: addContinuationPage,
          centerSingleSlice: true,
        });
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
