#!/usr/bin/env node
/**
 * Importa fotos de forro PVC (frisado, canalado Gemini) e perfis (colonial, F, H, U).
 *
 * npm run import:imagens-forro-pvc
 * npm run import:imagens-forro-pvc -- --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveP38Secrets } from './p38-secrets.mjs';
import {
  FORRO_PVC_ASSETS_DIR,
  FORRO_PVC_IMAGENS,
  resolveForroPvcImagem,
} from './lib/forroPvcImagens.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, FORRO_PVC_ASSETS_DIR);
const REPORT_PATH = path.join(ROOT, 'docs', 'exports', 'inventario-forro-pvc-imagens-report.json');
const BUCKET = 'produtos-imagens';
const STORAGE_PREFIX = 'catalogo/forro-pvc';

const apply = process.argv.includes('--apply');
const secrets = resolveP38Secrets();
const SUPABASE_URL = secrets.viteSupabaseUrl || 'https://zhonvxkkqabfdyehyxpu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || secrets.viteSupabaseAnonKey;

if (!SUPABASE_KEY) {
  console.error('[import-imagens-forro-pvc] Sem chave Supabase.');
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

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

async function resolveAssetOrUrl(entry) {
  if (entry.url) return entry.url;
  if (!entry.asset) return null;

  const localPath = path.join(ASSETS_DIR, entry.asset);
  if (!fs.existsSync(localPath)) {
    throw new Error(`asset em falta: ${localPath}`);
  }

  const bytes = fs.readFileSync(localPath);
  const contentType = entry.asset.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const storagePath = `${STORAGE_PREFIX}/${entry.asset}`;
  let publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;

  if (apply) {
    publicUrl = await uploadToStorage(storagePath, bytes, contentType);
  }

  return publicUrl;
}

async function resolveImagemUrl(codigo, hit) {
  const url = await resolveAssetOrUrl(hit);
  if (!url) return null;
  return resolveForroPvcImagem(codigo, { url });
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

async function upsertGaleriaImagem(produtoId, imagem) {
  const existing = await sbFetch(
    `produto_imagem?select=id,url&produto_id=eq.${produtoId}&url=eq.${encodeURIComponent(imagem.url)}&limit=1`,
  );

  const body = {
    tipo: imagem.tipo,
    ordem: imagem.ordem,
    principal: false,
    fonte: imagem.fonte,
    fonte_ref: imagem.fonte_ref,
    ativo: true,
  };

  if (existing?.[0]?.id) {
    await sbFetch(`produto_imagem?id=eq.${existing[0].id}`, {
      method: 'PATCH',
      body,
      prefer: 'return=minimal',
    });
    return;
  }

  await sbFetch('produto_imagem', {
    method: 'POST',
    body: [{
      produto_id: produtoId,
      url: imagem.url,
      ...body,
    }],
    prefer: 'return=minimal',
  });
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
  const report = {
    generated_at: new Date().toISOString(),
    apply,
    fonte: 'Assets P38 + Forrotex/Oca/Plasmeg',
    resolved: [],
    missing: [],
  };

  const codigos = Object.keys(FORRO_PVC_IMAGENS);

  for (const codigo of codigos) {
    const hit = FORRO_PVC_IMAGENS[codigo];
    let imagem;
    try {
      imagem = await resolveImagemUrl(codigo, hit);
    } catch (err) {
      report.missing.push({ codigo_interno: codigo, error: err.message });
      console.log(`✗ ${codigo} ${err.message}`);
      continue;
    }

    if (!imagem?.url) {
      report.missing.push({ codigo_interno: codigo, error: 'sem URL no mapa' });
      console.log(`✗ ${codigo} sem imagem no mapa`);
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

    const resolvedItem = {
      codigo_interno: codigo,
      nome: produto.nome,
      label: imagem.label,
      asset: hit.asset || null,
      url: imagem.url,
      fonte_ref: imagem.fonte_ref,
      galeria: [],
    };
    console.log(`✓ ${codigo} ${imagem.label} → ${imagem.fonte_ref}`);

    if (apply) {
      await upsertImagem(produto.id, imagem);
    }

    for (const extra of hit.galeria || []) {
      let extraUrl;
      try {
        extraUrl = await resolveAssetOrUrl(extra);
      } catch (err) {
        report.missing.push({ codigo_interno: codigo, error: err.message, galeria: extra.label });
        console.log(`✗ ${codigo} ${extra.label}: ${err.message}`);
        continue;
      }

      if (!extraUrl) continue;

      resolvedItem.galeria.push({
        label: extra.label,
        tipo: extra.tipo,
        asset: extra.asset || null,
        url: extraUrl,
        fonte_ref: extra.fonte_ref,
      });
      console.log(`  + ${codigo} ${extra.label} (${extra.tipo}) → ${extra.fonte_ref}`);

      if (apply) {
        await upsertGaleriaImagem(produto.id, {
          url: extraUrl,
          tipo: extra.tipo || 'ambiente',
          ordem: extra.ordem ?? 10,
          fonte: 'import',
          fonte_ref: extra.fonte_ref,
        });
      }
    }

    report.resolved.push(resolvedItem);
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log('\n[import-imagens-forro-pvc] Relatório:', REPORT_PATH);
  console.log(`  Resolvidas: ${report.resolved.length}/${codigos.length}`);
  if (report.missing.length) console.log(`  Em falta: ${report.missing.length}`);

  if (!apply) {
    console.log('\nDry-run. Para aplicar: npm run import:imagens-forro-pvc -- --apply');
  }
}

main().catch((err) => {
  console.error('[import-imagens-forro-pvc]', err);
  process.exit(1);
});
