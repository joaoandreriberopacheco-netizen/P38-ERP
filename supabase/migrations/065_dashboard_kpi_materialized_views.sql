-- 065_dashboard_kpi_materialized_views.sql
-- Fase 3: agregados no servidor (MV) + RPC única para janela de vendas + backfill.

-- ---------------------------------------------------------------------------
-- Materialized view: vendas por dia (fonte canónica server-side)
-- ---------------------------------------------------------------------------
drop materialized view if exists public.mv_dashboard_vendas_dia;

create materialized view public.mv_dashboard_vendas_dia as
with eligible as (
  select
    pv.id,
    public.p38_pedido_venda_sale_date(pv) as ref_date,
    public.p38_pedido_venda_total(pv) as sales_net,
    public.p38_pedido_venda_desconto(pv) as discounts
  from public.pedido_venda pv
  where public.p38_pedido_venda_elegivel_dashboard(pv)
),
costs as (
  select
    pvi.pedido_venda_id,
    sum(coalesce(pvi.quantidade_base, 0) * coalesce(pvi.custo_unitario_momento, 0)) as cost
  from public.pedido_venda_item pvi
  group by pvi.pedido_venda_id
)
select
  e.ref_date,
  public.p38_month_key(e.ref_date) as month_key,
  extract(day from e.ref_date)::int as day_num,
  round(sum(e.sales_net), 2) as sales_net,
  round(sum(e.discounts), 2) as discounts,
  round(sum(e.sales_net + e.discounts), 2) as sales_gross,
  round(sum(coalesce(c.cost, 0)), 2) as cost,
  round(sum(e.sales_net) - sum(coalesce(c.cost, 0)), 2) as profit,
  count(*)::int as pedido_count
from eligible e
left join costs c on c.pedido_venda_id = e.id
where e.ref_date is not null
group by e.ref_date;

create unique index if not exists idx_mv_dashboard_vendas_dia_ref_date
  on public.mv_dashboard_vendas_dia (ref_date);

create index if not exists idx_mv_dashboard_vendas_dia_month
  on public.mv_dashboard_vendas_dia (month_key);

-- ---------------------------------------------------------------------------
-- Materialized view: movimentos de estoque por dia (reconstrução)
-- ---------------------------------------------------------------------------
drop materialized view if exists public.mv_dashboard_movimentos_dia;

create materialized view public.mv_dashboard_movimentos_dia as
select
  coalesce(
    case when me.dados->>'data_movimento' ~ '^\d{4}-\d{2}-\d{2}' then left(me.dados->>'data_movimento', 10)::date end,
    (me.created_at at time zone 'America/Rio_Branco')::date
  ) as ref_date,
  public.p38_month_key(
    coalesce(
      case when me.dados->>'data_movimento' ~ '^\d{4}-\d{2}-\d{2}' then left(me.dados->>'data_movimento', 10)::date end,
      (me.created_at at time zone 'America/Rio_Branco')::date
    )
  ) as month_key,
  count(*)::int as movimentos_count
from public.movimentacao_estoque me
where lower(trim(coalesce(me.motivo, me.dados->>'motivo', ''))) in ('compra', 'venda', 'consumo interno')
group by 1;

create unique index if not exists idx_mv_dashboard_movimentos_dia_ref_date
  on public.mv_dashboard_movimentos_dia (ref_date);

-- ---------------------------------------------------------------------------
-- Refresh das MVs (concorrente quando possível)
-- ---------------------------------------------------------------------------
create or replace function public.refresh_dashboard_kpi_materialized_views()
returns jsonb language plpgsql security definer as $$
begin
  refresh materialized view concurrently public.mv_dashboard_vendas_dia;
  refresh materialized view concurrently public.mv_dashboard_movimentos_dia;
  return jsonb_build_object('success', true, 'refreshedAt', now());
