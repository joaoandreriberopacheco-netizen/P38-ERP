import { jsPDF } from 'jspdf';
import { registerJsPdfDin1451Fonts, normalizePdfText } from '@/lib/jspdfNotoFont';
import { DIZIMO_MODOS, normalizarConfigItemDizimo } from '@/lib/dizimoCalculos';

const LINE_W = 0.08;
const SECTION_GAP = 9;
const ROW_GAP = 1.6;
const ROW_H = 4.8;
const HEADER_H = 5.2;

const INK = {
  black: [0, 0, 0],
  muted: [72, 72, 72],
  line: [165, 165, 165],
};

const FONT = {
  title: 13,
  meta: 8,
  section: 10.5,
  grupo: 9.5,
  header: 7.8,
  body: 9,
  bodyBold: 9,
  total: 9.5,
  footer: 8.5,
};

/** Ordem pedida: fixas → folha → ocasionais → budgets */
const ORDEM_SECOES_PDF = [
  { id: 'fixas_recorrentes', label: 'Contas fixas' },
  { id: 'folha', label: 'Folha' },
  { id: 'pontuais', label: 'Contas ocasionais' },
  { id: 'budgets', label: 'Budgets' },
];

const safe = (value) => normalizePdfText(value);
const number = (value) => Number(value) || 0;
const moeda = (value) =>
  `R$ ${number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const compararNome = (a, b) =>
  String(a?.nome || '').localeCompare(String(b?.nome || ''), 'pt-BR', { sensitivity: 'base' });

function ordenarItens(itens = []) {
  return [...itens].sort(compararNome);
}

function ordenarSecoes(secoes = []) {
  const mapa = new Map((secoes || []).map((s) => [s.id, s]));
  return ORDEM_SECOES_PDF.map((def) => mapa.get(def.id)).filter(Boolean);
}

function* iterarItensSecao(secao) {
  if (secao.subsecoes?.length) {
    for (const sub of secao.subsecoes) {
      if (!sub.itens?.length) continue;
      for (const item of ordenarItens(sub.itens)) {
        yield { item, subgrupo: sub.label };
      }
    }
    return;
  }
  for (const item of ordenarItens(secao.itens || [])) {
    yield { item, subgrupo: null };
  }
}

function formatarCelulaNaoDedutivel(item) {
  const valor = number(item.valorNaoDedutivel ?? item.valorFora);
  if (valor <= 0.009) return '—';
  const cfg = normalizarConfigItemDizimo(item.config);
  if (cfg.modo === DIZIMO_MODOS.PARCIAL) {
    return `${moeda(valor)} (${cfg.percentual}%)`;
  }
  return moeda(valor);
}

function rotuloDescricao(item, subgrupo) {
  const nome = safe(item.nome || '—');
  if (subgrupo) return `${subgrupo} — ${nome}`;
  return nome;
}

/**
 * PDF do Dízimo — fluxo contínuo, tabelas abertas (sem borda externa).
 */
export async function generateRelatorioDizimoEnxutoPdf(payload = {}) {
  const {
    competenciaLabel = '',
    demonstrativo = {},
    generatedAt = new Date().toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }),
  } = payload;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const fontFamily = await registerJsPdfDin1451Fonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 10;
  const CW = pageW - M * 2;
  const pageBottom = pageH - 9;
  let y = 12;

  const margem = demonstrativo.margemDetalhe || {};
  const secoes = ordenarSecoes(demonstrativo.secoes || []);
  const anexoForaBase = demonstrativo.anexoForaBase || { secoes: [], totalFora: 0 };

  const cols = {
    c1: M,
    c2: M + CW * 0.42,
    c3: M + CW * 0.62,
    c4: M + CW * 0.8,
    right: M + CW,
  };

  const setFont = (style = 'normal', size = FONT.body, color = INK.black) => {
    doc.setFont(fontFamily, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const strokeH = (yPos, x0 = M, x1 = cols.right, width = LINE_W) => {
    doc.setDrawColor(...INK.line);
    doc.setLineWidth(width);
    doc.line(x0, yPos, x1, yPos);
  };

  const ensureSpace = (needed) => {
    if (y + needed <= pageBottom) return;
    doc.addPage();
    y = 12;
    setFont('normal', FONT.meta, INK.muted);
    doc.text(safe(`Dízimo — ${competenciaLabel}`), M, y);
    y += 5;
    strokeH(y);
    y += 4;
  };

  const advance = (dy) => {
    y += dy;
  };

  const drawSectionTitle = (titulo) => {
    ensureSpace(SECTION_GAP + 6);
    advance(SECTION_GAP);
    setFont('bold', FONT.section);
    doc.text(safe(titulo), M, y);
    advance(5.5);
  };

  const drawColHeader = (labels) => {
    ensureSpace(HEADER_H + ROW_GAP);
    setFont('bold', FONT.header, INK.muted);
    doc.text(safe(labels[0]), cols.c1, y);
    doc.text(safe(labels[1]), cols.c2, y, { align: 'right' });
    doc.text(safe(labels[2]), cols.c3, y, { align: 'right' });
    doc.text(safe(labels[3]), cols.right, y, { align: 'right' });
    advance(HEADER_H);
    strokeH(y);
    advance(ROW_GAP);
  };

  const measureRow = (descricao, { bold = false } = {}) => {
    setFont(bold ? 'bold' : 'normal', bold ? FONT.bodyBold : FONT.body);
    const lines = doc.splitTextToSize(safe(descricao), cols.c2 - cols.c1 - 3);
    return Math.max(ROW_H, lines.length * 3.8 + 1);
  };

  const drawRow4 = (descricao, v2, v3, v4, { bold = false, muted = false } = {}) => {
    const rowH = measureRow(descricao, { bold });
    ensureSpace(rowH + ROW_GAP);
    const rowY = y;
    setFont(bold ? 'bold' : 'normal', bold ? FONT.bodyBold : FONT.body, muted ? INK.muted : INK.black);
    const lines = doc.splitTextToSize(safe(descricao), cols.c2 - cols.c1 - 3);
    lines.forEach((line, i) => doc.text(line, cols.c1, rowY + i * 3.8));
    doc.text(safe(v2), cols.c2, rowY, { align: 'right' });
    doc.text(safe(v3), cols.c3, rowY, { align: 'right' });
    doc.text(safe(v4), cols.right, rowY, { align: 'right' });
    advance(rowH);
    strokeH(y, cols.c1, cols.right, 0.06);
    advance(ROW_GAP);
  };

  const drawGrupoRow = (label) => {
    ensureSpace(ROW_H + ROW_GAP + 1);
    advance(1.5);
    setFont('bold', FONT.grupo);
    doc.text(safe(label), cols.c1, y);
    advance(ROW_H);
    strokeH(y, cols.c1, cols.right, 0.1);
    advance(ROW_GAP);
  };

  const drawDespesaItemRow = (item, subgrupo) => {
    drawRow4(
      rotuloDescricao(item, subgrupo),
      moeda(item.valorBruto),
      formatarCelulaNaoDedutivel(item),
      moeda(item.valorDedutivel ?? 0),
    );
  };

  // —— Cabeçalho ——
  setFont('bold', FONT.title);
  doc.text(safe('Relatório de Dízimo'), M, y);
  advance(5);
  setFont('normal', FONT.meta, INK.muted);
  doc.text(safe(`Competência ${competenciaLabel} · gerado em ${generatedAt}`), M, y);
  advance(8);

  // ═══ 1. Demonstrativo ═══
  drawSectionTitle('Demonstrativo');

  setFont('bold', FONT.grupo, INK.muted);
  doc.text(safe('Receita'), cols.c1, y);
  advance(4.5);
  drawColHeader(['Descrição', 'Vendas', 'Custo', 'Lucro bruto']);

  const receita = number(margem.receita_liquida);
  const custo = number(margem.custo_total);
  const lucroBruto = number(demonstrativo.lucroBruto);

  drawRow4(
    'Vendas totais',
    receita > 0 ? moeda(receita) : '—',
    custo > 0 ? moeda(custo) : '—',
    moeda(lucroBruto),
    { bold: true },
  );

  advance(3);
  setFont('bold', FONT.grupo, INK.muted);
  doc.text(safe('Despesas operacionais'), cols.c1, y);
  advance(4.5);
  drawColHeader(['Descrição', 'Planejado', 'Não dedutível', 'Dedutível']);

  for (const secao of secoes) {
    const label =
      ORDEM_SECOES_PDF.find((d) => d.id === secao.id)?.label || secao.label;
    drawRow4(
      label,
      moeda(secao.valorBruto),
      secao.valorNaoDedutivel > 0 ? moeda(secao.valorNaoDedutivel) : '—',
      moeda(secao.valorDedutivel),
    );
  }

  drawRow4('Total dedutível', '—', '—', moeda(demonstrativo.totalDedutivel), { bold: true });
  drawRow4(
    'Lucro líquido operacional',
    '—',
    '—',
    moeda(demonstrativo.lucroLiquidoOperacional),
    { bold: true },
  );
  drawRow4(
    `Dízimo (${demonstrativo.percentualDizimo || 10}%)`,
    '—',
    '—',
    moeda(demonstrativo.dizimo),
    { bold: true },
  );

  // ═══ 2. Despesas dedutíveis ═══
  drawSectionTitle('Despesas dedutíveis');
  drawColHeader(['Descrição', 'Planejado', 'Não dedutível', 'Dedutível']);

  for (const secao of secoes) {
    const label =
      ORDEM_SECOES_PDF.find((d) => d.id === secao.id)?.label || secao.label;
    drawGrupoRow(label);
    for (const { item, subgrupo } of iterarItensSecao(secao)) {
      if (number(item.valorDedutivel) <= 0.009 && number(item.valorBruto) <= 0.009) continue;
      drawDespesaItemRow(item, subgrupo);
    }
  }

  // ═══ 3. Despesas fora do cálculo ═══
  const secoesFora = ordenarSecoes(anexoForaBase.secoes || []);
  if (number(anexoForaBase.totalFora) > 0 && secoesFora.length) {
    drawSectionTitle('Despesas deixadas de fora do cálculo');
    drawColHeader(['Descrição', 'Planejado', 'Não dedutível', 'Dedutível']);

    for (const secao of secoesFora) {
      const label =
        ORDEM_SECOES_PDF.find((d) => d.id === secao.id)?.label || secao.label;
      drawGrupoRow(label);

      if (secao.subsecoes?.length) {
        for (const sub of secao.subsecoes) {
          for (const item of ordenarItens(sub.itens || [])) {
            const fora = number(item.valorFora ?? item.valorNaoDedutivel);
            if (fora <= 0.009) continue;
            drawRow4(
              rotuloDescricao(item, sub.label),
              moeda(item.valorBruto),
              formatarCelulaNaoDedutivel(item),
              '—',
            );
          }
        }
      } else {
        for (const item of ordenarItens(secao.itens || [])) {
          const fora = number(item.valorFora ?? item.valorNaoDedutivel);
          if (fora <= 0.009) continue;
          drawRow4(
            rotuloDescricao(item, null),
            moeda(item.valorBruto),
            formatarCelulaNaoDedutivel(item),
            '—',
          );
        }
      }
    }

    drawRow4('Total fora da base', '—', moeda(anexoForaBase.totalFora), '—', { bold: true });
  }

  // —— Rodapé ——
  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    setFont('normal', FONT.footer, INK.muted);
    doc.text(`Página ${page}/${pageCount}`, pageW / 2, pageH - 5.5, { align: 'center' });
  }

  return {
    data: doc.output('arraybuffer'),
    version: 'dizimo_tabelas_abertas_v6',
  };
}
