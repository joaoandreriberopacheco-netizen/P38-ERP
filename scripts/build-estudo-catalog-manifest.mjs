#!/usr/bin/env node
/**
 * Gera manifest JSON a partir do Excel de estudo (P38-sku-hierarquia-ab.xlsx).
 * Fonte externa — não toca Supabase nem Base44.
 *
 *   npm run estudo:catalog-manifest
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { applySprayLinhaRulesAll } from '../src/lib/estudoCatalog/applySprayLinhaRules.js';

const EXCEL_PATH = path.join(process.cwd(), 'docs', 'exports', 'P38-sku-hierarquia-ab.xlsx');
const LINHAS_JSON = path.join(process.cwd(), 'src', 'data', 'hierarquiaPortalLinhas.json');
const BLOCO_OVERRIDES_JSON = path.join(process.cwd(), 'src', 'data', 'estudoCatalogBlocoOverrides.json');
const OUT = path.join(process.cwd(), 'src', 'data', 'estudoCatalogManifest.generated.json');

const DATA_SHEETS = [
  'A — Edificações',
  'B — Hidráulica',
  'B — Elétrica',
  'C prévia — elétrica visível',
];

const HEADERS = [
  'bloco',
  'sub_bloco',
  'etapa',
  'core',
  'linha',
  'produto_compra',
  'eixo_a',
  'eixo_b',
  'codigo_interno',
  'novo_sku',
  'sku_atual',
  'status_mix',
];

function cellStr(cell) {
  if (!cell || cell.value == null) return '';
  const v = cell.value;
  if (typeof v === 'object' && v.result != null) return String(v.result).trim();
  return String(v).trim();
}

function normLinha(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/·[NRC]$/i, '')
    .trim()
    .toUpperCase();
}

function loadLinhasMestre() {
  const raw = JSON.parse(fs.readFileSync(LINHAS_JSON, 'utf8'));
  const byNome = new Map();
  const byCodigo = new Map();
  for (const l of raw.linhas || []) {
    byNome.set(normLinha(l.nome), l);
    byCodigo.set(normLinha(l.codigo), l);
  }
  return { byNome, byCodigo, version: raw.version, linhas: raw.linhas || [] };
}

function resolveLinhaMeta(linhaCell, { byNome, byCodigo }) {
  const base = normLinha(linhaCell);
  return byNome.get(base) || byCodigo.get(base) || {
    codigo: base.replace(/[^A-Z0-9]+/g, '_').slice(0, 48) || 'OUTROS',
    nome: String(linhaCell || '').trim() || 'OUTROS',
    tipo: 'mix',
    ordem: 900,
    grupo: 'fallback',
  };
}

function loadBlocoOverrides() {
  if (!fs.existsSync(BLOCO_OVERRIDES_JSON)) {
    return { version: null, por_linha_codigo: {}, por_linha_parcial: [] };
  }
  const raw = JSON.parse(fs.readFileSync(BLOCO_OVERRIDES_JSON, 'utf8'));
  return {
    version: raw.version || null,
    por_linha_codigo: raw.por_linha_codigo || {},
    por_linha_parcial: raw.por_linha_parcial || [],
  };
}

function mergeBlocoOverride(row, patch) {
  if (!patch) return row;
  return {
    ...row,
    ...(patch.bloco != null ? { bloco: patch.bloco } : {}),
    ...(patch.sub_bloco != null ? { sub_bloco: patch.sub_bloco } : {}),
    ...(patch.etapa != null ? { etapa: patch.etapa } : {}),
    ...(patch.core != null ? { core: patch.core } : {}),
    ...(patch.linha_tipo != null ? { linha_tipo: patch.linha_tipo } : {}),
  };
}

function matchesBlocoExceto(row, exceto = {}) {
  if (exceto.core && row.core === exceto.core) return true;
  if (exceto.sub_bloco && row.sub_bloco === exceto.sub_bloco) return true;
  const pc = `${row.produto_compra_nome || ''} ${row.produto_compra || ''}`.trim();
  if (exceto.produto_compra_regex && pc) {
    const re = new RegExp(exceto.produto_compra_regex, 'i');
    if (re.test(pc)) return true;
  }
  return false;
}

function applyBlocoOverrides(rows, { por_linha_codigo = {}, por_linha_parcial = [] } = {}) {
  const hasFull = por_linha_codigo && Object.keys(por_linha_codigo).length;
  const hasPartial = por_linha_parcial?.length;
  if (!hasFull && !hasPartial) return rows;

  return rows.map((row) => {
    for (const rule of por_linha_parcial) {
      if (row.linha_codigo !== rule.linha_codigo) continue;
      if (matchesBlocoExceto(row, rule.exceto)) return row;
      return mergeBlocoOverride(row, rule.aplicar);
    }
    return mergeBlocoOverride(row, por_linha_codigo[row.linha_codigo]);
  });
}

async function readSheet(ws, linhasIndex) {
  const headerRow = ws.getRow(1);
  const headers = headerRow.values.slice(1).map((h) => String(h ?? '').trim());
  const idx = Object.fromEntries(headers.map((h, i) => [h, i + 1]));
  const rows = [];

  for (let r = 2; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r);
    const get = (k) => cellStr(row.getCell(idx[k]));
    const codigo = get('codigo_interno');
    if (!codigo) continue;

    const linhaCell = get('linha');
    const meta = resolveLinhaMeta(linhaCell, linhasIndex);
    const pathway = (() => {
      const match = linhaCell.match(/^(.*)·([NRC])$/i);
      if (!match) return { sufixo: '', papel: 'default' };
      const sufixo = match[2].toUpperCase();
      const papel = { N: 'nucleo', C: 'complemento', R: 'receita' }[sufixo] || 'default';
      return { sufixo, papel };
    })();
    const pc = get('produto_compra');
    const solo = meta.tipo === 'solo';

    rows.push({
      bloco: get('bloco'),
      sub_bloco: get('sub_bloco'),
      etapa: get('etapa'),
      core: get('core') || '',
      linha: linhaCell,
      linha_display: linhaCell.replace(/·[NRC]$/i, '').trim() || linhaCell,
      pathway_sufixo: pathway.sufixo,
      pathway_papel: pathway.papel,
      linha_pathway_key: pathway.sufixo ? `${meta.codigo}::${pathway.sufixo}` : meta.codigo,
      linha_codigo: meta.codigo,
      linha_nome: meta.nome,
      linha_tipo: meta.tipo,
      linha_ordem: meta.ordem ?? 900,
      linha_grupo: meta.grupo || '',
      produto_compra: solo ? '' : pc,
      produto_compra_nome: solo ? '' : pc,
      eixo_a: get('eixo_a'),
      eixo_b: get('eixo_b'),
      codigo_interno: codigo.toUpperCase(),
      novo_sku: get('novo_sku') || get('sku_atual'),
      sku_atual: get('sku_atual'),
      status_mix: get('status_mix') || 'tem',
      solo,
    });
  }
  return rows;
}

async function main() {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel não encontrado: ${EXCEL_PATH}`);
  }

  const linhasIndex = loadLinhasMestre();
  const blocoOverrides = loadBlocoOverrides();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);

  const skusRaw = [];
  const sheetsRead = [];

  for (const name of DATA_SHEETS) {
    const ws = wb.getWorksheet(name);
    if (!ws) {
      console.warn(`[estudo-manifest] folha omitida (não existe): ${name}`);
      continue;
    }
    const part = await readSheet(ws, linhasIndex);
    skusRaw.push(...part);
    sheetsRead.push({ name, count: part.length });
  }

  const skusSpray = applySprayLinhaRulesAll(skusRaw, linhasIndex.linhas);
  const skus = applyBlocoOverrides(skusSpray, blocoOverrides);
  const overrideCount = skus.filter((row, i) => row !== skusSpray[i]).length;
  if (overrideCount) {
    console.log(`[estudo-manifest] ${overrideCount} SKU(s) com bloco/tipo override (estudoCatalogBlocoOverrides.json)`);
  }

  const linhasMap = new Map();
  for (const row of skus) {
    if (!linhasMap.has(row.linha_codigo)) {
      linhasMap.set(row.linha_codigo, {
        codigo: row.linha_codigo,
        nome: row.linha_nome,
        tipo: row.linha_tipo,
        ordem: row.linha_ordem,
        grupo: row.linha_grupo,
        sku_count: 0,
      });
    }
    linhasMap.get(row.linha_codigo).sku_count += 1;
  }

  const blocosMap = new Map();
  for (const row of skus) {
    const k = `${row.bloco}\x00${row.sub_bloco}`;
    if (!blocosMap.has(k)) {
      blocosMap.set(k, { bloco: row.bloco, sub_bloco: row.sub_bloco, sku_count: 0 });
    }
    blocosMap.get(k).sku_count += 1;
  }

  const payload = {
    version: new Date().toISOString().slice(0, 10),
    source: 'docs/exports/P38-sku-hierarquia-ab.xlsx',
    linhas_mestre_version: linhasIndex.version,
    bloco_overrides_version: blocoOverrides.version || null,
    sheets: sheetsRead,
    count: skus.length,
    linhas: [...linhasMap.values()].sort((a, b) => a.ordem - b.ordem),
    blocos: [...blocosMap.values()],
    skus,
  };

  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`[estudo-manifest] ${skus.length} SKUs → ${OUT}`);
  for (const s of sheetsRead) console.log(`  · ${s.name}: ${s.count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
