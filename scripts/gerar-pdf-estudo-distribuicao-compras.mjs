#!/usr/bin/env node
/**
 * Gera PDF do estudo de distribuição de compras (one-off / relatório).
 * Uso: node scripts/gerar-pdf-estudo-distribuicao-compras.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { requireP38SupabaseAdmin } from './p38-supabase-admin.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs/exports');
const OUT_PDF = path.join(OUT_DIR, 'P38-estudo-distribuicao-compras-2026-10-11.pdf');
const OUT_PDF_LOTES = path.join(OUT_DIR, 'P38-estudo-lotes-compras-2026-10-11.pdf');

const DATA_INICIO = '2026-10-01';
const DATA_FIM = '2026-11-18';
const TOTAL_VENDAS = 342139.86;
const PEDIDOS = 1066;
const CONSERVADOR = 92000;
const AGRESSIVO = 120000;
const LOTE_CIMENTO_RS = 13800;
const LOTE_CIMENTO_SACOS = 320;
const LOTE_PADRAO_RS = 5000;
/** Grupo fora da alocação de compra (partilha redistribuída nos demais). */
const GRUPO_EXCLUIDO_ALOC = 'Bloco de concreto';
/** Grupos com linha própria na secção de itens menores (&lt; 2% vendas ou lista fixa). */
const LIMITE_ITENS_PEQUENOS_PCT = 2;
const GRUPOS_ITENS_PEQUENOS = new Set([
  'Diversos (cadastro / SKU avulso)',
  'Elétrica e iluminação',
  'Ferramentas',
  'Fitas e vedantes',
  'Hidráulica — conexões e acessórios',
]);

/** Destaque fim de ano — categoria h1 TINTA (período do estudo). */
const TINTA_DESTAQUE = {
  categoria: 'TINTA',
  valorVendas: 4844.64,
  pct: 1.42,
};

function brl(n) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pctStr(p) {
  return `${p.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** Paleta alinhada a `generateRelatorioEstoqueGlobalPdf.js` (zinc). */
const PDF_INK = 'rgb(24, 24, 27)';
const PDF_MUTED = 'rgb(113, 113, 122)';
const PDF_LINE = 'rgb(220, 220, 224)';
const PDF_ACCENT = 'rgb(39, 39, 42)';

function pdfBarlowFontLink() {
  return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:ital,wght@0,400;0,600;0,700;0,800;1,400&amp;display=swap" />`;
}

function pdfBarlowStack() {
  return "'Barlow', 'Liberation Sans', 'DejaVu Sans', Arial, Helvetica, sans-serif";
}

function pdfStudyStyles() {
  return `
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: 'Liberation Sans', 'DejaVu Sans', Arial, Helvetica, sans-serif;
      font-size: 9pt;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      text-rendering: geometricPrecision;
    }
    h1 { font-size: 13pt; margin: 0 0 6px; font-weight: 700; color: #000; }
    .meta { margin: 0 0 8px; font-size: 8.5pt; color: #222; }
    .note { font-size: 8pt; color: #333; margin: 0 0 6px; }
    table.study-table {
      width: 100%;
      table-layout: fixed;
    }
    table.study-table td.num { text-align: right; }
    .callout {
      border: 1px solid #3b5ccc;
      background-color: #f5f8ff;
      padding: 6px 8px;
      margin: 0 0 8px;
      font-size: 7.5pt;
      line-height: 1.35;
      color: #000;
    }
    .foot {
      margin-top: 8px;
      font-size: 7.5pt;
      color: #444;
      border-top: 1px solid #999;
      padding-top: 6px;
    }
    code { font-family: 'Liberation Mono', 'DejaVu Sans Mono', monospace; font-size: 0.95em; }
  `;
}

function saleDate(pv) {
  const d = pv.dados || {};
  for (const k of ['data_venda', 'data_emissao', 'data_fechamento']) {
    const v = d[k];
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  }
  return pv.created_at
    ? new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Rio_Branco',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(pv.created_at))
    : null;
}

function st(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .trim();
}

function elegivel(pv) {
  if (st(pv.status ?? pv.dados?.status) === 'CANCELADO') return false;
  const tp = st(pv.tipo ?? pv.dados?.tipo);
  if (tp === 'ORCAMENTO' || tp === 'ORÇAMENTO') return false;
  return !!saleDate(pv);
}

