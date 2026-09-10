#!/usr/bin/env node
/**
 * Importa fotos do mix fechaduras Stam (URLs revendedor / assets locais).
 *
 * npm run import:imagens-fechaduras-stam
 * npm run import:imagens-fechaduras-stam -- --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveP38Secrets } from './p38-secrets.mjs';
import { resolveStamFechaduraImagem, STAM_FECHADURA_IMAGENS } from './lib/stamFechaduraImagens.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MAP_PATH = path.join(ROOT, 'docs', 'exports', 'inventario-fechaduras-merge-map.json');
const MERGE_REPORT_PATH = path.join(ROOT, 'docs', 'exports', 'inventario-fechaduras-merge-report.json');
const REPORT_PATH = path.join(ROOT, 'docs', 'exports', 'inventario-fechaduras-imagens-report.json');

const apply = process.argv.includes('--apply');
const secrets = resolveP38Secrets();
const SUPABASE_URL = secrets.viteSupabaseUrl || 'https://zhonvxkkqabfdyehyxpu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || secrets.viteSupabaseAnonKey;

if (!SUPABASE_KEY) {
  console.error('[import-imagens-fechaduras] Sem chave Supabase.');
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
  let enrolarSku = null;
  if (fs.existsSync(MERGE_REPORT_PATH)) {
    try {
      enrolarSku = JSON.parse(fs.readFileSync(MERGE_REPORT_PATH, 'utf8')).enrolar_codigo || null;
    } catch { /* ignore */ }
  }
  const report = {
    generated_at: new Date().toISOString(),
    apply,
    fonte: 'Stam / revendedores (loja.stam.com.br bloqueada no agente)',
    resolved: [],
    missing: [],
  };

  for (const row of map.items) {
    const codigo = row.item === 6 ? (row.p38_codigo_interno || enrolarSku || 'ENROLAR') : row.p38_codigo_interno;
    const imagem = resolveStamFechaduraImagem(
      row.item === 6 ? 'ENROLAR' : codigo,
      { item: row.item },
    );
    if (!imagem?.url) {
      report.missing.push({ item: row.item, codigo_interno: codigo, nome: row.nome || row.nome_sugerido });
      console.log(`✗ item ${row.item} ${codigo || '(novo)'} sem imagem`);
      continue;
    }

    report.resolved.push({
      item: row.item,
      codigo_interno: codigo,
      url: imagem.url,
      local_path: imagem.local_path,
      fonte_ref: imagem.fonte_ref,
    });
    console.log(`✓ item ${row.item} ${codigo || 'ENROLAR'} → ${imagem.fonte_ref}`);

    if (apply && codigo) {
      const [produto] = await sbFetch(
        `produto?select=id&codigo_interno=eq.${codigo}&limit=1`,
      );
      if (!produto?.id) {
        console.log(`  ! SKU ${codigo} não encontrado no Supabase (skip apply)`);
        continue;
      }
      await upsertImagem(produto.id, imagem);
    }
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\n[import-imagens-fechaduras] ${report.resolved.length}/${map.items.length} com imagem`);
  console.log(`Assets: docs/assets/fechaduras-stam/ (${Object.keys(STAM_FECHADURA_IMAGENS).length} ficheiros)`);
  console.log(`Relatório: ${REPORT_PATH}`);
  if (!apply) console.log('Dry-run. Para gravar no Supabase: npm run import:imagens-fechaduras-stam -- --apply');
}

main().catch((err) => {
  console.error('[import-imagens-fechaduras]', err);
  process.exit(1);
});
