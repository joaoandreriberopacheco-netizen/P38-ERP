#!/usr/bin/env node
/**
 * Smoke test catálogo Arielle (HTML gerado + classificação Bold/Retificada + acabamento).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const htmlPath = path.join(ROOT, 'deploy', 'catalogo-arielle', 'index.html');
const classifDir = path.join(ROOT, 'docs', 'imports-local', 'arielle', 'classificacao');

if (!fs.existsSync(htmlPath)) {
  console.error('HTML ausente. Rode: npm run catalogo:publicar-arielle');
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const hasSkin = html.includes('data-skin="arielle"');
const itemCount = (html.match(/"codigo_tintao"/g) || []).length;
const linhaPolida = (html.match(/"linha":"polida"/g) || []).length;
const hasBold = html.includes('"linha":"bold"');
const hasRetificada = html.includes('"linha":"retificada"');
const hasAcabPolida = html.includes('"acabamento_label":"Polida"');
const fabricanteUfSe = html.includes('const FABRICANTE_UF = "SE"');
const fabricanteHintSe = html.includes('Polo SE') && html.includes('(SE)');
const logoPageHeadRight = html.includes('page-head-brand-lockup') && html.includes('page-head-logo');
const hasTour = html.includes('catalog-tour-overlay') && html.includes('help-tour-fab');

let classifSummary = null;
if (fs.existsSync(classifDir)) {
  const jsonFiles = fs.readdirSync(classifDir)
    .filter((f) => /^arielle-completo-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse();
  if (jsonFiles[0]) {
    const payload = JSON.parse(fs.readFileSync(path.join(classifDir, jsonFiles[0]), 'utf8'));
    const porLinha = {};
    const porAcab = {};
    for (const row of payload.itens || []) {
      porLinha[row.linha] = (porLinha[row.linha] || 0) + 1;
      const acab = row.acabamento_label || row.formigres_acabamento || '?';
      porAcab[acab] = (porAcab[acab] || 0) + 1;
    }
    classifSummary = { porLinha, porAcab, total: payload.itens?.length || 0 };
  }
}

const ok = hasSkin
  && itemCount >= 50
  && linhaPolida === 0
  && hasBold
  && hasRetificada
  && hasAcabPolida
  && fabricanteUfSe
  && fabricanteHintSe
  && logoPageHeadRight
  && hasTour;

console.log(JSON.stringify({
  ok,
  htmlPath,
  hasSkin,
  itemCount,
  linhaPolida,
  hasBold,
  hasRetificada,
  hasAcabPolida,
  fabricanteUfSe,
  fabricanteHintSe,
  logoPageHeadRight,
  hasTour,
  htmlKb: Math.round(fs.statSync(htmlPath).size / 1024),
  classifSummary,
}, null, 2));

if (!ok) process.exit(1);
