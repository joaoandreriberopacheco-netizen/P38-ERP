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

function buildTree(itens) {
  const tree = {};
  for (const item of itens) {
    const linha = item.linha || 'desconhecida';
    const tipo = tipoKey(item);
    const formato = item.formato || '—';
    tree[linha] ??= {};
    tree[linha][tipo] ??= {};
    tree[linha][tipo][formato] ??= [];
    tree[linha][tipo][formato].push(item);
  }

  for (const linha of Object.keys(tree)) {
    for (const tipo of Object.keys(tree[linha])) {
      for (const formato of Object.keys(tree[linha][tipo])) {
        tree[linha][tipo][formato].sort((a, b) => {
          const ta = (a.formigres_titulo || a.descricao || '').localeCompare(b.formigres_titulo || b.descricao || '', 'pt-BR');
          return ta;
        });
      }
    }
  }
  return tree;
}

function renderTableRow(item) {
  const img = item.imagem_url || '';
  const titulo = item.formigres_titulo || item.descricao;
  const fid = item.formigres_id || '';
  const foto = img && fid
    ? `<button type="button" class="thumb-btn has-gallery" data-formigres-id="${esc(fid)}" data-thumb="${esc(img)}" data-title="${esc(titulo)}" aria-label="Galeria ${esc(titulo)}" title="Clique para ver fotos (carrega mais ao abrir)">
         <img src="${esc(img)}" alt="" loading="lazy" />
         <span class="thumb-more" aria-hidden="true">▦</span>
       </button>`
    : img
      ? `<button type="button" class="thumb-btn" data-thumb="${esc(img)}" data-title="${esc(titulo)}" aria-label="Ampliar ${esc(titulo)}">
           <img src="${esc(img)}" alt="" loading="lazy" />
         </button>`
      : `<span class="thumb-empty">—</span>`;

  const warn = item.match_status !== 'encontrado' ? ' <span class="badge warn">sem match</span>' : '';

  return `<tr class="model-row" data-search="${esc(`${titulo} ${item.descricao} ${item.formigres_acabamento} ${item.formato}`.toLowerCase())}">
    <td class="col-foto">${foto}</td>
    <td class="col-modelo"><strong>${esc(titulo)}</strong>${warn}</td>
    <td class="col-desc">${esc(item.descricao)}</td>
    <td class="col-acab">${esc(item.formigres_acabamento || '—')}</td>
    <td class="col-preco">${esc(fmtMoney(item.preco_m2))}</td>
    <td class="col-cod">${esc(item.codigo_tintao)}</td>
  </tr>`;
}

function renderFormatoBlock(formato, items) {
  const count = items.length;
  return `<details class="acc acc-formato">
    <summary>
      <span class="acc-title">Formato ${esc(formato)}</span>
      <span class="acc-count">${count} modelo${count === 1 ? '' : 's'}</span>
    </summary>
    <div class="table-wrap">
      <table class="model-table">
        <thead>
          <tr>
            <th>Foto</th>
            <th>Modelo Formigres</th>
            <th>Descrição Tintão</th>
            <th>Acabamento</th>
            <th>Preço/m²</th>
            <th>Cód.</th>
          </tr>
        </thead>
        <tbody>${items.map(renderTableRow).join('')}</tbody>
      </table>
    </div>
  </details>`;
}

function renderTipoBlock(tipo, formatosMap) {
  const count = Object.values(formatosMap).reduce((n, arr) => n + arr.length, 0);
  const formatos = Object.keys(formatosMap).sort((a, b) => fmtAreaKey(b) - fmtAreaKey(a) || a.localeCompare(b));
  return `<details class="acc acc-tipo">
    <summary>
      <span class="acc-title">${esc(TIPO_LABEL[tipo] || tipo)}</span>
      <span class="acc-count">${count} itens</span>
    </summary>
    <div class="acc-inner">${formatos.map((f) => renderFormatoBlock(f, formatosMap[f])).join('')}</div>
  </details>`;
}

