#!/usr/bin/env node
/**
 * Gera HTML partilhável — catálogo Tintão × Formigres (accordion + lightbox).
 *
 * npm run catalogo:html-tintao
 */
import fs from 'node:fs';
import path from 'node:path';
import { readJson, snapshotPath } from '../lib/catalogoPaths.mjs';
import { loadSnapshotFromFile } from '../lib/formigresSnapshot.mjs';
import { extractImagensFromDetalhe, fetchProdutoDetalhe } from '../lib/formigresCatalog.mjs';

const ROOT = process.cwd();
const CLASSIF_DIR = path.join(ROOT, 'docs', 'imports-local', 'tintao', 'classificacao');
const OUT_HTML = path.join(ROOT, 'docs', 'imports-local', 'tintao', 'catalogo-tintao-formigres.html');

const LINHA_ORDER = ['bold', 'retificada', 'polida', 'desconhecida'];
const LINHA_LABEL = {
  bold: 'Bold',
  retificada: 'Retificada',
  polida: 'Polida',
  desconhecida: 'Sem classificação',
};

const TIPO_ORDER = {
  bold: ['antiderrapante', 'semiderrapante', 'lisa'],
  retificada: ['antiderrapante', 'semiderrapante', 'lisa_mate', 'lisa_brilhante', 'lisa'],
  polida: ['polida'],
  desconhecida: ['outros'],
};

const TIPO_LABEL = {
  antiderrapante: 'Antiderrapante',
  semiderrapante: 'Semiderrapante',
  lisa: 'Lisa',
  lisa_mate: 'Lisa mate',
  lisa_brilhante: 'Lisa brilhante',
  polida: 'Polida',
  outros: 'Outros',
};

const ACAB_ORDER = [
  'POLIDO',
  'BRILHANTE',
  'MATE',
  'GRANILHADO',
  'PROTETIVA ADERENTE',
  'GRANILHADO ABS',
  'MATE ABS',
  'GOTEJADO',
  'Sem acabamento',
];

function argValue(flag) {
  const args = process.argv.slice(2);
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}

function findLatestClassifJson() {
  const custom = argValue('--json');
  if (custom && fs.existsSync(custom)) return custom;
  if (!fs.existsSync(CLASSIF_DIR)) return null;
  const files = fs.readdirSync(CLASSIF_DIR)
    .filter((f) => /^tintao-formigres-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse();
  return files[0] ? path.join(CLASSIF_DIR, files[0]) : null;
}

function tipoKey(item) {
  if (item.linha === 'polida') return 'polida';
  if (item.linha === 'retificada' && item.subtipo === 'lisa') {
    return item.variante_lisa ? `lisa_${item.variante_lisa}` : 'lisa';
  }
  return item.subtipo || 'outros';
}

function fmtMoney(v) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return `R$ ${n.toFixed(2).replace('.', ',')}`;
}

