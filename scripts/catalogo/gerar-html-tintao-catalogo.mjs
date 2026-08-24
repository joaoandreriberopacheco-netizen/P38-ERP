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
  <title>Pedido Formigres — Lojistas</title>
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
      font-family: "Libre Franklin", "Segoe UI", system-ui, -apple-system, sans-serif;
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
    .load-panel { text-align: center; padding: 24px; max-width: 340px; }
    .load-ant-wrap {
      display: inline-block;
      animation: ant-march 1.1s ease-in-out infinite;
    }
    @keyframes ant-march {
      0%, 100% { transform: translateX(-6px); }
      50% { transform: translateX(6px); }
    }
    .load-ant-svg { display: block; margin: 0 auto; overflow: visible; }
    .load-ant-svg .ant-leg {
      transform-origin: center top;
      animation: ant-leg .35s ease-in-out infinite alternate;
    }
    .load-ant-svg .leg-a { animation-delay: 0s; }
    .load-ant-svg .leg-b { animation-delay: .12s; }
    .load-ant-svg .leg-c { animation-delay: .24s; }
    @keyframes ant-leg {
      from { transform: rotate(-18deg); }
      to { transform: rotate(18deg); }
    }
    .load-title {
      margin: 18px 0 4px;
      font-size: .82rem;
      letter-spacing: .12em;
      text-transform: uppercase;
      color: var(--text-strong);
      font-weight: 600;
    }
    .load-sub { margin: 0; color: var(--muted); font-size: .85rem; }
    .load-progress {
      margin: 10px 0 0;
      font-size: .78rem;
      color: var(--accent-dim);
      font-variant-numeric: tabular-nums;
      letter-spacing: .04em;
    }
    .load-trail {
      display: flex;
      justify-content: center;
      gap: 6px;
      margin-top: 14px;
    }
    .load-trail span {
      width: 6px;
      height: 6px;
      background: var(--accent-border);
      opacity: .35;
      animation: trail-dot 1.2s ease-in-out infinite;
    }
    .load-trail span:nth-child(2) { animation-delay: .15s; }
    .load-trail span:nth-child(3) { animation-delay: .3s; }
    @keyframes trail-dot {
      0%, 100% { opacity: .2; transform: scale(.85); }
      50% { opacity: 1; transform: scale(1); }
    }
    .site-bar {
      background: var(--surface-2);
      border-bottom: 1px solid var(--border);
      border-left: 3px solid var(--accent-dim);
    }
    .site-bar-inner {
      max-width: 1100px;
      margin: 0 auto;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
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
    .wrap { max-width: 1100px; margin: 0 auto; padding: 24px 16px 48px; }
    header.hero {
      background: var(--surface);
      border: 1px solid var(--border);
      border-left: 3px solid var(--accent-dim);
      border-radius: var(--radius);
      padding: 24px 22px;
      margin-bottom: 18px;
      box-shadow: var(--shadow-soft);
    }
    header.hero h1 {
      margin: 0 0 6px;
      font-size: 1.5rem;
      font-weight: 600;
      letter-spacing: .06em;
      text-transform: uppercase;
      color: var(--text-strong);
    }
    header.hero p { margin: 0; color: var(--muted); font-size: .92rem; }
    .hero-cta {
      display: none;
      width: 100%;
      margin-top: 14px;
      padding: 14px 18px;
      border-radius: var(--radius);
      border: 1px solid var(--accent-border);
      background: var(--accent-dim);
      color: var(--accent-on);
      font-size: .95rem;
      font-weight: 600;
      letter-spacing: .04em;
      text-transform: uppercase;
      cursor: pointer;
      box-shadow: var(--shadow-soft);
      transition: background .25s ease, transform .15s ease;
    }
    .hero-cta:hover { background: var(--accent-bright); color: var(--accent-on); }
    .hero-cta.pulse { animation: cta-pulse 2s ease-in-out 2; }
    @keyframes cta-pulse {
      0%, 100% { box-shadow: var(--shadow-soft); transform: scale(1); }
      50% { box-shadow: 0 6px 20px var(--accent-glow); transform: scale(1.01); }
    }
    .flow-steps {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0;
      margin-top: 16px;
      padding: 12px 10px;
      background: var(--surface-3);
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }
    .flow-step {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      flex: 1;
      opacity: .45;
      transition: opacity .2s ease;
    }
    .flow-step.active, .flow-step.done { opacity: 1; }
    .flow-icon {
      width: 28px; height: 28px;
      border-radius: var(--radius);
      background: var(--surface-2);
      border: 2px solid var(--border);
      display: grid; place-items: center;
      font-size: .75rem; font-weight: 700;
    }
    .flow-step.active .flow-icon {
      border-color: var(--accent);
      background: var(--accent-soft);
      color: var(--accent);
    }
    .flow-step.done .flow-icon {
      border-color: var(--accent);
      background: var(--accent);
      color: var(--accent-on);
    }
    .flow-label { font-size: .68rem; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }
    .flow-step.active .flow-label { color: var(--accent); font-weight: 600; }
    .flow-line {
      width: 24px; height: 2px; background: var(--border);
      flex-shrink: 0; margin-bottom: 18px;
    }
    .flow-line.done { background: var(--accent-dim); }
    .stats {
      display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px;
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
    .qty-cell-btn {
      display: none;
      align-items: center;
      justify-content: center;
      min-width: 52px;
      min-height: 44px;
      padding: 0 12px;
      border-radius: var(--radius);
      border: 1px dashed var(--border);
      background: var(--surface-2);
      color: var(--muted);
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
    }
    .qty-cell-btn.has-value {
      border-style: solid;
      border-color: var(--accent);
      background: var(--accent-soft);
      color: var(--accent-deep);
    }
    .qty-dialog {
      position: fixed; inset: 0; z-index: 55;
      background: rgba(8,7,10,.75);
      display: none; align-items: flex-end; justify-content: center;
      padding: 0;
    }
    .qty-dialog.open { display: flex; }
    .qty-dialog-panel {
      width: 100%; max-width: 420px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius) var(--radius) 0 0;
      padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
      box-shadow: var(--shadow);
    }
    .qty-dialog-panel::before {
      content: "";
      display: block;
      width: 40px; height: 4px;
      background: var(--border);
      border-radius: var(--radius);
      margin: 0 auto 14px;
    }
    .qty-dialog-title { margin: 0 0 4px; font-size: 1rem; font-weight: 600; }
    .qty-dialog-meta { margin: 0 0 16px; font-size: .78rem; color: var(--muted); }
    .qty-dialog-stepper {
      display: flex; align-items: center; justify-content: center;
      gap: 0; margin-bottom: 16px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
      max-width: 220px;
      margin-left: auto; margin-right: auto;
    }
    .qty-dialog-stepper .qty-step {
      width: 56px; height: 56px;
      border: 0; background: transparent;
      color: var(--accent); font-size: 1.5rem; font-weight: 600;
      cursor: pointer;
    }
    .qty-dialog-stepper .qty-input {
      width: 72px; height: 56px;
      border: 0; border-left: 1px solid var(--border); border-right: 1px solid var(--border);
      border-radius: 0; font-size: 1.25rem; font-weight: 600;
    }
    .qty-dialog-actions {
      display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
    }
    .qty-dialog-actions .btn { border-radius: var(--radius); padding: 14px; font-size: .95rem; }
    .qty-dialog-actions .btn-save {
      background: var(--accent-dim);
      border-color: var(--accent-border);
      color: var(--accent-on);
      font-weight: 600;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    .qty-dialog-actions .btn-save:hover { background: var(--accent-bright); }
    @media (min-width: 721px) {
      .qty-dialog { align-items: center; padding: 20px; }
      .qty-dialog-panel { border-radius: var(--radius); max-width: 380px; }
      .qty-dialog-panel::before { display: none; }
      .qty-cell-btn { display: none !important; }
    }
    .cart-fab {
      position: fixed;
      right: 16px;
      bottom: calc(16px + env(safe-area-inset-bottom));
      z-index: 40;
      width: 56px;
      height: 56px;
      border-radius: var(--radius);
      background: var(--surface-2);
      border: 1px solid var(--accent-border);
      color: var(--accent-bright);
      box-shadow: var(--shadow);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: transform .25s ease, box-shadow .25s ease, background .25s ease, color .25s ease;
    }
    .cart-fab:hover {
      transform: scale(1.03);
      background: var(--accent-dim);
      color: var(--accent-on);
      box-shadow: 0 10px 28px var(--accent-glow);
    }
    .cart-fab svg { width: 26px; height: 26px; stroke-width: 2.2; }
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
      max-width: 1100px;
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
    footer.note {
      margin-top: 20px; color: var(--muted); font-size: .78rem; text-align: center;
      letter-spacing: .04em;
    }
    .cart-fab.has-items {
      animation: cart-pulse 2.4s ease-in-out infinite;
    }
    @keyframes cart-pulse {
      0%, 100% { box-shadow: var(--shadow); }
      50% { box-shadow: 0 10px 28px var(--accent-glow); }
    }
    body.has-cart .wrap {
      padding-bottom: calc(80px + env(safe-area-inset-bottom));
    }
    @media (max-width: 720px) {
      .wrap { padding: 14px 10px 36px; }
      .hero-cta { display: block; }
      header.hero { padding: 16px 14px; }
      header.hero h1 { font-size: 1.15rem; }
      .stat-hide-mobile { display: none; }
      .toolbar { gap: 8px; margin-bottom: 10px; }
      .toolbar-desktop-only { display: none !important; }
      .search { flex: 1; min-width: 0; }
      .select-group, .btn { font-size: .8rem; padding: 9px 12px; }
      .pedido-overlay.open { align-items: center; padding: 20px; }
      .pedido-overlay.open .pedido-panel {
        border-radius: var(--radius);
        max-height: 85vh;
      }
      .pedido-overlay.open .pedido-panel::before { display: none; }
      .cart-fab { right: 20px; bottom: 20px; }
      footer.note { display: none; }
      details.acc > summary {
        padding: 12px 12px 12px calc(10px + var(--depth, 0) * 12px);
        gap: 8px;
      }
      .acc-inner { padding-left: calc(8px + var(--depth, 0) * 12px); }
      .acc-title { font-size: .92rem; }
      .acc-count { font-size: .72rem; padding: 3px 8px; }
      .col-desc, .model-table thead th:nth-child(3) { display: none; }
      .model-table { font-size: .8rem; }
      .qty-input-desktop { display: none !important; }
      .qty-cell-btn { display: inline-flex; }
      .qty-input { width: 64px; min-height: 44px; font-size: 1rem; }
      .col-qty, .model-table thead th:nth-child(6) {
        position: sticky; right: 52px; background: var(--surface); z-index: 1;
        box-shadow: -6px 0 8px rgba(0,0,0,.06);
      }
      .model-table thead th:nth-child(6) { background: var(--surface-2); z-index: 2; }
      .col-cod, .model-table thead th:nth-child(7) {
        position: sticky; right: 0; background: var(--surface); z-index: 1;
      }
      .model-table thead th:nth-child(7) { background: var(--surface-2); z-index: 2; }
      .lightbox { padding: 10px; }
      .gallery-nav { width: 36px; height: 36px; }
    }
    @media (min-width: 721px) {
      .toolbar-mobile-only { display: none !important; }
    }
    @media (max-width: 480px) {
      .col-acab, .col-cod,
      .model-table thead th:nth-child(4),
      .model-table thead th:nth-child(7) { display: none; }
      .col-qty, .model-table thead th:nth-child(6) { right: 0; }
      .stats { gap: 6px; }
      .stat { font-size: .75rem; padding: 5px 10px; }
      .model-table td, .model-table th { padding: 7px 8px; }
      .lightbox-head h3 { font-size: .88rem; }
      .lightbox-stage { min-height: 220px; }
      .lightbox-stage img { max-height: 58vh; }
    }
  </style>
</head>
<body class="is-loading">
  <div class="load-overlay" id="load-overlay" role="status" aria-live="polite" aria-busy="true">
    <div class="load-panel">
      <div class="load-ant-wrap" aria-hidden="true">
        <svg class="load-ant-svg" width="96" height="56" viewBox="0 0 96 56" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="44" cy="30" rx="20" ry="12" fill="#2c2c32" stroke="#c8c8d0" stroke-width="1.2"/>
          <circle cx="64" cy="24" r="9" fill="#2c2c32" stroke="#c8c8d0" stroke-width="1.2"/>
          <circle cx="67" cy="22" r="1.5" fill="#ececf0"/>
          <line class="ant-leg leg-a" x1="36" y1="38" x2="28" y2="50" stroke="#a8a8b2" stroke-width="2" stroke-linecap="square"/>
          <line class="ant-leg leg-b" x1="44" y1="40" x2="44" y2="52" stroke="#a8a8b2" stroke-width="2" stroke-linecap="square"/>
          <line class="ant-leg leg-c" x1="52" y1="38" x2="60" y2="50" stroke="#a8a8b2" stroke-width="2" stroke-linecap="square"/>
          <line class="ant-leg leg-a" x1="38" y1="34" x2="30" y2="24" stroke="#a8a8b2" stroke-width="2" stroke-linecap="square"/>
          <line class="ant-leg leg-b" x1="46" y1="32" x2="46" y2="20" stroke="#a8a8b2" stroke-width="2" stroke-linecap="square"/>
          <line class="ant-leg leg-c" x1="54" y1="34" x2="62" y2="24" stroke="#a8a8b2" stroke-width="2" stroke-linecap="square"/>
          <path d="M72 24 L82 22 L82 26 Z" fill="#c8c8d0"/>
        </svg>
      </div>
      <p class="load-title">Formigres</p>
      <p class="load-sub" id="load-msg">A carregar fotos do catálogo…</p>
      <p class="load-progress" id="load-progress">0 / 0</p>
      <div class="load-trail" aria-hidden="true"><span></span><span></span><span></span></div>
    </div>
  </div>

  <div id="app-shell" class="app-shell" aria-hidden="true">
  <header class="site-bar">
    <div class="site-bar-inner">
      <span class="site-brand">Formigres</span>
      <span class="site-divider" aria-hidden="true"></span>
      <span class="site-sub">Pedido B2B · Lojistas</span>
    </div>
  </header>
  <div class="wrap">
    <header class="hero">
      <h1>Pedido Formigres</h1>
      <p>Para lojistas — escolha o modelo, marque as caixas e revise o total</p>
      <div class="stats">
        <span class="stat"><strong>${total}</strong> modelos na lista</span>
      </div>
      <div class="flow-steps" aria-hidden="true">
        <div class="flow-step active" id="flow-1"><span class="flow-icon">1</span><span class="flow-label">Explorar</span></div>
        <span class="flow-line" id="flow-line-1"></span>
        <div class="flow-step" id="flow-2"><span class="flow-icon">2</span><span class="flow-label">Caixas</span></div>
        <span class="flow-line" id="flow-line-2"></span>
        <div class="flow-step" id="flow-3"><span class="flow-icon">3</span><span class="flow-label">Revisar</span></div>
      </div>
      <button type="button" class="hero-cta" id="start-qty">Começar pedido</button>
    </header>

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

    <footer class="note">Catálogo offline · fotos embutidas · ${esc(gerado)}</footer>
  </div>

  <button type="button" class="cart-fab" id="cart-fab" aria-label="Minha seleção">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
    </svg>
    <span class="cart-fab-badge" id="cart-fab-badge" data-count="0">0</span>
  </button>

  <div class="pedido-overlay" id="pedido-overlay" role="dialog" aria-modal="true" aria-label="Minha seleção">
    <section class="pedido-panel" id="pedido-panel">
      <div class="pedido-head">
        <div>
          <h2>Minha seleção</h2>
          <p style="margin:4px 0 0;font-size:.78rem;color:var(--muted)">Revise caixas, m² e total antes de exportar</p>
        </div>
        <button type="button" class="pedido-close" id="pedido-close" aria-label="Fechar">×</button>
      </div>
      <div class="pedido-resumo" id="pedido-resumo"></div>
      <div class="pedido-empty hidden" id="pedido-empty">Nenhum modelo na seleção — marque caixas na tabela.</div>
      <div class="table-wrap" id="pedido-table-wrap">
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
      <div class="pedido-actions">
        <button type="button" class="btn" id="clear-qty-panel">Limpar seleção</button>
        <button type="button" class="btn btn-primary" id="pdf-pedido-panel" disabled>PDF do pedido</button>
      </div>
    </section>
  </div>

  <div id="pedido-print"></div>

  <div class="qty-dialog" id="qty-dialog" role="dialog" aria-modal="true" aria-label="Quantidade de caixas">
    <div class="qty-dialog-panel">
      <h3 class="qty-dialog-title" id="qty-dialog-title">Modelo</h3>
      <p class="qty-dialog-meta" id="qty-dialog-meta"></p>
      <div class="qty-dialog-stepper">
        <button type="button" class="qty-step minus" id="qty-dialog-minus" aria-label="Menos">−</button>
        <input type="number" class="qty-input" id="qty-dialog-input" min="0" step="1" inputmode="numeric" autocomplete="off" placeholder="0" />
        <button type="button" class="qty-step plus" id="qty-dialog-plus" aria-label="Mais">+</button>
      </div>
      <div class="qty-dialog-actions">
        <button type="button" class="btn" id="qty-dialog-cancel">Cancelar</button>
        <button type="button" class="btn btn-save" id="qty-dialog-save">Salvar</button>
      </div>
    </div>
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
      return Number.isNaN(n) ? String(v) : 'R$ ' + n.toFixed(2).replace('.', ',');
    }
    function getQty(cod) {
      const n = Number(qtyMap[String(cod)] || 0);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    }
    function syncQtyCellDisplay(cod, n) {
      document.querySelectorAll('.qty-cell-btn[data-cod="' + cod + '"]').forEach((btn) => {
        btn.textContent = n > 0 ? String(n) : '+';
        btn.classList.toggle('has-value', n > 0);
      });
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
      syncQtyCellDisplay(cod, n);
      document.querySelectorAll('.qty-input[data-cod="' + cod + '"]').forEach((input) => {
        if (document.activeElement !== input) input.value = n || '';
      });
      renderPedido();
      updateCartFab();
      updateFlowSteps();
      if (filterQtyOnly) applySearch(document.getElementById('search').value);
    }
    function adjustQty(cod, delta) {
      setQty(cod, getQty(cod) + delta);
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
      document.querySelectorAll('.qty-cell-btn').forEach((btn) => {
        btn.textContent = '+';
        btn.classList.remove('has-value');
      });
      document.querySelectorAll('.model-row').forEach((row) => {
        row.dataset.qty = '0';
        row.classList.remove('has-qty');
      });
      renderPedido();
      updateCartFab();
      updateFlowSteps();
      if (filterQtyOnly) applySearch(document.getElementById('search').value);
    }
    function visibleQtyInputs() {
      return [...document.querySelectorAll('.model-row:not(.hidden) .qty-input-desktop')];
    }
    function visibleRows() {
      return [...document.querySelectorAll('.model-row:not(.hidden)')];
    }
    function isMobileQty() {
      return window.matchMedia('(max-width: 720px)').matches;
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
      if (!input || isMobileQty()) return;
      setQty(input.dataset.cod, input.value);
      moveQtyFocus(input, delta);
    }
    function handleQtyKeyboardNav(e) {
      if (isMobileQty()) return;
      const input = e.target.closest('.qty-input-desktop');
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
      const cod = target.dataset.cod;
      if (isMobileQty()) openQtyDialog(cod);
      else focusQtyInput(target.querySelector('.qty-input-desktop'));
    }
    let qtyDialogCod = null;
    function openQtyDialog(cod) {
      const item = itemsByCode.get(String(cod));
      if (!item) return;
      qtyDialogCod = String(cod);
      const titulo = item.formigres_titulo || item.descricao;
      document.getElementById('qty-dialog-title').textContent = titulo;
      const meta = [item.formato, item.formigres_acabamento, '#' + item.codigo_tintao].filter(Boolean).join(' · ');
      document.getElementById('qty-dialog-meta').textContent = meta;
      const input = document.getElementById('qty-dialog-input');
      input.value = getQty(cod) || '';
      document.getElementById('qty-dialog').classList.add('open');
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => { input.focus(); input.select(); });
    }
    function closeQtyDialog() {
      document.getElementById('qty-dialog').classList.remove('open');
      qtyDialogCod = null;
      syncBodyScrollLock();
    }
    function saveQtyDialog() {
      if (!qtyDialogCod) return;
      setQty(qtyDialogCod, document.getElementById('qty-dialog-input').value);
      closeQtyDialog();
    }
    function syncBodyScrollLock() {
      const locked = pedidoOpen
        || document.getElementById('qty-dialog').classList.contains('open')
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
      return '<tr class="model-row' + (qty > 0 ? ' has-qty' : '') + '" data-cod="' + esc(cod) + '" data-search="' + esc((titulo + ' ' + item.descricao + ' ' + item.formigres_acabamento + ' ' + item.formato + ' ' + cod).toLowerCase()) + '" data-qty="' + qty + '">' +
        '<td class="col-foto">' + foto + '</td>' +
        '<td class="col-modelo"><strong>' + esc(titulo) + '</strong>' + warn + '<br><small style="color:var(--muted)">#' + esc(cod) + '</small></td>' +
        '<td class="col-desc">' + esc(item.descricao) + '</td>' +
        '<td class="col-acab">' + esc(item.formigres_acabamento || '—') + '</td>' +
        '<td class="col-preco">' + esc(fmtMoney(item.preco_m2)) + '</td>' +
        '<td class="col-qty">' +
        '<input type="number" class="qty-input qty-input-desktop" min="0" step="1" inputmode="numeric" enterkeyhint="next" autocomplete="off" tabindex="0" value="' + (qty || '') + '" data-cod="' + esc(cod) + '" aria-label="Caixas" placeholder="0" />' +
        '<button type="button" class="qty-cell-btn' + (qty > 0 ? ' has-value' : '') + '" data-cod="' + esc(cod) + '" aria-label="Caixas">' + (qty > 0 ? qty : '+') + '</button>' +
        '</td>' +
        '<td class="col-cod">' + esc(item.formato || '—') + '</td></tr>';
    }
    function renderFormato(formato, items) {
      const n = items.length;
      return '<details class="acc acc-formato" open><summary><span class="acc-title">Formato ' + esc(formato) + '</span><span class="acc-count">' + n + '</span></summary>' +
        '<div class="table-wrap"><table class="model-table"><thead><tr><th>Foto</th><th>Modelo</th><th>Descrição</th><th>Acab.</th><th>Preço/m²</th><th>Caixas</th><th>Formato</th></tr></thead><tbody>' +
        items.map(renderTableRow).join('') + '</tbody></table></div></details>';
    }
    function renderGrupo(key, formatosMap, linha) {
      const formatos = Object.keys(formatosMap).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      const n = formatos.reduce((s, f) => s + formatosMap[f].length, 0);
      return '<details class="acc acc-grupo" open><summary><span class="acc-title">' + esc(grupoLabel(key, linha)) + '</span><span class="acc-count">' + n + ' itens</span></summary>' +
        '<div class="acc-inner">' + formatos.map((f) => renderFormato(f, formatosMap[f])).join('') + '</div></details>';
    }
    function renderLinha(linha, gruposMap) {
      const keys = sortGrupos(Object.keys(gruposMap), linha);
      const n = keys.reduce((s, k) => s + Object.values(gruposMap[k]).reduce((a, arr) => a + arr.length, 0), 0);
      const label = CFG.linhaLabel[linha] || linha;
      return '<details class="acc acc-linha" open><summary><span class="acc-title linha-' + esc(linha) + '">' + esc(label) + '</span><span class="acc-count">' + n + '</span></summary>' +
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
      document.getElementById('pedido-body').innerHTML = body;
      document.getElementById('pedido-empty')?.classList.toggle('hidden', rows.length > 0);
      document.getElementById('pedido-table-wrap')?.classList.toggle('hidden', rows.length === 0);
      document.getElementById('pedido-resumo').innerHTML = rows.length
        ? '<span class="stat"><strong>' + rows.length + '</strong> modelos</span>' +
          '<span class="stat"><strong>' + totalCaixas + '</strong> caixas</span>' +
          '<span class="stat"><strong>' + totalM2.toFixed(2).replace('.', ',') + '</strong> m²</span>'
        : '';
      document.getElementById('pedido-total').innerHTML = rows.length
        ? '<span>Total estimado: <strong>' + fmtMoney(totalValor) + '</strong></span>'
        : '';
      document.getElementById('pdf-pedido-panel')?.toggleAttribute('disabled', rows.length === 0);
      updateCartFab();
      updateFlowSteps();
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
      document.body.classList.add('has-cart');
      document.body.classList.toggle('has-selection', count > 0);
    }

    function updateFlowSteps() {
      const n = pedidoItens().length;
      const s1 = document.getElementById('flow-1');
      const s2 = document.getElementById('flow-2');
      const s3 = document.getElementById('flow-3');
      const l1 = document.getElementById('flow-line-1');
      const l2 = document.getElementById('flow-line-2');
      s1?.classList.toggle('done', true);
      s1?.classList.toggle('active', n === 0);
      s2?.classList.toggle('active', n === 0);
      s2?.classList.toggle('done', n > 0);
      s3?.classList.toggle('active', n > 0);
      s3?.classList.toggle('done', pedidoOpen && n > 0);
      l1?.classList.toggle('done', n > 0);
      l2?.classList.toggle('done', n > 0);
    }

    function openPedidoPanel() {
      pedidoOpen = true;
      document.getElementById('pedido-overlay').classList.add('open');
      renderPedido();
      updateFlowSteps();
      syncBodyScrollLock();
    }

    function closePedidoPanel() {
      pedidoOpen = false;
      document.getElementById('pedido-overlay').classList.remove('open');
      updateFlowSteps();
      syncBodyScrollLock();
    }

    function printPedidoPdf() {
      if (!pedidoItens().length) return;
      document.getElementById('pedido-print').innerHTML = buildPedidoPrintHtml();
      window.print();
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
        '<h1 style="margin:0 0 4px;font-size:20px">Pedido Formigres — seleção do lojista</h1>' +
        '<p style="margin:0 0 16px;color:#555;font-size:12px">Gerado em ' + new Date().toLocaleString('pt-BR') + '</p>' +
        '<table><thead><tr><th>Foto</th><th>Modelo</th><th>Formato</th><th>Caixas</th><th>m²/cx</th><th>m² total</th><th>Preço/m²</th><th>Subtotal</th></tr></thead><tbody>' + body + '</tbody></table>' +
        '<p style="text-align:right;margin-top:16px;font-size:14px"><strong>' + rows.length + ' modelos · ' + totalCaixas + ' caixas · ' + totalM2.toFixed(2) + ' m² · Total: ' + fmtMoney(totalValor) + '</strong></p></div>';
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
    function preloadImages(urls) {
      return new Promise((resolve) => {
        if (!urls.length) { resolve(); return; }
        let done = 0;
        const total = urls.length;
        const prog = document.getElementById('load-progress');
        const finish = () => { clearTimeout(timeout); resolve(); };
        const tick = () => {
          done += 1;
          if (prog) prog.textContent = done + ' / ' + total;
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
      const prog = document.getElementById('load-progress');
      if (prog) prog.textContent = urls.length ? ('0 / ' + urls.length) : '—';
      await preloadImages(urls);
      renderCatalogo();
      renderPedido();
      updateCartFab();
      updateFlowSteps();
      if (!sessionStorage.getItem('tintao-seen')) {
        document.querySelector('.hero-cta')?.classList.add('pulse');
        sessionStorage.setItem('tintao-seen', '1');
      }
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
    bindClick('qty-dialog-cancel', closeQtyDialog);
    bindClick('qty-dialog-save', saveQtyDialog);
    bindClick('qty-dialog-minus', () => {
      if (!qtyDialogCod) return;
      const input = document.getElementById('qty-dialog-input');
      input.value = Math.max(0, (Number(input.value) || 0) - 1);
    });
    bindClick('qty-dialog-plus', () => {
      if (!qtyDialogCod) return;
      const input = document.getElementById('qty-dialog-input');
      input.value = (Number(input.value) || 0) + 1;
    });
    document.getElementById('qty-dialog')?.addEventListener('click', (e) => {
      if (e.target.id === 'qty-dialog') closeQtyDialog();
    });
    document.getElementById('qty-dialog-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); saveQtyDialog(); }
      if (e.key === 'Escape') closeQtyDialog();
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
      const input = e.target.closest('.qty-input-desktop');
      if (!input || isMobileQty()) return;
      clearQtyFocusRows();
      input.closest('.model-row')?.classList.add('qty-focus-row');
      input.select();
    });
    document.getElementById('catalogo').addEventListener('focusout', (e) => {
      const input = e.target.closest('.qty-input-desktop');
      if (!input || isMobileQty()) return;
      input.closest('.model-row')?.classList.remove('qty-focus-row');
    });
    document.getElementById('catalogo').addEventListener('keydown', handleQtyKeyboardNav);

    document.getElementById('catalogo').addEventListener('click', (e) => {
      const qtyBtn = e.target.closest('.qty-cell-btn');
      if (qtyBtn) {
        e.stopPropagation();
        const cod = qtyBtn.dataset.cod;
        if (isMobileQty()) openQtyDialog(cod);
        else focusQtyInput(qtyBtn.closest('.model-row')?.querySelector('.qty-input-desktop'));
        return;
      }
      const btn = e.target.closest('.thumb-btn');
      if (btn) {
        onThumbClick(btn);
        return;
      }
      if (e.target.closest('.qty-input, .qty-stepper')) return;
      const row = e.target.closest('.model-row');
      if (!row || row.classList.contains('hidden')) return;
      if (isMobileQty()) openQtyDialog(row.dataset.cod);
      else focusQtyInput(row.querySelector('.qty-input-desktop'));
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
        if (document.getElementById('qty-dialog').classList.contains('open')) closeQtyDialog();
        else if (lb.classList.contains('open')) closeLightbox();
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
