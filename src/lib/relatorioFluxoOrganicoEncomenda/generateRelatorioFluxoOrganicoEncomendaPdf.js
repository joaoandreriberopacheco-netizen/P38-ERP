import { jsPDF } from 'jspdf';
import { registerJsPdfBarlowFonts, normalizePdfText } from '@/lib/jspdfNotoFont';

export const FLUXO_ORGANICO_PDF_BUILD = 'fluxo_organico_encomenda_v1';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const BRL2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const QTD = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

const COL = {
  ink: [24, 24, 27],
  muted: [113, 113, 122],
  line: [220, 220, 224],
  accent: [74, 82, 64],
};

function setColor(doc, c) {
  doc.setTextColor(...c);
}

function hr(doc, x, y, w) {
  doc.setDrawColor(...COL.line);
  doc.setLineWidth(0.1);
  doc.line(x, y, x + w, y);
}

function hero(doc, font, layout, y, cfg) {
  const { M, CW } = layout;
  doc.setFont(font, 'bold');
  doc.setFontSize(14);
  setColor(doc, COL.ink);
  doc.text(normalizePdfText(cfg.title), M, y);
  y += 6;
  doc.setFont(font, 'normal');
  doc.setFontSize(9);
  setColor(doc, COL.muted);
  for (const line of cfg.subtitle || []) {
    doc.text(normalizePdfText(line), M, y);
    y += 4.2;
  }
  y += 2;
  doc.setFont(font, 'heavy');
  doc.setFontSize(13);
  setColor(doc, COL.ink);
  doc.text(normalizePdfText(cfg.kpi), M + CW, y, { align: 'right' });
  y += 5;
  doc.setFont(font, 'normal');
  doc.setFontSize(8.5);
  setColor(doc, COL.muted);
  doc.text(normalizePdfText(cfg.kpiSub || ''), M + CW, y, { align: 'right' });
  y += 6;
  hr(doc, M, y, CW);
  return y + 5;
}

function kpiRow(doc, font, layout, y, items) {
  const { M, CW } = layout;
  const colW = CW / items.length;
  let x = M;
  for (const item of items) {
    doc.setFont(font, 'normal');
    doc.setFontSize(7.5);
    setColor(doc, COL.muted);
    doc.text(normalizePdfText(item.label), x, y);
    doc.setFont(font, 'bold');
    doc.setFontSize(10);
    setColor(doc, COL.ink);
    doc.text(normalizePdfText(item.value), x, y + 4.5);
    x += colW;
  }
  return y + 12;
}

function table(doc, font, layout, y, title, headers, rows, colWidths) {
  const { M, CW, pageH } = layout;
  if (y > pageH - 40) return y;
  doc.setFont(font, 'bold');
  doc.setFontSize(10);
  setColor(doc, COL.ink);
  doc.text(normalizePdfText(title), M, y);
  y += 5;

  const rowH = 6;
  const headH = 7;
  let x = M;
  doc.setFont(font, 'bold');
  doc.setFontSize(8);
  setColor(doc, COL.muted);
  for (let i = 0; i < headers.length; i += 1) {
    doc.text(normalizePdfText(headers[i]), x + 1, y + 4.5);
    x += colWidths[i];
  }
  y += headH;
  hr(doc, M, y - 1, CW);

  doc.setFont(font, 'normal');
  doc.setFontSize(8);
  for (const row of rows) {
    if (y > pageH - 20) break;
    x = M;
    setColor(doc, COL.ink);
    for (let i = 0; i < row.length; i += 1) {
      const w = colWidths[i];
      doc.text(normalizePdfText(String(row[i] ?? '—')), x + 1, y + 4, { maxWidth: w - 2 });
      x += w;
    }
    y += rowH;
  }
  return y + 3;
}

