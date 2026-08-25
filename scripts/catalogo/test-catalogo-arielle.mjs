#!/usr/bin/env node
/**
 * Smoke test catálogo Arielle (HTML gerado + preços).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const htmlPath = path.join(ROOT, 'deploy', 'catalogo-arielle', 'index.html');

if (!fs.existsSync(htmlPath)) {
  console.error('HTML ausente. Rode: npm run catalogo:publicar-arielle');
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const hasSkin = html.includes('data-skin="arielle"');
const hasLogo = html.includes('arielle') || html.includes('Arielle');
const match = html.match(/"itens":\s*\[/);
const itemCount = (html.match(/"codigo_tintao"/g) || []).length;

console.log(JSON.stringify({
  ok: hasSkin && itemCount > 0,
  htmlPath,
  hasSkin,
  hasLogo,
  itemCount,
  htmlKb: Math.round(fs.statSync(htmlPath).size / 1024),
}, null, 2));

if (!hasSkin || itemCount < 50) process.exit(1);
