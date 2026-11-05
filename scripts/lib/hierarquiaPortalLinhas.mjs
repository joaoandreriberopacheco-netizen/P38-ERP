/**
 * Hierarquia portal P38 — LINHA mestre (fonte canónica).
 *
 * Dados: src/data/hierarquiaPortalLinhas.json
 * Usado por: export estudo, benchmark LM, futuro portal UI.
 *
 * Modelo: LINHA → produto compra → eixo A → eixo B → novo SKU
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_PATH = path.join(__dirname, '../../src/data/hierarquiaPortalLinhas.json');

let _cache = null;

function loadRaw() {
  if (!_cache) {
    _cache = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  }
  return _cache;
}

/** @typedef {{ ordem: number, codigo: string, nome: string, tipo: 'mix'|'portfolio'|'solo', grupo?: string, nota?: string }} LinhaPortal */

/** Lista ordenada de LINHAs portal (sem OUTROS duplicado). */
export function getLinhasMestre() {
  return [...loadRaw().linhas].sort((a, b) => a.ordem - b.ordem);
}

/** Alias histórico usado pelo export. */
export const LINHAS_MESTRE = getLinhasMestre();

export function getHierarquiaPrincipios() {
  return loadRaw().principios ?? [];
}

export function getFormulaNovoSku() {
  return loadRaw().formula_novo_sku ?? 'produto_compra + eixo_a + eixo_b';
}

/** Mapa codigo → linha. */
export function linhasPorCodigo(extraLinhas = []) {
  const map = Object.fromEntries(getLinhasMestre().map((l) => [l.codigo, l]));
  for (const l of extraLinhas) {
    if (l?.codigo && !map[l.codigo]) map[l.codigo] = l;
  }
  return map;
}

/**
 * Resolve metadados da LINHA; fallback OUTROS.
 * @param {string} codigo
 * @param {Record<string, LinhaPortal>} [extraMap]
 */
export function findLinhaMeta(codigo, extraMap = null) {
  const map = extraMap ?? linhasPorCodigo();
  return map[codigo] ?? map.OUTROS ?? getLinhasMestre().find((l) => l.codigo === 'OUTROS');
}

/** Mescla linhas do manifest Excel (cerâmica piloto) sobre a mestre. */
export function mergeLinhasComManifest(manifestLinhas = []) {
  return linhasPorCodigo(manifestLinhas);
}
