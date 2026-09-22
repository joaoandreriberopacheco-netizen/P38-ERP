#!/usr/bin/env node
/**
 * Excel do catálogo activo completo (3 ficheiros):
 *   · detalhe 4×3 · drill produto compra · unificado + nome Supabase
 *
 *   npm run export:xlsx-catalogo-completo
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { exportCatalogoCompletoXlsx } from './lib/catalogoFiltradoXlsx.mjs';

const ROOT = process.cwd();
const CATALOG = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-4x3.xlsx');
const OUT_4X3 = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-4x3-completo.xlsx');
const OUT_NIVEL = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-4x-nivel-completo.xlsx');
const OUT_UNI = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-unificado-completo.xlsx');

if (!fs.existsSync(CATALOG)) {
  console.log('[xlsx-completo] catálogo em falta — a regenerar…');
  const run = spawnSync('npm', ['run', 'export:catalogo-4x3'], { stdio: 'inherit', cwd: ROOT });
  if ((run.status ?? 1) !== 0) process.exit(run.status ?? 1);
}

const result = await exportCatalogoCompletoXlsx({
  catalogPath: CATALOG,
  out4x3: OUT_4X3,
  outNivel: OUT_NIVEL,
  outUnificado: OUT_UNI,
});

console.log(
  `[xlsx-completo] ${result.produtosCompra} produtos compra · ${result.skus} SKUs`,
);
console.log(`  → ${result.out4x3}`);
console.log(`  → ${result.outNivel}`);
console.log(`  → ${result.outUnificado}`);