async function loadCategorias() {
  const supabase = requireP38SupabaseAdmin();
  const pedidoIds = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('pedido_venda')
      .select('id, status, tipo, dados, created_at')
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const pv of data) {
      if (!elegivel(pv)) continue;
      const sd = saleDate(pv);
      if (sd >= DATA_INICIO && sd <= DATA_FIM) pedidoIds.push(pv.id);
    }
    if (data.length < 1000) break;
  }

  const itemRows = [];
  for (let i = 0; i < pedidoIds.length; i += 80) {
    const batch = pedidoIds.slice(i, i + 80);
    for (let off = 0; ; off += 1000) {
      const { data, error } = await supabase
        .from('pedido_venda_item')
        .select('produto_id, total, dados')
        .in('pedido_venda_id', batch)
        .range(off, off + 999);
      if (error) throw error;
      if (!data?.length) break;
      itemRows.push(...data);
      if (data.length < 1000) break;
    }
  }

  const produtoIds = [...new Set(itemRows.map((r) => r.produto_id).filter(Boolean))];
  const produtoH1 = new Map();
  for (let i = 0; i < produtoIds.length; i += 200) {
    const { data, error } = await supabase
      .from('produto')
      .select('id, campo_hierarquico_1, dados')
      .in('id', produtoIds.slice(i, i + 200));
    if (error) throw error;
    for (const p of data || []) {
      produtoH1.set(p.id, (p.campo_hierarquico_1 || p.dados?.campo_hierarquico_1 || '').trim());
    }
  }

  const byH1 = {};
  for (const row of itemRows) {
    const val = Number(row.total) || Number(row.dados?.total) || 0;
    if (!val) continue;
    const label = produtoH1.get(row.produto_id) || '(sem campo_hierarquico_1)';
    byH1[label] = (byH1[label] || 0) + val;
  }

  const sorted = Object.entries(byH1)
    .sort((a, b) => b[1] - a[1])
    .map(([categoria, valor]) => ({
      categoria,
      valor: Math.round(valor * 100) / 100,
      pct: Math.round((100 * valor) / TOTAL_VENDAS * 100) / 100,
    }));

  return sorted;
}

/** Agrupa categorias &lt; 0,5% em blocos temáticos para leitura do PDF. */
function grupoDemaisCategoria(categoria) {
  const n = st(categoria);

  if (
    n.includes('LINHA DE PEDREIRO') ||
    n.includes('ESPATULA') ||
    n.includes('DESEMPENADEIRA') ||
    n.includes('SERRA MANUAL') ||
    n.includes('DISCO DE CORTE') ||
    n.includes('LAPIS DE CARPINTEIRO') ||
    n === 'LIXA'
  ) {
    return 'FERRAMENTAS';
  }

  if (
    n.includes('LAMPADA') ||
    n.includes('DISJUNTOR') ||
    n.includes('INTERRUPTOR') ||
    n.includes('SPOT LED') ||
    n.includes('PLAFON') ||
    n.includes('FIO PARALELO')
  ) {
    return 'Elétrica e iluminação';
  }

  if (
    n.includes('FITA CREPE') ||
    n.includes('FITA ISOLANTE') ||
    n.includes('FITA VEDA') ||
    n.includes('FITA AUTOADERENTE')
  ) {
    return 'Fitas e vedantes';
  }

  if (
    n === 'JOELHO' ||
    n === 'TE' ||
    n.startsWith('TE ESGOTO') ||
    n === 'LUVA' ||
    n === 'UNIAO' ||
    n === 'CAP' ||
    n === 'BOCAL' ||
    n.includes('JUNCAO') ||
    n.includes('JUNÇÃO') ||
    n.includes('VALVULA') ||
    n === 'VÁLVULA' ||
    n.includes('SIFAO') ||
    n.includes('ENGATE FLEX') ||
    n.startsWith('REGISTRO') ||
    n.startsWith('NIPEL') ||
    n.startsWith('ADAPTADOR') ||
    n.startsWith('BUCHA') ||
    n.includes('RALO') ||
    n.includes('ADESIVO PLASTICO P/ TUBOS') ||
    n.includes('ADESIVO PLÁSTICO P/ TUBOS') ||
    n.includes('CONDUITE')
  ) {
    return 'Hidráulica — conexões e acessórios';
  }

  if (
    n.includes('VASO SANITARIO') ||
    n.includes('TORNEIRA') ||
    n.includes('CHUVEIRO') ||
    n.includes('PIA BANHEIRO') ||
    n.includes('CUBA DE APOIO') ||
    n === 'FECHADURA' ||
    n.includes('MECANISMO UNIVERSAL') ||
    n.includes('CAIXA DE DESCARGA') ||
    n.includes('CAIXA SIFONADA') ||
    n.includes('BOIA P/ CX') ||
    n.includes("ADAPTADOR P/ CX")
  ) {
    return 'Louças, metais e banheiro';
  }

  if (
    n === 'SEIXO' ||
    n === 'AREIA' ||
    n.includes('CAL SUPERCAL') ||
    n === 'REVESTIMENTO' ||
    n.includes('JUNTA PISO') ||
    n === 'REJUNTE' ||
    n === 'COMPENSADO' ||
    n.includes('CIMENTO BRANCO') ||
    n.includes('TELHA') ||
    n === 'PREGO' ||
    n.includes('PREGO TELHEIRO') ||
    n.includes('ARAME RECOZIDO') ||
    n.includes('XADREZ')
  ) {
    return 'Material de obra e agregados';
  }

  if (
    n.includes('THINNER') ||
    n.includes('MASSA CORRIDA') ||
    n.includes('MASSA ACRILICA') ||
    n.includes('TINTA ESMALTE') ||
    n.includes('TINTA SPRAY') ||
    n.includes('TINTA ANTICORROSIVA') ||
    n === 'VERNIZ' ||
    n.includes('CORANTE') ||
    n.startsWith('PINCEL') ||
    n.includes('ROLO DE') ||
    n.includes('BANDEJA P/PINTURA') ||
    n.includes('GARFO P/ ROLO')
  ) {
    return 'Pintura — complementos';
  }

  if (n.includes('PERFIL DE PVC')) {
    return 'Perfis PVC';
  }

  if (n === 'FRETE') {
    return 'Transporte';
  }

  return 'Diversos (cadastro / SKU avulso)';
}

