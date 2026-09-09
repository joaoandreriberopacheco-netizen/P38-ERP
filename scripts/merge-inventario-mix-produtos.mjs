#!/usr/bin/env node
/**
 * Merge do mix real (Excel) com o cadastro P38 — categoria H (torneiras/chuveiros).
 *
 * Regras:
 * - Excel é a fonte da verdade (descrição, ref. fabricante, estoque).
 * - Itens com match reaproveitam o SKU existente (codigo_interno P38).
 * - Itens sem match são cadastrados.
 * - SKUs do mix (categoria H) sem match no Excel são descontinuados (ativo=false).
 *
 * Uso:
 *   npm run merge:inventario-mix              # dry-run
 *   npm run merge:inventario-mix -- --apply   # aplica
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import ExcelJS from 'exceljs';
import {
  generateRandomProductCode,
  normalizeProductCodeForSearch,
} from '../src/lib/productCode.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MAP_PATH = path.join(ROOT, 'docs', 'exports', 'inventario-mix-merge-map.json');
const XLSX_PATH = path.join(ROOT, 'docs', 'Inventario_Produtos_Consolidado-v2.xlsx');
const REPORT_PATH = path.join(ROOT, 'docs', 'exports', 'inventario-mix-merge-report.json');

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL
  || 'https://zhonvxkkqabfdyehyxpu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
  console.error('[merge-inventario-mix] Defina SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function sbFetch(pathSuffix, { method = 'GET', body, prefer } = {}) {
  const h = { ...headers };
  if (prefer) h.Prefer = prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathSuffix}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    throw new Error(`${method} ${pathSuffix} → ${res.status}: ${text}`);
  }
  return data;
}

async function fetchAllProdutos() {
  const all = [];
  let offset = 0;
  const page = 1000;
  while (true) {
    const batch = await sbFetch(
      `produto?select=id,codigo_interno,nome,categoria_nome,campo_hierarquico_1,campo_hierarquico_2,campo_hierarquico_3,campo_hierarquico_4,campo_hierarquico_5,marca,codigo_barras,estoque_atual,ativo,unidade_principal,preco_venda_padrao,preco_venda_tipo,preco_venda_percentual,valor_compra,preco_custo_calculado,tipo,tags&order=codigo_interno&limit=${page}&offset=${offset}`,
    );
    all.push(...batch);
    if (batch.length < page) break;
    offset += page;
  }
  return all;
}

function normalizeMarca(marca) {
  const raw = String(marca || '').trim();
  if (!raw || /^gen[eé]rico$/i.test(raw) || /^avulso$/i.test(raw)) return null;
  return raw.split('/')[0].trim();
}

function buildProdutoFields(row) {
  const tipo = String(row.tipo || '').trim().toUpperCase();
  const app = String(row.app || '').trim();
  const inst = String(row.inst || '').trim();
  const ref = String(row.ref || '').trim();
  const desc = String(row.desc || '').trim();
  const marca = normalizeMarca(row.marca);

  const nome = desc.toUpperCase();
  const h1 = tipo || null;
  const h2 = app || null;
  const h3 = inst || null;
  const h4 = ref && !/^avulso$/i.test(ref) ? ref : null;
  const h5 = marca || null;

  const tags = ['mix-inventario-2026'];
  if (tipo) tags.push(tipo);
  if (app) tags.push(app);
  if (marca) tags.push(marca);

  return {
    nome,
    campo_hierarquico_1: h1,
    campo_hierarquico_2: h2,
    campo_hierarquico_3: h3,
    campo_hierarquico_4: h4,
    campo_hierarquico_5: h5,
    marca,
    codigo_barras: h4,
    estoque_atual: Number(row.qtd) || 0,
    ativo: true,
    tags,
  };
}

async function loadInventoryRows() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);
  const ws = wb.getWorksheet('Inventário Padronizado');
  const rows = [];
  let headerIdx = -1;
  ws.eachRow((row, rowNumber) => {
    const vals = row.values.slice(1).map((v) => (v == null ? '' : v));
    if (headerIdx < 0) {
      if (vals[0] === 'Item') headerIdx = rowNumber;
      return;
    }
    if (rowNumber <= headerIdx) return;
    const item = vals[0];
    if (item == null || String(item).toUpperCase().startsWith('TOTAL')) return;
    rows.push({
      item: Number(item),
      ref: String(vals[1] || '').trim(),
      desc: String(vals[2] || '').trim(),
      tipo: String(vals[3] || '').trim(),
      app: String(vals[4] || '').trim(),
      inst: String(vals[5] || '').trim(),
      marca: String(vals[6] || '').trim(),
      qtd: Number(vals[7]) || 0,
    });
  });
  return rows;
}

function consolidateInventory(rows, mapConfig) {
  const byItem = new Map(rows.map((r) => [r.item, r]));
  const consolidated = new Map();

  for (const entry of mapConfig.items) {
    if (entry.consolidated_into) continue;
    const row = byItem.get(entry.item);
    if (!row) throw new Error(`Item ${entry.item} não encontrado no Excel.`);

    let qtd = row.qtd;
    if (entry.consolidate_with) {
      const other = byItem.get(entry.consolidate_with);
      if (other) qtd += other.qtd;
    }

    const key = entry.p38_codigo_interno || `new:${entry.ref}:${entry.item}`;
    if (consolidated.has(key)) {
      const prev = consolidated.get(key);
      prev.qtd += qtd;
      prev.source_items.push(entry.item);
    } else {
      consolidated.set(key, {
        ...row,
        qtd,
        map: entry,
        source_items: [entry.item],
      });
    }
  }

  return [...consolidated.values()];
}

function isMixScope(produto, regex) {
  const blob = [
    produto.categoria_nome,
    produto.nome,
    produto.campo_hierarquico_1,
    produto.campo_hierarquico_2,
  ].join(' ').toLowerCase();
  if (!(produto.categoria_nome || '').startsWith('H -')) return false;
  return regex.test(blob);
}

function newProdutoId() {
  return randomBytes(12).toString('hex');
}

function templateFromExisting(existing, fields, categoria, codigoInterno) {
  const sample = existing.find((p) => (p.categoria_nome || '').startsWith('H -')) || existing[0] || {};
  return {
    id: newProdutoId(),
    codigo_interno: codigoInterno,
    categoria_id: categoria.id,
    categoria_nome: categoria.nome,
    tipo: sample.tipo || 'PRODUTO',
    unidade_principal: sample.unidade_principal || 'UN',
    unidade_vitrine: sample.unidade_vitrine || '',
    unidades_por_pacote: sample.unidades_por_pacote || '1',
    unidades_alternativas: sample.unidades_alternativas || [],
    preco_venda_padrao: 0,
    preco_venda_tipo: sample.preco_venda_tipo || 'percentual',
    preco_venda_percentual: sample.preco_venda_percentual || 40,
    valor_compra: 0,
    preco_custo_calculado: 0,
    casas_decimais: 0,
    estoque_minimo: 0,
    controla_serial: false,
    controla_lote: false,
    controla_validade: false,
    ...fields,
  };
}

async function main() {
  const mapConfig = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
  const inventoryRows = await loadInventoryRows();
  const consolidated = consolidateInventory(inventoryRows, mapConfig);
  const produtos = await fetchAllProdutos();
  const byCode = new Map(
    produtos
      .filter((p) => p.codigo_interno)
      .map((p) => [String(p.codigo_interno).toUpperCase(), p]),
  );
  const takenCodes = new Set(
    produtos
      .map((p) => normalizeProductCodeForSearch(p.codigo_interno))
      .filter(Boolean),
  );

  const mixRegex = new RegExp(mapConfig.mix_scope_regex, 'i');
  const keepCodes = new Set();
  const report = {
    generated_at: new Date().toISOString(),
    apply,
    reuse: [],
    create: [],
    keep: [],
    deactivate: [],
    deactivate_duplicates: [],
    errors: [],
  };

  for (const row of consolidated) {
    const fields = buildProdutoFields(row);
    const code = row.map.p38_codigo_interno;

    if (code) {
      const existing = byCode.get(code.toUpperCase());
      if (!existing) {
        report.errors.push({ item: row.source_items, ref: row.ref, code, error: 'SKU P38 não encontrado' });
        continue;
      }
      keepCodes.add(code.toUpperCase());
      report.reuse.push({
        items: row.source_items,
        ref: row.ref,
        codigo_interno: code,
        id: existing.id,
        nome_novo: fields.nome,
        estoque_novo: fields.estoque_atual,
        estoque_anterior: existing.estoque_atual,
        payload: {
          ...fields,
          categoria_id: mapConfig.categoria.id,
          categoria_nome: mapConfig.categoria.nome,
        },
      });
    } else {
      const codigoInterno = generateRandomProductCode(takenCodes);
      takenCodes.add(normalizeProductCodeForSearch(codigoInterno));
      const payload = templateFromExisting(produtos, fields, mapConfig.categoria, codigoInterno);
      keepCodes.add(codigoInterno.toUpperCase());
      report.create.push({
        items: row.source_items,
        ref: row.ref,
        codigo_interno: codigoInterno,
        id: payload.id,
        nome: payload.nome,
        estoque: payload.estoque_atual,
      });
      row._createPayload = payload;
    }
  }

  for (const entry of mapConfig.manual_keep || []) {
    const code = String(entry.p38_codigo_interno || '').toUpperCase();
    if (!code) continue;
    const existing = byCode.get(code);
    if (!existing) {
      report.errors.push({ code, ref: entry.ref, error: 'SKU manual_keep não encontrado' });
      continue;
    }
    keepCodes.add(code);
    const tags = new Set(existing.tags || []);
    tags.delete('descontinuado-mix-2026');
    tags.add('mix-inventario-2026');
    report.keep.push({
      codigo_interno: existing.codigo_interno,
      id: existing.id,
      nome: existing.nome,
      ref: entry.ref,
      nota: entry.nota,
      payload: {
        ativo: true,
        tags: [...tags],
      },
    });
  }

  for (const code of mapConfig.deactivate_duplicates || []) {
    keepCodes.delete(code.toUpperCase());
    const existing = byCode.get(code.toUpperCase());
    if (existing?.ativo) {
      report.deactivate_duplicates.push({
        codigo_interno: code,
        id: existing.id,
        nome: existing.nome,
        motivo: 'duplicata no cadastro',
      });
    }
  }

  for (const produto of produtos) {
    if (!produto.ativo) continue;
    if (!isMixScope(produto, mixRegex)) continue;
    const code = String(produto.codigo_interno || '').toUpperCase();
    if (!code || keepCodes.has(code)) continue;
    report.deactivate.push({
      codigo_interno: produto.codigo_interno,
      id: produto.id,
      nome: produto.nome,
      estoque_atual: produto.estoque_atual,
      motivo: 'fora do mix inventário',
    });
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log('[merge-inventario-mix] Relatório:', REPORT_PATH);
  console.log(`  Reaproveitar: ${report.reuse.length}`);
  console.log(`  Cadastrar:    ${report.create.length}`);
  console.log(`  Manter:       ${report.keep.length}`);
  console.log(`  Descontinuar: ${report.deactivate.length} (+ ${report.deactivate_duplicates.length} duplicatas)`);
  if (report.errors.length) console.log(`  Erros:        ${report.errors.length}`, report.errors);

  if (!apply) {
    console.log('\nDry-run. Para aplicar: npm run merge:inventario-mix -- --apply');
    return;
  }

  let updated = 0;
  for (const item of report.reuse) {
    await sbFetch(`produto?id=eq.${item.id}`, {
      method: 'PATCH',
      body: item.payload,
      prefer: 'return=minimal',
    });
    updated += 1;
    console.log(`[update] ${item.codigo_interno} estoque=${item.payload.estoque_atual}`);
  }

  for (const item of report.create) {
    const row = consolidated.find((r) => r._createPayload?.id === item.id);
    if (!row?._createPayload) continue;
    await sbFetch('produto', {
      method: 'POST',
      body: row._createPayload,
      prefer: 'return=minimal',
    });
    console.log(`[create] ${item.codigo_interno} ${item.nome.slice(0, 60)}`);
  }

  for (const item of report.keep) {
    await sbFetch(`produto?id=eq.${item.id}`, {
      method: 'PATCH',
      body: item.payload,
      prefer: 'return=minimal',
    });
    console.log(`[keep] ${item.codigo_interno} ${item.nome.slice(0, 60)}`);
  }

  const toDeactivate = [...report.deactivate, ...report.deactivate_duplicates];
  for (const item of toDeactivate) {
    const tags = ['descontinuado-mix-2026'];
    await sbFetch(`produto?id=eq.${item.id}`, {
      method: 'PATCH',
      body: { ativo: false, tags },
      prefer: 'return=minimal',
    });
    console.log(`[deactivate] ${item.codigo_interno}`);
  }

  console.log(`\n[merge-inventario-mix] Concluído. ${updated} atualizados, ${report.create.length} criados, ${toDeactivate.length} descontinuados.`);
}

main().catch((err) => {
  console.error('[merge-inventario-mix]', err);
  process.exit(1);
});
