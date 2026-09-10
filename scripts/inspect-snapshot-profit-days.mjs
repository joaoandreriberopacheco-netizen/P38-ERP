#!/usr/bin/env node
import { createMargemKpiSupabaseClient } from '../src/lib/fetchMargemKpiSupabase.js';

const sb = createMargemKpiSupabaseClient();
const { data } = await sb
  .from('dashboard_kpi_mensal')
  .select('payload, closed_through, computed_at')
  .eq('domain', 'vendas')
  .eq('month_key', '2026-09')
  .maybeSingle();

const p = data?.payload || {};
const sumProfit = Object.values(p.profitByDay || {}).reduce((s, v) => s + Number(v), 0);
const sumSales = Object.values(p.salesByDay || {}).reduce((s, v) => s + Number(v), 0);

console.log(
  JSON.stringify(
    {
      computed_at: data?.computed_at,
      closed_through: data?.closed_through,
      monthly_profit: p.monthlyTotals?.profit,
      monthly_salesNet: p.monthlyTotals?.salesNet,
      profitByDay_sum: Math.round(sumProfit * 100) / 100,
      salesByDay_sum: Math.round(sumSales * 100) / 100,
      profitByDay: p.profitByDay,
      sourceVersion: p.sourceVersion,
    },
    null,
    2,
  ),
);
