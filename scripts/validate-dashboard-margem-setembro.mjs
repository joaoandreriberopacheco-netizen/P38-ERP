#!/usr/bin/env node
/** Valida KPI margem vs Relatório de Margem (set/2026 até ontem). */
import { computeDashboardKpiMargemForMonth } from '../src/lib/dashboardKpiMargemCompute.js';
import {
  calcularLinhasMargemVendas,
  calcularTotaisMargem,
  competenciaParaIntervalo,
} from '../src/lib/relatorioMargemCalculos.js';
import {
  createMargemKpiSupabaseClient,
  fetchMargemKpiDataset,
} from '../src/lib/fetchMargemKpiSupabase.js';

const MONTH = process.argv[2] || '2026-09';
const THROUGH = process.argv[3] || '2026-09-09';

const dataset = await fetchMargemKpiDataset(MONTH, createMargemKpiSupabaseClient());
const { monthly } = computeDashboardKpiMargemForMonth({
  ...dataset,
  monthKey: MONTH,
  throughDateKey: THROUGH,
});

const intervalo = competenciaParaIntervalo(MONTH);
const [y, m, d] = THROUGH.split('-').map(Number);
intervalo.to = new Date(y, m - 1, d, 23, 59, 59, 999);

const linhas = calcularLinhasMargemVendas(
  dataset.sales,
  dataset.products,
  intervalo,
  dataset.devolucoesTroca,
  dataset.pedidosOrigemTroca,
);
const rel = calcularTotaisMargem(linhas);
const kpi = monthly?.monthlyTotals || {};
const markupRel = rel.custo_total > 0 ? (rel.lucro_bruto / rel.custo_total) * 100 : 0;

console.log(
  JSON.stringify(
    {
      mes: MONTH,
      through: THROUGH,
      relatorio_margem: {
        receita: rel.receita_liquida,
        custo: rel.custo_total,
        lucro: rel.lucro_bruto,
        markup_pct: Math.round(markupRel * 10) / 10,
      },
      dashboard_kpi_job: {
        receita: kpi.salesNet,
        custo: kpi.cost,
        lucro: kpi.profit,
        markup_pct: kpi.markupPercent,
      },
      diff: {
        receita: Math.round((kpi.salesNet - rel.receita_liquida) * 100) / 100,
        custo: Math.round((kpi.cost - rel.custo_total) * 100) / 100,
        lucro: Math.round((kpi.profit - rel.lucro_bruto) * 100) / 100,
      },
      ok:
        Math.abs(kpi.salesNet - rel.receita_liquida) < 0.02 &&
        Math.abs(kpi.profit - rel.lucro_bruto) < 0.02,
    },
    null,
    2,
  ),
);
