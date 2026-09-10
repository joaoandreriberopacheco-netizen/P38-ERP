#!/usr/bin/env node
/**
 * Fecha KPI de vendas do dashboard com a mesma lógica do Relatório de Margem.
 * Recalcula o mês até ontem (custos de hoje) e grava dashboard_kpi_* + célula vendas.
 *
 * Uso:
 *   npm run dashboard:kpi-margem-fechar
 *   npm run dashboard:kpi-margem-fechar -- --month 2026-09
 *   npm run dashboard:kpi-margem-fechar -- --month 2026-09 --through 2026-09-08
 */
import { computeDashboardKpiMargemForMonth } from '../src/lib/dashboardKpiMargemCompute.js';
import {
  createMargemKpiSupabaseClient,
  fetchMargemKpiDataset,
  fetchTabatingaOntem,
} from '../src/lib/fetchMargemKpiSupabase.js';

function parseArgs(argv) {
  const out = { month: null, through: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--month' && argv[i + 1]) {
      out.month = argv[i + 1].slice(0, 7);
      i += 1;
    } else if (argv[i] === '--through' && argv[i + 1]) {
      out.through = argv[i + 1].slice(0, 10);
      i += 1;
    }
  }
  return out;
}

async function upsertDaily(sb, monthKey, refDate, payload) {
  const { error } = await sb.from('dashboard_kpi_diario').upsert(
    {
      domain: 'vendas',
      ref_date: refDate,
      month_key: monthKey,
      payload,
      computed_at: new Date().toISOString(),
    },
    { onConflict: 'domain,ref_date' },
  );
  if (error) throw error;
}

async function upsertMonthly(sb, monthKey, closedThrough, payload) {
  const { error } = await sb.from('dashboard_kpi_mensal').upsert(
    {
      domain: 'vendas',
      month_key: monthKey,
      closed_through: closedThrough,
      payload,
      computed_at: new Date().toISOString(),
    },
    { onConflict: 'domain,month_key' },
  );
  if (error) throw error;
}

async function syncCelulaVendas(sb, monthKey) {
  const { data, error } = await sb.rpc('p38_celula_compute_vendas_mes', { p_month_key: monthKey });
  if (error) {
    console.warn(`[dashboard:kpi-margem-fechar] célula vendas:${monthKey}:`, error.message);
    return null;
  }
  return data;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sb = createMargemKpiSupabaseClient();
  const ontem = await fetchTabatingaOntem(sb);
  const monthKey = args.month || ontem.slice(0, 7);
  const throughDateKey = args.through || ontem;

  if (!throughDateKey.startsWith(monthKey)) {
    console.error('[dashboard:kpi-margem-fechar] --through deve pertencer ao --month.');
    process.exit(1);
  }

  console.log(
    `[dashboard:kpi-margem-fechar] month=${monthKey} through=${throughDateKey} (margem, custos de hoje)`,
  );

  const dataset = await fetchMargemKpiDataset(monthKey, sb);
  const { daily, monthly } = computeDashboardKpiMargemForMonth({
    ...dataset,
    monthKey,
    throughDateKey,
  });

  const refDates = Object.keys(daily).sort();
  for (const refDate of refDates) {
    if (refDate > throughDateKey) continue;
    await upsertDaily(sb, monthKey, refDate, daily[refDate]);
  }

  if (!monthly?.monthlyTotals) {
    console.error('[dashboard:kpi-margem-fechar] sem totais mensais.');
    process.exit(1);
  }

  const closedThrough = monthly.closedThrough || throughDateKey;
  await upsertMonthly(sb, monthKey, closedThrough, monthly);
  await syncCelulaVendas(sb, monthKey);

  const { data: dirtyRows } = await sb
    .from('dashboard_kpi_dirty')
    .select('month_key')
    .eq('domain', 'vendas');

  const dirtyMonths = [...new Set((dirtyRows || []).map((r) => r.month_key).filter(Boolean))].filter(
    (mk) => mk !== monthKey,
  );

  for (const dirtyMonth of dirtyMonths) {
    console.log(`[dashboard:kpi-margem-fechar] dirty rebuild ${dirtyMonth}`);
    const dirtyDataset = await fetchMargemKpiDataset(dirtyMonth, sb);
    const [dy, dm] = dirtyMonth.split('-').map(Number);
    const lastDay = new Date(dy, dm, 0).getDate();
    const dirtyThrough =
      dirtyMonth < monthKey
        ? `${dirtyMonth}-${String(lastDay).padStart(2, '0')}`
        : throughDateKey;
    const dirtyComputed = computeDashboardKpiMargemForMonth({
      ...dirtyDataset,
      monthKey: dirtyMonth,
      throughDateKey: dirtyThrough,
    });
    for (const [refDate, payload] of Object.entries(dirtyComputed.daily).sort()) {
      if (refDate > dirtyThrough) continue;
      await upsertDaily(sb, dirtyMonth, refDate, payload);
    }
    if (dirtyComputed.monthly?.monthlyTotals) {
      await upsertMonthly(
        sb,
        dirtyMonth,
        dirtyComputed.closedThrough || dirtyThrough,
        dirtyComputed.monthly,
      );
      await syncCelulaVendas(sb, dirtyMonth);
      await sb.from('dashboard_kpi_dirty').delete().eq('domain', 'vendas').eq('month_key', dirtyMonth);
    }
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        monthKey,
        closedThrough,
        daysWritten: refDates.filter((d) => d <= throughDateKey).length,
        monthlyTotals: monthly.monthlyTotals,
        sourceVersion: monthly.sourceVersion,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error('[dashboard:kpi-margem-fechar]', err.message);
  process.exit(1);
});
