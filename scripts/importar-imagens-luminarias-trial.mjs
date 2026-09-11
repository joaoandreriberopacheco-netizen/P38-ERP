#!/usr/bin/env node
/**
 * Importa fotos Trial Elétricos para luminárias LED e spots do mix P38.
 *
 * npm run import:imagens-luminarias-trial
 * npm run import:imagens-luminarias-trial -- --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveP38Secrets } from './p38-secrets.mjs';
import {
  TRIAL_LUMINARIA_SKUS,
  fetchTrialCatalog,
  resolveTrialLuminariaImagem,
} from './lib/trialLuminariaCatalog.mjs';
import { ensureThumbFromImageUrl } from './lib/produtoThumbStorage.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'docs', 'exports', 'inventario-luminarias-trial-imagens-report.json');
const SNAPSHOT_PATH = path.join(ROOT, 'docs', 'exports', 'trial-luminarias-catalog-snapshot.json');

const apply = process.argv.includes('--apply');
const secrets = resolveP38Secrets();
const SUPABASE_URL = secrets.viteSupabaseUrl || 'https://zhonvxkkqabfdyehyxpu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || secrets.viteSupabaseAnonKey;

if (!SUPABASE_KEY) {
  console.error('[import-imagens-luminarias-trial] Sem chave Supabase.');
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

async function upsertImagem(produtoId, imagem, codigoInterno) {
  const thumbUrl = await ensureThumbFromImageUrl({
    imageUrl: imagem.url,
    codigoInterno,
    supabaseUrl: SUPABASE_URL,
    supabaseKey: SUPABASE_KEY,
  });

  const existing = await sbFetch(
    `produto_imagem?select=id,url,ativo&produto_id=eq.${produtoId}&order=principal.desc,ordem.asc&limit=50`,
  );

  const rowBody = {
    principal: true,
    ordem: 0,
    tipo: 'principal',
    fonte: imagem.fonte,
    fonte_ref: imagem.fonte_ref,
    ativo: true,
    ...(thumbUrl ? { url_thumb: thumbUrl } : {}),
  };

  const same = (existing || []).find((row) => row.url === imagem.url);
  if (same) {
    await sbFetch(`produto_imagem?id=eq.${same.id}`, {
      method: 'PATCH',
      body: rowBody,
      prefer: 'return=minimal',
    });
  } else {
    for (const row of existing || []) {
      if (row.url !== imagem.url) {
        await sbFetch(`produto_imagem?id=eq.${row.id}`, {
          method: 'PATCH',
          body: { principal: false, ativo: false },
          prefer: 'return=minimal',
        });
      }
    }

    await sbFetch('produto_imagem', {
      method: 'POST',
      body: [{
        produto_id: produtoId,
        url: imagem.url,
        ...rowBody,
      }],
      prefer: 'return=minimal',
    });
  }

  await sbFetch(`produto?id=eq.${produtoId}`, {
    method: 'PATCH',
    body: {
      imagem_url: imagem.url,
      ...(thumbUrl ? { imagem_thumb_url: thumbUrl } : {}),
    },
    prefer: 'return=minimal',
  });
}

async function main() {
  const catalog = await fetchTrialCatalog();
  const snapshot = {
    generated_at: new Date().toISOString(),
    fonte: 'https://trialeletricos.com.br/wp-json/wc/store/products',
    count: catalog.size,
    items: [...catalog.values()],
  };
  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2));

  const report = {
    generated_at: new Date().toISOString(),
    apply,
    fonte: 'Trial Elétricos (trialeletricos.com.br)',
    snapshot: SNAPSHOT_PATH,
    resolved: [],
    missing: [],
    skipped_no_trial: [
      { codigo_interno: '7X7-W6L', nome: 'LUMINÁRIA LED TATARTARUGA 6500K 12W', motivo: 'não listada no catálogo Trial online' },
      { codigo_interno: 'MNG-PX8', nome: 'SPOT LED AUXILIAR GRANDE 06W QUAD 6500K', motivo: 'Trial só tem spot 03W' },
      { codigo_interno: 'W70-3U1', nome: 'SPOT LED AUXILIAR GRANDE 06W RED 3000K', motivo: 'Trial só tem spot 03W' },
    ],
  };

  for (const codigo of TRIAL_LUMINARIA_SKUS) {
    const imagem = resolveTrialLuminariaImagem(codigo, catalog);
    if (!imagem?.url) {
      report.missing.push({ codigo_interno: codigo, error: 'slug Trial sem imagem' });
      console.log(`✗ ${codigo} slug Trial sem imagem`);
      continue;
    }

    const produtos = await sbFetch(
      `produto?select=id,codigo_interno,nome,imagem_url&codigo_interno=eq.${encodeURIComponent(codigo)}`,
    );
    const produto = produtos?.[0];
    if (!produto?.id) {
      report.missing.push({ codigo_interno: codigo, error: 'produto não encontrado' });
      console.log(`✗ ${codigo} produto não encontrado`);
      continue;
    }

    report.resolved.push({
      codigo_interno: codigo,
      nome: produto.nome,
      trial_slug: imagem.trial_slug,
      trial_permalink: imagem.trial_permalink,
      url: imagem.url,
      fonte_ref: imagem.fonte_ref,
      fallback: imagem.fallback,
    });

    const fb = imagem.fallback ? ` [${imagem.fallback}]` : '';
    console.log(`✓ ${codigo} → ${imagem.trial_slug}${fb}`);

    if (apply) {
      await upsertImagem(produto.id, imagem, codigo);
    }
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log('\n[import-imagens-luminarias-trial] Snapshot:', SNAPSHOT_PATH);
  console.log('[import-imagens-luminarias-trial] Relatório:', REPORT_PATH);
  console.log(`  Resolvidas: ${report.resolved.length}/${TRIAL_LUMINARIA_SKUS.length}`);
  if (report.missing.length) console.log(`  Em falta: ${report.missing.length}`);
  console.log(`  Sem Trial (manual): ${report.skipped_no_trial.length}`);

  if (!apply) {
    console.log('\nDry-run. Para aplicar: npm run import:imagens-luminarias-trial -- --apply');
  }
}

main().catch((err) => {
  console.error('[import-imagens-luminarias-trial]', err);
  process.exit(1);
});
