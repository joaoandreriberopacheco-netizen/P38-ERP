/**
 * Preços do relatório SIAH (Preço Varejo) — arquivo do fornecedor / Pague Leve.
 */
import fs from 'node:fs';
import path from 'node:path';
import { stripAccents } from './formigresCatalog.mjs';

const ROOT = process.cwd();
const PRE_OS_JSON = path.join(ROOT, 'files', 'pagleve', 'precos-pre-os.json');
const LEGACY_JSON = path.join(ROOT, 'files', 'pagleve', 'precos-siah-fornecedor.json');

function defaultPrecosJsonPath() {
  if (process.env.PAGLEVE_PRECOS_JSON && fs.existsSync(process.env.PAGLEVE_PRECOS_JSON)) {
    return process.env.PAGLEVE_PRECOS_JSON;
  }
  if (fs.existsSync(PRE_OS_JSON)) return PRE_OS_JSON;
  return LEGACY_JSON;
}

export function normDescKey(s) {
  return stripAccents(String(s || ''))
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function loadPrecosSiah(jsonPath = defaultPrecosJsonPath()) {
  if (!fs.existsSync(jsonPath)) return null;
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const byCode = new Map();
  const list = [];
  for (const row of data.itens || []) {
    const cod = String(row.codigo_siah || row.codigo_loja || '');
    if (!cod) continue;
    if (!byCode.has(cod)) {
      byCode.set(cod, row);
      list.push(row);
    }
  }
  return { byCode, list, meta: data, path: jsonPath };
}

/**
 * @returns {{ preco_m2: number|null, codigo_siah?: string, fonte?: string }}
 */
export function resolvePrecoSiah(item, precos) {
  if (!precos?.byCode) return { preco_m2: null };
  const cod = String(item.codigo_tintao || item.referencia || item.codigo || '').trim();
  if (/^\d{4,6}$/.test(cod) && precos.byCode.has(cod)) {
    const r = precos.byCode.get(cod);
  if (/^\d{4,6}$/.test(cod) && precos.byCode.has(cod)) {
    const r = precos.byCode.get(cod);
    const fonte = precos.meta?.tipo === 'pre_os' ? 'pre_os_codigo' : 'siah_codigo';
    return { preco_m2: r.preco_varejo_m2, codigo_siah: cod, fonte };
  }
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
