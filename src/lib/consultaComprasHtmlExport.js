import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import ConsultaComprasExportDocument from '@/components/compras/ConsultaComprasExportDocument';
import { MOBILE_EXPORT_WIDTH_PX } from '@/components/compras/ConsultaComprasExportDocument';
import { dataHoje } from '@/components/utils/dateUtils';
import { downloadBlob, shareOrDownloadBlob } from '@/lib/mobilePrintAndShare';

const MOBILE_PAGE_WIDTH_MM = (MOBILE_EXPORT_WIDTH_PX * 25.4) / 96;
const MOBILE_PAGE_HEIGHT_MM = 297;

async function loadPdfCaptureLibs() {
  const [html2canvasModule, jspdfModule] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  return {
    html2canvas: html2canvasModule.default,
    jsPDF: jspdfModule.jsPDF,
  };
}

async function waitForCaptureLayout(container) {
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await new Promise((resolve) => setTimeout(resolve, 120));
  void container.offsetHeight;
}

function prepareCloneForPdfCapture(clonedDoc) {
  if (!clonedDoc) return;
  clonedDoc.querySelectorAll('#consulta-export-capture, #consulta-export-capture *').forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    const style = clonedDoc.defaultView?.getComputedStyle(node);
    if (style?.overflow === 'hidden' || style?.overflowX === 'hidden') {
      node.style.overflow = 'visible';
      node.style.overflowX = 'visible';
    }
    if (style?.textOverflow === 'ellipsis' || node.classList.contains('truncate') || node.classList.contains('line-clamp-2')) {
      node.style.textOverflow = 'clip';
      node.style.whiteSpace = 'normal';
      node.style.overflow = 'visible';
      node.style.display = 'block';
      node.style.webkitLineClamp = 'unset';
      node.style.webkitBoxOrient = 'unset';
    }
  });
  const root = clonedDoc.getElementById('consulta-export-capture');
  if (root instanceof HTMLElement) {
    root.style.overflow = 'visible';
    root.style.paddingLeft = '18px';
    root.style.paddingRight = '18px';
    root.style.paddingTop = '20px';
    root.style.paddingBottom = '28px';
  }
}

/**
 * Captura elemento HTML longo → PDF mobile multi-página (largura ~390px).
 */
export async function renderConsultaElementToPdfBlob(element, { theme = 'light' } = {}) {
  if (!element) throw new Error('Elemento inválido');
  const { html2canvas, jsPDF } = await loadPdfCaptureLibs();
  const backgroundColor = theme === 'dark' ? '#0f0f0f' : '#ffffff';

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor,
    logging: false,
    width: MOBILE_EXPORT_WIDTH_PX,
    windowWidth: MOBILE_EXPORT_WIDTH_PX,
    scrollX: 0,
    scrollY: 0,
    x: 0,
    y: 0,
    ignoreElements: (node) =>
      typeof node?.classList?.contains === 'function' && node.classList.contains('no-pdf-capture'),
    onclone: (clonedDoc) => {
      prepareCloneForPdfCapture(clonedDoc);
    },
  });

  const pageHeightPx = Math.floor((MOBILE_PAGE_HEIGHT_MM / MOBILE_PAGE_WIDTH_MM) * canvas.width);
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [MOBILE_PAGE_WIDTH_MM, MOBILE_PAGE_HEIGHT_MM],
  });

  let renderedHeight = 0;
  let pageIndex = 0;

  while (renderedHeight < canvas.height) {
    const sliceHeight = Math.min(pageHeightPx, canvas.height - renderedHeight);
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeight;
    const ctx = sliceCanvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível');
    ctx.drawImage(
      canvas,
      0,
      renderedHeight,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight,
    );

    const sliceHeightMm = (sliceHeight / canvas.width) * MOBILE_PAGE_WIDTH_MM;
    const imgData = sliceCanvas.toDataURL('image/png');

    if (pageIndex > 0) {
      pdf.addPage([MOBILE_PAGE_WIDTH_MM, MOBILE_PAGE_HEIGHT_MM]);
    }
    pdf.addImage(imgData, 'PNG', 0, 0, MOBILE_PAGE_WIDTH_MM, sliceHeightMm);

    renderedHeight += sliceHeight;
    pageIndex += 1;
  }

  return pdf.output('blob');
}