/** Mapeia cada h1 do Supabase para uma das ~19 linhas do PDF (ordem alfabética). */
function linhaConsolidadaFinal(categoria) {
  const n = st(categoria);

  if (n === 'PISO' || n === 'PORCELANATO' || n === 'REVESTIMENTO' || n.includes('JUNTA PISO')) {
    return 'Piso e porcelanato';
  }
  if (n === 'CIMENTO PORTLAND') return 'Cimento Portland';
  if (n === 'ARGAMASSA') return 'Argamassa';
  if (n === 'FORRO PVC') return 'Forro PVC';
  if (n === 'VERGALHAO DE FERRO' || n === 'ESTRIBO') return 'Ferro — vergalhão e estribos';
  if (n === 'BLOCO DE CONCRETO') return 'Bloco de concreto';
  if (n === "CAIXA D'AGUA" || n === 'CAIXA D AGUA') return "Caixa d'água";
  if (n === 'TINTA') return 'Tinta';
  if (n === 'TUBO') return 'Tubo';

  const g = grupoDemaisCategoria(categoria);
  if (g === 'FERRAMENTAS') return 'Ferramentas';
  return g;
}

function consolidarParaTabela(categorias) {
  const map = new Map();
  for (const row of categorias) {
    const nome = linhaConsolidadaFinal(row.categoria);
    if (!map.has(nome)) map.set(nome, { nome, valor: 0, pct: 0 });
    const b = map.get(nome);
    b.valor += row.valor;
    b.pct += row.pct;
  }

  let rows = [...map.values()].map((b) => ({
    nome: b.nome,
    valor: Math.round(b.valor * 100) / 100,
    pct: Math.round(b.pct * 100) / 100,
  }));

  rows.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

  return rows;
}

function isGrupoItensPequenos(row) {
  return GRUPOS_ITENS_PEQUENOS.has(row.nome) || row.pctVendas < LIMITE_ITENS_PEQUENOS_PCT;
}

/**
 * Remove Bloco de concreto da alocação, redistribui o % proporcionalmente
 * e separa grupos principais vs itens menores.
 */
