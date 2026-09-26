#!/usr/bin/env node
/**
 * PDFs catálogo — sem estoque e sem vendas nos últimos 75 dias (produto compra completo).
 *
 *   npm run export:pdf-catalogo-sem-venda-75d
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildSemEstoqueSemVendaFilter } from './lib/catalogoEstoqueFilter.mjs';

const ROOT = process.cwd();
const XLSX = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-4x3.xlsx');
const FILTER = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-sem-venda-75d-filter.json');
const OUT_4X3 = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-4x3-sem-venda-75d.pdf');
const OUT_4X = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-4x-nivel-sem-venda-75d.pdf');
const ART_4X3 = '/opt/cursor/artifacts/P38-catalogo-4x3-sem-venda-75d.pdf';
const ART_4X = '/opt/cursor/artifacts/P38-catalogo-4x-nivel-sem-venda-75d.pdf';

if (!fs.existsSync(XLSX)) {
  console.error(`Fonte em falta: ${XLSX}`);
  process.exit(1);
}

const filter = await buildSemEstoqueSemVendaFilter(XLSX);
fs.mkdirSync(path.dirname(FILTER), { recursive: true });
fs.writeFileSync(FILTER, JSON.stringify(filter, null, 2));

console.log(
  `[sem-venda-75d] fonte: ${filter.source} · ${filter.produtosCompraMatch}/${filter.produtosCompraTotal} produtos compra · ${filter.skusMatch} SKUs · desde ${filter.cutoff}`,
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
    console.log(`[sem-venda-75d] cópia → ${dst}`);
  } catch {
    /* ok */
  }
}
