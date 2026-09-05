-- 080_dashboard_celulas.sql
-- Células pré-calculadas para gráficos do Dashboard (job noturno + backfill).
-- Analogia Excel: o gráfico lê valores já gravados; só recalcula células "dirty".

-- ---------------------------------------------------------------------------
-- Vendas: sincroniza célula mensal a partir de dashboard_kpi_mensal
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
    perform public.dashboard_kpi_rebuild_vendas_mes(p_month_key);
    select m.payload, m.closed_through
      into v_payload, v_closed
    from public.dashboard_kpi_mensal m
    where m.domain = 'vendas' and m.month_key = p_month_key;
  end if;

  if v_payload is null then
    return jsonb_build_object('skipped', true, 'monthKey', p_month_key);
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
-- Estoque: razão de abastecimento (CMV pago vs vendido) por mês
-- ---------------------------------------------------------------------------
create or replace function public.p38_celula_compute_estoque_supply_mes(p_month_key text)
returns jsonb language plpgsql security definer as $$
declare
  v_start date := (p_month_key || '-01')::date;
  v_end date := (date_trunc('month', v_start) + interval '1 month - 1 day')::date;
  v_cmv_efetivo numeric := 0;
  v_cmv_vendido numeric := 0;
  v_ratio numeric := 0;
  v_payload jsonb;
begin
  select coalesce(sum(coalesce(lf.valor, 0)), 0)
    into v_cmv_efetivo
  from public.lancamento_financeiro lf
  where lower(trim(coalesce(lf.tipo, ''))) = 'despesa'
    and coalesce(lf.is_custo_mercadoria, false) = true
    and lower(trim(coalesce(lf.status, ''))) <> 'cancelado'
    and lf.data_pagamento between v_start and v_end;

  select coalesce(sum(
    coalesce(pvi.quantidade_base, 0)
    * coalesce(pvi.custo_unitario_momento, p.preco_custo_calculado, 0)
  ), 0)
  into v_cmv_vendido
  from public.pedido_venda_item pvi
  join public.pedido_venda pv on pv.id = pvi.pedido_venda_id
  left join public.produto p on p.id = pvi.produto_id
  where public.p38_pedido_venda_elegivel_dashboard(pv)
    and public.p38_pedido_venda_sale_date(pv) between v_start and v_end
    and lower(trim(coalesce(pv.status, pv.dados->>'status', ''))) not in (
      'cancelado', 'aguardando caixa', 'orçamento', 'orcamento'
    );

  v_ratio := case when v_cmv_vendido > 0 then round((v_cmv_efetivo / v_cmv_vendido) * 100, 2) else 0 end;

  v_payload := jsonb_build_object(
    'cellType', 'estoque_supply',
    'monthKey', p_month_key,
    'cmvEfetivo', round(v_cmv_efetivo, 2),
    'cmvVendido', round(v_cmv_vendido, 2),
    'ratioPercent', v_ratio
  );

  perform public.p38_anotacao_upsert('dashboard_celulas', 'estoque:supply:' || p_month_key, v_payload, 1);

  delete from public.p38_anotacao_dirty
  where domain = 'dashboard_celulas' and ref_key = 'estoque:supply:' || p_month_key;

  return v_payload;
end;
$$;

-- ---------------------------------------------------------------------------
-- Estoque: nível físico no fim do mês (reconstrução por movimentos após o mês)
-- ---------------------------------------------------------------------------
create or replace function public.p38_celula_compute_estoque_nivel_mes(p_month_key text)
returns jsonb language plpgsql security definer as $$
declare
  v_month_end date := (date_trunc('month', (p_month_key || '-01')::date) + interval '1 month - 1 day')::date;
  v_hoje date := public.p38_tabatinga_hoje();
  v_valor numeric := 0;
  v_payload jsonb;
