/**
 * Categorias ERP → etapa de obra (subfolha Etapas).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const JSON_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/data/etapaCategoriaMap.json');

let _cache = null;

function load() {
  if (!_cache) _cache = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  return _cache;
}

export function getLegendaLinha() {
  return load().legenda_linha ?? {};
}

export function getMapaEtapasCategoria() {
  return load().mapa ?? [];
}

export function etapaPorCategoriaErp(categoriaAtual = '') {
  const cat = String(categoriaAtual ?? '').trim();
  if (!cat) return '';
  const hit = getMapaEtapasCategoria().find((m) => m.categoria_erp === cat);
  return hit?.etapa ?? '';
}

/** Etapa do SKU: core manda; senão mapa ERP. */
export function resolverEtapaSku(categoriaAtual, coreMeta = {}) {
  if (coreMeta.etapa_obra) return coreMeta.etapa_obra;
  return etapaPorCategoriaErp(categoriaAtual);
}

const PAPEL_GLYPH = {
  nucleo: 'N',
  complemento: 'C',
  receita_pronta: 'R',
};

/**
 * LINHA com glitch opcional ·N ·C ·R (papel no pathway, não muda família portal).
 * @param {string} linhaNome
 * @param {string} papelCore — nucleo | complemento | receita_pronta | ''
 */
export function linhaComGlitch(linhaNome, papelCore = '') {
  const base = String(linhaNome ?? '').trim();
  if (!base) return '';
  const g = PAPEL_GLYPH[papelCore];
  return g ? `${base}·${g}` : base;
}
