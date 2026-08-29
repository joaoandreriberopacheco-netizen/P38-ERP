#!/usr/bin/env node
/**
 * Regenera deploy/catalogo-tintao a partir do HTML existente (sem snapshot/classificação local).
 * Uso: node scripts/catalogo/regenerar-tintao-from-deploy.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildHtml } from './gerar-html-tintao-catalogo.mjs';

const ROOT = process.cwd();
const DEPLOY = path.join(ROOT, 'deploy', 'catalogo-tintao', 'index.html');
const CFG = {
  classifDir: path.join(ROOT, 'docs', 'imports-local', 'tintao', 'classificacao'),
  outHtml: path.join(ROOT, 'docs', 'imports-local', 'tintao', 'Catálogo B2B Tintão - Formigres.html'),
  outDeploy: DEPLOY,
  title: 'Pedido Formigres — Lojistas',
  h1: 'Pedido Formigres',
  qtyUnit: 'caixa',
  qtyLabel: 'Caixas',
  qtyLabelPl: 'caixas',
  themeKey: 'tintao-theme-v1',
  qtyKey: 'tintao-pedido-qty-v1',
  descontoKey: 'tintao-desconto-v1',
  groupKey: 'tintao-catalog-group-v1',
  tourKey: 'tintao-catalog-tour-v3',
  pdfLayout: 'mobile',
  skin: 'default',
  siteSub: 'Pedido B2B · Lojistas',
  hideThemeToggle: false,
  fontsUrl: 'https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700&display=swap',
  logoPath: null,
  skipApiEnrich: true,
  skipPdfThumbs: true,
  publicUrl: 'https://catalogo-tintao-formigres.vercel.app/',
};

function extractJson(html, id) {
  const re = new RegExp(`id="${id}"[^>]*>([^<]+)`, 'i');
  const m = html.match(re);
  if (!m) throw new Error(`Bloco ${id} não encontrado em ${DEPLOY}`);
  return JSON.parse(m[1]);
}

function loadAntLogo() {
  const p = path.join(ROOT, 'scripts', 'catalogo', 'assets', 'formigres-ant.png');
  try {
    const buf = fs.readFileSync(p);
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
}

function loadPdfFontCss() {
  const p = path.join(ROOT, 'scripts', 'catalogo', 'assets', 'fonts', 'libre-franklin-latin.woff2');
  try {
    const buf = fs.readFileSync(p);
    const b64 = buf.toString('base64');
    return `@font-face{font-family:'Libre Franklin';font-style:normal;font-weight:400;font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2');}@font-face{font-family:'Libre Franklin';font-style:normal;font-weight:600;font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
  } catch {
    return '';
  }
}

const htmlOld = fs.readFileSync(DEPLOY, 'utf8');
const catalogo = extractJson(htmlOld, 'catalogo-data');
const pdfThumbs = extractJson(htmlOld, 'pdf-thumbs-data');
const itens = catalogo.itens || [];
const classif = { geradoEm: new Date().toISOString(), itens: itens.map(({ imagens, ...rest }) => rest) };
const out = buildHtml({
  classif,
  itens,
  antLogoDataUri: loadAntLogo(),
  brandLogoDataUri: '',
  pdfThumbs,
  pdfFontCss: loadPdfFontCss(),
  cfg: CFG,
});

fs.mkdirSync(path.dirname(CFG.outHtml), { recursive: true });
fs.writeFileSync(CFG.outHtml, out);
fs.writeFileSync(DEPLOY, out);
console.log(JSON.stringify({
  ok: true,
  itens: itens.length,
  htmlKb: Math.round(Buffer.byteLength(out) / 1024),
  deploy: DEPLOY,
  hasTour: out.includes('help-tour-fab'),
  mobilePdf: out.includes("orientation: 'portrait'"),
  fmtResumo: out.includes('print-fmt-resumo-wrap'),
}, null, 2));
