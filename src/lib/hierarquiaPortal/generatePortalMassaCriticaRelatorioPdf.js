import { jsPDF } from 'jspdf';
import { registerJsPdfDin1451Fonts, normalizePdfText } from '@/lib/jspdfNotoFont';

const M = 12;
const FOOTER_H = 10;
const safe = (text) => normalizePdfText(text);
const fmtR = (n) => (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moeda = (v) => `R$ ${fmtR(Number(v) || 0)}`;
const moedaOuTraco = (v) => (Number(v) > 0 ? moeda(v) : '—');

const ENXUTO = {
  black: [0, 0, 0],
  muted: [72, 72, 72],
  line: [110, 110, 110],
  rowRule: [220, 220, 220],
  section: [245, 245, 245],
};

function ensureSpace(doc, y, need, pageH) {
  if (y + need <= pageH - FOOTER_H) return y;
  doc.addPage();
  return M + 4;
}

function drawFooter(doc, fontFamily, pageNum, totalPages) {
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...ENXUTO.muted);
  doc.text(`Página ${pageNum} / ${totalPages}`, pageW - M, pageH - 6, { align: 'right' });
}

export async function generatePortalMassaCriticaRelatorioPdf(payload = {}) {
  const {
    esquadras = [],
    totais = {},
    parametros = {},
    filters_summary: filtersSummary = '',
    generated_at: generatedAt = new Date().toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }),
  } = payload;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const fontFamily = await registerJsPdfDin1451Fonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const massa = parametros.massa_critica_cx ?? 16;
  const minLinhas = parametros.min_linhas_saldavel ?? 9;

  let y = M;

  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...ENXUTO.black);
  doc.text(safe('Investimento massa crítica — Portal cerâmica'), M, y);
  y += 6;

  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...ENXUTO.muted);
  doc.text(safe(`Gerado em ${generatedAt}`), M, y);
  y += 4.5;
  if (filtersSummary) {
    const filterLines = doc.splitTextToSize(safe(`Filtros: ${filtersSummary}`), pageW - M * 2);
    doc.text(filterLines, M, y);
    y += filterLines.length * 4.2 + 2;
  }

  doc.setFontSize(8.5);
  doc.text(
    safe(
      `Meta saldável: ${minLinhas} modelos com ≥ ${massa} CX · custo = preco_custo_calculado do catálogo (por CX)`,
    ),
    M,
    y,
  );
  y += 7;

  doc.setFillColor(...ENXUTO.section);
  doc.rect(M, y, pageW - M * 2, 16, 'F');
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...ENXUTO.black);
  doc.text(safe(`${totais.esquadras ?? 0} esquadras filtradas`), M + 3, y + 5);
  doc.text(safe(`${totais.esquadras_saldaveis ?? 0} já saldáveis`), M + 3, y + 10);
  doc.text(safe(`Invest. p/ saldável: ${moeda(totais.custo_para_saldavel)}`), M + 68, y + 5);
  doc.text(safe(`Completar todos abaixo: ${moeda(totais.custo_completar_abaixo)}`), M + 68, y + 10);
  y += 20;

  const col = {
    linha: M,
    linhaW: 38,
    esquadra: M + 40,
    esquadraW: 52,
    massa: M + 94,
    invest: M + 112,
    media: M + 142,
    skus: pageW - M,
  };

  const drawEsquadraHeader = () => {
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...ENXUTO.muted);
    doc.text('LINHA', col.linha, y);
    doc.text('ESQUADRA', col.esquadra, y);
    doc.text('MASSA', col.massa, y, { align: 'right' });
    doc.text('INVEST.', col.invest, y, { align: 'right' });
    doc.text('MÉD/MOD', col.media, y, { align: 'right' });
    doc.text('SKUs', col.skus, y, { align: 'right' });
    y += 3;
    doc.setDrawColor(...ENXUTO.line);
    doc.setLineWidth(0.15);
    doc.line(M, y, pageW - M, y);
    y += 4;
  };

  drawEsquadraHeader();

  for (const eq of esquadras) {
    y = ensureSpace(doc, y, 8, pageH);
    if (y <= M + 8) drawEsquadraHeader();

    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...ENXUTO.black);

    const linhaLines = doc.splitTextToSize(safe(eq.linha_nome || ''), col.linhaW);
    const esquadraLines = doc.splitTextToSize(safe(eq.produto_compra_nome || ''), col.esquadraW);
    const rowH = Math.max(linhaLines.length, esquadraLines.length, 1) * 4.2 + 1;

    doc.text(linhaLines, col.linha, y);
    doc.text(esquadraLines, col.esquadra, y);
    doc.text(
      safe(`${eq.linhas_com_massa}/${eq.min_linhas_saldavel}`),
      col.massa,
      y,
      { align: 'right' },
    );
    doc.text(moedaOuTraco(eq.custo_para_saldavel), col.invest, y, { align: 'right' });
    doc.text(moedaOuTraco(eq.media_investimento_modelo), col.media, y, { align: 'right' });
    doc.text(String(eq.sku_count ?? 0), col.skus, y, { align: 'right' });
    y += rowH;

    doc.setDrawColor(...ENXUTO.rowRule);
    doc.setLineWidth(0.08);
    doc.line(M, y - 1, pageW - M, y - 1);
  }

  const detalheEsquadras = esquadras.filter(
    (eq) => !eq.saldavel && (eq.custo_para_saldavel > 0 || eq.skus?.some((s) => s.prioridade_saldavel)),
  );

  if (detalheEsquadras.length) {
    y = ensureSpace(doc, y, 14, pageH);
    y += 4;
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...ENXUTO.black);
    doc.text(safe('Detalhe — modelos prioritários por esquadra'), M, y);
    y += 6;

    for (const eq of detalheEsquadras) {
      y = ensureSpace(doc, y, 12, pageH);
      doc.setFont(fontFamily, 'bold');
      doc.setFontSize(9);
      doc.text(
        safe(`${eq.linha_nome} · ${eq.produto_compra_nome} — invest. saldável ${moeda(eq.custo_para_saldavel)}`),
        M,
        y,
      );
      y += 5;

      const skusPrioritarios = (eq.skus || []).filter((s) => s.prioridade_saldavel || !s.atinge_massa);
      for (const sku of skusPrioritarios) {
        y = ensureSpace(doc, y, 6, pageH);
        doc.setFont(fontFamily, 'normal');
        doc.setFontSize(8.2);
        doc.setTextColor(...ENXUTO.black);
        const flag = sku.prioridade_saldavel ? '★' : '·';
        const linha = `${flag} ${sku.eixos || sku.nome} — ${sku.cx_atual} CX → faltam ${sku.cx_faltam} · ${moeda(sku.custo_estimado)}`;
        const lines = doc.splitTextToSize(safe(linha), pageW - M * 2 - 4);
        doc.text(lines, M + 2, y);
        y += lines.length * 4 + 1;
      }
      y += 2;
    }
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    drawFooter(doc, fontFamily, p, totalPages);
  }

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `portal-massa-critica-${stamp}.pdf`;
  a.click();
  URL.revokeObjectURL(url);

  return { ok: true, esquadras: esquadras.length };
}
