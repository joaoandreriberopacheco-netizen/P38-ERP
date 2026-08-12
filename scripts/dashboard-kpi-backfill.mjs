#!/usr/bin/env node
/**
 * Backfill snapshots do dashboard (Fase 2/3) via Postgres.
 * Requer DATABASE_URL.
 *
 * Uso:
 *   npm run dashboard:kpi-backfill
 *   npm run dashboard:kpi-backfill -- --anchor 2026-08 --months 6
 *   npm run dashboard:kpi-backfill -- --fechar-ontem
 */

import pg from 'pg';
import { resolveSupabaseDeployEnv } from './supabase-env.mjs';

function parseArgs(argv) {
  const out = {
    anchor: null,
    months: 6,
    fecharOntem: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--anchor' && argv[i + 1]) {
      out.anchor = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--months' && argv[i + 1]) {
      out.months = Number(argv[i + 1]) || 6;
      i += 1;
    } else if (argv[i] === '--fechar-ontem') {
      out.fecharOntem = true;
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

async function main() {
  const { anchor, months, fecharOntem } = parseArgs(process.argv.slice(2));
  const { databaseUrl } = resolveSupabaseDeployEnv();
  if (!databaseUrl) {
    console.error('[dashboard:kpi-backfill] DATABASE_URL em falta.');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    if (fecharOntem) {
      console.log('[dashboard:kpi-backfill] job_fechar_dashboard_kpi_ontem…');
      const job = await callRpc(client, 'job_fechar_dashboard_kpi_ontem');
      console.log(JSON.stringify(job, null, 2));
    }

    const anchorMonth = anchor || new Date().toISOString().slice(0, 7);
    console.log(`[dashboard:kpi-backfill] backfill janela anchor=${anchorMonth} months=${months}…`);
    const backfill = await callRpc(client, 'dashboard_kpi_backfill_vendas_window', {
      p_anchor_month: anchorMonth,
      p_months: months,
    });
    console.log(JSON.stringify(backfill, null, 2));

    if (!backfill?.success) {
      process.exit(1);
    }
    console.log('[dashboard:kpi-backfill] Concluído.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[dashboard:kpi-backfill]', err.message);
  process.exit(1);
});
