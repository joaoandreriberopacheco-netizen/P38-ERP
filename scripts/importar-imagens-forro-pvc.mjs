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
import { FORRO_PVC_IMAGENS, resolveForroPvcImagem } from './lib/forroPvcImagens.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'docs', 'exports', 'inventario-forro-pvc-imagens-report.json');

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
  const report = {
    generated_at: new Date().toISOString(),
    apply,
    fonte: 'Forrotex + Oca/Plasmeg (cdn.awsli.com.br)',
    resolved: [],
    missing: [],
  };

  const codigos = Object.keys(FORRO_PVC_IMAGENS);

  for (const codigo of codigos) {
    const imagem = resolveForroPvcImagem(codigo);
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

    report.resolved.push({
      codigo_interno: codigo,
      nome: produto.nome,
      label: imagem.label,
      url: imagem.url,
      fonte_ref: imagem.fonte_ref,
    });
    console.log(`✓ ${codigo} ${imagem.label} → ${imagem.fonte_ref}`);

    if (apply) {
      await upsertImagem(produto.id, imagem);
    }
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
