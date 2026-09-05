-- 082_fase6_home_vendas_gestao.sql
-- Fase 6: Home KPI via SQL (sem Base44), vendas_gestao com payload completo para UI.

-- ---------------------------------------------------------------------------
-- Home: leitura rápida (anotação selada ou SQL live)
-- ---------------------------------------------------------------------------
create or replace function public.home_kpi_read(p_date_key text default null)
returns jsonb language plpgsql security definer stable as $$
declare
  v_date date := coalesce(p_date_key::date, public.p38_tabatinga_hoje());
  v_hoje date := public.p38_tabatinga_hoje();
  v_payload jsonb;
  v_count int := 0;
  v_valor numeric := 0;
begin
  if v_date < v_hoje then
    select a.payload into v_payload
    from public.p38_anotacao a
    where a.domain = 'home' and a.ref_key = to_char(v_date, 'YYYY-MM-DD');

    if v_payload is not null then
      return v_payload || jsonb_build_object('source', 'anotacao');
    end if;
  end if;

  with eligible as (
    select public.p38_pedido_venda_total(pv) as total_val
    from public.pedido_venda pv
    where public.p38_pedido_venda_elegivel_dashboard(pv)
      and public.p38_pedido_venda_sale_date(pv) = v_date
  )
  select count(*)::int, coalesce(round(sum(total_val), 2), 0)
    into v_count, v_valor
  from eligible;

  return jsonb_build_object(
    'dateKey', to_char(v_date, 'YYYY-MM-DD'),
    'vendasHoje', v_count,
    'valorVendasHoje', v_valor,
    'source', case when v_date = v_hoje then 'live_sql' else 'live_sql_backfill' end
  );
end;
$$;

grant execute on function public.home_kpi_read(text) to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- Vendas gestão: payload alinhado com VendasGestao.jsx
-- ---------------------------------------------------------------------------
create or replace function public.p38_anotacao_compute_vendas_gestao_mes(p_month_key text)
returns jsonb language plpgsql security definer as $$
declare
  v_start date := (p_month_key || '-01')::date;
  v_end date := (date_trunc('month', v_start) + interval '1 month - 1 day')::date;
  v_hoje date := public.p38_tabatinga_hoje();
  v_headers jsonb := '[]'::jsonb;
  v_rascunhos jsonb := '[]'::jsonb;
  v_payload jsonb;
begin
  if v_end >= v_hoje then
    v_end := v_hoje - 1;
  end if;

  if v_end < v_start then
    return jsonb_build_object('skipped', true, 'reason', 'month_not_closed');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', pv.id,
      'numero', pv.numero,
      'cliente_id', pv.cliente_id,
      'cliente_nome', pv.cliente_nome,
      'status', coalesce(pv.status, pv.dados->>'status'),
      'tipo', coalesce(pv.tipo, pv.dados->>'tipo'),
      'total', coalesce(pv.total, (pv.dados->>'valor_total')::numeric, 0),
      'valor_total', coalesce(pv.total, (pv.dados->>'valor_total')::numeric, 0),
      'subtotal', pv.subtotal,
      'valor_desconto', pv.valor_desconto,
      'valor_frete', pv.valor_frete,
      'vendedor_id', pv.vendedor_id,
      'vendedor_nome', coalesce(pv.vendedor_nome, pv.dados->>'vendedor_nome'),
      'pagamentos', coalesce(pv.dados->'pagamentos', '[]'::jsonb),
      'created_date', pv.created_at,
      'data_venda', coalesce(pv.dados->>'data_venda', to_char(pv.created_at at time zone 'America/Rio_Branco', 'YYYY-MM-DD'))
    ) order by pv.created_at desc
  ), '[]'::jsonb)
  into v_headers
  from public.pedido_venda pv
  where (pv.created_at at time zone 'America/Rio_Branco')::date between v_start and v_end;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'numero', coalesce(r.dados->>'numero', r.id),
      'cliente_id', r.cliente_id,
      'cliente_nome', r.cliente_nome,
      'status', coalesce(r.status, r.dados->>'status'),
      'total', coalesce(r.valor_total, (r.dados->>'valor_total')::numeric, 0),
      'valor_total', coalesce(r.valor_total, (r.dados->>'valor_total')::numeric, 0),
      'vendedor_id', r.vendedor_id,
      'vendedor_nome', coalesce(r.vendedor_nome, r.dados->>'vendedor_nome'),
      'senha_atendimento', coalesce(r.senha_atendimento, r.dados->>'senha_atendimento'),
      'created_date', r.created_at
    ) order by r.created_at desc
  ), '[]'::jsonb)
  into v_rascunhos
  from public.rascunho_pedido_venda r
  where (r.created_at at time zone 'America/Rio_Branco')::date between v_start and v_end;

  v_payload := jsonb_build_object(
    'monthKey', p_month_key,
    'closedThrough', to_char(v_end, 'YYYY-MM-DD'),
    'headers', v_headers,
    'rascunhos', v_rascunhos,
    'headerCount', jsonb_array_length(v_headers),
    'rascunhoCount', jsonb_array_length(v_rascunhos)
  );

  perform public.p38_anotacao_upsert('vendas_gestao', p_month_key, v_payload, 1);

  delete from public.p38_anotacao_dirty
  where domain = 'vendas_gestao' and ref_key = p_month_key;

  return v_payload;
end;
$$;

-- Backfill vendas_gestao (meses fechados na janela)
create or replace function public.p38_anotacao_backfill_vendas_gestao(
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
  v_hoje date := public.p38_tabatinga_hoje();
  v_month_key text;
  v_count int := 0;
begin
  while v_month <= date_trunc('month', v_anchor)::date loop
    v_month_key := to_char(v_month, 'YYYY-MM');
    if (date_trunc('month', v_month) + interval '1 month - 1 day')::date < v_hoje then
      perform public.p38_anotacao_compute_vendas_gestao_mes(v_month_key);
      v_count := v_count + 1;
    end if;
    v_month := (v_month + interval '1 month')::date;
  end loop;

  return jsonb_build_object('success', true, 'monthsProcessed', v_count, 'anchorMonth', to_char(v_anchor, 'YYYY-MM'));
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

grant execute on function public.p38_anotacao_backfill_vendas_gestao(text, int) to service_role;
