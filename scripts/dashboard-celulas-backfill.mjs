#!/usr/bin/env node
/**
 * Backfill células do Dashboard (Fase 5) via Postgres.
 * Requer DATABASE_URL e migrations 079 + 080 aplicadas.
 *
 * Uso:
 *   npm run dashboard:celulas-backfill
 *   npm run dashboard:celulas-backfill -- --anchor 2026-09 --months 6
 */

import { loadDotEnvFiles } from './base44-env.mjs';
import { connectPg } from './lib/pg-connect-ipv4.mjs';
import { resolveSupabaseDeployEnv } from './supabase-env.mjs';

loadDotEnvFiles();

function parseArgs(argv) {
  const out = {
    anchor: null,
    months: 6,
  };
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
  const sql = keys.length
    ? `select public.${fn}(${placeholders}) as result`
    : `select public.${fn}() as result`;
  const { rows } = await client.query(sql, values);
  return rows[0]?.result ?? null;
}

async function countCelulas(client) {
  const { rows } = await client.query(`
    select
      count(*) filter (where ref_key like 'vendas:%') as vendas,
      count(*) filter (where ref_key like 'estoque:supply:%') as supply,
      count(*) filter (where ref_key like 'estoque:nivel:%') as nivel,
      count(*) filter (where ref_key = 'estoque:resumo') as resumo
    from public.p38_anotacao
    where domain = 'dashboard_celulas'
  `);
  return rows[0] || {};
}

async function main() {
  const { anchor, months } = parseArgs(process.argv.slice(2));
  const { databaseUrl } = resolveSupabaseDeployEnv();
  if (!databaseUrl) {
    console.error('[dashboard:celulas-backfill] DATABASE_URL em falta.');
    process.exit(1);
  }

  const client = await connectPg(databaseUrl);

  try {
    const before = await countCelulas(client);
    console.log('[dashboard:celulas-backfill] Antes:', before);

    const anchorMonth = anchor || new Date().toISOString().slice(0, 7);
    console.log(`[dashboard:celulas-backfill] p38_dashboard_celulas_backfill anchor=${anchorMonth} months=${months}…`);
    const backfill = await callRpc(client, 'p38_dashboard_celulas_backfill', {
      p_anchor_month: anchorMonth,
      p_months: months,
    });
    console.log(JSON.stringify(backfill, null, 2));

    const after = await countCelulas(client);
    console.log('[dashboard:celulas-backfill] Depois:', after);

    if (!backfill?.success) {
      process.exit(1);
    }
    console.log('[dashboard:celulas-backfill] Concluído.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[dashboard:celulas-backfill]', err.message);
  process.exit(1);
});
