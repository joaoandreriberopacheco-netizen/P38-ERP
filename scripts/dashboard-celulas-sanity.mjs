#!/usr/bin/env node
/**
 * Sanity check: células dashboard vs dashboard_kpi_mensal (Fase 6).
 * Requer DATABASE_URL e migrations 080+ aplicadas.
 *
 * Uso:
 *   npm run dashboard:celulas-sanity
 *   npm run dashboard:celulas-sanity -- --month 2026-08 --tolerance 0.02
 */

import { loadDotEnvFiles } from './base44-env.mjs';
import { connectPg } from './lib/pg-connect-ipv4.mjs';
import { resolveSupabaseDeployEnv } from './supabase-env.mjs';

loadDotEnvFiles();

function parseArgs(argv) {
  const out = { month: null, tolerance: 0.02 };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--month' && argv[i + 1]) {
      out.month = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--tolerance' && argv[i + 1]) {
      out.tolerance = Number(argv[i + 1]) || 0.02;
      i += 1;
    }
  }
  return out;
}

function pctDiff(a, b) {
  const base = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / base;
}

async function main() {
  const { month, tolerance } = parseArgs(process.argv.slice(2));
  const { databaseUrl } = resolveSupabaseDeployEnv();
  if (!databaseUrl) {
    console.error('[dashboard:celulas-sanity] DATABASE_URL em falta.');
    process.exit(1);
  }

  const client = await connectPg(databaseUrl);
  const monthKey = month || new Date().toISOString().slice(0, 7);

  try {
    const { rows } = await client.query(
      `
      select
        c.payload as celula,
        k.payload as kpi
      from public.p38_anotacao c
      left join public.dashboard_kpi_mensal k
        on k.domain = 'vendas' and k.month_key = $1
      where c.domain = 'dashboard_celulas' and c.ref_key = $2
      `,
      [monthKey, `vendas:${monthKey}`],
    );

    const row = rows[0];
    if (!row?.celula) {
      console.error(`[dashboard:celulas-sanity] Célula vendas:${monthKey} não encontrada.`);
      process.exit(1);
    }
    if (!row?.kpi) {
      console.error(`[dashboard:celulas-sanity] dashboard_kpi_mensal ${monthKey} não encontrado.`);
      process.exit(1);
    }

    const celulaTotals = row.celula.monthlyTotals || row.celula;
    const kpiTotals = row.kpi.monthlyTotals || row.kpi;
    const fields = ['salesNet', 'salesGross', 'discounts', 'cost', 'profit'];
    const diffs = [];

    for (const field of fields) {
      const a = Number(celulaTotals[field]) || 0;
      const b = Number(kpiTotals[field]) || 0;
      const diff = pctDiff(a, b);
      diffs.push({ field, celula: a, kpi: b, diffPct: diff });
      if (diff > tolerance) {
        console.error(`[dashboard:celulas-sanity] Divergência ${field}: célula=${a} kpi=${b} (${(diff * 100).toFixed(2)}%)`);
        process.exit(1);
      }
    }

    console.log(`[dashboard:celulas-sanity] OK ${monthKey} (tolerância ${(tolerance * 100).toFixed(1)}%)`);
    console.log(JSON.stringify(diffs, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[dashboard:celulas-sanity]', err.message);
  process.exit(1);
});
