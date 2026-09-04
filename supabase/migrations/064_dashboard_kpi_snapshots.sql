-- 064_dashboard_kpi_snapshots.sql
-- Snapshots diários/mensais do dashboard + job 00:05 Tabatinga (05:05 UTC).
-- Fase 2: até ontem gravado no Postgres; hoje só delta no frontend.

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table if not exists public.dashboard_kpi_diario (
  domain text not null,
  ref_date date not null,
  month_key text not null,
  payload jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  primary key (domain, ref_date)
);

create index if not exists idx_dashboard_kpi_diario_month
  on public.dashboard_kpi_diario (domain, month_key);

create table if not exists public.dashboard_kpi_mensal (
  domain text not null,
  month_key text not null,
  closed_through date not null,
  payload jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  primary key (domain, month_key)
);

create table if not exists public.dashboard_kpi_dirty (
  domain text not null,
  month_key text not null,
  reason text,
  marked_at timestamptz not null default now(),
  primary key (domain, month_key)
);

-- ---------------------------------------------------------------------------
-- Helpers Tabatinga / pedido venda
-- ---------------------------------------------------------------------------
create or replace function public.p38_tabatinga_hoje()
returns date language sql stable as $$
  select (now() at time zone 'America/Rio_Branco')::date;
$$;

create or replace function public.p38_tabatinga_ontem()
returns date language sql stable as $$
  select public.p38_tabatinga_hoje() - 1;
$$;

create or replace function public.p38_month_key(p_date date)
returns text language sql immutable as $$
  select to_char(p_date, 'YYYY-MM');
$$;

create or replace function public.p38_pedido_venda_status(pv public.pedido_venda)
returns text language sql stable as $$
  select lower(trim(coalesce(pv.status, pv.dados->>'status', '')));
$$;

create or replace function public.p38_pedido_venda_tipo(pv public.pedido_venda)
returns text language sql stable as $$
  select lower(trim(coalesce(pv.tipo, pv.dados->>'tipo', '')));
$$;

create or replace function public.p38_pedido_venda_total(pv public.pedido_venda)
returns numeric language sql stable as $$
  select round(coalesce(
    nullif(pv.total, 0),
    nullif((pv.dados->>'valor_total')::numeric, 0),
    pv.total,
    (pv.dados->>'valor_total')::numeric,
    0
  )::numeric, 2);
$$;

create or replace function public.p38_pedido_venda_desconto(pv public.pedido_venda)
returns numeric language sql stable as $$
  select round(coalesce(
    pv.valor_desconto,
    (pv.dados->>'valor_desconto')::numeric,
    0
  )::numeric, 2);
$$;

create or replace function public.p38_pedido_venda_sale_date(pv public.pedido_venda)
returns date language sql stable as $$
  select coalesce(
    case when pv.dados->>'data_venda' ~ '^\d{4}-\d{2}-\d{2}' then left(pv.dados->>'data_venda', 10)::date end,
    case when pv.dados->>'data_emissao' ~ '^\d{4}-\d{2}-\d{2}' then left(pv.dados->>'data_emissao', 10)::date end,
    case when pv.dados->>'data_fechamento' ~ '^\d{4}-\d{2}-\d{2}' then left(pv.dados->>'data_fechamento', 10)::date end,
    (pv.created_at at time zone 'America/Rio_Branco')::date
  );
$$;

create or replace function public.p38_pedido_venda_elegivel_dashboard(pv public.pedido_venda)
returns boolean language sql stable as $$
  select public.p38_pedido_venda_status(pv) <> 'cancelado'
     and public.p38_pedido_venda_tipo(pv) not in ('orçamento', 'orcamento')
     and public.p38_pedido_venda_sale_date(pv) is not null;
$$;

-- ---------------------------------------------------------------------------
-- Snapshot diário de vendas
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_kpi_compute_vendas_dia(p_ref_date date)
returns jsonb language plpgsql security definer as $$
declare
  v_month text := public.p38_month_key(p_ref_date);
  v_day int := extract(day from p_ref_date)::int;
  v_sales_net numeric := 0;
  v_discounts numeric := 0;
  v_sales_gross numeric := 0;
  v_cost numeric := 0;
  v_profit numeric := 0;
  v_count int := 0;
  v_payload jsonb;