begin
  if v_month_end >= v_hoje then
    v_month_end := v_hoje - 1;
  end if;

  if v_month_end < (p_month_key || '-01')::date then
    return jsonb_build_object('skipped', true, 'monthKey', p_month_key);
  end if;

  with sku as (
    select
      p.id,
      greatest(0, coalesce(p.estoque_atual, 0)) as qtd,
      coalesce(p.preco_custo_calculado, 0) as custo
    from public.produto p
    where coalesce(p.ativo, true)
  ),
  mov as (
    select
      me.produto_id,
      coalesce(
        case when me.dados->>'data_movimento' ~ '^\d{4}-\d{2}-\d{2}' then left(me.dados->>'data_movimento', 10)::date end,
        (me.created_at at time zone 'America/Rio_Branco')::date
      ) as ref_date,
      lower(trim(coalesce(me.motivo, me.dados->>'motivo', ''))) as motivo_norm,
      coalesce(me.quantidade_base, me.quantidade, 0) as qtd_mov
    from public.movimentacao_estoque me
  ),
  deltas as (
    select
      m.produto_id,
      sum(
        case
          when m.motivo_norm = 'compra' then abs(m.qtd_mov)
          when m.motivo_norm in ('venda', 'consumo interno') then -abs(m.qtd_mov)
          else 0
        end
      ) as delta_after
    from mov m
    where m.ref_date > v_month_end
      and m.motivo_norm in ('compra', 'venda', 'consumo interno')
    group by m.produto_id
  )
  select coalesce(sum(greatest(0, s.qtd - coalesce(d.delta_after, 0)) * s.custo), 0)
    into v_valor
  from sku s
  left join deltas d on d.produto_id = s.id;

  v_payload := jsonb_build_object(
    'cellType', 'estoque_nivel',
    'monthKey', p_month_key,
    'valorFisico', round(v_valor, 2),
    'valor', round(v_valor, 2),
    'closedThrough', to_char(v_month_end, 'YYYY-MM-DD')
  );

  perform public.p38_anotacao_upsert('dashboard_celulas', 'estoque:nivel:' || p_month_key, v_payload, 1);

  delete from public.p38_anotacao_dirty
  where domain = 'dashboard_celulas' and ref_key = 'estoque:nivel:' || p_month_key;

  return v_payload;
end;
$$;

-- ---------------------------------------------------------------------------
-- Estoque: resumo (qualidade + localização física)
-- ---------------------------------------------------------------------------
create or replace function public.p38_celula_compute_estoque_resumo()
returns jsonb language plpgsql security definer as $$
declare
  v_payload jsonb;
  v_fisico numeric := 0;
  v_quality jsonb := '{}'::jsonb;
begin
  select coalesce(sum(
    greatest(0, coalesce(p.estoque_atual, 0)) * coalesce(p.preco_custo_calculado, 0)
  ), 0)
  into v_fisico
  from public.produto p
  where coalesce(p.ativo, true);

  select coalesce(jsonb_object_agg(curva, valor), '{}'::jsonb)
  into v_quality
  from (
    select
      upper(coalesce(nullif(trim(p.abcd), ''), 'E')) as curva,
      round(sum(greatest(0, coalesce(p.estoque_atual, 0)) * coalesce(p.preco_custo_calculado, 0)), 2) as valor
    from public.produto p
    where coalesce(p.ativo, true)
    group by 1
  ) q;

  v_payload := jsonb_build_object(
    'cellType', 'estoque_resumo',
    'estoqueFisico', round(v_fisico, 2),
    'transitoFinanceiroAprovado', 0,
    'totalLocalizacao', round(v_fisico, 2),
    'qualityByAbcd', v_quality,
    'asOf', to_char(public.p38_tabatinga_hoje(), 'YYYY-MM-DD')
  );

  perform public.p38_anotacao_upsert('dashboard_celulas', 'estoque:resumo', v_payload, 1);

  delete from public.p38_anotacao_dirty
  where domain = 'dashboard_celulas' and ref_key = 'estoque:resumo';

  return v_payload;
end;
$$;

-- ---------------------------------------------------------------------------
-- Job: recalcula células da janela de 6 meses + dirty
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
  perform public.dashboard_kpi_compute_vendas_dia(v_ontem);
  perform public.dashboard_kpi_rebuild_vendas_mes(public.p38_month_key(v_ontem));

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
    'ontem', v_ontem
  );
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

