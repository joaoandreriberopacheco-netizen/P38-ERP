#!/usr/bin/env node
/**
 * Importa fotos oficiais Japi (VTEX) para cubas de apoio do mix.
 *
 * npm run import:imagens-cubas-japi
 * npm run import:imagens-cubas-japi -- --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveP38Secrets } from './p38-secrets.mjs';
import { resolveJapiCubaImagem, JAPI_CUBA_IMAGENS } from './lib/japiCubaImagens.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MAP_PATH = path.join(ROOT, 'docs', 'exports', 'inventario-cubas-merge-map.json');
const REPORT_PATH = path.join(ROOT, 'docs', 'exports', 'inventario-cubas-imagens-report.json');

const apply = process.argv.includes('--apply');
const includeZero = process.argv.includes('--all');
const secrets = resolveP38Secrets();
const SUPABASE_URL = secrets.viteSupabaseUrl || 'https://zhonvxkkqabfdyehyxpu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || secrets.viteSupabaseAnonKey;

if (!SUPABASE_KEY) {
  console.error('[import-imagens-cubas-japi] Sem chave Supabase.');
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

async function upsertImagem(produtoId, imagem) {
  const existing = await sbFetch(
    `produto_imagem?select=id,url,ativo&produto_id=eq.${produtoId}&order=principal.desc,ordem.asc&limit=50`,
  );

  const same = (existing || []).find((row) => row.url === imagem.url);
  if (same) {
    await sbFetch(`produto_imagem?id=eq.${same.id}`, {
      method: 'PATCH',
      body: {
        principal: true,
        ordem: 0,
        tipo: 'principal',
        fonte: imagem.fonte,
        fonte_ref: imagem.fonte_ref,
        ativo: true,
      },
      prefer: 'return=minimal',
    });
  } else {
    for (const row of existing || []) {
      if (row.url !== imagem.url) {
        await sbFetch(`produto_imagem?id=eq.${row.id}`, {
          method: 'PATCH',
          body: { principal: false },
          prefer: 'return=minimal',
        });
      }
    }

    await sbFetch('produto_imagem', {
      method: 'POST',
      body: [{
        produto_id: produtoId,
        url: imagem.url,
        tipo: 'principal',
        ordem: 0,
        principal: true,
        fonte: imagem.fonte,
        fonte_ref: imagem.fonte_ref,
        ativo: true,
      }],
      prefer: 'return=minimal',
    });
  }

  await sbFetch(`produto?id=eq.${produtoId}`, {
    method: 'PATCH',
    body: { imagem_url: imagem.url },
    prefer: 'return=minimal',
  });
}

async function main() {
  const map = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
  const report = {
    generated_at: new Date().toISOString(),
    apply,
    fonte: 'Japi VTEX (lojajapi.com.br)',
    resolved: [],
    missing: [],
  };

  const rows = [
    ...map.items,
    ...(includeZero ? (map.zero_skus || []) : []),
  ];

  for (const row of rows) {
    const codigo = row.p38_codigo_interno;
    const imagem = resolveJapiCubaImagem(row.ref_japi, {
      refImagemJapi: row.ref_imagem_japi,
    });
    if (!imagem?.url) {
      report.missing.push({ item: row.item, codigo_interno: codigo, ref_japi: row.ref_japi });
      console.log(`✗ ${codigo || row.ref_japi} sem imagem`);
      continue;
    }

    const produtos = await sbFetch(
      `produto?select=id,codigo_interno,nome&codigo_interno=eq.${encodeURIComponent(codigo)}`,
    );
    const produto = produtos?.[0];
    if (!produto?.id) {
      report.missing.push({ codigo_interno: codigo, error: 'produto não encontrado' });
      console.log(`✗ ${codigo} produto não encontrado`);
      continue;
    }

    report.resolved.push({
      item: row.item,
      codigo_interno: codigo,
      ref_japi: row.ref_japi,
      url: imagem.url,
      fonte_ref: imagem.fonte_ref,
    });
    console.log(`✓ ${codigo} ${row.ref_japi} → ${imagem.fonte_ref}`);

    if (apply) {
      await upsertImagem(produto.id, imagem);
    }
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log('\n[import-imagens-cubas-japi] Relatório:', REPORT_PATH);
  console.log(`  Resolvidas: ${report.resolved.length}/${rows.length}`);
  if (report.missing.length) console.log(`  Em falta: ${report.missing.length}`);

  if (!apply) {
    console.log('\nDry-run. Para aplicar: npm run import:imagens-cubas-japi -- --apply');
    console.log(`Mapa VTEX: ${Object.keys(JAPI_CUBA_IMAGENS).length} refs`);
  }
}

main().catch((err) => {
  console.error('[import-imagens-cubas-japi]', err);
  process.exit(1);
});
