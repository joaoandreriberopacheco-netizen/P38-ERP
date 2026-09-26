#!/usr/bin/env node
/**
 * PDFs do catálogo activo completo:
 *   · detalhe 4×3 · drill produto compra · unificado paisagem + nome Supabase
 *
 *   npm run export:pdf-catalogo-completo
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildCatalogoCompletoManifest } from './lib/catalogoFiltradoXlsx.mjs';

const ROOT = process.cwd();
const CATALOG = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-4x3.xlsx');
const MANIFEST = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-completo-manifest.json');
const OUT_4X3 = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-4x3-completo.pdf');
const OUT_NIVEL = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-4x-nivel-completo.pdf');
const OUT_UNI = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-unificado-completo-paisagem.pdf');

if (!fs.existsSync(CATALOG)) {
  console.log('[pdf-completo] catálogo em falta — a regenerar…');
  const run = spawnSync('npm', ['run', 'export:catalogo-4x3'], { stdio: 'inherit', cwd: ROOT });
  if ((run.status ?? 1) !== 0) process.exit(run.status ?? 1);
}

const manifest = await buildCatalogoCompletoManifest(CATALOG);
fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

console.log(
  `[pdf-completo] ${manifest.produtosCompraTotal} produtos compra · ${manifest.skusMatch} SKUs`,
);

function runPy(script, out, filter = null) {
  const args = [path.join(ROOT, 'scripts', script), CATALOG, out];
  if (filter) args.push(filter);
  const run = spawnSync('python3', args, { stdio: 'inherit' });
  if ((run.status ?? 1) !== 0) process.exit(run.status ?? 1);
}

runPy('gerar-pdf-catalogo-4x3.py', OUT_4X3);
runPy('gerar-pdf-catalogo-4x-nivel.py', OUT_NIVEL);
runPy('gerar-pdf-catalogo-unificado-paisagem.py', OUT_UNI, MANIFEST);

console.log(`  → ${OUT_4X3}`);
console.log(`  → ${OUT_NIVEL}`);
console.log(`  → ${OUT_UNI}`);
