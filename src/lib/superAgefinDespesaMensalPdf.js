/**
 * SUPERAGEFIN — PDF «Despesa Mensal» (A4).
 *
 * Tipografia: Noto Sans; título e TOTAL do cabeçalho em negrito (tamanho reforçado).
 * Margens: topo 25 mm (2,5 cm — grampeamento), base 15 mm (1,5 cm — numeração).
 * Cabeçalho: «DESPESA MENSAL - MÊS / ANO» | «TOTAL R$ …» — desenhado em TODAS as
 * páginas no fecho (e também ao abrir página nova), sem matriz de escala (a scaleY
 * escondia o texto com a fonte embutida).
 * Card do dia: «08/08/2026 (04)» à esquerda · valor à direita.
 * Folha: 3 colunas; se a linha de cards não cabe, inteira na página seguinte.
 * Quadrinhos de anotações (folha e provisões): nome|valor na mesma linha,
 * sem linhas tracejadas; mesma altura de antes (área em branco para escrever).
 * Provisões: 1 coluna; cabeçalho do centro de custo fica com pelo menos 1 card
 * (não deixa «cabeça sem corpo» no fim da página).
 *
 * Importante: ensureSpace(y, need) devolve o y correcto após eventual nova página
 * (nunca desenhar com um y “antigo” — isso mordia os cards na margem).
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
/** Limite útil: deixa a margem inferior intacta (numeração) + folga anti-sobreposição */
const CONTENT_BOTTOM = PAGE_H - MARGIN_BOTTOM - 1;

