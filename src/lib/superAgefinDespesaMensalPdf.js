/**
 * SUPERAGEFIN — PDF «Despesa Mensal» (A4).
 *
 * Margens: topo 25 mm (2,5 cm — grampeamento), base 15 mm (1,5 cm — numeração).
 * Cabeçalho: «DESPESA MENSAL - MÊS / ANO» | «TOTAL R$ …»
 * Card do dia: «08/08/2026 (04)» à esquerda · valor à direita.
 * Folha / budgets: 1 coluna; cada bloco só desenha se couber (senão nova página).
 */

import { jsPDF } from 'jspdf';
import { registerJsPdfNotoFonts, normalizePdfText } from '@/lib/jspdfNotoFont';
import { shareOrDownloadBlob, shouldUseMobileDocumentExport, downloadBlob } from '@/lib/mobilePrintAndShare';
import { lancamentoPago, lancamentoVencidoOuAtrasado } from '@/lib/agefinConsultaFilters';

const PAGE_W = 210;
const PAGE_H = 297;
/** 2,5 cm — orelha / grampeamento */
const MARGIN_TOP = 25;
/** 1,5 cm — numeração */
const MARGIN_BOTTOM = 15;
const MARGIN_X = 8;
/** Conteúdo começa abaixo da margem superior (cabeçalho vive dentro da margem) */
const CONTENT_TOP = MARGIN_TOP + 1;
const CONTENT_BOTTOM = PAGE_H - MARGIN_BOTTOM;