begin
  with eligible as (
    select pv.id,
           public.p38_pedido_venda_total(pv) as total_val,
           public.p38_pedido_venda_desconto(pv) as desconto
    from public.pedido_venda pv
    where public.p38_pedido_venda_elegivel_dashboard(pv)
      and public.p38_pedido_venda_sale_date(pv) = p_ref_date
  ),
  costs as (
    select pvi.pedido_venda_id,
           sum(coalesce(pvi.quantidade_base, 0) * coalesce(pvi.custo_unitario_momento, 0)) as cost
    from public.pedido_venda_item pvi
    join eligible e on e.id = pvi.pedido_venda_id
    group by pvi.pedido_venda_id
  ),
  agg as (
    select coalesce(sum(e.total_val), 0) as sales_net,
           coalesce(sum(e.desconto), 0) as discounts,
           coalesce(sum(coalesce(c.cost, 0)), 0) as cost,
           count(*)::int as pedido_count
    from eligible e
    left join costs c on c.pedido_venda_id = e.id
  )
  select sales_net, discounts, cost, pedido_count
    into v_sales_net, v_discounts, v_cost, v_count
  from agg;

  v_sales_gross := v_sales_net + v_discounts;
  v_profit := v_sales_net - v_cost;

  v_payload := jsonb_build_object(
    'day', v_day,
    'salesNet', v_sales_net,
    'salesGross', v_sales_gross,
    'discounts', v_discounts,
    'cost', v_cost,
    'profit', v_profit,
    'pedidoCount', v_count
  );

  insert into public.dashboard_kpi_diario (domain, ref_date, month_key, payload, computed_at)
  values ('vendas', p_ref_date, v_month, v_payload, now())
  on conflict (domain, ref_date) do update
    set month_key = excluded.month_key,
        payload = excluded.payload,
        computed_at = now();

  return v_payload;
end;
$$;

-- ---------------------------------------------------------------------------
-- Snapshot mensal de vendas (soma dos diários)
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_kpi_rebuild_vendas_mes(p_month_key text)
returns jsonb language plpgsql security definer as $$
declare
  v_sales_by_day jsonb := '{}'::jsonb;
  v_profit_by_day jsonb := '{}'::jsonb;
  v_closed date;
  v_payload jsonb;
  v_gross numeric := 0;
  v_discounts numeric := 0;
  v_net numeric := 0;
  v_cost numeric := 0;
  v_profit numeric := 0;
  r record;
begin
  for r in
    select d.ref_date,
           (d.payload->>'day')::int as day_num,
           coalesce((d.payload->>'salesNet')::numeric, 0) as sales_net,
           coalesce((d.payload->>'profit')::numeric, 0) as profit
    from public.dashboard_kpi_diario d
    where d.domain = 'vendas'
      and d.month_key = p_month_key
    order by d.ref_date
  loop
    v_sales_by_day := v_sales_by_day || jsonb_build_object(r.day_num::text, r.sales_net);
    v_profit_by_day := v_profit_by_day || jsonb_build_object(r.day_num::text, r.profit);
  end loop;

  select coalesce(sum((payload->>'salesGross')::numeric), 0),
         coalesce(sum((payload->>'discounts')::numeric), 0),
         coalesce(sum((payload->>'salesNet')::numeric), 0),
         coalesce(sum((payload->>'cost')::numeric), 0),
         coalesce(sum((payload->>'profit')::numeric), 0),
         max(ref_date)
    into v_gross, v_discounts, v_net, v_cost, v_profit, v_closed
  from public.dashboard_kpi_diario
  where domain = 'vendas'
    and month_key = p_month_key;

  v_payload := jsonb_build_object(
    'monthKey', p_month_key,
    'closedThrough', v_closed,
    'salesByDay', v_sales_by_day,
    'profitByDay', v_profit_by_day,
    'monthlyTotals', jsonb_build_object(
      'salesGross', v_gross,
      'discounts', v_discounts,
      'salesNet', v_net,
      'cost', v_cost,
      'profit', v_profit
    )
  );

  insert into public.dashboard_kpi_mensal (domain, month_key, closed_through, payload, computed_at)
  values (
    'vendas',
    p_month_key,
    coalesce(v_closed, (p_month_key || '-01')::date),
    v_payload,
    now()
  )
  on conflict (domain, month_key) do update
    set closed_through = excluded.closed_through,
        payload = excluded.payload,
        computed_at = now();

  delete from public.dashboard_kpi_dirty
  where domain = 'vendas' and month_key = p_month_key;

  return v_payload;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rebuild de todos os dias de um mês (alteração retroativa)
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_kpi_rebuild_vendas_mes_completo(p_month_key text)
returns jsonb language plpgsql security definer as $$
declare
  v_start date := (p_month_key || '-01')::date;
  v_end date := (date_trunc('month', v_start) + interval '1 month - 1 day')::date;
  v_hoje date := public.p38_tabatinga_hoje();
  v_d date;
