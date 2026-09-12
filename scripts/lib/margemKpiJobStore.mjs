/**
 * Leituras via Supabase REST; gravações via Postgres (DATABASE_URL) quando disponível.
 * Evita depender de SUPABASE_SERVICE_ROLE_KEY no GitHub Actions — DATABASE_URL já existe.
 */
import { connectPg } from './pg-connect-ipv4.mjs';
import {
  createMargemKpiSupabaseClient,
  fetchTabatingaOntem,
} from '../../src/lib/fetchMargemKpiSupabase.js';

/** @param {import('pg').Client | null} pg */
async function readMonthlyRowPg(pg, monthKey) {
  const { rows } = await pg.query(
    `select month_key, closed_through, payload, computed_at
     from public.dashboard_kpi_mensal
     where domain = 'vendas' and month_key = $1
     limit 1`,
    [monthKey],
  );
  return rows[0] || null;
}

/** @param {import('pg').Client | null} pg */
async function upsertDailyPg(pg, monthKey, refDate, payload) {
  await pg.query(
    `insert into public.dashboard_kpi_diario (domain, ref_date, month_key, payload, computed_at)
     values ('vendas', $1::date, $2, $3::jsonb, $4::timestamptz)
     on conflict (domain, ref_date) do update set
       month_key = excluded.month_key,
       payload = excluded.payload,
       computed_at = excluded.computed_at`,
    [refDate, monthKey, JSON.stringify(payload), new Date().toISOString()],
  );
}

/** @param {import('pg').Client | null} pg */
async function upsertMonthlyPg(pg, monthKey, closedThrough, payload) {
  await pg.query(
    `insert into public.dashboard_kpi_mensal (domain, month_key, closed_through, payload, computed_at)
     values ('vendas', $1, $2::date, $3::jsonb, $4::timestamptz)
     on conflict (domain, month_key) do update set
       closed_through = excluded.closed_through,
       payload = excluded.payload,
       computed_at = excluded.computed_at`,
    [monthKey, closedThrough, JSON.stringify(payload), new Date().toISOString()],
  );
}

/** @param {import('pg').Client | null} pg */
async function syncCelulaVendasPg(pg, monthKey) {
  const { rows } = await pg.query('select public.p38_celula_compute_vendas_mes($1) as result', [
    monthKey,
  ]);
  return rows[0]?.result ?? null;
}

/** @param {import('pg').Client | null} pg */
async function listDirtyMonthsPg(pg) {
  const { rows } = await pg.query(
    `select month_key from public.dashboard_kpi_dirty where domain = 'vendas'`,
  );
  return [...new Set(rows.map((r) => r.month_key).filter(Boolean))];
}

/** @param {import('pg').Client | null} pg */
async function deleteDirtyMonthPg(pg, monthKey) {
  await pg.query(
    `delete from public.dashboard_kpi_dirty where domain = 'vendas' and month_key = $1`,
    [monthKey],
  );
}

/** @param {import('pg').Client | null} pg */
async function fetchOntemPg(pg) {
  const { rows } = await pg.query('select public.p38_tabatinga_ontem() as ontem');
  const ontem = rows[0]?.ontem;
  if (ontem) return String(ontem).slice(0, 10);
  return fetchTabatingaOntem(createMargemKpiSupabaseClient());
}

export async function createMargemKpiJobStore() {
  const sb = createMargemKpiSupabaseClient();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  let pg = null;

  if (databaseUrl) {
    pg = await connectPg(databaseUrl);
  }

  const usePgWrites = Boolean(pg);

  return {
    supabase: sb,
    usesPgWrites: usePgWrites,

    async destroy() {
      if (pg) await pg.end();
    },

    async fetchOntem() {
      if (pg) return fetchOntemPg(pg);
      return fetchTabatingaOntem(sb);
    },

    async readMonthlyRow(monthKey) {
      if (pg) return readMonthlyRowPg(pg, monthKey);
      const { data, error } = await sb
        .from('dashboard_kpi_mensal')
        .select('month_key, closed_through, payload, computed_at')
        .eq('domain', 'vendas')
        .eq('month_key', monthKey)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    async upsertDaily(monthKey, refDate, payload) {
      if (pg) return upsertDailyPg(pg, monthKey, refDate, payload);
      const { error } = await sb.from('dashboard_kpi_diario').upsert(
        {
          domain: 'vendas',
          ref_date: refDate,
          month_key: monthKey,
          payload,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'domain,ref_date' },
      );
      if (error) throw error;
    },

    async upsertMonthly(monthKey, closedThrough, payload) {
      if (pg) return upsertMonthlyPg(pg, monthKey, closedThrough, payload);
      const { error } = await sb.from('dashboard_kpi_mensal').upsert(
        {
          domain: 'vendas',
          month_key: monthKey,
          closed_through: closedThrough,
          payload,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'domain,month_key' },
      );
      if (error) throw error;
    },

    async syncCelulaVendas(monthKey) {
      try {
        if (pg) return await syncCelulaVendasPg(pg, monthKey);
        const { data, error } = await sb.rpc('p38_celula_compute_vendas_mes', {
          p_month_key: monthKey,
        });
        if (error) throw error;
        return data;
      } catch (err) {
        console.warn(
          `[dashboard:kpi-margem-fechar] célula vendas:${monthKey}:`,
          err?.message || err,
        );
        return null;
      }
    },

    async listDirtyMonths() {
      if (pg) return listDirtyMonthsPg(pg);
      const { data, error } = await sb
        .from('dashboard_kpi_dirty')
        .select('month_key')
        .eq('domain', 'vendas');
      if (error) throw error;
      return [...new Set((data || []).map((r) => r.month_key).filter(Boolean))];
    },

    async deleteDirtyMonth(monthKey) {
      if (pg) return deleteDirtyMonthPg(pg, monthKey);
      const { error } = await sb
        .from('dashboard_kpi_dirty')
        .delete()
        .eq('domain', 'vendas')
        .eq('month_key', monthKey);
      if (error) throw error;
    },
  };
}