exception when others then
  refresh materialized view public.mv_dashboard_vendas_dia;
  refresh materialized view public.mv_dashboard_movimentos_dia;
  return jsonb_build_object('success', true, 'refreshedAt', now(), 'concurrent', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- Sincroniza snapshots diários/mensais a partir das MVs
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_sync_vendas_snapshots_from_mv(
  p_through_date date default null
)
returns jsonb language plpgsql security definer as $$
declare
  v_through date := coalesce(p_through_date, public.p38_tabatinga_ontem());
  v_synced int := 0;
  r record;
begin
  for r in
    select *
    from public.mv_dashboard_vendas_dia
    where ref_date <= v_through
    order by ref_date
  loop
    insert into public.dashboard_kpi_diario (domain, ref_date, month_key, payload, computed_at)
    values (
      'vendas',
      r.ref_date,
      r.month_key,
      jsonb_build_object(
        'day', r.day_num,
        'salesNet', r.sales_net,
        'salesGross', r.sales_gross,
        'discounts', r.discounts,
        'cost', r.cost,
        'profit', r.profit,
        'pedidoCount', r.pedido_count
      ),
      now()
    )
    on conflict (domain, ref_date) do update
      set month_key = excluded.month_key,
          payload = excluded.payload,
          computed_at = now();
    v_synced := v_synced + 1;
  end loop;

  for r in
    select distinct month_key
    from public.mv_dashboard_vendas_dia
    where ref_date <= v_through
  loop
    perform public.dashboard_kpi_rebuild_vendas_mes(r.month_key);
  end loop;

  return jsonb_build_object('success', true, 'syncedDays', v_synced, 'through', v_through);
end;
$$;

create or replace function public.dashboard_sync_estoque_movimentos_from_mv(
  p_through_date date default null
)
returns jsonb language plpgsql security definer as $$
declare
  v_through date := coalesce(p_through_date, public.p38_tabatinga_ontem());
  v_synced int := 0;
  r record;
begin
  for r in
    select *
    from public.mv_dashboard_movimentos_dia
    where ref_date <= v_through
    order by ref_date
  loop
    insert into public.dashboard_kpi_diario (domain, ref_date, month_key, payload, computed_at)
    values (
      'estoque',
      r.ref_date,
      r.month_key,
      jsonb_build_object('day', extract(day from r.ref_date)::int, 'movimentosCount', r.movimentos_count),
      now()
    )
    on conflict (domain, ref_date) do update
      set month_key = excluded.month_key,
          payload = excluded.payload,
          computed_at = now();
    v_synced := v_synced + 1;
  end loop;

  return jsonb_build_object('success', true, 'syncedDays', v_synced, 'through', v_through);
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill janela de N meses (MV → snapshots)
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_kpi_backfill_vendas_window(
  p_anchor_month text default null,
  p_months int default 6
)
returns jsonb language plpgsql security definer as $$
declare
  v_anchor date;
  v_start date;
  v_month date;
  v_month_key text;
  v_hoje date := public.p38_tabatinga_hoje();
  v_refreshed jsonb;
  v_synced jsonb;
  v_months_rebuilt text[] := '{}';
begin
  v_anchor := coalesce(
    (p_anchor_month || '-01')::date,
    date_trunc('month', v_hoje)::date
  );
  v_start := (date_trunc('month', v_anchor) - ((greatest(p_months, 1) - 1) || ' months')::interval)::date;

  v_refreshed := public.refresh_dashboard_kpi_materialized_views();
  v_synced := public.dashboard_sync_vendas_snapshots_from_mv(v_hoje - 1);
  perform public.dashboard_sync_estoque_movimentos_from_mv(v_hoje - 1);

  v_month := date_trunc('month', v_start)::date;
  while v_month <= date_trunc('month', v_anchor)::date loop
    v_month_key := to_char(v_month, 'YYYY-MM');
    perform public.dashboard_kpi_rebuild_vendas_mes(v_month_key);
    v_months_rebuilt := array_append(v_months_rebuilt, v_month_key);
    v_month := (v_month + interval '1 month')::date;
  end loop;

  return jsonb_build_object(
    'success', true,
    'anchorMonth', to_char(v_anchor, 'YYYY-MM'),
    'months', v_months_rebuilt,
    'refresh', v_refreshed,
    'sync', v_synced
  );
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC única: janela de vendas pronta para o dashboard (Fase 3)
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_vendas_window_read(
  p_selected_month text,
  p_months int default 6
)
returns jsonb language plpgsql security definer stable as $$
declare
  v_anchor date := (p_selected_month || '-01')::date;
  v_start date := (date_trunc('month', v_anchor) - ((greatest(p_months, 1) - 1) || ' months')::interval)::date;
  v_hoje date := public.p38_tabatinga_hoje();
  v_ontem date := public.p38_tabatinga_ontem();
  v_current_month text := public.p38_month_key(v_hoje);
  v_month date;
  v_month_key text;
  v_sealed jsonb := '{}'::jsonb;
  v_row record;
  v_expected int := 0;
  v_found int := 0;
  v_complete boolean := true;
begin
  v_month := date_trunc('month', v_start)::date;
  while v_month <= date_trunc('month', v_anchor)::date loop
    v_month_key := to_char(v_month, 'YYYY-MM');
    v_expected := v_expected + 1;

    select m.closed_through, m.payload
      into v_row
    from public.dashboard_kpi_mensal m
    where m.domain = 'vendas' and m.month_key = v_month_key;

    if not found then
      v_complete := false;
    else
      if v_month_key < v_current_month then
        if v_row.closed_through < (date_trunc('month', v_month) + interval '1 month - 1 day')::date then
          v_complete := false;
        else
          v_found := v_found + 1;
        end if;
      elsif v_month_key = v_current_month then
        if v_row.closed_through < v_ontem then
          v_complete := false;
        else
          v_found := v_found + 1;
        end if;
      else
        v_complete := false;
      end if;

      if v_row.payload is not null then
        v_sealed := v_sealed || jsonb_build_object(v_month_key, v_row.payload);
      end if;
    end if;

    v_month := (v_month + interval '1 month')::date;
  end loop;

  return jsonb_build_object(
    'selectedMonth', p_selected_month,
    'months', p_months,
    'complete', v_complete and v_found = v_expected,
    'sealedMonths', v_sealed,
    'ontem', v_ontem,
    'hoje', v_hoje,
    'expectedMonths', v_expected,
    'foundMonths', v_found
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Job noturno: refresh MV + sync (substitui compute linha-a-linha quando MV existe)
-- ---------------------------------------------------------------------------
create or replace function public.job_fechar_dashboard_kpi_ontem()
returns jsonb language plpgsql security definer as $$
declare
  v_ontem date := public.p38_tabatinga_ontem();
  v_month text := public.p38_month_key(v_ontem);
  v_dirty record;
  v_refresh jsonb;
  v_sync jsonb;
begin
  v_refresh := public.refresh_dashboard_kpi_materialized_views();
  v_sync := public.dashboard_sync_vendas_snapshots_from_mv(v_ontem);
  perform public.dashboard_sync_estoque_movimentos_from_mv(v_ontem);

  for v_dirty in
    select domain, month_key from public.dashboard_kpi_dirty
  loop
    if v_dirty.domain = 'vendas' then
      perform public.dashboard_kpi_rebuild_vendas_mes_completo(v_dirty.month_key);
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'ontem', v_ontem,
    'monthKey', v_month,
    'refresh', v_refresh,
    'sync', v_sync,
    'dirtyRemaining', (select count(*) from public.dashboard_kpi_dirty)
  );
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

grant select on public.mv_dashboard_vendas_dia to authenticated, anon, service_role;
grant select on public.mv_dashboard_movimentos_dia to authenticated, anon, service_role;

grant execute on function public.refresh_dashboard_kpi_materialized_views() to service_role;
grant execute on function public.dashboard_sync_vendas_snapshots_from_mv(date) to service_role;
grant execute on function public.dashboard_sync_estoque_movimentos_from_mv(date) to service_role;
grant execute on function public.dashboard_kpi_backfill_vendas_window(text, int) to service_role;
grant execute on function public.dashboard_vendas_window_read(text, int) to authenticated, anon, service_role;