begin
  delete from public.dashboard_kpi_diario
  where domain = 'vendas' and month_key = p_month_key;

  v_d := v_start;
  while v_d <= v_end and v_d < v_hoje loop
    perform public.dashboard_kpi_compute_vendas_dia(v_d);
    v_d := v_d + 1;
  end loop;

  return public.dashboard_kpi_rebuild_vendas_mes(p_month_key);
end;
$$;

-- ---------------------------------------------------------------------------
-- Snapshot diário de estoque (contagem de movimentos reconhecíveis)
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_kpi_compute_estoque_dia(p_ref_date date)
returns jsonb language plpgsql security definer as $$
declare
  v_month text := public.p38_month_key(p_ref_date);
  v_count int := 0;
  v_payload jsonb;
begin
  select count(*)::int into v_count
  from public.movimentacao_estoque me
  where lower(trim(coalesce(me.motivo, me.dados->>'motivo', ''))) in ('compra', 'venda', 'consumo interno')
    and coalesce(
      case when me.dados->>'data_movimento' ~ '^\d{4}-\d{2}-\d{2}' then left(me.dados->>'data_movimento', 10)::date end,
      (me.created_at at time zone 'America/Rio_Branco')::date
    ) = p_ref_date;

  v_payload := jsonb_build_object(
    'day', extract(day from p_ref_date)::int,
    'movimentosCount', v_count
  );

  insert into public.dashboard_kpi_diario (domain, ref_date, month_key, payload, computed_at)
  values ('estoque', p_ref_date, v_month, v_payload, now())
  on conflict (domain, ref_date) do update
    set month_key = excluded.month_key,
        payload = excluded.payload,
        computed_at = now();

  return v_payload;
end;
$$;

-- ---------------------------------------------------------------------------
-- Job noturno: fecha ontem + meses sujos
-- ---------------------------------------------------------------------------
create or replace function public.job_fechar_dashboard_kpi_ontem()
returns jsonb language plpgsql security definer as $$
declare
  v_ontem date := public.p38_tabatinga_ontem();
  v_month text := public.p38_month_key(v_ontem);
  v_dirty record;
  v_result jsonb := '{}'::jsonb;
begin
  perform public.dashboard_kpi_compute_vendas_dia(v_ontem);
  perform public.dashboard_kpi_rebuild_vendas_mes(v_month);
  perform public.dashboard_kpi_compute_estoque_dia(v_ontem);

  for v_dirty in
    select domain, month_key from public.dashboard_kpi_dirty
  loop
    if v_dirty.domain = 'vendas' then
      perform public.dashboard_kpi_rebuild_vendas_mes_completo(v_dirty.month_key);
    end if;
  end loop;

  v_result := jsonb_build_object(
    'success', true,
    'ontem', v_ontem,
    'monthKey', v_month,
    'vendasDia', (select payload from public.dashboard_kpi_diario where domain='vendas' and ref_date=v_ontem),
    'dirtyProcessed', (select count(*) from public.dashboard_kpi_dirty)
  );
  return v_result;
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

-- ---------------------------------------------------------------------------
-- Leitura para o frontend
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_kpi_vendas_read(p_month_keys text[] default null)
returns jsonb language plpgsql security definer stable as $$
declare
  v_rows jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'monthKey', m.month_key,
      'closedThrough', m.closed_through,
      'payload', m.payload,
      'computedAt', m.computed_at
    ) order by m.month_key
  ), '[]'::jsonb)
  into v_rows
  from public.dashboard_kpi_mensal m
  where m.domain = 'vendas'
    and (p_month_keys is null or m.month_key = any(p_month_keys));

  return jsonb_build_object('months', v_rows);
end;
$$;

create or replace function public.dashboard_kpi_vendas_read_current_through_ontem(p_month_key text)
returns jsonb language plpgsql security definer stable as $$
declare
  v_ontem date := public.p38_tabatinga_ontem();
  v_row record;
