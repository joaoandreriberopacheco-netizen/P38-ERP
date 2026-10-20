/**
 * Preços do relatório SIAH (Preço Varejo) — arquivo do fornecedor / Pague Leve.
 */
import fs from 'node:fs';
import path from 'node:path';
import { stripAccents } from './formigresCatalog.mjs';

const DEFAULT_JSON = path.join(process.cwd(), 'files', 'pagleve', 'precos-siah-fornecedor.json');
const MANUAL_PRECO_JSON = path.join(process.cwd(), 'files', 'pagleve', 'precos-varejo-por-codigo.json');

let manualPrecoCache = null;

export function loadPrecosVarejoPorCodigo(jsonPath = MANUAL_PRECO_JSON) {
  if (manualPrecoCache && jsonPath === MANUAL_PRECO_JSON) return manualPrecoCache;
  if (!fs.existsSync(jsonPath)) return null;
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const map = data.por_codigo_tintao || data;
  const out = new Map();
  for (const [cod, row] of Object.entries(map)) {
    if (cod === 'meta' || !row || typeof row !== 'object') continue;
    const preco = Number(row.preco_varejo_m2);
    if (!Number.isFinite(preco) || preco <= 0) continue;
    out.set(String(cod).trim(), { ...row, preco_varejo_m2: preco });
  }
  if (jsonPath === MANUAL_PRECO_JSON) manualPrecoCache = out;
  return out;
}

export function normDescKey(s) {
  return stripAccents(String(s || ''))
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function loadPrecosSiah(jsonPath = DEFAULT_JSON) {
  if (!fs.existsSync(jsonPath)) return null;
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const byCode = new Map();
  const list = [];
  for (const row of data.itens || []) {
    const cod = String(row.codigo_siah || '');
    if (!cod) continue;
    if (!byCode.has(cod)) {
      byCode.set(cod, row);
      list.push(row);
    }
  }
  return { byCode, list, meta: data };
}

/**
 * @returns {{ preco_m2: number|null, codigo_siah?: string, fonte?: string }}
 */
export function resolvePrecoSiah(item, precos) {
  const ref = String(item.codigo_tintao || item.referencia || item.codigo || '').trim();
  const manual = loadPrecosVarejoPorCodigo();
  if (ref && manual?.has(ref)) {
    const row = manual.get(ref);
    return {
      preco_m2: row.preco_varejo_m2,
      codigo_siah: row.codigo_siah || '',
      fonte: 'varejo_manual',
    };
  }

  if (!precos?.byCode) return { preco_m2: null };
  const cod = ref;
  if (/^\d{4,6}$/.test(cod) && precos.byCode.has(cod)) {
    const r = precos.byCode.get(cod);
    return { preco_m2: r.preco_varejo_m2, codigo_siah: cod, fonte: 'siah_codigo' };
  }

  const fmt = normDescKey((item.formato || '').replace(/x/gi, 'X'));
  const modelo = normDescKey(item.modelo || '');
  const desc = normDescKey(item.descricao || item.descricao_erp || '');
  const candidates = [];

  for (const row of precos.list) {
    const d = row.descricao_norm || normDescKey(row.descricao);
    let score = 0;
    if (desc && (d.includes(desc) || desc.includes(d))) score += 40;
    if (modelo && d.includes(modelo)) score += 30;
    if (fmt && d.includes(fmt.replace(/ /g, ''))) score += 20;
    if (fmt && d.includes(fmt)) score += 15;
    if (score > 0) candidates.push({ row, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (best && best.score >= 35) {
    return {
      preco_m2: best.row.preco_varejo_m2,
      codigo_siah: best.row.codigo_siah,
      fonte: `siah_desc:${best.score}`,
    };
  }
  return { preco_m2: null };
}
