/**
 * Aplica snapshots mensais de vendas (Postgres) aos buckets do dashboard.
 * Evita reprocessar pedidos de períodos já fechados.
 */

import { format, getDate } from 'date-fns';
import { getCurrentMonthKey } from '@/lib/dashboardVendasPeriod';

function emptyMonthlyTotals() {
  return {
    salesGross: 0,
    discounts: 0,
    salesNet: 0,
    cost: 0,
    profit: 0,
  };
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
    monthlyTotals[bucket.key] = {
      salesGross: Number(mt.salesGross) || 0,
      discounts: Number(mt.discounts) || 0,
      salesNet: Number(mt.salesNet) || 0,
      cost: Number(mt.cost) || 0,
      profit: Number(mt.profit) || 0,
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
  }

  return { salesByMonthDay, profitByMonthDay, monthlyTotals };
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
