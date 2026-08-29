/**
 * PDF portrait mobile (cartões) — catálogo Tintão / pedido em caixas.
 */
export function buildCatalogPdfMobileClientJs() {
  return `
    function printPageWidthPx() {
      return 390;
    }
    function printPageWidthMm() {
      return Math.max(88, pxToMm(printPageWidthPx()));
    }
    function buildPrintFormatoResumoHtml(rows) {
      if (!rows.length) return '';
      const groups = new Map();
      for (const { item, qty } of rows) {
        const fmt = item.formato || '—';
        if (!groups.has(fmt)) groups.set(fmt, { qty: 0, m2: 0 });
        const g = groups.get(fmt);
        g.qty += qty;
        const m2 = itemM2Total(item, qty);
        if (m2) g.m2 += m2;
      }
      const fmtKeys = [...groups.keys()].sort(compareFormato);
      let totQty = 0;
      let totM2 = 0;
      const bodyRows = fmtKeys.map((fmt) => {
        const g = groups.get(fmt);
        totQty += g.qty;
        totM2 += g.m2;
        return '<tr>' +
          '<td class="print-fmt-resumo-fmt">' + esc(grupoLabelFormato(fmt)) + '</td>' +
          '<td class="print-fmt-resumo-num">' + g.qty + '</td>' +
          '<td class="print-fmt-resumo-num">' + (g.m2 ? fmtDecimal(g.m2) : '—') + '</td>' +
        '</tr>';
      }).join('');
      const totalRow = '<tr class="print-fmt-resumo-total">' +
        '<td class="print-fmt-resumo-fmt"><strong>Total</strong></td>' +
        '<td class="print-fmt-resumo-num"><strong>' + totQty + '</strong></td>' +
        '<td class="print-fmt-resumo-num"><strong>' + fmtDecimal(totM2) + '</strong></td>' +
      '</tr>';
      return '<section class="print-fmt-resumo-wrap">' +
        '<p class="print-fmt-resumo-title">Resumo por formato</p>' +
        '<table class="print-fmt-resumo-table">' +
          '<colgroup><col class="col-fmt-res-fmt"><col class="col-fmt-res-num"><col class="col-fmt-res-num"></colgroup>' +
          '<thead><tr><th>Formato</th><th>' + esc(QTY_LABEL) + '</th><th>m²</th></tr></thead>' +
          '<tbody>' + bodyRows + totalRow + '</tbody>' +
        '</table>' +
      '</section>';
    }
    function renderPedidoPrintCard({ item, qty, img, titulo, m2cx, m2tot, sub }) {
      const thumb = img
        ? '<img class="pedido-card-thumb" src="' + esc(img) + '" alt="" width="48" height="48" />'
        : '<span class="pedido-card-thumb pedido-card-thumb-empty" aria-hidden="true">—</span>';
      return '<article class="pedido-card pedido-card-pdf">' +
        '<div class="pedido-card-head">' +
          thumb +
          '<div class="pedido-card-intro">' +
            '<div class="pedido-card-title">' + esc(titulo) + '</div>' +
            '<div class="pedido-card-meta">#' + esc(item.codigo_tintao) + ' · ' + esc(item.formato || '—') + '</div>' +
          '</div>' +
          '<div class="pedido-card-aside">' +
            '<div class="pedido-card-subtotal">' +
              '<span class="pedido-card-subtotal-label">Subtotal</span>' +
              '<strong>' + esc(sub != null ? fmtMoney(sub) : '—') + '</strong>' +
            '</div>' +
            '<div class="pedido-card-unit">' +
              '<span class="pedido-card-unit-label">Preço/m²</span>' +
              '<span class="pedido-card-price-val' + (descontoComercialPct ? ' has-desc' : '') + '">' + fmtPrecoHtml(item.preco_m2) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="pedido-card-grid">' +
          '<div class="pedido-card-kv"><span class="pedido-card-kv-label">Caixas</span><span class="pedido-card-kv-val">' + qty + '</span></div>' +
          '<div class="pedido-card-kv"><span class="pedido-card-kv-label">m²/cx</span><span class="pedido-card-kv-val">' + esc(m2cx ? fmtDecimal(m2cx) : '—') + '</span></div>' +
          '<div class="pedido-card-kv"><span class="pedido-card-kv-label">m² total</span><span class="pedido-card-kv-val">' + esc(m2tot ? fmtDecimal(m2tot) : '—') + '</span></div>' +
        '</div>' +
      '</article>';
    }
    function buildPedidoPrintHtml(thumbs) {
      const rows = pedidoItens();
      let totalCaixas = 0, totalM2 = 0, totalValor = 0;
      const cards = [];
      for (const { item, qty } of rows) {
        const m2cx = parseM2Caixa(item);
        const m2tot = itemM2Total(item, qty);
        const sub = itemSubtotal(item, qty);
        totalCaixas += qty;
        if (m2tot) totalM2 += m2tot;
        if (sub) totalValor += sub;
        const imgs = getGaleria(item);
        const img = pdfImgSrc(imgs[0]?.url || '', thumbs, item);
        const titulo = item.formigres_titulo || item.descricao;
        cards.push(renderPedidoPrintCard({ item, qty, img, titulo, m2cx, m2tot, sub }));
      }
      const descNote = descontoComercialPct ? '<p class="print-note">Desconto comercial aplicado: ' + descontoComercialPct + '% sobre a tabela.</p>' : '';
      const resumo = rows.length
        ? '<div class="print-resumo">' +
            '<span class="print-resumo-stat"><strong>' + rows.length + '</strong> modelos</span>' +
            '<span class="print-resumo-stat"><strong>' + totalCaixas + '</strong> caixas</span>' +
            '<span class="print-resumo-stat"><strong>' + fmtDecimal(totalM2) + '</strong> m²</span>' +
          '</div>'
        : '';
      const formatoResumoHtml = buildPrintFormatoResumoHtml(rows);
      return '<div class="print-sheet">' +
        '<header class="print-head">' +
          '<h1>' + esc(PDF_TITLE) + '</h1>' +
          '<p class="print-meta">1ª via · Gerado em ' + esc(new Date().toLocaleString('pt-BR')) + '</p>' +
          descNote +
        '</header>' +
        resumo +
        '<div class="print-cards">' + cards.join('') + '</div>' +
        formatoResumoHtml +
        '<p class="print-totals"><strong>Total estimado: ' + fmtMoney(totalValor) + '</strong></p>' +
      '</div>';
    }
    function printPedidoPrintCss(pageWmm, pageHmm) {
      const pageRule = pageHmm != null
        ? '@page { size: ' + pageWmm + 'mm ' + pageHmm + 'mm; margin: 3mm 2mm; }'
        : '';
      const rowLine = '#d5d5d5';
      return pageRule +
        'html, body { margin: 0; padding: 0; }' +
        '.print-render-root { background: #ffffff; color: #5a5a5a; font-family: "Libre Franklin", "Segoe UI", system-ui, -apple-system, sans-serif; font-size: 13px; -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; width: 100%; }' +
        '.print-sheet { width: 100%; max-width: 100%; margin: 0 auto; box-sizing: border-box; background: #ffffff; color: #5a5a5a; padding: 4px 14px 2px; }' +
        '.print-head { margin-bottom: 10px; }' +
        'h1 { margin: 0 0 4px; font-size: 17px; letter-spacing: .08em; text-transform: uppercase; color: #2f2f2f; font-weight: 600; }' +
        '.print-meta, .print-note { margin: 0 0 6px; color: #767676; font-size: 11px; line-height: 1.35; }' +
        '.print-resumo { display: flex; gap: 6px; margin-bottom: 10px; }' +
        '.print-resumo-stat { flex: 1; min-width: 0; text-align: center; padding: 7px 4px; border: 1px solid ' + rowLine + '; border-radius: 0; background: #f7f7f7; font-size: 10px; color: #767676; }' +
        '.print-resumo-stat strong { display: block; font-size: 14px; color: #2f2f2f; margin-bottom: 2px; font-weight: 600; }' +
        '.print-cards { display: flex; flex-direction: column; }' +
        '.pedido-card-pdf { padding: 14px 0; break-inside: avoid; page-break-inside: avoid; background: #ffffff; border-top: 1px solid ' + rowLine + '; }' +
        '.print-cards > .pedido-card-pdf:first-child { border-top: none; }' +
        '.pedido-card-head { display: flex; align-items: flex-start; gap: 10px; }' +
        '.pedido-card-thumb { width: 48px; height: 48px; border-radius: 0; object-fit: cover; flex-shrink: 0; background: #fafafa; display: block; }' +
        '.pedido-card-thumb-empty { display: flex; align-items: center; justify-content: center; color: #767676; font-size: 12px; }' +
        '.pedido-card-intro { flex: 1; min-width: 0; }' +
        '.pedido-card-aside { text-align: right; flex-shrink: 0; min-width: 72px; max-width: 42%; }' +
        '.pedido-card-title { font-size: .88rem; font-weight: 600; line-height: 1.25; color: #2f2f2f; }' +
        '.pedido-card-meta { margin-top: 3px; font-size: .72rem; color: #767676; line-height: 1.3; }' +
        '.pedido-card-subtotal-label, .pedido-card-unit-label { display: block; font-size: .6rem; text-transform: uppercase; letter-spacing: .05em; color: #767676; margin-bottom: 2px; }' +
        '.pedido-card-subtotal strong { display: block; font-size: .92rem; font-weight: 600; color: #1f1f24; white-space: nowrap; line-height: 1.2; }' +
        '.pedido-card-unit { margin-top: 8px; }' +
        '.pedido-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 10px; margin-top: 10px; }' +
        '.pedido-card-kv-label { display: block; font-size: .62rem; text-transform: uppercase; letter-spacing: .04em; color: #767676; margin-bottom: 2px; }' +
        '.pedido-card-kv-val { font-size: .84rem; font-weight: 500; color: #2f2f2f; font-variant-numeric: tabular-nums; }' +
        '.pedido-card-price-val { display: block; line-height: 1.15; }' +
        '.pedido-card-price-val .preco-orig { font-size: .62rem; line-height: 1.1; display: block; text-decoration: line-through; color: #767676; }' +
        '.pedido-card-price-val .preco-desc { font-size: .78rem; font-weight: 600; color: #2f2f2f; display: block; }' +
        '.pedido-card-price-val:not(.has-desc) { font-size: .78rem; font-weight: 600; color: #2f2f2f; }' +
        '.print-fmt-resumo-wrap { margin-top: 14px; break-inside: avoid; page-break-inside: avoid; }' +
        '.print-fmt-resumo-title { margin: 0 0 6px; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #767676; }' +
        '.print-fmt-resumo-table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; }' +
        '.print-fmt-resumo-table th, .print-fmt-resumo-table td { padding: 4px 8px; border-bottom: 1px solid ' + rowLine + '; vertical-align: middle; font-variant-numeric: tabular-nums; }' +
        '.print-fmt-resumo-table thead th { font-size: 8px; font-weight: 500; text-transform: uppercase; letter-spacing: .04em; color: #767676; text-align: right; white-space: nowrap; }' +
        '.print-fmt-resumo-table thead th:first-child, .print-fmt-resumo-table .print-fmt-resumo-fmt { text-align: left; }' +
        '.print-fmt-resumo-table .print-fmt-resumo-num { text-align: right; color: #2f2f2f; white-space: nowrap; }' +
        '.print-fmt-resumo-table .print-fmt-resumo-fmt { color: #2f2f2f; font-weight: 600; letter-spacing: .03em; }' +
        '.print-fmt-resumo-table .print-fmt-resumo-total td { border-top: 2px solid ' + rowLine + '; border-bottom: 0; padding-top: 6px; font-weight: 600; }' +
        '.print-totals { text-align: right; margin: 14px 0 0; padding-top: 10px; border-top: 1px solid ' + rowLine + '; font-size: 14px; color: #5a5a5a; break-inside: avoid; page-break-inside: avoid; }' +
        '.print-totals strong { font-size: 16px; color: #1f1f24; font-weight: 600; }';
    }
    function pedidoPdfIframeHead(pageWmm) {
      return '<meta charset="utf-8"><style>' + getPdfFontFaceCss() + printPedidoPrintCss(pageWmm, null) + '</style>';
    }
    async function renderPedidoPdfBlob(thumbs) {
      const pageWpx = printPageWidthPx();
      const pageWmm = printPageWidthMm();
      const html = buildPedidoPrintHtml(thumbs);
      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText = 'position:fixed;left:0;top:0;width:' + pageWpx + 'px;height:2400px;border:0;opacity:0;pointer-events:none;z-index:2147483646;';
      document.body.appendChild(iframe);
      try {
        const win = iframe.contentWindow;
        const doc = win.document;
        doc.open();
        doc.write(
          '<!DOCTYPE html><html><head>' + pedidoPdfIframeHead(pageWmm) +
          "</head><body style=\\"margin:0;font-family:'Libre Franklin',system-ui,sans-serif\\"><div class=\\"print-render-root\\" style=\\"width:" + pageWpx + "px\\">" +
          html +
          '</div></body></html>'
        );
        doc.close();
        await loadHtml2PdfInWindow(win, doc);
        await waitPrintFontsRoot(doc);
        await waitPrintImagesRoot(doc.body);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const sheet = doc.querySelector('.print-sheet');
        if (!sheet) throw new Error('Conteúdo do PDF indisponível');
        const heightPx = Math.max(sheet.scrollHeight || 0, sheet.offsetHeight || 0, 280);
        let pageHmm = Math.max(100, pxToMm(heightPx) + 12);
        if (pageHmm > 1400) pageHmm = 297;
        const pageStyle = doc.createElement('style');
        pageStyle.textContent = printPedidoPrintCss(pageWmm, pageHmm);
        doc.head.appendChild(pageStyle);
        const blob = await win.html2pdf().set({
          margin: 3,
          filename: pedidoPdfFilename(),
          image: { type: 'jpeg', quality: 0.94 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false,
            width: pageWpx,
            windowWidth: pageWpx,
            height: heightPx,
            windowHeight: heightPx,
            backgroundColor: pdfCanvasBackground(PDF_THEME),
            onclone: injectPdfFontClone,
          },
          jsPDF: { unit: 'mm', format: [pageWmm, pageHmm], orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'], avoid: ['.pedido-card-pdf', '.print-fmt-resumo-wrap', '.print-totals'] },
        }).from(sheet).outputPdf('blob');
        if (!blob || blob.size < 12000) throw new Error('PDF gerado vazio');
        return blob;
      } finally {
        iframe.remove();
      }
    }
  `.trim();
}