function footer(doc, font, layout, left, right) {
  const { M, CW, pageH } = layout;
  const fy = pageH - 8;
  hr(doc, M, fy - 4, CW);
  doc.setFont(font, 'normal');
  doc.setFontSize(7.5);
  setColor(doc, COL.muted);
  doc.text(normalizePdfText(left), M, fy);
  doc.text(normalizePdfText(right), M + CW, fy, { align: 'right' });
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export async function generateRelatorioFluxoOrganicoEncomendaPdf(report) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const font = await registerJsPdfBarlowFonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const layout = { M: 12, CW: pageW - 24, pageH };

  const { organico, encomenda, competencia, labelMes, geradoEm } = report;
  const est = organico.estoqueFinal || {};

  let y = layout.M;
  y = hero(doc, font, layout, y, {
    title: 'Fluxo orgânico — reposição convencional',
    subtitle: [
      `Competência ${report.labelMes || competencia} · gerado ${geradoEm} (Tabatinga)`,
      'Venda e compra sem pedidos marcados como encomenda',
    ],
    kpi: BRL.format(organico.estoqueFinal?.total || 0),
    kpiSub: 'Estoque final (custo cadastro · preços de hoje)',
  });

  y = kpiRow(doc, font, layout, y, [
    { label: 'VENDA ORG. (custo)', value: BRL.format(organico.vendaCusto) },
    { label: 'COMPRA ORG.', value: BRL.format(organico.compraCusto) },
    { label: 'SALDO FLUXO', value: BRL.format(organico.saldoCusto) },
    { label: 'QTD VENDIDA', value: QTD.format(organico.vendaQty) },
  ]);

  const compRows = (est.composicaoCusto?.rows || []).map((r) => [
    r.label,
    BRL2.format(r.valor),
    r.pct != null ? `${Number(r.pct).toFixed(1)}%` : '—',
  ]);
  y = table(
    doc,
    font,
    layout,
    y,
    'Composição do estoque final (compra, frete, avaria, impostos…)',
    ['Componente', 'R$', '%'],
    compRows.length ? compRows : [['—', '—', '—']],
    [layout.CW * 0.45, layout.CW * 0.3, layout.CW * 0.25],
  );

  const abcdRows = ['A', 'B', 'C', 'D', 'E'].map((k) => [
    k,
    BRL.format(organico.abcdMovimento[k] || 0),
  ]);
  y = table(
    doc,
    font,
    layout,
    y,
    'Venda orgânica por curva ABCD (valor custo)',
    ['Curva', 'R$'],
    abcdRows,
    [layout.CW * 0.2, layout.CW * 0.8],
  );

  y = table(
    doc,
    font,
    layout,
    y,
    'Compra orgânica por fornecedor (mês)',
    ['Fornecedor', 'Qtd base', 'R$ custo'],
    organico.fornecedores.map((f) => [f.nome, QTD.format(f.qtyBase), BRL.format(f.valorCusto)]),
    [layout.CW * 0.52, layout.CW * 0.18, layout.CW * 0.3],
  );

  y = table(
    doc,
    font,
    layout,
    y,
    'Produtos — giro orgânico no mês',
    ['Produto', 'Venda', 'Compra', 'Saldo', 'Est.final R$'],
    organico.topProdutos.map((p) => [
      p.nome.length > 42 ? `${p.nome.slice(0, 40)}…` : p.nome,
      QTD.format(p.vendaQty),
      QTD.format(p.compraQty),
      QTD.format(p.saldoQty),
      BRL.format(p.estoqueValor),
    ]),
    [
      layout.CW * 0.42,
      layout.CW * 0.12,
      layout.CW * 0.12,
      layout.CW * 0.12,
      layout.CW * 0.22,
    ],
  );

  footer(doc, font, layout, `P38 · Fluxo orgânico · ${FLUXO_ORGANICO_PDF_BUILD}`, 'p.1');

  doc.addPage();
  y = layout.M;
  y = hero(doc, font, layout, y, {
    title: 'Encomendas — compra × venda alocada',
    subtitle: [
      `Competência ${labelMes || competencia}`,
      'Cruzamento: vendas do mês alocadas às linhas de pedidos encomenda',
    ],
    kpi: QTD.format(encomenda.compraQty),
    kpiSub: 'Quantidade encomendada no mês',
  });

  y = kpiRow(doc, font, layout, y, [
    { label: 'VENDA ALOCADA', value: QTD.format(encomenda.vendaAlocadaQty) },
    { label: 'SALDO ENCOMENDA', value: QTD.format(encomenda.saldoQty) },
    { label: 'PEDIDOS', value: String(encomenda.pedidos) },
    {
      label: 'COBERTURA',
      value:
        encomenda.compraQty > 0
          ? `${((encomenda.vendaAlocadaQty / encomenda.compraQty) * 100).toFixed(1)}%`
          : '—',
    },
  ]);

  y = table(
    doc,
    font,
    layout,
    y,
    'Detalhe por pedido e item',
    ['Pedido', 'Fornecedor', 'Produto', 'Enc.', 'Vend.', 'Dif.'],
    encomenda.linhas.map((l) => [
      l.pedidoNumero,
      l.fornecedor.length > 18 ? `${l.fornecedor.slice(0, 16)}…` : l.fornecedor,
      l.produtoNome.length > 22 ? `${l.produtoNome.slice(0, 20)}…` : l.produtoNome,
      QTD.format(l.qtyEncomenda),
      QTD.format(l.qtyAlocada),
      QTD.format(round2(l.qtyEncomenda - l.qtyAlocada)),
    ]),
    [
      layout.CW * 0.12,
      layout.CW * 0.18,
      layout.CW * 0.28,
      layout.CW * 0.12,
      layout.CW * 0.12,
      layout.CW * 0.12,
    ],
  );

  doc.setFont(font, 'normal');
  doc.setFontSize(8.5);
  setColor(doc, COL.muted);
  doc.text(
    normalizePdfText(
      `Totais: encomendado ${QTD.format(encomenda.compraQty)} · vendido (alocado) ${QTD.format(encomenda.vendaAlocadaQty)} · diferença ${QTD.format(encomenda.saldoQty)}`,
    ),
    layout.M,
    Math.min(y + 4, pageH - 16),
  );

  footer(doc, font, layout, `P38 · Encomendas · ${FLUXO_ORGANICO_PDF_BUILD}`, 'p.2');

  const bytes = doc.output('arraybuffer');
  return { data: new Uint8Array(bytes) };
}
