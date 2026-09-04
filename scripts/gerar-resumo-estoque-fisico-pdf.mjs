#!/usr/bin/env node
/**
 * Gera PDF de 1 página — resumo do estoque físico (reunião).
 * Estilo limpo: linhas finas, tipografia generosa.
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
const REPO_ROOT = path.resolve(__dirname, '..');

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const QTD = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

const COLORS = {
  ink: [24, 24, 27],
  muted: [113, 113, 122],
  line: [228, 228, 231],
  accent: [39, 39, 42],
};

const FONT = {
  title: 22,
  subtitle: 12.5,
  kpi: 28,
  kpiLabel: 11,
  section: 13,
  body: 12,
  tableHead: 10.5,
  tableRow: 12,
  footer: 9.5,
};

function parseOutArg(argv) {
  const hit = argv.find((a) => a.startsWith('--out='));
  if (!hit) {
    return path.join('/opt/cursor/artifacts', `estoque-fisico-pagina1-${new Date().toISOString().slice(0, 10)}.pdf`);
  }
  return hit.slice('--out='.length);
}

async function loadStockModules() {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const stock = await server.ssrLoadModule('/src/lib/catalogStockTotals.js');
    const unitsLib = await server.ssrLoadModule('/src/lib/productUnits.js');
    return { stock, unitsLib };
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
    return { label, valor, skus, unidades };
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
    .map((p) => ({ nome: p.nome, qtd: qtd(p) }))
    .sort((a, b) => b.qtd - a.qtd);

  const massas = produtos
    .filter((p) => (/MASSA CORRIDA|MASSA ACRILICA|MASSA ACRÍLICA/.test(norm(p.nome))) && (Number(p.estoque_atual) || 0) > 0)
    .map((p) => ({ nome: p.nome, qtd: qtd(p), un: un(p) }))
    .sort((a, b) => b.qtd - a.qtd);

  const caixas = produtos
    .filter((p) => matchers.find((m) => m.label === "Caixa d'água").fn(p) && (Number(p.estoque_atual) || 0) > 0)
    .map((p) => ({ nome: p.nome, qtd: qtd(p) }))
    .sort((a, b) => b.qtd - a.qtd);

  return {
    geradoEm: new Date().toLocaleString('pt-BR', { timeZone: 'America/Manaus' }),
    total,
    skusCom,
    grupos,
    blocos,
    massas,
    caixas,
  };
}

function formatQuantidadeGrupo(grupo) {
  if (!grupo.unidades?.length) return '—';
  return grupo.unidades
    .map(({ u, q }) => `${QTD.format(q)} ${u}`)
    .join(' + ');
}

function drawThinLine(doc, x0, y0, x1, y1) {
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.12);
  doc.line(x0, y0, x1, y1);
}

function drawPdf(data) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 16;
  const CW = pageW - M * 2;
  let y = M;

  const setColor = (c) => doc.setTextColor(...c);
  const text = (str, x, yy, opts = {}) => doc.text(String(str), x, yy, opts);

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT.title);
  setColor(COLORS.ink);
  text('Estoque físico', M, y);
  y += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT.subtitle);
  setColor(COLORS.muted);
  text('O que está no armazém hoje — pronto para vender ou separar', M, y);
  y += 5;
  text(`Atualizado em ${data.geradoEm} (Tabatinga)`, M, y);
  y += 10;

  drawThinLine(doc, M, y, M + CW, y);
  y += 12;

  // KPI
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT.kpiLabel);
  setColor(COLORS.muted);
  text('VALOR TOTAL EM ESTOQUE (CUSTO)', M, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT.kpi);
  setColor(COLORS.ink);
  text(BRL.format(data.total), M, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT.body);
  setColor(COLORS.muted);
  text(`${QTD.format(data.skusCom)} referências com saldo positivo`, M, y);
  y += 12;

  drawThinLine(doc, M, y, M + CW, y);
  y += 10;

  // Table header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT.section);
  setColor(COLORS.ink);
  text('Resumo por família', M, y);
  y += 8;

  const colFam = M;
  const colQtd = M + CW * 0.58;
  const colVal = M + CW;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT.tableHead);
  setColor(COLORS.muted);
  text('FAMÍLIA', colFam, y);
  text('QUANTIDADE', colQtd, y);
  text('VALOR', colVal, y, { align: 'right' });
  y += 4;
  drawThinLine(doc, M, y, M + CW, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT.tableRow);
  for (const grupo of data.grupos) {
    if (y > pageH - 48) break;
    setColor(COLORS.ink);
    const famLines = doc.splitTextToSize(grupo.label, CW * 0.52);
    text(famLines[0], colFam, y);
    setColor(COLORS.muted);
    text(formatQuantidadeGrupo(grupo), colQtd, y);
    setColor(COLORS.accent);
    doc.setFont('helvetica', 'bold');
    text(BRL.format(grupo.valor), colVal, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 7.2;
    drawThinLine(doc, M, y - 2.5, M + CW, y - 2.5);
  }

  y += 4;
  drawThinLine(doc, M, y, M + CW, y);
  y += 10;

  // Highlights
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT.section);
  setColor(COLORS.ink);
  text('Destaques', M, y);
  y += 8;

  const highlights = [];

  const ceramica = data.grupos.find((g) => g.label.startsWith('Cerâmica'));
  const cimento = data.grupos.find((g) => g.label.startsWith('Cimento'));
  const estribos = data.grupos.find((g) => g.label === 'Estribos');
  const cal = data.grupos.find((g) => g.label === 'Cal');

  if (ceramica) highlights.push(`Cerâmica (tudo junto): ${formatQuantidadeGrupo(ceramica)} · ${BRL.format(ceramica.valor)}`);
  if (cimento) highlights.push(`Cimento CP-IV 42,5 kg: ${formatQuantidadeGrupo(cimento)} · ${BRL.format(cimento.valor)}`);
  if (data.blocos.length) {
    const totalBlocos = data.blocos.reduce((s, b) => s + b.qtd, 0);
    const det = data.blocos.map((b) => `${QTD.format(b.qtd)} (${b.nome.replace('BLOCO DE CONCRETO ', '')})`).join(' · ');
    highlights.push(`Blocos: ${QTD.format(totalBlocos)} no total — ${det}`);
  }
  if (estribos) highlights.push(`Estribos: ${formatQuantidadeGrupo(estribos)} · ${BRL.format(estribos.valor)}`);
  if (data.massas.length) {
    const corrida = data.grupos.find((g) => g.label === 'Massa corrida');
    const acrilica = data.grupos.find((g) => g.label === 'Massa acrílica');
    if (corrida) highlights.push(`Massa corrida: ${formatQuantidadeGrupo(corrida)} · ${BRL.format(corrida.valor)}`);
    if (acrilica) highlights.push(`Massa acrílica: ${formatQuantidadeGrupo(acrilica)} · ${BRL.format(acrilica.valor)}`);
  }
  if (cal) highlights.push(`Cal: ${formatQuantidadeGrupo(cal)} · ${BRL.format(cal.valor)}`);
  if (data.caixas.length) {
    const totalCx = data.caixas.reduce((s, c) => s + c.qtd, 0);
    const det = data.caixas.map((c) => `${QTD.format(c.qtd)}× ${c.nome.replace("CAIXA D'ÁGUA FORTLEV ", '')}`).join(' · ');
    highlights.push(`Caixa d'água: ${QTD.format(totalCx)} un — ${det}`);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT.body);
  for (const line of highlights) {
    if (y > pageH - 22) break;
    const wrapped = doc.splitTextToSize(`· ${line}`, CW - 2);
    for (const wl of wrapped) {
      setColor(COLORS.ink);
      text(wl, M + 1, y);
      y += 6.2;
    }
  }

  y = pageH - 14;
  drawThinLine(doc, M, y - 4, M + CW, y - 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT.footer);
  setColor(COLORS.muted);
  text('P38 · Estoque físico · página 1', M, y);
  text('Gerado automaticamente a partir do cadastro ativo', M + CW, y, { align: 'right' });

  return doc.output('arraybuffer');
}

async function main() {
  const outPath = parseOutArg(process.argv.slice(2));
  const { stock, unitsLib } = await loadStockModules();
  const produtos = await fetchAllProdutosAtivos();
  const data = buildResumoData(produtos, {
    resolveProdutoCustoUnitarioBase: stock.resolveProdutoCustoUnitarioBase,
    formatEstoqueApresentacao: unitsLib.formatEstoqueApresentacao,
  });

  const pdfBytes = drawPdf(data);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(pdfBytes));

  console.log(JSON.stringify({
    ok: true,
    out: outPath,
    total: data.total,
    skusCom: data.skusCom,
    geradoEm: data.geradoEm,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
