#!/usr/bin/env node
/**
 * Gera HTML partilhável — pedido Formigres para lojistas (B2B).
 * Persona: lojista que compara modelos, marca caixas e revisa total — não consumidor final.
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
const ANT_LOGO_PATH = path.join(ROOT, 'scripts', 'catalogo', 'assets', 'formigres-ant.png');
// Silhueta vermelha Formigres (recorte do logo vertical da marca); fundo transparente.

function loadAntLogoDataUri() {
  try {
    const buf = fs.readFileSync(ANT_LOGO_PATH);
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
}

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
  const [intPart, decPart] = n.toFixed(2).split('.');
  return `R$ ${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decPart}`;
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

function buildHtml({ classif, itens, antLogoDataUri = '' }) {
  const gerado = new Date(classif.geradoEm || Date.now()).toLocaleString('pt-BR');
  const total = itens.length;
  const comFoto = itens.filter((i) => i.imagem_url).length;
  const loadSquaresHtml = Array.from({ length: 20 }, () => '<span class="load-square"></span>').join('');
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
<html lang="pt-BR" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pedido Formigres — Lojistas</title>
  <script>
    (function(){try{var t=localStorage.getItem('tintao-theme-v1');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');}catch(e){}})();
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #121214;
      --bg-elevated: #18181c;
      --surface: #1c1c20;
      --surface-2: #242428;
      --surface-3: #2c2c32;
      --border: #3a3a42;
      --border-subtle: rgba(255,255,255,.06);
      --text: #b4b4bc;
      --text-strong: #ececf0;
      --muted: #787884;
      --accent: #e4e4ea;
      --accent-bright: #f4f4f8;
      --accent-dim: #c8c8d0;
      --accent-deep: #a8a8b2;
      --accent-hover: #ffffff;
      --accent-on: #121214;
      --accent-muted: rgba(228,228,234,.06);
      --accent-soft: rgba(228,228,234,.11);
      --accent-glow: rgba(228,228,234,.14);
      --accent-ring: rgba(228,228,234,.12);
      --accent-border: rgba(228,228,234,.28);
      --warn: #c9956a;
      --radius: 0;
      --shadow: 0 16px 40px rgba(0,0,0,.45);
      --shadow-soft: 0 4px 16px rgba(0,0,0,.28);
      --load-charcoal: #3a3a42;
      --load-charcoal-deep: #2c2c32;
      --load-charcoal-ghost: #6e6e78;
      font-family: "Libre Franklin", "Segoe UI", system-ui, -apple-system, sans-serif;
    }
    html[data-theme="light"] {
      --bg: #f2f2f0;
      --bg-elevated: #ffffff;
      --surface: #ffffff;
      --surface-2: #fafafa;
      --surface-3: #f5f5f3;
      --border: #d5d5d5;
      --border-subtle: rgba(0,0,0,.06);
      --text: #5a5a5a;
      --text-strong: #2f2f2f;
      --muted: #767676;
      --accent: #3a3a42;
      --accent-bright: #1f1f24;
      --accent-dim: #787884;
      --accent-deep: #5a5a62;
      --accent-hover: #000000;
      --accent-on: #ffffff;
      --accent-muted: rgba(0,0,0,.04);
      --accent-soft: rgba(0,0,0,.07);
      --accent-glow: rgba(0,0,0,.08);
      --accent-ring: rgba(0,0,0,.06);
      --accent-border: rgba(0,0,0,.14);
      --shadow: 0 16px 40px rgba(0,0,0,.1);
      --shadow-soft: 0 2px 12px rgba(0,0,0,.06);
      --load-charcoal: #2f2f36;
      --load-charcoal-deep: #222228;
      --load-charcoal-ghost: #9a9aa4;
    }
    html[data-theme="light"] .load-overlay { background: rgba(242,242,240,.97); }
    .load-logo-ant {
      position: relative;
      width: min(200px, 58vw);
      margin: 0 auto;
      aspect-ratio: 306 / 184;
    }
    .load-pct {
      position: absolute;
      left: 50%;
      top: 54%;
      transform: translate(-50%, -50%);
      font-size: .92rem;
      font-weight: 700;
      letter-spacing: .02em;
      color: var(--text-strong);
      text-shadow: 0 0 10px var(--bg), 0 0 4px var(--bg);
      font-variant-numeric: tabular-nums;
      pointer-events: none;
    }
    .load-logo-ant img {
      display: block;
      width: 100%;
      height: auto;
    }
    .load-ant-ghost {
      opacity: .32;
      filter: grayscale(1) brightness(1.35) contrast(.95);
    }
    .load-ant-fill-wrap {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      overflow: hidden;
      height: 0;
      transition: height .28s ease;
    }
    .load-ant-fill-wrap img {
      position: absolute;
      left: 0;
      bottom: 0;
      width: 100%;
      height: auto;
      filter: grayscale(1) brightness(0.46) contrast(1.14);
    }
    .load-squares {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 5px;
      max-width: 240px;
      margin: 16px auto 0;
    }
    .load-square {
      width: 10px;
      height: 10px;
      border: 1px solid var(--border);
      background: var(--surface-3);
      opacity: .45;
      transition: background .2s ease, border-color .2s ease, opacity .2s ease;
    }
    .load-square.filled {
      background: var(--load-charcoal);
      border-color: var(--load-charcoal-deep);
      opacity: 1;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      line-height: 1.55;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    body.is-loading { overflow: hidden; }
    body.is-loading .app-shell {
      visibility: hidden;
      pointer-events: none;
      position: absolute;
      width: 0;
      height: 0;
      overflow: hidden;
    }
    .load-overlay {
      position: fixed;
      inset: 0;
      z-index: 200;
      background: rgba(18,18,20,.96);
      display: grid;
      place-items: center;
      transition: opacity .45s ease, visibility .45s ease;
    }
    body:not(.is-loading) .load-overlay {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .load-panel { text-align: center; padding: 24px; max-width: 300px; }
    .load-sr {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    .theme-fab {
      position: fixed;
      left: 14px;
      bottom: calc(14px + env(safe-area-inset-bottom));
      z-index: 40;
      width: 48px;
      height: 48px;
      border-radius: var(--radius);
      background: var(--surface-2);
      border: 1px solid var(--border);
      color: var(--accent-bright);
      box-shadow: var(--shadow);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: transform .2s ease, box-shadow .2s ease, background .2s ease, color .2s ease;
    }
    .theme-fab:hover {
      transform: scale(1.04);
      border-color: var(--accent-border);
      background: var(--accent-muted);
    }
    .theme-fab svg { width: 22px; height: 22px; stroke-width: 2; }
    .theme-fab svg[hidden] { display: none; }
    .site-bar {
      background: var(--surface-2);
      border-bottom: 1px solid var(--border);
      border-left: 3px solid var(--accent-dim);
    }
    .site-bar-inner {
      max-width: 1480px;
      margin: 0 auto;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .site-bar-spacer { flex: 1 1 12px; min-width: 8px; }
    .site-desconto {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: .78rem;
      color: var(--muted);
    }
    .site-desconto label {
      letter-spacing: .06em;
      text-transform: uppercase;
      font-weight: 600;
      white-space: nowrap;
    }
    .desconto-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .desconto-row .pct-suffix { color: var(--muted); font-size: .85rem; }
    #desconto-pct {
      width: 64px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      color: var(--text-strong);
      padding: 7px 6px;
      font-size: .88rem;
      text-align: center;
    }
    #desconto-pct:focus {
      border-color: var(--accent-dim);
      outline: none;
      box-shadow: 0 0 0 3px var(--accent-ring);
    }
    .site-stat {
      font-size: .78rem;
      color: var(--muted);
      white-space: nowrap;
    }
    .site-stat strong { color: var(--accent); font-weight: 600; }
    .site-brand {
      font-size: .92rem;
      font-weight: 600;
      letter-spacing: .12em;
      text-transform: uppercase;
      color: var(--text-strong);
    }
    .site-divider {
      width: 1px;
      height: 16px;
      background: var(--border);
    }
    .site-sub {
      font-size: .72rem;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .wrap { max-width: 1480px; margin: 0 auto; padding: 16px 16px 32px; }
    .page-head {
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--border);
    }
    .page-head h1 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 600;
      letter-spacing: .06em;
      text-transform: uppercase;
      color: var(--text-strong);
    }
    .page-head p {
      margin: 4px 0 0;
      color: var(--muted);
      font-size: .82rem;
    }
    .stat {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 6px 13px;
      font-size: .82rem;
      color: var(--muted);
    }
    .stat strong { color: var(--accent); font-weight: 600; }
    .toolbar {
      display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap;
    }
    .toolbar-main { display: flex; gap: 10px; flex: 1 1 100%; }
    .toolbar-extra {
      display: flex; gap: 8px; flex-wrap: wrap; width: 100%;
    }
    .toolbar-extra[hidden] { display: none !important; }
    .btn-icon { min-width: 44px; padding: 10px; font-size: 1.1rem; line-height: 1; }
    .search {
      flex: 1 1 220px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      color: var(--text-strong);
      padding: 11px 14px;
      font-size: .95rem;
      outline: none;
      transition: border-color .25s ease, box-shadow .25s ease;
    }
    .search:focus { border-color: var(--accent-bright); box-shadow: 0 0 0 3px var(--accent-ring); }
    .btn {
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text);
      border-radius: var(--radius);
      padding: 10px 14px;
      cursor: pointer;
      font-size: .85rem;
      letter-spacing: .02em;
      transition: border-color .25s ease, color .25s ease, background .25s ease;
    }
    .btn:hover { border-color: var(--accent-bright); color: var(--accent); background: var(--accent-muted); }
    .select-group {
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text);
      border-radius: var(--radius);
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
      box-shadow: var(--shadow-soft);
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
      transition: background .15s ease;
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
    details.acc[open] > summary::before { transform: rotate(90deg); color: var(--accent); }
    details.acc > summary:hover { background: var(--accent-muted); }
    .acc-title { font-weight: 600; font-size: .95rem; letter-spacing: .04em; text-transform: uppercase; color: var(--text-strong); }
    .acc-count {
      font-size: .74rem;
      color: var(--muted);
      background: var(--surface-3);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 4px 10px;
      white-space: nowrap;
    }
    .acc-inner { padding: 0 10px 12px calc(10px + var(--depth, 0) * 18px); display: grid; gap: 8px; }
    .acc-linha { --depth: 0; }
    .acc-grupo { --depth: 1; background: var(--surface-2); }
    .acc-formato { --depth: 2; background: var(--surface-3); }
    .linha-bold { color: var(--text-strong); }
    .linha-retificada { color: var(--accent-bright); letter-spacing: .06em; text-transform: uppercase; }
    .linha-polida { color: var(--accent); }
    .table-wrap {
      padding: 0 8px 10px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .model-table {
      width: 100%;
      border-collapse: collapse;
      font-size: .84rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }
    .model-table thead th {
      text-align: left;
      padding: 10px 12px;
      background: var(--surface-2);
      color: var(--muted);
      font-size: .68rem;
      text-transform: uppercase;
      letter-spacing: .1em;
      border-bottom: 1px solid var(--accent-border);
      white-space: nowrap;
    }
    .model-table tbody tr {
      border-bottom: 1px solid var(--border);
    }
    .model-table tbody tr:last-child { border-bottom: 0; }
    .model-table tbody tr:hover { background: var(--accent-muted); }
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
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      color: var(--text-strong);
      padding: 6px 4px;
      font-size: .85rem;
      text-align: center;
    }
    .qty-input:focus {
      border-color: var(--accent-bright);
      outline: none;
      box-shadow: 0 0 0 3px var(--accent-ring);
    }
    @media (max-width: 720px) {
      .qty-input { width: 52px; min-height: 40px; font-size: .95rem; }
    }
    .model-meta-mobile { display: none; }
    .model-row { cursor: pointer; transition: background .2s ease; }
    .model-row.qty-focus-row {
      background: var(--accent-soft);
      box-shadow: inset 3px 0 0 var(--accent);
    }
    .model-row.qty-focus-row .qty-input {
      border-color: var(--accent);
      background: var(--surface-2);
    }
    .model-row.has-qty {
      background: var(--accent-muted);
    }
    body.has-selection .model-row:not(.has-qty) {
      opacity: .78;
    }
    body.has-selection .model-row:not(.has-qty):hover {
      opacity: .95;
    }
    .fab-stack {
      position: fixed;
      right: 14px;
      bottom: calc(14px + env(safe-area-inset-bottom));
      z-index: 40;
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: center;
    }
    .fab {
      width: 48px;
      height: 48px;
      border-radius: var(--radius);
      background: var(--surface-2);
      border: 1px solid var(--border);
      color: var(--accent-bright);
      box-shadow: var(--shadow);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: transform .2s ease, box-shadow .2s ease, background .2s ease, color .2s ease, opacity .2s ease;
    }
    .fab:hover {
      transform: scale(1.04);
      border-color: var(--accent-border);
      background: var(--accent-muted);
    }
    .fab svg { width: 22px; height: 22px; stroke-width: 2; }
    .cart-fab {
      border-color: var(--accent-border);
      color: var(--accent-bright);
      position: relative;
    }
    .cart-fab:hover {
      background: var(--accent-dim);
      color: var(--accent-on);
      box-shadow: 0 8px 24px var(--accent-glow);
    }
    .cart-fab svg { width: 24px; height: 24px; stroke-width: 2.2; }
    .cart-fab-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 22px;
      height: 22px;
      padding: 0 6px;
      border-radius: var(--radius);
      background: var(--accent-bright);
      color: var(--accent-on);
      font-size: .72rem;
      font-weight: 700;
      display: grid;
      place-items: center;
      border: 2px solid var(--surface);
      box-shadow: var(--shadow-soft);
    }
    .cart-fab-badge:empty,
    .cart-fab-badge[data-count="0"] { display: none; }
    .pedido-overlay {
      position: fixed;
      inset: 0;
      z-index: 45;
      background: rgba(8,7,10,.78);
      display: none;
      align-items: flex-end;
      justify-content: center;
      padding: 0;
    }
    .pedido-overlay.open { display: flex; }
    .pedido-panel {
      display: none;
      background: var(--surface);
      border: 1px solid var(--border);
      border-top: 1px solid var(--accent-border);
      border-radius: var(--radius) var(--radius) 0 0;
      padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
      width: 100%;
      max-width: 1480px;
      max-height: 88vh;
      overflow-y: auto;
      box-shadow: var(--shadow);
    }
    .pedido-overlay.open .pedido-panel { display: block; }
    .pedido-panel::before {
      content: "";
      display: block;
      width: 40px; height: 4px;
      background: var(--border);
      border-radius: var(--radius);
      margin: 0 auto 12px;
    }
    .pedido-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }
    .pedido-head h2 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 600;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--text-strong);
    }
    .pedido-close {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text);
      border-radius: var(--radius);
      width: 36px; height: 36px;
      cursor: pointer;
      font-size: 1.2rem;
      flex-shrink: 0;
      transition: border-color .25s ease, color .25s ease;
    }
    .pedido-close:hover { border-color: var(--accent-bright); color: var(--accent); }
    .pedido-actions {
      display: flex;
      gap: 10px;
      margin-top: 14px;
      flex-wrap: wrap;
    }
    .pedido-actions .btn { flex: 1; min-width: 120px; border-radius: var(--radius); padding: 12px; }
    .pedido-empty {
      text-align: center;
      color: var(--muted);
      padding: 28px 12px;
      font-size: .9rem;
    }
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
    .pedido-cards-wrap { display: none; }
    .pedido-cards { display: flex; flex-direction: column; }
    .pedido-card {
      padding: 14px 0;
      border-bottom: 1px solid var(--border-subtle);
    }
    .pedido-card:last-child { border-bottom: 0; }
    .pedido-card-head {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }
    .pedido-card-thumb {
      width: 52px;
      height: 52px;
      border-radius: 8px;
      object-fit: cover;
      flex-shrink: 0;
      background: var(--surface-2);
    }
    .pedido-card-thumb-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--muted);
      font-size: .78rem;
    }
    .pedido-card-intro { flex: 1; min-width: 0; }
    .pedido-card-title {
      font-size: .88rem;
      font-weight: 600;
      line-height: 1.25;
      color: var(--text-strong);
    }
    .pedido-card-meta {
      margin-top: 3px;
      font-size: .72rem;
      color: var(--muted);
      line-height: 1.3;
    }
    .pedido-card-aside {
      text-align: right;
      flex-shrink: 0;
      min-width: 72px;
      max-width: 42%;
    }
    .pedido-card-subtotal-label,
    .pedido-card-unit-label {
      display: block;
      font-size: .6rem;
      text-transform: uppercase;
      letter-spacing: .05em;
      color: var(--muted);
      margin-bottom: 2px;
    }
    .pedido-card-subtotal strong {
      display: block;
      font-size: .92rem;
      font-weight: 600;
      color: var(--accent-bright);
      white-space: nowrap;
      line-height: 1.2;
    }
    .pedido-card-unit {
      margin-top: 8px;
    }
    .pedido-card-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px 10px;
      margin-top: 10px;
    }
    .pedido-card-kv-label {
      display: block;
      font-size: .62rem;
      text-transform: uppercase;
      letter-spacing: .04em;
      color: var(--muted);
      margin-bottom: 2px;
    }
    .pedido-card-kv-val {
      font-size: .84rem;
      font-weight: 500;
      color: var(--text-strong);
      font-variant-numeric: tabular-nums;
    }
    .pedido-card-price-val {
      display: block;
      line-height: 1.15;
    }
    .pedido-card-price-val .preco-orig {
      font-size: .62rem;
      line-height: 1.1;
    }
    .pedido-card-price-val .preco-desc {
      font-size: .78rem;
      font-weight: 600;
    }
    .pedido-card-price-val:not(.has-desc) {
      font-size: .78rem;
      font-weight: 600;
      color: var(--text-strong);
    }
    .pedido-total {
      margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--accent-border);
      display: flex; justify-content: flex-end; gap: 24px; font-size: 1rem;
    }
    .pedido-total strong { color: var(--accent-bright); font-size: 1.15rem; font-weight: 600; }
    .btn-primary {
      background: var(--accent-dim);
      border-color: var(--accent-border);
      color: var(--accent-on);
      font-weight: 600;
      letter-spacing: .03em;
      text-transform: uppercase;
    }
    .btn-primary:hover {
      background: var(--accent-bright);
      color: var(--accent-on);
      border-color: var(--accent-bright);
    }
    .btn.active { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
    #pedido-print { display: none; }
    @media print {
      body > :not(#pedido-print) { display: none !important; }
      #pedido-print {
        display: block !important;
        width: 100%;
        padding: 0;
      }
    }
    .thumb-btn {
      display: block;
      width: 48px;
      height: 48px;
      padding: 0;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface-2);
      cursor: zoom-in;
      overflow: hidden;
      transition: border-color .25s ease, box-shadow .25s ease;
    }
    .thumb-btn img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .thumb-btn:hover { border-color: var(--accent-dim); box-shadow: 0 0 0 2px var(--accent-ring); }
    .thumb-btn.has-gallery { position: relative; }
    .thumb-more {
      position: absolute; right: 2px; bottom: 2px;
      font-size: 10px; line-height: 1;
      background: rgba(0,0,0,.65); color: var(--accent);
      border-radius: var(--radius); padding: 2px 3px;
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
      border-radius: var(--radius);
      padding: 3px 8px;
      width: fit-content;
    }
    .badge.warn { background: rgba(201,149,106,.12); color: var(--warn); border: 1px solid rgba(201,149,106,.3); }
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
      border-top: 1px solid var(--accent-border);
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
      border-radius: var(--radius); width: 34px; height: 34px; cursor: pointer; font-size: 1.1rem;
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
      color: var(--text); border-radius: var(--radius); width: 40px; height: 40px;
      cursor: pointer; font-size: 1.2rem; display: none;
    }
    .gallery-nav:hover { background: var(--accent-soft); border-color: var(--accent-dim); color: var(--accent-bright); }
    .gallery-nav.prev { left: 8px; }
    .gallery-nav.next { right: 8px; }
    .lightbox.has-multi .gallery-nav { display: block; }
    .lightbox-dots {
      display: flex; gap: 6px; justify-content: center; flex-wrap: wrap;
      padding: 10px; border-top: 1px solid var(--border); background: var(--surface-2);
    }
    .lightbox-dot {
      width: 8px; height: 8px; border-radius: var(--radius); border: 0;
      background: var(--border); cursor: pointer; padding: 0;
    }
    .lightbox-dot.active { background: var(--accent-bright); }
    .lightbox-dot[hidden] { display: none; }
    .preco-orig {
      display: block;
      text-decoration: line-through;
      color: var(--muted);
      font-size: .74rem;
      line-height: 1.2;
    }
    .preco-desc { color: var(--text-strong); font-weight: 600; }
    .col-preco.has-desc .preco-desc { white-space: nowrap; }
    .pedido-desconto-note {
      font-size: .78rem;
      color: var(--muted);
      margin-top: 6px;
      text-align: right;
    }
    .cart-fab.has-items {
      animation: cart-pulse 2.4s ease-in-out infinite;
    }
    @keyframes cart-pulse {
      0%, 100% { box-shadow: var(--shadow); }
      50% { box-shadow: 0 10px 28px var(--accent-glow); }
    }
    @media (max-width: 720px) {
      .wrap { padding: 10px 10px 20px; }
      .page-head { margin-bottom: 8px; padding-bottom: 8px; }
      .page-head h1 { font-size: 1rem; }
      .page-head-hint { display: none; }
      .site-bar-inner { padding: 8px 10px; gap: 8px; }
      .site-divider, .site-sub { display: none; }
      .site-desconto label { display: none; }
      #desconto-pct { width: 56px; padding: 6px 4px; }
      .site-stat { font-size: .72rem; }
      .toolbar { gap: 6px; margin-bottom: 8px; }
      .toolbar-desktop-only { display: none !important; }
      .search { flex: 1; min-width: 0; }
      .select-group, .btn { font-size: .78rem; padding: 8px 10px; }
      .fab-stack { right: 10px; bottom: calc(10px + env(safe-area-inset-bottom)); }
      .theme-fab { left: 10px; bottom: calc(10px + env(safe-area-inset-bottom)); width: 44px; height: 44px; }
      .theme-fab svg { width: 20px; height: 20px; }
      .pedido-overlay.open { align-items: flex-end; padding: 0; }
      .pedido-overlay.open .pedido-panel {
        border-radius: var(--radius) var(--radius) 0 0;
        max-height: 92vh;
        padding: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .pedido-overlay.open .pedido-panel::before { display: block; margin-top: 8px; }
      .pedido-head {
        padding: 4px 14px 0;
        margin-bottom: 0;
        flex-shrink: 0;
      }
      .pedido-head p { font-size: .72rem !important; }
      .pedido-scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 8px 14px 0;
        -webkit-overflow-scrolling: touch;
      }
      .pedido-resumo {
        gap: 6px;
        margin-bottom: 10px;
      }
      .pedido-resumo .stat {
        flex: 1;
        min-width: 0;
        text-align: center;
        padding: 8px 6px;
        font-size: .72rem;
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius);
        background: var(--surface-2);
      }
      .pedido-resumo .stat strong { font-size: .92rem; display: block; margin-bottom: 2px; }
      .pedido-table-wrap { display: none !important; }
      .pedido-cards-wrap { display: block; }
      .pedido-card-thumb { width: 48px; height: 48px; }
      .pedido-total {
        margin-top: 10px;
        padding: 10px 0 12px;
        border-top: 1px solid var(--border-subtle);
        flex-direction: column;
        align-items: stretch;
        gap: 4px;
        font-size: .92rem;
      }
      .pedido-total strong { font-size: 1.08rem; }
      .pedido-desconto-note { text-align: left; margin-top: 4px; }
      .pedido-actions {
        flex-shrink: 0;
        margin-top: 0;
        padding: 10px 14px calc(10px + env(safe-area-inset-bottom));
        border-top: 1px solid var(--border-subtle);
        background: var(--surface);
        gap: 8px;
      }
      .pedido-actions .btn {
        min-width: 0;
        padding: 11px 10px;
        font-size: .78rem;
      }
      details.acc > summary {
        padding: 10px 10px 10px calc(8px + var(--depth, 0) * 10px);
        gap: 6px;
      }
      .acc-inner { padding-left: calc(6px + var(--depth, 0) * 10px); }
      .acc-title { font-size: .88rem; }
      .acc-count { font-size: .7rem; padding: 2px 7px; }
      .model-meta-mobile {
        display: block;
        margin-top: 4px;
        font-size: .74rem;
        color: var(--muted);
        line-height: 1.3;
      }
      .col-desc, .col-acab, .col-preco, .col-cod,
      .model-table thead th:nth-child(3),
      .model-table thead th:nth-child(4),
      .model-table thead th:nth-child(5),
      .model-table thead th:nth-child(7) { display: none; }
      .model-table { font-size: .78rem; }
      .model-table td, .model-table th { padding: 8px 6px; }
      .col-foto { width: 44px; }
      .col-modelo { min-width: 0; max-width: 1px; }
      .col-modelo strong { font-size: .82rem; line-height: 1.25; }
      .col-modelo small { font-size: .7rem; }
      .thumb-btn, .thumb-empty { width: 40px; height: 40px; }
      .col-qty, .model-table thead th:nth-child(6) {
        position: sticky;
        right: 0;
        background: var(--surface);
        z-index: 1;
        width: 58px;
        min-width: 58px;
        padding-left: 4px;
        padding-right: 4px;
        box-shadow: -4px 0 6px rgba(0,0,0,.05);
      }
      .model-table thead th:nth-child(6) { background: var(--surface-2); z-index: 2; }
      .col-qty .qty-input {
        width: 48px;
        min-height: 40px;
        font-size: .92rem;
        padding: 6px 2px;
      }
      .lightbox { padding: 10px; }
      .gallery-nav { width: 36px; height: 36px; }
    }
    @media (min-width: 721px) {
      .toolbar-mobile-only { display: none !important; }
    }
    @media (max-width: 480px) {
      .stats { gap: 6px; }
      .stat { font-size: .75rem; padding: 5px 10px; }
      .model-table td, .model-table th { padding: 7px 5px; }
      .col-qty, .model-table thead th:nth-child(6) { width: 54px; min-width: 54px; }
      .col-qty .qty-input { width: 44px; min-height: 38px; }
      .lightbox-head h3 { font-size: .88rem; }
      .lightbox-stage { min-height: 220px; }
      .lightbox-stage img { max-height: 58vh; }
    }
  </style>
</head>
<body class="is-loading">
  <div class="load-overlay" id="load-overlay" role="status" aria-live="polite" aria-busy="true">
    <div class="load-panel">
      <div class="load-logo-ant" aria-hidden="true">
        <img class="load-ant-ghost" src="${antLogoDataUri || ''}" alt="" width="200" height="120" />
        <div class="load-ant-fill-wrap" id="load-ant-fill-wrap">
          <img src="${antLogoDataUri || ''}" alt="" width="200" height="120" />
        </div>
        <span class="load-pct" id="load-pct" aria-hidden="true">0%</span>
      </div>
      <div class="load-squares" id="load-squares" aria-hidden="true">${loadSquaresHtml}</div>
      <p class="load-sr" id="load-msg">A carregar fotos do catálogo</p>
    </div>
  </div>

  <div id="app-shell" class="app-shell" aria-hidden="true">
  <header class="site-bar">
    <div class="site-bar-inner">
      <span class="site-brand">Formigres</span>
      <span class="site-divider" aria-hidden="true"></span>
      <span class="site-sub">Pedido B2B · Lojistas</span>
      <span class="site-bar-spacer" aria-hidden="true"></span>
      <div class="site-desconto">
        <label for="desconto-pct">Desconto</label>
        <div class="desconto-row">
          <input type="number" id="desconto-pct" min="0" max="100" step="0.1" inputmode="decimal" placeholder="0" aria-label="Desconto comercial em percentual" />
          <span class="pct-suffix">%</span>
        </div>
      </div>
      <span class="site-stat" id="stat-modelos"><strong id="stat-modelos-count">${total}</strong> <span id="stat-modelos-label">modelos</span></span>
    </div>
  </header>
  <div class="wrap">
    <div class="page-head">
      <h1>Pedido Formigres</h1>
      <p class="page-head-hint">Marque caixas na tabela · revise no carrinho</p>
    </div>

    <div class="toolbar">
      <div class="toolbar-main">
        <input id="search" class="search" type="search" placeholder="Código, modelo ou formato…" />
        <button type="button" class="btn btn-icon toolbar-mobile-only" id="toolbar-more" aria-label="Mais opções">⋯</button>
      </div>
      <div class="toolbar-extra toolbar-mobile-only" id="toolbar-extra" hidden>
        <select id="group-by" class="select-group" title="Agrupar">
          <option value="acabamento" selected>Por acabamento</option>
          <option value="tipo">Por tipo</option>
        </select>
        <button type="button" class="btn btn-primary" id="start-qty">Caixas</button>
        <button type="button" class="btn" id="filter-qty">Na seleção</button>
        <button type="button" class="btn" id="clear-qty">Limpar</button>
        <button type="button" class="btn" id="expand-all">Abrir</button>
        <button type="button" class="btn" id="collapse-all">Fechar</button>
      </div>
      <div class="toolbar-extra toolbar-desktop-only">
        <select id="group-by-desktop" class="select-group">
          <option value="acabamento" selected>Agrupar: acabamento</option>
          <option value="tipo">Agrupar: tipo</option>
        </select>
        <button type="button" class="btn" id="filter-qty-d">Só na seleção</button>
        <button type="button" class="btn" id="clear-qty-d">Limpar seleção</button>
        <button type="button" class="btn btn-primary" id="start-qty-d">Preencher caixas</button>
        <button type="button" class="btn" id="expand-all-d">Abrir tudo</button>
        <button type="button" class="btn" id="collapse-all-d">Fechar tudo</button>
      </div>
    </div>

    <section class="catalogo" id="catalogo"></section>
  </div>

  <button type="button" class="theme-fab" id="theme-toggle" aria-label="Mudar para tema escuro" title="Tema">
    <svg id="theme-icon-sun" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
    </svg>
    <svg id="theme-icon-moon" hidden xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
    </svg>
  </button>

  <div class="fab-stack" id="fab-stack">
    <button type="button" class="fab cart-fab" id="cart-fab" aria-label="Minha seleção">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
        <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
      </svg>
      <span class="cart-fab-badge" id="cart-fab-badge" data-count="0">0</span>
    </button>
  </div>

  <div class="pedido-overlay" id="pedido-overlay" role="dialog" aria-modal="true" aria-label="Minha seleção">
    <section class="pedido-panel" id="pedido-panel">
      <div class="pedido-head">
        <div>
          <h2>Minha seleção</h2>
          <p style="margin:4px 0 0;font-size:.78rem;color:var(--muted)">Revise caixas, m² e total antes de exportar</p>
        </div>
        <button type="button" class="pedido-close" id="pedido-close" aria-label="Fechar">×</button>
      </div>
      <div class="pedido-scroll" id="pedido-scroll">
      <div class="pedido-resumo" id="pedido-resumo"></div>
      <div class="pedido-empty hidden" id="pedido-empty">Nenhum modelo na seleção — marque caixas na tabela.</div>
      <div class="pedido-list-wrap hidden" id="pedido-list-wrap">
        <div class="table-wrap pedido-table-wrap" id="pedido-table-wrap">
          <table class="pedido-table" id="pedido-table">
            <thead>
              <tr>
                <th>Foto</th><th>Modelo</th><th>Formato</th><th>Caixas</th><th>m²/cx</th><th>m² total</th><th>Preço/m²</th><th>Subtotal</th>
              </tr>
            </thead>
            <tbody id="pedido-body"></tbody>
          </table>
        </div>
        <div class="pedido-cards-wrap" id="pedido-cards-wrap">
          <div class="pedido-cards" id="pedido-cards"></div>
        </div>
      </div>
      <div class="pedido-total" id="pedido-total"></div>
      </div>
      <div class="pedido-actions">
        <button type="button" class="btn" id="clear-qty-panel">Limpar seleção</button>
        <button type="button" class="btn btn-primary" id="pdf-pedido-panel" disabled>PDF do pedido</button>
      </div>
    </section>
  </div>

  <div id="pedido-print"></div>

  <iframe id="pedido-print-frame" title="Impressão do pedido" hidden></iframe>

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
  </div>

  <script id="catalogo-data" type="application/json">${catalogoJson}</script>
  <script>
    const CATALOGO = JSON.parse(document.getElementById('catalogo-data').textContent);
    const CFG = CATALOGO.config;
    const TIPO_LABEL_GAL = { principal: 'Cerâmica', ambiente: 'Ambiente', piso: 'Piso', face: 'Face', outro: 'Imagem' };
    const QTY_KEY = 'tintao-pedido-qty-v1';
    const THEME_KEY = 'tintao-theme-v1';
    const DESCONTO_KEY = 'tintao-desconto-v1';
    const itemsByCode = new Map(CATALOGO.itens.map((i) => [String(i.codigo_tintao), i]));
    const TOTAL_MODELOS = CATALOGO.itens.length;
    let qtyMap = {};
    try { qtyMap = JSON.parse(localStorage.getItem(QTY_KEY) || '{}'); } catch { qtyMap = {}; }
    let descontoPct = 0;
    try {
      const d = Number(localStorage.getItem(DESCONTO_KEY));
      if (Number.isFinite(d) && d >= 0 && d <= 100) descontoPct = d;
    } catch { descontoPct = 0; }
    let groupBy = 'acabamento';
    let filterQtyOnly = false;
    let pedidoOpen = false;
    let dom = {};

    function esc(s) {
      return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function fmtMoney(v) {
      if (v == null || v === '') return '—';
      const n = Number(v);
      if (Number.isNaN(n)) return String(v);
      const parts = n.toFixed(2).split('.');
      parts[0] = parts[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');
      return 'R$ ' + parts.join(',');
    }
    function fmtDecimal(v, digits) {
      if (v == null || v === '') return '—';
      const n = Number(v);
      if (Number.isNaN(n)) return String(v);
      const parts = n.toFixed(digits ?? 2).split('.');
      parts[0] = parts[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');
      return parts.join(',');
    }
    function precoEfetivo(preco) {
      const base = Number(preco);
      if (!Number.isFinite(base) || base <= 0) return null;
      if (!descontoPct) return base;
      return Math.round(base * (1 - descontoPct / 100) * 100) / 100;
    }
    function fmtPrecoHtml(preco) {
      const base = Number(preco);
      if (!Number.isFinite(base) || base <= 0) return '—';
      const eff = precoEfetivo(base);
      if (!descontoPct) return esc(fmtMoney(eff));
      return '<span class="preco-orig">' + esc(fmtMoney(base)) + '</span><strong class="preco-desc">' + esc(fmtMoney(eff)) + '</strong>';
    }
    function setDesconto(val) {
      const n = Math.max(0, Math.min(100, Number(val) || 0));
      descontoPct = Math.round(n * 10) / 10;
      localStorage.setItem(DESCONTO_KEY, String(descontoPct));
      const inp = document.getElementById('desconto-pct');
      if (inp && document.activeElement !== inp) inp.value = descontoPct ? String(descontoPct) : '';
      renderCatalogo();
      renderPedido();
    }
    function applyTheme(theme) {
      const next = theme === 'light' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem(THEME_KEY, next);
      const sun = document.getElementById('theme-icon-sun');
      const moon = document.getElementById('theme-icon-moon');
      const btn = document.getElementById('theme-toggle');
      if (sun) sun.hidden = next === 'light';
      if (moon) moon.hidden = next === 'dark';
      if (btn) btn.setAttribute('aria-label', next === 'light' ? 'Mudar para tema escuro' : 'Mudar para tema claro');
    }
    function toggleTheme() {
      const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      applyTheme(cur === 'light' ? 'dark' : 'light');
    }
    function initTopControls() {
      applyTheme(localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark');
      const inp = document.getElementById('desconto-pct');
      if (inp) {
        inp.value = descontoPct ? String(descontoPct) : '';
        inp.addEventListener('input', () => setDesconto(inp.value));
        inp.addEventListener('change', () => setDesconto(inp.value));
      }
      bindClick('theme-toggle', toggleTheme);
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
      document.querySelectorAll('.model-row[data-cod="' + cod + '"]').forEach((row) => {
        row.dataset.qty = String(n);
        row.classList.toggle('has-qty', n > 0);
      });
      document.querySelectorAll('.qty-input[data-cod="' + cod + '"]').forEach((input) => {
        if (document.activeElement !== input) input.value = n || '';
      });
      renderPedido();
      updateCartFab();
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
      });
      document.querySelectorAll('.model-row').forEach((row) => {
        row.dataset.qty = '0';
        row.classList.remove('has-qty');
      });
      renderPedido();
      updateCartFab();
      if (filterQtyOnly) applySearch(document.getElementById('search').value);
    }
    function visibleQtyInputs() {
      return [...document.querySelectorAll('.model-row:not(.hidden) .qty-input')];
    }
    function visibleRows() {
      return [...document.querySelectorAll('.model-row:not(.hidden)')];
    }
    function clearQtyFocusRows() {
      document.querySelectorAll('.model-row.qty-focus-row').forEach((r) => r.classList.remove('qty-focus-row'));
    }
    function focusQtyInput(input, { select = true } = {}) {
      if (!input) return;
      let el = input.parentElement;
      while (el) {
        if (el.tagName === 'DETAILS' && !el.open) el.open = true;
        el = el.parentElement;
      }
      clearQtyFocusRows();
      input.closest('.model-row')?.classList.add('qty-focus-row');
      input.focus({ preventScroll: true });
      if (select) input.select();
      input.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    function moveQtyFocus(input, delta) {
      const list = visibleQtyInputs();
      const idx = list.indexOf(input);
      if (idx < 0 || !list.length) return;
      let nextIdx = idx + delta;
      if (nextIdx < 0) nextIdx = list.length - 1;
      else if (nextIdx >= list.length) nextIdx = 0;
      focusQtyInput(list[nextIdx]);
    }
    function saveAndMoveQtyFocus(input, delta) {
      if (!input) return;
      setQty(input.dataset.cod, input.value);
      moveQtyFocus(input, delta);
    }
    function handleQtyKeyboardNav(e) {
      if (window.matchMedia('(max-width: 720px)').matches) return;
      const input = e.target.closest('.qty-input');
      if (!input) return;
      let delta = 0;
      if (e.key === 'Tab') {
        e.preventDefault();
        delta = e.shiftKey ? -1 : 1;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        delta = e.shiftKey ? -1 : 1;
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        delta = 1;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        delta = -1;
      } else {
        return;
      }
      saveAndMoveQtyFocus(input, delta);
    }
    function startQtyEntry() {
      dom.allDetails.forEach((d) => { d.open = true; });
      applySearch(document.getElementById('search').value);
      const rows = visibleRows();
      const empty = rows.find((r) => !getQty(r.dataset.cod));
      const target = empty || rows[0];
      if (!target) return;
      focusQtyInput(target.querySelector('.qty-input'));
    }
    function syncBodyScrollLock() {
      const locked = pedidoOpen
        || document.getElementById('lightbox')?.classList.contains('open');
      document.body.style.overflow = locked ? 'hidden' : '';
    }
    function parseM2Caixa(item) {
      if (item.m2_por_caixa) return Number(item.m2_por_caixa);
      const m = String(item.unidade || item.descricao || '').match(/CX\\s*([\\d,]+)\\s*M2/i) || String(item.descricao || '').match(/([\\d,]+)\\s*M2/i);
      return m ? Number(m[1].replace(',', '.')) : null;
    }
    function itemSubtotal(item, qty) {
      const m2cx = parseM2Caixa(item);
      const preco = precoEfetivo(item.preco_m2);
      if (!qty || !m2cx || !preco) return null;
      return qty * m2cx * preco;
    }
    function fmtAreaKey(fmt) {
      const m = String(fmt || '').match(/(\\d+)\\s*x\\s*(\\d+)/i);
      if (!m) return Number.MAX_SAFE_INTEGER;
      return Number(m[1]) * Number(m[2]);
    }
    function compareFormato(a, b) {
      const fa = fmtAreaKey(a);
      const fb = fmtAreaKey(b);
      if (fa !== fb) return fa - fb;
      return String(a || '').localeCompare(String(b || ''), 'pt-BR');
    }
    function itemTitulo(item) {
      return item.formigres_titulo || item.descricao || '';
    }
    function compareItensFormatoNome(a, b) {
      const byFmt = compareFormato(a.formato, b.formato);
      if (byFmt !== 0) return byFmt;
      return itemTitulo(a).localeCompare(itemTitulo(b), 'pt-BR');
    }
    function pedidoItens() {
      return CATALOGO.itens
        .map((item) => ({ item, qty: getQty(item.codigo_tintao) }))
        .filter((x) => x.qty > 0)
        .sort((a, b) => compareItensFormatoNome(a.item, b.item));
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
            tree[linha][grupo][formato].sort((a, b) => compareItensFormatoNome(a, b));
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
    function renderTableRow(item) {
      const imgs = getGaleria(item);
      const img = imgs[0]?.url || item.imagem_url || '';
      const titulo = item.formigres_titulo || item.descricao;
      const cod = item.codigo_tintao;
      const qty = getQty(cod);
      const foto = img
        ? '<button type="button" class="thumb-btn' + (imgs.length > 1 ? ' has-gallery' : '') + '" tabindex="-1" data-cod="' + esc(cod) + '" data-title="' + esc(titulo) + '" title="Ver fotos"><img src="' + esc(img) + '" alt="" loading="lazy" />' + (imgs.length > 1 ? '<span class="thumb-more" aria-hidden="true">▦</span>' : '') + '</button>'
        : '<span class="thumb-empty">—</span>';
      const warn = item.match_status !== 'encontrado' ? ' <span class="badge warn">sem match</span>' : '';
      const metaMobile = '<div class="model-meta-mobile">' + esc(item.formigres_acabamento || '—') + ' · ' + fmtPrecoHtml(item.preco_m2) + '</div>';
      return '<tr class="model-row' + (qty > 0 ? ' has-qty' : '') + '" data-cod="' + esc(cod) + '" data-search="' + esc((titulo + ' ' + item.descricao + ' ' + item.formigres_acabamento + ' ' + item.formato + ' ' + cod).toLowerCase()) + '" data-qty="' + qty + '">' +
        '<td class="col-foto">' + foto + '</td>' +
        '<td class="col-modelo"><strong>' + esc(titulo) + '</strong>' + warn + '<br><small style="color:var(--muted)">#' + esc(cod) + '</small>' + metaMobile + '</td>' +
        '<td class="col-desc">' + esc(item.descricao) + '</td>' +
        '<td class="col-acab">' + esc(item.formigres_acabamento || '—') + '</td>' +
        '<td class="col-preco' + (descontoPct ? ' has-desc' : '') + '">' + fmtPrecoHtml(item.preco_m2) + '</td>' +
        '<td class="col-qty">' +
        '<input type="number" class="qty-input" min="0" step="1" inputmode="numeric" enterkeyhint="next" autocomplete="off" tabindex="0" value="' + (qty || '') + '" data-cod="' + esc(cod) + '" aria-label="Caixas" placeholder="0" />' +
        '</td>' +
        '<td class="col-cod">' + esc(item.formato || '—') + '</td></tr>';
    }
    function renderFormato(formato, items) {
      const n = items.length;
      return '<details class="acc acc-formato" open><summary><span class="acc-title">Formato ' + esc(formato) + '</span><span class="acc-count" data-total="' + n + '">' + n + '</span></summary>' +
        '<div class="table-wrap"><table class="model-table"><thead><tr><th>Foto</th><th>Modelo</th><th>Descrição</th><th>Acab.</th><th>Preço/m²</th><th>Caixas</th><th>Formato</th></tr></thead><tbody>' +
        items.map(renderTableRow).join('') + '</tbody></table></div></details>';
    }
    function renderGrupo(key, formatosMap, linha) {
      const formatos = Object.keys(formatosMap).sort(compareFormato);
      const n = formatos.reduce((s, f) => s + formatosMap[f].length, 0);
      return '<details class="acc acc-grupo" open><summary><span class="acc-title">' + esc(grupoLabel(key, linha)) + '</span><span class="acc-count" data-total="' + n + '" data-suffix="itens">' + n + ' itens</span></summary>' +
        '<div class="acc-inner">' + formatos.map((f) => renderFormato(f, formatosMap[f])).join('') + '</div></details>';
    }
    function renderLinha(linha, gruposMap) {
      const keys = sortGrupos(Object.keys(gruposMap), linha);
      const n = keys.reduce((s, k) => s + Object.values(gruposMap[k]).reduce((a, arr) => a + arr.length, 0), 0);
      const label = CFG.linhaLabel[linha] || linha;
      return '<details class="acc acc-linha" open><summary><span class="acc-title linha-' + esc(linha) + '">' + esc(label) + '</span><span class="acc-count" data-total="' + n + '">' + n + '</span></summary>' +
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
      updateModelosCount();
      updateAccordionCounts();
    }
    function formatAccCount(visible, total, suffix) {
      if (visible === total) return suffix ? (visible + ' ' + suffix) : String(visible);
      return suffix ? (visible + ' de ' + total + ' ' + suffix) : (visible + ' de ' + total);
    }
    function updateAccordionCounts() {
      for (const acc of dom.allDetails) {
        const el = acc.querySelector(':scope > summary .acc-count[data-total]');
        if (!el) continue;
        const total = Number(el.dataset.total || 0);
        const suffix = el.dataset.suffix || '';
        const visible = acc.querySelectorAll('.model-row:not(.hidden)').length;
        el.textContent = formatAccCount(visible, total, suffix);
      }
    }
    function updateModelosCount() {
      const visible = dom.rows.length
        ? dom.rows.filter((r) => !r.classList.contains('hidden')).length
        : TOTAL_MODELOS;
      const countEl = document.getElementById('stat-modelos-count');
      const labelEl = document.getElementById('stat-modelos-label');
      if (countEl) countEl.textContent = String(visible);
      if (labelEl) {
        labelEl.textContent = visible === TOTAL_MODELOS
          ? 'modelos na lista'
          : ('de ' + TOTAL_MODELOS + ' modelos');
      }
    }

    function renderPedidoCard({ item, qty, img, titulo, m2cx, m2tot, sub }) {
      const thumb = img
        ? '<img class="pedido-card-thumb" src="' + esc(img) + '" alt="" loading="lazy" />'
        : '<span class="pedido-card-thumb pedido-card-thumb-empty" aria-hidden="true">—</span>';
      return '<article class="pedido-card">' +
        '<div class="pedido-card-head">' +
          thumb +
          '<div class="pedido-card-intro">' +
            '<div class="pedido-card-title">' + esc(titulo) + '</div>' +
            '<div class="pedido-card-meta">#' + esc(item.codigo_tintao) + ' · ' + esc(item.formato || '—') + '</div>' +
          '</div>' +
          '<div class="pedido-card-aside">' +
            '<div class="pedido-card-subtotal">' +
              '<span class="pedido-card-subtotal-label">Subtotal</span>' +
              '<strong>' + esc(sub != null ? fmtMoney(sub) : '—') + '</strong>' +
            '</div>' +
            '<div class="pedido-card-unit">' +
              '<span class="pedido-card-unit-label">Preço/m²</span>' +
              '<span class="pedido-card-price-val' + (descontoPct ? ' has-desc' : '') + '">' + fmtPrecoHtml(item.preco_m2) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="pedido-card-grid">' +
          '<div class="pedido-card-kv"><span class="pedido-card-kv-label">Caixas</span><span class="pedido-card-kv-val">' + qty + '</span></div>' +
          '<div class="pedido-card-kv"><span class="pedido-card-kv-label">m²/cx</span><span class="pedido-card-kv-val">' + esc(m2cx ? fmtDecimal(m2cx) : '—') + '</span></div>' +
          '<div class="pedido-card-kv"><span class="pedido-card-kv-label">m² total</span><span class="pedido-card-kv-val">' + esc(m2tot ? fmtDecimal(m2tot) : '—') + '</span></div>' +
        '</div>' +
      '</article>';
    }
    function renderPedido() {
      const rows = pedidoItens();
      let totalCaixas = 0;
      let totalM2 = 0;
      let totalValor = 0;
      const bodyRows = [];
      const cardRows = [];
      for (const { item, qty } of rows) {
        const m2cx = parseM2Caixa(item);
        const m2tot = m2cx ? qty * m2cx : null;
        const sub = itemSubtotal(item, qty);
        totalCaixas += qty;
        if (m2tot) totalM2 += m2tot;
        if (sub) totalValor += sub;
        const imgs = getGaleria(item);
        const img = imgs[0]?.url || '';
        const titulo = item.formigres_titulo || item.descricao;
        const rowData = { item, qty, img, titulo, m2cx, m2tot, sub };
        bodyRows.push('<tr>' +
          '<td>' + (img ? '<img src="' + esc(img) + '" alt="" width="48" height="48" style="object-fit:cover;border-radius:6px" />' : '—') + '</td>' +
          '<td><strong>' + esc(titulo) + '</strong><br><small>' + esc(item.codigo_tintao) + '</small></td>' +
          '<td>' + esc(item.formato || '—') + '</td>' +
          '<td>' + qty + '</td>' +
          '<td>' + (m2cx ? fmtDecimal(m2cx) : '—') + '</td>' +
          '<td>' + (m2tot ? fmtDecimal(m2tot) : '—') + '</td>' +
          '<td class="' + (descontoPct ? 'has-desc' : '') + '">' + fmtPrecoHtml(item.preco_m2) + '</td>' +
          '<td class="col-subtotal">' + esc(sub != null ? fmtMoney(sub) : '—') + '</td></tr>');
        cardRows.push(renderPedidoCard(rowData));
      }
      document.getElementById('pedido-body').innerHTML = bodyRows.join('');
      document.getElementById('pedido-cards').innerHTML = cardRows.join('');
      document.getElementById('pedido-empty')?.classList.toggle('hidden', rows.length > 0);
      document.getElementById('pedido-list-wrap')?.classList.toggle('hidden', rows.length === 0);
      document.getElementById('pedido-resumo').innerHTML = rows.length
        ? '<span class="stat"><strong>' + rows.length + '</strong> modelos</span>' +
          '<span class="stat"><strong>' + totalCaixas + '</strong> caixas</span>' +
          '<span class="stat"><strong>' + fmtDecimal(totalM2) + '</strong> m²</span>'
        : '';
      document.getElementById('pedido-total').innerHTML = rows.length
        ? '<span>Total estimado: <strong>' + fmtMoney(totalValor) + '</strong></span>' +
          (descontoPct ? '<p class="pedido-desconto-note">Preços com ' + descontoPct + '% de desconto comercial</p>' : '')
        : '';
      document.getElementById('pdf-pedido-panel')?.toggleAttribute('disabled', rows.length === 0);
      updateCartFab();
    }

    function updateCartFab() {
      const rows = pedidoItens();
      let totalCaixas = 0;
      for (const { qty } of rows) totalCaixas += qty;
      const count = rows.length;
      const badge = document.getElementById('cart-fab-badge');
      const fab = document.getElementById('cart-fab');
      if (badge) {
        badge.textContent = String(count);
        badge.dataset.count = String(count);
      }
      if (fab) {
        fab.classList.toggle('has-items', count > 0);
        fab.setAttribute('aria-label', count
          ? 'Minha seleção — ' + count + ' modelos, ' + totalCaixas + ' caixas'
          : 'Minha seleção vazia');
      }
      document.body.classList.toggle('has-selection', count > 0);
    }

    function openPedidoPanel() {
      pedidoOpen = true;
      document.getElementById('pedido-overlay').classList.add('open');
      renderPedido();
      syncBodyScrollLock();
    }

    function closePedidoPanel() {
      pedidoOpen = false;
      document.getElementById('pedido-overlay').classList.remove('open');
      syncBodyScrollLock();
    }

    function pxToMm(px) {
      return Math.ceil(Number(px || 0) * 25.4 / 96);
    }
    function printPageWidthPx() {
      return Math.min(430, Math.max(340, window.innerWidth || 390));
    }
    function printPageWidthMm() {
      return Math.max(88, pxToMm(printPageWidthPx()));
    }
    function waitPrintImages(doc) {
      const imgs = [...(doc.images || [])];
      if (!imgs.length) return Promise.resolve();
      return Promise.all(imgs.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        });
      }));
    }
    function buildPedidoPrintHtml() {
      const rows = pedidoItens();
      let totalCaixas = 0, totalM2 = 0, totalValor = 0;
      const cards = [];
      for (const { item, qty } of rows) {
        const m2cx = parseM2Caixa(item);
        const m2tot = m2cx ? qty * m2cx : null;
        const sub = itemSubtotal(item, qty);
        totalCaixas += qty;
        if (m2tot) totalM2 += m2tot;
        if (sub) totalValor += sub;
        const imgs = getGaleria(item);
        const img = imgs[0]?.url || '';
        const titulo = item.formigres_titulo || item.descricao;
        cards.push(renderPedidoCard({ item, qty, img, titulo, m2cx, m2tot, sub }));
      }
      const descNote = descontoPct ? '<p class="print-note">Desconto comercial aplicado: ' + descontoPct + '% sobre a tabela.</p>' : '';
      const resumo = rows.length
        ? '<div class="print-resumo">' +
            '<span class="print-resumo-stat"><strong>' + rows.length + '</strong> modelos</span>' +
            '<span class="print-resumo-stat"><strong>' + totalCaixas + '</strong> caixas</span>' +
            '<span class="print-resumo-stat"><strong>' + fmtDecimal(totalM2) + '</strong> m²</span>' +
          '</div>'
        : '';
      return '<div class="print-sheet">' +
        '<header class="print-head">' +
          '<h1>Pedido Formigres</h1>' +
          '<p class="print-meta">1ª via · Gerado em ' + esc(new Date().toLocaleString('pt-BR')) + '</p>' +
          descNote +
        '</header>' +
        resumo +
        '<div class="print-cards">' + cards.join('') + '</div>' +
        '<p class="print-totals"><strong>Total estimado: ' + fmtMoney(totalValor) + '</strong></p>' +
      '</div>';
    }
    function printPedidoPrintCss(pageWmm, pageHmm) {
      const pageRule = pageHmm != null
        ? '@page { size: ' + pageWmm + 'mm ' + pageHmm + 'mm; margin: 5mm 4mm; }'
        : '';
      return pageRule +
        'html, body { margin: 0; padding: 0; }' +
        'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color: #1a1a1a; font-size: 13px; -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }' +
        '.print-sheet { width: 100%; box-sizing: border-box; }' +
        '.print-head { margin-bottom: 10px; }' +
        'h1 { margin: 0 0 4px; font-size: 17px; letter-spacing: .04em; text-transform: uppercase; }' +
        '.print-meta, .print-note { margin: 0 0 6px; color: #555; font-size: 11px; line-height: 1.35; }' +
        '.print-resumo { display: flex; gap: 6px; margin-bottom: 10px; }' +
        '.print-resumo-stat { flex: 1; min-width: 0; text-align: center; padding: 7px 4px; border: 1px solid #aaa; border-radius: 6px; background: #f4f4f4; font-size: 10px; color: #555; }' +
        '.print-resumo-stat strong { display: block; font-size: 14px; color: #111; margin-bottom: 2px; }' +
        '.print-cards { display: flex; flex-direction: column; }' +
        '.pedido-card { padding: 10px 0; border-bottom: 1px solid #aaa; break-inside: avoid; page-break-inside: avoid; }' +
        '.pedido-card:last-child { border-bottom: 0; }' +
        '.pedido-card-head { display: flex; align-items: flex-start; gap: 10px; }' +
        '.pedido-card-thumb { width: 48px; height: 48px; border-radius: 7px; object-fit: cover; flex-shrink: 0; background: #eee; }' +
        '.pedido-card-thumb-empty { display: flex; align-items: center; justify-content: center; color: #888; font-size: 12px; }' +
        '.pedido-card-intro { flex: 1; min-width: 0; }' +
        '.pedido-card-aside { text-align: right; flex-shrink: 0; min-width: 72px; max-width: 42%; }' +
        '.pedido-card-title { font-size: 13px; font-weight: 700; line-height: 1.25; color: #111; }' +
        '.pedido-card-meta { margin-top: 3px; font-size: 10px; color: #666; line-height: 1.3; }' +
        '.pedido-card-subtotal-label, .pedido-card-unit-label { display: block; font-size: 8px; text-transform: uppercase; letter-spacing: .05em; color: #666; margin-bottom: 2px; }' +
        '.pedido-card-subtotal strong { display: block; font-size: 13px; font-weight: 700; color: #111; white-space: nowrap; line-height: 1.2; }' +
        '.pedido-card-unit { margin-top: 7px; }' +
        '.pedido-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px 8px; margin-top: 9px; }' +
        '.pedido-card-kv-label { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; color: #666; margin-bottom: 2px; }' +
        '.pedido-card-kv-val { font-size: 12px; font-weight: 600; color: #111; font-variant-numeric: tabular-nums; }' +
        '.pedido-card-price-val { display: block; line-height: 1.15; }' +
        '.preco-orig { display: block; text-decoration: line-through; color: #777; font-size: 9px; line-height: 1.1; font-weight: 400; }' +
        '.preco-desc { display: block; font-weight: 700; color: #111; line-height: 1.15; font-size: 11px; }' +
        '.print-totals { text-align: right; margin: 14px 0 0; padding-top: 10px; border-top: 1px solid #aaa; font-size: 14px; break-inside: avoid; page-break-inside: avoid; }' +
        '.print-totals strong { font-size: 16px; }';
    }
    async function printPedidoPdf() {
      if (!pedidoItens().length) return;
      closePedidoPanel();
      const content = buildPedidoPrintHtml();
      const pageWpx = printPageWidthPx();
      const pageWmm = printPageWidthMm();
      const frame = document.getElementById('pedido-print-frame');
      if (!frame) return;
      frame.style.width = pageWpx + 'px';
      frame.style.visibility = 'hidden';
      frame.style.position = 'fixed';
      frame.style.left = '0';
      frame.style.top = '0';
      frame.style.zIndex = '-1';
      frame.style.border = '0';
      const doc = frame.contentDocument || frame.contentWindow?.document;
      if (!doc) return;
      doc.open();
      doc.write('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=' + pageWpx + '">' +
        '<title>Pedido Formigres</title><style id="print-base">' +
        printPedidoPrintCss(pageWmm, null) +
        '</style></head><body>' + content + '</body></html>');
      doc.close();
      const win = frame.contentWindow;
      if (!win) return;
      const resetFrame = () => {
        frame.style.width = '';
        frame.style.visibility = '';
        frame.style.position = '';
        frame.style.left = '';
        frame.style.top = '';
        frame.style.zIndex = '';
      };
      const cleanup = () => {
        resetFrame();
        try { doc.open(); doc.write(''); doc.close(); } catch { /* ignore */ }
      };
      try {
        await waitPrintImages(doc);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const sheet = doc.querySelector('.print-sheet');
        const heightPx = Math.max(
          sheet?.scrollHeight || 0,
          doc.body?.scrollHeight || 0,
          doc.documentElement?.scrollHeight || 0
        );
        let pageHmm = pxToMm(heightPx) + 12;
        pageHmm = Math.max(100, pageHmm);
        const pageStyle = doc.createElement('style');
        pageStyle.id = 'print-page-size';
        if (pageHmm > 1400) {
          pageStyle.textContent = '@page { size: ' + pageWmm + 'mm 297mm; margin: 5mm 4mm; }';
        } else {
          pageStyle.textContent = '@page { size: ' + pageWmm + 'mm ' + pageHmm + 'mm; margin: 5mm 4mm; }';
        }
        doc.head.appendChild(pageStyle);
        win.onafterprint = cleanup;
        win.focus();
        win.print();
        setTimeout(cleanup, 30000);
      } catch {
        cleanup();
      }
    }

    function collectImageUrls() {
      const urls = new Set();
      for (const item of CATALOGO.itens) {
        if (item.imagem_url) urls.add(item.imagem_url);
        for (const img of (item.imagens || [])) {
          if (img && img.url) urls.add(img.url);
        }
      }
      return [...urls];
    }
    function setLoadProgress(done, total) {
      const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
      const wrap = document.getElementById('load-ant-fill-wrap');
      if (wrap) wrap.style.height = pct + '%';
      const pctEl = document.getElementById('load-pct');
      if (pctEl) pctEl.textContent = pct + '%';
      const squares = document.querySelectorAll('#load-squares .load-square');
      const filled = total > 0 ? Math.round((done / total) * squares.length) : 0;
      squares.forEach((sq, i) => sq.classList.toggle('filled', i < filled));
      const msg = document.getElementById('load-msg');
      if (msg && total > 0) msg.textContent = 'A carregar fotos do catálogo — ' + pct + '% (' + done + ' de ' + total + ')';
    }
    function preloadImages(urls) {
      return new Promise((resolve) => {
        if (!urls.length) { setLoadProgress(0, 0); resolve(); return; }
        let done = 0;
        const total = urls.length;
        setLoadProgress(0, total);
        const finish = () => { clearTimeout(timeout); setLoadProgress(total, total); resolve(); };
        const tick = () => {
          done += 1;
          setLoadProgress(done, total);
          if (done >= total) finish();
        };
        const timeout = setTimeout(finish, 35000);
        urls.forEach((url) => {
          const img = new Image();
          img.onload = tick;
          img.onerror = tick;
          img.src = url;
        });
      });
    }
    function revealApp() {
      document.body.classList.remove('is-loading');
      const shell = document.getElementById('app-shell');
      if (shell) shell.removeAttribute('aria-hidden');
      const overlay = document.getElementById('load-overlay');
      if (overlay) {
        overlay.setAttribute('aria-busy', 'false');
        overlay.setAttribute('aria-hidden', 'true');
      }
    }
    async function bootApp() {
      const urls = collectImageUrls();
      setLoadProgress(0, urls.length);
      await preloadImages(urls);
      renderCatalogo();
      renderPedido();
      updateCartFab();
      requestAnimationFrame(() => requestAnimationFrame(revealApp));
    }

    const q = document.getElementById('search');
    const groupSel = document.getElementById('group-by');
    const groupSelD = document.getElementById('group-by-desktop');

    function syncGroupBy(val) {
      groupBy = val;
      if (groupSel) groupSel.value = val;
      if (groupSelD) groupSelD.value = val;
      renderCatalogo();
    }
    function toggleFilterQty(btn) {
      filterQtyOnly = !filterQtyOnly;
      document.querySelectorAll('#filter-qty, #filter-qty-d').forEach((b) => b?.classList.toggle('active', filterQtyOnly));
      applySearch(q.value);
    }
    function bindClick(id, fn) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    }
    initTopControls();

    q.addEventListener('input', () => applySearch(q.value));
    groupSel?.addEventListener('change', () => syncGroupBy(groupSel.value));
    groupSelD?.addEventListener('change', () => syncGroupBy(groupSelD.value));

    bindClick('filter-qty', (e) => toggleFilterQty(e.currentTarget));
    bindClick('filter-qty-d', (e) => toggleFilterQty(e.currentTarget));
    bindClick('clear-qty', clearAllQty);
    bindClick('clear-qty-d', clearAllQty);
    bindClick('start-qty', startQtyEntry);
    bindClick('start-qty-d', startQtyEntry);
    bindClick('cart-fab', () => (pedidoOpen ? closePedidoPanel() : openPedidoPanel()));
    bindClick('pedido-close', closePedidoPanel);
    bindClick('pdf-pedido-panel', printPedidoPdf);
    bindClick('clear-qty-panel', () => { clearAllQty(); if (!pedidoItens().length) closePedidoPanel(); });
    document.getElementById('pedido-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'pedido-overlay') closePedidoPanel();
    });
    bindClick('toolbar-more', () => {
      const extra = document.getElementById('toolbar-extra');
      if (extra) extra.hidden = !extra.hidden;
    });
    bindClick('expand-all', () => dom.allDetails.forEach((d) => { d.open = true; }));
    bindClick('expand-all-d', () => dom.allDetails.forEach((d) => { d.open = true; }));
    bindClick('collapse-all', () => dom.allDetails.forEach((d) => { d.open = false; }));
    bindClick('collapse-all-d', () => dom.allDetails.forEach((d) => { d.open = false; }));

    document.getElementById('catalogo').addEventListener('input', (e) => {
      const input = e.target.closest('.qty-input');
      if (!input) return;
      setQty(input.dataset.cod, input.value);
    });
    document.getElementById('catalogo').addEventListener('change', (e) => {
      const input = e.target.closest('.qty-input');
      if (!input) return;
      setQty(input.dataset.cod, input.value);
    });
    document.getElementById('catalogo').addEventListener('focusin', (e) => {
      const input = e.target.closest('.qty-input');
      if (!input || !input.closest('.model-row')) return;
      clearQtyFocusRows();
      input.closest('.model-row')?.classList.add('qty-focus-row');
      input.select();
    });
    document.getElementById('catalogo').addEventListener('focusout', (e) => {
      const input = e.target.closest('.qty-input');
      if (!input || !input.closest('.model-row')) return;
      input.closest('.model-row')?.classList.remove('qty-focus-row');
    });
    document.getElementById('catalogo').addEventListener('keydown', handleQtyKeyboardNav);

    document.getElementById('catalogo').addEventListener('click', (e) => {
      const btn = e.target.closest('.thumb-btn');
      if (btn) {
        onThumbClick(btn);
        return;
      }
      if (e.target.closest('.qty-input')) return;
      const row = e.target.closest('.model-row');
      if (!row || row.classList.contains('hidden')) return;
      focusQtyInput(row.querySelector('.qty-input'));
    });

    bootApp();

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
      syncBodyScrollLock();
    }

    function closeLightbox() {
      lb.classList.remove('open', 'has-multi');
      lbImg.src = '';
      galeriaAtual = [];
      syncBodyScrollLock();
    }

    function onThumbClick(btn) {
      const title = btn.dataset.title || 'Modelo';
      const item = itemsByCode.get(String(btn.dataset.cod || ''));
      const imagens = item ? getGaleria(item) : [];
      openGaleria(imagens, title, false);
    }

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
      if (e.key === 'Escape') {
        if (lb.classList.contains('open')) closeLightbox();
        else if (pedidoOpen) closePedidoPanel();
      }
      if (!lb.classList.contains('open')) return;
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
  const antLogoDataUri = loadAntLogoDataUri();
  const html = buildHtml({ classif, itens, antLogoDataUri });

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
