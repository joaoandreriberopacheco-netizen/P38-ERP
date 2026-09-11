/**
 * Exportação PDF do pedido — mobile, A4 ou ambos.
 */
export function buildCatalogPdfExportClientJs({ dual = false, defaultFormat = 'mobile' } = {}) {
  const renderDispatch = dual
    ? `async function renderPedidoPdfBlob(thumbs, format) {
        if (format === 'a4') return a4RenderPedidoPdfBlob(thumbs);
        return mobileRenderPedidoPdfBlob(thumbs);
      }`
    : defaultFormat === 'a4'
      ? 'async function renderPedidoPdfBlob(thumbs, format) { return a4RenderPedidoPdfBlob(thumbs); }'
      : 'async function renderPedidoPdfBlob(thumbs, format) { return mobileRenderPedidoPdfBlob(thumbs); }';

  const btnSelector = dual
    ? `const pdfBtns = () => [
        document.getElementById('pdf-pedido-mobile'),
        document.getElementById('pdf-pedido-a4'),
      ].filter(Boolean);`
    : `const pdfBtns = () => [document.getElementById('pdf-pedido-panel')].filter(Boolean);`;

  return `
    let lastPdfFormat = '${defaultFormat}';
    function pedidoPdfFilename(format) {
      const suffix = format === 'a4' ? '-a4' : (format === 'mobile' ? '-mobile' : '');
      return 'pedido-formigres' + suffix + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
    }
    ${renderDispatch}
    ${btnSelector}
    function setPdfButtonsDisabled(disabled) {
      for (const btn of pdfBtns()) btn.toggleAttribute('disabled', disabled);
    }
    async function exportPedidoPdf(format) {
      if (!pedidoItens().length) return;
      const fmt = format || lastPdfFormat;
      lastPdfFormat = fmt;
      const btns = pdfBtns();
      const prevLabels = new Map(btns.map((b) => [b, b.textContent]));
      setPdfButtonsDisabled(true);
      for (const btn of btns) btn.textContent = 'Gerando PDF…';
      try {
        let thumbs = loadPdfThumbs();
        for (const btn of btns) btn.textContent = 'A preparar fotos…';
        thumbs = await ensurePedidoPdfThumbs(thumbs);
        revokePedidoPdfBlob();
        pedidoPdfBlob = await renderPedidoPdfBlob(thumbs, fmt);
        pedidoPdfBlobUrl = URL.createObjectURL(pedidoPdfBlob);
        closePedidoPanel();
        openPedidoPdfSheet();
        downloadPedidoPdfFile(fmt);
      } catch (err) {
        console.error(err);
        alert('Não foi possível gerar o PDF. Verifique a ligação à internet e tente de novo.');
      } finally {
        setPdfButtonsDisabled(!pedidoItens().length);
        for (const [btn, label] of prevLabels) btn.textContent = label;
      }
    }
    function downloadPedidoPdfFile(format) {
      if (!pedidoPdfBlobUrl) return;
      const a = document.createElement('a');
      a.href = pedidoPdfBlobUrl;
      a.download = pedidoPdfFilename(format || lastPdfFormat);
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  `.trim();
}
