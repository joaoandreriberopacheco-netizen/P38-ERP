#!/usr/bin/env node
/**
 * Fecha KPI de vendas do dashboard com a mesma lógica do Relatório de Margem.
 * Mês corrente: recalcula até ontem (cadastro dinâmico).
 * Mês passado: congela no 1º fecho após virar o mês — não reescreve depois.
 *
 * Uso:
 *   npm run dashboard:kpi-margem-fechar
 *   npm run dashboard:kpi-margem-fechar -- --month 2026-09
 *   npm run dashboard:kpi-margem-fechar -- --month 2026-09 --through 2026-09-08
 *   npm run dashboard:kpi-margem-fechar -- --force  (ignora mês congelado)
 */
import { computeDashboardKpiMargemForMonth } from '../src/lib/dashboardKpiMargemCompute.js';
import { shouldFreezeMargemMonthPayload } from '../src/lib/margemCustoMode.js';
import { getCurrentMonthKey } from '../src/lib/dashboardVendasPeriod.js';
import { fetchMargemKpiDataset } from '../src/lib/fetchMargemKpiSupabase.js';
import { createMargemKpiJobStore } from './lib/margemKpiJobStore.mjs';

function parseArgs(argv) {
  const out = { month: null, through: null, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--month' && argv[i + 1]) {
      out.month = argv[i + 1].slice(0, 7);
      i += 1;
    } else if (argv[i] === '--through' && argv[i + 1]) {
      out.through = argv[i + 1].slice(0, 10);
      i += 1;
    } else if (argv[i] === '--force') {
      out.force = true;
    }
  }
  return out;
}

function isMonthPayloadFrozen(row, monthKey) {
  if (!row?.payload) return shouldFreezeMargemMonthPayload(monthKey);
  if (row.payload.frozen === true) return true;
  return shouldFreezeMargemMonthPayload(monthKey) && Boolean(row.payload.monthlyTotals);
}

async function sealMonth(store, monthKey, throughDateKey, { force = false } = {}) {
  const existing = await store.readMonthlyRow(monthKey);
  if (!force && isMonthPayloadFrozen(existing, monthKey)) {
    return { skipped: true, reason: 'frozen', monthKey, existing: existing?.payload?.monthlyTotals };
  }

  const dataset = await fetchMargemKpiDataset(monthKey, store.supabase);
  const { daily, monthly } = computeDashboardKpiMargemForMonth({
    ...dataset,
    monthKey,
    throughDateKey,
  });

  const refDates = Object.keys(daily).sort();
  for (const refDate of refDates) {
    if (refDate > throughDateKey) continue;
    await store.upsertDaily(monthKey, refDate, daily[refDate]);
  }

  if (!monthly?.monthlyTotals) {
    throw new Error(`sem totais mensais para ${monthKey}`);
  }

  const closedThrough = monthly.closedThrough || throughDateKey;
  await store.upsertMonthly(monthKey, closedThrough, monthly);
  await store.syncCelulaVendas(monthKey);

  return {
    skipped: false,
    monthKey,
    closedThrough,
    daysWritten: refDates.filter((d) => d <= throughDateKey).length,
    monthlyTotals: monthly.monthlyTotals,
    frozen: monthly.frozen,
    costBasis: monthly.costBasis,
    sourceVersion: monthly.sourceVersion,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const store = await createMargemKpiJobStore();

  try {
    const ontem = await store.fetchOntem();
    const currentMonth = getCurrentMonthKey();
    const monthKey = args.month || ontem.slice(0, 7);
    const throughDateKey = args.through || ontem;

    if (!throughDateKey.startsWith(monthKey)) {
      console.error('[dashboard:kpi-margem-fechar] --through deve pertencer ao --month.');
      process.exit(1);
    }

    const dynamic = monthKey >= currentMonth;
    console.log(
      `[dashboard:kpi-margem-fechar] month=${monthKey} through=${throughDateKey} mode=${dynamic ? 'cadastro_atual' : 'selo_momento_venda'} writes=${store.usesPgWrites ? 'postgres' : 'supabase-rest'}`,
    );

    const result = await sealMonth(store, monthKey, throughDateKey, { force: args.force });
    if (result.skipped) {
      console.log(
        JSON.stringify(
          {
            success: true,
            skipped: true,
            reason: result.reason,
            monthKey: result.monthKey,
            monthlyTotals: result.existing || null,
          },
          null,
          2,
        ),
      );
      return;
    }

    const dirtyMonths = (await store.listDirtyMonths()).filter((mk) => mk !== monthKey);

    for (const dirtyMonth of dirtyMonths) {
      const dirtyExisting = await store.readMonthlyRow(dirtyMonth);
      if (!args.force && isMonthPayloadFrozen(dirtyExisting, dirtyMonth)) {
        console.warn(
          `[dashboard:kpi-margem-fechar] dirty ignorado — ${dirtyMonth} congelado (verdade histórica)`,
        );
        await store.deleteDirtyMonth(dirtyMonth);
        continue;
      }

      if (dirtyMonth >= currentMonth) {
        console.log(`[dashboard:kpi-margem-fechar] dirty rebuild ${dirtyMonth} (mês corrente)`);
        const [dy, dm] = dirtyMonth.split('-').map(Number);
        const lastDay = new Date(dy, dm, 0).getDate();
        const dirtyThrough =
          dirtyMonth < monthKey
            ? `${dirtyMonth}-${String(lastDay).padStart(2, '0')}`
            : throughDateKey;
        await sealMonth(store, dirtyMonth, dirtyThrough, { force: args.force });
        await store.deleteDirtyMonth(dirtyMonth);
      } else {
        console.warn(
          `[dashboard:kpi-margem-fechar] dirty ignorado — ${dirtyMonth} passado sem --force`,
        );
        await store.deleteDirtyMonth(dirtyMonth);
      }
    }

    console.log(JSON.stringify({ success: true, ...result }, null, 2));
  } finally {
    await store.destroy();
  }
}

main().catch((err) => {
  console.error('[dashboard:kpi-margem-fechar]', err.message);
  process.exit(1);
});
