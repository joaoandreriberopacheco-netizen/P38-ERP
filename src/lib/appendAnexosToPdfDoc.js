import { loadPdfJsBrowser } from '@/lib/loadPdfJsBrowser';

/** Meia folha A4 em orientação paisagem (210 × 148,5 mm). */
const HALF_A4_LANDSCAPE_HEIGHT_MM = 148.5;

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

/** Encaixa a imagem inteira no retângulo (modo impressão desktop). */
function measureImageContain(img, maxWidthMm, maxHeightMm) {
  const ratioW = maxWidthMm / img.width;
  const ratioH = maxHeightMm / img.height;
  const ratio = Math.min(ratioW, ratioH);
  return {
    width: img.width * ratio,
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

async function prepareImageOnly(source, mimeType) {
  const img = await loadImage(source);
  return {
    img,
    mimeType: getExtensionFromMime(mimeType),
  };
}

function getHalfA4SlotMetrics(pageWidth, pageHeight, layout = {}, flow = {}) {
  const margin = layout.margin ?? 12;
  const bottomPad = flow.bottomPad ?? layout.bottomPad ?? 12;
  const contentTop = layout.contentTop ?? ((flow.newPageY ?? 16) + 5.5);
  const contentBottom = layout.contentBottom ?? pageHeight - bottomPad;
  const contentWidth = pageWidth - margin * 2;
  const slotGap = layout.slotGap ?? 2;
  const titleHeight = 4.5;
  const availableContent = Math.max(0, contentBottom - contentTop);
  const slotHeight = Math.min(
    HALF_A4_LANDSCAPE_HEIGHT_MM,
    (availableContent - slotGap) / 2,
  );
  const imageAreaHeight = Math.max(20, slotHeight - titleHeight - 2);

  return {
    margin,
    contentTop,
    contentBottom,
    contentWidth,
    slotHeight,
    slotGap,
    titleHeight,
    imageAreaHeight,
  };
}

function imageSourceToDataUrl(img, mimeType = 'JPEG') {
  if (img.src?.startsWith('data:')) return img.src;
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(img, 0, 0);
  const quality = mimeType === 'PNG' ? undefined : 0.92;
  return canvas.toDataURL(mimeType === 'PNG' ? 'image/png' : 'image/jpeg', quality);
}

function drawImageInHalfA4LandscapeSlot(doc, block, slotTopY, metrics) {
  const { margin, contentWidth, titleHeight, imageAreaHeight } = metrics;
  const titleY = slotTopY + 1.5;
  const imageTopY = titleY + titleHeight + 1;

  doc.setFontSize(7.5);
  const titleLines = doc.splitTextToSize(block.title, contentWidth).slice(0, 2);
  doc.text(titleLines, margin, titleY);

  const measured = measureImageContain(block.img, contentWidth, imageAreaHeight);
  const x = margin + Math.max(0, (contentWidth - measured.width) / 2);
  const y = imageTopY + Math.max(0, (imageAreaHeight - measured.height) / 2);
  const dataUrl = imageSourceToDataUrl(block.img, block.mimeType);

  doc.addImage(dataUrl, block.mimeType, x, y, measured.width, measured.height);
  return slotTopY + metrics.slotHeight;
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

function addTextFallbackHalfSlot(doc, title, message, slotTopY, metrics) {
  const { margin, contentWidth } = metrics;
  const titleY = slotTopY + 1.5;
  doc.setFontSize(7.5);
  doc.text(doc.splitTextToSize(title, contentWidth).slice(0, 2), margin, titleY);
  doc.setFontSize(7);
  doc.text(message, margin, titleY + 6, { maxWidth: contentWidth });
  return slotTopY + metrics.slotHeight;
}

async function appendAnexosFlowMode(doc, anexos, options = {}) {
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

async function appendAnexosHalfA4LandscapeMode(doc, anexos, options = {}) {
  const { sectionPrefix = 'Anexos', layout = {}, flow, onPageAdded } = options;
  const list = (anexos || []).filter((a) => a?.url_drive);
  if (list.length === 0) {
    return {
      pagesAdded: 0,
      endPage: doc.internal.getNumberOfPages(),
      endY: flow?.initialY ?? layout.contentTop ?? 20,
    };
  }

  let pagesAdded = 0;
  let pageSlotIndex = 0;
  let firstSlotTopY = null;
  let lastSlotEndY = null;
  let isFirstBlock = true;

  const registerPage = () => {
    pagesAdded += 1;
    onPageAdded?.(doc.internal.getNumberOfPages());
  };

  const resetPageSlots = () => {
    pageSlotIndex = 0;
    firstSlotTopY = null;
  };

  const addAttachmentPage = () => {
    doc.addPage();
    registerPage();
    resetPageSlots();
  };

  const resolveNextSlotTopY = (metrics) => {
    const { contentTop, contentBottom, slotHeight, slotGap } = metrics;

    if (pageSlotIndex === 0) {
      let startY = contentTop;
      if (isFirstBlock && typeof flow?.initialY === 'number') {
        const candidateY = flow.initialY + (flow.gapBefore ?? 4);
        if (contentBottom - candidateY >= slotHeight) {
          startY = candidateY;
        } else if (contentBottom - contentTop < slotHeight) {
          addAttachmentPage();
          startY = contentTop;
        }
      }
      firstSlotTopY = startY;
      pageSlotIndex = 1;
      return startY;
    }

    const secondSlotY = firstSlotTopY + slotHeight + slotGap;
    if (pageSlotIndex === 1 && contentBottom - secondSlotY >= slotHeight) {
      pageSlotIndex = 2;
      return secondSlotY;
    }

    addAttachmentPage();
    firstSlotTopY = contentTop;
    pageSlotIndex = 1;
    return contentTop;
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
        const metrics = getHalfA4SlotMetrics(pageWidth, pageHeight, layout, flow);
        const slotTopY = resolveNextSlotTopY(metrics);
        const prepared = await prepareImageOnly(block.source, block.mime);
        lastSlotEndY = drawImageInHalfA4LandscapeSlot(
          doc,
          { ...prepared, title: block.title },
          slotTopY,
          metrics,
        );
        isFirstBlock = false;
      }
    } catch {
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      const metrics = getHalfA4SlotMetrics(pageWidth, pageHeight, layout, flow);
      const slotTopY = resolveNextSlotTopY(metrics);
      lastSlotEndY = addTextFallbackHalfSlot(
        doc,
        pageTitle,
        'Não foi possível renderizar este arquivo dentro do PDF final. Abra o anexo original para visualizar o conteúdo completo.',
        slotTopY,
        metrics,
      );
      isFirstBlock = false;
    }
  }

  const endPage = doc.internal.getNumberOfPages();
  const endY = lastSlotEndY ?? (layout.contentBottom ?? doc.internal.pageSize.getHeight() - 12);
  return { pagesAdded, endPage, endY };
}

/**
 * Embute anexos (imagens/PDF) num documento jsPDF existente.
 * @param {import('jspdf').jsPDF} doc
 * @param {Array} anexos
 * @param {{
 *   sectionPrefix?: string,
 *   mode?: 'flow' | 'half_a4_landscape',
 *   layout?: { margin?: number, titleY?: number, contentTop?: number, contentBottom?: number },
 *   flow?: { initialY?: number, gapBefore?: number, newPageY?: number, bottomPad?: number },
 *   onPageAdded?: (pageNumber: number) => void,
 * }} [options]
 * @returns {Promise<{ pagesAdded: number, endPage: number, endY: number }>}
 */
export async function appendAnexosToPdfDoc(doc, anexos = [], options = {}) {
  const mode = options.mode ?? 'flow';
  if (mode === 'half_a4_landscape') {
    return appendAnexosHalfA4LandscapeMode(doc, anexos, options);
  }
  return appendAnexosFlowMode(doc, anexos, options);
}
