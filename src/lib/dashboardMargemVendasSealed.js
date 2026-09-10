/**
 * Aplica snapshots mensais de vendas (Postgres) aos buckets do dashboard.
 * Evita reprocessar pedidos de períodos já fechados.
 */

import { format, getDate } from 'date-fns';
import { getCurrentMonthKey } from '@/lib/dashboardVendasPeriod';
import { getOntemDateKey } from '@/lib/dashboardIncrementalCache';

function emptyMonthlyTotals() {
  return {
    salesGross: 0,
    discounts: 0,
    salesNet: 0,
    cost: 0,
    profit: 0,
    markupPercent: 0,
  };
}

function sumDayValues(dayMap = {}, maxDay = null) {
  return Object.entries(dayMap).reduce((sum, [dayStr, value]) => {
    const day = Number(dayStr);
    if (!day || (maxDay != null && day > maxDay)) return sum;
    return sum + (Number(value) || 0);
  }, 0);
}

/** Se monthlyTotals.profit vier zerado mas profitByDay tem dados, reconcilia. */
function reconcileSealedMonthTotals(seal, monthlyEntry, profitByDay, salesByDay, cutoffDay) {
  const profitFromDays = sumDayValues(profitByDay, cutoffDay);
  const salesFromDays = sumDayValues(salesByDay, cutoffDay);

  if (profitFromDays > 0 && !(Number(monthlyEntry.profit) > 0)) {
    monthlyEntry.profit = Math.round(profitFromDays * 100) / 100;
  }
  if (salesFromDays > 0 && !(Number(monthlyEntry.salesNet) > 0)) {
    monthlyEntry.salesNet = Math.round(salesFromDays * 100) / 100;
  }

  const cost = Number(monthlyEntry.cost) || 0;
  const profit = Number(monthlyEntry.profit) || 0;
  if (!monthlyEntry.markupPercent && cost > 0 && profit > 0) {
    monthlyEntry.markupPercent = Math.round((profit / cost) * 10000) / 100;
  }

  monthlyEntry.frozen = Boolean(seal?.frozen);
  monthlyEntry.costBasis = seal?.costBasis || seal?.monthlyTotals?.costBasis || null;
  monthlyEntry.sourceVersion =
    seal?.sourceVersion || seal?.monthlyTotals?.sourceVersion || null;
}

/** Preenche salesByMonthDay / profitByMonthDay / monthlyTotals a partir de sealedMonths. */
export function mergeSealedVendasIntoBuckets(monthBuckets6, sealedMonths = {}) {
  const salesByMonthDay = {};
  const profitByMonthDay = {};
  const monthlyTotals = {};

  monthBuckets6.forEach((bucket) => {
    salesByMonthDay[bucket.key] = {};
    profitByMonthDay[bucket.key] = {};
    monthlyTotals[bucket.key] = emptyMonthlyTotals();
  });

  for (const bucket of monthBuckets6) {
    const seal = sealedMonths[bucket.key];
    if (!seal?.monthlyTotals) continue;

    const mt = seal.monthlyTotals;
    const cost = Number(mt.cost) || 0;
    const profit = Number(mt.profit) || 0;
    monthlyTotals[bucket.key] = {
      salesGross: Number(mt.salesGross) || 0,
      discounts: Number(mt.discounts) || 0,
      salesNet: Number(mt.salesNet) || 0,
      cost,
      profit,
      markupPercent:
        Number(mt.markupPercent) ||
        (cost > 0 ? Math.round((profit / cost) * 10000) / 100 : 0),
    };

    const salesByDay = seal.salesByDay || {};
    const profitByDay = seal.profitByDay || {};
    for (const [dayStr, value] of Object.entries(salesByDay)) {
      const day = Number(dayStr);
      if (!day) continue;
      salesByMonthDay[bucket.key][day] = Number(value) || 0;
    }
    for (const [dayStr, value] of Object.entries(profitByDay)) {
      const day = Number(dayStr);
      if (!day) continue;
      profitByMonthDay[bucket.key][day] = Number(value) || 0;
    }

    reconcileSealedMonthTotals(
      seal,
      monthlyTotals[bucket.key],
      profitByMonthDay[bucket.key],
      salesByMonthDay[bucket.key],
      null,
    );
  }

  return { salesByMonthDay, profitByMonthDay, monthlyTotals };
}

/** Mês coberto por snapshot/célula até ontem (passado); mês corrente exige closedThrough ≥ ontem. */
export function isMonthCoveredAteOntem(monthKey, sealedMonths = {}) {
  const seal = sealedMonths[monthKey];
  if (!seal?.monthlyTotals) return false;

  const currentKey = getCurrentMonthKey();
  if (monthKey < currentKey) return true;
  if (monthKey > currentKey) return false;

  const ontem = getOntemDateKey();
  const closedThrough = String(seal.closedThrough || '').slice(0, 10);
  return closedThrough >= ontem;
}

/** Venda já contabilizada no snapshot (não somar de novo a partir dos pedidos). */
export function isSaleCoveredBySealedMonth(saleDate, monthKey, sealedMonths = {}) {
  const seal = sealedMonths[monthKey];
  if (!seal?.monthlyTotals) return false;

  const currentKey = getCurrentMonthKey();
  if (monthKey < currentKey) return true;

  const saleDayKey = format(saleDate, 'yyyy-MM-dd');
  const closedThrough = String(seal.closedThrough || '').slice(0, 10);
  if (closedThrough && saleDayKey <= closedThrough) return true;

  const day = getDate(saleDate);
  const salesByDay = seal.salesByDay || {};
  return Object.prototype.hasOwnProperty.call(salesByDay, String(day));
}

export function buildProdutosMargemFromCostMap(productCostMap) {
  if (!productCostMap?.size) return [];
  return [...productCostMap.entries()].map(([id, cost]) => ({
    id,
    preco_custo_calculado: Number(cost) || 0,
  }));
}