function formatCurrency(value) {
  return `R$ ${(Number(value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

/** Ex.: «AGOSTO / 2026» */
export function formatMesAnoTitulo(date) {
  const d = date instanceof Date ? date : new Date(date);
  const mes = d.toLocaleDateString('pt-BR', { month: 'long' }).toLocaleUpperCase('pt-BR');
  return `${mes} / ${d.getFullYear()}`;
}

function statusConta(conta) {
  if (lancamentoPago(conta)) return 'Pago';
  if (lancamentoVencidoOuAtrasado(conta)) return 'Vencido';
  return '';
}

function pad2(n) {
  return String(Number(n) || 0).padStart(2, '0');
}

/**
 * Abre o PDF no browser (desktop) ou partilha/descarrega (mobile).
 */
export async function entregarPdfBlob(blob, filename, title) {
  if (shouldUseMobileDocumentExport()) {
    return shareOrDownloadBlob(blob, filename, 'application/pdf', title || filename);
  }
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) {
    downloadBlob(blob, filename);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return 'downloaded';
  }
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
  return 'opened';
}

/**
 * @param {{
 *   currentMonth: Date,
 *   totalImpresso: number,
 *   grupos: Array<{ key: string, label: string, contas: object[] }>,
 *   dataPagamentoFolha?: string,
 *   folha?: { competencia: string, linhas: Array<{ nome: string, salario: number, liquido: number }>, dataPagamento: string } | null,
 *   budgetsAgrupados?: { competencia: string, grupos: Array<{ centro: string, totalOrcado: number, itens: object[] }>, totalOrcado: number } | null,
 * }} opts
 */
export async function gerarDespesaMensalPdf(opts) {
  const {
    currentMonth,
    totalImpresso,
    grupos = [],
    dataPagamentoFolha = '',
    folha = null,
    budgetsAgrupados = null,
  } = opts;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const fontFamily = await registerJsPdfNotoFonts(pdf);
  const setFont = (style = 'normal') => pdf.setFont(fontFamily, style);

  const contentW = PAGE_W - MARGIN_X * 2;
  const mesAno = formatMesAnoTitulo(currentMonth);
  const tituloEsq = normalizePdfText(`DESPESA MENSAL - ${mesAno}`);
  const tituloDir = normalizePdfText(`TOTAL ${formatCurrency(totalImpresso)}`);

  let y = CONTENT_TOP;

  const drawHeader = () => {
    setFont('bold');
    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);
    // Dentro da margem superior (abaixo da zona de grampeamento)
    const headerY = MARGIN_TOP - 8;
    pdf.text(tituloEsq, MARGIN_X, headerY);
    pdf.text(tituloDir, PAGE_W - MARGIN_X, headerY, { align: 'right' });
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.25);
    pdf.line(MARGIN_X, MARGIN_TOP - 2, PAGE_W - MARGIN_X, MARGIN_TOP - 2);
  };

  const drawPageNumbers = () => {
    const total = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= total; i += 1) {
      pdf.setPage(i);
      setFont('normal');
      pdf.setFontSize(9);
      pdf.setTextColor(80, 80, 80);
      const label = normalizePdfText(`${i} / ${total}`);
      // Centrado na margem inferior de 1,5 cm
      pdf.text(label, PAGE_W / 2, PAGE_H - MARGIN_BOTTOM / 2, { align: 'center' });
    }
  };

  const newPage = () => {
    pdf.addPage();
    drawHeader();
    y = CONTENT_TOP;
  };

  /** Garante espaço; se não couber, começa página nova (nunca desenha para além da margem). */
  const ensureSpace = (neededMm) => {
    if (y + neededMm <= CONTENT_BOTTOM) return true;
    newPage();
    return y + neededMm <= CONTENT_BOTTOM;
  };

  drawHeader();

  /** —— Contas por data —— */
  for (const grupo of grupos) {
    const contas = grupo.contas || [];
    const subtotal = contas.reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
    const diaH = 7.5;

    ensureSpace(diaH + 12);
    // Card do dia: «08/08/2026 (04)» esquerda · valor direita
    pdf.setFillColor(237, 240, 244);
    pdf.rect(MARGIN_X, y, contentW, diaH, 'F');
    setFont('bold');
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    const labelDia = normalizePdfText(`${grupo.label || ''} (${pad2(contas.length)})`);
    pdf.text(labelDia, MARGIN_X + 2, y + 5);
    setFont('normal');
    pdf.text(normalizePdfText(formatCurrency(subtotal)), PAGE_W - MARGIN_X - 2, y + 5, {
      align: 'right',
    });
    y += diaH + 1.5;

    // Status estreito → menos recuo na descrição; mais respiro vertical
    const colStatus = MARGIN_X + 1;
    const colConta = MARGIN_X + 18;
    const colValor = PAGE_W - MARGIN_X - 1;
    const rowH = 9.5;

    for (const conta of contas) {
      ensureSpace(rowH + 0.5);
      const st = statusConta(conta);
      const desc = normalizePdfText(String(conta.descricao || '-').toUpperCase());
      const valor = normalizePdfText(formatCurrency(conta.valor));
      const textY = y + rowH * 0.62;

      setFont('normal');
      pdf.setFontSize(8);
      if (st === 'Pago') pdf.setTextColor(85, 107, 47);
      else if (st === 'Vencido') pdf.setTextColor(139, 47, 47);
      else pdf.setTextColor(120, 120, 120);
      if (st) pdf.text(st, colStatus, textY);

      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(9.5);
      const maxDescW = colValor - colConta - 34;
      const descLines = pdf.splitTextToSize(desc, maxDescW);
      pdf.text(descLines[0] || '-', colConta, textY);
      pdf.text(valor, colValor, textY, { align: 'right' });

      pdf.setDrawColor(230, 235, 242);
      pdf.setLineWidth(0.15);
      pdf.line(MARGIN_X, y + rowH, PAGE_W - MARGIN_X, y + rowH);
      y += rowH;
    }

    y += 3;

    /** Folha analógica após o dia 5 — 1 coluna, quebra por cartão */
    if (grupo.key === dataPagamentoFolha && folha?.linhas?.length) {
      y = desenharFolhaPdf(pdf, {
        folha,
        setFont,
        y,
        ensureSpace,
        contentW,
        formatCurrency,
      });
      y += 4;
    }
  }

  /** —— Budgets (1 coluna) —— */
  if (budgetsAgrupados?.grupos?.length) {
    const budgetsHeaderH = 11;
    ensureSpace(budgetsHeaderH + 4);
    pdf.setFillColor(226, 232, 240);
    pdf.rect(MARGIN_X, y, contentW, budgetsHeaderH, 'F');
    setFont('bold');
    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);
    pdf.text(normalizePdfText('Budgets — anotações por centro de custo'), MARGIN_X + 2, y + 4.5);
    setFont('normal');
    pdf.setFontSize(8);
    pdf.setTextColor(51, 65, 85);
    pdf.text(
      normalizePdfText(
        `Competência ${budgetsAgrupados.competencia || ''} · 1 coluna · Total orçado: ${formatCurrency(budgetsAgrupados.totalOrcado || 0)}`,
      ),
      MARGIN_X + 2,
      y + 9,
    );
    y += budgetsHeaderH + 2;

    for (const g of budgetsAgrupados.grupos) {
      ensureSpace(10);
      setFont('bold');
      pdf.setFontSize(9);
      pdf.setTextColor(0, 0, 0);
      pdf.text(normalizePdfText(String(g.centro || '').toUpperCase()), MARGIN_X + 1, y + 4);
      setFont('normal');
      pdf.text(
        normalizePdfText(
          `${formatCurrency(g.totalOrcado)} · ${g.itens.length} budget${g.itens.length !== 1 ? 's' : ''}`,
        ),
        PAGE_W - MARGIN_X - 1,
        y + 4,
        { align: 'right' },
      );
      pdf.setDrawColor(148, 163, 184);
      pdf.line(MARGIN_X, y + 5.5, PAGE_W - MARGIN_X, y + 5.5);
      y += 8;

      for (const v of g.itens) {
        const cardH = 44;
        ensureSpace(cardH + 2);
        const nome = normalizePdfText(
          String(v.modelo?.nome || v.modelo?.categoria_nome || 'Budget').toUpperCase(),
        );
        const cat = normalizePdfText(String(v.modelo?.categoria_nome || '').trim());
        const valor = Number(v.orcado) || 0;

        pdf.setDrawColor(203, 213, 225);
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(MARGIN_X, y, contentW, cardH, 1.5, 1.5, 'FD');

        setFont('bold');
        pdf.setFontSize(9);
        pdf.setTextColor(0, 0, 0);
        pdf.text(nome, MARGIN_X + 3, y + 5);
        let ty = y + 9;
        if (cat) {
          setFont('normal');
          pdf.setFontSize(7);
          pdf.setTextColor(71, 85, 105);
          pdf.text(cat, MARGIN_X + 3, ty);
          ty += 4;
        }
        setFont('bold');
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        pdf.text(normalizePdfText(formatCurrency(valor)), MARGIN_X + 3, ty + 1);
        ty += 5;
        setFont('normal');
        pdf.setFontSize(7);
        pdf.setTextColor(100, 116, 139);
        pdf.text(normalizePdfText('ANOTAÇÕES / RASCUNHOS'), MARGIN_X + 3, ty);
        ty += 2;
        pdf.setDrawColor(148, 163, 184);
        pdf.setLineWidth(0.2);
        for (let i = 0; i < 6; i += 1) {
          ty += 4;
          if (ty > y + cardH - 2) break;
          pdf.setLineDashPattern([0.8, 0.8], 0);
          pdf.line(MARGIN_X + 3, ty, PAGE_W - MARGIN_X - 3, ty);
        }
        pdf.setLineDashPattern([], 0);
        y += cardH + 3;
      }
      y += 2;
    }
  }

  /** —— Espaço livre para anotações (só o que couber nesta página) —— */
  const anotacoesMin = 24;
  if (y + anotacoesMin <= CONTENT_BOTTOM) {
    setFont('bold');
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.text(normalizePdfText('Anotações >'), MARGIN_X, y + 4);
    setFont('normal');
    pdf.setFontSize(8);
    pdf.setTextColor(51, 65, 85);
    pdf.text(normalizePdfText('escreva abaixo'), MARGIN_X, y + 8);
    y += 12;
    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.2);
    while (y + 2 < CONTENT_BOTTOM) {
      pdf.setLineDashPattern([0.6, 0.8], 0);
      pdf.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
      y += 6;
    }
    pdf.setLineDashPattern([], 0);
  }

  drawPageNumbers();

  const blob = pdf.output('blob');
  const ym = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
  const filename = `despesa-mensal-${ym}.pdf`;
  const title = `Despesa Mensal - ${mesAno}`;
  await entregarPdfBlob(blob, filename, title);
  return { blob, filename };
}

/** Folha em 1 coluna: cada cartão cabe inteiro ou vai para a página seguinte. */
function desenharFolhaPdf(pdf, { folha, setFont, y, ensureSpace, contentW, formatCurrency }) {
  const cardH = 68;
  const headerH = 11;
  const gap = 3;

  ensureSpace(headerH + 4);
  pdf.setFillColor(226, 232, 240);
  pdf.rect(MARGIN_X, y, contentW, headerH, 'F');
  setFont('bold');
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);
  pdf.text(normalizePdfText('Folha de pagamento (funcionários) — 1 coluna'), MARGIN_X + 2, y + 4.2);
  setFont('normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(51, 65, 85);
  pdf.text(
    normalizePdfText(
      `Competência ${folha.competencia || ''} · Sócios não entram · Espaço para anotações à mão`,
    ),
    MARGIN_X + 2,
    y + 8.5,
  );
  y += headerH + 2;

  for (const row of folha.linhas || []) {
    ensureSpace(cardH + gap);
    const x = MARGIN_X;
    const w = contentW;

    pdf.setDrawColor(203, 213, 225);
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(x, y, w, cardH, 1.2, 1.2, 'FD');

    setFont('bold');
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    const nomeLines = pdf.splitTextToSize(
      normalizePdfText(String(row.nome || '').toUpperCase()),
      w - 6,
    );
    pdf.text(nomeLines.slice(0, 2), x + 3, y + 6);

    setFont('normal');
    pdf.setFontSize(10);
    const sal = row.salario > 0 ? formatCurrency(row.salario) : '—';
    pdf.text(normalizePdfText(sal), x + 3, y + 16);

    pdf.setFontSize(7);
    pdf.setTextColor(100, 116, 139);
    pdf.text(normalizePdfText('ANOTAÇÕES'), x + 3, y + 22);

    pdf.setDrawColor(148, 163, 184);
    pdf.setLineWidth(0.18);
    let ly = y + 24;
    for (let n = 0; n < 10; n += 1) {
      ly += 4;
      if (ly > y + cardH - 2) break;
      pdf.setLineDashPattern([0.7, 0.7], 0);
      pdf.line(x + 3, ly, x + w - 3, ly);
    }
    pdf.setLineDashPattern([], 0);
    y += cardH + gap;
  }

  return y;
}
