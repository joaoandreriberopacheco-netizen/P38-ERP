#!/usr/bin/env node
/**
 * Gera PDF em formato tabela-lista com imagem por linha (só encontrados).
 * Ignora itens com formato fora do catálogo Formigres.
 *
 * npm run formigres:pdf-pisos
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PY = path.join(ROOT, 'scripts', 'gerar-pdf-pisos-formigres.py');
const CSV = path.join(ROOT, 'docs', 'imports-local', 'pisos-pop-premium-formigres', 'resultado-completo.csv');
const IMG_DIR = path.join(ROOT, 'docs', 'imports-local', 'pisos-pop-premium-formigres', 'imagens');
const OUT = path.join(ROOT, 'docs', 'imports-local', 'pisos-pop-premium-formigres', 'pisos-pop-premium-formigres.pdf');

if (!fs.existsSync(CSV)) {
  console.error('CSV não encontrado. Rode antes: npm run formigres:enriquecer-pisos');
  console.error('Esperado:', CSV);
  process.exit(1);
}

const r = spawnSync('python3', [PY, CSV, IMG_DIR, OUT], { stdio: 'inherit' });
process.exit(r.status ?? 1);
