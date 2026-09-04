#!/usr/bin/env node
/**
 * Gera PDF de 1 página — resumo do estoque físico (reunião).
 * Estilo: Barlow, linhas finas em grid, tipografia generosa.
 *
 * Uso: node scripts/gerar-resumo-estoque-fisico-pdf.mjs [--out=/caminho/arquivo.pdf]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';
import { createServer } from 'vite';
import { resolveP38Secrets } from './p38-secrets.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const BRL_UNIT = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const QTD = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const QTD_CELL = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COLORS = {
  ink: [24, 24, 27],
  muted: [113, 113, 122],
  line: [220, 220, 224],
  accent: [39, 39, 42],
};

const FONT = {
  title: 22,
  subtitle: 12.5,
  kpi: 28,
  kpiLabel: 11,
  section: 13,
  tableHead: 10,
  tableRow: 11.5,
  footer: 9.5,
};

const GRID = {
  lineWidth: 0.1,
  rowH: 7.2,
  headerH: 8,
  padX: 2.4,
  padY: 5.2,
  qtySplitRatio: 0.62,
  qtyLineStep: 4.1,
};

function parseOutArg(argv) {
  const hit = argv.find((a) => a.startsWith('--out='));
  if (!hit) {
    return path.join('/opt/cursor/artifacts', `estoque-fisico-pagina1-${new Date().toISOString().slice(0, 10)}.pdf`);
  }
  return hit.slice('--out='.length);
}

async function loadModules() {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const stock = await server.ssrLoadModule('/src/lib/catalogStockTotals.js');
    const unitsLib = await server.ssrLoadModule('/src/lib/productUnits.js');
    const fonts = await server.ssrLoadModule('/src/lib/jspdfNotoFont.js');
    return { stock, unitsLib, fonts };
  } finally {
    await server.close();
  }
}

async function fetchAllProdutosAtivos() {
  const { supabaseAnonKey: key } = resolveP38Secrets();
  const base = 'https://zhonvxkkqabfdyehyxpu.supabase.co';
  let offset = 0;
  const all = [];
  while (true) {
    const q = `${base}/rest/v1/produto?select=*&ativo=eq.true&limit=1000&offset=${offset}`;
    const res = await fetch(q, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error(`Supabase: ${JSON.stringify(rows).slice(0, 200)}`);
    all.push(...rows);
    if (rows.length < 1000) break;
    offset += 1000;
  }
  return all;
}

function buildResumoData(produtos, { resolveProdutoCustoUnitarioBase, formatEstoqueApresentacao }) {
  const norm = (s) => String(s || '').trim().toUpperCase().normalize('NFD').replace(/\p{M}/gu, '');
  const qtd = (p) => {
    const ap = formatEstoqueApresentacao(p);
    return ap ? Number(ap.quantidade) || 0 : Math.max(0, Number(p.estoque_atual) || 0);
  };
  const un = (p) => {
    const ap = formatEstoqueApresentacao(p);
    return ap?.sigla || String(p.unidade_principal || 'UN').toUpperCase();
  };
  const valorFisico = (p) => Math.max(0, Number(p.estoque_atual) || 0) * resolveProdutoCustoUnitarioBase(p);

  const matchers = [
    { label: 'Cerâmica / Piso / Revestimento', fn: (p) => ['PISO', 'CERAMICA', 'REVESTIMENTO'].includes(norm(p.campo_hierarquico_1)) || /^PISO |^REVESTIMENTO /.test(norm(p.nome)) },
    { label: 'Cimento Portland', fn: (p) => norm(p.campo_hierarquico_1) === 'CIMENTO' || /CIMENTO PORTLAND|CIMENTO CP/.test(norm(p.nome)) },
    { label: 'Forro PVC', fn: (p) => norm(p.campo_hierarquico_1) === 'FORRO PVC' || /FORRO PVC/.test(norm(p.nome)) },
    { label: 'Areia', fn: (p) => norm(p.campo_hierarquico_1) === 'AREIA' || norm(p.nome) === 'AREIA' },
    { label: 'Tubos', fn: (p) => /^TUBO /.test(norm(p.nome)) || ['TUBO', 'TUBOS'].includes(norm(p.campo_hierarquico_1)) },
    { label: 'Blocos de concreto', fn: (p) => ['BLOCO', 'BLOCOS'].includes(norm(p.campo_hierarquico_1)) || /^BLOCO /.test(norm(p.nome)) },
    { label: 'Vergalhão', fn: (p) => /VERGALHAO|VERGALHÃO/.test(norm(p.nome)) },
    { label: 'Estribos', fn: (p) => /ESTRIBO/.test(norm(p.nome)) || ['ESTRIBO', 'ESTRIBOS'].includes(norm(p.campo_hierarquico_1)) },
    { label: "Caixa d'água", fn: (p) => /CAIXA D.?AGUA|CAIXA D.?ÁGUA/.test(norm(p.nome)) },
    { label: 'Argamassa / Rejunte', fn: (p) => /REJUNTE|ARGAMASSA/.test(norm(p.nome)) && !/MASSA/.test(norm(p.nome)) },
    { label: 'Massa corrida', fn: (p) => /MASSA CORRIDA/.test(norm(p.nome)) },
    { label: 'Massa acrílica', fn: (p) => /MASSA ACRILICA|MASSA ACRÍLICA/.test(norm(p.nome)) },
    { label: 'Cal', fn: (p) => norm(p.campo_hierarquico_1) === 'CAL' || /CAL HIDRATADA|CAL VIRGEM|^CAL /.test(norm(p.nome)) || norm(p.nome) === 'CAL' },
  ];

  function sumGroup(filter, label) {
    let valor = 0;
    let skus = 0;
    const units = new Map();
    for (const p of produtos) {
      if ((Number(p.estoque_atual) || 0) <= 0 || !filter(p)) continue;
      const v = valorFisico(p);
      if (v <= 0) continue;
      valor += v;
      skus += 1;
      const u = un(p);
      units.set(u, (units.get(u) || 0) + qtd(p));
    }
    const unidades = [...units.entries()]
      .map(([u, q]) => ({ u, q: Math.round(q * 100) / 100 }))
      .sort((a, b) => b.q - a.q);
    const principal = unidades[0] || { u: 'UN', q: 0 };
    const custoMedio = principal.q > 0 ? valor / principal.q : null;
    const quantidadePartes = unidades.length
      ? unidades.map(({ u, q }) => ({ numero: QTD_CELL.format(q), unidade: u }))
      : [{ numero: '—', unidade: '' }];
    return {
      label,
      valor,
      skus,
      unidades,
      quantidadePartes,
      quantidadeTexto: unidades.length
        ? unidades.map(({ u, q }) => `${QTD.format(q)} ${u}`).join(' + ')
        : '—',
      custoMedio,
      custoMedioTexto: custoMedio != null ? BRL_UNIT.format(custoMedio) : '—',
    };
  }

  let total = 0;
  let skusCom = 0;
  for (const p of produtos) {
    const v = valorFisico(p);
    if (v > 0) {
      total += v;
      skusCom += 1;
    }
  }

  const grupos = matchers
    .map((m) => sumGroup(m.fn, m.label))
    .filter((g) => g.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  const blocos = produtos
    .filter((p) => matchers.find((m) => m.label === 'Blocos de concreto').fn(p) && (Number(p.estoque_atual) || 0) > 0)
    .map((p) => ({ nome: p.nome.replace('BLOCO DE CONCRETO ', ''), qtd: qtd(p), valor: valorFisico(p) }))
    .sort((a, b) => b.qtd - a.qtd);

  const caixas = produtos
    .filter((p) => matchers.find((m) => m.label === "Caixa d'água").fn(p) && (Number(p.estoque_atual) || 0) > 0)
    .map((p) => ({
      nome: p.nome.replace("CAIXA D'ÁGUA FORTLEV ", ''),
      qtd: qtd(p),
      valor: valorFisico(p),
    }))
    .sort((a, b) => b.qtd - a.qtd);

  const destaques = [];
  const pushDestaque = (label, grupo) => {
    if (!grupo) return;
    destaques.push({
      label,
      quantidadePartes: grupo.quantidadePartes,
      custoMedio: grupo.custoMedioTexto,
      valor: BRL.format(grupo.valor),
    });
  };

  pushDestaque('Cerâmica (tudo junto)', grupos.find((g) => g.label.startsWith('Cerâmica')));
  pushDestaque('Cimento CP-IV 42,5 kg', grupos.find((g) => g.label.startsWith('Cimento')));
  if (blocos.length) {
    const totalBlocos = blocos.reduce((s, b) => s + b.qtd, 0);
    const totalValor = blocos.reduce((s, b) => s + b.valor, 0);
    destaques.push({
      label: 'Blocos',
      quantidadePartes: [{ numero: QTD_CELL.format(totalBlocos), unidade: 'UN' }],
      custoMedio: totalBlocos > 0 ? BRL_UNIT.format(totalValor / totalBlocos) : '—',
      valor: BRL.format(totalValor),
    });
  }
  pushDestaque('Estribos', grupos.find((g) => g.label === 'Estribos'));
  pushDestaque('Massa corrida', grupos.find((g) => g.label === 'Massa corrida'));
  pushDestaque('Massa acrílica', grupos.find((g) => g.label === 'Massa acrílica'));
  pushDestaque('Cal', grupos.find((g) => g.label === 'Cal'));
  if (caixas.length) {
    const totalCx = caixas.reduce((s, c) => s + c.qtd, 0);
    const totalValor = caixas.reduce((s, c) => s + c.valor, 0);
    destaques.push({
      label: "Caixa d'água",
      quantidadePartes: [{ numero: QTD_CELL.format(totalCx), unidade: 'UN' }],
      custoMedio: totalCx > 0 ? BRL_UNIT.format(totalValor / totalCx) : '—',
      valor: BRL.format(totalValor),
    });
  }

  return {
    geradoEm: new Date().toLocaleString('pt-BR', { timeZone: 'America/Manaus' }),
    total,
    skusCom,
    grupos,
    destaques,
  };
}

function setTextColor(doc, c) {
  doc.setTextColor(...c);
}

function drawGridLines(doc, x, y, width, rowHeights, colWidths) {
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(GRID.lineWidth);

  const totalH = rowHeights.reduce((s, h) => s + h, 0);
  let yy = y;
  for (let i = 0; i <= rowHeights.length; i += 1) {
    doc.line(x, yy, x + width, yy);
    if (i < rowHeights.length) yy += rowHeights[i];
  }

  let xx = x;
  for (let i = 0; i <= colWidths.length; i += 1) {
    doc.line(xx, y, xx, y + totalH);
    if (i < colWidths.length) xx += colWidths[i];
  }
}

function getQuantityPartes(row) {
  if (Array.isArray(row?.quantidadePartes) && row.quantidadePartes.length) {
    return row.quantidadePartes;
  }
  return [{ numero: '—', unidade: '' }];
}

function measureQuantityRowHeight(partes) {
  const lines = Math.max(1, partes.length);
  return Math.max(GRID.rowH, lines * GRID.qtyLineStep + 2.6);
}

function columnOffsetX(x, colWidths, index) {
  let offset = x;
  for (let i = 0; i < index; i += 1) offset += colWidths[i];
  return offset;
}

function drawGridTable(doc, fontFamily, {
  x,
  y,
  width,
  columns,
  rows,
  headerStyle = 'bold',
  rowStyle = 'normal',
}) {
  const colWidths = columns.map((c) => width * c.width);
  const qtyColIndex = columns.findIndex((c) => c.splitQuantity);
  const bodyHeights = rows.map((row) => (
    qtyColIndex >= 0 ? measureQuantityRowHeight(getQuantityPartes(row)) : GRID.rowH
  ));
  const rowHeights = [GRID.headerH, ...bodyHeights];
  const tableH = rowHeights.reduce((s, h) => s + h, 0);

  drawGridLines(doc, x, y, width, rowHeights, colWidths);

  if (qtyColIndex >= 0) {
    const qtyX = columnOffsetX(x, colWidths, qtyColIndex);
    const splitX = qtyX + colWidths[qtyColIndex] * GRID.qtySplitRatio;
    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(GRID.lineWidth);
    doc.line(splitX, y, splitX, y + tableH);
  }

  let cursorY = y + GRID.padY;
  doc.setFont(fontFamily, headerStyle);
  doc.setFontSize(FONT.tableHead);
  setTextColor(doc, COLORS.muted);

  let cursorX = x;
  for (let i = 0; i < columns.length; i += 1) {
    const col = columns[i];
    if (col.splitQuantity) {
      const qtyX = cursorX;
      const splitX = qtyX + colWidths[i] * GRID.qtySplitRatio;
      doc.text('QTD', splitX - GRID.padX, cursorY, { align: 'right' });
      doc.text('UN', splitX + GRID.padX, cursorY, { align: 'left' });
    } else {
      const cellX = col.align === 'right'
        ? cursorX + colWidths[i] - GRID.padX
        : cursorX + GRID.padX;
      doc.text(col.label, cellX, cursorY, { align: col.align || 'left' });
    }
    cursorX += colWidths[i];
  }

  cursorY += GRID.headerH;
  doc.setFont(fontFamily, rowStyle);
  doc.setFontSize(FONT.tableRow);

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const rowH = bodyHeights[rowIndex];
    const baseline = cursorY + GRID.padY + 0.4;
    cursorX = x;

    for (let i = 0; i < columns.length; i += 1) {
      const col = columns[i];
      if (col.splitQuantity) {
        const qtyX = cursorX;
        const splitX = qtyX + colWidths[i] * GRID.qtySplitRatio;
        const partes = getQuantityPartes(row);
        const blockH = partes.length * GRID.qtyLineStep;
        let lineY = baseline + Math.max(0, (rowH - blockH) / 2) + 1.2;
        setTextColor(doc, COLORS.muted);
        for (const parte of partes) {
          doc.text(String(parte.numero ?? '—'), splitX - GRID.padX, lineY, { align: 'right' });
          doc.text(String(parte.unidade ?? ''), splitX + GRID.padX, lineY, { align: 'left' });
          lineY += GRID.qtyLineStep;
        }
      } else {
        const raw = row[col.key] ?? '—';
        const text = String(raw);
        const maxW = colWidths[i] - GRID.padX * 2;
        const lines = doc.splitTextToSize(text, maxW);
        const line = lines[0] || '—';
        const cellX = col.align === 'right'
          ? cursorX + colWidths[i] - GRID.padX
          : cursorX + GRID.padX;
        setTextColor(
          doc,
          col.key === 'valor'
            ? COLORS.accent
            : col.key === 'custoMedio'
              ? COLORS.muted
              : COLORS.ink,
        );
        if (col.key === 'valor') doc.setFont(fontFamily, 'bold');
        doc.text(line, cellX, baseline, { align: col.align || 'left' });
        if (col.key === 'valor') doc.setFont(fontFamily, rowStyle);
      }
      cursorX += colWidths[i];
    }

    cursorY += rowH;
  }

  return y + tableH;
}

async function drawPdf(data, registerJsPdfBarlowFonts, normalizePdfText) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const fontFamily = await registerJsPdfBarlowFonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 14;
  const CW = pageW - M * 2;
  let y = M;

  const text = (str, x, yy, opts = {}) => doc.text(normalizePdfText(str), x, yy, opts);

  doc.setFont(fontFamily, 'heavy');
  doc.setFontSize(FONT.title);
  setTextColor(doc, COLORS.ink);
  text('Estoque físico', M, y);
  y += 9;

  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(FONT.subtitle);
  setTextColor(doc, COLORS.muted);
  text('O que está no armazém hoje — pronto para vender ou separar', M, y);
  y += 5;
  text(`Atualizado em ${data.geradoEm} (Tabatinga)`, M, y);
  y += 10;

  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(GRID.lineWidth);
  doc.line(M, y, M + CW, y);
  y += 11;

  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(FONT.kpiLabel);
  setTextColor(doc, COLORS.muted);
  text('VALOR TOTAL EM ESTOQUE (CUSTO)', M, y);
  y += 10;

  doc.setFont(fontFamily, 'heavy');
  doc.setFontSize(FONT.kpi);
  setTextColor(doc, COLORS.ink);
  text(BRL.format(data.total), M, y);
  y += 7;

  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(FONT.subtitle);
  setTextColor(doc, COLORS.muted);
  text(`${QTD.format(data.skusCom)} referências com saldo positivo`, M, y);
  y += 11;

  doc.line(M, y, M + CW, y);
  y += 9;

  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(FONT.section);
  setTextColor(doc, COLORS.ink);
  text('Resumo por família', M, y);
  y += 6;

  const familyColumns = [
    { key: 'familia', label: 'FAMÍLIA', width: 0.36, align: 'left' },
    { key: 'quantidade', label: 'QUANTIDADE', width: 0.22, align: 'left', splitQuantity: true },
    { key: 'custoMedio', label: 'CUSTO MÉDIO', width: 0.22, align: 'right' },
    { key: 'valor', label: 'VALOR', width: 0.20, align: 'right' },
  ];

  const familyRows = data.grupos.map((g) => ({
    familia: g.label,
    quantidadePartes: g.quantidadePartes,
    custoMedio: g.custoMedioTexto,
    valor: BRL.format(g.valor),
  }));

  y = drawGridTable(doc, fontFamily, {
    x: M,
    y,
    width: CW,
    columns: familyColumns,
    rows: familyRows,
  });
  y += 9;

  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(FONT.section);
  setTextColor(doc, COLORS.ink);
  text('Destaques', M, y);
  y += 6;

  const destaqueColumns = [
    { key: 'label', label: 'ITEM', width: 0.36, align: 'left' },
    { key: 'quantidade', label: 'QUANTIDADE', width: 0.22, align: 'left', splitQuantity: true },
    { key: 'custoMedio', label: 'CUSTO MÉDIO', width: 0.22, align: 'right' },
    { key: 'valor', label: 'VALOR', width: 0.20, align: 'right' },
  ];

  const destaqueRows = data.destaques.map((d) => ({
    label: d.label,
    quantidadePartes: d.quantidadePartes,
    custoMedio: d.custoMedio,
    valor: d.valor,
  }));

  y = drawGridTable(doc, fontFamily, {
    x: M,
    y,
    width: CW,
    columns: destaqueColumns,
    rows: destaqueRows,
  });

  const footerY = pageH - 12;
  doc.line(M, footerY - 4, M + CW, footerY - 4);
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(FONT.footer);
  setTextColor(doc, COLORS.muted);
  text('P38 · Estoque físico · página 1', M, footerY);
  text('Gerado automaticamente a partir do cadastro ativo', M + CW, footerY, { align: 'right' });

  return doc.output('arraybuffer');
}

async function main() {
  const outPath = parseOutArg(process.argv.slice(2));
  const { stock, unitsLib, fonts } = await loadModules();
  const produtos = await fetchAllProdutosAtivos();
  const data = buildResumoData(produtos, {
    resolveProdutoCustoUnitarioBase: stock.resolveProdutoCustoUnitarioBase,
    formatEstoqueApresentacao: unitsLib.formatEstoqueApresentacao,
  });

  const pdfBytes = await drawPdf(data, fonts.registerJsPdfBarlowFonts, fonts.normalizePdfText);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(pdfBytes));

  const workspaceCopy = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'estoque-fisico-pagina1.pdf');
  const publicCopy = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'estoque-fisico-pagina1.pdf');
  fs.copyFileSync(outPath, workspaceCopy);
  fs.copyFileSync(outPath, publicCopy);

  console.log(JSON.stringify({
    ok: true,
    out: outPath,
    workspace: workspaceCopy,
    public: publicCopy,
    total: data.total,
    skusCom: data.skusCom,
    geradoEm: data.geradoEm,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
