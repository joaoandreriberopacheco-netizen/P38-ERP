/**
 * Gravações em dashboard_kpi_* via Postgres (DATABASE_URL).
 * Usado no job noturno quando só há anon key no Supabase REST — anon não pode INSERT/UPDATE.
 */
import { connectPg } from './pg-connect-ipv4.mjs';
import { resolveSupabaseDeployEnv } from '../supabase-env.mjs';

/** @returns {Promise<import('pg').Client | null>} */
export async function connectDashboardKpiPg() {
  const { databaseUrl } = resolveSupabaseDeployEnv();
  if (!databaseUrl) return null;
  return connectPg(databaseUrl);
}

export async function pgUpsertDaily(client, monthKey, refDate, payload) {
  await client.query(
    `insert into public.dashboard_kpi_diario (domain, ref_date, month_key, payload, computed_at)
     values ('vendas', $1::date, $2, $3::jsonb, $4::timestamptz)
     on conflict (domain, ref_date) do update set
       month_key = excluded.month_key,
       payload = excluded.payload,
       computed_at = excluded.computed_at`,
    [refDate, monthKey, JSON.stringify(payload), new Date().toISOString()],
  );
}

export async function pgUpsertMonthly(client, monthKey, closedThrough, payload) {
  await client.query(
    `insert into public.dashboard_kpi_mensal (domain, month_key, closed_through, payload, computed_at)
     values ('vendas', $1, $2::date, $3::jsonb, $4::timestamptz)
     on conflict (domain, month_key) do update set
       closed_through = excluded.closed_through,
       payload = excluded.payload,
       computed_at = excluded.computed_at`,
    [monthKey, closedThrough, JSON.stringify(payload), new Date().toISOString()],
  );
}

export async function pgSyncCelulaVendas(client, monthKey) {
  const { rows } = await client.query(
    'select public.p38_celula_compute_vendas_mes($1) as result',
    [monthKey],
  );
  return rows[0]?.result ?? null;
}

export async function pgDeleteDirty(client, monthKey) {
  await client.query(
    `delete from public.dashboard_kpi_dirty where domain = 'vendas' and month_key = $1`,
    [monthKey],
  );
}