function fmtAreaKey(fmt) {
  const m = String(fmt || '').match(/(\d+)\s*x\s*(\d+)/i);
  if (!m) return 0;
  return Number(m[1]) * Number(m[2]);
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fixImageUrl(url) {
  if (!url) return '';
  if (url.includes('formigres.com.br/produtos/') && !url.includes('/uploads/produtos/')) {
    return url.replace('formigres.com.br/produtos/', 'formigres.com.br/uploads/produtos/');
  }
  return url;
}

function enrichItens(itens, snapshot) {
  const byId = new Map((snapshot?.produtos || []).map((p) => [String(p.id), p]));
  return itens.map((item) => {
    const prod = byId.get(String(item.formigres_id));
    const imagem_url = fixImageUrl(prod?.imagem_url || '');
    const imagem_amb_url = fixImageUrl(prod?.imagem_amb_url || '');
    const imagens = extractImagensFromDetalhe({
      imagem_url,
      imagem_amb_url,
      imagem_piso_url: fixImageUrl(prod?.imagem_piso_url || ''),
      faces: prod?.faces || [],
    });
    return {
      ...item,
      imagem_url,
      imagem_amb_url,
      produto_url: prod?.produto_url || '',
      imagens: imagens.length ? imagens : (imagem_url ? [{ url: imagem_url, tipo: 'principal' }] : []),
    };
  });
}

async function enrichImagensFromApi(itens) {
  const out = [];
  for (const item of itens) {
    if (!item.formigres_id) {
      out.push(item);
      continue;
    }
    try {
      const det = await fetchProdutoDetalhe(item.formigres_id);
      const imgs = extractImagensFromDetalhe(det ? {
        imagem_url: fixImageUrl(det.imagem_url || det.imagem),
        imagem_amb_url: fixImageUrl(det.imagem_amb_url || det.imagem_ambiente),
        imagem_piso_url: fixImageUrl(det.imagem_piso_url || det.imagem_piso),
        faces: Array.isArray(det.faces) ? det.faces : (det.imagens_faces ? JSON.parse(det.imagens_faces || '[]') : []),
      } : null);
      out.push({
        ...item,
        imagens: imgs.length ? imgs : item.imagens,
      });
    } catch {
      out.push(item);
    }
  }
  return out;
}

function slimItem(item) {
  return {
    codigo_tintao: item.codigo_tintao,
    descricao: item.descricao,
    formato: item.formato || '—',
    linha: item.linha || 'desconhecida',
    subtipo: item.subtipo,
    variante_lisa: item.variante_lisa,
    formigres_id: item.formigres_id || '',
    formigres_titulo: item.formigres_titulo || '',
    formigres_acabamento: item.formigres_acabamento || '',
    match_status: item.match_status,
    preco_m2: item.preco_m2,
    m2_por_caixa: item.m2_por_caixa ?? null,
    unidade: item.unidade || '',
    imagem_url: item.imagem_url || '',
    imagens: (item.imagens || []).map((img) => ({ url: img.url, tipo: img.tipo || 'principal' })),
  };
}

function buildHtml({ classif, itens }) {
  const gerado = new Date(classif.geradoEm || Date.now()).toLocaleString('pt-BR');
  const total = itens.length;
  const comFoto = itens.filter((i) => i.imagem_url).length;
  const catalogoJson = JSON.stringify({
    itens: itens.map(slimItem),
    config: {
      linhaOrder: LINHA_ORDER,
      linhaLabel: LINHA_LABEL,
      tipoOrder: TIPO_ORDER,
      tipoLabel: TIPO_LABEL,
      acabOrder: ACAB_ORDER,
    },
  }).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Catálogo Tintão — Formigres</title>
  <style>
    :root {
      --bg: #1f1d22;
      --surface: #2a272e;
      --surface-2: #343138;
      --border: #3f3b45;
      --text: #f4f2f6;
      --muted: #a8a3b0;
      --accent: #a4ce33;
      --accent-dim: #7a9a24;
      --warn: #f0a060;
      --radius: 14px;
      --shadow: 0 12px 40px rgba(0,0,0,.35);
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      line-height: 1.45;
      min-height: 100vh;
    }
    .wrap { max-width: 1100px; margin: 0 auto; padding: 20px 16px 48px; }
    header.hero {
      background: linear-gradient(135deg, #2a272e 0%, #1f1d22 60%);
      border: 1px solid var(--border);
      border-radius: calc(var(--radius) + 4px);
      padding: 20px 18px;
      margin-bottom: 18px;
    }
    header.hero h1 {
      margin: 0 0 6px;
      font-size: 1.35rem;
      letter-spacing: .02em;
    }
    header.hero p { margin: 0; color: var(--muted); font-size: .92rem; }
    .stats {
      display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px;
    }
    .stat {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 6px 12px;
      font-size: .82rem;
      color: var(--muted);
    }
    .stat strong { color: var(--accent); }
    .toolbar {
      display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap;
    }
    .search {
      flex: 1 1 220px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 999px;
      color: var(--text);
      padding: 10px 14px;
      font-size: .95rem;
      outline: none;
    }
    .search:focus { border-color: var(--accent-dim); box-shadow: 0 0 0 2px rgba(164,206,51,.15); }
    .btn {
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text);
      border-radius: 999px;
      padding: 10px 14px;
      cursor: pointer;
      font-size: .85rem;
    }
    .btn:hover { border-color: var(--accent-dim); color: var(--accent); }
    .select-group {
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text);
      border-radius: 999px;
      padding: 10px 14px;
      font-size: .85rem;
      cursor: pointer;
    }
    .select-group:focus { border-color: var(--accent-dim); outline: none; }
    .catalogo { display: grid; gap: 12px; }
    details.acc {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }
    details.acc > summary {
      list-style: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 12px;
      padding: 14px 16px 14px calc(14px + var(--depth, 0) * 18px);
      user-select: none;
    }
    details.acc > summary .acc-title { flex: 1; text-align: left; }
    details.acc > summary .acc-count { margin-left: auto; }
    details.acc > summary::-webkit-details-marker { display: none; }
    details.acc > summary::before {
      content: "▸";
      color: var(--accent);
      margin-right: 8px;
      transition: transform .15s ease;
      flex-shrink: 0;
    }
    details.acc[open] > summary::before { transform: rotate(90deg); }
    details.acc > summary:hover { background: rgba(164,206,51,.05); }
    .acc-title { font-weight: 600; font-size: 1rem; }
    .acc-count {
      font-size: .78rem;
      color: var(--muted);
      background: var(--surface-2);
      border-radius: 999px;
      padding: 4px 10px;
      white-space: nowrap;
    }
    .acc-inner { padding: 0 10px 12px calc(10px + var(--depth, 0) * 18px); display: grid; gap: 8px; }
    .acc-linha { --depth: 0; }
    .acc-grupo { --depth: 1; background: var(--surface-2); }
    .acc-formato { --depth: 2; background: #2f2c33; }
    .linha-bold { color: #e8f0c8; }
    .linha-retificada { color: #c8dff0; }
    .linha-polida { color: #f0e6c8; }
    .table-wrap {
      padding: 0 8px 10px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .model-table {
      width: 100%;
      border-collapse: collapse;
      font-size: .84rem;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
    }
    .model-table thead th {
      text-align: left;
      padding: 9px 10px;
      background: #232027;
      color: var(--muted);
      font-size: .72rem;
      text-transform: uppercase;
      letter-spacing: .04em;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    .model-table tbody tr {
      border-bottom: 1px solid var(--border);
    }
    .model-table tbody tr:last-child { border-bottom: 0; }
    .model-table tbody tr:hover { background: rgba(164,206,51,.04); }
    .model-table td {
      padding: 8px 10px;
      vertical-align: middle;
    }
    .col-foto { width: 58px; }
    .col-modelo { min-width: 140px; }
    .col-desc { min-width: 180px; color: var(--muted); font-size: .78rem; }
    .col-acab { white-space: nowrap; font-size: .78rem; }
    .col-preco { white-space: nowrap; text-align: right; }
    .col-cod { white-space: nowrap; color: var(--muted); font-size: .78rem; text-align: right; }
    .col-qty { width: 72px; text-align: center; }
    .qty-input {
      width: 56px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      padding: 6px 4px;
      font-size: .85rem;
      text-align: center;
    }
    .qty-input:focus { border-color: var(--accent-dim); outline: none; }
    .pedido-panel {
      display: none;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
      margin-bottom: 16px;
    }
    .pedido-panel.open { display: block; }
    .pedido-panel h2 { margin: 0 0 12px; font-size: 1.1rem; }
    .pedido-resumo {
      display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px;
    }
    .pedido-resumo .stat strong { font-size: 1rem; }
    .pedido-table { width: 100%; border-collapse: collapse; font-size: .84rem; }
    .pedido-table th, .pedido-table td {
      padding: 8px 10px; border-bottom: 1px solid var(--border); vertical-align: middle;
    }
    .pedido-table th {
      text-align: left; color: var(--muted); font-size: .72rem; text-transform: uppercase;
    }
    .pedido-table .col-subtotal { text-align: right; white-space: nowrap; }
    .pedido-total {
      margin-top: 12px; padding-top: 12px; border-top: 2px solid var(--accent-dim);
      display: flex; justify-content: flex-end; gap: 24px; font-size: 1rem;
    }
    .pedido-total strong { color: var(--accent); font-size: 1.15rem; }
    .btn-primary {
      background: var(--accent-dim);
      border-color: var(--accent);
      color: #1a1a12;
      font-weight: 600;
    }
    .btn-primary:hover { background: var(--accent); color: #111; }
    .btn.active { border-color: var(--accent); color: var(--accent); }
    #pedido-print { display: none; }
    @media print {
      body { background: #fff; color: #111; }
      .wrap > *:not(#pedido-print) { display: none !important; }
      #pedido-print {
        display: block !important;
        max-width: 100%;
        padding: 0;
      }
      #pedido-print table { width: 100%; border-collapse: collapse; font-size: 11px; }
      #pedido-print th, #pedido-print td { border: 1px solid #ccc; padding: 6px 8px; }
      #pedido-print img { width: 48px; height: 48px; object-fit: cover; }
    }
    .thumb-btn {
      display: block;
      width: 48px;
      height: 48px;
      padding: 0;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #151418;
      cursor: zoom-in;
      overflow: hidden;
    }
    .thumb-btn img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .thumb-btn:hover { border-color: var(--accent-dim); }
    .thumb-btn.has-gallery { position: relative; }
    .thumb-more {
      position: absolute; right: 2px; bottom: 2px;
      font-size: 10px; line-height: 1;
      background: rgba(0,0,0,.65); color: var(--accent);
      border-radius: 4px; padding: 2px 3px;
      pointer-events: none;
    }
    .thumb-empty {
      display: inline-grid;
      place-items: center;
      width: 48px;
      height: 48px;
      color: var(--muted);
      font-size: .75rem;
    }
    .badge {
      display: inline-block;
      font-size: .68rem;
      text-transform: uppercase;
      letter-spacing: .05em;
      border-radius: 999px;
      padding: 3px 8px;
      width: fit-content;
    }
    .badge.warn { background: rgba(240,160,96,.15); color: var(--warn); border: 1px solid rgba(240,160,96,.35); }
    .hidden { display: none !important; }
    .lightbox {
      position: fixed; inset: 0; z-index: 50;
      background: rgba(8,7,10,.88);
      display: none; align-items: center; justify-content: center;
      padding: 20px;
    }
    .lightbox.open { display: flex; }
    .lightbox-panel {
      max-width: min(920px, 100%);
      width: 100%;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .lightbox-head {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--border);
    }
    .lightbox-head h3 { margin: 0; font-size: .95rem; }
    .lightbox-meta { margin: 4px 0 0; font-size: .78rem; color: var(--muted); }
    .lightbox-meta.loading { color: var(--accent); }
    .lightbox-close {
      background: transparent; border: 1px solid var(--border); color: var(--text);
      border-radius: 8px; width: 34px; height: 34px; cursor: pointer; font-size: 1.1rem;
      flex-shrink: 0;
    }
    .lightbox-stage {
      position: relative; background: #111;
      display: grid; place-items: center; min-height: 280px;
    }
    .lightbox-stage img {
      max-width: 100%; max-height: 72vh; object-fit: contain; display: block;
    }
    .gallery-nav {
      position: absolute; top: 50%; transform: translateY(-50%);
      background: rgba(0,0,0,.55); border: 1px solid var(--border);
      color: var(--text); border-radius: 999px; width: 40px; height: 40px;
      cursor: pointer; font-size: 1.2rem; display: none;
    }
    .gallery-nav:hover { background: rgba(164,206,51,.25); border-color: var(--accent-dim); }
    .gallery-nav.prev { left: 8px; }
    .gallery-nav.next { right: 8px; }
    .lightbox.has-multi .gallery-nav { display: block; }
    .lightbox-dots {
      display: flex; gap: 6px; justify-content: center; flex-wrap: wrap;
      padding: 10px; border-top: 1px solid var(--border); background: var(--surface-2);
    }
    .lightbox-dot {
      width: 8px; height: 8px; border-radius: 999px; border: 0;
      background: var(--border); cursor: pointer; padding: 0;
    }
    .lightbox-dot.active { background: var(--accent); }
    .lightbox-dot[hidden] { display: none; }
    footer.note {
      margin-top: 20px; color: var(--muted); font-size: .78rem; text-align: center;
    }
    @media (max-width: 720px) {
      .wrap { padding: 14px 10px 36px; }
      header.hero { padding: 16px 14px; }
      header.hero h1 { font-size: 1.15rem; }
      .toolbar { gap: 8px; }
      .search { flex: 1 1 100%; min-width: 0; }
      .select-group, .btn { flex: 1 1 auto; font-size: .8rem; padding: 9px 12px; }
      details.acc > summary {
        padding: 12px 12px 12px calc(10px + var(--depth, 0) * 12px);
        gap: 8px;
      }
      .acc-inner { padding-left: calc(8px + var(--depth, 0) * 12px); }
      .acc-title { font-size: .92rem; }
      .acc-count { font-size: .72rem; padding: 3px 8px; }
      .col-desc, .model-table thead th:nth-child(3) { display: none; }
      .model-table { font-size: .8rem; }
      .col-modelo { min-width: 100px; }
      .lightbox { padding: 10px; }
      .gallery-nav { width: 36px; height: 36px; }
    }
    @media (max-width: 480px) {
      .col-acab, .col-cod,
      .model-table thead th:nth-child(4),
      .model-table thead th:nth-child(6) { display: none; }
      .stats { gap: 6px; }
      .stat { font-size: .75rem; padding: 5px 10px; }
      .thumb-btn { width: 42px; height: 42px; }
      .model-table td, .model-table th { padding: 7px 8px; }
      .lightbox-head h3 { font-size: .88rem; }
      .lightbox-stage { min-height: 220px; }
      .lightbox-stage img { max-height: 58vh; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <h1>Catálogo Tintão — Formigres</h1>
      <p>Lista orçamento 24/08/2026 · classificação Bold / Retificada / Polida</p>
      <div class="stats">
        <span class="stat"><strong>${total}</strong> modelos</span>
        <span class="stat"><strong>${comFoto}</strong> com foto</span>
        <span class="stat">Gerado em ${esc(gerado)}</span>
      </div>
    </header>

    <div class="toolbar">
      <input id="search" class="search" type="search" placeholder="Buscar modelo, formato, acabamento…" />
      <select id="group-by" class="select-group" title="Como agrupar dentro de Bold / Retificada / Polida">
        <option value="tipo">Agrupar: tipo</option>
        <option value="acabamento">Agrupar: acabamento</option>
      </select>
      <button type="button" class="btn" id="filter-qty">Só com quantidade</button>
      <button type="button" class="btn" id="clear-qty" title="Zerar todas as caixas preenchidas">Limpar seleção</button>
      <button type="button" class="btn" id="toggle-pedido">Ver pedido</button>
      <button type="button" class="btn btn-primary" id="pdf-pedido">PDF do pedido</button>
      <button type="button" class="btn" id="expand-all">Abrir tudo</button>
      <button type="button" class="btn" id="collapse-all">Fechar tudo</button>
    </div>

    <section class="pedido-panel" id="pedido-panel" aria-label="Resumo do pedido">
      <h2>Resumo do pedido</h2>
      <div class="pedido-resumo" id="pedido-resumo"></div>
      <div class="table-wrap">
        <table class="pedido-table" id="pedido-table">
          <thead>
            <tr>
              <th>Foto</th><th>Modelo</th><th>Formato</th><th>Caixas</th><th>m²/cx</th><th>m² total</th><th>Preço/m²</th><th>Subtotal</th>
            </tr>
          </thead>
          <tbody id="pedido-body"></tbody>
        </table>
      </div>
      <div class="pedido-total" id="pedido-total"></div>
    </section>

    <section class="catalogo" id="catalogo"></section>

    <footer class="note">HTML autónomo — partilhe por WhatsApp, e-mail ou drive. Defina quantidades de caixa, veja o pedido e gere PDF. Fotos embutidas na geração (galeria completa sem depender de internet).</footer>
  </div>

  <div id="pedido-print"></div>

  <div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="Galeria do produto">
    <div class="lightbox-panel">
      <div class="lightbox-head">
        <div style="min-width:0;flex:1">
          <h3 id="lightbox-title">Modelo</h3>
          <p class="lightbox-meta" id="lightbox-meta">Cerâmica</p>
        </div>
        <button type="button" class="lightbox-close" id="lightbox-close" aria-label="Fechar">×</button>
      </div>
      <div class="lightbox-stage">
        <button type="button" class="gallery-nav prev" id="gallery-prev" aria-label="Foto anterior">‹</button>
        <img id="lightbox-img" src="" alt="" />
        <button type="button" class="gallery-nav next" id="gallery-next" aria-label="Próxima foto">›</button>
      </div>
      <div class="lightbox-dots" id="lightbox-dots" hidden></div>
    </div>
  </div>

  <script id="catalogo-data" type="application/json">${catalogoJson}</script>
  <script>
    const CATALOGO = JSON.parse(document.getElementById('catalogo-data').textContent);
    const CFG = CATALOGO.config;
    const TIPO_LABEL_GAL = { principal: 'Cerâmica', ambiente: 'Ambiente', piso: 'Piso', face: 'Face', outro: 'Imagem' };
    const QTY_KEY = 'tintao-pedido-qty-v1';
    const itemsByCode = new Map(CATALOGO.itens.map((i) => [String(i.codigo_tintao), i]));
    let qtyMap = {};
    try { qtyMap = JSON.parse(localStorage.getItem(QTY_KEY) || '{}'); } catch { qtyMap = {}; }
    let groupBy = 'tipo';
    let filterQtyOnly = false;
    let pedidoOpen = false;
    let dom = {};

    function esc(s) {
      return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function fmtMoney(v) {
      if (v == null || v === '') return '—';
      const n = Number(v);
      return Number.isNaN(n) ? String(v) : 'R$ ' + n.toFixed(2).replace('.', ',');
    }
    function fmtAreaKey(fmt) {
      const m = String(fmt || '').match(/(\\d+)\\s*x\\s*(\\d+)/i);
      return m ? Number(m[1]) * Number(m[2]) : 0;
    }
    function getQty(cod) {
      const n = Number(qtyMap[String(cod)] || 0);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    }
    function setQty(cod, val) {
      const n = Math.max(0, Math.floor(Number(val) || 0));
      if (n > 0) qtyMap[String(cod)] = n;
      else delete qtyMap[String(cod)];
      localStorage.setItem(QTY_KEY, JSON.stringify(qtyMap));
      renderPedido();
      if (filterQtyOnly) applySearch(document.getElementById('search').value);
    }
    function clearAllQty() {
      const hasQty = Object.keys(qtyMap).length > 0 || [...document.querySelectorAll('.qty-input')].some((el) => Number(el.value) > 0);
      if (!hasQty) return;
      if (!confirm('Limpar todas as quantidades de caixa?')) return;
      qtyMap = {};
      localStorage.removeItem(QTY_KEY);
      document.querySelectorAll('.qty-input').forEach((input) => {
        input.value = '';
        const row = input.closest('.model-row');
        if (row) row.dataset.qty = '0';
      });
      renderPedido();
      if (filterQtyOnly) applySearch(document.getElementById('search').value);
    }
    function parseM2Caixa(item) {
      if (item.m2_por_caixa) return Number(item.m2_por_caixa);
      const m = String(item.unidade || item.descricao || '').match(/CX\\s*([\\d,]+)\\s*M2/i) || String(item.descricao || '').match(/([\\d,]+)\\s*M2/i);
      return m ? Number(m[1].replace(',', '.')) : null;
    }
    function itemSubtotal(item, qty) {
      const m2cx = parseM2Caixa(item);
      const preco = Number(item.preco_m2);
      if (!qty || !m2cx || !preco) return null;
      return qty * m2cx * preco;
    }
    function pedidoItens() {
      return CATALOGO.itens
        .map((item) => ({ item, qty: getQty(item.codigo_tintao) }))
        .filter((x) => x.qty > 0);
    }
    function tipoKey(item) {
      if (item.linha === 'polida') return 'polida';
      if (item.linha === 'retificada' && item.subtipo === 'lisa') {
        return item.variante_lisa ? 'lisa_' + item.variante_lisa : 'lisa';
      }
      return item.subtipo || 'outros';
    }
    function acabKey(item) {
      const a = String(item.formigres_acabamento || '').trim();
      return a || 'Sem acabamento';
    }
    function grupoLabel(key, linha) {
      if (groupBy === 'acabamento') return key;
      return (CFG.tipoLabel[key] || key);
    }
    function sortGrupos(keys, linha) {
      if (groupBy === 'acabamento') {
        const order = CFG.acabOrder || [];
        return [...keys].sort((a, b) => {
          const ia = order.indexOf(a); const ib = order.indexOf(b);
          if (ia >= 0 && ib >= 0) return ia - ib;
          if (ia >= 0) return -1; if (ib >= 0) return 1;
          return a.localeCompare(b, 'pt-BR');
        });
      }
      const order = CFG.tipoOrder[linha] || [];
      return order.filter((k) => keys.includes(k)).concat(keys.filter((k) => !order.includes(k)).sort());
    }
    function buildTree(itens) {
      const tree = {};
      for (const item of itens) {
        const linha = item.linha || 'desconhecida';
        const grupo = groupBy === 'acabamento' ? acabKey(item) : tipoKey(item);
        const formato = item.formato || '—';
        tree[linha] ??= {};
        tree[linha][grupo] ??= {};
        tree[linha][grupo][formato] ??= [];
        tree[linha][grupo][formato].push(item);
      }
      for (const linha of Object.keys(tree)) {
        for (const grupo of Object.keys(tree[linha])) {
          for (const formato of Object.keys(tree[linha][grupo])) {
            tree[linha][grupo][formato].sort((a, b) =>
              (a.formigres_titulo || a.descricao || '').localeCompare(b.formigres_titulo || b.descricao || '', 'pt-BR')
            );
          }
        }
      }
      return tree;
    }
    function getGaleria(item) {
      const imgs = Array.isArray(item.imagens) ? item.imagens.filter((i) => i && i.url) : [];
      if (imgs.length) return imgs;
      return item.imagem_url ? [{ url: item.imagem_url, tipo: 'principal' }] : [];
    }
    function renderRow(item) {
      const imgs = getGaleria(item);
      const img = imgs[0]?.url || item.imagem_url || '';
      const titulo = item.formigres_titulo || item.descricao;
      const cod = item.codigo_tintao;
      const qty = getQty(cod);
      const foto = img
        ? '<button type="button" class="thumb-btn' + (imgs.length > 1 ? ' has-gallery' : '') + '" data-cod="' + esc(cod) + '" data-title="' + esc(titulo) + '" title="Clique para ver fotos"><img src="' + esc(img) + '" alt="" loading="lazy" />' + (imgs.length > 1 ? '<span class="thumb-more" aria-hidden="true">▦</span>' : '') + '</button>'
        : '<span class="thumb-empty">—</span>';
      const warn = item.match_status !== 'encontrado' ? ' <span class="badge warn">sem match</span>' : '';
      return '<tr class="model-row" data-cod="' + esc(cod) + '" data-search="' + esc((titulo + ' ' + item.descricao + ' ' + item.formigres_acabamento + ' ' + item.formato).toLowerCase()) + '" data-qty="' + qty + '">' +
        '<td class="col-foto">' + foto + '</td>' +
        '<td class="col-modelo"><strong>' + esc(titulo) + '</strong>' + warn + '</td>' +
        '<td class="col-desc">' + esc(item.descricao) + '</td>' +
        '<td class="col-acab">' + esc(item.formigres_acabamento || '—') + '</td>' +
        '<td class="col-preco">' + esc(fmtMoney(item.preco_m2)) + '</td>' +
        '<td class="col-qty"><input type="number" class="qty-input" min="0" step="1" value="' + (qty || '') + '" data-cod="' + esc(cod) + '" aria-label="Caixas" placeholder="0" /></td>' +
        '<td class="col-cod">' + esc(cod) + '</td></tr>';
    }
    function renderFormato(formato, items) {
      const n = items.length;
      return '<details class="acc acc-formato"><summary><span class="acc-title">Formato ' + esc(formato) + '</span><span class="acc-count">' + n + ' modelo' + (n === 1 ? '' : 's') + '</span></summary>' +
        '<div class="table-wrap"><table class="model-table"><thead><tr><th>Foto</th><th>Modelo</th><th>Descrição Tintão</th><th>Acabamento</th><th>Preço/m²</th><th>Caixas</th><th>Cód.</th></tr></thead><tbody>' +
        items.map(renderRow).join('') + '</tbody></table></div></details>';
    }
    function renderGrupo(key, formatosMap, linha) {
      const formatos = Object.keys(formatosMap).sort((a, b) => fmtAreaKey(b) - fmtAreaKey(a) || a.localeCompare(b));
      const n = formatos.reduce((s, f) => s + formatosMap[f].length, 0);
      return '<details class="acc acc-grupo"><summary><span class="acc-title">' + esc(grupoLabel(key, linha)) + '</span><span class="acc-count">' + n + ' itens</span></summary>' +
        '<div class="acc-inner">' + formatos.map((f) => renderFormato(f, formatosMap[f])).join('') + '</div></details>';
    }
    function renderLinha(linha, gruposMap) {
      const keys = sortGrupos(Object.keys(gruposMap), linha);
      const n = keys.reduce((s, k) => s + Object.values(gruposMap[k]).reduce((a, arr) => a + arr.length, 0), 0);
      const label = CFG.linhaLabel[linha] || linha;
      return '<details class="acc acc-linha" open><summary><span class="acc-title linha-' + esc(linha) + '">' + esc(label) + '</span><span class="acc-count">' + n + ' itens</span></summary>' +
        '<div class="acc-inner">' + keys.map((k) => renderGrupo(k, gruposMap[k], linha)).join('') + '</div></details>';
    }
    function renderCatalogo() {
      const tree = buildTree(CATALOGO.itens);
      const html = (CFG.linhaOrder || []).filter((l) => tree[l]).map((l) => renderLinha(l, tree[l])).join('');
      document.getElementById('catalogo').innerHTML = html;
      refreshDom();
      applySearch(document.getElementById('search').value);
    }
    function refreshDom() {
      dom.rows = [...document.querySelectorAll('.model-row')];
      dom.formatos = [...document.querySelectorAll('.acc-formato')];
      dom.grupos = [...document.querySelectorAll('.acc-grupo')];
      dom.linhas = [...document.querySelectorAll('.acc-linha')];
      dom.allDetails = [...document.querySelectorAll('details.acc')];
    }
    function normalize(s) {
      return (s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
    }
    function applySearch(termRaw) {
      const term = normalize(termRaw.trim());
      for (const row of dom.rows) {
        const qty = Number(row.dataset.qty || 0);
        const showQty = !filterQtyOnly || qty > 0;
        const showTerm = !term || normalize(row.textContent).includes(term);
        const show = showQty && showTerm;
        row.classList.toggle('hidden', !show);
      }
      for (const fmt of dom.formatos) {
        fmt.classList.toggle('hidden', fmt.querySelectorAll('.model-row:not(.hidden)').length === 0);
      }
      for (const g of dom.grupos) {
        g.classList.toggle('hidden', g.querySelectorAll('.acc-formato:not(.hidden)').length === 0);
      }
      for (const l of dom.linhas) {
        l.classList.toggle('hidden', l.querySelectorAll('.acc-grupo:not(.hidden)').length === 0);
      }
    }

    function renderPedido() {
      const rows = pedidoItens();
      let totalCaixas = 0;
      let totalM2 = 0;
      let totalValor = 0;
      const body = rows.map(({ item, qty }) => {
        const m2cx = parseM2Caixa(item);
        const m2tot = m2cx ? qty * m2cx : null;
        const sub = itemSubtotal(item, qty);
        totalCaixas += qty;
        if (m2tot) totalM2 += m2tot;
        if (sub) totalValor += sub;
        const imgs = getGaleria(item);
        const img = imgs[0]?.url || '';
        const titulo = item.formigres_titulo || item.descricao;
        return '<tr>' +
          '<td>' + (img ? '<img src="' + esc(img) + '" alt="" width="48" height="48" style="object-fit:cover;border-radius:6px" />' : '—') + '</td>' +
          '<td><strong>' + esc(titulo) + '</strong><br><small>' + esc(item.codigo_tintao) + '</small></td>' +
          '<td>' + esc(item.formato || '—') + '</td>' +
          '<td>' + qty + '</td>' +
          '<td>' + (m2cx ? m2cx.toFixed(2).replace('.', ',') : '—') + '</td>' +
          '<td>' + (m2tot ? m2tot.toFixed(2).replace('.', ',') : '—') + '</td>' +
          '<td>' + esc(fmtMoney(item.preco_m2)) + '</td>' +
          '<td class="col-subtotal">' + esc(sub != null ? fmtMoney(sub) : '—') + '</td></tr>';
      }).join('');
      document.getElementById('pedido-body').innerHTML = body || '<tr><td colspan="8" style="color:var(--muted);text-align:center">Nenhum item com quantidade definida.</td></tr>';
      document.getElementById('pedido-resumo').innerHTML =
        '<span class="stat"><strong>' + rows.length + '</strong> modelos</span>' +
        '<span class="stat"><strong>' + totalCaixas + '</strong> caixas</span>' +
        '<span class="stat"><strong>' + totalM2.toFixed(2).replace('.', ',') + '</strong> m²</span>';
      document.getElementById('pedido-total').innerHTML =
        '<span>Total estimado: <strong>' + fmtMoney(totalValor) + '</strong></span>';
    }

    function buildPedidoPrintHtml() {
      const rows = pedidoItens();
      let totalCaixas = 0, totalM2 = 0, totalValor = 0;
      const body = rows.map(({ item, qty }) => {
        const m2cx = parseM2Caixa(item);
        const m2tot = m2cx ? qty * m2cx : null;
        const sub = itemSubtotal(item, qty);
        totalCaixas += qty;
        if (m2tot) totalM2 += m2tot;
        if (sub) totalValor += sub;
        const img = getGaleria(item)[0]?.url || '';
        const titulo = item.formigres_titulo || item.descricao;
        return '<tr><td>' + (img ? '<img src="' + img + '" alt="" />' : '') + '</td><td>' + titulo + '<br><small>' + item.codigo_tintao + '</small></td><td>' + (item.formato || '—') + '</td><td style="text-align:center">' + qty + '</td><td>' + (m2cx ? m2cx.toFixed(2) : '—') + '</td><td>' + (m2tot ? m2tot.toFixed(2) : '—') + '</td><td>' + fmtMoney(item.preco_m2) + '</td><td style="text-align:right">' + (sub != null ? fmtMoney(sub) : '—') + '</td></tr>';
      }).join('');
      return '<div style="font-family:Arial,sans-serif;padding:24px;color:#111">' +
        '<h1 style="margin:0 0 4px;font-size:20px">Pedido — Catálogo Tintão × Formigres</h1>' +
        '<p style="margin:0 0 16px;color:#555;font-size:12px">Gerado em ' + new Date().toLocaleString('pt-BR') + '</p>' +
        '<table><thead><tr><th>Foto</th><th>Modelo</th><th>Formato</th><th>Caixas</th><th>m²/cx</th><th>m² total</th><th>Preço/m²</th><th>Subtotal</th></tr></thead><tbody>' + body + '</tbody></table>' +
        '<p style="text-align:right;margin-top:16px;font-size:14px"><strong>' + rows.length + ' modelos · ' + totalCaixas + ' caixas · ' + totalM2.toFixed(2) + ' m² · Total: ' + fmtMoney(totalValor) + '</strong></p></div>';
    }

    const q = document.getElementById('search');
    const groupSel = document.getElementById('group-by');
    const btnFilterQty = document.getElementById('filter-qty');
    const btnClearQty = document.getElementById('clear-qty');
    const btnPedido = document.getElementById('toggle-pedido');
    const btnPdf = document.getElementById('pdf-pedido');
    const pedidoPanel = document.getElementById('pedido-panel');

    q.addEventListener('input', () => applySearch(q.value));
    groupSel.addEventListener('change', () => {
      groupBy = groupSel.value;
      renderCatalogo();
    });
    btnFilterQty.addEventListener('click', () => {
      filterQtyOnly = !filterQtyOnly;
      btnFilterQty.classList.toggle('active', filterQtyOnly);
      applySearch(q.value);
    });
    btnClearQty.addEventListener('click', clearAllQty);
    btnPedido.addEventListener('click', () => {
      pedidoOpen = !pedidoOpen;
      pedidoPanel.classList.toggle('open', pedidoOpen);
      btnPedido.classList.toggle('active', pedidoOpen);
      if (pedidoOpen) renderPedido();
    });
    btnPdf.addEventListener('click', () => {
      if (!pedidoItens().length) {
        alert('Defina quantidades de caixa antes de gerar o PDF.');
        return;
      }
      document.getElementById('pedido-print').innerHTML = buildPedidoPrintHtml();
      window.print();
    });

    document.getElementById('catalogo').addEventListener('input', (e) => {
      const input = e.target.closest('.qty-input');
      if (!input) return;
      setQty(input.dataset.cod, input.value);
      const row = input.closest('.model-row');
      if (row) row.dataset.qty = String(getQty(input.dataset.cod));
    });
    document.getElementById('catalogo').addEventListener('change', (e) => {
      const input = e.target.closest('.qty-input');
      if (!input) return;
      setQty(input.dataset.cod, input.value);
      const row = input.closest('.model-row');
      if (row) row.dataset.qty = String(getQty(input.dataset.cod));
    });

    document.getElementById('expand-all').addEventListener('click', () => {
      dom.allDetails.forEach((d) => { d.open = true; });
    });
    document.getElementById('collapse-all').addEventListener('click', () => {
      dom.allDetails.forEach((d) => { d.open = false; });
    });

    renderCatalogo();
    renderPedido();

    const lb = document.getElementById('lightbox');
    const lbImg = document.getElementById('lightbox-img');
    const lbTitle = document.getElementById('lightbox-title');
    const lbMeta = document.getElementById('lightbox-meta');
    const lbDots = document.getElementById('lightbox-dots');
    const btnPrev = document.getElementById('gallery-prev');
    const btnNext = document.getElementById('gallery-next');
    let galeriaAtual = [];
    let galeriaIdx = 0;

    function renderGaleriaIdx(idx) {
      if (!galeriaAtual.length) return;
      galeriaIdx = ((idx % galeriaAtual.length) + galeriaAtual.length) % galeriaAtual.length;
      const img = galeriaAtual[galeriaIdx];
      lbImg.src = img.url;
      lbImg.alt = lbTitle.textContent;
      lbMeta.textContent = (galeriaAtual.length > 1 ? (galeriaIdx + 1) + ' / ' + galeriaAtual.length + ' · ' : '') + (TIPO_LABEL_GAL[img.tipo] || img.tipo);
      lbMeta.classList.remove('loading');
      lb.classList.toggle('has-multi', galeriaAtual.length > 1);
      lbDots.hidden = galeriaAtual.length <= 1;
      lbDots.innerHTML = galeriaAtual.map((_, i) =>
        '<button type="button" class="lightbox-dot' + (i === galeriaIdx ? ' active' : '') + '" data-idx="' + i + '" aria-label="Foto ' + (i+1) + '"></button>'
      ).join('');
    }

    function openGaleria(imagens, title, loadingMore) {
      galeriaAtual = imagens.length ? imagens : [];
      galeriaIdx = 0;
      lbTitle.textContent = title || 'Modelo';
      if (loadingMore) {
        lbMeta.textContent = 'A carregar mais fotos…';
        lbMeta.classList.add('loading');
      }
      renderGaleriaIdx(0);
      lb.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      lb.classList.remove('open', 'has-multi');
      document.body.style.overflow = '';
      lbImg.src = '';
      galeriaAtual = [];
    }

    function onThumbClick(btn) {
      const title = btn.dataset.title || 'Modelo';
      const item = itemsByCode.get(String(btn.dataset.cod || ''));
      const imagens = item ? getGaleria(item) : [];
      openGaleria(imagens, title, false);
    }

    document.getElementById('catalogo').addEventListener('click', (e) => {
      const btn = e.target.closest('.thumb-btn');
      if (!btn) return;
      onThumbClick(btn);
    });
    btnPrev.addEventListener('click', () => renderGaleriaIdx(galeriaIdx - 1));
    btnNext.addEventListener('click', () => renderGaleriaIdx(galeriaIdx + 1));
    lbDots.addEventListener('click', (e) => {
      const dot = e.target.closest('.lightbox-dot');
      if (!dot) return;
      renderGaleriaIdx(Number(dot.dataset.idx));
    });
    document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
    lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
    document.addEventListener('keydown', (e) => {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') renderGaleriaIdx(galeriaIdx - 1);
      if (e.key === 'ArrowRight') renderGaleriaIdx(galeriaIdx + 1);
    });
  </script>
</body>
</html>`;
}

function main() {
  return mainAsync().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

async function mainAsync() {
  const jsonPath = findLatestClassifJson();
  if (!jsonPath) {
    console.error('JSON de classificação não encontrado. Rode: npm run catalogo:classificar-tintao');
    process.exit(1);
  }

  const classif = readJson(jsonPath);
  const snapshot = loadSnapshotFromFile(readJson(snapshotPath('formigres')));
  if (!snapshot) {
    console.error('Snapshot Formigres ausente. Rode: npm run catalogo:snapshot-formigres');
    process.exit(1);
  }

  const itensBase = enrichItens(classif.itens || [], snapshot);
  console.error('A carregar fotos do site Formigres…');
  const itens = await enrichImagensFromApi(itensBase);
  const html = buildHtml({ classif, itens });

  fs.mkdirSync(path.dirname(OUT_HTML), { recursive: true });
  fs.writeFileSync(OUT_HTML, html);

  console.log(JSON.stringify({
    ok: true,
    itens: itens.length,
    comFoto: itens.filter((i) => i.imagem_url).length,
    comGaleria: itens.filter((i) => (i.imagens || []).length > 1).length,
    fonte: jsonPath,
    html: OUT_HTML,
  }, null, 2));
}

main();
