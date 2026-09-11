#!/usr/bin/env node
/**
 * Merge inventário físico cubas Japi → P38 (categoria H, linha CUBA DE APOIO).
 *
 * npm run merge:inventario-cubas-japi
 * npm run merge:inventario-cubas-japi -- --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveP38Secrets } from './p38-secrets.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MAP_PATH = path.join(ROOT, 'docs', 'exports', 'inventario-cubas-merge-map.json');
const REPORT_PATH = path.join(ROOT, 'docs', 'exports', 'inventario-cubas-merge-report.json');

const apply = process.argv.includes('--apply');
const secrets = resolveP38Secrets();
const SUPABASE_URL = secrets.viteSupabaseUrl || 'https://zhonvxkkqabfdyehyxpu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || secrets.viteSupabaseAnonKey;

if (!SUPABASE_KEY) {
  console.error('[merge-cubas-japi] Sem chave Supabase.');
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
  if (!res.ok) throw new Error(`${method} ${pathSuffix} → ${res.status}: ${text}`);
  return data;
}

async function fetchAllProdutos() {
  const all = [];
  let offset = 0;
  while (true) {
    const batch = await sbFetch(
      `produto?select=id,codigo_interno,nome,categoria_id,categoria_nome,campo_hierarquico_1,campo_hierarquico_2,campo_hierarquico_4,campo_hierarquico_5,marca,estoque_atual,ativo,tags&order=codigo_interno&limit=500&offset=${offset}`,
    );
    all.push(...batch);
    if (batch.length < 500) break;
    offset += 500;
  }
  return all;
}

function mergeTags(existing, required) {
  const set = new Set([...(existing || []), ...required]);
  return [...set];
}

function isCubaJapiScope(produto) {
  if (!(produto.categoria_nome || '').startsWith('H -')) return false;
  const h1 = String(produto.campo_hierarquico_1 || '').toUpperCase();
  const nome = String(produto.nome || '').toUpperCase();
  return h1 === 'CUBA DE APOIO' && nome.includes('JAPI');
}

function buildFields(entry, mixTag) {
  const nome = (entry.nome || '').toUpperCase();
  return {
    nome,
    campo_hierarquico_1: 'CUBA DE APOIO',
    campo_hierarquico_2: entry.campo_hierarquico_2 || null,
    campo_hierarquico_4: entry.ref_japi || null,
    campo_hierarquico_5: 'JAPI',
    marca: 'JAPI',
    estoque_atual: Number(entry.qtd) || 0,
    ativo: true,
    tags: mergeTags([], [mixTag, 'CUBA DE APOIO', 'JAPI']),
  };
}

async function main() {
  const mapConfig = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
  const mixTag = mapConfig.mix_tag || 'mix-cubas-japi-2026';
  const produtos = await fetchAllProdutos();
  const byCode = new Map(
    produtos.filter((p) => p.codigo_interno).map((p) => [String(p.codigo_interno).toUpperCase(), p]),
  );

  const sample = produtos.find((p) => p.codigo_interno === 'RHN-8PH') || produtos.find(isCubaJapiScope);
  const categoriaId = sample?.categoria_id || '6a3e8eb034482830bdba461f';
  const categoriaNome = mapConfig.categoria?.nome || 'H - ACABAMENTOS PARA ÁREAS MOLHADAS';

  const keepCodes = new Set();
  const report = {
    generated_at: new Date().toISOString(),
    apply,
    reuse: [],
    zero: [],
    errors: [],
  };

  for (const entry of mapConfig.items) {
    const code = String(entry.p38_codigo_interno || '').toUpperCase();
    const existing = byCode.get(code);
    if (!existing) {
      report.errors.push({ item: entry.item, code, error: 'SKU não encontrado' });
      continue;
    }

    keepCodes.add(code);
    const fields = buildFields(entry, mixTag);
    const payload = {
      ...fields,
      categoria_id: categoriaId,
      categoria_nome: categoriaNome,
      tags: mergeTags(existing.tags, fields.tags),
    };

    report.reuse.push({
      item: entry.item,
      codigo_interno: existing.codigo_interno,
      ref_japi: entry.ref_japi,
      id: existing.id,
      estoque_anterior: existing.estoque_atual,
      estoque_novo: fields.estoque_atual,
      payload,
    });
  }

  for (const row of mapConfig.zero_skus || []) {
    const code = String(row.p38_codigo_interno || '').toUpperCase();
    const existing = byCode.get(code);
    if (!existing) {
      report.errors.push({ code, error: 'SKU zero não encontrado' });
      continue;
    }
    report.zero.push({
      codigo_interno: existing.codigo_interno,
      ref_japi: row.ref_japi,
      id: existing.id,
      estoque_anterior: existing.estoque_atual,
      nome: existing.nome,
      motivo: row.motivo || 'fora do estoque físico',
      payload: {
        estoque_atual: 0,
        ativo: true,
        campo_hierarquico_4: row.ref_japi || existing.campo_hierarquico_4,
        campo_hierarquico_5: 'JAPI',
        marca: 'JAPI',
        categoria_id: categoriaId,
        categoria_nome: categoriaNome,
      },
    });
  }

  if (mapConfig.zero_out_of_mix) {
    for (const produto of produtos) {
      if (!isCubaJapiScope(produto)) continue;
      const code = String(produto.codigo_interno || '').toUpperCase();
      if (!code || keepCodes.has(code)) continue;
      if (report.zero.some((z) => z.id === produto.id)) continue;
      report.zero.push({
        codigo_interno: produto.codigo_interno,
        id: produto.id,
        estoque_anterior: produto.estoque_atual,
        nome: produto.nome,
        motivo: 'cuba Japi fora do mix — zerar estoque',
        payload: {
          estoque_atual: 0,
          ativo: true,
          campo_hierarquico_5: 'JAPI',
          marca: 'JAPI',
          categoria_id: categoriaId,
          categoria_nome: categoriaNome,
        },
      });
    }
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log('[merge-cubas-japi] Relatório:', REPORT_PATH);
  console.log(`  Atualizar mix: ${report.reuse.length}`);
  console.log(`  Zerar estoque: ${report.zero.length}`);
  if (report.errors.length) console.log(`  Erros: ${report.errors.length}`, report.errors);

  if (!apply) {
    console.log('\nDry-run. Para aplicar: npm run merge:inventario-cubas-japi -- --apply');
    return;
  }

  for (const item of report.reuse) {
    await sbFetch(`produto?id=eq.${item.id}`, {
      method: 'PATCH',
      body: item.payload,
      prefer: 'return=minimal',
    });
    console.log(`[update] ${item.codigo_interno} ref ${item.ref_japi} estoque ${item.estoque_anterior} → ${item.estoque_novo}`);
  }

  for (const item of report.zero) {
    await sbFetch(`produto?id=eq.${item.id}`, {
      method: 'PATCH',
      body: item.payload,
      prefer: 'return=minimal',
    });
    console.log(`[zero] ${item.codigo_interno} estoque ${item.estoque_anterior} → 0`);
  }

  console.log('\n[merge-cubas-japi] Concluído. Correr: npm run import:imagens-cubas-japi -- --apply');
}

main().catch((err) => {
  console.error('[merge-cubas-japi]', err);
  process.exit(1);
});
