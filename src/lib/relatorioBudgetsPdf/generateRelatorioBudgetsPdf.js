import { jsPDF } from 'jspdf';
import { registerJsPdfDin1451Fonts, normalizePdfText } from '@/lib/jspdfNotoFont';
import {
  BUDGET_MODULO_LABEL,
  STATUS_CONSUMO_LABELS,
  calcularOrcadoMensal,
  ordenarModelosPorCentroENome,
} from '@/lib/budgetCalculos';

const COLOR = {
  black: [0, 0, 0],
  muted: [72, 72, 72],
  line: [110, 110, 110],
  lightLine: [220, 220, 220],
};

const FONT = {
  title: 13,
  subtitle: 8.5,
  resumoLabel: 8.2,
  resumoValue: 8.8,
  colHdr: 7.4,
  row: 8.6,
  rowDetail: 7.4,
  footer: 7.6,
};

const safe = (value) => normalizePdfText(value);
const number = (value) => Number(value) || 0;
const moeda = (value) =>
  `R$ ${number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function sortVisoes(visoes = []) {
  return [...visoes].sort((a, b) => {
    const ca = String(a.modelo?.centro_custo || '').toLocaleLowerCase('pt-BR');
    const cb = String(b.modelo?.centro_custo || '').toLocaleLowerCase('pt-BR');
    if (ca !== cb) return ca.localeCompare(cb, 'pt-BR', { sensitivity: 'base' });
    return String(a.modelo?.nome || '').localeCompare(String(b.modelo?.nome || ''), 'pt-BR', {
      sensitivity: 'base',
    });
  });
}

/**
 * PDF com a lista de budgets mensais e valores.
 * Modo `acompanhamento`: orçado, realizado, saldo e situação.
 * Modo `cadastro`: orçado mensal por budget cadastrado.
 */
export async function generateRelatorioBudgetsPdf(payload = {}) {
  const {
    competencia = '',
    competenciaLabel = '',
    modo = 'acompanhamento',
    visoes = [],
    modelos = [],
    totais = {},
    generatedAt = new Date().toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }),
  } = payload;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const font = await registerJsPdfDin1451Fonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const right = pageW - margin;
  const pageBottom = pageH - 10;
  let y = 12;

  const setFont = (style = 'normal', size = 9, color = COLOR.black) => {
    doc.setFont(font, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const strokeH = (yPos, color = COLOR.lightLine, width = 0.06) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(margin, yPos, right, yPos);
  };

  const ensureSpace = (needed) => {
    if (y + needed <= pageBottom) return;
    doc.addPage();
    y = 12;
    setFont('bold', 8, COLOR.muted);
    doc.text(safe(`${BUDGET_MODULO_LABEL.toUpperCase()} — ${competenciaLabel} — continuação`), margin, y);
    y += 6;
  };

  const advance = (dy) => {
    y += dy;
  };

  const drawHeader = () => {
    setFont('bold', FONT.title, COLOR.black);
    doc.text(safe(BUDGET_MODULO_LABEL.toUpperCase()), margin, y);
    setFont('normal', FONT.subtitle, COLOR.muted);
    doc.text(safe(competenciaLabel || competencia), right, y, { align: 'right' });
    advance(5);
    setFont('normal', FONT.subtitle, COLOR.muted);
    doc.text(
      safe(
        modo === 'cadastro'
          ? 'Lista de gastos cadastrados com orçamento mensal'
          : 'Acompanhamento mensal — orçado × realizado',
      ),
      margin,
      y,
    );
    doc.text(safe(`Gerado em ${generatedAt}`), right, y, { align: 'right' });
    advance(4);
    strokeH(y);
    advance(4);
  };

  const drawResumoAcompanhamento = () => {
    if (modo !== 'acompanhamento' || !totais?.count) return;
    const consumo =
      totais.orcado > 0 ? Math.min(100, Math.round((totais.realizado / totais.orcado) * 100)) : 0;
    const items = [
      { label: 'Orçado', value: moeda(totais.orcado) },
      { label: 'Realizado', value: moeda(totais.realizado) },
      { label: 'Saldo', value: moeda(totais.saldo) },
      { label: 'Consumo', value: `${consumo}%` },
      { label: 'Gastos', value: String(totais.count) },
    ];
    const colW = (right - margin) / items.length;
    ensureSpace(12);
    items.forEach((item, index) => {
      const x = margin + colW * index + colW / 2;
      setFont('normal', FONT.resumoLabel, COLOR.muted);
      doc.text(safe(item.label), x, y, { align: 'center' });
      setFont('bold', FONT.resumoValue, COLOR.black);
      doc.text(safe(item.value), x, y + 4, { align: 'center' });
    });
    advance(10);
    strokeH(y);
    advance(3);
  };

  const drawTableHeaderAcompanhamento = () => {
    ensureSpace(8);
    const cols = [
      { label: 'Gasto', x: margin, align: 'left' },
      { label: 'Orçado', x: right - 62, align: 'right' },
      { label: 'Realizado', x: right - 42, align: 'right' },
      { label: 'Saldo', x: right - 22, align: 'right' },
      { label: 'Situação', x: right, align: 'right' },
    ];
    setFont('bold', FONT.colHdr, COLOR.muted);
    cols.forEach((col) => doc.text(safe(col.label), col.x, y, { align: col.align }));
    advance(3);
    strokeH(y, COLOR.line, 0.08);
    advance(2.5);
  };

  const drawTableHeaderCadastro = () => {
    ensureSpace(8);
    const cols = [
      { label: 'Gasto', x: margin, align: 'left' },
      { label: 'Categoria', x: margin + 58, align: 'left' },
      { label: 'Centro', x: margin + 98, align: 'left' },
      { label: 'Orçado/mês', x: right, align: 'right' },
    ];
    setFont('bold', FONT.colHdr, COLOR.muted);
    cols.forEach((col) => doc.text(safe(col.label), col.x, y, { align: col.align }));
    advance(3);
    strokeH(y, COLOR.line, 0.08);
    advance(2.5);
  };

  const drawVisaoRow = (visao) => {
    const nome = String(visao.modelo?.nome || '—');
    const detalhe = String(visao.estimativaResumo || visao.modelo?.categoria_nome || '').trim();
    const nomeLines = doc.splitTextToSize(safe(nome), 78);
    const detalheLines = detalhe ? doc.splitTextToSize(safe(detalhe), 78) : [];
    const rowH = Math.max(5.5, nomeLines.length * 3.6 + detalheLines.length * 3.1 + (detalheLines.length ? 1 : 0));
    ensureSpace(rowH + 1.5);

    setFont('bold', FONT.row, COLOR.black);
    nomeLines.forEach((line, index) => doc.text(line, margin, y + index * 3.6));
    if (detalheLines.length) {
      setFont('normal', FONT.rowDetail, COLOR.muted);
      const detalheY = y + nomeLines.length * 3.6 + 0.8;
      detalheLines.forEach((line, index) => doc.text(line, margin, detalheY + index * 3.1));
    }

    setFont('normal', FONT.row, COLOR.black);
    doc.text(safe(moeda(visao.orcado)), right - 62, y, { align: 'right' });
    doc.text(safe(moeda(visao.realizado)), right - 42, y, { align: 'right' });
    doc.text(safe(moeda(visao.saldo)), right - 22, y, { align: 'right' });
    setFont('normal', FONT.rowDetail, COLOR.muted);
    doc.text(safe(STATUS_CONSUMO_LABELS[visao.status] || '—'), right, y, { align: 'right' });

    advance(rowH);
    strokeH(y, COLOR.lightLine, 0.05);
    advance(1.5);
  };

  const drawModeloRow = (modelo, competenciaMes) => {
    const nome = String(modelo.nome || '—');
    const categoria = String(modelo.categoria_nome || '—');
    const centro = String(modelo.centro_custo || '—');
    const orcado = calcularOrcadoMensal(modelo, competenciaMes);
    const nomeLines = doc.splitTextToSize(safe(nome), 52);
    const rowH = Math.max(5.5, nomeLines.length * 3.6);
    ensureSpace(rowH + 1.5);

    setFont('bold', FONT.row, COLOR.black);
    nomeLines.forEach((line, index) => doc.text(line, margin, y + index * 3.6));
    setFont('normal', FONT.row, COLOR.black);
    doc.text(safe(categoria), margin + 58, y);
    doc.text(safe(centro), margin + 98, y);
    doc.text(safe(moeda(orcado)), right, y, { align: 'right' });

    advance(rowH);
    strokeH(y, COLOR.lightLine, 0.05);
    advance(1.5);
  };

  const drawTotalRow = () => {
    if (modo !== 'acompanhamento' || !totais?.count) return;
    ensureSpace(8);
    setFont('bold', FONT.row, COLOR.black);
    doc.text(safe('Total'), margin, y);
    doc.text(safe(moeda(totais.orcado)), right - 62, y, { align: 'right' });
    doc.text(safe(moeda(totais.realizado)), right - 42, y, { align: 'right' });
    doc.text(safe(moeda(totais.saldo)), right - 22, y, { align: 'right' });
    advance(4);
    strokeH(y, COLOR.line, 0.08);
    advance(2);
  };

  drawHeader();
  drawResumoAcompanhamento();

  if (modo === 'cadastro') {
    const lista = ordenarModelosPorCentroENome(modelos);
    if (!lista.length) {
      setFont('normal', FONT.row, COLOR.muted);
      doc.text(safe('Nenhum budget cadastrado.'), margin, y);
    } else {
      drawTableHeaderCadastro();
      lista.forEach((modelo) => drawModeloRow(modelo, competencia));
      ensureSpace(8);
      setFont('bold', FONT.row, COLOR.black);
      const totalOrcado = lista.reduce((acc, modelo) => acc + calcularOrcadoMensal(modelo, competencia), 0);
      doc.text(safe('Total orçado/mês'), margin, y);
      doc.text(safe(moeda(totalOrcado)), right, y, { align: 'right' });
    }
  } else {
    const lista = sortVisoes(visoes);
    if (!lista.length) {
      setFont('normal', FONT.row, COLOR.muted);
      doc.text(safe('Nenhum budget ativo para este mês.'), margin, y);
    } else {
      drawTableHeaderAcompanhamento();
      lista.forEach((visao) => drawVisaoRow(visao));
      drawTotalRow();
    }
  }

  ensureSpace(8);
  setFont('normal', FONT.footer, COLOR.muted);
  doc.text(
    safe('Orçado mensal calculado a partir da estimativa cadastrada (dia, semana, ciclo ou mês).'),
    margin,
    y,
  );

  const pdfBytes = doc.output('arraybuffer');
  return { data: pdfBytes, version: 'budgets_mensais_a4_v1' };
}