function prepararLinhasAlocacao(rows) {
  const bloco = rows.find((r) => r.nome === GRUPO_EXCLUIDO_ALOC);
  const blocoPct = bloco?.pct ?? 0;
  const semBloco = rows.filter((r) => r.nome !== GRUPO_EXCLUIDO_ALOC);
  const somaSemBloco = semBloco.reduce((s, r) => s + r.pct, 0);

  const enriquecidas = semBloco.map((r) => {
    const pctVendas = r.pct;
    const pctAloc =
      somaSemBloco > 0
        ? Math.round((pctVendas + blocoPct * (pctVendas / somaSemBloco)) * 1000) / 1000
        : 0;
    const base = { nome: r.nome, valor: r.valor, pctVendas, pctAloc, pct: pctAloc };
    const section = isGrupoItensPequenos({ nome: r.nome, pctVendas }) ? 'small' : 'main';
    return { ...base, section };
  });

  const sortNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
  const main = enriquecidas.filter((r) => r.section === 'main').sort(sortNome);
  const small = enriquecidas.filter((r) => r.section === 'small').sort(sortNome);

  return { main, small, ordered: [...main, ...small], blocoPct, blocoValor: bloco?.valor ?? 0 };
}

function alocacaoPar(row) {
  const c = Math.round((row.pctAloc / 100) * CONSERVADOR * 100) / 100;
  const a = Math.round((row.pctAloc / 100) * AGRESSIVO * 100) / 100;
  return { c, a };
}