-- Backfill manual (primeira corrida)
create or replace function public.p38_dashboard_celulas_backfill(
  p_anchor_month text default null,
  p_months int default 6
)
returns jsonb language plpgsql security definer as $$
begin
  return public.p38_dashboard_celulas_fechar_janela(p_anchor_month, p_months);
end;
$$;

-- ---------------------------------------------------------------------------
-- Leitura para o frontend (células da janela)
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_celulas_window_read(
  p_tab text,
  p_selected_month text,
  p_months int default 6
)
returns jsonb language plpgsql security definer stable as $$
declare
  v_anchor date := (p_selected_month || '-01')::date;
  v_start date := (date_trunc('month', v_anchor) - ((greatest(p_months, 1) - 1) || ' months')::interval)::date;
  v_month date := date_trunc('month', v_start)::date;
  v_month_key text;
  v_hoje date := public.p38_tabatinga_hoje();
  v_ontem date := public.p38_tabatinga_ontem();
  v_current_month text := public.p38_month_key(v_hoje);
  v_expected int := 0;
  v_found int := 0;
  v_complete boolean := true;
  v_cells jsonb := '{}'::jsonb;
  v_payload jsonb;
  v_ref text;
  v_resumo jsonb;
begin
  if p_tab = 'vendas' then
    while v_month <= date_trunc('month', v_anchor)::date loop
      v_month_key := to_char(v_month, 'YYYY-MM');
      v_expected := v_expected + 1;
      v_ref := 'vendas:' || v_month_key;
      select a.payload into v_payload
      from public.p38_anotacao a
      where a.domain = 'dashboard_celulas' and a.ref_key = v_ref;

      if v_payload is null then
        v_complete := false;
      else
        v_found := v_found + 1;
        v_cells := v_cells || jsonb_build_object(v_month_key, v_payload);
      end if;
      v_month := (v_month + interval '1 month')::date;
    end loop;

    return jsonb_build_object(
      'tab', p_tab,
      'selectedMonth', p_selected_month,
      'months', p_months,
      'complete', v_complete and v_found = v_expected,
      'sealedMonths', v_cells,
      'expectedMonths', v_expected,
      'foundMonths', v_found,
      'ontem', v_ontem,
      'hoje', v_hoje
    );
  end if;

  if p_tab = 'estoque' then
    select a.payload into v_resumo
    from public.p38_anotacao a
    where a.domain = 'dashboard_celulas' and a.ref_key = 'estoque:resumo';

    return jsonb_build_object(
      'tab', p_tab,
      'selectedMonth', p_selected_month,
      'months', p_months,
      'resumo', coalesce(v_resumo, '{}'::jsonb),
      'nivelMonths', (
        select coalesce(jsonb_object_agg(
          split_part(a.ref_key, ':', 3),
          a.payload
        ), '{}'::jsonb)
        from public.p38_anotacao a
        where a.domain = 'dashboard_celulas'
          and a.ref_key like 'estoque:nivel:%'
      ),
      'supplyMonths', (
        select coalesce(jsonb_object_agg(
          split_part(a.ref_key, ':', 3),
          a.payload
        ), '{}'::jsonb)
        from public.p38_anotacao a
        where a.domain = 'dashboard_celulas'
          and a.ref_key like 'estoque:supply:%'
      ),
      'complete', v_resumo is not null,
      'ontem', v_ontem,
      'hoje', v_hoje
    );
  end if;

  return jsonb_build_object('found', false, 'error', 'tab_invalid');
end;
$$;

-- Integrar no job noturno existente
create or replace function public.job_fechar_p38_anotacao_ontem()
returns jsonb language plpgsql security definer as $$
declare
  v_ontem date := public.p38_tabatinga_ontem();
  v_month text := public.p38_month_key(v_ontem);
  v_dirty record;
  v_result jsonb := '{}'::jsonb;
  v_celulas jsonb;
