#!/usr/bin/env node
/**
 * Importa fotos Hipercor — tintas com fundo na cor + massas com lata oficial.
 *
 * npm run import:imagens-hipercor
 * npm run import:imagens-hipercor -- --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { resolveP38Secrets } from './p38-secrets.mjs';
import {
  HIPERCOR_BASE_IMAGES,
  HIPERCOR_SKUS,
  resolveHipercorFonteRef,
  resolveHipercorHex,
} from './lib/hipercorImagens.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'docs', 'assets', 'hipercor');
const REPORT_PATH = path.join(ROOT, 'docs', 'exports', 'inventario-hipercor-imagens-report.json');
const BUCKET = 'produtos-imagens';
const STORAGE_PREFIX = 'catalogo/hipercor';
const CANVAS = 800;

const apply = process.argv.includes('--apply');
const secrets = resolveP38Secrets();
const SUPABASE_URL = secrets.viteSupabaseUrl || 'https://zhonvxkkqabfdyehyxpu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || secrets.viteSupabaseAnonKey;

if (!SUPABASE_KEY) {
  console.error('[import-imagens-hipercor] Sem chave Supabase.');
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

const baseImageCache = new Map();

function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function getBaseImage(baseKey) {
  if (baseImageCache.has(baseKey)) return baseImageCache.get(baseKey);
  const ref = HIPERCOR_BASE_IMAGES[baseKey];
  const localPath = path.join(ASSETS_DIR, `${baseKey}.png`);
  let buf;
  if (fs.existsSync(localPath)) {
    buf = fs.readFileSync(localPath);
  } else {
    buf = await fetchBuffer(ref.url);
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
    fs.writeFileSync(localPath, buf);
  }
  baseImageCache.set(baseKey, buf);
  return buf;
}

async function composeHipercorImage(def) {
  const hex = resolveHipercorHex(def);
  const productBuf = await getBaseImage(def.base);
  const productH = Math.round(CANVAS * 0.72);
  const productPng = await sharp(productBuf)
    .resize({ height: productH, fit: 'inside' })
    .png()
    .toBuffer();
  const meta = await sharp(productPng).metadata();
  const left = Math.round((CANVAS - meta.width) / 2);
  const top = Math.round((CANVAS - meta.height) / 2);
  const bg = await sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 3,
      background: hexToRgb(hex),
    },
  }).png().toBuffer();

  return sharp(bg)
    .composite([{ input: productPng, left, top }])
    .png()
    .toBuffer();
}

function storageFileName(codigo, def) {
  const cor = def.cor ? def.cor.toLowerCase().replace(/\s+/g, '-') : def.base;
  return `${codigo.toLowerCase()}-${cor}.png`;
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
        tipo: 'principal',
        ordem: 0,
        principal: true,
        fonte: 'import',
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
  const report = {
    generated_at: new Date().toISOString(),
    apply,
    fonte: 'Hipercor (hipercor.com.br) — lata oficial + fundo na cor',
    resolved: [],
    missing: [],
  };

  for (const [codigo, def] of Object.entries(HIPERCOR_SKUS)) {
    try {
      const bytes = await composeHipercorImage(def);
      const fileName = storageFileName(codigo, def);
      const storagePath = `${STORAGE_PREFIX}/${fileName}`;
      let publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
      if (apply) {
        publicUrl = await uploadToStorage(storagePath, bytes, 'image/png');
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

      const imagem = {
        url: publicUrl,
        fonte_ref: resolveHipercorFonteRef(def),
        hex: resolveHipercorHex(def),
      };

      report.resolved.push({
        codigo_interno: codigo,
        nome: produto.nome,
        base: def.base,
        cor: def.cor || null,
        hex: imagem.hex,
        url: publicUrl,
        fonte_ref: imagem.fonte_ref,
      });
      console.log(`✓ ${codigo} ${def.cor || def.base} (${imagem.hex})`);

      if (apply) {
        await upsertImagem(produto.id, imagem);
      }
    } catch (err) {
      report.missing.push({ codigo_interno: codigo, error: err.message });
      console.log(`✗ ${codigo} ${err.message}`);
    }
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log('\n[import-imagens-hipercor] Relatório:', REPORT_PATH);
  console.log(`  Resolvidas: ${report.resolved.length}/${Object.keys(HIPERCOR_SKUS).length}`);

  if (!apply) {
    console.log('\nDry-run. Para aplicar: npm run import:imagens-hipercor -- --apply');
  }
}

main().catch((err) => {
  console.error('[import-imagens-hipercor]', err);
  process.exit(1);
});