begin
  select closed_through, payload, computed_at
    into v_row
  from public.dashboard_kpi_mensal
  where domain = 'vendas' and month_key = p_month_key;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  if v_row.closed_through < v_ontem and p_month_key = public.p38_month_key(v_ontem) then
    return jsonb_build_object('found', false, 'stale', true, 'closedThrough', v_row.closed_through);
  end if;

  return jsonb_build_object(
    'found', true,
    'monthKey', p_month_key,
    'closedThrough', v_row.closed_through,
    'payload', v_row.payload,
    'computedAt', v_row.computed_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Invalidação retroativa
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_kpi_mark_dirty(
  p_domain text,
  p_month_key text,
  p_reason text default null
)
returns void language plpgsql security definer as $$
begin
  insert into public.dashboard_kpi_dirty (domain, month_key, reason, marked_at)
  values (p_domain, p_month_key, p_reason, now())
  on conflict (domain, month_key) do update
    set reason = coalesce(excluded.reason, public.dashboard_kpi_dirty.reason),
        marked_at = now();
end;
$$;

create or replace function public.trg_pedido_venda_dashboard_dirty_fn()
returns trigger language plpgsql security definer as $$
declare
  v_old_month text;
  v_new_month text;
begin
  if TG_OP = 'DELETE' then
    v_old_month := public.p38_month_key(public.p38_pedido_venda_sale_date(OLD));
    perform public.dashboard_kpi_mark_dirty('vendas', v_old_month, 'pedido_delete');
    return OLD;
  end if;

  v_new_month := public.p38_month_key(public.p38_pedido_venda_sale_date(NEW));
  perform public.dashboard_kpi_mark_dirty('vendas', v_new_month, 'pedido_change');

  if TG_OP = 'UPDATE' then
    v_old_month := public.p38_month_key(public.p38_pedido_venda_sale_date(OLD));
    if v_old_month is distinct from v_new_month then
      perform public.dashboard_kpi_mark_dirty('vendas', v_old_month, 'pedido_date_move');
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_pedido_venda_dashboard_dirty on public.pedido_venda;
create trigger trg_pedido_venda_dashboard_dirty
  after insert or update or delete on public.pedido_venda
  for each row execute function public.trg_pedido_venda_dashboard_dirty_fn();

create or replace function public.trg_movimentacao_estoque_dashboard_dirty_fn()
returns trigger language plpgsql security definer as $$
declare
  v_month text;
  v_date date;
begin
  if TG_OP = 'DELETE' then
    v_date := coalesce(
      case when OLD.dados->>'data_movimento' ~ '^\d{4}-\d{2}-\d{2}' then left(OLD.dados->>'data_movimento', 10)::date end,
      (OLD.created_at at time zone 'America/Rio_Branco')::date
    );
  else
    v_date := coalesce(
      case when NEW.dados->>'data_movimento' ~ '^\d{4}-\d{2}-\d{2}' then left(NEW.dados->>'data_movimento', 10)::date end,
      (NEW.created_at at time zone 'America/Rio_Branco')::date
    );
  end if;

  v_month := public.p38_month_key(v_date);
  perform public.dashboard_kpi_mark_dirty('estoque', v_month, 'movimento_change');
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_movimentacao_estoque_dashboard_dirty on public.movimentacao_estoque;
create trigger trg_movimentacao_estoque_dashboard_dirty
  after insert or update or delete on public.movimentacao_estoque
  for each row execute function public.trg_movimentacao_estoque_dashboard_dirty_fn();

-- ---------------------------------------------------------------------------
-- Permissões (single-tenant; RLS desactivado noutras tabelas core)
-- ---------------------------------------------------------------------------
revoke all on public.dashboard_kpi_diario from public;
revoke all on public.dashboard_kpi_mensal from public;
revoke all on public.dashboard_kpi_dirty from public;

grant select on public.dashboard_kpi_diario to authenticated, anon, service_role;
grant select on public.dashboard_kpi_mensal to authenticated, anon, service_role;
grant select on public.dashboard_kpi_dirty to authenticated, anon, service_role;

grant execute on function public.dashboard_kpi_vendas_read(text[]) to authenticated, anon, service_role;
grant execute on function public.dashboard_kpi_vendas_read_current_through_ontem(text) to authenticated, anon, service_role;
grant execute on function public.job_fechar_dashboard_kpi_ontem() to service_role;
grant execute on function public.dashboard_kpi_rebuild_vendas_mes_completo(text) to service_role;

-- ---------------------------------------------------------------------------
-- Cron 05:05 UTC = 00:05 Tabatinga
-- ---------------------------------------------------------------------------
do $do$
begin
  if not exists (select 1 from cron.job where jobname = 'job-fechar-dashboard-kpi') then
    perform cron.schedule(
      'job-fechar-dashboard-kpi',
      '5 5 * * *',
      $cmd$select public.job_fechar_dashboard_kpi_ontem();$cmd$
    );
  end if;
end$do$;
