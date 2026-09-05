#!/usr/bin/env node
/**
 * Backfill anotações vendas_gestao (meses fechados) — Fase 6.
 *
 * Uso:
 *   npm run anotacao:vendas-gestao-backfill
 *   npm run anotacao:vendas-gestao-backfill -- --anchor 2026-09 --months 6
 */

import { loadDotEnvFiles } from './base44-env.mjs';
import { connectPg } from './lib/pg-connect-ipv4.mjs';
import { resolveSupabaseDeployEnv } from './supabase-env.mjs';

loadDotEnvFiles();

function parseArgs(argv) {
  const out = { anchor: null, months: 6 };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--anchor' && argv[i + 1]) {
      out.anchor = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--months' && argv[i + 1]) {
      out.months = Number(argv[i + 1]) || 6;
      i += 1;
    }
  }
  return out;
}

async function callRpc(client, fn, params = {}) {
  const keys = Object.keys(params);
  const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(', ');
  const values = keys.map((k) => params[k]);
  const sql = `select public.${fn}(${placeholders}) as result`;
  const { rows } = await client.query(sql, values);
  return rows[0]?.result ?? null;
}

async function countRows(client) {
  const { rows } = await client.query(`
    select count(*)::int as n
    from public.p38_anotacao
    where domain = 'vendas_gestao'
  `);
  return rows[0]?.n ?? 0;
}

async function main() {
  const { anchor, months } = parseArgs(process.argv.slice(2));
  const { databaseUrl } = resolveSupabaseDeployEnv();
  if (!databaseUrl) {
    console.error('[anotacao:vendas-gestao-backfill] DATABASE_URL em falta.');
    process.exit(1);
  }

  const client = await connectPg(databaseUrl);
  const anchorMonth = anchor || new Date().toISOString().slice(0, 7);

  try {
    const before = await countRows(client);
    console.log(`[anotacao:vendas-gestao-backfill] Antes: ${before} meses`);

    const result = await callRpc(client, 'p38_anotacao_backfill_vendas_gestao', {
      p_anchor_month: anchorMonth,
      p_months: months,
    });
    console.log(JSON.stringify(result, null, 2));

    const after = await countRows(client);
    console.log(`[anotacao:vendas-gestao-backfill] Depois: ${after} meses`);

    if (!result?.success) process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[anotacao:vendas-gestao-backfill]', err.message);
  process.exit(1);
});
