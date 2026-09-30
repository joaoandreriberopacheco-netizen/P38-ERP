#!/usr/bin/env node
/**
 * Importa fotos Iquine + Verbras — lata oficial + fundo na cor.
 *
 * npm run import:imagens-iquine-verbras
 * npm run import:imagens-iquine-verbras -- --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveP38Secrets } from './p38-secrets.mjs';
import { composeTintaImage } from './lib/tintaCompose.mjs';
import {
  getIquineVerbrasBaseUrl,
  resolveIquineVerbrasFonteRef,
  resolveIquineVerbrasHex,
  resolveIquineVerbrasImagemDef,
} from './lib/iquineVerbrasImagens.mjs';
import { ensureThumbFromImageUrl } from './lib/produtoThumbStorage.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'docs', 'assets', 'tintas');
const REPORT_PATH = path.join(ROOT, 'docs', 'exports', 'inventario-iquine-verbras-imagens-report.json');
const BUCKET = 'produtos-imagens';
const STORAGE_PREFIX = 'catalogo/tintas';

const apply = process.argv.includes('--apply');
const marcaFilter = process.argv.find((a) => a.startsWith('--marca='))?.split('=')[1]?.toLowerCase();
const codigoFilter = process.argv.find((a) => a.startsWith('--codigo='))?.split('=')[1]?.toUpperCase();

const secrets = resolveP38Secrets();
const SUPABASE_URL = secrets.viteSupabaseUrl || 'https://zhonvxkkqabfdyehyxpu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || secrets.viteSupabaseAnonKey;

if (!SUPABASE_KEY) {
  console.error('[import-imagens-iquine-verbras] Sem chave Supabase.');
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

const baseImageCache = new Map();

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function getBaseImage(def) {
  const url = getIquineVerbrasBaseUrl(def);
  if (!url) throw new Error('base sem URL');
  if (baseImageCache.has(url)) return baseImageCache.get(url);

  const assetKey = `${def.marca}-${def.base}`.replace(/[^a-z0-9-]/g, '-');
  const localPath = path.join(ASSETS_DIR, `${assetKey}.png`);
  let buf;
  if (fs.existsSync(localPath)) {
    buf = fs.readFileSync(localPath);
  } else {
    buf = await fetchBuffer(url);
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
    fs.writeFileSync(localPath, buf);
  }
  baseImageCache.set(url, buf);
  return buf;
}

function storageFileName(produto, def) {
  const codigo = (produto.codigo_interno || produto.id || 'produto').toLowerCase();
  const cor = def.cor ? def.cor.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : def.base;
  return `${codigo}-${def.marca}-${cor}.png`;
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

async function upsertImagem(produtoId, imagem, storageKey, imageBuffer) {
  const thumbUrl = await ensureThumbFromImageUrl({
    imageUrl: imagem.url,
    codigoInterno: storageKey,
    supabaseUrl: SUPABASE_URL,
    supabaseKey: SUPABASE_KEY,
    imageBuffer,
  });

  const existing = await sbFetch(
    `produto_imagem?select=id,url,ativo&produto_id=eq.${produtoId}&order=principal.desc,ordem.asc&limit=50`,
  );

  const rowBody = {
    principal: true,
    ordem: 0,
    tipo: 'principal',
    fonte: 'import',
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
      body: [{ produto_id: produtoId, url: imagem.url, ...rowBody }],
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

async function fetchProdutos() {
  const res = await sbFetch(
    'produto?select=id,codigo_interno,nome,imagem_url&or=(nome.ilike.*IQUINE*,nome.ilike.*VERBRAS*,nome.ilike.*ZARCOFER*)&ativo=eq.true&order=nome.asc',
  );
  return res || [];
}

async function main() {
  const produtos = await fetchProdutos();
  const report = {
    generated_at: new Date().toISOString(),
    apply,
    fonte: 'Iquine (iquine.com.br) + Verbras (verbrascorp.com.br)',
    resolved: [],
    skipped: [],
    missing: [],
  };

  for (const produto of produtos) {
    if (codigoFilter && String(produto.codigo_interno || '').toUpperCase() !== codigoFilter) continue;
    const def = resolveIquineVerbrasImagemDef(produto);
    if (!def) {
      report.skipped.push({ codigo_interno: produto.codigo_interno, nome: produto.nome, motivo: 'tipo não mapeado' });
      continue;
    }
    if (marcaFilter && def.marca !== marcaFilter) continue;

    try {
      const hex = resolveIquineVerbrasHex(def);
      const baseBuf = await getBaseImage(def);
      const bytes = await composeTintaImage(baseBuf, hex);
      const fileName = storageFileName(produto, def);
      const storagePath = `${STORAGE_PREFIX}/${fileName}`;
      let publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;

      const storageKey = produto.codigo_interno || produto.id;
      if (apply) {
        publicUrl = await uploadToStorage(storagePath, bytes, 'image/png');
      }

      const imagem = {
        url: publicUrl,
        fonte_ref: resolveIquineVerbrasFonteRef(def),
        hex,
      };

      report.resolved.push({
        codigo_interno: produto.codigo_interno,
        nome: produto.nome,
        marca: def.marca,
        base: def.base,
        cor: def.cor,
        hex,
        url: publicUrl,
        fonte_ref: imagem.fonte_ref,
      });
      console.log(`✓ ${produto.codigo_interno || produto.id} ${def.marca} ${def.base} ${def.cor || ''} (${hex})`);

      if (apply) {
        await upsertImagem(produto.id, imagem, storageKey, bytes);
      }
    } catch (err) {
      report.missing.push({
        codigo_interno: produto.codigo_interno,
        nome: produto.nome,
        error: err.message,
      });
      console.log(`✗ ${produto.codigo_interno || produto.id} ${err.message}`);
    }
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log('\n[import-imagens-iquine-verbras] Relatório:', REPORT_PATH);
  console.log(`  Resolvidas: ${report.resolved.length}`);
  if (report.skipped.length) console.log(`  Ignoradas: ${report.skipped.length}`);
  if (report.missing.length) console.log(`  Em falta: ${report.missing.length}`);
  if (!apply) console.log('\nDry-run. Para aplicar: npm run import:imagens-iquine-verbras -- --apply');
}

main().catch((err) => {
  console.error('[import-imagens-iquine-verbras]', err);
  process.exit(1);
});
