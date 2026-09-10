#!/usr/bin/env node
/**
 * Merge mix fechaduras Stam (WhatsApp + fotos João) com cadastro P38 — categoria F.
 *
 * npm run merge:inventario-fechaduras
 * npm run merge:inventario-fechaduras -- --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { resolveP38Secrets } from './p38-secrets.mjs';
import {
  generateRandomProductCode,
  normalizeProductCodeForSearch,
} from '../src/lib/productCode.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MAP_PATH = path.join(ROOT, 'docs', 'exports', 'inventario-fechaduras-merge-map.json');
const REPORT_PATH = path.join(ROOT, 'docs', 'exports', 'inventario-fechaduras-merge-report.json');

const MIX_TAG = 'mix-fechaduras-2026';
const DEACTIVATE_TAG = 'descontinuado-mix-fechaduras-2026';
const ENROLAR_EAN = '7893858560337';

const apply = process.argv.includes('--apply');
const secrets = resolveP38Secrets();
const SUPABASE_URL = secrets.viteSupabaseUrl || 'https://zhonvxkkqabfdyehyxpu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || secrets.viteSupabaseAnonKey;

if (!SUPABASE_KEY) {
  console.error('[merge-fechaduras] Sem chave Supabase.');
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
      `produto?select=id,codigo_interno,nome,categoria_id,categoria_nome,campo_hierarquico_1,campo_hierarquico_2,campo_hierarquico_4,marca,codigo_barras,estoque_atual,ativo,tags,unidade_principal,preco_venda_tipo,preco_venda_percentual,tipo&order=codigo_interno&limit=500&offset=${offset}`,
    );
    all.push(...batch);
    if (batch.length < 500) break;
    offset += 500;
  }
  return all;
}

function newProdutoId() {
  return randomBytes(12).toString('hex');
}

function mergeTags(existing, required) {
  const set = new Set([...(existing || []), ...required]);
  return [...set];
}

function buildFields(entry) {
  const nome = (entry.nome || entry.nome_sugerido || '').toUpperCase();
  const tags = mergeTags([], [MIX_TAG, 'FECHADURA', 'STAM']);
  return {
    nome,
    campo_hierarquico_1: 'FECHADURA',
    campo_hierarquico_2: 'STAM',
    campo_hierarquico_4: entry.ref || null,
    marca: 'STAM',
    codigo_barras: entry.ean || null,
    estoque_atual: Number(entry.qtd) || 0,
    ativo: true,
    tags,
  };
}

function isFechaduraScope(produto) {
  if (!(produto.categoria_nome || '').startsWith('F -')) return false;
  const h1 = String(produto.campo_hierarquico_1 || '').toUpperCase();
  const nome = String(produto.nome || '').toUpperCase();
  return h1 === 'FECHADURA' || nome.includes('FECHADURA');
}

function templateFromSample(sample, fields, codigoInterno, categoriaId, categoriaNome) {
  return {
    id: newProdutoId(),
    codigo_interno: codigoInterno,
    categoria_id: categoriaId,
    categoria_nome: categoriaNome,
    tipo: sample?.tipo || 'PRODUTO',
    unidade_principal: sample?.unidade_principal || 'UN',
    unidade_vitrine: sample?.unidade_vitrine || '',
    unidades_por_pacote: sample?.unidades_por_pacote || '1',
    unidades_alternativas: sample?.unidades_alternativas || [],
    preco_venda_padrao: 0,
    preco_venda_tipo: sample?.preco_venda_tipo || 'percentual',
    preco_venda_percentual: sample?.preco_venda_percentual ?? 40,
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
  const produtos = await fetchAllProdutos();
  const byCode = new Map(
    produtos.filter((p) => p.codigo_interno).map((p) => [String(p.codigo_interno).toUpperCase(), p]),
  );
  const takenCodes = new Set(
    produtos.map((p) => normalizeProductCodeForSearch(p.codigo_interno)).filter(Boolean),
  );

  const sample = produtos.find((p) => p.codigo_interno === 'N60-DE4') || produtos.find(isFechaduraScope);
  const categoriaId = sample?.categoria_id || '6a3e8eb06f284a2c3a9d7245';
  const categoriaNome = mapConfig.categoria?.nome || 'F - ESQUADRIAS E FERRAGENS';

  const keepCodes = new Set();
  const report = {
    generated_at: new Date().toISOString(),
    apply,
    reuse: [],
    create: [],
    deactivate: [],
    errors: [],
    enrolar_codigo: null,
  };

  let createPayload = null;

  for (const entry of mapConfig.items) {
    const fields = buildFields(entry);
    const code = entry.p38_codigo_interno;

    if (entry.action === 'create' || !code) {
      const codigoInterno = generateRandomProductCode(takenCodes);
      takenCodes.add(normalizeProductCodeForSearch(codigoInterno));
      keepCodes.add(codigoInterno.toUpperCase());

      const enrolarFields = {
        ...fields,
        nome: 'FECHADURA STAM PARA PORTA DE ENROLAR',
        campo_hierarquico_4: 'ENROLAR',
        codigo_barras: ENROLAR_EAN,
        tags: mergeTags(fields.tags, ['PORTA DE ENROLAR']),
      };
      createPayload = templateFromSample(sample, enrolarFields, codigoInterno, categoriaId, categoriaNome);
      report.enrolar_codigo = codigoInterno;
      report.create.push({
        item: entry.item,
        codigo_interno: codigoInterno,
        nome: createPayload.nome,
        estoque: createPayload.estoque_atual,
        ean: ENROLAR_EAN,
      });
      entry._createPayload = createPayload;
      continue;
    }

    const existing = byCode.get(code.toUpperCase());
    if (!existing) {
      report.errors.push({ item: entry.item, code, error: 'SKU não encontrado' });
      continue;
    }

    keepCodes.add(code.toUpperCase());
    const payload = {
      ...fields,
      categoria_id: categoriaId,
      categoria_nome: categoriaNome,
      tags: mergeTags(existing.tags, fields.tags),
    };

    report.reuse.push({
      item: entry.item,
      codigo_interno: code,
      id: existing.id,
      estoque_anterior: existing.estoque_atual,
      estoque_novo: fields.estoque_atual,
      nome_novo: fields.nome,
      payload,
    });
  }

  for (const row of mapConfig.deactivate_skus || []) {
    const code = String(row.p38_codigo_interno || '').toUpperCase();
    const existing = byCode.get(code);
    if (existing?.ativo) {
      report.deactivate.push({
        codigo_interno: existing.codigo_interno,
        id: existing.id,
        nome: existing.nome,
        motivo: row.motivo || 'fora do mix',
      });
    }
  }

  if (mapConfig.deactivate_out_of_mix) {
    for (const produto of produtos) {
      if (!produto.ativo || !isFechaduraScope(produto)) continue;
      const code = String(produto.codigo_interno || '').toUpperCase();
      if (!code || keepCodes.has(code)) continue;
      if (report.deactivate.some((d) => d.id === produto.id)) continue;
      report.deactivate.push({
        codigo_interno: produto.codigo_interno,
        id: produto.id,
        nome: produto.nome,
        motivo: 'fechadura F fora do mix',
      });
    }
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log('[merge-fechaduras] Relatório:', REPORT_PATH);
  console.log(`  Reaproveitar: ${report.reuse.length}`);
  console.log(`  Cadastrar:    ${report.create.length}${report.enrolar_codigo ? ` (${report.enrolar_codigo})` : ''}`);
  console.log(`  Descontinuar: ${report.deactivate.length}`);
  if (report.errors.length) console.log(`  Erros:        ${report.errors.length}`, report.errors);

  if (!apply) {
    console.log('\nDry-run. Para aplicar: npm run merge:inventario-fechaduras -- --apply');
    return;
  }

  for (const item of report.reuse) {
    await sbFetch(`produto?id=eq.${item.id}`, {
      method: 'PATCH',
      body: item.payload,
      prefer: 'return=minimal',
    });
    console.log(`[update] ${item.codigo_interno} estoque ${item.estoque_anterior} → ${item.estoque_novo}`);
  }

  if (createPayload) {
    await sbFetch('produto', {
      method: 'POST',
      body: createPayload,
      prefer: 'return=minimal',
    });
    console.log(`[create] ${createPayload.codigo_interno} ${createPayload.nome}`);
  }

  for (const item of report.deactivate) {
    const existing = byCode.get(String(item.codigo_interno).toUpperCase());
    await sbFetch(`produto?id=eq.${item.id}`, {
      method: 'PATCH',
      body: {
        ativo: false,
        tags: mergeTags(existing?.tags, [DEACTIVATE_TAG]),
      },
      prefer: 'return=minimal',
    });
    console.log(`[deactivate] ${item.codigo_interno}`);
  }

  if (report.enrolar_codigo) {
    const mapRaw = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
    const item6 = mapRaw.items.find((i) => i.item === 6);
    if (item6) {
      item6.p38_codigo_interno = report.enrolar_codigo;
      item6.ean = ENROLAR_EAN;
      fs.writeFileSync(MAP_PATH, `${JSON.stringify(mapRaw, null, 2)}\n`);
    }
  }

  console.log('\n[merge-fechaduras] Concluído. Correr: npm run import:imagens-fechaduras-stam -- --apply');
}

main().catch((err) => {
  console.error('[merge-fechaduras]', err);
  process.exit(1);
});