function buildHtml(categorias) {
  const { main, small, ordered, blocoPct } = prepararLinhasAlocacao(consolidarParaTabela(categorias));
  const linhas = ordered;

  const tintaRow = ordered.find((r) => r.nome === 'Tinta');
  const tintaCons = tintaRow ? alocacaoPar(tintaRow).c : Math.round((TINTA_DESTAQUE.pct / 100) * CONSERVADOR * 100) / 100;
  const tintaAgr = tintaRow ? alocacaoPar(tintaRow).a : Math.round((TINTA_DESTAQUE.pct / 100) * AGRESSIVO * 100) / 100;

  const linhasTabela = [];
  let somaPct = 0;
  let somaValor = 0;

  const pushDataRow = (row) => {
    somaPct += row.pctVendas;
    somaValor += row.valor;
    const trClass = row.nome === 'Tinta' ? ' class="row-emphasis"' : '';
    linhasTabela.push(
      `<tr${trClass}><td>${esc(row.nome)}</td><td class="num">${pctStr(row.pctVendas)}</td><td class="num val-rs">${brl(row.valor)}</td></tr>`,
    );
  };

  for (const row of main) pushDataRow(row);
  if (small.length) {
    linhasTabela.push(
      `<tr class="section-small-header"><td colspan="3">Itens menores (&lt; ${LIMITE_ITENS_PEQUENOS_PCT}% vendas e satélites temáticos)</td></tr>`,
    );
    for (const row of small) pushDataRow(row);
  }

  linhasTabela.push(
    `<tr class="total"><td><strong>TOTAL</strong></td><td class="num"><strong>${pctStr(Math.round(somaPct * 10) / 10)}</strong></td><td class="num val-rs"><strong>${brl(Math.round(somaValor * 100) / 100)}</strong></td></tr>`,
  );

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Estudo de Distribuição de Compras</title>
  ${pdfBarlowFontLink()}
  <style>
    ${pdfStudyStyles()}
    ${pdfDistribExtrasStyles()}
    .tinta-callout {
      border: 1px solid #c88a00;
      background-color: #fff8eb;
      color: #000;
    }
  </style>
</head>
<body class="distrib-doc">
  <h1>Estudo de Distribuição de Compras</h1>
  <p class="meta">
    <strong>Período:</strong> ${formatDateBr(DATA_INICIO)} a ${formatDateBr(DATA_FIM)} · Tabatinga ·
    <strong>Vendas:</strong> R$ ${brl(TOTAL_VENDAS)} (${PEDIDOS.toLocaleString('pt-BR')} pedidos, ${categorias.length} categorias h1 consolidadas em ${linhas.length} grupos)
  </p>
  <div class="tinta-callout">
    <strong>Tinta (fim de ano):</strong> ${pctStr(TINTA_DESTAQUE.pct)} das vendas (R$ ${brl(TINTA_DESTAQUE.valorVendas)}) →
    compra sugerida <strong>R$ ${brl(tintaCons)}</strong> (92k) / <strong>R$ ${brl(tintaAgr)}</strong> (120k).
  <em>Sazonalidade:</em> reservar folga no orçamento; esmaltes/spray entram em &quot;Pintura — complementos&quot;.
  </div>
  <p class="note">Vendas do período por grupo (${esc(GRUPO_EXCLUIDO_ALOC)} omitido da tabela e da alocação de compras — ${pctStr(blocoPct)} redistribuído no PDF de lotes). Blocos principais: ${main.length}; itens menores: ${small.length}. Alocação 92k/120k e contagem de lotes: ver PDF de lotes. <strong>Ferramentas</strong> inclui linha de pedreiro e espátula.</p>
  <table class="study-table distrib-table">
    <colgroup>
      <col class="col-grupo" /><col class="col-pct" /><col class="col-val" />
    </colgroup>
    <thead><tr><th>Grupo / categoria</th><th>% vendas</th><th>Vendas (R$)</th></tr></thead>
    <tbody>${linhasTabela.join('\n')}</tbody>
  </table>
  <p class="foot">
    Estudo apenas — não altera o sistema P38-ERP. Fonte: Supabase <code>pedido_venda_item</code> (sem cancelados/orçamentos).
    Gerado ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Rio_Branco' })}.
  </p>
</body>
</html>`;
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateBr(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Grade completa estilo Resumo global de estoque (distrib + lotes). */
function pdfResumoGlobalTableCss(tableSelector) {
  const font = pdfBarlowStack();
  return `
    ${tableSelector} {
      border-collapse: collapse;
      margin: 8px 0 12px;
      font-family: ${font};
    }
    ${tableSelector} th,
    ${tableSelector} td {
      border: 1px solid ${PDF_LINE};
      padding: 4px 6px;
      font-size: 9pt;
      vertical-align: middle;
      background-color: #ffffff;
      color: ${PDF_INK};
      word-wrap: break-word;
      line-height: 1.25;
    }
    ${tableSelector} thead th {
      font-size: 9pt;
      font-weight: 700;
      color: ${PDF_MUTED};
      text-transform: uppercase;
      letter-spacing: 0.02em;
      padding-top: 5px;
      padding-bottom: 5px;
    }
    ${tableSelector} td.val-rs {
      color: ${PDF_ACCENT};
      font-weight: 700;
      text-align: right;
    }
    ${tableSelector} tr.row-emphasis td:first-child {
      font-weight: 700;
    }
    ${tableSelector} tr.total td {
      font-weight: 700;
      color: ${PDF_INK};
    }
    ${tableSelector} tr.total td.val-rs {
      color: ${PDF_ACCENT};
    }
    ${tableSelector} tr.section-small-header td {
      font-weight: 700;
      color: ${PDF_MUTED};
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      background-color: #ffffff;
      border: 1px solid ${PDF_LINE};
      border-top-width: 2px;
      padding: 6px 6px 4px;
    }
  `;
}

function pdfDistribExtrasStyles() {
  return `
    body.distrib-doc { font-size: 10pt; line-height: 1.4; }
    body.distrib-doc .meta { font-size: 9pt; margin-bottom: 10px; }
    body.distrib-doc .note { font-size: 8.5pt; margin-bottom: 10px; }
    body.distrib-doc .tinta-callout {
      padding: 8px 10px;
      font-size: 8.5pt;
      margin-bottom: 10px;
      line-height: 1.4;
    }
    body.distrib-doc .foot { font-size: 8pt; margin-top: 10px; padding-top: 8px; }
    ${pdfResumoGlobalTableCss('table.distrib-table')}
    col.col-grupo { width: 52%; }
    col.col-pct { width: 16%; }
    col.col-val { width: 32%; }
  `;
}

function pdfLotesExtrasStyles() {
  return `
    body.lotes-doc { font-size: 10pt; line-height: 1.4; }
    body.lotes-doc .meta { font-size: 9pt; margin-bottom: 10px; }
    body.lotes-doc .note { font-size: 8.5pt; margin-bottom: 10px; }
    body.lotes-doc .callout { padding: 8px 10px; font-size: 8.5pt; margin-bottom: 10px; }
    ${pdfResumoGlobalTableCss('table.lotes-table')}
    table.lotes-table tr.group-block-end td {
      border: 1px solid ${PDF_LINE};
      padding-bottom: 8px;
    }
    table.lotes-table .lot-hint {
      font-size: 8pt;
      color: ${PDF_MUTED};
      font-weight: 400;
    }
    col.c-g { width: 22%; }
    col.c-p { width: 7%; }
    col.c-a { width: 12%; }
    col.c-l { width: 21%; }
    col.c-n { width: 8%; }
  `;
}

function buildHtmlLotes(lotes, prep) {
  let somaComprasCons = 0;
  let somaComprasAgr = 0;
  let somaAlocCons = 0;
  let somaAlocAgr = 0;
  const rows = [];
  let prevSection = 'main';
  for (const r of lotes) {
    const section = r.section ?? 'main';
    if (section === 'small' && prevSection !== 'small') {
      rows.push(
        `<tr class="section-small-header"><td colspan="7">Itens menores (&lt; ${LIMITE_ITENS_PEQUENOS_PCT}% vendas e satélites temáticos)</td></tr>`,
      );
    }
    prevSection = section;
    somaAlocCons += r.alocCons;
    somaAlocAgr += r.alocAgr;
    if (r.comprasCons != null) somaComprasCons += r.comprasCons;
    if (r.comprasAgr != null) somaComprasAgr += r.comprasAgr;
    const isCimento = r.grupo === 'Cimento Portland';
    let trClass = ' class="group-row"';
    if (isCimento || r.grupo === 'Tinta') trClass = ' class="group-row row-emphasis"';

    const obsLote =
      r.smallPoolLead && r.smallPoolSize
        ? ` <span class="lot-hint">(lote conjunto ×${r.smallPoolSize} grupos)</span>`
        : '';
    const loteCell = `${esc(r.lote)}${obsLote}`;

    rows.push(
      `<tr${trClass}><td>${esc(r.grupo)}</td><td class="num">${pctStr(r.pct)}</td><td class="num val-rs">${brl(r.alocCons)}</td><td class="num val-rs">${brl(r.alocAgr)}</td><td>${loteCell}</td><td class="num">${fmtComprasCell(r.comprasCons)}</td><td class="num">${fmtComprasCell(r.comprasAgr)}</td></tr>`,
    );
  }
  rows.push(
    `<tr class="total"><td><strong>TOTAL</strong></td><td class="num">—</td><td class="num val-rs"><strong>${brl(Math.round(somaAlocCons * 100) / 100)}</strong></td><td class="num val-rs"><strong>${brl(Math.round(somaAlocAgr * 100) / 100)}</strong></td><td>—</td><td class="num"><strong>${somaComprasCons}</strong></td><td class="num"><strong>${somaComprasAgr}</strong></td></tr>`,
  );

  const cimento = lotes.find((r) => r.grupo === 'Cimento Portland');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Estudo — Lotes de Compra</title>
  ${pdfBarlowFontLink()}
  <style>
    ${pdfStudyStyles()}
    ${pdfLotesExtrasStyles()}
  </style>
</head>
<body class="lotes-doc">
  <h1>Estudo — Lotes e número de compras</h1>
  <p class="meta">
    <strong>Período de vendas:</strong> ${formatDateBr(DATA_INICIO)} a ${formatDateBr(DATA_FIM)} ·
    tetos <strong>R$ ${brl(CONSERVADOR)}</strong> (conservador) e <strong>R$ ${brl(AGRESSIVO)}</strong> (agressivo). <strong>${esc(GRUPO_EXCLUIDO_ALOC)}</strong> fora da alocação (${pctStr(prep?.blocoPct ?? 0)} redistribuído).
  </p>
  <div class="callout">
    <strong>Cimento Portland:</strong> lote fixo ${LOTE_CIMENTO_SACOS} sacos ≈ R$ ${brl(LOTE_CIMENTO_RS)}.
    Alocação R$ ${brl(cimento?.alocCons ?? 0)} → ${cimento?.comprasCons ?? 0} compra(s) = ${cimento?.sacosCons ?? 0} sacos (≈ R$ ${brl(cimento?.valorPedidoCons ?? 0)} em pedidos).
    Alocação R$ ${brl(cimento?.alocAgr ?? 0)} → ${cimento?.comprasAgr ?? 0} compra(s) = ${cimento?.sacosAgr ?? 0} sacos (≈ R$ ${brl(cimento?.valorPedidoAgr ?? 0)}).
  </div>
  <p class="note">Grupos principais (≥ ${LIMITE_ITENS_PEQUENOS_PCT}%): lote <strong>R$ ${brl(LOTE_PADRAO_RS)}</strong> por grupo (compras = teto da alocação ÷ 5.000). <strong>Itens menores</strong>: uma linha por grupo, mas <strong>um único lote conjunto</strong> de R$ ${brl(LOTE_PADRAO_RS)} por cenário (92k / 120k), contando a soma das alocações da secção.</p>
  <table class="study-table lotes-table">
    <colgroup>
      <col class="c-g" /><col class="c-p" /><col class="c-a" /><col class="c-a" /><col class="c-l" /><col class="c-n" /><col class="c-n" />
    </colgroup>
    <thead>
      <tr>
        <th>Grupo</th><th>% aloc.</th><th>Alocação R$ 92.000</th><th>Alocação R$ 120.000</th><th>Tamanho do lote</th><th>Nº compras 92k</th><th>Nº compras 120k</th>
      </tr>
    </thead>
    <tbody>${rows.join('\n')}</tbody>
  </table>
  <p class="foot">Estudo apenas — não altera o sistema P38-ERP. Gerado ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Rio_Branco' })}.</p>
</body>
</html>`;
}

