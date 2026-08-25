/**
 * Caminhos do catálogo local (Cursor / imports-local — fora do P38).
 */
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.join(process.cwd(), 'docs', 'imports-local', 'catalogo');
export const REVESTIMENTOS = path.join(ROOT, 'revestimentos');
export const MAPAS = path.join(process.cwd(), 'docs', 'imports-local', 'mapas');

export function fabricanteDir(slug) {
  return path.join(REVESTIMENTOS, slug);
}

export function snapshotPath(fabricanteSlug) {
  return path.join(fabricanteDir(fabricanteSlug), 'snapshot.json');
}

export function metaPath(fabricanteSlug) {
  return path.join(fabricanteDir(fabricanteSlug), 'meta.json');
}

export function indicePath() {
  return path.join(REVESTIMENTOS, '_indice.json');
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}
