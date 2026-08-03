import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { registerJsPdfDin1451Fonts, normalizePdfText } from '@/lib/jspdfNotoFont';
import {
  openPrintWindowOrShareHtml,
  shareOrDownloadBlob,
} from '@/lib/mobilePrintAndShare';

const PDF_FONT_BOLD = 'bold';
const PDF_FONT_NORMAL = 'normal';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const safePdf = (text) => normalizePdfText(text);

export function getEmpresaDisplayName(empresa) {
  return empresa?.nome_fantasia?.trim() || empresa?.razao_social?.trim() || 'Empresa';
}

function formatQty(value) {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return '0';
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function buildReportFilename(cotacao, ext) {
  const num = String(cotacao?.numero || 'cotacao').replace(/\s+/g, '-');
  return `solicitacao-cotacao-${num}.${ext}`;
}

function buildP38FooterHtml() {
  return `
    <footer class="p38-footer" aria-label="P-38 ERP">
      <span class="p38-mark">P-38</span>
      <span class="p38-sep" aria-hidden="true">|</span>
      <span class="p38-erp">ERP</span>
    </footer>`;
}

function buildReportStyles() {
  return `
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'DINish', 'DIN 1451', system-ui, -apple-system, sans-serif;
      font-size: 14px;
      line-height: 1.45;
      color: #1f1d22;
      background: #f8f8f9;
      padding: 16px;
    }
    .doc {
      max-width: 820px;
      margin: 0 auto;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,.06);
      overflow: hidden;
    }
    .doc-inner { padding: 24px 20px 28px; }
    .empresa-nome {
      font-size: clamp(1.15rem, 4vw, 1.5rem);
      font-weight: 700;
      letter-spacing: -0.02em;
      margin: 0 0 4px;
      color: #1f1d22;
    }
    .empresa-meta {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 20px;
    }
    .doc-title {
      font-size: clamp(1rem, 3.5vw, 1.125rem);
      font-weight: 600;
      margin: 0 0 6px;
      color: #4a5240;
    }
    .doc-sub {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 20px;
    }
    .destinatario {
      background: #f4f5f2;
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 20px;
      font-size: 13px;
    }
    .destinatario strong { color: #4a5240; }
    .instrucoes {
      font-size: 12px;
      color: #4b5563;
      background: #fafafa;
      border-left: 3px solid #a4ce33;
      padding: 10px 12px;
      border-radius: 0 8px 8px 0;
      margin: 20px 0 0;
    }
    .table-wrap { display: none; }
    .cards { display: flex; flex-direction: column; gap: 10px; }
    .item-card {
      border: 1px solid #ececf0;
      border-radius: 12px;
      padding: 12px 14px;
      background: #fff;
    }
    .item-card .nome { font-weight: 600; font-size: 14px; margin-bottom: 6px; }
    .item-card .meta { font-size: 12px; color: #6b7280; display: flex; flex-wrap: wrap; gap: 8px 14px; }
    .item-card .meta span strong { color: #374151; }
  .p38-footer {
      margin-top: 28px;
      padding-top: 16px;
      border-top: 1px solid #ececf0;
      text-align: center;
      font-size: 11px;
      color: #9ca3af;
    }
    .p38-mark { font-weight: 700; color: #4a5240; letter-spacing: -0.02em; }
    .p38-sep { opacity: 0.45; margin: 0 5px; font-weight: 300; }
    .p38-erp {
      font-weight: 400;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      font-size: 10px;
      color: #6b7280;
    }
    @media (min-width: 640px) {
      body { padding: 28px 20px; }
      .doc-inner { padding: 32px 36px 36px; }
      .table-wrap { display: block; overflow-x: auto; }
      .cards { display: none; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      thead th {
        text-align: left;
        padding: 10px 12px;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #6b7280;
        background: #f4f5f2;
        border-bottom: 1px solid #e5e7eb;
      }
      thead th.num { text-align: right; }
      tbody td {
        padding: 10px 12px;
        border-bottom: 1px solid #f3f4f6;
        vertical-align: top;
      }
      tbody td.num { text-align: right; white-space: nowrap; }
      tbody tr:last-child td { border-bottom: none; }
    }
    @media print {
      body { background: #fff; padding: 0; }
      .doc { box-shadow: none; border-radius: 0; max-width: none; }
      .doc-inner { padding: 12mm 14mm 16mm; }
      .table-wrap { display: block !important; }
      .cards { display: none !important; }
      @page { size: A4 portrait; margin: 12mm; }
    }
  `;
}

/**
 * HTML responsivo (mobile: cards; desktop: tabela). Impressão navegador → A4.
 */
export function buildCotacaoFornecedorReportHtml({
  cotacao,
  empresa = null,
  fornecedor = null,
}) {
  const empresaNome = getEmpresaDisplayName(empresa);
  const dataFmt = format(
    new Date(cotacao?.data_abertura || Date.now()),
    "dd 'de' MMMM 'de' yyyy",
    { locale: ptBR },
  );
  const geradoEm = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
  const itens = cotacao?.itens || [];

  const tableRows = itens.map((item, idx) => `
    <tr>
      <td class="num">${idx + 1}</td>
      <td>${escapeHtml(item.produto_nome)}</td>
      <td>${escapeHtml(item.codigo_interno || '—')}</td>
      <td class="num">${formatQty(item.quantidade)}</td>
      <td>${escapeHtml(item.unidade || 'UN')}</td>
    </tr>`).join('');

  const cards = itens.map((item, idx) => `
    <article class="item-card">
      <div class="nome">${idx + 1}. ${escapeHtml(item.produto_nome)}</div>
      <div class="meta">
        <span>Cód. <strong>${escapeHtml(item.codigo_interno || '—')}</strong></span>
        <span>Qtd <strong>${formatQty(item.quantidade)} ${escapeHtml(item.unidade || 'UN')}</strong></span>
      </div>
    </article>`).join('');

  const empresaExtras = [
    empresa?.cnpj && `CNPJ ${empresa.cnpj}`,
    empresa?.cidade && empresa?.estado && `${empresa.cidade}/${empresa.estado}`,
    empresa?.telefone,
    empresa?.email,
  ].filter(Boolean).join(' · ');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Solicitação de Cotação — ${escapeHtml(cotacao?.numero)}</title>
  <style>${buildReportStyles()}</style>
</head>
<body>
  <div class="doc">
    <div class="doc-inner">
      <h1 class="empresa-nome">${escapeHtml(empresaNome)}</h1>
      ${empresaExtras ? `<p class="empresa-meta">${escapeHtml(empresaExtras)}</p>` : '<p class="empresa-meta"></p>'}
      <h2 class="doc-title">Solicitação de Cotação</h2>
      <p class="doc-sub">
        ${escapeHtml(cotacao?.numero || '')} · ${escapeHtml(cotacao?.titulo || '')} · ${dataFmt}
      </p>
      ${fornecedor?.nome ? `
        <div class="destinatario">
          <strong>Para:</strong> ${escapeHtml(fornecedor.nome)}
          ${fornecedor.email ? `<br /><span style="color:#6b7280">${escapeHtml(fornecedor.email)}</span>` : ''}
        </div>` : ''}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="num">#</th>
              <th>Produto</th>
              <th>Código</th>
              <th class="num">Quantidade</th>
              <th>Un.</th>
            </tr>
          </thead>
          <tbody>${tableRows || '<tr><td colspan="5" style="text-align:center;color:#9ca3af">Nenhum item</td></tr>'}</tbody>
        </table>
      </div>
      <div class="cards">${cards || '<p style="color:#9ca3af;text-align:center">Nenhum item</p>'}</div>
      <p class="instrucoes">
        Favor enviar proposta com <strong>preços unitários</strong>, prazo de entrega, marca/referência quando aplicável e condições de pagamento.
      </p>
      ${buildP38FooterHtml()}
      <p style="margin-top:8px;text-align:center;font-size:10px;color:#c4c4c4">Gerado em ${geradoEm}</p>
    </div>
  </div>
</body>
</html>`;
}

export async function exportCotacaoFornecedorHtml(payload) {
  const { cotacao } = payload;
  const html = buildCotacaoFornecedorReportHtml(payload);
  const filename = buildReportFilename(cotacao, 'html');
  const title = `Solicitação ${cotacao?.numero || ''}`;
  return openPrintWindowOrShareHtml(html, filename, title, { closeAfterPrint: false });
}

function drawPdfFooter(doc, pageW, pageH, fontFamily) {
  const y = pageH - 8;
  doc.setDrawColor(220, 220, 220);
  doc.line(15, y - 4, pageW - 15, y - 4);
  doc.setFontSize(7.5);
  doc.setTextColor(156, 163, 175);
  const centerX = pageW / 2;
  doc.setFont(fontFamily, PDF_FONT_BOLD);
  doc.setTextColor(74, 82, 64);
  const p38W = doc.getTextWidth('P-38');
  doc.text('P-38', centerX - p38W / 2 - 4, y);
  doc.setFont(fontFamily, PDF_FONT_NORMAL);
  doc.setTextColor(156, 163, 175);
  doc.text('|', centerX - 1, y);
  doc.setFontSize(6.5);
  doc.text('ERP', centerX + 3, y);
}

/**
 * PDF programático — sempre A4 retrato, com quebra de página.
 */
export async function generateCotacaoFornecedorPdf({
  cotacao,
  empresa = null,
  fornecedor = null,
}) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const fontFamily = await registerJsPdfDin1451Fonts(doc);

  const pageW = 210;
  const pageH = 297;
  const M = 15;
  const contentBottom = pageH - 18;
  let y = M;

  const ensureSpace = (needed) => {
    if (y + needed > contentBottom) {
      drawPdfFooter(doc, pageW, pageH, fontFamily);
      doc.addPage();
      y = M;
    }
  };

  const empresaNome = getEmpresaDisplayName(empresa);
  doc.setFont(fontFamily, PDF_FONT_BOLD);
  doc.setFontSize(16);
  doc.setTextColor(31, 29, 34);
  doc.text(safePdf(empresaNome), M, y);
  y += 7;

  doc.setFont(fontFamily, PDF_FONT_NORMAL);
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  const extras = [
    empresa?.cnpj && `CNPJ ${empresa.cnpj}`,
    empresa?.cidade && empresa?.estado && `${empresa.cidade}/${empresa.estado}`,
  ].filter(Boolean).join(' · ');
  if (extras) {
    doc.text(safePdf(extras), M, y);
    y += 5;
  }

  y += 4;
  doc.setFont(fontFamily, PDF_FONT_BOLD);
  doc.setFontSize(13);
  doc.setTextColor(74, 82, 64);
  doc.text('Solicitação de Cotação', M, y);
  y += 6;

  doc.setFont(fontFamily, PDF_FONT_NORMAL);
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  const dataFmt = format(
    new Date(cotacao?.data_abertura || Date.now()),
    'dd/MM/yyyy',
    { locale: ptBR },
  );
  doc.text(
    safePdf(`${cotacao?.numero || ''} · ${cotacao?.titulo || ''} · ${dataFmt}`),
    M,
    y,
  );
  y += 8;

  if (fornecedor?.nome) {
    ensureSpace(12);
    doc.setFillColor(244, 245, 242);
    doc.roundedRect(M, y - 4, pageW - M * 2, 10, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);
    doc.setFont(fontFamily, PDF_FONT_BOLD);
    doc.text('Para: ', M + 3, y + 2);
    doc.setFont(fontFamily, PDF_FONT_NORMAL);
    doc.text(safePdf(fornecedor.nome), M + 14, y + 2);
    y += 12;
  }

  const col = { num: M, prod: M + 8, cod: M + 95, qtd: M + 125, un: M + 148 };
  const drawTableHeader = () => {
    doc.setFillColor(244, 245, 242);
    doc.rect(M, y - 4, pageW - M * 2, 7, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor(107, 114, 128);
    doc.setFont(fontFamily, PDF_FONT_BOLD);
    doc.text('#', col.num + 1, y);
    doc.text('PRODUTO', col.prod, y);
    doc.text('CÓDIGO', col.cod, y);
    doc.text('QTD', col.qtd, y);
    doc.text('UN', col.un, y);
    y += 6;
    doc.setFont(fontFamily, PDF_FONT_NORMAL);
    doc.setTextColor(31, 29, 34);
  };

  ensureSpace(14);
  drawTableHeader();

  const itens = cotacao?.itens || [];
  itens.forEach((item, idx) => {
    const nomeLines = doc.splitTextToSize(safePdf(item.produto_nome || ''), 82);
    const rowH = Math.max(nomeLines.length, 1) * 4.2 + 2;
    ensureSpace(rowH + 2);
    doc.setFontSize(9);
    doc.text(String(idx + 1), col.num + 1, y);
    doc.text(nomeLines, col.prod, y);
    doc.text(safePdf(item.codigo_interno || '—'), col.cod, y);
    doc.text(formatQty(item.quantidade), col.qtd, y);
    doc.text(safePdf(item.unidade || 'UN'), col.un, y);
    y += rowH;
    doc.setDrawColor(243, 244, 246);
    doc.line(M, y - 1, pageW - M, y - 1);
  });

  ensureSpace(16);
  y += 4;
  doc.setFontSize(8.5);
  doc.setTextColor(75, 85, 99);
  const instr = doc.splitTextToSize(
    safePdf(
      'Favor enviar proposta com preços unitários, prazo de entrega, marca/referência quando aplicável e condições de pagamento.',
    ),
    pageW - M * 2,
  );
  doc.text(instr, M, y);
  y += instr.length * 4 + 4;

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    drawPdfFooter(doc, pageW, pageH, fontFamily);
  }

  return doc.output('blob');
}

export async function exportCotacaoFornecedorPdf(payload) {
  const { cotacao } = payload;
  const blob = await generateCotacaoFornecedorPdf(payload);
  const filename = buildReportFilename(cotacao, 'pdf');
  const title = `Solicitação ${cotacao?.numero || ''}`;
  return shareOrDownloadBlob(blob, filename, 'application/pdf', title);
}

/**
 * Monta payload de cotação com códigos do catálogo quando disponíveis.
 */
export function enrichCotacaoItensComCatalogo(cotacao, produtosMap = {}) {
  const itens = (cotacao?.itens || []).map((item) => {
    const produto = produtosMap[item.produto_id];
    return {
      ...item,
      codigo_interno: produto?.codigo_interno || item.codigo_interno || '',
    };
  });
  return { ...cotacao, itens };
}