async function renderPdfFromHtml(html, outPath) {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(async () => {
      const stack = 'Barlow, sans-serif';
      try {
        await document.fonts.load(`400 9pt ${stack}`);
        await document.fonts.load(`700 9pt ${stack}`);
      } catch {
        /* fallback */
      }
      await (document.fonts?.ready ?? Promise.resolve());
    });
    await page.pdf({
      path: outPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      scale: 1,
      margin: { top: '8mm', bottom: '8mm', left: '6mm', right: '6mm' },
      tagged: false,
    });
  } finally {
    await browser.close();
  }
  return outPath;
}

const LOTE_CONJUNTO_ITENS_PEQUENOS = `R$ ${brl(LOTE_PADRAO_RS)} (lote conjunto — itens menores)`;

function comprasPorLote(linhas) {
  const ceilDiv = (valor, lote) => (valor <= 0 ? 0 : Math.ceil(valor / lote - 1e-9));

  const smallLinhas = linhas.filter((r) => r.section === 'small');
  const somaSmallCons = smallLinhas.reduce(
    (s, r) => s + Math.round(((r.pctAloc ?? r.pct) / 100) * CONSERVADOR * 100) / 100,
    0,
  );
  const somaSmallAgr = smallLinhas.reduce(
    (s, r) => s + Math.round(((r.pctAloc ?? r.pct) / 100) * AGRESSIVO * 100) / 100,
    0,
  );
  const poolComprasCons = smallLinhas.length > 0 ? ceilDiv(somaSmallCons, LOTE_PADRAO_RS) : 0;
  const poolComprasAgr = smallLinhas.length > 0 ? ceilDiv(somaSmallAgr, LOTE_PADRAO_RS) : 0;

  let primeroPequeno = true;

  return linhas.map((row) => {
    const pctAloc = row.pctAloc ?? row.pct;
    const cons = Math.round((pctAloc / 100) * CONSERVADOR * 100) / 100;
    const agr = Math.round((pctAloc / 100) * AGRESSIVO * 100) / 100;
    const isCimento = row.nome === 'Cimento Portland';

    if (row.section === 'small') {
      const exibeCompras = primeroPequeno;
      primeroPequeno = false;
      return {
        grupo: row.nome,
        pct: pctAloc,
        section: 'small',
        alocCons: cons,
        alocAgr: agr,
        lote: LOTE_CONJUNTO_ITENS_PEQUENOS,
        comprasCons: exibeCompras ? poolComprasCons : null,
        comprasAgr: exibeCompras ? poolComprasAgr : null,
        smallPoolLead: exibeCompras,
        smallPoolSize: smallLinhas.length,
        valorPedidoCons: null,
        valorPedidoAgr: null,
        sacosCons: null,
        sacosAgr: null,
      };
    }

    const loteLabel = isCimento
      ? `${LOTE_CIMENTO_SACOS} sacos / R$ ${brl(LOTE_CIMENTO_RS)}`
      : `R$ ${brl(LOTE_PADRAO_RS)}`;
    const loteRs = isCimento ? LOTE_CIMENTO_RS : LOTE_PADRAO_RS;
    const nCons = ceilDiv(cons, loteRs);
    const nAgr = ceilDiv(agr, loteRs);
    return {
      grupo: row.nome,
      pct: pctAloc,
      section: row.section ?? 'main',
      alocCons: cons,
      alocAgr: agr,
      lote: loteLabel,
      comprasCons: nCons,
      comprasAgr: nAgr,
      smallPoolLead: false,
      valorPedidoCons: nCons * loteRs,
      valorPedidoAgr: nAgr * loteRs,
      sacosCons: isCimento ? nCons * LOTE_CIMENTO_SACOS : null,
      sacosAgr: isCimento ? nAgr * LOTE_CIMENTO_SACOS : null,
    };
  });
}

