#!/usr/bin/env node
/**
 * Importa fotos dos 32 produtos do mix inventário usando ref. de fabricante.
 *
 * Fontes: loja Japi (VTEX), site Lorenzetti, CDN Tigre.
 * Grava em produto_imagem + produto.imagem_url.
 *
 * npm run import:imagens-mix-inventario
 * npm run import:imagens-mix-inventario -- --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveMixProdutoImagem } from './lib/mixInventarioImagens.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'docs', 'exports', 'inventario-mix-imagens-report.json');

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL
  || 'https://zhonvxkkqabfdyehyxpu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
  console.error('[import-imagens-mix] Defina SUPABASE_SERVICE_ROLE_KEY.');
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

async function fetchMixProdutos() {
  const all = [];
  let offset = 0;
  while (true) {
    const batch = await sbFetch(
      `produto?select=id,codigo_interno,nome,marca,campo_hierarquico_4,imagem_url,tags&ativo=eq.true&order=codigo_interno&limit=500&offset=${offset}`,
    );
    all.push(...batch);
    if (batch.length < 500) break;
    offset += 500;
  }
  return all.filter((p) => (p.tags || []).includes('mix-inventario-2026'));
}

async function upsertImagem(produtoId, imagem) {
  const existing = await sbFetch(
    `produto_imagem?select=id,url&produto_id=eq.${produtoId}&ativo=eq.true&order=principal.desc,ordem.asc&limit=20`,
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
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
  }

  await sbFetch(`produto?id=eq.${produtoId}`, {
    method: 'PATCH',
    body: { imagem_url: imagem.url },
    prefer: 'return=minimal',
  });
}

async function main() {
  const produtos = await fetchMixProdutos();
  const report = {
    generated_at: new Date().toISOString(),
    apply,
    total: produtos.length,
    resolved: [],
    missing: [],
  };

  for (const produto of produtos) {
    const imagem = resolveMixProdutoImagem(produto);
    if (!imagem?.url) {
      report.missing.push({
        codigo_interno: produto.codigo_interno,
        ref: produto.campo_hierarquico_4,
        nome: produto.nome,
      });
      console.log(`✗ ${produto.codigo_interno} [${produto.campo_hierarquico_4 || 'avulso'}] sem imagem`);
      continue;
    }

    report.resolved.push({
      codigo_interno: produto.codigo_interno,
      ref: produto.campo_hierarquico_4,
      resolver: imagem.resolver,
      url: imagem.url,
    });
    console.log(`✓ ${produto.codigo_interno} [${produto.campo_hierarquico_4 || 'avulso'}] ${imagem.resolver}`);

    if (apply) {
      await upsertImagem(produto.id, imagem);
    }
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log(`\n[import-imagens-mix] ${report.resolved.length}/${report.total} com imagem`);
  console.log(`Relatório: ${REPORT_PATH}`);
  if (!apply) {
    console.log('Dry-run. Para aplicar: npm run import:imagens-mix-inventario -- --apply');
  }
}

main().catch((err) => {
  console.error('[import-imagens-mix]', err);
  process.exit(1);
});
