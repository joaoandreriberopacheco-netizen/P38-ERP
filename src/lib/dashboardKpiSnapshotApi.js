/**
 * Leitura de snapshots de KPI do dashboard gravados no Supabase (Fase 2).
 * Fallback silencioso se Supabase não estiver configurado ou RPC indisponível.
 */

import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';
import { getCurrentMonthKey, getMonthBucketsEndingAt } from '@/lib/dashboardVendasPeriod';
import { getOntemDateKey } from '@/lib/dashboardIncrementalCache';

function normalizeMonthRow(row) {
  if (!row?.monthKey || !row?.payload) return null;
  return {
    monthKey: row.monthKey,
    closedThrough: row.closedThrough || row.payload?.closedThrough || null,
    payload: row.payload,
    computedAt: row.computedAt || null,
  };
}

/** @returns {Promise<Map<string, object>>} monthKey → snapshot row */
export async function fetchDashboardVendasSnapshotsForWindow(selectedMonthKey, months = 6) {
  const empty = new Map();
  if (!isSupabaseBrowserConfigured()) return empty;

  const buckets = getMonthBucketsEndingAt(selectedMonthKey, months);
  const monthKeys = buckets.map((b) => b.key);
  if (!monthKeys.length) return empty;

  try {
    const supabase = getSupabaseBrowserClient();

    const { data: windowData, error: windowError } = await supabase.rpc('dashboard_vendas_window_read', {
      p_selected_month: selectedMonthKey,
      p_months: months,
    });

    if (!windowError && windowData?.sealedMonths && typeof windowData.sealedMonths === 'object') {
      const map = new Map();
      for (const [monthKey, payload] of Object.entries(windowData.sealedMonths)) {
        if (!payload?.monthlyTotals) continue;
        map.set(monthKey, {
          monthKey,
          closedThrough: payload.closedThrough || null,
          payload,
          computedAt: null,
          windowComplete: Boolean(windowData.complete),
        });
      }
      if (map.size > 0) return map;
    }

    const { data, error } = await supabase.rpc('dashboard_kpi_vendas_read', {
      p_month_keys: monthKeys,
    });

    if (error || !data?.months) return empty;

    const map = new Map();
    for (const raw of data.months) {
      const row = normalizeMonthRow(raw);
      if (row) map.set(row.monthKey, row);
    }
    return map;
  } catch {
    return empty;
  }
}

/**
 * Snapshot do mês corrente válido até ontem (fechado pelo job noturno).
 * @returns {Promise<object|null>}
 */
export async function fetchDashboardVendasCurrentMonthSealed() {
  if (!isSupabaseBrowserConfigured()) return null;

  const monthKey = getCurrentMonthKey();
  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc('dashboard_kpi_vendas_read_current_through_ontem', {
      p_month_key: monthKey,
    });
    if (error || !data?.found) return null;
    return normalizeMonthRow({
      monthKey: data.monthKey,
      closedThrough: data.closedThrough,
      payload: data.payload,
      computedAt: data.computedAt,
    });
  } catch {
    return null;
  }
}

/** Meses fechados civilmente com snapshot completo (não buscar pedidos de novo). */
export function isSealedMonthSnapshot(row, monthKey) {
  if (!row?.payload?.monthlyTotals) return false;
  const currentKey = getCurrentMonthKey();
  if (monthKey < currentKey) return true;
  if (monthKey > currentKey) return false;
  const ontem = getOntemDateKey();
  const closedThrough = String(row.closedThrough || row.payload?.closedThrough || '').slice(0, 10);
  return closedThrough >= ontem;
}

/** Converte Map de snapshots para object keyed by month (uso em compute). */
export function sealedMonthsFromSnapshotMap(snapshotMap) {
  const sealed = {};
  if (!snapshotMap?.size) return sealed;

  for (const [monthKey, row] of snapshotMap.entries()) {
    if (!isSealedMonthSnapshot(row, monthKey)) continue;
    sealed[monthKey] = row.payload;
  }
  return sealed;
}

/** Meses da janela cobertos por snapshot — não precisam de fetch API. */
export function planSealedMonthKeys(snapshotMap, selectedMonthKey, months = 6) {
  const buckets = getMonthBucketsEndingAt(selectedMonthKey, months);
  return buckets
    .map((b) => b.key)
    .filter((monthKey) => {
      const row = snapshotMap?.get?.(monthKey);
      return isSealedMonthSnapshot(row, monthKey);
    });
}
