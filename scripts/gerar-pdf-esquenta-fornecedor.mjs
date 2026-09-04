#!/usr/bin/env node
/**
 * Gera PDF esquenta fornecedor (estilo pisos-pop-premium-formigres).
 *
 * npm run esquenta:pdf
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PY = path.join(ROOT, 'scripts', 'gerar-pdf-esquenta-fornecedor.py');
const CSV = path.join(ROOT, 'docs', 'imports-local', 'esquenta-fornecedor', 'resultado-completo.csv');
const IMG_DIR = path.join(ROOT, 'docs', 'imports-local', 'esquenta-fornecedor', 'imagens');
const OUT = path.join(ROOT, 'docs', 'imports-local', 'esquenta-fornecedor', 'esquenta-fornecedor.pdf');

if (!fs.existsSync(CSV)) {
  console.error('CSV não encontrado. Rode antes: npm run esquenta:enriquecer');
  console.error('Esperado:', CSV);
  process.exit(1);
}

const r = spawnSync('python3', [PY, CSV, IMG_DIR, OUT], { stdio: 'inherit' });
process.exit(r.status ?? 1);
