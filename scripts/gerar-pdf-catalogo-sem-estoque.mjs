#!/usr/bin/env node
/**
 * PDFs catálogo — só produtos compra sem estoque (todos SKUs do comp1 com estoque ≤ 0).
 *
 *   npm run export:pdf-catalogo-sem-estoque
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildSemEstoqueFilter } from './lib/catalogoEstoqueFilter.mjs';

const ROOT = process.cwd();
const XLSX = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-4x3.xlsx');
const FILTER = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-sem-estoque-filter.json');
const OUT_4X3 = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-4x3-sem-estoque.pdf');
const OUT_4X = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-4x-nivel-sem-estoque.pdf');
const ART_4X3 = '/opt/cursor/artifacts/P38-catalogo-4x3-sem-estoque.pdf';
const ART_4X = '/opt/cursor/artifacts/P38-catalogo-4x-nivel-sem-estoque.pdf';

if (!fs.existsSync(XLSX)) {
  console.error(`Fonte em falta: ${XLSX}`);
  process.exit(1);
}

const filter = await buildSemEstoqueFilter(XLSX);
fs.mkdirSync(path.dirname(FILTER), { recursive: true });
fs.writeFileSync(FILTER, JSON.stringify(filter, null, 2));

console.log(
  `[sem-estoque] fonte estoque: ${filter.source} · ${filter.produtosCompraSemEstoque}/${filter.produtosCompraTotal} produtos compra · ${filter.skusSemEstoque} SKUs`,
);

function runPy(script, out) {
  const run = spawnSync(
    'python3',
    [path.join(ROOT, 'scripts', script), XLSX, out, FILTER],
    { stdio: 'inherit' },
  );
  if ((run.status ?? 1) !== 0) process.exit(run.status ?? 1);
}

runPy('gerar-pdf-catalogo-4x3.py', OUT_4X3);
runPy('gerar-pdf-catalogo-4x-nivel.py', OUT_4X);

for (const [src, dst] of [
  [OUT_4X3, ART_4X3],
  [OUT_4X, ART_4X],
]) {
  try {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    console.log(`[sem-estoque] cópia → ${dst}`);
  } catch {
    /* ok */
  }
}
