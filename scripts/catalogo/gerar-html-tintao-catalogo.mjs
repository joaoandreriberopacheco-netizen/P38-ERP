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

function renderModelCard(item) {
  const img = item.imagem_url || '';
  const titulo = item.formigres_titulo || item.descricao;
  const hasImg = Boolean(img);
  const imgBlock = hasImg
    ? `<button type="button" class="thumb-btn" data-lightbox="${esc(img)}" data-title="${esc(titulo)}" aria-label="Ampliar ${esc(titulo)}">
         <img src="${esc(img)}" alt="${esc(titulo)}" loading="lazy" />
       </button>`
    : `<div class="thumb-placeholder" aria-hidden="true"><span>sem foto</span></div>`;

  const badge = item.match_status !== 'encontrado'
    ? '<span class="badge warn">sem match</span>'
    : '';

  return `<article class="model-card">
    ${imgBlock}
    <div class="model-body">
      <h4 class="model-title">${esc(titulo)}</h4>
      <p class="model-desc">${esc(item.descricao)}</p>
      <dl class="model-meta">
        <div><dt>Acab.</dt><dd>${esc(item.formigres_acabamento || '—')}</dd></div>
        <div><dt>Preço/m²</dt><dd>${esc(fmtMoney(item.preco_m2))}</dd></div>
        <div><dt>Cód. Tintão</dt><dd>${esc(item.codigo_tintao)}</dd></div>
      </dl>
      ${badge}
    </div>
  </article>`;
}

function renderFormatoBlock(formato, items) {
  const count = items.length;
  return `<details class="acc acc-formato">
    <summary>
      <span class="acc-title">Formato ${esc(formato)}</span>
      <span class="acc-count">${count} modelo${count === 1 ? '' : 's'}</span>
    </summary>
    <div class="models-grid">${items.map(renderModelCard).join('')}</div>
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

function enrichItens(itens, snapshot) {
  const byId = new Map((snapshot?.produtos || []).map((p) => [String(p.id), p]));
  return itens.map((item) => {
    const prod = byId.get(String(item.formigres_id));
    return {
      ...item,
      imagem_url: prod?.imagem_url || '',
      imagem_amb_url: prod?.imagem_amb_url || '',
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
    .models-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 10px;
      padding: 8px;
    }
    .model-card {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      min-height: 100%;
    }
    .thumb-btn {
      display: block;
      width: 100%;
      aspect-ratio: 1;
      padding: 0;
      border: 0;
      background: #151418;
      cursor: zoom-in;
      overflow: hidden;
    }
    .thumb-btn img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform .2s ease;
    }
    .thumb-btn:hover img { transform: scale(1.04); }
    .thumb-placeholder {
      aspect-ratio: 1;
      display: grid;
      place-items: center;
      background: #151418;
      color: var(--muted);
      font-size: .78rem;
      text-transform: uppercase;
      letter-spacing: .06em;
    }
    .model-body { padding: 10px 12px 12px; display: grid; gap: 6px; flex: 1; }
    .model-title { margin: 0; font-size: .92rem; line-height: 1.25; }
    .model-desc { margin: 0; font-size: .76rem; color: var(--muted); }
    .model-meta {
      margin: 0;
      display: grid;
      gap: 4px;
      font-size: .74rem;
    }
    .model-meta div { display: flex; justify-content: space-between; gap: 8px; }
    .model-meta dt { color: var(--muted); }
    .model-meta dd { margin: 0; text-align: right; }
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
      display: flex; justify-content: space-between; align-items: center;
      gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--border);
    }
    .lightbox-head h3 { margin: 0; font-size: .95rem; }
    .lightbox-close {
      background: transparent; border: 1px solid var(--border); color: var(--text);
      border-radius: 8px; width: 34px; height: 34px; cursor: pointer; font-size: 1.1rem;
    }
    .lightbox-body { background: #111; display: grid; place-items: center; }
    .lightbox-body img { max-width: 100%; max-height: 72vh; object-fit: contain; display: block; }
    footer.note {
      margin-top: 20px; color: var(--muted); font-size: .78rem; text-align: center;
    }
    @media (max-width: 560px) {
      .models-grid { grid-template-columns: 1fr 1fr; }
      .model-title { font-size: .85rem; }
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

    <footer class="note">Ficheiro HTML autónomo — partilhe por WhatsApp, e-mail ou drive. Fotos carregam do site Formigres (requer internet).</footer>
  </div>

  <div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="Imagem ampliada">
    <div class="lightbox-panel">
      <div class="lightbox-head">
        <h3 id="lightbox-title">Modelo</h3>
        <button type="button" class="lightbox-close" id="lightbox-close" aria-label="Fechar">×</button>
      </div>
      <div class="lightbox-body">
        <img id="lightbox-img" src="" alt="" />
      </div>
    </div>
  </div>

  <script>
    const q = document.getElementById('search');
    const cards = [...document.querySelectorAll('.model-card')];
    const formatos = [...document.querySelectorAll('.acc-formato')];
    const tipos = [...document.querySelectorAll('.acc-tipo')];
    const linhas = [...document.querySelectorAll('.acc-linha')];
    const allDetails = [...document.querySelectorAll('details.acc')];

    function normalize(s) {
      return (s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
    }

    q.addEventListener('input', () => {
      const term = normalize(q.value.trim());
      for (const card of cards) {
        const text = normalize(card.textContent);
        const show = !term || text.includes(term);
        card.classList.toggle('hidden', !show);
      }
      for (const fmt of formatos) {
        const visible = fmt.querySelectorAll('.model-card:not(.hidden)').length > 0;
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
    function openLightbox(url, title) {
      lbImg.src = url;
      lbImg.alt = title || '';
      lbTitle.textContent = title || 'Modelo';
      lb.classList.add('open');
    }
    function closeLightbox() {
      lb.classList.remove('open');
      lbImg.src = '';
    }
    document.getElementById('catalogo').addEventListener('click', (e) => {
      const btn = e.target.closest('.thumb-btn');
      if (!btn) return;
      openLightbox(btn.dataset.lightbox, btn.dataset.title);
    });
    document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
    lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeLightbox();
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
