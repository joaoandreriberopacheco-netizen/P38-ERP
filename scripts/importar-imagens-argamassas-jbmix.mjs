#!/usr/bin/env node
/**
 * Divide embalagem JBMIX 15kg (imagem composta) e grava foto individual por SKU.
 *
 * npm run import:imagens-argamassas-jbmix
 * npm run import:imagens-argamassas-jbmix -- --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveP38Secrets } from './p38-secrets.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'docs', 'assets', 'argamassas-jbmix');
const REPORT_PATH = path.join(ROOT, 'docs', 'exports', 'inventario-argamassas-jbmix-imagens-report.json');
const BUCKET = 'produtos-imagens';
const STORAGE_PREFIX = 'catalogo/jbmix/argamassa-15kg';

const apply = process.argv.includes('--apply');

const ITEMS = [
  { codigo_interno: 'Y8B-Y4W', asset: 'ac3-15kg.png', ref: 'AC-III', storageName: 'ac3-15kg.png' },
  { codigo_interno: 'MM7-CF9', asset: 'ac2-15kg.png', ref: 'AC-II', storageName: 'ac2-15kg.png' },
  { codigo_interno: '41W-A3S', asset: 'ac1-15kg.png', ref: 'AC-I', storageName: 'ac1-15kg.png' },
];

const secrets = resolveP38Secrets();
const SUPABASE_URL = secrets.viteSupabaseUrl || 'https://zhonvxkkqabfdyehyxpu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || secrets.viteSupabaseAnonKey;

if (!SUPABASE_KEY) {
  console.error('[import-imagens-argamassas-jbmix] Sem chave Supabase.');
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function sbFetch(pathSuffix, { method = 'GET', body, prefer, contentType } = {}) {
  const h = { ...headers };
  if (prefer) h.Prefer = prefer;
  if (contentType) h['Content-Type'] = contentType;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathSuffix}`, {
    method,
    headers: h,
    body: body && contentType?.includes('json') ? JSON.stringify(body) : body,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${pathSuffix} → ${res.status}: ${text}`);
  return data;
}

async function uploadToStorage(storagePath, bytes, contentType) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: bytes,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`upload ${storagePath} → ${res.status}: ${text}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
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
        fonte: 'import',
        fonte_ref: imagem.fonte_ref,
        ativo: true,
      },
      prefer: 'return=minimal',
      contentType: 'application/json',
    });
  } else {
    for (const row of existing || []) {
      if (row.url !== imagem.url) {
        await sbFetch(`produto_imagem?id=eq.${row.id}`, {
          method: 'PATCH',
          body: { principal: false },
          prefer: 'return=minimal',
          contentType: 'application/json',
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
        fonte: 'import',
        fonte_ref: imagem.fonte_ref,
        ativo: true,
      }],
      prefer: 'return=minimal',
      contentType: 'application/json',
    });
  }

  await sbFetch(`produto?id=eq.${produtoId}`, {
    method: 'PATCH',
    body: { imagem_url: imagem.url },
    prefer: 'return=minimal',
    contentType: 'application/json',
  });
}

async function main() {
  const report = {
    generated_at: new Date().toISOString(),
    apply,
    fonte: 'Embalagem JBMIX 15kg (recorte individual)',
    items: [],
    missing: [],
  };

  for (const item of ITEMS) {
    const localPath = path.join(ASSETS_DIR, item.asset);
    if (!fs.existsSync(localPath)) {
      report.missing.push({ ...item, error: 'asset em falta — correr split no README' });
      console.log(`✗ ${item.codigo_interno} asset em falta`);
      continue;
    }

    const bytes = fs.readFileSync(localPath);
    const storagePath = `${STORAGE_PREFIX}/${item.storageName}`;
    const fonte_ref = `jbmix-embalagem-2026:${item.ref}`;

    let publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
    if (apply) {
      publicUrl = await uploadToStorage(storagePath, bytes, 'image/png');
    }

    const produtos = await sbFetch(
      `produto?select=id,codigo_interno,nome,imagem_url&codigo_interno=eq.${encodeURIComponent(item.codigo_interno)}`,
    );
    const produto = produtos?.[0];
    if (!produto?.id) {
      report.missing.push({ ...item, error: 'produto não encontrado' });
      console.log(`✗ ${item.codigo_interno} produto não encontrado`);
      continue;
    }

    report.items.push({
      codigo_interno: item.codigo_interno,
      ref: item.ref,
      local_path: localPath,
      url: publicUrl,
      fonte_ref,
    });
    console.log(`✓ ${item.codigo_interno} ${item.ref} → ${publicUrl}`);

    if (apply) {
      await upsertImagem(produto.id, { url: publicUrl, fonte_ref });
    }
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log('\n[import-imagens-argamassas-jbmix] Relatório:', REPORT_PATH);

  if (!apply) {
    console.log('\nDry-run. Para aplicar: npm run import:imagens-argamassas-jbmix -- --apply');
  }
}

main().catch((err) => {
  console.error('[import-imagens-argamassas-jbmix]', err);
  process.exit(1);
});
