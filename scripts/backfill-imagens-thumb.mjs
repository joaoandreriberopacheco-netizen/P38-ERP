#!/usr/bin/env node
/**
 * Gera imagem_thumb_url para produtos com imagem_url mas sem miniatura.
 *
 * npm run backfill:imagens-thumb
 * npm run backfill:imagens-thumb -- --apply
 * npm run backfill:imagens-thumb -- --apply --codigo=R5D-PII
 */
import { resolveP38Secrets } from './p38-secrets.mjs';
import { ensureThumbFromImageUrl } from './lib/produtoThumbStorage.mjs';

const apply = process.argv.includes('--apply');
const codigoArg = process.argv.find((a) => a.startsWith('--codigo='));
const codigoFilter = codigoArg ? codigoArg.split('=')[1] : null;

const secrets = resolveP38Secrets();
const SUPABASE_URL = secrets.viteSupabaseUrl || 'https://zhonvxkkqabfdyehyxpu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || secrets.viteSupabaseAnonKey;

if (!SUPABASE_KEY) {
  console.error('[backfill-imagens-thumb] Sem chave Supabase.');
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

async function main() {
  let query = 'produto?select=id,codigo_interno,nome,imagem_url,imagem_thumb_url&imagem_url=not.is.null&ativo=eq.true&order=codigo_interno.asc&limit=500';
  if (codigoFilter) {
    query += `&codigo_interno=eq.${encodeURIComponent(codigoFilter)}`;
  } else {
    query += '&imagem_thumb_url=is.null';
  }

  const produtos = await sbFetch(query);
  const report = { generated_at: new Date().toISOString(), apply, ok: [], skipped: [], failed: [] };

  for (const produto of produtos || []) {
    if (produto.imagem_thumb_url) {
      report.skipped.push({ codigo_interno: produto.codigo_interno, motivo: 'já tem thumb' });
      continue;
    }

    const thumbUrl = await ensureThumbFromImageUrl({
      imageUrl: produto.imagem_url,
      codigoInterno: produto.codigo_interno || produto.id,
      supabaseUrl: SUPABASE_URL,
      supabaseKey: SUPABASE_KEY,
    });

    if (!thumbUrl) {
      report.failed.push({ codigo_interno: produto.codigo_interno, url: produto.imagem_url });
      console.log(`✗ ${produto.codigo_interno} thumb falhou`);
      continue;
    }

    report.ok.push({ codigo_interno: produto.codigo_interno, thumb_url: thumbUrl });
    console.log(`✓ ${produto.codigo_interno} → thumb`);

    if (apply) {
      await sbFetch(`produto?id=eq.${produto.id}`, {
        method: 'PATCH',
        body: { imagem_thumb_url: thumbUrl },
        prefer: 'return=minimal',
      });

      const imgs = await sbFetch(
        `produto_imagem?select=id&produto_id=eq.${produto.id}&principal=eq.true&ativo=eq.true&limit=1`,
      );
      if (imgs?.[0]?.id) {
        await sbFetch(`produto_imagem?id=eq.${imgs[0].id}`, {
          method: 'PATCH',
          body: { url_thumb: thumbUrl },
          prefer: 'return=minimal',
        });
      }
    }
  }

  console.log(`\n[backfill-imagens-thumb] OK: ${report.ok.length} | Falha: ${report.failed.length} | Ignorados: ${report.skipped.length}`);
  if (!apply) console.log('Dry-run. Para aplicar: npm run backfill:imagens-thumb -- --apply');
}

main().catch((err) => {
  console.error('[backfill-imagens-thumb]', err);
  process.exit(1);
});
