/**
 * KPIs diários/mensais do dashboard — mesma base do Relatório de Margem.
 * Agrega por produto (calcularLinhasMargemVendas), não por pedido.
 * Mês corrente: custo do cadastro (dinâmico). Mês fechado: congelado no snapshot.
 */
import { format, getDate } from 'date-fns';
import { shouldFreezeMargemMonthPayload } from '@/lib/margemCustoMode';
import { getCurrentMonthKey } from '@/lib/dashboardVendasPeriod';
import {
  calcularLinhasMargemVendas,
  calcularTotaisMargem,
  competenciaParaIntervalo,
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
    markupPercent: 0,
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

/** Intervalo civil do mês até uma data inclusive (Tabatinga / created_date). */
export function intervaloCompetenciaAte(competencia, throughDateKey) {
  const base = competenciaParaIntervalo(competencia);
  if (!base || !throughDateKey) return null;
  const [y, m, d] = throughDateKey.split('-').map(Number);
  if (!y || !m || !d) return null;
  return {
    from: base.from,
    to: new Date(y, m - 1, d, 23, 59, 59, 999),
  };
}

function intervaloDiaCivil(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return {
    from: new Date(y, m - 1, d, 0, 0, 0, 0),
    to: new Date(y, m - 1, d, 23, 59, 59, 999),
  };
}

/** Converte linhas do Relatório de Margem para totais do dashboard KPI. */
export function totaisLinhasMargemParaKpi(linhas = [], { pedidoCount = 0 } = {}) {
  const tot = calcularTotaisMargem(linhas);
  const salesGross = roundMoney(
    linhas.reduce((sum, row) => sum + (Number(row.total_recebido) || 0), 0),
  );
  const discounts = roundMoney(
    linhas.reduce((sum, row) => sum + (Number(row.total_desconto_venda) || 0), 0),
  );
  const cost = roundMoney(tot.custo_total);
  const profit = roundMoney(tot.lucro_bruto);
  const salesNet = roundMoney(tot.receita_liquida);
  const markupPercent = cost > 0 ? roundMoney((profit / cost) * 100) : 0;

  return {
    salesGross,
    discounts,
    salesNet,
    cost,
    profit,
    markupPercent,
    pedidoCount,
  };
}

/**
 * Mesmo motor do Relatório de Margem para um conjunto de pedidos e intervalo.
 */
export function calcularMargemKpiIntervalo({
  pedidos = [],
  sales = [],
  produtos = [],
  products = [],
  devolucoesTroca = [],
  pedidosOrigemTroca = {},
  intervalo,
  pedidoCount = null,
}) {
  const pedidosLista = pedidos.length ? pedidos : sales;
  const produtosLista = produtos.length ? produtos : products;
  if (!intervalo) return emptyDayTotals();

  const linhas = calcularLinhasMargemVendas(
    pedidosLista,
    produtosLista,
    intervalo,
    devolucoesTroca,
    pedidosOrigemTroca,
  );

  const count =
    pedidoCount ??
    (Array.isArray(pedidosLista)
      ? pedidosLista.filter((sale) => pedidoElegivelMargem(sale)).length
      : 0);

  return totaisLinhasMargemParaKpi(linhas, { pedidoCount: count });
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

  const intervaloMes = intervaloCompetenciaAte(prefix, throughDateKey);
  const salesByDay = {};

  for (const sale of Array.isArray(pedidosLista) ? pedidosLista : []) {
    if (!pedidoElegivelMargem(sale)) continue;
    const saleDate = getDataVendaMargem(sale);
    const key = saleDateKey(saleDate);
    if (!key || !key.startsWith(prefix) || key > throughDateKey) continue;
    if (!salesByDay[key]) salesByDay[key] = [];
    salesByDay[key].push(sale);
  }

  const dailyTotals = {};
  const monthlyTotals = emptyDayTotals();

  for (const [refDate, daySales] of Object.entries(salesByDay).sort()) {
    const totals = calcularMargemKpiIntervalo({
      pedidos: daySales,
      produtos: produtosLista,
      devolucoesTroca,
      pedidosOrigemTroca,
      intervalo: intervaloDiaCivil(refDate),
      pedidoCount: daySales.length,
    });

    dailyTotals[refDate] = totals;
    monthlyTotals.salesGross += totals.salesGross;
    monthlyTotals.discounts += totals.discounts;
    monthlyTotals.salesNet += totals.salesNet;
    monthlyTotals.cost += totals.cost;
    monthlyTotals.profit += totals.profit;
    monthlyTotals.pedidoCount += totals.pedidoCount;
  }

  const monthlyLinhas = calcularLinhasMargemVendas(
    pedidosLista,
    produtosLista,
    intervaloMes,
    devolucoesTroca,
    pedidosOrigemTroca,
  );
  const monthlyFromLinhas = totaisLinhasMargemParaKpi(monthlyLinhas, {
    pedidoCount: monthlyTotals.pedidoCount,
  });

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
      markupPercent: totals.markupPercent,
      pedidoCount: totals.pedidoCount,
      sourceVersion: DASHBOARD_KPI_MARGEM_SOURCE_VERSION,
    };
  }

  const salesByDayChart = {};
  const profitByDayChart = {};
  for (const [refDate, payload] of Object.entries(daily)) {
    salesByDayChart[String(payload.day)] = payload.salesNet;
    profitByDayChart[String(payload.day)] = payload.profit;
  }

  let closedThrough = null;
  for (const refDate of Object.keys(daily).sort()) {
    if (!closedThrough || refDate > closedThrough) closedThrough = refDate;
  }

  const frozen = shouldFreezeMargemMonthPayload(prefix);
  const monthly = {
    monthKey: prefix,
    closedThrough,
    frozen,
    frozenAt: frozen ? new Date().toISOString() : null,
    costBasis: frozen ? 'momento_venda' : 'cadastro_atual',
    salesByDay: salesByDayChart,
    profitByDay: profitByDayChart,
    monthlyTotals: {
      salesGross: monthlyFromLinhas.salesGross,
      discounts: monthlyFromLinhas.discounts,
      salesNet: monthlyFromLinhas.salesNet,
      cost: monthlyFromLinhas.cost,
      profit: monthlyFromLinhas.profit,
      markupPercent: monthlyFromLinhas.markupPercent,
      pedidoCount: monthlyFromLinhas.pedidoCount,
      sourceVersion: DASHBOARD_KPI_MARGEM_SOURCE_VERSION,
      frozen,
      costBasis: frozen ? 'momento_venda' : 'cadastro_atual',
    },
    sourceVersion: DASHBOARD_KPI_MARGEM_SOURCE_VERSION,
  };

  return { daily, monthly, sourceVersion: DASHBOARD_KPI_MARGEM_SOURCE_VERSION };
}
