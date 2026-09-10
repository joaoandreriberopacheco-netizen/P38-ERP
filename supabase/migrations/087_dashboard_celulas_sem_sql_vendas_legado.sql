-- 087_dashboard_celulas_sem_sql_vendas_legado.sql
-- Impede que p38_dashboard_celulas_fechar_janela (cron 05:05) sobrescreva KPI vendas
-- com dashboard_kpi_compute_vendas_dia (custo_unitario_momento).
-- Fonte canónica: npm run dashboard:kpi-margem-fechar (relatorio_margem_v1).

comment on function public.dashboard_kpi_compute_vendas_dia(date) is
  'LEGADO — custo_unitario_momento. Não sobrescreve relatorio_margem_v1. Use scripts/dashboard-kpi-margem-fechar.mjs.';

comment on function public.dashboard_kpi_rebuild_vendas_mes(text) is
  'LEGADO — agrega diários SQL. Não sobrescreve relatorio_margem_v1 / frozen. Use job Node.';

comment on function public.dashboard_kpi_rebuild_vendas_mes_completo(text) is
  'LEGADO desativado — não recalcula via SQL. Dirty vendas: npm run dashboard:kpi-margem-fechar.';

-- ---------------------------------------------------------------------------
-- Guard: não sobrescrever snapshot margem v1
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_kpi_payload_is_margem_v1(p_payload jsonb)
returns boolean language sql immutable as $$
  select coalesce(p_payload->>'sourceVersion', p_payload->'monthlyTotals'->>'sourceVersion') = 'relatorio_margem_v1'
      or coalesce((p_payload->>'frozen')::boolean, false);
$$;

create or replace function public.dashboard_kpi_compute_vendas_dia(p_ref_date date)
returns jsonb language plpgsql security definer as $$
declare
  v_month text := public.p38_month_key(p_ref_date);
  v_existing jsonb;
  v_monthly jsonb;
begin
  select d.payload into v_existing
  from public.dashboard_kpi_diario d
  where d.domain = 'vendas' and d.ref_date = p_ref_date;

  if public.dashboard_kpi_payload_is_margem_v1(v_existing) then
    return v_existing;
  end if;

  select m.payload into v_monthly
  from public.dashboard_kpi_mensal m
  where m.domain = 'vendas' and m.month_key = v_month;

  if public.dashboard_kpi_payload_is_margem_v1(v_monthly) then
    return coalesce(v_existing, jsonb_build_object('skipped', true, 'refDate', p_ref_date, 'reason', 'margem_v1_monthly'));
  end if;

  return jsonb_build_object(
    'skipped', true,
    'refDate', p_ref_date,
    'reason', 'relatorio_margem_v1_node_job'
  );
end;
$$;

create or replace function public.dashboard_kpi_rebuild_vendas_mes(p_month_key text)
returns jsonb language plpgsql security definer as $$
declare
  v_existing jsonb;
begin
  select m.payload into v_existing
  from public.dashboard_kpi_mensal m
  where m.domain = 'vendas' and m.month_key = p_month_key;

  if public.dashboard_kpi_payload_is_margem_v1(v_existing) then
    delete from public.dashboard_kpi_dirty
    where domain = 'vendas' and month_key = p_month_key;
    return v_existing;
  end if;

  return jsonb_build_object(
    'skipped', true,
    'monthKey', p_month_key,
    'reason', 'relatorio_margem_v1_node_job'
  );
end;
$$;

create or replace function public.dashboard_kpi_rebuild_vendas_mes_completo(p_month_key text)
returns jsonb language plpgsql security definer as $$
begin
  return public.dashboard_kpi_rebuild_vendas_mes(p_month_key);
end;
$$;

-- ---------------------------------------------------------------------------
-- Células vendas: só copia KPI existente (sem rebuild SQL)
-- ---------------------------------------------------------------------------
create or replace function public.p38_celula_compute_vendas_mes(p_month_key text)
returns jsonb language plpgsql security definer as $$
declare
  v_payload jsonb;
  v_closed date;
