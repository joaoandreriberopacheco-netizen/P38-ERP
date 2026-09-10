#!/usr/bin/env node
import { createMargemKpiSupabaseClient, fetchMargemKpiDataset } from '../src/lib/fetchMargemKpiSupabase.js';
import { format } from 'date-fns';
import {
  calcularLinhasMargemVendas,
  calcularTotaisMargem,
  defaultMargemDateRange,
  getDataVendaMargem,
} from '../src/lib/relatorioMargemCalculos.js';
import { computeDashboardVendasMetricsMargem } from '../src/lib/dashboardMargemVendas.js';
import { buildProdutosMargemFromCostMap } from '../src/lib/dashboardMargemVendasSealed.js';
import { resolveCustoTotalUnitBaseProduto } from '../src/lib/productUnits.js';

const MONTH = '2026-09';
const sb = createMargemKpiSupabaseClient();
const dataset = await fetchMargemKpiDataset(MONTH, sb);

// Relatório: intervalo padrão mês corrente Tabatinga
const dateRange = defaultMargemDateRange();
const linhasRel = calcularLinhasMargemVendas(
  dataset.sales,
  dataset.products,
  dateRange,
  dataset.devolucoesTroca,
  dataset.pedidosOrigemTroca,
);
const rel = calcularTotaisMargem(linhasRel);

// Snapshot KPI no Postgres
const { data: snapRow } = await sb
  .from('dashboard_kpi_mensal')
  .select('payload, closed_through')
  .eq('domain', 'vendas')
  .eq('month_key', MONTH)
  .maybeSingle();
const snap = snapRow?.payload || {};

// Simula dashboard: pedidos do mês (como fetchDashboardVendas monthStart..hoje)
const pedidosMes = dataset.sales.filter((p) => {
  const saleDate = getDataVendaMargem(p);
  if (!saleDate) return false;
  return format(saleDate, 'yyyy-MM') === MONTH;
});

const costMap = new Map();
for (const p of pedidosMes) {
  for (const it of p.itens || []) {
    const pid = it.produto_id;
    if (!pid || costMap.has(pid)) continue;
    const prod = dataset.products.find((x) => x.id === pid);
    if (prod) costMap.set(pid, resolveCustoTotalUnitBaseProduto(prod));
  }
}
const produtosCostMap = buildProdutosMargemFromCostMap(costMap);

const dashCostMap = computeDashboardVendasMetricsMargem({
  pedidos: pedidosMes,
  produtos: produtosCostMap,
  devolucoesTroca: dataset.devolucoesTroca,
  pedidosOrigemTroca: dataset.pedidosOrigemTroca,
  kpiConfig: {},
  selectedMonthKey: MONTH,
  sealedMonths: { [MONTH]: snap },
});

const dash = computeDashboardVendasMetricsMargem({
  pedidos: pedidosMes,
  produtos: dataset.products,
  devolucoesTroca: dataset.devolucoesTroca,
  pedidosOrigemTroca: dataset.pedidosOrigemTroca,
  kpiConfig: {},
  selectedMonthKey: MONTH,
  sealedMonths: { [MONTH]: snap },
});

const sumProfitDays = Object.values(snap.profitByDay || {}).reduce((s, v) => s + Number(v), 0);

console.log(
  JSON.stringify(
    {
      relatorio_padrao: {
        receita: Math.round(rel.receita_liquida * 100) / 100,
        custo: Math.round(rel.custo_total * 100) / 100,
        lucro: Math.round(rel.lucro_bruto * 100) / 100,
      },
      snapshot_mensal: snap.monthlyTotals,
      snapshot_profitByDay_sum: Math.round(sumProfitDays * 100) / 100,
      snapshot_closedThrough: snapRow?.closed_through,
      dashboard_catalogo_completo: {
        lucro: dash.lucroKpi?.selectedProfit,
        receita: dash.lucroKpi?.selectedSalesNet,
      },
      dashboard_só_cost_map: {
        lucro: dashCostMap.lucroKpi?.selectedProfit,
        receita: dashCostMap.lucroKpi?.selectedSalesNet,
      },
      pedidos_mes: pedidosMes.length,
    },
    null,
    2,
  ),
);
