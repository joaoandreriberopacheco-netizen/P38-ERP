#!/usr/bin/env node
/**
 * PDF catálogo 4× — nível drill (etapa → produto compra + qtd SKUs).
 *
 *   npm run export:pdf-catalogo-4x
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const XLSX = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-4x3.xlsx');
const OUT = path.join(ROOT, 'docs', 'exports', 'P38-catalogo-4x-nivel.pdf');
const PY = path.join(ROOT, 'scripts', 'gerar-pdf-catalogo-4x-nivel.py');

if (!fs.existsSync(XLSX)) {
  console.error(`Fonte em falta: ${XLSX}`);
  console.error('Regenerar: npm run export:catalogo-4x3');
  process.exit(1);
}

const run = spawnSync('python3', [PY, XLSX, OUT], { stdio: 'inherit' });
process.exit(run.status ?? 1);
