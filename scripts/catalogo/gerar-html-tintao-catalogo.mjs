#!/usr/bin/env node
/**
 * Gera HTML partilhável — pedido Formigres para lojistas (B2B).
 * Persona: lojista que compara modelos, marca caixas e revisa total — não consumidor final.
 *
 * npm run catalogo:html-tintao
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { readJson, snapshotPath } from '../lib/catalogoPaths.mjs';
import { extractImagensFromDetalhe } from '../lib/formigresCatalog.mjs';
import { loadSnapshotFromFile } from '../lib/formigresSnapshot.mjs';
import { dedupeFormigresGemeas } from '../lib/formigresGemeas.mjs';

const ROOT = process.cwd();
const args = process.argv.slice(2);
function argValue(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}

const MODO = argValue('--modo') || 'tintao';

const CONFIGS = {
  tintao: {
    classifDir: path.join(ROOT, 'docs', 'imports-local', 'tintao', 'classificacao'),
    classifPattern: /^tintao-formigres-\d{4}-\d{2}-\d{2}\.json$/,
    outHtml: path.join(ROOT, 'docs', 'imports-local', 'tintao', 'Catálogo B2B Tintão - Formigres.html'),
    outDeploy: path.join(ROOT, 'deploy', 'catalogo-tintao', 'index.html'),
    outPdfThumbs: path.join(ROOT, 'docs', 'imports-local', 'tintao', 'catalogo-tintao-pdf-thumbs.json'),
    publicUrl: (process.env.CATALOGO_TINTAO_PUBLIC_URL || 'https://catalogo-tintao-formigres.vercel.app/').replace(/\/?$/, '/'),
    skipApiEnrich: false,
    skipPdfThumbs: false,
    title: 'Pedido Formigres — Lojistas',
    h1: 'Pedido Formigres',
    hint: 'Marque caixas na tabela · revise no carrinho',
    qtyUnit: 'caixa',
    qtyLabel: 'Caixas',
    qtyLabelPl: 'caixas',
    demoBanner: '',
    themeKey: 'tintao-theme-v1',
    qtyKey: 'tintao-pedido-qty-v1',
    descontoKey: 'tintao-desconto-v1',
    groupKey: 'tintao-catalog-group-v1',
    classifError: 'JSON de classificação não encontrado. Rode: npm run catalogo:classificar-tintao',
    skin: 'default',
    siteSub: 'Pedido B2B · Lojistas',
    hideThemeToggle: false,
    fontsUrl: 'https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700&display=swap',
    logoPath: null,
  },
  formigres: {
    classifDir: path.join(ROOT, 'docs', 'imports-local', 'formigres', 'classificacao'),
    classifPattern: /^formigres-completo-\d{4}-\d{2}-\d{2}\.json$/,
    outHtml: path.join(ROOT, 'docs', 'imports-local', 'formigres', 'Catálogo Formigres — Demonstração.html'),
    outDeploy: path.join(ROOT, 'deploy', 'catalogo-formigres', 'index.html'),
    outPdfThumbs: path.join(ROOT, 'docs', 'imports-local', 'formigres', 'catalogo-formigres-pdf-thumbs.json'),
    publicUrl: (process.env.CATALOGO_FORMIGRES_PUBLIC_URL || 'https://catalogo-formigres-p38.vercel.app/').replace(/\/?$/, '/'),
    skipApiEnrich: true,
    skipPdfThumbs: false,
    title: 'Catálogo Formigres — Pisos e Porcelanatos',
    h1: 'Pisos e Revestimentos Cerâmicos',
    hint: 'Marque paletes na tabela · revise m², peso e total no carrinho',
    qtyUnit: 'palete',
    qtyLabel: 'Paletes',
    qtyLabelPl: 'paletes',
    demoBanner: '',
    themeKey: 'formigres-catalog-theme-v1',
    qtyKey: 'formigres-catalog-qty-v1',
    descontoKey: 'formigres-catalog-desconto-v1',
    regimeKey: 'formigres-regime-especial-v1',
    groupKey: 'formigres-catalog-group-v1',
    classifError: 'JSON de classificação não encontrado. Rode: npm run catalogo:classificar-formigres',
    skin: 'formigres',
    siteSub: 'Catálogo B2B · Demonstração',
    hideThemeToggle: true,
    fontsUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@600;700;800&display=swap',
    logoPath: path.join(ROOT, 'scripts', 'catalogo', 'assets', 'formigres-logo.png'),
  },
};

const CFG = CONFIGS[MODO] || CONFIGS.tintao;
const CLASSIF_DIR = CFG.classifDir;
const OUT_HTML = CFG.outHtml;
const OUT_DEPLOY_HTML = CFG.outDeploy;
const PUBLIC_URL = CFG.publicUrl;
const OUT_PDF_THUMBS = CFG.outPdfThumbs;
const ANT_LOGO_PATH = path.join(ROOT, 'scripts', 'catalogo', 'assets', 'formigres-ant.png');
const PDF_FONT_WOFF2 = path.join(ROOT, 'scripts', 'catalogo', 'assets', 'fonts', 'libre-franklin-latin.woff2');
// Silhueta vermelha Formigres (recorte do logo vertical da marca); fundo transparente.

function loadImageDataUri(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
}

function loadAntLogoDataUri() {
  return loadImageDataUri(ANT_LOGO_PATH);
}

function loadBrandLogoDataUri(cfg) {
  if (cfg.logoPath) return loadImageDataUri(cfg.logoPath);
  return loadAntLogoDataUri();
}

function loadPdfFontFaceCss() {
  try {
    const b64 = fs.readFileSync(PDF_FONT_WOFF2).toString('base64');
    return (
      "@font-face{font-family:'Libre Franklin';font-style:normal;font-weight:400 700;font-display:swap;" +
      "src:url(data:font/woff2;base64," + b64 + ") format('woff2');}" +
      "html,body,.print-render-root,.print-sheet,.pedido-card-pdf{font-family:'Libre Franklin',system-ui,-apple-system,'Segoe UI',sans-serif;}"
    );
  } catch {
    return "html,body,.print-render-root{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;}";
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

function findLatestClassifJson() {
  const custom = argValue('--json');
  if (custom && fs.existsSync(custom)) return custom;
  if (!fs.existsSync(CLASSIF_DIR)) return null;
  const files = fs.readdirSync(CLASSIF_DIR)
    .filter((f) => CFG.classifPattern.test(f))
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

async function fetchPdfThumbDataUri(url) {
  if (!url) return '';
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return '';
    const buf = Buffer.from(await res.arrayBuffer());
    const thumb = await sharp(buf)
      .rotate()
      .resize(80, 80, { fit: 'cover' })
      .jpeg({ quality: 48, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${thumb.toString('base64')}`;
  } catch {
    return '';
  }
}

async function buildPdfThumbMap(itens) {
  const urls = new Set();
  for (const item of itens) {
    const imgs = (item.imagens || []).filter((img) => img?.url);
    const url = imgs[0]?.url || item.imagem_url;
    if (url) urls.add(url);
  }
  const list = [...urls];
  const map = {};
  let idx = 0;
  const workers = Math.min(8, list.length || 1);
  async function worker() {
    while (idx < list.length) {
      const i = idx++;
      const url = list[i];
      map[url] = await fetchPdfThumbDataUri(url);
    }
  }
  await Promise.all(Array.from({ length: workers }, worker));
  return map;
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
      marca_nome: prod?.marca_nome || item.marca_nome || '',
      referencia: prod?.referencia || item.referencia || '',
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
    marca_nome: item.marca_nome || '',
    referencia: item.referencia || '',
    gemeas: (item.gemeas || []).map((g) => ({
      codigo: String(g.codigo),
      marca: g.marca || '—',
      referencia: g.referencia || '—',
    })),
    match_status: item.match_status,
    preco_m2: item.preco_m2,
    m2_por_caixa: item.m2_por_caixa ?? null,
    caixas_por_palete: item.caixas_por_palete ?? null,
    m2_por_palete: item.m2_por_palete ?? null,
    peso_kg_caixa: item.peso_kg_caixa ?? null,
    peso_kg_palete: item.peso_kg_palete ?? null,
    unidade: item.unidade || '',
    imagem_url: item.imagem_url || '',
    imagens: (item.imagens || []).map((img) => ({ url: img.url, tipo: img.tipo || 'principal' })),
  };
}

function escTpl(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const FORMIGRES_SKIN_CSS = `
    html[data-skin="formigres"] {
      --bg: #ffffff;
      --bg-elevated: #ffffff;
      --surface: #ffffff;
      --surface-2: #f4f4f4;
      --surface-3: #f4f4f4;
      --border: #e8e8e8;
      --border-subtle: rgba(0,0,0,.05);
      --text: #444444;
      --text-strong: #111111;
      --muted: #666666;
      --accent: #da1c24;
      --accent-bright: #b01219;
      --accent-dim: #da1c24;
      --accent-deep: #b01219;
      --accent-hover: #b01219;
      --accent-on: #ffffff;
      --accent-muted: rgba(218,28,36,.06);
      --accent-soft: rgba(218,28,36,.10);
      --accent-glow: rgba(218,28,36,.22);
      --accent-ring: rgba(218,28,36,.14);
      --accent-border: rgba(218,28,36,.28);
      --warn: #da1c24;
      --radius: 8px;
      --shadow: 0 2px 16px rgba(0,0,0,.08);
      --shadow-soft: 0 2px 12px rgba(0,0,0,.06);
      --load-charcoal: #da1c24;
      --load-charcoal-deep: #b01219;
      --load-charcoal-ghost: #e8e8e8;
      --pedido-divider: #e8e8e8;
      font-family: "Inter", "Helvetica Neue", Arial, sans-serif;
    }
    html[data-skin="formigres"] .page-head h1,
    html[data-skin="formigres"] .site-brand-text,
    html[data-skin="formigres"] .acc-title,
    html[data-skin="formigres"] .pedido-head h2 {
      font-family: "Montserrat", "Inter", sans-serif;
      font-weight: 700;
      letter-spacing: -.02em;
    }
    html[data-skin="formigres"] .page-head h1::before {
      content: '';
      display: block;
      width: 50px;
      height: 3px;
      background: var(--accent);
      margin-bottom: .65rem;
    }
    html[data-skin="formigres"] .page-head h1 {
      font-size: clamp(1.35rem, 4vw, 2rem);
      font-weight: 800;
      color: var(--text-strong);
      line-height: 1.15;
    }
    html[data-skin="formigres"] .page-head-hint {
      font-size: .95rem;
      letter-spacing: 0;
      text-transform: none;
      color: var(--muted);
      max-width: 42rem;
    }
    html[data-skin="formigres"] .site-bar {
      background: rgba(255,255,255,.92);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--border);
      border-left: none;
      box-shadow: 0 2px 12px rgba(0,0,0,.04);
    }
    html[data-skin="formigres"] .site-brand-lockup {
      display: inline-flex;
      align-items: center;
      gap: 0;
      text-decoration: none;
      color: inherit;
    }
    html[data-skin="formigres"] .site-logo {
      height: 34px;
      width: auto;
      display: block;
    }
    html[data-skin="formigres"] .site-sub {
      color: var(--muted);
      font-size: .78rem;
      font-weight: 500;
      letter-spacing: .02em;
      text-transform: none;
    }
    html[data-skin="formigres"] .site-stat strong { color: var(--accent); }
    html[data-skin="formigres"] .demo-banner {
      background: #f9e5e6;
      border: 1px solid rgba(218,28,36,.18);
      color: var(--text-strong);
      border-radius: var(--radius);
    }
    html[data-skin="formigres"] .btn-primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    html[data-skin="formigres"] .btn-primary:hover {
      background: var(--accent-bright);
      border-color: var(--accent-bright);
      color: #fff;
    }
    html[data-skin="formigres"] .cart-fab,
    html[data-skin="formigres"] .fab {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
    }
    html[data-skin="formigres"] .cart-fab:hover,
    html[data-skin="formigres"] .fab:hover {
      background: var(--accent-bright);
      border-color: var(--accent-bright);
    }
    html[data-skin="formigres"] .load-overlay { background: rgba(255,255,255,.97); }
    html[data-skin="formigres"] .load-logo-formigres {
      width: min(240px, 72vw);
      margin: 0 auto 18px;
    }
    html[data-skin="formigres"] .load-logo-formigres img {
      width: 100%;
      height: auto;
      display: block;
    }
    html[data-skin="formigres"] .load-square.filled {
      background: var(--accent);
      border-color: var(--accent-deep);
    }
    html[data-skin="formigres"] .load-hint { color: var(--muted); }
    html[data-skin="formigres"] .search:focus,
    html[data-skin="formigres"] #desconto-pct:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-ring);
    }
    html[data-skin="formigres"] .model-row.has-qty {
      box-shadow: inset 3px 0 0 var(--accent);
    }
    html[data-skin="formigres"] .linha-retificada { color: var(--text-strong); }
    html[data-skin="formigres"] .linha-polida { color: var(--accent); }
    html[data-skin="formigres"] .catalog-powered {
      border-top-color: var(--border);
      color: var(--gray-500, #888);
    }
    html[data-skin="formigres"] .catalog-powered strong { color: var(--text-strong); }
    html[data-skin="formigres"] .regime-panel {
      margin-bottom: 12px;
      padding: 12px 14px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }
    html[data-skin="formigres"] .regime-panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
    html[data-skin="formigres"] .regime-switch {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      user-select: none;
      font-size: .78rem;
      font-weight: 600;
      letter-spacing: .04em;
      text-transform: uppercase;
      color: var(--text-strong);
    }
    html[data-skin="formigres"] .regime-switch input {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
    }
    html[data-skin="formigres"] .regime-switch-ui {
      width: 38px;
      height: 22px;
      border-radius: 999px;
      background: var(--border);
      position: relative;
      transition: background .2s ease;
      flex-shrink: 0;
    }
    html[data-skin="formigres"] .regime-switch-ui::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 2px rgba(0,0,0,.18);
      transition: transform .2s ease;
    }
    html[data-skin="formigres"] .regime-switch input:checked + .regime-switch-ui {
      background: var(--accent);
    }
    html[data-skin="formigres"] .regime-switch input:checked + .regime-switch-ui::after {
      transform: translateX(16px);
    }
    html[data-skin="formigres"] .regime-switch input:focus-visible + .regime-switch-ui {
      box-shadow: 0 0 0 3px var(--accent-ring);
    }
    html[data-skin="formigres"] .regime-aliquota-pill {
      font-size: .74rem;
      color: var(--muted);
      white-space: nowrap;
    }
    html[data-skin="formigres"] .regime-aliquota-pill strong {
      color: var(--accent-bright);
      font-size: .92rem;
      font-weight: 700;
    }
    html[data-skin="formigres"] .regime-options {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 12px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--border-subtle);
    }
    html[data-skin="formigres"] .regime-options[hidden] { display: none !important; }
    html[data-skin="formigres"] .regime-field label {
      display: block;
      margin-bottom: 4px;
      font-size: .68rem;
      letter-spacing: .04em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 600;
    }
    html[data-skin="formigres"] .regime-field select {
      width: 100%;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      color: var(--text-strong);
      padding: 9px 10px;
      font-size: .82rem;
    }
    html[data-skin="formigres"] .regime-field select:focus {
      border-color: var(--accent);
      outline: none;
      box-shadow: 0 0 0 3px var(--accent-ring);
    }
    html[data-skin="formigres"] .regime-hint {
      grid-column: 1 / -1;
      margin: 0;
      font-size: .74rem;
      line-height: 1.4;
      color: var(--muted);
      padding: 8px 10px;
      background: var(--surface-2);
      border-radius: var(--radius);
      border-left: 3px solid var(--accent-dim);
    }
    html[data-skin="formigres"] .regime-hint[hidden] { display: none !important; }
    html[data-skin="formigres"] .regime-acumulado {
      grid-column: 1 / -1;
      margin: 0;
      font-size: .74rem;
      line-height: 1.45;
      color: var(--muted);
      padding: 8px 10px;
      background: var(--accent-muted);
      border-radius: var(--radius);
      border: 1px solid var(--border-subtle);
    }
    html[data-skin="formigres"] .regime-acumulado strong { color: var(--text-strong); font-weight: 600; }
    html[data-skin="formigres"] .regime-acumulado .regime-acumulado-total {
      color: var(--accent-bright);
      font-size: .88rem;
    }
    html[data-skin="formigres"] #desconto-pct:disabled {
      opacity: .72;
      cursor: not-allowed;
      background: var(--surface-2);
    }
    @media (max-width: 720px) {
      html[data-skin="formigres"] .regime-panel { padding: 10px 12px; margin-bottom: 8px; }
      html[data-skin="formigres"] .regime-options { grid-template-columns: 1fr; gap: 8px; }
      html[data-skin="formigres"] .regime-switch-label { font-size: .72rem; }
    }
    html[data-skin="formigres"] .pedido-row-title-line {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      max-width: 100%;
    }
    html[data-skin="formigres"] .model-gemeas-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 5px;
      margin: 0;
      border: 2px solid var(--surface);
      border-radius: 999px;
      background: var(--accent);
      color: var(--accent-on);
      font-size: .68rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      line-height: 1;
      letter-spacing: 0;
      cursor: pointer;
      flex-shrink: 0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, .12);
      transition: transform .12s ease, background .12s ease, box-shadow .12s ease;
    }
    html[data-skin="formigres"] .model-gemeas-badge:hover {
      background: var(--accent-bright);
      transform: scale(1.06);
    }
    html[data-skin="formigres"] .model-gemeas-badge[aria-expanded="true"] {
      background: var(--accent-deep);
      box-shadow: 0 0 0 2px var(--accent-ring);
    }
    html[data-skin="formigres"] .model-gemeas-detail.hidden { display: none; }
    html[data-skin="formigres"] .model-gemeas-detail td {
      padding: 0 8px 10px;
      border-bottom: 1px solid var(--border);
      background: var(--surface-2);
    }
    html[data-skin="formigres"] .model-gemeas-wrap {
      margin-left: 52px;
      max-width: 420px;
    }
    html[data-skin="formigres"] .model-gemeas-caption {
      margin: 0 0 6px;
      font-size: .68rem;
      color: var(--muted);
      letter-spacing: .03em;
      text-transform: uppercase;
    }
    html[data-skin="formigres"] .model-gemeas-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: .72rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }
    html[data-skin="formigres"] .model-gemeas-table th,
    html[data-skin="formigres"] .model-gemeas-table td {
      padding: 7px 8px;
      border-bottom: 1px solid var(--border);
      vertical-align: middle;
    }
    html[data-skin="formigres"] .model-gemeas-table tbody tr:last-child td { border-bottom: 0; }
    html[data-skin="formigres"] .model-gemeas-table thead th {
      text-align: left;
      color: var(--muted);
      font-size: .62rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: .04em;
      background: var(--surface-2);
    }
    html[data-skin="formigres"] .model-gemeas-table .gemeas-col-cod {
      text-align: right;
      font-variant-numeric: tabular-nums;
      color: var(--text-strong);
      white-space: nowrap;
    }
    html[data-skin="formigres"] .model-gemeas-table .gemeas-row-current td {
      background: var(--accent-muted);
      font-weight: 600;
    }
    @media (max-width: 720px) {
      html[data-skin="formigres"] .model-gemeas-wrap { margin-left: 0; max-width: none; }
    }
`;

function buildHtml({ classif, itens, antLogoDataUri = '', brandLogoDataUri = '', pdfThumbs = {}, pdfFontCss = '', cfg = CFG }) {
  const gerado = new Date(classif.geradoEm || Date.now()).toLocaleString('pt-BR');
  const total = itens.length;
  const comFoto = itens.filter((i) => i.imagem_url).length;
  const loadSquaresHtml = Array.from({ length: 20 }, () => '<span class="load-square"></span>').join('');
  const isFormigresSkin = cfg.skin === 'formigres';
  const qtyLabel = cfg.qtyLabel || (isFormigresSkin ? 'Paletes' : 'Caixas');
  const qtyLabelPl = cfg.qtyLabelPl || (isFormigresSkin ? 'paletes' : 'caixas');
  const qtyUnit = cfg.qtyUnit || (isFormigresSkin ? 'palete' : 'caixa');
  const pedidoTableColgroup = isFormigresSkin
    ? '<colgroup><col class="col-foto"><col class="col-modelo"><col class="col-qty"><col class="col-m2"><col class="col-cx"><col class="col-peso"><col class="col-emb"><col class="col-preco"><col class="col-sub"></colgroup>'
    : '<colgroup><col class="col-foto"><col class="col-modelo"><col class="col-qty"><col class="col-m2u"><col class="col-m2"><col class="col-preco"><col class="col-sub"></colgroup>';
  const pedidoTableHead = isFormigresSkin
    ? '<th class="pedido-col-foto">Foto</th><th class="pedido-col-modelo">Modelo</th><th class="pedido-col-qty">Paletes</th><th class="pedido-col-num">m² total</th><th class="pedido-col-num">Caixas</th><th class="pedido-col-num">Peso</th><th class="pedido-col-emb">Por palete</th><th class="pedido-col-num">Preço/m²</th><th class="pedido-col-num col-subtotal">Subtotal</th>'
    : '<th class="pedido-col-foto">Foto</th><th class="pedido-col-modelo">Modelo</th><th class="pedido-col-qty">Caixas</th><th class="pedido-col-num">m²/cx</th><th class="pedido-col-num">m² total</th><th class="pedido-col-num">Preço/m²</th><th class="pedido-col-num col-subtotal">Subtotal</th>';
  const catalogoJson = JSON.stringify({
    itens: itens.map(slimItem),
    config: {
      linhaOrder: LINHA_ORDER,
      linhaLabel: LINHA_LABEL,
      tipoOrder: TIPO_ORDER,
      tipoLabel: TIPO_LABEL,
      acabOrder: ACAB_ORDER,
      qtyUnit,
      qtyLabel,
      qtyLabelPl,
    },
  }).replace(/</g, '\\u003c');
  const pdfThumbsJson = JSON.stringify(pdfThumbs).replace(/</g, '\\u003c');
  const pdfFontCssSafe = String(pdfFontCss).replace(/<\/style/gi, '<\\/style');

  const headerLogo = brandLogoDataUri || antLogoDataUri;
  const loaderHtml = isFormigresSkin
    ? `<div class="load-logo-formigres" aria-hidden="true"><img src="${headerLogo}" alt="" width="240" height="41" /></div>`
    : `<div class="load-logo-ant" aria-hidden="true">
        <img class="load-ant-ghost" src="${antLogoDataUri || ''}" alt="" width="200" height="120" />
        <div class="load-ant-fill-wrap" id="load-ant-fill-wrap">
          <img src="${antLogoDataUri || ''}" alt="" width="200" height="120" />
        </div>
        <span class="load-pct" id="load-pct" aria-hidden="true">0%</span>
      </div>`;
  const siteBrandHtml = isFormigresSkin
    ? `<a class="site-brand-lockup" href="https://www.formigres.com.br/" target="_blank" rel="noopener noreferrer" aria-label="Formigres — site oficial">
        <img class="site-logo" src="${headerLogo}" alt="Formigres" width="148" height="25" />
      </a>`
    : `<span class="site-brand">Formigres</span>`;
  const themeToggleHtml = cfg.hideThemeToggle ? '' : `<button type="button" class="theme-fab" id="theme-toggle" aria-label="Mudar para tema escuro" title="Tema">
    <svg id="theme-icon-sun" hidden xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
    </svg>
    <svg id="theme-icon-moon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
    </svg>
  </button>`;
  const regimePanelHtml = isFormigresSkin
    ? `<section class="regime-panel" id="regime-panel" aria-label="Regime especial Suframa">
      <div class="regime-panel-head">
        <label class="regime-switch">
          <input type="checkbox" id="regime-especial-enabled" />
          <span class="regime-switch-ui" aria-hidden="true"></span>
          <span class="regime-switch-label">Regime especial</span>
        </label>
        <span class="regime-aliquota-pill" id="regime-aliquota-pill" hidden>
          Incentivo <strong id="regime-aliquota-val">0%</strong>
        </span>
      </div>
      <div class="regime-options" id="regime-options" hidden>
        <div class="regime-field">
          <label for="regime-destino">Destino</label>
          <select id="regime-destino">
            <option value="zfm">ZFM (Manaus e entorno)</option>
            <option value="alc">ALC (cidades de fronteira)</option>
            <option value="amoc">Amazônia Ocidental</option>
          </select>
        </div>
        <div class="regime-field">
          <label for="regime-tributario">Regime do comprador</label>
          <select id="regime-tributario">
            <option value="lucro_presumido">Lucro presumido / Simples</option>
            <option value="lucro_real">Lucro real</option>
          </select>
        </div>
        <p class="regime-acumulado" id="regime-acumulado-note" hidden>
          Desconto comercial <strong id="regime-comercial-val">0%</strong>
          + incentivo <strong id="regime-incentivo-val">0%</strong>
          sobre o valor já descontado → acumulado
          <strong class="regime-acumulado-total" id="regime-acumulado-val">0%</strong>
        </p>
        <p class="regime-hint" id="regime-hint-amoc" hidden>
          Para produtos cerâmicos (NCM 6907), o benefício da Amazônia Ocidental aplica-se ao IPI.
          Como este produto já possui alíquota zero de IPI na tabela nacional, o preço não sofre alterações.
        </p>
      </div>
    </section>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR" data-theme="light" data-skin="${escTpl(cfg.skin || 'default')}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escTpl(cfg.title)}</title>
  <script>
    (function(){try{var t=localStorage.getItem('${cfg.themeKey}');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light');}catch(e){}})();
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${escTpl(cfg.fontsUrl || 'https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700&display=swap')}" rel="stylesheet" />
  <style id="pdf-font-face-embedded">${pdfFontCssSafe}</style>
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
      --pedido-divider: rgba(255,255,255,.12);
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
      --pedido-divider: #d5d5d5;
    }
    html[data-theme="light"] .load-overlay { background: rgba(242,242,240,.97); }
    ${isFormigresSkin ? FORMIGRES_SKIN_CSS : ''}
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
    .load-hint {
      margin: 14px 0 0;
      font-size: .78rem;
      color: var(--load-charcoal-muted);
      line-height: 1.35;
      min-height: 1.35em;
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
    .col-pack { min-width: 120px; max-width: 180px; color: var(--muted); font-size: .72rem; line-height: 1.35; white-space: nowrap; }
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
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px 14px;
      margin-bottom: 14px;
    }
    .pedido-resumo .stat {
      min-width: 0;
      padding: 0;
      background: none;
      border: none;
      border-radius: 0;
      font-size: .72rem;
      color: var(--muted);
      line-height: 1.25;
    }
    .pedido-resumo .stat strong {
      display: block;
      font-size: .95rem;
      color: var(--text-strong);
      font-weight: 600;
      margin-bottom: 1px;
    }
    .pedido-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .pedido-table,
    html[data-skin="formigres"] .catalog-pedido-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: .84rem;
    }
    html[data-skin="formigres"] .catalog-pedido-table {
      background: var(--surface);
      border: 0;
      border-radius: 0;
      overflow: visible;
    }
    .pedido-table th,
    .pedido-table td,
    html[data-skin="formigres"] .catalog-pedido-table th,
    html[data-skin="formigres"] .catalog-pedido-table td {
      padding: 10px 8px;
      border-bottom: 1px solid var(--border);
      vertical-align: middle;
    }
    html[data-skin="formigres"] .catalog-pedido-table tbody tr:hover {
      background: var(--accent-muted);
    }
    .pedido-table thead th,
    html[data-skin="formigres"] .catalog-pedido-table thead th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: var(--surface);
      padding-top: 8px;
      padding-bottom: 8px;
      text-align: left;
      color: var(--muted);
      font-size: .68rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: .04em;
      border-bottom: 1px solid var(--border-subtle);
      white-space: nowrap;
    }
    .pedido-table col.col-foto,
    html[data-skin="formigres"] .catalog-pedido-table col.col-foto { width: 52px; }
    .pedido-table col.col-modelo,
    html[data-skin="formigres"] .catalog-pedido-table col.col-modelo { width: 28%; }
    .pedido-table col.col-qty,
    html[data-skin="formigres"] .catalog-pedido-table col.col-qty { width: 68px; }
    .pedido-table col.col-m2,
    .pedido-table col.col-m2u,
    html[data-skin="formigres"] .catalog-pedido-table col.col-m2,
    html[data-skin="formigres"] .catalog-pedido-table col.col-m2u { width: 82px; }
    .pedido-table col.col-cx,
    html[data-skin="formigres"] .catalog-pedido-table col.col-cx { width: 68px; }
    .pedido-table col.col-peso,
    html[data-skin="formigres"] .catalog-pedido-table col.col-peso { width: 92px; }
    .pedido-table col.col-emb,
    html[data-skin="formigres"] .catalog-pedido-table col.col-emb { width: 128px; }
    .pedido-table col.col-preco,
    html[data-skin="formigres"] .catalog-pedido-table col.col-preco { width: 84px; }
    .pedido-table col.col-sub,
    html[data-skin="formigres"] .catalog-pedido-table col.col-sub { width: 98px; }
    html[data-skin="formigres"] .pedido-table,
    html[data-skin="formigres"] .catalog-pedido-table { min-width: 860px; }
    .pedido-col-foto { width: 52px; padding-left: 0; padding-right: 6px; }
    .pedido-col-modelo { min-width: 0; }
    .pedido-row-title {
      display: block;
      font-weight: 600;
      line-height: 1.25;
      color: var(--text-strong);
    }
    .pedido-row-meta {
      margin-top: 2px;
      font-size: .72rem;
      color: var(--muted);
      line-height: 1.3;
    }
    .pedido-col-emb {
      font-size: .72rem;
      color: var(--muted);
      line-height: 1.35;
    }
    .pedido-col-num,
    .pedido-table th.pedido-col-num,
    .pedido-table .col-subtotal,
    html[data-skin="formigres"] .catalog-pedido-table .pedido-col-num,
    html[data-skin="formigres"] .catalog-pedido-table th.pedido-col-num,
    html[data-skin="formigres"] .catalog-pedido-table .col-subtotal {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .pedido-col-qty,
    .pedido-table th.pedido-col-qty,
    html[data-skin="formigres"] .catalog-pedido-table .pedido-col-qty,
    html[data-skin="formigres"] .catalog-pedido-table th.pedido-col-qty {
      text-align: center;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }
    .pedido-table tbody .pedido-col-qty,
    html[data-skin="formigres"] .catalog-pedido-table tbody .pedido-col-qty { font-weight: 700; color: var(--text-strong); }
    html[data-skin="formigres"] .catalog-pedido-table tbody .pedido-col-qty.col-qty { font-weight: 400; }
    .pedido-table .col-subtotal,
    html[data-skin="formigres"] .catalog-pedido-table .col-subtotal {
      font-weight: 700;
      color: var(--accent-bright);
      white-space: nowrap;
    }
    html[data-skin="formigres"] .catalog-pedido-table .model-col-m2,
    html[data-skin="formigres"] .catalog-pedido-table .model-col-cx,
    html[data-skin="formigres"] .catalog-pedido-table .model-col-peso,
    html[data-skin="formigres"] .catalog-pedido-table .model-col-sub {
      color: var(--text-strong);
    }
    html[data-skin="formigres"] .catalog-pedido-table .model-col-sub:empty {
      color: transparent;
    }
    .pedido-table .pedido-col-peso,
    html[data-skin="formigres"] .catalog-pedido-table .pedido-col-peso { font-weight: 500; white-space: nowrap; color: var(--text-strong); }
    .pedido-table .pedido-col-preco,
    html[data-skin="formigres"] .catalog-pedido-table .pedido-col-preco { font-size: .8rem; }
    .pedido-table .pedido-col-foto img,
    html[data-skin="formigres"] .catalog-pedido-table .pedido-col-foto img,
    html[data-skin="formigres"] .catalog-pedido-table .pedido-col-foto .thumb-btn,
    html[data-skin="formigres"] .catalog-pedido-table .pedido-col-foto .thumb-empty { display: block; border-radius: 6px; }
    .pedido-row-hint { color: var(--muted); font-size: .68rem; }
    .pedido-cards-wrap { display: none; }
    .pedido-cards { display: flex; flex-direction: column; }
    .pedido-card {
      padding: 14px 0;
      border-bottom: 1px solid var(--pedido-divider);
    }
    .pedido-card:last-child { border-bottom: 0; }
    .pedido-card-titlebar { min-width: 0; }
    .pedido-card-title {
      font-size: .82rem;
      font-weight: 700;
      line-height: 1.15;
      color: var(--text-strong);
    }
    .pedido-card-meta {
      margin-top: 2px;
      font-size: .72rem;
      color: var(--muted);
      line-height: 1.3;
    }
    .pedido-card-layout {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0;
    }
    .pedido-card-head {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      column-gap: 10px;
      align-items: start;
    }
    .pedido-card-head-main {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      column-gap: 8px;
      align-items: start;
      min-width: 0;
    }
    .pedido-card-desc { min-width: 0; }
    .pedido-card-hero {
      font-size: .82rem;
      font-weight: 700;
      line-height: 1.15;
      font-variant-numeric: tabular-nums;
      color: var(--text-strong);
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
    .pedido-card-qty {
      justify-self: center;
      align-self: start;
      min-width: 0;
      text-align: center;
      padding: 0 2px;
    }
    .pedido-card-qty-main {
      display: block;
      font-size: inherit;
      font-weight: inherit;
      color: inherit;
      line-height: inherit;
    }
    .pedido-card-qty-main span {
      font-size: inherit;
      font-weight: inherit;
      color: inherit;
    }
    .pedido-card-qty-sub {
      display: block;
      margin-top: 3px;
      font-size: .78rem;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
      line-height: 1.2;
    }
    .pedido-card-total {
      justify-self: end;
      align-self: start;
      text-align: right;
      min-width: 0;
      width: 100%;
    }
    .pedido-card-total-label {
      display: block;
      font-size: .58rem;
      text-transform: uppercase;
      letter-spacing: .05em;
      color: var(--muted);
      margin-top: 3px;
      line-height: 1.2;
    }
    .pedido-card-total .pedido-card-hero {
      display: block;
      white-space: nowrap;
      color: var(--accent-bright);
    }
    .pedido-card-spec {
      width: 100%;
      box-sizing: border-box;
      border-collapse: collapse;
      margin-top: 0;
      padding-top: 12px;
      border-top: 1px solid var(--border-subtle);
      table-layout: fixed;
    }
    .pedido-card-spec td {
      padding: 8px 6px;
      vertical-align: top;
      text-align: left;
      border: 0;
    }
    .pedido-card-spec td:first-child { padding-left: 0; }
    .pedido-card-spec td:last-child { padding-right: 0; }
    .pedido-card-spec td + td {
      border-left: 1px solid var(--border-subtle);
    }
    .pedido-card-spec-l {
      display: block;
      font-size: .62rem;
      font-weight: 500;
      color: var(--muted);
      margin-bottom: 3px;
      line-height: 1.25;
    }
    .pedido-card-spec-v {
      display: block;
      font-size: .62rem;
      font-weight: 500;
      color: var(--text-strong);
      font-variant-numeric: tabular-nums;
      line-height: 1.25;
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid var(--border-subtle);
    }
    .pedido-card-spec-v.pedido-card-spec-preco .preco-orig {
      display: block;
      font-size: .58rem;
      font-weight: 400;
      text-decoration: line-through;
      color: var(--muted);
      line-height: 1.2;
    }
    .pedido-card-spec-v.pedido-card-spec-preco .preco-desc { font-weight: 500; font-size: .62rem; }
    .pedido-card-spec-v.pedido-card-spec-preco:not(.has-desc) { font-size: .62rem; font-weight: 500; }
    .pedido-card-spec-v.pedido-card-spec-palete {
      font-size: .62rem;
      font-weight: 500;
      color: var(--text-strong);
      line-height: 1.25;
    }
    .pedido-total {
      margin-top: 12px; padding-top: 12px; border-top: 0.5px solid color-mix(in srgb, var(--accent-border) 55%, transparent);
      display: flex; justify-content: flex-end; gap: 24px; font-size: 1rem;
    }
    .pedido-total strong { color: var(--accent-bright); font-size: 1.15rem; font-weight: 600; }
    .pedido-peso-note {
      margin: 4px 0 0;
      font-size: .82rem;
      color: var(--muted);
      text-align: right;
    }
    .pedido-peso-note strong {
      color: var(--text-strong);
      font-weight: 600;
    }
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
    #pedido-pdf-render-host {
      position: fixed;
      left: -12000px;
      top: 0;
      z-index: -1;
      pointer-events: none;
      overflow: visible;
      visibility: hidden;
    }
    .pedido-pdf-sheet {
      position: fixed;
      inset: 0;
      z-index: 55;
      display: none;
      align-items: flex-end;
      justify-content: center;
      background: rgba(8,7,10,.72);
      padding: 0;
    }
    .pedido-pdf-sheet.open { display: flex; }
    .pedido-pdf-sheet-panel {
      width: 100%;
      max-width: 420px;
      background: var(--surface);
      border-top: 1px solid var(--accent-border);
      border-radius: var(--radius) var(--radius) 0 0;
      padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
      box-shadow: var(--shadow);
    }
    .pedido-pdf-sheet-panel::before {
      content: "";
      display: block;
      width: 40px; height: 4px;
      background: var(--border);
      border-radius: var(--radius);
      margin: 0 auto 14px;
      opacity: .55;
    }
    .pedido-pdf-sheet-panel h3 {
      margin: 0 0 6px;
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-strong);
    }
    .pedido-pdf-sheet-panel p {
      margin: 0 0 14px;
      font-size: .82rem;
      color: var(--muted);
      line-height: 1.4;
    }
    .pedido-pdf-sheet-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .pedido-pdf-sheet-actions .btn { width: 100%; padding: 12px; border-radius: var(--radius); }
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
    .catalog-powered {
      margin-top: 28px;
      padding: 16px 0 calc(72px + env(safe-area-inset-bottom));
      text-align: center;
      font-size: .72rem;
      color: var(--muted);
      letter-spacing: .02em;
      border-top: 1px solid var(--border-subtle);
    }
    .catalog-powered strong {
      color: var(--text);
      font-weight: 600;
    }
    .demo-banner {
      margin: 0 0 12px;
      padding: 10px 14px;
      border-radius: var(--radius);
      background: rgba(196, 30, 58, .08);
      border: 1px solid rgba(196, 30, 58, .18);
      color: var(--text);
      font-size: .78rem;
      line-height: 1.45;
    }
    html[data-theme="dark"] .demo-banner {
      background: rgba(196, 30, 58, .12);
      border-color: rgba(196, 30, 58, .28);
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
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px 10px;
        margin-bottom: 10px;
      }
      .pedido-resumo .stat strong { font-size: .88rem; }
      .pedido-table-wrap { display: none !important; }
      .pedido-cards-wrap { display: block; }
      .pedido-card-head { column-gap: 8px; }
      .pedido-card-head-main { column-gap: 8px; }
      .pedido-card-hero { font-size: .82rem; font-weight: 700; line-height: 1.15; }
      .pedido-card-title.pedido-card-hero,
      .pedido-card-qty-main.pedido-card-hero,
      .pedido-card-total .pedido-card-hero { font-size: .82rem; }
      .pedido-card-spec-l,
      .pedido-card-spec-v,
      .pedido-card-spec-v.pedido-card-spec-preco:not(.has-desc),
      .pedido-card-spec-v.pedido-card-spec-palete { font-size: .58rem; line-height: 1.25; }
      .pedido-card-thumb { width: 48px; height: 48px; }
      .pedido-total {
        margin-top: 10px;
        padding: 10px 0 12px;
        border-top: 1px solid var(--pedido-divider);
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
      .col-pack, .col-preco,
      .model-table:not(.catalog-pedido-table) thead th:nth-child(3),
      .model-table:not(.catalog-pedido-table) thead th:nth-child(4) { display: none; }
      html[data-skin="formigres"] .catalog-pedido-table {
        min-width: 860px;
        font-size: .78rem;
      }
      html[data-skin="formigres"] .catalog-pedido-table td,
      html[data-skin="formigres"] .catalog-pedido-table th { padding: 8px 6px; }
      .model-table:not(.catalog-pedido-table) { font-size: .78rem; }
      .model-table td, .model-table th { padding: 8px 6px; }
      .col-foto { width: 44px; }
      .col-modelo { min-width: 0; max-width: 1px; }
      .col-modelo strong { font-size: .82rem; line-height: 1.25; }
      .col-modelo small { font-size: .7rem; }
      .thumb-btn, .thumb-empty { width: 40px; height: 40px; }
      .col-qty, .model-table:not(.catalog-pedido-table) thead th:nth-child(5) {
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
      .model-table:not(.catalog-pedido-table) thead th:nth-child(5) { background: var(--surface-2); z-index: 2; }
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
      .col-qty, .model-table:not(.catalog-pedido-table) thead th:nth-child(5) { width: 54px; min-width: 54px; }
      .col-qty .qty-input { width: 44px; min-height: 38px; }
      .lightbox-head h3 { font-size: .88rem; }
      .lightbox-stage { min-height: 220px; }
      .lightbox-stage img { max-height: 58vh; }
    }
  </style>
</head>
<body class="is-loading">
  <script>
    (function () {
      function forceReveal() {
        if (window.__tintaoBootDone) return;
        window.__tintaoBootDone = 1;
        document.body.classList.remove('is-loading');
        var shell = document.getElementById('app-shell');
        if (shell) shell.removeAttribute('aria-hidden');
        var overlay = document.getElementById('load-overlay');
        if (overlay) {
          overlay.setAttribute('aria-hidden', 'true');
          overlay.setAttribute('aria-busy', 'false');
        }
      }
      window.__tintaoForceReveal = forceReveal;
      setTimeout(forceReveal, 2800);
    })();
  </script>
  <div class="load-overlay" id="load-overlay" role="status" aria-live="polite" aria-busy="true">
    <div class="load-panel">
      ${loaderHtml}
      <div class="load-squares" id="load-squares" aria-hidden="true">${loadSquaresHtml}</div>
      <p class="load-hint" id="load-msg" aria-live="polite">${isFormigresSkin ? 'A carregar catálogo…' : 'A abrir catálogo…'}</p>
    </div>
  </div>

  <div id="app-shell" class="app-shell" aria-hidden="true">
  <header class="site-bar">
    <div class="site-bar-inner">
      ${siteBrandHtml}
      <span class="site-divider" aria-hidden="true"></span>
      <span class="site-sub">${escTpl(cfg.siteSub || 'Pedido B2B · Lojistas')}</span>
      <span class="site-bar-spacer" aria-hidden="true"></span>
      <div class="site-desconto">
        <label for="desconto-pct">${isFormigresSkin ? 'Desc. comercial' : 'Desconto'}</label>
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
      <h1>${escTpl(cfg.h1)}</h1>
      <p class="page-head-hint">${escTpl(cfg.hint)}</p>
    </div>
    ${cfg.demoBanner ? `<p class="demo-banner" role="note">${escTpl(cfg.demoBanner)}</p>` : ''}
    ${regimePanelHtml}

    <div class="toolbar">
      <div class="toolbar-main">
        <input id="search" class="search" type="search" placeholder="Código, modelo ou formato…" />
        <button type="button" class="btn btn-icon toolbar-mobile-only" id="toolbar-more" aria-label="Mais opções">⋯</button>
      </div>
      <div class="toolbar-extra toolbar-mobile-only" id="toolbar-extra" hidden>
        <select id="group-by" class="select-group" title="Agrupar">
          <option value="formato-acabamento" selected>Formato › acabamento</option>
          <option value="acabamento-formato">Acabamento › formato</option>
        </select>
        <button type="button" class="btn btn-primary" id="start-qty">${escTpl(qtyLabel)}</button>
        <button type="button" class="btn" id="filter-qty">Na seleção</button>
        <button type="button" class="btn" id="clear-qty">Limpar</button>
        <button type="button" class="btn" id="expand-all">Abrir</button>
        <button type="button" class="btn" id="collapse-all">Fechar</button>
      </div>
      <div class="toolbar-extra toolbar-desktop-only">
        <select id="group-by-desktop" class="select-group">
          <option value="formato-acabamento" selected>Agrupar: formato › acabamento</option>
          <option value="acabamento-formato">Agrupar: acabamento › formato</option>
        </select>
        <button type="button" class="btn" id="filter-qty-d">Só na seleção</button>
        <button type="button" class="btn" id="clear-qty-d">Limpar seleção</button>
        <button type="button" class="btn btn-primary" id="start-qty-d">Preencher ${escTpl(qtyLabelPl)}</button>
        <button type="button" class="btn" id="expand-all-d">Abrir tudo</button>
        <button type="button" class="btn" id="collapse-all-d">Fechar tudo</button>
      </div>
    </div>

    <section class="catalogo" id="catalogo"></section>
    <footer class="catalog-powered" aria-label="Créditos">
      Powered by <strong>P38 sistemas</strong>
    </footer>
  </div>

  ${themeToggleHtml}

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
          <p style="margin:4px 0 0;font-size:.78rem;color:var(--muted)">Revise ${escTpl(qtyLabelPl)}, m²${isFormigresSkin ? ', peso' : ''} e total antes de exportar</p>
        </div>
        <button type="button" class="pedido-close" id="pedido-close" aria-label="Fechar">×</button>
      </div>
      <div class="pedido-scroll" id="pedido-scroll">
      <div class="pedido-resumo" id="pedido-resumo"></div>
      <div class="pedido-empty hidden" id="pedido-empty">Nenhum modelo na seleção — marque ${escTpl(qtyLabelPl)} na tabela.</div>
      <div class="pedido-list-wrap hidden" id="pedido-list-wrap">
        <div class="table-wrap pedido-table-wrap" id="pedido-table-wrap">
          <table class="pedido-table" id="pedido-table">
            ${pedidoTableColgroup}
            <thead>
              <tr>
                ${pedidoTableHead}
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

  <div id="pedido-pdf-render-host" aria-hidden="true"></div>

  <div class="pedido-pdf-sheet" id="pedido-pdf-sheet" role="dialog" aria-modal="true" aria-label="PDF do pedido">
    <div class="pedido-pdf-sheet-panel">
      <h3>PDF pronto</h3>
      <p>O ficheiro deve baixar sozinho. Se não baixar, toque no botão abaixo.</p>
      <div class="pedido-pdf-sheet-actions">
        <button type="button" class="btn btn-primary" id="pedido-pdf-download">Baixar PDF</button>
        <button type="button" class="btn" id="pedido-pdf-close">Fechar</button>
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

  <script id="pdf-thumbs-data" type="application/json">${pdfThumbsJson}</script>
  <script id="catalogo-data" type="application/json">${catalogoJson}</script>
  <script>
    let CATALOGO;
    let CFG;
    let itemsByCode;
    let TOTAL_MODELOS = 0;
    try {
      CATALOGO = JSON.parse(document.getElementById('catalogo-data').textContent);
      CFG = CATALOGO.config;
      itemsByCode = new Map(CATALOGO.itens.map((i) => [String(i.codigo_tintao), i]));
      TOTAL_MODELOS = CATALOGO.itens.length;
    } catch (bootParseErr) {
      console.error(bootParseErr);
      CATALOGO = { itens: [], config: { linhaOrder: [], linhaLabel: {}, tipoOrder: {}, tipoLabel: {}, acabOrder: [] } };
      CFG = CATALOGO.config;
      itemsByCode = new Map();
    }
    const PDF_TITLE = '${escTpl(cfg.h1)}';
    const CATALOG_SKIN = '${escTpl(cfg.skin || 'default')}';
    const QTY_UNIT = CFG.qtyUnit || 'caixa';
    const QTY_LABEL = CFG.qtyLabel || 'Caixas';
    const QTY_LABEL_PL = CFG.qtyLabelPl || 'caixas';
    const TIPO_LABEL_GAL = { principal: 'Cerâmica', ambiente: 'Ambiente', piso: 'Piso', face: 'Face', outro: 'Imagem' };
    const QTY_KEY = '${cfg.qtyKey}';
    const THEME_KEY = '${cfg.themeKey}';
    const DESCONTO_KEY = '${cfg.descontoKey}';
    const REGIME_KEY = '${cfg.regimeKey || ''}';
    const IS_FORMIGRES = ${isFormigresSkin};
    const GROUP_KEY = '${cfg.groupKey}';
    const PEDIDO_TABLE_COLGROUP_HTML = ${JSON.stringify(pedidoTableColgroup)};
    const PEDIDO_TABLE_HEAD_HTML = ${JSON.stringify(pedidoTableHead)};
    const CATALOG_TABLE_COLGROUP_HTML = PEDIDO_TABLE_COLGROUP_HTML;
    const CATALOG_TABLE_HEAD_HTML = PEDIDO_TABLE_HEAD_HTML;
    let qtyMap = {};
    try { qtyMap = JSON.parse(localStorage.getItem(QTY_KEY) || '{}'); } catch { qtyMap = {}; }
    let descontoComercialPct = 0;
    try {
      const d = Number(localStorage.getItem(DESCONTO_KEY));
      if (Number.isFinite(d) && d >= 0 && d <= 100) descontoComercialPct = d;
    } catch { descontoComercialPct = 0; }
    const REGIME_DESCONTO = {
      zfm: { lucro_presumido: 16.25, lucro_real: 16.25 },
      alc: { lucro_presumido: 16.25, lucro_real: 7 },
      amoc: { lucro_presumido: 0, lucro_real: 0 },
    };
    const REGIME_DESTINO_LABEL = {
      zfm: 'ZFM',
      alc: 'ALC',
      amoc: 'Amazônia Ocidental',
    };
    const REGIME_TRIBUTARIO_LABEL = {
      lucro_presumido: 'Lucro presumido/Simples',
      lucro_real: 'Lucro real',
    };
    let regimeState = { enabled: false, destino: 'zfm', tributario: 'lucro_presumido' };
    function loadRegimeState() {
      if (!IS_FORMIGRES || !REGIME_KEY) return;
      try {
        const raw = JSON.parse(localStorage.getItem(REGIME_KEY) || '{}');
        if (typeof raw.enabled === 'boolean') regimeState.enabled = raw.enabled;
        if (raw.destino === 'zfm' || raw.destino === 'alc' || raw.destino === 'amoc') regimeState.destino = raw.destino;
        if (raw.tributario === 'lucro_presumido' || raw.tributario === 'lucro_real') regimeState.tributario = raw.tributario;
      } catch { /* ignore */ }
    }
    function saveRegimeState() {
      if (!IS_FORMIGRES || !REGIME_KEY) return;
      localStorage.setItem(REGIME_KEY, JSON.stringify(regimeState));
    }
    function calcRegimeDescontoPct() {
      const dest = REGIME_DESCONTO[regimeState.destino];
      if (!dest) return 0;
      return dest[regimeState.tributario] ?? 0;
    }
    function descontoIncentivoPct() {
      return regimeState.enabled ? calcRegimeDescontoPct() : 0;
    }
    function descontoAcumuladoPct() {
      const com = descontoComercialPct / 100;
      const inc = descontoIncentivoPct() / 100;
      if (!com && !inc) return 0;
      return Math.round((1 - (1 - com) * (1 - inc)) * 10000) / 100;
    }
    function hasDescontoAtivo() {
      return descontoComercialPct > 0 || descontoIncentivoPct() > 0;
    }
    function descontoNoteText() {
      if (!hasDescontoAtivo()) return '';
      const com = descontoComercialPct;
      const inc = descontoIncentivoPct();
      const acum = descontoAcumuladoPct();
      if (com > 0 && inc > 0) {
        const dest = REGIME_DESTINO_LABEL[regimeState.destino] || regimeState.destino;
        const trib = REGIME_TRIBUTARIO_LABEL[regimeState.tributario] || regimeState.tributario;
        return 'Desconto comercial ' + com + '% + incentivo Suframa (' + dest + ' · ' + trib + ') ' + inc + '% sobre valor já descontado (acumulado ' + acum + '%)';
      }
      if (inc > 0) {
        const dest = REGIME_DESTINO_LABEL[regimeState.destino] || regimeState.destino;
        const trib = REGIME_TRIBUTARIO_LABEL[regimeState.tributario] || regimeState.tributario;
        return 'Incentivo Suframa (' + dest + ' · ' + trib + '): ' + inc + '%';
      }
      return 'Desconto comercial: ' + com + '%';
    }
    function syncDescontoInputUi() {
      const inp = document.getElementById('desconto-pct');
      if (!inp) return;
      if (document.activeElement !== inp) inp.value = descontoComercialPct ? String(descontoComercialPct) : '';
    }
    function syncRegimePanelUi() {
      if (!IS_FORMIGRES) return;
      const enabledEl = document.getElementById('regime-especial-enabled');
      const optionsEl = document.getElementById('regime-options');
      const destinoEl = document.getElementById('regime-destino');
      const tributarioEl = document.getElementById('regime-tributario');
      const pillEl = document.getElementById('regime-aliquota-pill');
      const valEl = document.getElementById('regime-aliquota-val');
      const hintEl = document.getElementById('regime-hint-amoc');
      const acumNoteEl = document.getElementById('regime-acumulado-note');
      const comValEl = document.getElementById('regime-comercial-val');
      const incValEl = document.getElementById('regime-incentivo-val');
      const acumValEl = document.getElementById('regime-acumulado-val');
      const incentivo = descontoIncentivoPct();
      if (enabledEl) enabledEl.checked = regimeState.enabled;
      if (destinoEl) destinoEl.value = regimeState.destino;
      if (tributarioEl) tributarioEl.value = regimeState.tributario;
      if (optionsEl) optionsEl.hidden = !regimeState.enabled;
      if (pillEl) pillEl.hidden = !regimeState.enabled || !incentivo;
      if (valEl) valEl.textContent = fmtDecimal(incentivo, 2) + '%';
      if (hintEl) hintEl.hidden = !(regimeState.enabled && regimeState.destino === 'amoc');
      const showAcum = regimeState.enabled && descontoComercialPct > 0 && incentivo > 0;
      if (acumNoteEl) acumNoteEl.hidden = !showAcum;
      if (comValEl) comValEl.textContent = fmtDecimal(descontoComercialPct, 2) + '%';
      if (incValEl) incValEl.textContent = fmtDecimal(incentivo, 2) + '%';
      if (acumValEl) acumValEl.textContent = fmtDecimal(descontoAcumuladoPct(), 2) + '%';
    }
    function refreshDescontoUi() {
      syncDescontoInputUi();
      syncRegimePanelUi();
    }
    function commitRegimeChange() {
      saveRegimeState();
      refreshDescontoUi();
      renderCatalogo();
      renderPedido();
    }
    function initRegimeControls() {
      if (!IS_FORMIGRES) return;
      loadRegimeState();
      refreshDescontoUi();
      const enabledEl = document.getElementById('regime-especial-enabled');
      const destinoEl = document.getElementById('regime-destino');
      const tributarioEl = document.getElementById('regime-tributario');
      enabledEl?.addEventListener('change', () => {
        regimeState.enabled = !!enabledEl.checked;
        commitRegimeChange();
      });
      destinoEl?.addEventListener('change', () => {
        regimeState.destino = destinoEl.value === 'alc' || destinoEl.value === 'amoc' ? destinoEl.value : 'zfm';
        commitRegimeChange();
      });
      tributarioEl?.addEventListener('change', () => {
        regimeState.tributario = tributarioEl.value === 'lucro_real' ? 'lucro_real' : 'lucro_presumido';
        commitRegimeChange();
      });
    }
    let groupBy = 'formato-acabamento';
    try {
      const savedGroup = localStorage.getItem(GROUP_KEY);
      groupBy = normalizeGroupBy(savedGroup);
    } catch { /* ignore */ }
    function normalizeGroupBy(val) {
      if (val === 'formato-acabamento' || val === 'acabamento-formato') return val;
      if (val === 'acabamento') return 'acabamento-formato';
      return 'formato-acabamento';
    }
    let filterQtyOnly = false;
    let pedidoOpen = false;
    let pedidoPdfSheetOpen = false;
    let dom = {};

    function esc(s) {
      return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    const PDF_THEME = 'light';
    function getPdfFontFaceCss() {
      const el = document.getElementById('pdf-font-face-embedded');
      return (el && el.textContent) || '';
    }
    let pdfThumbsCache = null;
    function loadPdfThumbs() {
      if (pdfThumbsCache) return pdfThumbsCache;
      try {
        const el = document.getElementById('pdf-thumbs-data');
        if (el && el.textContent) pdfThumbsCache = JSON.parse(el.textContent);
      } catch { /* ignore */ }
      if (!pdfThumbsCache) pdfThumbsCache = {};
      return pdfThumbsCache;
    }
    function pdfImgSrc(url, thumbs, item) {
      if (!url && item?.imagem_url) url = item.imagem_url;
      if (!url) return '';
      if (thumbs?.[url]) return thumbs[url];
      if (item?.imagem_url && thumbs?.[item.imagem_url]) return thumbs[item.imagem_url];
      return url;
    }
    function isPdfDataUri(src) {
      return typeof src === 'string' && src.startsWith('data:image/');
    }
    function pdfImgSrcForPrint(url, thumbs, item) {
      const src = pdfImgSrc(url, thumbs, item);
      return isPdfDataUri(src) ? src : '';
    }
    const PDF_THUMB_PX = 112;
    const PDF_PRINT_THUMB_PX = 68;
    const PDF_CANVAS_SCALE = 3;
    function pedidoPdfImageUrls() {
      const urls = new Set();
      for (const { item } of pedidoItens()) {
        const imgs = getGaleria(item);
        const url = imgs[0]?.url || item.imagem_url;
        if (url) urls.add(url);
      }
      return [...urls];
    }
    function rasterizePdfThumb(img, size) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      try {
        return canvas.toDataURL('image/jpeg', 0.82);
      } catch {
        return '';
      }
    }
    async function loadPdfThumbFromUrlAsync(url) {
      if (!url) return '';
      const viaImage = () => new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const timer = setTimeout(() => resolve(''), 15000);
        const done = (value) => {
          clearTimeout(timer);
          resolve(value || '');
        };
        img.onload = () => done(rasterizePdfThumb(img, PDF_THUMB_PX));
        img.onerror = () => done('');
        img.src = url;
      });
      let data = await viaImage();
      if (data) return data;
      try {
        const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (!res.ok) return '';
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        try {
          data = await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(rasterizePdfThumb(img, PDF_THUMB_PX) || '');
            img.onerror = () => resolve('');
            img.src = objUrl;
          });
        } finally {
          URL.revokeObjectURL(objUrl);
        }
      } catch { /* ignore */ }
      return data || '';
    }
    async function ensurePedidoPdfThumbs(baseThumbs) {
      const thumbs = { ...(baseThumbs || {}) };
      const todo = pedidoPdfImageUrls().filter((url) => !isPdfDataUri(thumbs[url]));
      if (!todo.length) return thumbs;
      await Promise.all(todo.map(async (url) => {
        thumbs[url] = await loadPdfThumbFromUrlAsync(url);
      }));
      return thumbs;
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
      let v = base;
      if (descontoComercialPct) v = v * (1 - descontoComercialPct / 100);
      const incentivo = descontoIncentivoPct();
      if (incentivo) v = v * (1 - incentivo / 100);
      return Math.round(v * 100) / 100;
    }
    function fmtPrecoHtml(preco, opts) {
      const base = Number(preco);
      if (!Number.isFinite(base) || base <= 0) return '—';
      const eff = precoEfetivo(base);
      if (!hasDescontoAtivo()) return esc(fmtMoney(eff));
      const pdfStack = opts && opts.pdf;
      return '<span class="preco-stack' + (pdfStack ? ' preco-stack-pdf' : '') + '">' +
        '<span class="preco-orig">' + esc(fmtMoney(base)) + '</span>' +
        '<strong class="preco-desc">' + esc(fmtMoney(eff)) + '</strong></span>';
    }
    function setDesconto(val) {
      const n = Math.max(0, Math.min(100, Number(val) || 0));
      descontoComercialPct = Math.round(n * 10) / 10;
      localStorage.setItem(DESCONTO_KEY, String(descontoComercialPct));
      refreshDescontoUi();
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
      applyTheme(localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light');
      initRegimeControls();
      const inp = document.getElementById('desconto-pct');
      if (inp) {
        syncDescontoInputUi();
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
      updateModelRowCalcs(cod);
      renderPedido();
      updateCartFab();
      if (filterQtyOnly) applySearch(document.getElementById('search').value);
    }
    function clearAllQty() {
      const hasQty = Object.keys(qtyMap).length > 0 || [...document.querySelectorAll('.qty-input')].some((el) => Number(el.value) > 0);
      if (!hasQty) return;
      if (!confirm('Limpar todas as quantidades de ' + QTY_LABEL_PL + '?')) return;
      qtyMap = {};
      localStorage.removeItem(QTY_KEY);
      document.querySelectorAll('.qty-input').forEach((input) => {
        input.value = '';
      });
      document.querySelectorAll('.model-row').forEach((row) => {
        row.dataset.qty = '0';
        row.classList.remove('has-qty');
        row.querySelector('.model-col-m2') && (row.querySelector('.model-col-m2').textContent = '');
        row.querySelector('.model-col-cx') && (row.querySelector('.model-col-cx').textContent = '');
        row.querySelector('.model-col-peso') && (row.querySelector('.model-col-peso').textContent = '');
        row.querySelector('.model-col-sub') && (row.querySelector('.model-col-sub').textContent = '');
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
        || pedidoPdfSheetOpen
        || document.getElementById('lightbox')?.classList.contains('open');
      document.body.style.overflow = locked ? 'hidden' : '';
    }
    function fmtKg(v) {
      if (v == null || v === '') return '—';
      return fmtDecimal(v, 1) + ' kg';
    }
    function parseM2Caixa(item) {
      if (item.m2_por_caixa) return Number(item.m2_por_caixa);
      const m = String(item.unidade || item.descricao || '').match(/CX\\s*([\\d,]+)\\s*M2/i) || String(item.descricao || '').match(/([\\d,]+)\\s*M2/i);
      return m ? Number(m[1].replace(',', '.')) : null;
    }
    function itemEmbalagem(item) {
      const m2cx = parseM2Caixa(item);
      const cxpl = item.caixas_por_palete ? Number(item.caixas_por_palete) : null;
      const m2pl = item.m2_por_palete ? Number(item.m2_por_palete) : (m2cx && cxpl ? Math.round(m2cx * cxpl * 100) / 100 : null);
      const pesoPl = item.peso_kg_palete ? Number(item.peso_kg_palete) : null;
      const pesoCx = item.peso_kg_caixa ? Number(item.peso_kg_caixa) : null;
      return { m2cx, cxpl, m2pl, pesoPl, pesoCx };
    }
    function itemM2Unit(item) {
      if (QTY_UNIT === 'palete') {
        const { m2pl } = itemEmbalagem(item);
        return m2pl;
      }
      return parseM2Caixa(item);
    }
    function itemM2Total(item, qty) {
      const m2unit = itemM2Unit(item);
      if (!qty || !m2unit) return null;
      return Math.round(qty * m2unit * 100) / 100;
    }
    function itemPesoUnit(item) {
      if (QTY_UNIT !== 'palete') return null;
      const { pesoPl } = itemEmbalagem(item);
      return pesoPl;
    }
    function itemPesoTotal(item, qty) {
      const pesoUnit = itemPesoUnit(item);
      if (!qty || !pesoUnit) return null;
      return Math.round(qty * pesoUnit * 10) / 10;
    }
    function itemCaixasTotal(item, qty) {
      if (!qty) return null;
      if (QTY_UNIT === 'palete') {
        const { cxpl } = itemEmbalagem(item);
        if (!cxpl) return null;
        return qty * cxpl;
      }
      return qty;
    }
    function itemSubtotal(item, qty) {
      const m2tot = itemM2Total(item, qty);
      const preco = precoEfetivo(item.preco_m2);
      if (!qty || !m2tot || !preco) return null;
      return Math.round(m2tot * preco * 100) / 100;
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
    function sortItemList(items) {
      return [...items].sort((a, b) => itemTitulo(a).localeCompare(itemTitulo(b), 'pt-BR'));
    }
    function sortAcabKeys(keys) {
      const order = CFG.acabOrder || [];
      return [...keys].sort((a, b) => {
        const ia = order.indexOf(a); const ib = order.indexOf(b);
        if (ia >= 0 && ib >= 0) return ia - ib;
        if (ia >= 0) return -1; if (ib >= 0) return 1;
        return a.localeCompare(b, 'pt-BR');
      });
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
    function grupoLabelFormato(key) {
      return 'Formato ' + key;
    }
    function sortGruposNivel1(keys) {
      if (groupBy === 'formato-acabamento') {
        return [...keys].sort(compareFormato);
      }
      return sortAcabKeys(keys);
    }
    function buildTree(itens) {
      const tree = {};
      if (groupBy === 'formato-acabamento') {
        for (const item of itens) {
          const linha = item.linha || 'desconhecida';
          const fmt = item.formato || '—';
          const acab = acabKey(item);
          tree[linha] ??= {};
          tree[linha][fmt] ??= {};
          tree[linha][fmt][acab] ??= [];
          tree[linha][fmt][acab].push(item);
        }
        for (const linha of Object.keys(tree)) {
          for (const fmt of Object.keys(tree[linha])) {
            for (const acab of Object.keys(tree[linha][fmt])) {
              tree[linha][fmt][acab] = sortItemList(tree[linha][fmt][acab]);
            }
          }
        }
        return tree;
      }
      for (const item of itens) {
        const linha = item.linha || 'desconhecida';
        const acab = acabKey(item);
        const formato = item.formato || '—';
        tree[linha] ??= {};
        tree[linha][acab] ??= {};
        tree[linha][acab][formato] ??= [];
        tree[linha][acab][formato].push(item);
      }
      for (const linha of Object.keys(tree)) {
        for (const acab of Object.keys(tree[linha])) {
          for (const formato of Object.keys(tree[linha][acab])) {
            tree[linha][acab][formato] = sortItemList(tree[linha][acab][formato]);
          }
        }
      }
      return tree;
    }
    function fmtPorPaleteText(item) {
      const emb = itemEmbalagem(item);
      const m2unit = itemM2Unit(item);
      const parts = [];
      if (emb.cxpl) parts.push(emb.cxpl + ' cx/pl');
      if (m2unit) parts.push(fmtDecimal(m2unit) + ' m²/pl');
      return parts.length ? parts.join(' · ') : '—';
    }
    function updateModelRowCalcs(cod) {
      if (CATALOG_SKIN !== 'formigres') return;
      const item = itemsByCode.get(String(cod));
      if (!item) return;
      const qty = getQty(cod);
      const m2tot = qty ? itemM2Total(item, qty) : null;
      const cxTot = qty ? itemCaixasTotal(item, qty) : null;
      const pesoTot = qty ? itemPesoTotal(item, qty) : null;
      const sub = qty ? itemSubtotal(item, qty) : null;
      document.querySelectorAll('.model-row[data-cod="' + cod + '"]').forEach((row) => {
        const setCell = (sel, text) => {
          const el = row.querySelector(sel);
          if (el) el.textContent = text;
        };
        setCell('.model-col-m2', m2tot ? fmtDecimal(m2tot) : '');
        setCell('.model-col-cx', cxTot ? fmtDecimal(cxTot, 0) : '');
        setCell('.model-col-peso', pesoTot ? fmtKg(pesoTot) : '');
        setCell('.model-col-sub', sub ? fmtMoney(sub) : '');
      });
    }
    function fmtEmbalagemText(item) {
      const emb = itemEmbalagem(item);
      if (QTY_UNIT === 'palete') {
        const parts = [];
        if (emb.cxpl) parts.push(emb.cxpl + ' cx/pl');
        if (emb.m2pl) parts.push(fmtDecimal(emb.m2pl) + ' m²/pl');
        if (emb.pesoPl) parts.push(fmtDecimal(emb.pesoPl, 1) + ' kg/pl');
        return parts.length ? parts.join(' · ') : '—';
      }
      const m2cx = parseM2Caixa(item);
      if (m2cx) return fmtDecimal(m2cx) + ' m²/cx';
      const un = String(item.unidade || '').trim();
      return un || '—';
    }
    function getGaleria(item) {
      const imgs = Array.isArray(item.imagens) ? item.imagens.filter((i) => i && i.url) : [];
      if (imgs.length) return imgs;
      return item.imagem_url ? [{ url: item.imagem_url, tipo: 'principal' }] : [];
    }
    function gemeasSearchText(item) {
      if (!item.gemeas || !item.gemeas.length) return '';
      return item.gemeas.map((g) => [g.marca, g.referencia, g.codigo].join(' ')).join(' ');
    }
    function renderGemeasTrigger(item, cod) {
      const g = item.gemeas;
      if (!g || g.length < 2) return '';
      const n = g.length;
      const tip = 'Mesmo modelo em ' + n + ' marcas — toque para ver referências';
      return '<button type="button" class="model-gemeas-badge model-gemeas-trigger" data-cod="' + esc(cod) + '" aria-expanded="false" aria-controls="gemeas-panel-' + esc(cod) + '" title="' + esc(tip) + '" aria-label="' + esc(tip) + '">' + n + '</button>';
    }
    function renderGemeasDetailRow(item, cod) {
      const g = item.gemeas;
      if (!g || g.length < 2) return '';
      const rows = g.map((row) => {
        const isCurrent = String(row.codigo) === String(cod);
        return '<tr class="' + (isCurrent ? 'gemeas-row-current' : '') + '">' +
          '<td class="gemeas-col-marca">' + esc(row.marca) + '</td>' +
          '<td class="gemeas-col-ref">' + esc(row.referencia) + '</td>' +
          '<td class="gemeas-col-cod">#' + esc(row.codigo) + '</td></tr>';
      }).join('');
      return '<tr class="model-gemeas-detail hidden" id="gemeas-panel-' + esc(cod) + '" data-gemeas-for="' + esc(cod) + '">' +
        '<td colspan="9"><div class="model-gemeas-wrap">' +
        '<p class="model-gemeas-caption">Mesmo modelo nestas marcas</p>' +
        '<table class="model-gemeas-table"><thead><tr><th>Marca</th><th>Referência</th><th>Código</th></tr></thead><tbody>' +
        rows + '</tbody></table></div></td></tr>';
    }
    function toggleGemeasPanel(cod) {
      const panel = document.getElementById('gemeas-panel-' + cod);
      const btn = document.querySelector('.model-gemeas-trigger[data-cod="' + cod + '"]');
      if (!panel) return;
      const wasHidden = panel.classList.contains('hidden');
      if (wasHidden) closeAllGemeasPanels();
      panel.classList.toggle('hidden');
      const isOpen = !panel.classList.contains('hidden');
      if (btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
    function closeAllGemeasPanels() {
      document.querySelectorAll('.model-gemeas-detail:not(.hidden)').forEach((el) => el.classList.add('hidden'));
      document.querySelectorAll('.model-gemeas-trigger[aria-expanded="true"]').forEach((btn) => btn.setAttribute('aria-expanded', 'false'));
    }
    function migrateHiddenTwinQty() {
      if (CATALOG_SKIN !== 'formigres') return;
      let changed = false;
      for (const item of CATALOGO.itens) {
        if (!item.gemeas || item.gemeas.length < 2) continue;
        const canonical = String(item.codigo_tintao);
        for (const g of item.gemeas) {
          const cod = String(g.codigo);
          if (cod === canonical) continue;
          const q = Number(qtyMap[cod] || 0);
          if (q > 0) {
            qtyMap[canonical] = (Number(qtyMap[canonical] || 0) || 0) + q;
            delete qtyMap[cod];
            changed = true;
          }
        }
      }
      if (changed) localStorage.setItem(QTY_KEY, JSON.stringify(qtyMap));
    }
    function renderTableRow(item) {
      const imgs = getGaleria(item);
      const img = imgs[0]?.url || item.imagem_url || '';
      const titulo = item.formigres_titulo || item.descricao;
      const cod = item.codigo_tintao;
      const qty = getQty(cod);
      const pack = fmtEmbalagemText(item);
      const foto = img
        ? '<button type="button" class="thumb-btn' + (imgs.length > 1 ? ' has-gallery' : '') + '" tabindex="-1" data-cod="' + esc(cod) + '" data-title="' + esc(titulo) + '" title="Ver fotos"><img src="' + esc(img) + '" alt="" loading="lazy" />' + (imgs.length > 1 ? '<span class="thumb-more" aria-hidden="true">▦</span>' : '') + '</button>'
        : '<span class="thumb-empty">—</span>';
      const warn = item.match_status !== 'encontrado' ? ' <span class="badge warn">sem match</span>' : '';
      if (CATALOG_SKIN === 'formigres') {
        const m2tot = qty ? itemM2Total(item, qty) : null;
        const cxTot = qty ? itemCaixasTotal(item, qty) : null;
        const pesoTot = qty ? itemPesoTotal(item, qty) : null;
        const sub = qty ? itemSubtotal(item, qty) : null;
        const rowMetaParts = ['#' + esc(cod)];
        if (item.marca_nome) rowMetaParts.push(esc(item.marca_nome));
        rowMetaParts.push(esc(item.formato || '—'));
        const rowMeta = rowMetaParts.join(' · ');
        const gemeasTrigger = renderGemeasTrigger(item, cod);
        const searchExtra = gemeasSearchText(item);
        const porPalete = fmtPorPaleteText(item);
        const titleHtml = gemeasTrigger
          ? '<span class="pedido-row-title-line"><span class="pedido-row-title">' + esc(titulo) + '</span>' + gemeasTrigger + '</span>'
          : '<span class="pedido-row-title">' + esc(titulo) + '</span>';
        return '<tr class="model-row' + (qty > 0 ? ' has-qty' : '') + '" data-cod="' + esc(cod) + '" data-search="' + esc((titulo + ' ' + item.descricao + ' ' + item.formigres_acabamento + ' ' + item.formato + ' ' + cod + ' ' + pack + ' ' + searchExtra).toLowerCase()) + '" data-qty="' + qty + '">' +
          '<td class="pedido-col-foto col-foto">' + foto + '</td>' +
          '<td class="pedido-col-modelo col-modelo">' + titleHtml + warn + '<div class="pedido-row-meta">' + rowMeta + '</div></td>' +
          '<td class="pedido-col-qty col-qty">' +
            '<input type="number" class="qty-input" min="0" step="1" inputmode="numeric" enterkeyhint="next" autocomplete="off" tabindex="0" value="' + (qty || '') + '" data-cod="' + esc(cod) + '" aria-label="' + esc(QTY_LABEL) + '" placeholder="" />' +
          '</td>' +
          '<td class="pedido-col-num model-col-m2">' + (m2tot ? fmtDecimal(m2tot) : '') + '</td>' +
          '<td class="pedido-col-num model-col-cx">' + (cxTot ? fmtDecimal(cxTot, 0) : '') + '</td>' +
          '<td class="pedido-col-num pedido-col-peso model-col-peso">' + (pesoTot ? fmtKg(pesoTot) : '') + '</td>' +
          '<td class="pedido-col-emb">' + esc(porPalete) + '</td>' +
          '<td class="pedido-col-num pedido-col-preco col-preco' + (hasDescontoAtivo() ? ' has-desc' : '') + '">' + fmtPrecoHtml(item.preco_m2) + '</td>' +
          '<td class="pedido-col-num col-subtotal model-col-sub">' + (sub ? esc(fmtMoney(sub)) : '') + '</td></tr>';
      }
      const metaMobile = '<div class="model-meta-mobile">' + esc(pack) + ' · ' + fmtPrecoHtml(item.preco_m2) + '</div>';
      return '<tr class="model-row' + (qty > 0 ? ' has-qty' : '') + '" data-cod="' + esc(cod) + '" data-search="' + esc((titulo + ' ' + item.descricao + ' ' + item.formigres_acabamento + ' ' + item.formato + ' ' + cod + ' ' + pack).toLowerCase()) + '" data-qty="' + qty + '">' +
        '<td class="col-foto">' + foto + '</td>' +
        '<td class="col-modelo"><strong>' + esc(titulo) + '</strong>' + warn + '<br><small style="color:var(--muted)">#' + esc(cod) + '</small>' + metaMobile + '</td>' +
        '<td class="col-pack">' + esc(pack) + '</td>' +
        '<td class="col-preco' + (hasDescontoAtivo() ? ' has-desc' : '') + '">' + fmtPrecoHtml(item.preco_m2) + '</td>' +
        '<td class="col-qty">' +
        '<input type="number" class="qty-input" min="0" step="1" inputmode="numeric" enterkeyhint="next" autocomplete="off" tabindex="0" value="' + (qty || '') + '" data-cod="' + esc(cod) + '" aria-label="' + esc(QTY_LABEL) + '" placeholder="0" />' +
        '</td></tr>';
    }
    function renderItemsTable(items) {
      if (CATALOG_SKIN === 'formigres') {
        const body = items.map((item) => {
          const cod = item.codigo_tintao;
          return renderTableRow(item) + renderGemeasDetailRow(item, cod);
        }).join('');
        return '<div class="table-wrap"><table class="model-table catalog-pedido-table">' +
          CATALOG_TABLE_COLGROUP_HTML +
          '<thead><tr>' + CATALOG_TABLE_HEAD_HTML + '</tr></thead><tbody>' +
          body + '</tbody></table></div>';
      }
      return '<div class="table-wrap"><table class="model-table"><thead><tr><th>Foto</th><th>Modelo</th><th>Embalagem</th><th>Preço/m²</th><th>' + esc(QTY_LABEL) + '</th></tr></thead><tbody>' +
        items.map(renderTableRow).join('') + '</tbody></table></div>';
    }
    function renderAcabamentoLeaf(acab, items) {
      const n = items.length;
      return '<details class="acc acc-acab" open><summary><span class="acc-title">' + esc(acab) + '</span><span class="acc-count" data-total="' + n + '">' + n + '</span></summary>' +
        renderItemsTable(items) + '</details>';
    }
    function renderFormatoComAcab(formato, acabMap) {
      const acabs = sortAcabKeys(Object.keys(acabMap));
      const n = acabs.reduce((s, a) => s + acabMap[a].length, 0);
      return '<details class="acc acc-grupo acc-grupo-formato" open><summary><span class="acc-title">' + esc(grupoLabelFormato(formato)) + '</span><span class="acc-count" data-total="' + n + '" data-suffix="itens">' + n + ' itens</span></summary>' +
        '<div class="acc-inner">' + acabs.map((a) => renderAcabamentoLeaf(a, acabMap[a])).join('') + '</div></details>';
    }
    function renderFormato(formato, items) {
      const n = items.length;
      return '<details class="acc acc-formato" open><summary><span class="acc-title">' + esc(grupoLabelFormato(formato)) + '</span><span class="acc-count" data-total="' + n + '">' + n + '</span></summary>' +
        renderItemsTable(items) + '</details>';
    }
    function renderGrupoAcab(acab, formatosMap) {
      const formatos = Object.keys(formatosMap).sort(compareFormato);
      const n = formatos.reduce((s, f) => s + formatosMap[f].length, 0);
      return '<details class="acc acc-grupo" open><summary><span class="acc-title">' + esc(acab) + '</span><span class="acc-count" data-total="' + n + '" data-suffix="itens">' + n + ' itens</span></summary>' +
        '<div class="acc-inner">' + formatos.map((f) => renderFormato(f, formatosMap[f])).join('') + '</div></details>';
    }
    function countLinhaMap(gruposMap) {
      if (groupBy === 'formato-acabamento') {
        return Object.keys(gruposMap).reduce((s, fmt) =>
          s + Object.keys(gruposMap[fmt]).reduce((a, ac) => a + gruposMap[fmt][ac].length, 0), 0);
      }
      return Object.keys(gruposMap).reduce((s, ac) =>
        s + Object.keys(gruposMap[ac]).reduce((a, f) => a + gruposMap[ac][f].length, 0), 0);
    }
    function renderLinha(linha, gruposMap) {
      const keys = sortGruposNivel1(Object.keys(gruposMap));
      const n = countLinhaMap(gruposMap);
      const label = CFG.linhaLabel[linha] || linha;
      const inner = groupBy === 'formato-acabamento'
        ? keys.map((k) => renderFormatoComAcab(k, gruposMap[k])).join('')
        : keys.map((k) => renderGrupoAcab(k, gruposMap[k])).join('');
      return '<details class="acc acc-linha" open><summary><span class="acc-title linha-' + esc(linha) + '">' + esc(label) + '</span><span class="acc-count" data-total="' + n + '">' + n + '</span></summary>' +
        '<div class="acc-inner">' + inner + '</div></details>';
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
      dom.formatos = [...document.querySelectorAll('.acc-formato, .acc-grupo-formato')];
      dom.grupos = [...document.querySelectorAll('.acc-grupo, .acc-acab')];
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
        g.classList.toggle('hidden', g.querySelectorAll('.model-row:not(.hidden)').length === 0);
      }
      for (const l of dom.linhas) {
        l.classList.toggle('hidden', l.querySelectorAll('.model-row:not(.hidden)').length === 0);
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

    function renderPedidoSpecTable(cells) {
      return '<table class="pedido-card-spec" role="presentation"><tr>' +
        cells.map((c) => {
          const cls = [
            c.preco ? ' pedido-card-spec-preco' + (hasDescontoAtivo() ? ' has-desc' : '') : '',
            c.palete ? ' pedido-card-spec-palete' : '',
          ].join('');
          const val = c.html != null ? c.html : esc(c.text ?? '—');
          return '<td><span class="pedido-card-spec-l">' + esc(c.label) + '</span><span class="pedido-card-spec-v' + cls + '">' + val + '</span></td>';
        }).join('') +
      '</tr></table>';
    }
    function renderPedidoCardRow1({ thumb, titulo, item, qty, m2tot, sub }) {
      const qtyShort = QTY_UNIT === 'palete' ? 'pl' : 'cx';
      return '<div class="pedido-card-head">' + thumb +
        '<div class="pedido-card-head-main">' +
          '<div class="pedido-card-desc">' +
            '<div class="pedido-card-title pedido-card-hero">' + esc(titulo) + '</div>' +
            '<div class="pedido-card-meta">#' + esc(item.codigo_tintao) + ' · ' + esc(item.formato || '—') + '</div>' +
          '</div>' +
          '<div class="pedido-card-qty">' +
            '<span class="pedido-card-qty-main pedido-card-hero">' + qty + ' <span>' + esc(qtyShort) + '</span></span>' +
            '<span class="pedido-card-qty-sub">' + esc(m2tot ? fmtDecimal(m2tot) + ' m²' : '—') + '</span>' +
          '</div>' +
          '<div class="pedido-card-total">' +
            '<strong class="pedido-card-hero">' + esc(sub != null ? fmtMoney(sub) : '—') + '</strong>' +
            '<span class="pedido-card-total-label">Subtotal</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }
    function renderPedidoTableRow({ item, qty, img, titulo, m2unit, m2tot, pesoTot, cxTot, cxpl, sub }, thumbs, opts) {
      const forPdf = opts && opts.pdf;
      const emb = itemEmbalagem(item);
      const rowMeta = '#' + esc(item.codigo_tintao) + ' · ' + esc(item.formato || '—');
      const imgSrc = forPdf ? pdfImgSrcForPrint(img, thumbs, item) : pdfImgSrc(img, thumbs, item) || img;
      const thumbPx = forPdf ? PDF_PRINT_THUMB_PX : 48;
      const thumbCell = imgSrc
        ? '<img src="' + esc(imgSrc) + '" alt="" width="' + thumbPx + '" height="' + thumbPx + '" style="object-fit:cover;border-radius:6px" />'
        : '—';
      const precoCell = fmtPrecoHtml(item.preco_m2, forPdf ? { pdf: true } : null);
      if (QTY_UNIT === 'palete') {
        const embParts = [];
        if (cxpl || emb.cxpl) embParts.push((cxpl || emb.cxpl) + ' cx/pl');
        if (m2unit) embParts.push(fmtDecimal(m2unit) + ' m²/pl');
        return '<tr>' +
          '<td class="pedido-col-foto">' + thumbCell + '</td>' +
          '<td class="pedido-col-modelo"><span class="pedido-row-title">' + esc(titulo) + '</span><div class="pedido-row-meta">' + rowMeta + '</div></td>' +
          '<td class="pedido-col-qty">' + qty + '</td>' +
          '<td class="pedido-col-num">' + (m2tot ? fmtDecimal(m2tot) : '—') + '</td>' +
          '<td class="pedido-col-num">' + (cxTot ? fmtDecimal(cxTot, 0) : '—') + '</td>' +
          '<td class="pedido-col-num pedido-col-peso">' + (pesoTot ? fmtKg(pesoTot) : '—') + '</td>' +
          '<td class="pedido-col-emb">' + esc(embParts.length ? embParts.join(' · ') : '—') + '</td>' +
          '<td class="pedido-col-num pedido-col-preco ' + (hasDescontoAtivo() ? 'has-desc' : '') + '">' + precoCell + '</td>' +
          '<td class="pedido-col-num col-subtotal">' + esc(sub != null ? fmtMoney(sub) : '—') + '</td></tr>';
      }
      return '<tr>' +
        '<td class="pedido-col-foto">' + thumbCell + '</td>' +
        '<td class="pedido-col-modelo"><span class="pedido-row-title">' + esc(titulo) + '</span><div class="pedido-row-meta">' + rowMeta + '</div></td>' +
        '<td class="pedido-col-qty">' + qty + '</td>' +
        '<td class="pedido-col-num">' + (m2unit ? fmtDecimal(m2unit) : '—') + '</td>' +
        '<td class="pedido-col-num">' + (m2tot ? fmtDecimal(m2tot) : '—') + '</td>' +
        '<td class="pedido-col-num pedido-col-preco ' + (hasDescontoAtivo() ? 'has-desc' : '') + '">' + precoCell + '</td>' +
        '<td class="pedido-col-num col-subtotal">' + esc(sub != null ? fmtMoney(sub) : '—') + '</td></tr>';
    }
    function renderPedidoCard({ item, qty, img, titulo, m2unit, m2tot, pesoUnit, pesoTot, cxTot, cxpl, sub }, opts) {
      const forPdf = opts && opts.pdf;
      const thumb = img
        ? '<img class="pedido-card-thumb" src="' + esc(img) + '" alt=""' + (forPdf ? ' width="48" height="48"' : ' loading="lazy"') + ' />'
        : '<span class="pedido-card-thumb pedido-card-thumb-empty" aria-hidden="true">—</span>';
      const row1 = renderPedidoCardRow1({ thumb, titulo, item, qty, m2tot, sub });

      if (QTY_UNIT === 'palete') {
        const embParts = [];
        if (cxpl) embParts.push(cxpl + ' cx/pl');
        if (m2unit) embParts.push(fmtDecimal(m2unit) + ' m²/pl');
        const spec = renderPedidoSpecTable([
          { label: 'Preço/m²', preco: true, html: fmtPrecoHtml(item.preco_m2) },
          { label: 'Caixas', text: cxTot ? fmtDecimal(cxTot, 0) : '—' },
          { label: 'Peso', peso: true, text: pesoTot ? fmtKg(pesoTot) : '—' },
          { label: 'Por palete', palete: true, text: embParts.length ? embParts.join(' · ') : '—' },
        ]);
        return '<article class="pedido-card' + (forPdf ? ' pedido-card-pdf' : '') + '"><div class="pedido-card-layout">' + row1 + spec + '</div></article>';
      }

      const spec = renderPedidoSpecTable([
        { label: 'Preço/m²', preco: true, html: fmtPrecoHtml(item.preco_m2) },
        { label: 'm²/cx', text: m2unit ? fmtDecimal(m2unit) : '—' },
        { label: 'm² total', text: m2tot ? fmtDecimal(m2tot) : '—' },
        { label: 'Embalagem', text: fmtEmbalagemText(item) },
      ]);
      return '<article class="pedido-card' + (forPdf ? ' pedido-card-pdf' : '') + '"><div class="pedido-card-layout">' + row1 + spec + '</div></article>';
    }
    function renderPedido() {
      const rows = pedidoItens();
      let totalQty = 0;
      let totalM2 = 0;
      let totalPeso = 0;
      let totalCaixas = 0;
      let totalValor = 0;
      const bodyRows = [];
      const cardRows = [];
      for (const { item, qty } of rows) {
        const emb = itemEmbalagem(item);
        const m2unit = itemM2Unit(item);
        const m2tot = itemM2Total(item, qty);
        const pesoUnit = itemPesoUnit(item);
        const pesoTot = itemPesoTotal(item, qty);
        const cxTot = itemCaixasTotal(item, qty);
        const sub = itemSubtotal(item, qty);
        totalQty += qty;
        if (m2tot) totalM2 += m2tot;
        if (pesoTot) totalPeso += pesoTot;
        if (cxTot) totalCaixas += cxTot;
        if (sub) totalValor += sub;
        const imgs = getGaleria(item);
        const img = imgs[0]?.url || '';
        const titulo = item.formigres_titulo || item.descricao;
        const rowData = { item, qty, img, titulo, m2unit, m2tot, pesoUnit, pesoTot, cxTot, cxpl: emb.cxpl, sub };
        bodyRows.push(renderPedidoTableRow(rowData, null, null));
        cardRows.push(renderPedidoCard(rowData));
      }
      document.getElementById('pedido-body').innerHTML = bodyRows.join('');
      document.getElementById('pedido-cards').innerHTML = cardRows.join('');
      document.getElementById('pedido-empty')?.classList.toggle('hidden', rows.length > 0);
      document.getElementById('pedido-list-wrap')?.classList.toggle('hidden', rows.length === 0);
      const caixasStat = QTY_UNIT === 'palete' && totalCaixas
        ? '<span class="stat"><strong>' + fmtDecimal(totalCaixas, 0) + '</strong> caixas</span>'
        : '';
      const pesoStat = QTY_UNIT === 'palete' && totalPeso
        ? '<span class="stat"><strong>' + fmtDecimal(totalPeso, 1) + '</strong> kg</span>'
        : '';
      document.getElementById('pedido-resumo').innerHTML = rows.length
        ? '<span class="stat"><strong>' + rows.length + '</strong> modelos</span>' +
          '<span class="stat"><strong>' + totalQty + '</strong> ' + QTY_LABEL_PL + '</span>' +
          caixasStat +
          '<span class="stat"><strong>' + fmtDecimal(totalM2) + '</strong> m²</span>' +
          pesoStat
        : '';
      const pesoTotalLine = QTY_UNIT === 'palete' && totalPeso
        ? '<p class="pedido-peso-note">Peso estimado: <strong>' + fmtKg(totalPeso) + '</strong></p>'
        : '';
      document.getElementById('pedido-total').innerHTML = rows.length
        ? '<span>Total estimado: <strong>' + fmtMoney(totalValor) + '</strong></span>' +
          pesoTotalLine +
          (hasDescontoAtivo() ? '<p class="pedido-desconto-note">' + esc(descontoNoteText()) + '</p>' : '')
        : '';
      document.getElementById('pdf-pedido-panel')?.toggleAttribute('disabled', rows.length === 0);
      updateCartFab();
    }

    function updateCartFab() {
      const rows = pedidoItens();
      let totalQty = 0;
      for (const { qty } of rows) totalQty += qty;
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
          ? 'Minha seleção — ' + count + ' modelos, ' + totalQty + ' ' + QTY_LABEL_PL
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
    function printPdfLayout() {
      const marginMm = 8;
      const pageWmm = 210;
      const contentWmm = pageWmm - marginMm * 2;
      const contentWpx = Math.round(contentWmm * 96 / 25.4);
      return { marginMm, pageWmm, contentWmm, contentWpx };
    }
    function printPageWidthPx() {
      return printPdfLayout().contentWpx;
    }
    function buildPedidoPrintHtml(thumbs) {
      const rows = pedidoItens();
      let totalQty = 0, totalM2 = 0, totalPeso = 0, totalCaixas = 0, totalValor = 0;
      const bodyRows = [];
      for (const { item, qty } of rows) {
        const emb = itemEmbalagem(item);
        const m2unit = itemM2Unit(item);
        const m2tot = itemM2Total(item, qty);
        const pesoUnit = itemPesoUnit(item);
        const pesoTot = itemPesoTotal(item, qty);
        const cxTot = itemCaixasTotal(item, qty);
        const sub = itemSubtotal(item, qty);
        totalQty += qty;
        if (m2tot) totalM2 += m2tot;
        if (pesoTot) totalPeso += pesoTot;
        if (cxTot) totalCaixas += cxTot;
        if (sub) totalValor += sub;
        const imgs = getGaleria(item);
        const img = imgs[0]?.url || '';
        const titulo = item.formigres_titulo || item.descricao;
        bodyRows.push(renderPedidoTableRow(
          { item, qty, img, titulo, m2unit, m2tot, pesoUnit, pesoTot, cxTot, cxpl: emb.cxpl, sub },
          thumbs,
          { pdf: true },
        ));
      }
      const tableHtml = bodyRows.length
        ? '<table class="print-pedido-table pedido-table">' +
            PEDIDO_TABLE_COLGROUP_HTML +
            '<thead><tr>' + PEDIDO_TABLE_HEAD_HTML + '</tr></thead>' +
            '<tbody>' + bodyRows.join('') + '</tbody>' +
          '</table>'
        : '';
      const descNote = hasDescontoAtivo() ? '<p class="print-note">' + esc(descontoNoteText()) + ' sobre a tabela.</p>' : '';
      const caixasResumo = QTY_UNIT === 'palete' && totalCaixas
        ? '<span class="print-resumo-stat"><strong>' + fmtDecimal(totalCaixas, 0) + '</strong> caixas</span>'
        : '';
      const pesoResumo = QTY_UNIT === 'palete' && totalPeso
        ? '<span class="print-resumo-stat"><strong>' + fmtDecimal(totalPeso, 1) + '</strong> kg</span>'
        : '';
      const resumoCols = QTY_UNIT === 'palete' ? 5 : 3;
      const resumo = rows.length
        ? '<div class="print-resumo" style="grid-template-columns:repeat(' + resumoCols + ',minmax(0,1fr))">' +
            '<span class="print-resumo-stat"><strong>' + rows.length + '</strong> modelos</span>' +
            '<span class="print-resumo-stat"><strong>' + totalQty + '</strong> ' + QTY_LABEL_PL + '</span>' +
            caixasResumo +
            '<span class="print-resumo-stat"><strong>' + fmtDecimal(totalM2) + '</strong> m²</span>' +
            pesoResumo +
          '</div>'
        : '';
      const pesoPrintLine = QTY_UNIT === 'palete' && totalPeso
        ? '<p class="print-peso">Peso estimado: <strong>' + fmtKg(totalPeso) + '</strong></p>'
        : '';
      return '<div class="print-sheet">' +
        '<header class="print-head">' +
          '<h1>' + esc(PDF_TITLE) + '</h1>' +
          '<p class="print-meta">1ª via · Gerado em ' + esc(new Date().toLocaleString('pt-BR')) + '</p>' +
          descNote +
        '</header>' +
        resumo +
        tableHtml +
        pesoPrintLine +
        '<p class="print-totals"><strong>Total estimado: ' + fmtMoney(totalValor) + '</strong></p>' +
      '</div>';
    }
    function printPedidoPrintCss() {
      const rowLine = '#707070';
      const thumb = PDF_PRINT_THUMB_PX;
      const fotoCol = thumb + 8;
      return '@page { size: A4 portrait; margin: 8mm; }' +
        'html, body { margin: 0; padding: 0; }' +
        '.print-render-root { background: #ffffff; color: #5a5a5a; font-family: "Libre Franklin", "Segoe UI", system-ui, -apple-system, sans-serif; font-size: 13px; -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; width: 100%; }' +
        '.print-sheet { width: 100%; max-width: 100%; margin: 0; box-sizing: border-box; background: #ffffff; color: #5a5a5a; padding: 0; }' +
        '.print-head { margin-bottom: 12px; }' +
        'h1 { margin: 0 0 4px; font-size: 17px; letter-spacing: .08em; text-transform: uppercase; color: #2f2f2f; font-weight: 600; }' +
        '.print-meta, .print-note { margin: 0 0 6px; color: #767676; font-size: 11px; line-height: 1.35; }' +
        '.print-resumo { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px 12px; margin-bottom: 12px; }' +
        '.print-resumo-stat { min-width: 0; font-size: 10px; color: #767676; }' +
        '.print-resumo-stat strong { display: block; font-size: 14px; color: #2f2f2f; margin-bottom: 2px; font-weight: 600; }' +
        '.print-pedido-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 13px; margin-top: 0; }' +
        '.print-pedido-table th, .print-pedido-table td { padding: 12px 7px; vertical-align: top; }' +
        '.print-pedido-table thead th { text-align: left; color: #767676; font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid ' + rowLine + '; white-space: nowrap; padding-top: 8px; padding-bottom: 8px; vertical-align: bottom; }' +
        '.print-pedido-table tbody td { border-bottom: 1px solid ' + rowLine + '; }' +
        '.print-pedido-table tbody tr:last-child td { border-bottom: 1px solid ' + rowLine + '; }' +
        '.print-pedido-table col.col-foto { width: ' + fotoCol + 'px; }' +
        '.print-pedido-table col.col-modelo { width: 32%; }' +
        '.print-pedido-table col.col-qty { width: 64px; }' +
        '.print-pedido-table col.col-m2, .print-pedido-table col.col-m2u { width: 78px; }' +
        '.print-pedido-table col.col-cx { width: 64px; }' +
        '.print-pedido-table col.col-peso { width: 88px; }' +
        '.print-pedido-table col.col-emb { width: 118px; }' +
        '.print-pedido-table col.col-preco { width: 88px; }' +
        '.print-pedido-table col.col-sub { width: 94px; }' +
        '.print-pedido-table .pedido-col-foto { width: ' + fotoCol + 'px; padding-left: 0; padding-right: 8px; vertical-align: top; }' +
        '.print-pedido-table .pedido-col-modelo { vertical-align: top; min-width: 0; }' +
        '.print-pedido-table .pedido-row-title { display: block; font-weight: 600; line-height: 1.35; color: #2f2f2f; font-size: 13px; word-break: break-word; }' +
        '.print-pedido-table .pedido-row-meta { margin-top: 4px; font-size: 11px; color: #767676; line-height: 1.35; }' +
        '.print-pedido-table .pedido-col-emb { font-size: 10px; color: #767676; line-height: 1.35; vertical-align: middle; }' +
        '.print-pedido-table .pedido-col-num, .print-pedido-table th.pedido-col-num, .print-pedido-table .col-subtotal { text-align: right; font-variant-numeric: tabular-nums; vertical-align: middle; }' +
        '.print-pedido-table .pedido-col-qty, .print-pedido-table th.pedido-col-qty { text-align: center; font-variant-numeric: tabular-nums; font-weight: 700; color: #2f2f2f; vertical-align: middle; }' +
        '.print-pedido-table .col-subtotal { font-weight: 700; color: #b01219; white-space: nowrap; }' +
        '.print-pedido-table .pedido-col-peso { font-weight: 500; color: #2f2f2f; white-space: nowrap; }' +
        '.print-pedido-table .pedido-col-preco { font-size: 12px; vertical-align: middle; }' +
        '.print-pedido-table .preco-stack, .print-pedido-table .preco-stack-pdf { display: block; text-align: right; line-height: 1.2; }' +
        '.print-pedido-table .preco-orig { display: block; text-decoration: line-through; color: #767676; font-size: 10px; font-weight: 400; margin: 0 0 2px; white-space: nowrap; }' +
        '.print-pedido-table .preco-desc { display: block; color: #2f2f2f; font-weight: 600; font-size: 12px; white-space: nowrap; margin: 0; }' +
        '.print-pedido-table .pedido-col-foto img { display: block; border-radius: 6px; width: ' + thumb + 'px; height: ' + thumb + 'px; object-fit: cover; image-rendering: auto; }' +
        '.print-pedido-table tbody tr { break-inside: avoid; page-break-inside: avoid; }' +
        '.print-peso { margin: 10px 0 0; font-size: 12px; color: #767676; text-align: right; }' +
        '.print-peso strong { color: #2f2f2f; font-weight: 600; }' +
        '.print-totals { text-align: right; margin: 14px 0 0; padding-top: 10px; border-top: 1px solid ' + rowLine + '; font-size: 14px; color: #5a5a5a; break-inside: avoid; page-break-inside: avoid; }' +
        '.print-totals strong { font-size: 16px; color: #1f1f24; font-weight: 600; }';
    }
    function pdfCanvasBackground(theme) {
      return '#ffffff';
    }
    const HTML2PDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    let pedidoPdfBlob = null;
    let pedidoPdfBlobUrl = null;

    function pedidoPdfFilename() {
      return 'pedido-formigres-' + new Date().toISOString().slice(0, 10) + '.pdf';
    }
    function revokePedidoPdfBlob() {
      if (pedidoPdfBlobUrl) {
        URL.revokeObjectURL(pedidoPdfBlobUrl);
        pedidoPdfBlobUrl = null;
      }
      pedidoPdfBlob = null;
    }
    function pedidoPdfIframeHead() {
      return '<meta charset="utf-8"><style>' + getPdfFontFaceCss() + printPedidoPrintCss() + '</style>';
    }
    function injectPdfFontClone(clonedDoc) {
      const css = getPdfFontFaceCss();
      if (!clonedDoc || !css) return;
      const style = clonedDoc.createElement('style');
      style.textContent = css;
      clonedDoc.head.appendChild(style);
      clonedDoc.documentElement.style.fontFamily = "'Libre Franklin', system-ui, sans-serif";
    }
    async function waitPrintImagesRoot(root) {
      const imgs = [...root.querySelectorAll('img')];
      if (!imgs.length) return;
      await Promise.all(imgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise((resolve) => {
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
          setTimeout(done, 8000);
        });
      }));
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    async function waitPrintFontsRoot(doc) {
      try {
        if (doc.fonts && doc.fonts.load) {
          await doc.fonts.load('400 13px "Libre Franklin"');
          await doc.fonts.load('600 13px "Libre Franklin"');
        }
        if (doc.fonts && doc.fonts.ready) await doc.fonts.ready;
        if (doc.fonts && doc.fonts.check && !doc.fonts.check('13px "Libre Franklin"')) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      } catch { /* ignore */ }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    function loadHtml2PdfInWindow(win, doc) {
      if (win.html2pdf) return Promise.resolve(win.html2pdf);
      return new Promise((resolve, reject) => {
        const script = doc.createElement('script');
        script.src = HTML2PDF_URL;
        script.async = true;
        script.onload = () => resolve(win.html2pdf);
        script.onerror = () => reject(new Error('Falha ao carregar gerador PDF'));
        (doc.head || doc.body || doc.documentElement).appendChild(script);
      });
    }
    async function renderPedidoPdfBlob(thumbs) {
      const layout = printPdfLayout();
      const pageWpx = layout.contentWpx;
      const readyThumbs = await ensurePedidoPdfThumbs(thumbs);
      const html = buildPedidoPrintHtml(readyThumbs);
      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText = 'position:fixed;left:0;top:0;width:' + pageWpx + 'px;height:2400px;border:0;opacity:0;pointer-events:none;z-index:2147483646;';
      document.body.appendChild(iframe);
      try {
        const win = iframe.contentWindow;
        const doc = win.document;
        doc.open();
        doc.write(
          '<!DOCTYPE html><html><head>' + pedidoPdfIframeHead() +
          "</head><body style=\\"margin:0;font-family:'Libre Franklin',system-ui,sans-serif\\"><div class=\\"print-render-root\\" style=\\"width:" + pageWpx + "px\\">" +
          html +
          '</div></body></html>'
        );
        doc.close();
        await loadHtml2PdfInWindow(win, doc);
        await waitPrintFontsRoot(doc);
        await waitPrintImagesRoot(doc.body);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const sheet = doc.querySelector('.print-sheet');
        if (!sheet) throw new Error('Conteúdo do PDF indisponível');
        const heightPx = Math.max(sheet.scrollHeight || 0, sheet.offsetHeight || 0, 280);
        const blob = await win.html2pdf().set({
          margin: layout.marginMm,
          filename: pedidoPdfFilename(),
          image: { type: 'jpeg', quality: 0.96 },
          html2canvas: {
            scale: PDF_CANVAS_SCALE,
            useCORS: true,
            allowTaint: false,
            logging: false,
            width: pageWpx,
            windowWidth: pageWpx,
            height: heightPx,
            windowHeight: heightPx,
            backgroundColor: pdfCanvasBackground(PDF_THEME),
            onclone: injectPdfFontClone,
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'], avoid: '.print-pedido-table tbody tr' },
        }).from(sheet).outputPdf('blob');
        if (!blob || blob.size < 12000) throw new Error('PDF gerado vazio');
        return blob;
      } finally {
        iframe.remove();
      }
    }
    function openPedidoPdfSheet() {
      pedidoPdfSheetOpen = true;
      document.getElementById('pedido-pdf-sheet')?.classList.add('open');
      syncBodyScrollLock();
    }
    function closePedidoPdfSheet() {
      pedidoPdfSheetOpen = false;
      document.getElementById('pedido-pdf-sheet')?.classList.remove('open');
      syncBodyScrollLock();
    }
    function downloadPedidoPdfFile() {
      if (!pedidoPdfBlobUrl) return;
      const a = document.createElement('a');
      a.href = pedidoPdfBlobUrl;
      a.download = pedidoPdfFilename();
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    async function exportPedidoPdf() {
      if (!pedidoItens().length) return;
      const btn = document.getElementById('pdf-pedido-panel');
      const prevLabel = btn?.textContent || 'PDF do pedido';
      if (btn) { btn.disabled = true; btn.textContent = 'Gerando PDF…'; }
      try {
        let thumbs = loadPdfThumbs();
        if (btn) btn.textContent = 'A preparar fotos…';
        thumbs = await ensurePedidoPdfThumbs(thumbs);
        const readyUrls = pedidoPdfImageUrls().filter((url) => isPdfDataUri(thumbs[url])).length;
        const totalUrls = pedidoPdfImageUrls().length;
        if (totalUrls && readyUrls < totalUrls) {
          console.warn('[pdf] Miniaturas incompletas:', readyUrls + '/' + totalUrls);
        }
        revokePedidoPdfBlob();
        pedidoPdfBlob = await renderPedidoPdfBlob(thumbs);
        pedidoPdfBlobUrl = URL.createObjectURL(pedidoPdfBlob);
        closePedidoPanel();
        openPedidoPdfSheet();
        downloadPedidoPdfFile();
      } catch (err) {
        console.error(err);
        alert('Não foi possível gerar o PDF. Verifique a ligação à internet e tente de novo.');
      } finally {
        if (btn) {
          btn.disabled = !pedidoItens().length;
          btn.textContent = prevLabel;
        }
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
    function prefersFastBoot() {
      return !!(
        (window.matchMedia && window.matchMedia('(max-width: 768px)').matches)
        || (navigator.maxTouchPoints || 0) > 0
        || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '')
      );
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
      if (msg && total > 0) {
        msg.textContent = prefersFastBoot()
          ? 'A abrir catálogo — ' + pct + '%'
          : 'A aquecer fotos — ' + pct + '% (' + done + ' de ' + total + ')';
      }
    }
    function preloadImages(urls, maxMs) {
      return new Promise((resolve) => {
        if (!urls.length) { setLoadProgress(1, 1); resolve(); return; }
        let done = 0;
        let finished = false;
        const total = urls.length;
        setLoadProgress(0, total);
        const finish = () => {
          if (finished) return;
          finished = true;
          clearTimeout(timeout);
          setLoadProgress(total, total);
          resolve();
        };
        const tick = () => {
          done += 1;
          setLoadProgress(done, total);
          if (done >= total) finish();
        };
        const timeout = setTimeout(finish, maxMs || 5000);
        urls.forEach((url) => {
          const img = new Image();
          img.onload = tick;
          img.onerror = tick;
          img.src = url;
        });
      });
    }
    function revealApp() {
      window.__tintaoBootDone = 1;
      document.body.classList.remove('is-loading');
      const shell = document.getElementById('app-shell');
      if (shell) shell.removeAttribute('aria-hidden');
      const overlay = document.getElementById('load-overlay');
      if (overlay) {
        overlay.setAttribute('aria-busy', 'false');
        overlay.setAttribute('aria-hidden', 'true');
      }
    }
    function ensureAppRendered() {
      try {
        migrateHiddenTwinQty();
        renderCatalogo();
        renderPedido();
        updateCartFab();
      } catch (err) {
        console.error(err);
      }
    }
    async function bootApp() {
      const fast = prefersFastBoot() || CATALOG_SKIN === 'formigres';
      if (fast) {
        setLoadProgress(1, 1);
        revealApp();
        await new Promise((resolve) => setTimeout(resolve, 0));
        try { ensureAppRendered(); } catch (err) { console.error(err); }
        return;
      }
      const minSplashMs = 900;
      const splashStart = Date.now();
      const msg = document.getElementById('load-msg');
      if (msg) msg.textContent = 'A preparar pedido Formigres…';
      try {
        ensureAppRendered();
        const urls = collectImageUrls().slice(0, 28);
        await Promise.race([
          preloadImages(urls, 5000),
          new Promise((resolve) => setTimeout(resolve, 5000)),
        ]);
      } catch (err) {
        console.error(err);
        ensureAppRendered();
      } finally {
        const wait = Math.max(0, minSplashMs - (Date.now() - splashStart));
        if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
        revealApp();
      }
    }
    let bootSafetyTimer = setTimeout(function bootSafetyReveal() {
      if (window.__tintaoBootDone) return;
      try { ensureAppRendered(); } catch (err) { console.error(err); }
      if (window.__tintaoForceReveal) window.__tintaoForceReveal();
      else revealApp();
    }, 4000);

    bootApp().finally(function () { clearTimeout(bootSafetyTimer); });

    const q = document.getElementById('search');
    const groupSel = document.getElementById('group-by');
    const groupSelD = document.getElementById('group-by-desktop');

    function syncGroupBy(val) {
      groupBy = normalizeGroupBy(val);
      if (groupSel) groupSel.value = groupBy;
      if (groupSelD) groupSelD.value = groupBy;
      try { localStorage.setItem(GROUP_KEY, groupBy); } catch { /* ignore */ }
      renderCatalogo();
    }
    function initCatalogControls() {
      if (groupSel) groupSel.value = groupBy;
      if (groupSelD) groupSelD.value = groupBy;
    }
    function toggleFilterQty(btn) {
      filterQtyOnly = !filterQtyOnly;
      document.querySelectorAll('#filter-qty, #filter-qty-d').forEach((b) => b?.classList.toggle('active', filterQtyOnly));
      applySearch(q?.value || '');
    }
    function bindClick(id, fn) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    }
    initTopControls();
    initCatalogControls();

    try {
    q?.addEventListener('input', () => applySearch(q.value));
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
    bindClick('pdf-pedido-panel', exportPedidoPdf);
    bindClick('pedido-pdf-download', downloadPedidoPdfFile);
    bindClick('pedido-pdf-close', closePedidoPdfSheet);
    document.getElementById('pedido-pdf-sheet')?.addEventListener('click', (e) => {
      if (e.target.id === 'pedido-pdf-sheet') closePedidoPdfSheet();
    });
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
      const gemeasBtn = e.target.closest('.model-gemeas-trigger');
      if (gemeasBtn) {
        e.preventDefault();
        e.stopPropagation();
        toggleGemeasPanel(gemeasBtn.dataset.cod);
        return;
      }
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

    } catch (bootErr) {
      console.error(bootErr);
      clearTimeout(bootSafetyTimer);
      ensureAppRendered();
      revealApp();
    }

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
        else if (pedidoPdfSheetOpen) closePedidoPdfSheet();
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

export { main, mainAsync };

async function mainAsync() {
  const jsonPath = findLatestClassifJson();
  if (!jsonPath) {
    console.error(CFG.classifError);
    process.exit(1);
  }

  const classif = readJson(jsonPath);
  const snapshot = loadSnapshotFromFile(readJson(snapshotPath('formigres')));
  if (!snapshot) {
    console.error('Snapshot Formigres ausente. Rode: npm run catalogo:snapshot-formigres');
    process.exit(1);
  }

  const itensBase = enrichItens(classif.itens || [], snapshot);
  let itens = itensBase;
  if (!CFG.skipApiEnrich) {
    console.error('A carregar fotos do site Formigres…');
    itens = await enrichImagensFromApi(itensBase);
  } else {
    console.error('Modo snapshot — a saltar chamadas API individuais.');
  }
  let gemeasStats = null;
  if (CFG.skin === 'formigres') {
    const deduped = dedupeFormigresGemeas(itens);
    itens = deduped.itens;
    gemeasStats = deduped.stats;
    console.error(`Gêmeas: ${gemeasStats.twinGroups} grupos · ${gemeasStats.hidden} linhas fundidas · ${gemeasStats.visible} visíveis`);
  }
  let pdfThumbs = {};
  if (!CFG.skipPdfThumbs) {
    console.error('A gerar miniaturas leves para PDF…');
    pdfThumbs = await buildPdfThumbMap(itens);
  } else {
    console.error('A saltar miniaturas PDF embutidas (catálogo grande).');
  }
  const thumbsCount = Object.values(pdfThumbs).filter(Boolean).length;
  const antLogoDataUri = loadAntLogoDataUri();
  const brandLogoDataUri = loadBrandLogoDataUri(CFG);
  const pdfFontCss = loadPdfFontFaceCss();
  const html = buildHtml({ classif, itens, antLogoDataUri, brandLogoDataUri, pdfThumbs, pdfFontCss, cfg: CFG });

  fs.mkdirSync(path.dirname(OUT_HTML), { recursive: true });
  fs.mkdirSync(path.dirname(OUT_DEPLOY_HTML), { recursive: true });
  fs.writeFileSync(OUT_HTML, html);
  fs.writeFileSync(OUT_DEPLOY_HTML, html);
  fs.writeFileSync(OUT_PDF_THUMBS, `${JSON.stringify(pdfThumbs)}\n`);

  const htmlKb = Math.round(fs.statSync(OUT_DEPLOY_HTML).size / 1024);
  const thumbsKb = Math.round(fs.statSync(OUT_PDF_THUMBS).size / 1024);

  console.log(JSON.stringify({
    ok: true,
    modo: MODO,
    itens: itens.length,
    comFoto: itens.filter((i) => i.imagem_url).length,
    comGaleria: itens.filter((i) => (i.imagens || []).length > 1).length,
    gemeas: gemeasStats,
    pdfThumbs: thumbsCount,
    htmlKb,
    thumbsKb,
    fonte: jsonPath,
    html: OUT_HTML,
    deployHtml: OUT_DEPLOY_HTML,
    publicUrl: PUBLIC_URL,
    pdfThumbsFile: OUT_PDF_THUMBS,
  }, null, 2));
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) main();