/** Título do relatório — negrito, sem transform (visível em todas as páginas) */
const TITLE_SIZE = 15;

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
    pdf.setFontSize(TITLE_SIZE);
    pdf.setTextColor(0, 0, 0);
    const headerY = MARGIN_TOP - 7;
    // Texto directo — sem scaleY/CTM (com Noto a matriz escondia o título).
    pdf.text(tituloEsq, MARGIN_X, headerY);
    pdf.text(tituloDir, PAGE_W - MARGIN_X, headerY, { align: 'right' });
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.3);
    pdf.line(MARGIN_X, MARGIN_TOP - 2, PAGE_W - MARGIN_X, MARGIN_TOP - 2);
  };

  const drawPageChrome = () => {
    const total = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= total; i += 1) {
      pdf.setPage(i);
      drawHeader();
      setFont('normal');
      pdf.setFontSize(9);
      pdf.setTextColor(80, 80, 80);
      const label = normalizePdfText(`${i} / ${total}`);
      pdf.text(label, PAGE_W / 2, PAGE_H - MARGIN_BOTTOM / 2, { align: 'center' });
    }
  };

  const beginPage = () => {
    pdf.addPage();
  };

  /**
   * Se não há espaço para `neededMm` a partir de `yPos`, abre página nova
   * e devolve o y do topo útil. Sempre usar: `y = ensureSpace(y, altura)`.
   */
  const ensureSpace = (yPos, neededMm) => {
    const need = Math.max(0, Number(neededMm) || 0);
    if (yPos + need <= CONTENT_BOTTOM) return yPos;
    beginPage();
    return CONTENT_TOP;
  };

  // Cabeçalho + numeração: drawPageChrome no fecho (todas as páginas).

  /** —— Contas por data —— */
  for (const grupo of grupos) {
    const contas = grupo.contas || [];
    const subtotal = contas.reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
    const diaH = 7.5;

    y = ensureSpace(y, diaH + 12);
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

    const colStatus = MARGIN_X + 1;
    const colConta = MARGIN_X + 18;
    const colValor = PAGE_W - MARGIN_X - 1;
    const rowH = 9.5;

    for (const conta of contas) {
      y = ensureSpace(y, rowH + 0.5);
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

  /** —— Provisões (1 coluna) —— */
  if (budgetsAgrupados?.grupos?.length) {
    const budgetsHeaderH = 11;
    y = ensureSpace(y, budgetsHeaderH + 4);
    pdf.setFillColor(226, 232, 240);
    pdf.rect(MARGIN_X, y, contentW, budgetsHeaderH, 'F');
    setFont('bold');
    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);
    pdf.text(normalizePdfText('PROVISÕES — anotações por centro de custo'), MARGIN_X + 2, y + 4.5);
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
      const centroHeaderH = 8;
      /** Altura original (com linhas); agora limpo, sem tracejado */
      const cardH = 44;
      const cardGap = 3;
      // Não deixar o nome do centro sozinho no fim da página («cabeça sem corpo»):
      // exige espaço para o cabeçalho + pelo menos o 1.º card.
      const primeiroCard = g.itens?.length ? cardH + 2 : 0;
      y = ensureSpace(y, centroHeaderH + primeiroCard);
      setFont('bold');
      pdf.setFontSize(9);
      pdf.setTextColor(0, 0, 0);
      pdf.text(normalizePdfText(String(g.centro || '').toUpperCase()), MARGIN_X + 1, y + 4);
      setFont('normal');
      const qtdItens = g.itens.length;
      const labelQtd = qtdItens === 1 ? '1 PROVISÃO' : `${qtdItens} PROVISÕES`;
      pdf.text(
        normalizePdfText(`${formatCurrency(g.totalOrcado)} · ${labelQtd}`),
        PAGE_W - MARGIN_X - 1,
        y + 4,
        { align: 'right' },
      );
      pdf.setDrawColor(148, 163, 184);
      pdf.line(MARGIN_X, y + 5.5, PAGE_W - MARGIN_X, y + 5.5);
      y += centroHeaderH;

      for (const v of g.itens) {
        y = ensureSpace(y, cardH + 2);
        const nome = normalizePdfText(
          String(v.modelo?.nome || v.modelo?.categoria_nome || 'PROVISÃO').toUpperCase(),
        );
        const cat = normalizePdfText(String(v.modelo?.categoria_nome || '').trim());
        const valorStr = normalizePdfText(formatCurrency(Number(v.orcado) || 0));
        const pad = 3;

        pdf.setDrawColor(203, 213, 225);
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(MARGIN_X, y, contentW, cardH, 1.5, 1.5, 'FD');

        setFont('bold');
        pdf.setFontSize(9);
        pdf.setTextColor(0, 0, 0);
        const valorW = pdf.getTextWidth(valorStr);
        const nomeMaxW = Math.max(40, contentW - pad * 2 - valorW - 4);
        const nomeLines = pdf.splitTextToSize(nome, nomeMaxW).slice(0, 1);
        pdf.text(nomeLines[0] || nome, MARGIN_X + pad, y + 5);
        pdf.text(valorStr, PAGE_W - MARGIN_X - pad, y + 5, { align: 'right' });

        let ty = y + 9;
        if (cat) {
          setFont('normal');
          pdf.setFontSize(7);
          pdf.setTextColor(71, 85, 105);
          pdf.text(cat, MARGIN_X + pad, ty);
          ty += 3.5;
        }
        setFont('normal');
        pdf.setFontSize(7);
        pdf.setTextColor(100, 116, 139);
        pdf.text(normalizePdfText('ANOTAÇÕES / RASCUNHOS'), MARGIN_X + pad, ty + 1);
        // Sem linhas internas — área em branco para anotar à mão
        y += cardH + cardGap;
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

  drawPageChrome();

  const blob = pdf.output('blob');
  const ym = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
  const filename = `despesa-mensal-${ym}.pdf`;
  const title = `Despesa Mensal - ${mesAno}`;
  await entregarPdfBlob(blob, filename, title);
  return { blob, filename };
}

/**
 * Folha em 3 colunas.
 * Quebra por **linha de até 3 cards**: se não cabe, a linha inteira vai para a página seguinte.
 * `ensureSpace(y, need)` devolve o y a usar — obrigatório reatribuir.
 */
function desenharFolhaPdf(pdf, { folha, setFont, y, ensureSpace, contentW, formatCurrency }) {
  const COLS = 3;
  const gap = 2.5;
  const cardW = (contentW - gap * (COLS - 1)) / COLS;
  /** Altura original (com linhas); nome|valor na mesma linha, área em branco */
  const cardH = 72;
  const headerH = 11;

  y = ensureSpace(y, headerH + 4);
  pdf.setFillColor(226, 232, 240);
  pdf.rect(MARGIN_X, y, contentW, headerH, 'F');
  setFont('bold');
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);
  pdf.text(normalizePdfText('Folha de pagamento (funcionários) — 3 colunas'), MARGIN_X + 2, y + 4.2);
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

  const linhas = folha.linhas || [];
  for (let i = 0; i < linhas.length; i += COLS) {
    y = ensureSpace(y, cardH + gap);
    const slice = linhas.slice(i, i + COLS);

    slice.forEach((row, idx) => {
      const x = MARGIN_X + idx * (cardW + gap);
      const pad = 2;

      pdf.setDrawColor(203, 213, 225);
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(x, y, cardW, cardH, 1.2, 1.2, 'FD');

      const sal = row.salario > 0 ? formatCurrency(row.salario) : '—';
      const valorStr = normalizePdfText(sal);

      setFont('bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(0, 0, 0);
      const valorW = pdf.getTextWidth(valorStr);
      const nomeMaxW = Math.max(12, cardW - pad * 2 - valorW - 3);
      const nomeLines = pdf.splitTextToSize(
        normalizePdfText(String(row.nome || '').toUpperCase()),
        nomeMaxW,
      ).slice(0, 2);
      pdf.text(nomeLines, x + pad, y + 5);
      pdf.text(valorStr, x + cardW - pad, y + 5, { align: 'right' });

      const labelY = y + 5 + (nomeLines.length > 1 ? 3.8 : 0) + 4;
      setFont('normal');
      pdf.setFontSize(6.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text(normalizePdfText('ANOTAÇÕES'), x + pad, labelY);
      // Área em branco abaixo (sem linhas internas) para escrever à mão
    });

    y += cardH + gap;
  }

  return y;
}
