/**
 * KPIs diários/mensais do dashboard — mesma base do Relatório de Margem.
 * Recalcula com custos de hoje (preco_custo_calculado) em cada corrida do job.
 */
import { format, getDate } from 'date-fns';
import {
  calcularTotaisPedidoMargem,
  getDataVendaMargem,
  pedidoElegivelMargem,
} from '@/lib/relatorioMargemCalculos';
import { buildIndiceDevolucaoTrocaMargem } from '@/lib/relatorioMargemTroca';

export const DASHBOARD_KPI_MARGEM_SOURCE_VERSION = 'relatorio_margem_v1';

function emptyDayTotals() {
  return {
    salesGross: 0,
    discounts: 0,
    salesNet: 0,
    cost: 0,
    profit: 0,
    pedidoCount: 0,
  };
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function saleDateKey(saleDate) {
  if (!saleDate) return null;
  return format(saleDate, 'yyyy-MM-dd');
}

/**
 * Agrega pedidos elegíveis ao Margem por dia civil (Tabatinga / created_date).
 * @param {string} throughDateKey - YYYY-MM-DD inclusive (tipicamente ontem)
 */
export function computeDashboardKpiMargemForMonth({
  pedidos = [],
  sales = [],
  produtos = [],
  products = [],
  devolucoesTroca = [],
  pedidosOrigemTroca = {},
  monthKey,
  throughDateKey,
}) {
  const pedidosLista = pedidos.length ? pedidos : sales;
  const produtosLista = produtos.length ? produtos : products;
  const prefix = String(monthKey || '').slice(0, 7);
  if (!prefix || !throughDateKey?.startsWith(prefix)) {
    return { daily: {}, monthly: null, sourceVersion: DASHBOARD_KPI_MARGEM_SOURCE_VERSION };
  }

  const prodMap = (produtosLista || []).reduce((acc, produto) => {
    if (produto?.id) acc[produto.id] = produto;
    return acc;
  }, {});

  const indiceTrocas = buildIndiceDevolucaoTrocaMargem(devolucoesTroca);
  const dailyTotals = {};
  const monthlyTotals = emptyDayTotals();
  monthlyTotals.pedidoCount = 0;

  const eligible = (Array.isArray(pedidosLista) ? pedidosLista : []).filter((sale) => {
    if (!pedidoElegivelMargem(sale)) return false;
    const saleDate = getDataVendaMargem(sale);
    const key = saleDateKey(saleDate);
    if (!key || !key.startsWith(prefix)) return false;
    return key <= throughDateKey;
  });

  for (const sale of eligible) {
    const saleDate = getDataVendaMargem(sale);
    const key = saleDateKey(saleDate);
    if (!key) continue;

    const totals = calcularTotaisPedidoMargem(sale, prodMap, {
      indiceTrocas,
      pedidosOrigemMap: pedidosOrigemTroca,
    });

    if (!dailyTotals[key]) dailyTotals[key] = emptyDayTotals();
    const day = dailyTotals[key];
    day.salesGross += totals.salesGross;
    day.discounts += totals.discounts;
    day.salesNet += totals.salesNet;
    day.cost += totals.cost;
    day.profit += totals.profit;
    day.pedidoCount += 1;

    monthlyTotals.salesGross += totals.salesGross;
    monthlyTotals.discounts += totals.discounts;
    monthlyTotals.salesNet += totals.salesNet;
    monthlyTotals.cost += totals.cost;
    monthlyTotals.profit += totals.profit;
    monthlyTotals.pedidoCount += 1;
  }

  const daily = {};
  for (const [refDate, totals] of Object.entries(dailyTotals)) {
    const dayNum = getDate(new Date(`${refDate}T12:00:00-05:00`));
    daily[refDate] = {
      day: dayNum,
      salesNet: roundMoney(totals.salesNet),
      salesGross: roundMoney(totals.salesGross),
      discounts: roundMoney(totals.discounts),
      cost: roundMoney(totals.cost),
      profit: roundMoney(totals.profit),
      pedidoCount: totals.pedidoCount,
      sourceVersion: DASHBOARD_KPI_MARGEM_SOURCE_VERSION,
    };
  }

  const salesByDay = {};
  const profitByDay = {};
  for (const [refDate, payload] of Object.entries(daily)) {
    salesByDay[String(payload.day)] = payload.salesNet;
    profitByDay[String(payload.day)] = payload.profit;
  }

  let closedThrough = null;
  for (const refDate of Object.keys(daily).sort()) {
    if (!closedThrough || refDate > closedThrough) closedThrough = refDate;
  }

  const monthly = {
    monthKey: prefix,
    closedThrough,
    salesByDay,
    profitByDay,
    monthlyTotals: {
      salesGross: roundMoney(monthlyTotals.salesGross),
      discounts: roundMoney(monthlyTotals.discounts),
      salesNet: roundMoney(monthlyTotals.salesNet),
      cost: roundMoney(monthlyTotals.cost),
      profit: roundMoney(monthlyTotals.profit),
      pedidoCount: monthlyTotals.pedidoCount,
      sourceVersion: DASHBOARD_KPI_MARGEM_SOURCE_VERSION,
    },
    sourceVersion: DASHBOARD_KPI_MARGEM_SOURCE_VERSION,
  };

  return { daily, monthly, sourceVersion: DASHBOARD_KPI_MARGEM_SOURCE_VERSION };
}
