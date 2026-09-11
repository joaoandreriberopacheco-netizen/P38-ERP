#!/usr/bin/env node
/**
 * Importa fotos do pacote Lorenzetti (chuveiros + Waterfall 2877 C70).
 * Grava principal + ambiente em produto_imagem quando existirem no site.
 *
 * npm run import:imagens-lorenzetti
 * npm run import:imagens-lorenzetti -- --apply
 * npm run import:imagens-lorenzetti -- --include-inactive
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isLorenzettiPackTarget,
  LORENZETTI_PACK,
  resolveLorenzettiImagens,
} from './lib/lorenzettiImagens.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'docs', 'exports', 'inventario-lorenzetti-imagens-report.json');

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const includeInactive = args.has('--include-inactive');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL
  || 'https://zhonvxkkqabfdyehyxpu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
  console.error('[import-imagens-lorenzetti] Defina SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_ANON_KEY.');
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

async function fetchProdutos() {
  const skus = Object.keys(LORENZETTI_PACK);
  const filter = `codigo_interno=in.(${skus.map((s) => `"${s}"`).join(',')})`;
  const activeFilter = includeInactive ? '' : '&ativo=eq.true';
  const rows = await sbFetch(
    `produto?select=id,codigo_interno,nome,ativo,imagem_url&${filter}${activeFilter}&order=codigo_interno`,
  );
  return (rows || []).filter((p) => isLorenzettiPackTarget(p));
}

async function upsertImagens(produtoId, imagens) {
  const existing = await sbFetch(
    `produto_imagem?select=id,url,ativo&produto_id=eq.${produtoId}&order=principal.desc,ordem.asc&limit=20`,
  );

  const principal = imagens.find((img) => img.tipo === 'principal') || imagens[0];
  const ordered = [...imagens].sort((a, b) => {
    if (a.tipo === 'principal') return -1;
    if (b.tipo === 'principal') return 1;
    return 0;
  });

  for (const [ordem, imagem] of ordered.entries()) {
    const same = (existing || []).find((row) => row.url === imagem.url);
    const body = {
      principal: imagem.tipo === 'principal',
      ordem,
      tipo: imagem.tipo,
      fonte: imagem.fonte,
      fonte_ref: imagem.fonte_ref,
      ativo: true,
    };

    if (same) {
      await sbFetch(`produto_imagem?id=eq.${same.id}`, {
        method: 'PATCH',
        body,
        prefer: 'return=minimal',
      });
    } else {
      try {
        await sbFetch('produto_imagem', {
          method: 'POST',
          body: [{
            produto_id: produtoId,
            url: imagem.url,
            ...body,
          }],
          prefer: 'return=minimal',
        });
      } catch (err) {
        if (!String(err.message).includes('23505')) throw err;
        const dup = await sbFetch(
          `produto_imagem?select=id&produto_id=eq.${produtoId}&url=eq.${encodeURIComponent(imagem.url)}&limit=1`,
        );
        if (dup?.[0]?.id) {
          await sbFetch(`produto_imagem?id=eq.${dup[0].id}`, {
            method: 'PATCH',
            body,
            prefer: 'return=minimal',
          });
        }
      }
    }
  }

  const keepUrls = new Set(ordered.map((img) => img.url));
  for (const row of existing || []) {
    if (!keepUrls.has(row.url) && row.ativo) {
      await sbFetch(`produto_imagem?id=eq.${row.id}`, {
        method: 'PATCH',
        body: { ativo: false },
        prefer: 'return=minimal',
      });
    }
  }

  if (principal?.url) {
    await sbFetch(`produto?id=eq.${produtoId}`, {
      method: 'PATCH',
      body: { imagem_url: principal.url },
      prefer: 'return=minimal',
    });
  }
}

async function main() {
  const produtos = await fetchProdutos();
  const report = {
    generated_at: new Date().toISOString(),
    apply,
    include_inactive: includeInactive,
    total: produtos.length,
    resolved: [],
    missing: [],
  };

  for (const produto of produtos) {
    const imagens = resolveLorenzettiImagens(produto);
    if (!imagens.length) {
      report.missing.push({
        codigo_interno: produto.codigo_interno,
        nome: produto.nome,
        ativo: produto.ativo,
      });
      console.log(`✗ ${produto.codigo_interno} sem imagem — ${produto.nome}`);
      continue;
    }

    report.resolved.push({
      codigo_interno: produto.codigo_interno,
      nome: produto.nome,
      ativo: produto.ativo,
      imagens: imagens.map((img) => ({ tipo: img.tipo, resolver: img.resolver, url: img.url })),
    });
    const tipos = imagens.map((img) => img.tipo).join(' + ');
    console.log(`✓ ${produto.codigo_interno} [${produto.ativo ? 'ativo' : 'inativo'}] ${tipos}`);

    if (apply) {
      await upsertImagens(produto.id, imagens);
    }
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  const withAmbiente = report.resolved.filter((r) => r.imagens.length > 1).length;
  console.log(`\n[import-imagens-lorenzetti] ${report.resolved.length}/${report.total} com imagem (${withAmbiente} com ambiente)`);
  console.log(`Relatório: ${REPORT_PATH}`);
  if (!apply) {
    console.log('Dry-run. Para aplicar: npm run import:imagens-lorenzetti -- --apply');
    if (!includeInactive) {
      console.log('Incluir inativos: npm run import:imagens-lorenzetti -- --include-inactive');
    }
  }
}

main().catch((err) => {
  console.error('[import-imagens-lorenzetti]', err);
  process.exit(1);
});
