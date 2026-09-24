/**
 * PDF A4 retrato (tabela) — catálogo B2B Formigres / Tintão.
 */
export function buildCatalogPdfA4ClientJs() {
  return `
    const a4RenderPedidoPdfBlob = (function() {
      function printPdfLayout() {
        const marginMm = 10;
        const pageWmm = 210;
        const contentWmm = pageWmm - marginMm * 2;
        const contentWpx = Math.round(contentWmm * 96 / 25.4);
        return { marginMm, pageWmm, contentWmm, contentWpx, orientation: 'portrait' };
      }
      function printPageWidthPx() {
        return printPdfLayout().contentWpx;
      }
      function buildPrintFormatoResumoHtml(rows) {
        if (!rows.length) return '';
        const groups = new Map();
        for (const { item, qty } of rows) {
          const fmt = item.formato || '—';
          if (!groups.has(fmt)) {
            groups.set(fmt, { qty: 0, m2: 0, cx: 0, peso: 0 });
          }
          const g = groups.get(fmt);
          g.qty += qty;
          const m2 = itemM2Total(item, qty);
          if (m2) g.m2 += m2;
          if (QTY_UNIT === 'palete') {
            const cx = itemCaixasTotal(item, qty);
            if (cx) g.cx += cx;
            const pt = itemPesoTotal(item, qty);
            if (pt) g.peso += pt;
          }
        }
        const fmtKeys = [...groups.keys()].sort(compareFormato);
        let totQty = 0;
        let totM2 = 0;
        let totCx = 0;
        let totPeso = 0;
        const bodyRows = fmtKeys.map((fmt) => {
          const g = groups.get(fmt);
          totQty += g.qty;
          totM2 += g.m2;
          totCx += g.cx;
          totPeso += g.peso;
          if (QTY_UNIT === 'palete') {
            return '<tr>' +
              '<td class="print-fmt-resumo-fmt">' + esc(grupoLabelFormato(fmt)) + '</td>' +
              '<td class="print-fmt-resumo-num">' + g.qty + '</td>' +
              '<td class="print-fmt-resumo-num">' + (g.m2 ? fmtDecimal(g.m2) : '—') + '</td>' +
              '<td class="print-fmt-resumo-num">' + (g.cx ? fmtDecimal(g.cx, 0) : '—') + '</td>' +
              '<td class="print-fmt-resumo-num">' + (g.peso ? fmtKg(g.peso) : '—') + '</td>' +
            '</tr>';
          }
          return '<tr>' +
            '<td class="print-fmt-resumo-fmt">' + esc(grupoLabelFormato(fmt)) + '</td>' +
            '<td class="print-fmt-resumo-num">' + g.qty + '</td>' +
            '<td class="print-fmt-resumo-num">' + (g.m2 ? fmtDecimal(g.m2) : '—') + '</td>' +
          '</tr>';
        }).join('');
        if (QTY_UNIT === 'palete') {
          const totalRow = '<tr class="print-fmt-resumo-total">' +
            '<td class="print-fmt-resumo-fmt"><strong>Total</strong></td>' +
            '<td class="print-fmt-resumo-num"><strong>' + totQty + '</strong></td>' +
            '<td class="print-fmt-resumo-num"><strong>' + fmtDecimal(totM2) + '</strong></td>' +
            '<td class="print-fmt-resumo-num"><strong>' + fmtDecimal(totCx, 0) + '</strong></td>' +
            '<td class="print-fmt-resumo-num"><strong>' + fmtKg(totPeso) + '</strong></td>' +
          '</tr>';
          return '<section class="print-fmt-resumo-wrap">' +
            '<p class="print-fmt-resumo-title">Resumo por formato</p>' +
            '<table class="print-fmt-resumo-table">' +
              '<colgroup><col class="col-fmt-res-fmt"><col class="col-fmt-res-num"><col class="col-fmt-res-num"><col class="col-fmt-res-num"><col class="col-fmt-res-num"></colgroup>' +
              '<thead><tr><th>Formato</th><th>Paletes</th><th>m²</th><th>Caixas</th><th>Peso</th></tr></thead>' +
              '<tbody>' + bodyRows + totalRow + '</tbody>' +
            '</table>' +
          '</section>';
        }
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
      function buildPedidoPrintHtml(thumbs) {
        const rows = pedidoItens();
        let totalQty = 0;
        let totalM2 = 0;
        let totalPeso = 0;
        let totalCaixas = 0;
        let totalValor = 0;
        const bodyRows = [];
        for (const { item, qty } of rows) {
          const emb = itemEmbalagem(item);
          const m2unit = itemM2Unit(item);
          const m2tot = itemM2Total(item, qty);
          const pesoTot = itemPesoTotal(item, qty);
          const cxTot = itemCaixasTotal(item, qty);
          const sub = itemSubtotal(item, qty);
          totalQty += qty;
          if (m2tot) totalM2 += m2tot;
          if (pesoTot) totalPeso += pesoTot;
          if (cxTot) totalCaixas += cxTot;
          if (sub) totalValor += sub;
          const imgs = getGaleria(item);
          const img = imgs[0]?.url || '';
          const titulo = item.formigres_titulo || item.descricao;
          const rowData = { item, qty, img, titulo, m2unit, m2tot, pesoUnit: itemPesoUnit(item), pesoTot, cxTot, cxpl: emb.cxpl, sub };
          bodyRows.push(renderPedidoTableRow(rowData, thumbs, { pdf: true }));
        }
        const pdfColCount = QTY_UNIT === 'palete' ? 9 : 7;
        const tableFoot = rows.length
          ? '<tfoot><tr class="print-pedido-tfoot">' +
              '<td colspan="' + (pdfColCount - 1) + '" class="print-pedido-total-label">Total estimado</td>' +
              '<td class="pedido-col-num col-subtotal print-pedido-total-val">' + esc(fmtMoney(totalValor)) + '</td>' +
            '</tr></tfoot>'
          : '';
        const tableHtml = rows.length
          ? '<table class="print-pedido-table pedido-table">' +
              PEDIDO_TABLE_COLGROUP_HTML +
              '<thead><tr>' + PEDIDO_TABLE_HEAD_HTML + '</tr></thead>' +
              '<tbody>' + bodyRows.join('') + '</tbody>' +
              tableFoot +
            '</table>'
          : '';
        const descNote = hasDescontoAtivo() ? '<p class="print-note">' + esc(descontoNoteText()) + ' sobre a tabela.</p>' : '';
        const caixasResumo = QTY_UNIT === 'palete' && totalCaixas
          ? '<span class="print-resumo-stat"><strong>' + fmtDecimal(totalCaixas, 0) + '</strong> caixas</span>'
          : '';
        const pesoResumo = QTY_UNIT === 'palete' && totalPeso
          ? '<span class="print-resumo-stat"><strong>' + fmtDecimal(totalPeso, 1) + '</strong> kg</span>'
          : '';
        const resumoCols = QTY_UNIT === 'palete' ? 5 : 3;
        const resumo = rows.length
          ? '<div class="print-resumo" style="grid-template-columns:repeat(' + resumoCols + ',minmax(0,1fr))">' +
              '<span class="print-resumo-stat"><strong>' + rows.length + '</strong> modelos</span>' +
              '<span class="print-resumo-stat"><strong>' + totalQty + '</strong> ' + QTY_LABEL_PL + '</span>' +
              caixasResumo +
              '<span class="print-resumo-stat"><strong>' + fmtDecimal(totalM2) + '</strong> m²</span>' +
              pesoResumo +
            '</div>'
          : '';
        const pesoPrintLine = QTY_UNIT === 'palete' && totalPeso
          ? '<p class="print-peso">Peso estimado: <strong>' + fmtKg(totalPeso) + '</strong></p>'
          : '';
        const formatoResumoHtml = buildPrintFormatoResumoHtml(rows);
        const footerHtml = rows.length
          ? '<footer class="print-footer">' +
              '<p class="print-totals">Total estimado: <strong>' + esc(fmtMoney(totalValor)) + '</strong></p>' +
              pesoPrintLine +
              descNote +
            '</footer>'
          : '';
        return '<div class="print-sheet">' +
          '<header class="print-head">' +
            '<h1>' + esc(PDF_TITLE) + '</h1>' +
            '<p class="print-meta">1ª via · Gerado em ' + esc(new Date().toLocaleString('pt-BR')) + '</p>' +
          '</header>' +
          resumo +
          tableHtml +
          formatoResumoHtml +
          footerHtml +
        '</div>';
      }
      function printPedidoPrintCss() {
        const rowLine = '#707070';
        const thumb = Math.min(40, PDF_PRINT_THUMB_PX);
        return '@page { size: A4 portrait; margin: 10mm; }' +
          'html, body { margin: 0; padding: 0; }' +
          '.print-render-root { background: #ffffff; color: #5a5a5a; font-family: "Libre Franklin", "Segoe UI", system-ui, -apple-system, sans-serif; font-size: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; width: 100%; }' +
          '.print-sheet { width: 100%; max-width: 100%; margin: 0; box-sizing: border-box; background: #ffffff; color: #5a5a5a; padding: 0 0 16px; }' +
          '.print-head { margin-bottom: 8px; }' +
          'h1 { margin: 0 0 4px; font-size: 14px; letter-spacing: .08em; text-transform: uppercase; color: #2f2f2f; font-weight: 600; }' +
          '.print-meta, .print-note { margin: 0 0 4px; color: #767676; font-size: 9px; line-height: 1.35; }' +
          '.print-resumo { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px 8px; margin-bottom: 8px; }' +
          '.print-resumo-stat { min-width: 0; font-size: 8px; color: #767676; }' +
          '.print-resumo-stat strong { display: block; font-size: 12px; color: #2f2f2f; margin-bottom: 2px; font-weight: 600; }' +
          '.print-pedido-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10px; margin-top: 0; }' +
          '.print-pedido-table th, .print-pedido-table td { padding: 5px 3px; vertical-align: middle; }' +
          '.print-pedido-table thead th { text-align: left; color: #767676; font-size: 7px; font-weight: 500; text-transform: uppercase; letter-spacing: .03em; border-bottom: 1px solid ' + rowLine + '; white-space: nowrap; padding-top: 4px; padding-bottom: 4px; vertical-align: bottom; }' +
          '.print-pedido-table tbody td { border-bottom: 1px solid ' + rowLine + '; }' +
          '.print-pedido-table col.col-foto { width: ' + (thumb + 4) + 'px; }' +
          '.print-pedido-table col.col-modelo { width: 26%; }' +
          '.print-pedido-table col.col-qty { width: 32px; }' +
          '.print-pedido-table col.col-m2u { width: 44px; }' +
          '.print-pedido-table col.col-m2 { width: 44px; }' +
          '.print-pedido-table col.col-cx { width: 40px; }' +
          '.print-pedido-table col.col-peso { width: 48px; }' +
          '.print-pedido-table col.col-emb { width: 72px; }' +
          '.print-pedido-table col.col-preco { width: 52px; }' +
          '.print-pedido-table col.col-sub { width: 58px; }' +
          '.print-pedido-table .pedido-row-title { display: block; font-weight: 600; line-height: 1.25; color: #2f2f2f; font-size: 10px; word-break: break-word; }' +
          '.print-pedido-table .pedido-row-meta { margin-top: 1px; font-size: 8px; color: #767676; line-height: 1.25; }' +
          '.print-pedido-table .pedido-col-num, .print-pedido-table th.pedido-col-num, .print-pedido-table .col-subtotal { text-align: right; font-variant-numeric: tabular-nums; }' +
          '.print-pedido-table .pedido-col-qty, .print-pedido-table th.pedido-col-qty { text-align: center; font-variant-numeric: tabular-nums; font-weight: 700; color: #2f2f2f; font-size: 11px; }' +
          '.print-pedido-table .col-subtotal { font-weight: 700; color: #b01219; white-space: nowrap; font-size: 10px; }' +
          '.print-pedido-table .pedido-col-foto img { display: block; border-radius: 4px; width: ' + thumb + 'px; height: ' + thumb + 'px; object-fit: cover; }' +
          '.print-pedido-table tbody tr { break-inside: avoid; page-break-inside: avoid; }' +
          '.print-pedido-table tfoot td { border-top: 2px solid ' + rowLine + '; padding-top: 10px; padding-bottom: 10px; vertical-align: middle; }' +
          '.print-pedido-table .print-pedido-total-label { text-align: right; font-size: 12px; font-weight: 600; color: #2f2f2f; padding-right: 10px; }' +
          '.print-pedido-table .print-pedido-total-val { font-size: 15px; font-weight: 700; color: #b01219; white-space: nowrap; }' +
          '.print-footer { margin-top: 12px; padding-top: 10px; border-top: 1px solid ' + rowLine + '; text-align: right; break-inside: avoid; page-break-inside: avoid; }' +
          '.print-peso { margin: 6px 0 0; font-size: 12px; color: #767676; text-align: right; }' +
          '.print-totals { margin: 0; font-size: 14px; color: #5a5a5a; text-align: right; }' +
          '.print-totals strong { font-size: 17px; color: #b01219; font-weight: 700; }' +
          '.print-fmt-resumo-wrap { margin-top: 14px; break-inside: avoid; page-break-inside: avoid; }' +
          '.print-fmt-resumo-title { margin: 0 0 6px; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #767676; }' +
          '.print-fmt-resumo-table { width: auto; min-width: 320px; max-width: 480px; border-collapse: collapse; font-size: 10px; table-layout: fixed; }' +
          '.print-fmt-resumo-table th, .print-fmt-resumo-table td { padding: 4px 8px; border-bottom: 1px solid ' + rowLine + '; vertical-align: middle; font-variant-numeric: tabular-nums; }' +
          '.print-fmt-resumo-table thead th { font-size: 8px; font-weight: 500; text-transform: uppercase; letter-spacing: .04em; color: #767676; text-align: right; white-space: nowrap; }' +
          '.print-fmt-resumo-table thead th:first-child, .print-fmt-resumo-table .print-fmt-resumo-fmt { text-align: left; }' +
          '.print-fmt-resumo-table .print-fmt-resumo-num { text-align: right; color: #2f2f2f; white-space: nowrap; }' +
          '.print-fmt-resumo-table .print-fmt-resumo-fmt { color: #2f2f2f; font-weight: 600; }' +
          '.print-fmt-resumo-table .print-fmt-resumo-total td { border-top: 2px solid ' + rowLine + '; border-bottom: 0; padding-top: 6px; font-weight: 600; }';
      }
      function pedidoPdfIframeHead() {
        return '<meta charset="utf-8"><style>' + getPdfFontFaceCss() + printPedidoPrintCss() + '</style>';
      }
      return async function render(thumbs) {
        const layout = printPdfLayout();
        const pageWpx = layout.contentWpx;
        const readyThumbs = await ensurePedidoPdfThumbs(thumbs);
        const html = buildPedidoPrintHtml(readyThumbs);
        const iframe = document.createElement('iframe');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.style.cssText = 'position:fixed;left:0;top:0;width:' + pageWpx + 'px;height:2400px;border:0;opacity:0;pointer-events:none;z-index:2147483646;';
        document.body.appendChild(iframe);
        try {
          const win = iframe.contentWindow;
          const doc = win.document;
          doc.open();
          doc.write(
            '<!DOCTYPE html><html><head>' + pedidoPdfIframeHead() +
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
          const root = doc.querySelector('.print-render-root');
          if (!sheet) throw new Error('Conteúdo do PDF indisponível');
          const measureEl = root || sheet;
          const heightPx = Math.ceil(Math.max(
            measureEl.scrollHeight || 0,
            measureEl.offsetHeight || 0,
            sheet.scrollHeight || 0,
            sheet.offsetHeight || 0,
            280,
          ) + 48);
          const blob = await win.html2pdf().set({
            margin: layout.marginMm,
            filename: pedidoPdfFilename('a4'),
            image: { type: 'jpeg', quality: 0.96 },
            html2canvas: {
              scale: PDF_CANVAS_SCALE,
              useCORS: true,
              allowTaint: false,
              logging: false,
              width: pageWpx,
              windowWidth: pageWpx,
              height: heightPx,
              windowHeight: heightPx,
              backgroundColor: pdfCanvasBackground(PDF_THEME),
              onclone: injectPdfFontClone,
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'], avoid: ['.print-pedido-table tbody tr', '.print-footer', '.print-fmt-resumo-wrap'] },
          }).from(measureEl).outputPdf('blob');
          if (!blob || blob.size < 12000) throw new Error('PDF gerado vazio');
          return blob;
        } finally {
          iframe.remove();
        }
      };
    })();
  `.trim();
}