function renderLinhaBlock(linha, tiposMap) {
  const count = Object.values(tiposMap).reduce((n, fm) => n + Object.values(fm).reduce((m, arr) => m + arr.length, 0), 0);
  const tipos = (TIPO_ORDER[linha] || Object.keys(tiposMap))
    .filter((t) => tiposMap[t] && Object.keys(tiposMap[t]).length);

  return `<details class="acc acc-linha" open>
    <summary>
      <span class="acc-title linha-${esc(linha)}">${esc(LINHA_LABEL[linha] || linha)}</span>
      <span class="acc-count">${count} itens</span>
    </summary>
    <div class="acc-inner">${tipos.map((t) => renderTipoBlock(t, tiposMap[t])).join('')}</div>
  </details>`;
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
    return {
      ...item,
      imagem_url: fixImageUrl(prod?.imagem_url || ''),
      imagem_amb_url: fixImageUrl(prod?.imagem_amb_url || ''),
      produto_url: prod?.produto_url || '',
    };
  });
}

function buildHtml({ classif, itens, tree }) {
  const gerado = new Date(classif.geradoEm || Date.now()).toLocaleString('pt-BR');
  const total = itens.length;
  const comFoto = itens.filter((i) => i.imagem_url).length;

  const linhasHtml = LINHA_ORDER
    .filter((l) => tree[l])
    .map((l) => renderLinhaBlock(l, tree[l]))
    .join('');

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
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px;
      user-select: none;
    }
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
    .acc-inner { padding: 0 10px 12px; display: grid; gap: 8px; }
    .acc-linha > .acc-inner { padding-left: 8px; }
    .acc-tipo { background: var(--surface-2); }
    .acc-formato { background: #2f2c33; }
    .linha-bold { color: #e8f0c8; }
    .linha-retificada { color: #c8dff0; }
    .linha-polida { color: #f0e6c8; }
    .table-wrap { padding: 0 8px 10px; overflow-x: auto; }
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
      .col-desc, .model-table thead th:nth-child(3) { display: none; }
      .model-table { font-size: .8rem; }
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
      <button type="button" class="btn" id="expand-all">Abrir tudo</button>
      <button type="button" class="btn" id="collapse-all">Fechar tudo</button>
    </div>

    <section class="catalogo" id="catalogo">
      ${linhasHtml}
    </section>

    <footer class="note">HTML autónomo — partilhe por WhatsApp, e-mail ou drive. Miniatura na tabela; clique abre galeria (mais fotos carregam do site Formigres, requer internet).</footer>
  </div>

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

  <script>
    const FORMIGRES_API = 'https://www.formigres.com.br';
    const TIPO_LABEL = { principal: 'Cerâmica', ambiente: 'Ambiente', piso: 'Piso', face: 'Face', outro: 'Imagem' };
    const galleryCache = new Map();

    function absUrl(rel) {
      if (!rel) return '';
      if (rel.startsWith('http')) return rel;
      return FORMIGRES_API + (rel.startsWith('/') ? rel : '/' + rel);
    }
    function isPlaceholder(url) {
      return !url || /placeholder/i.test(url);
    }
    function extractImagens(prod) {
      if (!prod) return [];
      const imgs = [];
      if (!isPlaceholder(prod.imagem_url)) imgs.push({ url: absUrl(prod.imagem_url), tipo: 'principal' });
      if (!isPlaceholder(prod.imagem_amb_url)) imgs.push({ url: absUrl(prod.imagem_amb_url), tipo: 'ambiente' });
      if (!isPlaceholder(prod.imagem_piso_url)) imgs.push({ url: absUrl(prod.imagem_piso_url), tipo: 'piso' });
      const faces = Array.isArray(prod.faces) ? prod.faces : [];
      faces.forEach((u, i) => {
        if (!isPlaceholder(u)) imgs.push({ url: absUrl(u), tipo: 'face' });
      });
      const seen = new Set();
      return imgs.filter((img) => {
        if (seen.has(img.url)) return false;
        seen.add(img.url);
        return true;
      });
    }
    async function fetchGaleria(formigresId, thumbUrl) {
      if (!formigresId) return thumbUrl ? [{ url: thumbUrl, tipo: 'principal' }] : [];
      if (galleryCache.has(formigresId)) return galleryCache.get(formigresId);
      const fallback = thumbUrl ? [{ url: thumbUrl, tipo: 'principal' }] : [];
      try {
        const res = await fetch(FORMIGRES_API + '/api/produto.php?id=' + encodeURIComponent(formigresId));
        if (!res.ok) { galleryCache.set(formigresId, fallback); return fallback; }
        const data = await res.json();
        const imgs = extractImagens(data.produto);
        const result = imgs.length ? imgs : fallback;
        galleryCache.set(formigresId, result);
        return result;
      } catch {
        galleryCache.set(formigresId, fallback);
        return fallback;
      }
    }

    const q = document.getElementById('search');
    const rows = [...document.querySelectorAll('.model-row')];
    const formatos = [...document.querySelectorAll('.acc-formato')];
    const tipos = [...document.querySelectorAll('.acc-tipo')];
    const linhas = [...document.querySelectorAll('.acc-linha')];
    const allDetails = [...document.querySelectorAll('details.acc')];

    function normalize(s) {
      return (s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
    }

    q.addEventListener('input', () => {
      const term = normalize(q.value.trim());
      for (const row of rows) {
        const text = normalize(row.textContent);
        const show = !term || text.includes(term);
        row.classList.toggle('hidden', !show);
      }
      for (const fmt of formatos) {
        const visible = fmt.querySelectorAll('.model-row:not(.hidden)').length > 0;
        fmt.classList.toggle('hidden', !visible);
      }
      for (const t of tipos) {
        const visible = t.querySelectorAll('.acc-formato:not(.hidden)').length > 0;
        t.classList.toggle('hidden', !visible);
      }
      for (const l of linhas) {
        const visible = l.querySelectorAll('.acc-tipo:not(.hidden)').length > 0;
        l.classList.toggle('hidden', !visible);
      }
    });

    document.getElementById('expand-all').addEventListener('click', () => {
      allDetails.forEach((d) => { d.open = true; });
    });
    document.getElementById('collapse-all').addEventListener('click', () => {
      allDetails.forEach((d) => { d.open = false; });
    });

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
      lbMeta.textContent = (galeriaAtual.length > 1 ? (galeriaIdx + 1) + ' / ' + galeriaAtual.length + ' · ' : '') + (TIPO_LABEL[img.tipo] || img.tipo);
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

    async function onThumbClick(btn) {
      const title = btn.dataset.title || 'Modelo';
      const thumb = btn.dataset.thumb || '';
      const fid = btn.dataset.formigresId || '';
      const inicial = thumb ? [{ url: thumb, tipo: 'principal' }] : [];
      openGaleria(inicial, title, Boolean(fid));
      if (!fid) return;
      const completa = await fetchGaleria(fid, thumb);
      if (!lb.classList.contains('open')) return;
      galeriaAtual = completa;
      renderGaleriaIdx(galeriaIdx);
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

  const itens = enrichItens(classif.itens || [], snapshot);
  const tree = buildTree(itens);
  const html = buildHtml({ classif, itens, tree });

  fs.mkdirSync(path.dirname(OUT_HTML), { recursive: true });
  fs.writeFileSync(OUT_HTML, html);

  console.log(JSON.stringify({
    ok: true,
    itens: itens.length,
    comFoto: itens.filter((i) => i.imagem_url).length,
    fonte: jsonPath,
    html: OUT_HTML,
  }, null, 2));
}

main();