begin
  perform public.p38_anotacao_compute_home_dia(v_ontem);
  perform public.p38_anotacao_compute_catalogo();
  perform public.p38_anotacao_compute_compras_resumo();
  perform public.p38_anotacao_compute_vendas_gestao_mes(v_month);

  v_celulas := public.p38_dashboard_celulas_fechar_janela(v_month, 6);

  for v_dirty in
    select domain, ref_key from public.p38_anotacao_dirty
    where domain <> 'dashboard_celulas'
  loop
    if v_dirty.domain = 'home' then
      perform public.p38_anotacao_compute_home_dia(v_dirty.ref_key::date);
    elsif v_dirty.domain = 'catalogo' then
      perform public.p38_anotacao_compute_catalogo();
    elsif v_dirty.domain = 'compras' then
      perform public.p38_anotacao_compute_compras_resumo();
    elsif v_dirty.domain = 'vendas_gestao' then
      perform public.p38_anotacao_compute_vendas_gestao_mes(v_dirty.ref_key);
    end if;
  end loop;

  delete from public.p38_anotacao_dirty where domain <> 'dashboard_celulas';

  v_result := jsonb_build_object(
    'success', true,
    'ontem', v_ontem,
    'monthKey', v_month,
    'dashboardCelulas', v_celulas
  );
  return v_result;
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

-- Dirty: alterações retroativas marcam células do dashboard
create or replace function public.trg_pedido_venda_celulas_dirty_fn()
returns trigger language plpgsql security definer as $$
declare
  v_month text;
  v_date date;
begin
  if TG_OP = 'DELETE' then
    v_date := public.p38_pedido_venda_sale_date(OLD);
  else
    v_date := public.p38_pedido_venda_sale_date(NEW);
  end if;
  if v_date is not null then
    v_month := public.p38_month_key(v_date);
    perform public.p38_anotacao_mark_dirty('dashboard_celulas', 'vendas:' || v_month, 'pedido_venda');
    perform public.p38_anotacao_mark_dirty('dashboard_celulas', 'estoque:supply:' || v_month, 'pedido_venda');
  end if;
  if TG_OP = 'UPDATE' then
    v_date := public.p38_pedido_venda_sale_date(OLD);
    if v_date is not null then
      v_month := public.p38_month_key(v_date);
      perform public.p38_anotacao_mark_dirty('dashboard_celulas', 'vendas:' || v_month, 'pedido_move');
      perform public.p38_anotacao_mark_dirty('dashboard_celulas', 'estoque:supply:' || v_month, 'pedido_move');
    end if;
  end if;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_pedido_venda_celulas_dirty on public.pedido_venda;
create trigger trg_pedido_venda_celulas_dirty
  after insert or update or delete on public.pedido_venda
  for each row execute function public.trg_pedido_venda_celulas_dirty_fn();

create or replace function public.trg_movimentacao_celulas_dirty_fn()
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
  if v_date is not null then
    v_month := public.p38_month_key(v_date);
    perform public.p38_anotacao_mark_dirty('dashboard_celulas', 'estoque:nivel:' || v_month, 'movimento');
    perform public.p38_anotacao_mark_dirty('dashboard_celulas', 'estoque:resumo', 'movimento');
  end if;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_movimentacao_celulas_dirty on public.movimentacao_estoque;
create trigger trg_movimentacao_celulas_dirty
  after insert or update or delete on public.movimentacao_estoque
  for each row execute function public.trg_movimentacao_celulas_dirty_fn();

create or replace function public.trg_produto_celulas_dirty_fn()
returns trigger language plpgsql security definer as $$
begin
  perform public.p38_anotacao_mark_dirty('dashboard_celulas', 'estoque:resumo', 'produto');
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_produto_celulas_dirty on public.produto;
create trigger trg_produto_celulas_dirty
  after insert or update or delete on public.produto
  for each row execute function public.trg_produto_celulas_dirty_fn();

-- Permissões
grant execute on function public.dashboard_celulas_window_read(text, text, int) to authenticated, anon, service_role;
grant execute on function public.p38_dashboard_celulas_backfill(text, int) to service_role;
grant execute on function public.p38_dashboard_celulas_fechar_janela(text, int) to service_role;