begin
  select m.payload, m.closed_through
    into v_payload, v_closed
  from public.dashboard_kpi_mensal m
  where m.domain = 'vendas' and m.month_key = p_month_key;

  if v_payload is null then
    return jsonb_build_object('skipped', true, 'monthKey', p_month_key, 'reason', 'awaiting_node_kpi_job');
  end if;

  perform public.p38_anotacao_upsert(
    'dashboard_celulas',
    'vendas:' || p_month_key,
    v_payload || jsonb_build_object('cellType', 'vendas', 'monthKey', p_month_key, 'closedThrough', v_closed),
    1
  );

  delete from public.p38_anotacao_dirty
  where domain = 'dashboard_celulas' and ref_key = 'vendas:' || p_month_key;

  return v_payload;
end;
$$;

-- ---------------------------------------------------------------------------
-- Job células: remove compute SQL vendas no início
-- ---------------------------------------------------------------------------
create or replace function public.p38_dashboard_celulas_fechar_janela(
  p_anchor_month text default null,
  p_months int default 6
)
returns jsonb language plpgsql security definer as $$
declare
  v_anchor date := coalesce(
    (p_anchor_month || '-01')::date,
    date_trunc('month', public.p38_tabatinga_hoje())::date
  );
  v_start date := (date_trunc('month', v_anchor) - ((greatest(p_months, 1) - 1) || ' months')::interval)::date;
  v_month date := date_trunc('month', v_start)::date;
  v_month_key text;
  v_hoje date := public.p38_tabatinga_hoje();
  v_ontem date := public.p38_tabatinga_ontem();
  v_dirty record;
  v_vendas int := 0;
  v_estoque int := 0;
begin
  -- Vendas KPI: npm run dashboard:kpi-margem-fechar (não SQL legado aqui).

  while v_month <= date_trunc('month', v_anchor)::date loop
    v_month_key := to_char(v_month, 'YYYY-MM');
    perform public.p38_celula_compute_vendas_mes(v_month_key);
    perform public.p38_celula_compute_estoque_supply_mes(v_month_key);
    if v_month < date_trunc('month', v_hoje)::date or v_ontem >= (v_month_key || '-01')::date then
      perform public.p38_celula_compute_estoque_nivel_mes(v_month_key);
    end if;
    v_vendas := v_vendas + 1;
    v_estoque := v_estoque + 1;
    v_month := (v_month + interval '1 month')::date;
  end loop;

  perform public.p38_celula_compute_estoque_resumo();

  for v_dirty in select ref_key from public.p38_anotacao_dirty where domain = 'dashboard_celulas' loop
    if v_dirty.ref_key like 'vendas:%' then
      perform public.p38_celula_compute_vendas_mes(split_part(v_dirty.ref_key, ':', 2));
    elsif v_dirty.ref_key like 'estoque:supply:%' then
      perform public.p38_celula_compute_estoque_supply_mes(split_part(v_dirty.ref_key, ':', 3));
    elsif v_dirty.ref_key like 'estoque:nivel:%' then
      perform public.p38_celula_compute_estoque_nivel_mes(split_part(v_dirty.ref_key, ':', 3));
    elsif v_dirty.ref_key = 'estoque:resumo' then
      perform public.p38_celula_compute_estoque_resumo();
    end if;
  end loop;

  delete from public.p38_anotacao_dirty where domain = 'dashboard_celulas';

  return jsonb_build_object(
    'success', true,
    'anchorMonth', to_char(v_anchor, 'YYYY-MM'),
    'monthsProcessed', v_vendas,
    'ontem', v_ontem,
    'vendasKpiSource', 'relatorio_margem_v1_node_job'
  );
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

grant execute on function public.dashboard_kpi_payload_is_margem_v1(jsonb) to service_role;