function fmtComprasCell(n) {
  return n == null ? '—' : String(n);
}

function linhasParaEstudo(categorias) {
  return prepararLinhasAlocacao(consolidarParaTabela(categorias));
}

async function main() {
  if (process.argv.includes('--lotes-compras')) {
    const categorias = await loadCategorias();
    const prep = linhasParaEstudo(categorias);
    const out = comprasPorLote(prep.ordered);
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  const onlyLotes = process.argv.includes('--lotes-pdf');
  const onlyDistrib = process.argv.includes('--distrib-pdf');

  console.log('[pdf] Carregando vendas Supabase…');
  const categorias = await loadCategorias();
  console.log(`[pdf] ${categorias.length} categorias`);

  const prep = linhasParaEstudo(categorias);
  const linhasCons = prep.ordered;
  const lotes = comprasPorLote(linhasCons);

  if (onlyLotes) {
    const htmlLotes = buildHtmlLotes(lotes, prep);
    writeFileSync(path.join(OUT_DIR, '_tmp-estudo-lotes-compras.html'), htmlLotes, 'utf8');
    await renderPdfFromHtml(htmlLotes, OUT_PDF_LOTES);
    console.log(`[pdf] Salvo: ${OUT_PDF_LOTES} (${lotes.length} grupos + total pedidos)`);
    return;
  }

  console.log(`[pdf] ${linhasCons.length} grupos + total = ${linhasCons.length + 1} linhas na tabela`);

  const html = buildHtml(categorias);
  const htmlPath = path.join(OUT_DIR, '_tmp-estudo-distribuicao-compras.html');
  writeFileSync(htmlPath, html, 'utf8');
  await renderPdfFromHtml(html, OUT_PDF);
  console.log(`[pdf] Distribuição: ${OUT_PDF}`);

  if (onlyDistrib) return;

  const htmlLotes = buildHtmlLotes(lotes, prep);
  writeFileSync(path.join(OUT_DIR, '_tmp-estudo-lotes-compras.html'), htmlLotes, 'utf8');
  await renderPdfFromHtml(htmlLotes, OUT_PDF_LOTES);
  console.log(`[pdf] Lotes: ${OUT_PDF_LOTES}`);

  let pages = null;
  try {
    const { stdout } = await import('node:child_process').then(({ execFile }) =>
      new Promise((resolve, reject) => {
        execFile('pdfinfo', [OUT_PDF], (err, out) => (err ? reject(err) : resolve({ stdout: out })));
      }),
    );
    const m = stdout.match(/Pages:\s+(\d+)/);
    if (m) pages = Number(m[1]);
  } catch {
    /* pdfinfo opcional */
  }

  console.log(`[pdf] Salvo: ${OUT_PDF}${pages != null ? ` (${pages} página(s))` : ''}`);
  if (pages != null && pages > 1) {
    console.warn(`[pdf] AVISO: esperado 1 página, obteve ${pages}.`);
  }

  try {
    const { execFileSync } = await import('node:child_process');
    const text = execFileSync('pdftotext', [OUT_PDF, '-'], { encoding: 'utf8', maxBuffer: 2_000_000 });
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const hasTotal = lines.some((l) => l.includes('TOTAL'));
    const hasTinta = lines.some((l) => /tinta/i.test(l));
    console.log(`[pdf] Texto extraível: ${lines.length} linhas; TOTAL=${hasTotal}; Tinta=${hasTinta}`);
    if (!hasTotal || !hasTinta || lines.length < 15) {
      console.warn('[pdf] AVISO: camada de texto pode estar incompleta.');
    }
  } catch {
  /* pdftotext opcional */
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});