function buildExportHost() {
  const host = document.createElement('div');
  host.setAttribute('data-consulta-export-host', 'true');
  host.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    'width:' + MOBILE_EXPORT_WIDTH_PX + 'px',
    'z-index:-1',
    'pointer-events:none',
    'opacity:1',
    'overflow:visible',
  ].join(';');
  document.body.appendChild(host);
  return host;
}

async function renderConsultaExportDocument({
  pedidosFiltrados,
  groupBy,
  sortOrder,
  produtosMap,
  showDetalheCustos,
  theme,
  filtrosDesc,
  contextLabel,
}) {
  const host = buildExportHost();
  const root = createRoot(host);

  try {
    flushSync(() => {
      root.render(
        React.createElement(ConsultaComprasExportDocument, {
          pedidosFiltrados,
          groupBy,
          sortOrder,
          produtosMap,
          showDetalheCustos,
          theme,
          filtrosDesc,
          contextLabel,
        }),
      );
    });

    await waitForCaptureLayout(host);
    const captureEl = host.querySelector('#consulta-export-capture');
    if (!captureEl) throw new Error('Área de captura não encontrada');
    return captureEl.cloneNode(true);
  } finally {
    root.unmount();
    host.remove();
  }
}

/**
 * Gera PDF mobile da consulta a partir dos mesmos componentes React da tela.
 */
export async function gerarConsultaComprasHtmlPdf({
  version = 'expandida_mobile_claro',
  pedidos = [],
  filtrosDesc = '',
  produtosMap = {},
  groupBy = 'eta_transportadora',
  sortOrder = 'asc',
  onProgress,
}) {
  onProgress?.('Montando visual da consulta...');

  const theme = version === 'expandida_mobile' ? 'dark' : 'light';
  const showDetalheCustos = true;

  const host = buildExportHost();
  const root = createRoot(host);
  let captureEl;

  try {
    flushSync(() => {
      root.render(
        React.createElement(ConsultaComprasExportDocument, {
          pedidosFiltrados: pedidos,
          groupBy,
          sortOrder,
          produtosMap,
          showDetalheCustos,
          theme,
          filtrosDesc,
          contextLabel: 'Consulta de compras',
        }),
      );
    });

    await waitForCaptureLayout(host);
    captureEl = host.querySelector('#consulta-export-capture');
    if (!captureEl) throw new Error('Área de captura não encontrada');

    onProgress?.('Gerando PDF...');
    const blob = await renderConsultaElementToPdfBlob(captureEl, { theme });
    const filename = `RelatorioCompras_${version}_${dataHoje()}.pdf`;

    await shareOrDownloadBlob(blob, filename, 'application/pdf', 'Consulta de compras');
    return blob;
  } finally {
    root.unmount();
    host.remove();
  }
}

/** Exporta HTML estático (partilha/descarrega .html) com o mesmo visual da consulta. */
export async function gerarConsultaComprasHtmlDocument({
  pedidos = [],
  filtrosDesc = '',
  produtosMap = {},
  groupBy = 'eta_transportadora',
  sortOrder = 'asc',
  theme = 'light',
}) {
  const captureEl = await renderConsultaExportDocument({
    pedidosFiltrados: pedidos,
    groupBy,
    sortOrder,
    produtosMap,
    showDetalheCustos: true,
    theme,
    filtrosDesc,
    contextLabel: 'Consulta de compras',
  });

  const styles = [...document.styleSheets]
    .map((sheet) => {
      try {
        return [...sheet.cssRules].map((rule) => rule.cssText).join('\n');
      } catch {
        return '';
      }
    })
    .filter(Boolean)
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Consulta de compras</title>
  <style>${styles}</style>
</head>
<body style="margin:0;background:#fff;">
  ${captureEl.outerHTML}
</body>
</html>`;

  const filename = `ConsultaCompras_${dataHoje()}.html`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  downloadBlob(blob, filename);
  return blob;
}
