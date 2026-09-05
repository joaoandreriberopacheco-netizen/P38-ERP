-- 079_p38_anotacao.sql
-- Fase 3: hub genérico de anotações (domain + ref_key + payload + version).
-- Domínios: home, catalogo, compras, vendas_gestao.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table if not exists public.p38_anotacao (
  domain text not null,
  ref_key text not null,
  payload jsonb not null default '{}'::jsonb,
  version int not null default 1,
  computed_at timestamptz not null default now(),
  primary key (domain, ref_key)
);

create index if not exists idx_p38_anotacao_domain_computed
  on public.p38_anotacao (domain, computed_at desc);

create table if not exists public.p38_anotacao_dirty (
  domain text not null,
  ref_key text not null,
  reason text,
  marked_at timestamptz not null default now(),
  primary key (domain, ref_key)
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.p38_anotacao_upsert(
  p_domain text,
  p_ref_key text,
  p_payload jsonb,
  p_version int default 1
)
returns void language plpgsql security definer as $$
begin
  insert into public.p38_anotacao (domain, ref_key, payload, version, computed_at)
  values (p_domain, p_ref_key, coalesce(p_payload, '{}'::jsonb), coalesce(p_version, 1), now())
  on conflict (domain, ref_key) do update
    set payload = excluded.payload,
        version = excluded.version,
        computed_at = now();
end;
$$;

create or replace function public.p38_anotacao_mark_dirty(
  p_domain text,
  p_ref_key text,
  p_reason text default null
)
returns void language plpgsql security definer as $$
begin
  insert into public.p38_anotacao_dirty (domain, ref_key, reason, marked_at)
  values (p_domain, p_ref_key, p_reason, now())
  on conflict (domain, ref_key) do update
    set reason = coalesce(excluded.reason, public.p38_anotacao_dirty.reason),
        marked_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Leitura (frontend)
-- ---------------------------------------------------------------------------
create or replace function public.p38_anotacao_read(
  p_domain text,
  p_ref_key text
)
returns jsonb language plpgsql security definer stable as $$
declare
  v_row record;
begin
  select domain, ref_key, payload, version, computed_at
    into v_row
  from public.p38_anotacao
  where domain = p_domain and ref_key = p_ref_key;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object(
    'found', true,
    'domain', v_row.domain,
    'refKey', v_row.ref_key,
    'payload', v_row.payload,
    'version', v_row.version,
    'computedAt', v_row.computed_at
  );
end;
$$;

create or replace function public.p38_anotacao_read_many(
  p_domain text,
  p_ref_keys text[] default null
)
returns jsonb language plpgsql security definer stable as $$
declare
  v_rows jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'refKey', a.ref_key,
      'payload', a.payload,
      'version', a.version,
      'computedAt', a.computed_at
    ) order by a.ref_key
  ), '[]'::jsonb)
  into v_rows
  from public.p38_anotacao a
  where a.domain = p_domain
    and (p_ref_keys is null or a.ref_key = any(p_ref_keys));

  return jsonb_build_object('items', v_rows);
end;
$$;

-- ---------------------------------------------------------------------------
-- Domínio: home (KPIs diários)
-- ---------------------------------------------------------------------------
create or replace function public.p38_anotacao_compute_home_dia(p_ref_date date)
returns jsonb language plpgsql security definer as $$
declare
  v_payload jsonb;
  v_count int := 0;
  v_valor numeric := 0;
begin
  with eligible as (
    select public.p38_pedido_venda_total(pv) as total_val
    from public.pedido_venda pv
    where public.p38_pedido_venda_elegivel_dashboard(pv)
      and public.p38_pedido_venda_sale_date(pv) = p_ref_date
  )
  select count(*)::int, coalesce(round(sum(total_val), 2), 0)
    into v_count, v_valor
  from eligible;

  v_payload := jsonb_build_object(
    'dateKey', to_char(p_ref_date, 'YYYY-MM-DD'),
    'vendasHoje', v_count,
    'valorVendasHoje', v_valor
  );

  perform public.p38_anotacao_upsert('home', to_char(p_ref_date, 'YYYY-MM-DD'), v_payload, 1);
  return v_payload;
end;
$$;

-- ---------------------------------------------------------------------------
-- Domínio: catalogo (versão leve para invalidar cache PDV)
-- ---------------------------------------------------------------------------
create or replace function public.p38_anotacao_compute_catalogo()
returns jsonb language plpgsql security definer as $$
declare
  v_ativos int := 0;
  v_total int := 0;
  v_max_updated timestamptz;
  v_version int;
  v_payload jsonb;
begin
  select
    count(*) filter (where coalesce(p.ativo, true)),
    count(*),
    max(coalesce(p.updated_at, p.created_at))
  into v_ativos, v_total, v_max_updated
  from public.produto p;

  v_version := coalesce(
    extract(epoch from v_max_updated)::int,
    extract(epoch from now())::int
  );

  v_payload := jsonb_build_object(
    'ativosCount', v_ativos,
    'totalCount', v_total,
    'maxUpdatedAt', v_max_updated,
    'catalogVersion', v_version
  );

  perform public.p38_anotacao_upsert('catalogo', 'current', v_payload, v_version);

  delete from public.p38_anotacao_dirty
  where domain = 'catalogo' and ref_key = 'current';

  return v_payload;
end;
$$;

-- ---------------------------------------------------------------------------
-- Domínio: compras (resumo gestão — metadados para cache)
-- ---------------------------------------------------------------------------
create or replace function public.p38_anotacao_compute_compras_resumo()
returns jsonb language plpgsql security definer as $$
declare
  v_hoje date := public.p38_tabatinga_hoje();
  v_limite date := v_hoje - 30;
  v_pedidos_recentes int := 0;
  v_pedidos_abertos int := 0;
  v_embarques_recentes int := 0;
  v_payload jsonb;
begin
  select count(*)::int into v_pedidos_recentes
  from public.pedido_compra pc
  where (pc.created_at at time zone 'America/Rio_Branco')::date >= v_limite;

  select count(*)::int into v_pedidos_abertos
  from public.pedido_compra pc
  where lower(trim(coalesce(pc.status, ''))) <> 'concluído'
     and lower(trim(coalesce(pc.status, ''))) <> 'concluido';

  select count(*)::int into v_embarques_recentes
  from public.embarque e
  where (e.created_at at time zone 'America/Rio_Branco')::date >= v_limite;

  v_payload := jsonb_build_object(
    'asOf', to_char(v_hoje, 'YYYY-MM-DD'),
    'pedidosRecentes30d', v_pedidos_recentes,
    'pedidosAbertos', v_pedidos_abertos,
    'embarquesRecentes30d', v_embarques_recentes,
    'comprasVersion', v_pedidos_recentes + v_pedidos_abertos + v_embarques_recentes
  );

  perform public.p38_anotacao_upsert('compras', 'gestao-resumo', v_payload, (v_payload->>'comprasVersion')::int);

  delete from public.p38_anotacao_dirty
  where domain = 'compras' and ref_key = 'gestao-resumo';

  return v_payload;
end;
$$;

-- ---------------------------------------------------------------------------
-- Domínio: vendas_gestao (cabeçalhos por mês civilmente fechado)
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
      'total', coalesce(pv.total, (pv.dados->>'valor_total')::numeric, 0),
      'tipo', coalesce(pv.tipo, pv.dados->>'tipo'),
      'created_date', pv.created_at,
      'data_venda', pv.dados->>'data_venda'
    ) order by pv.created_at desc
  ), '[]'::jsonb)
  into v_headers
  from public.pedido_venda pv
  where (pv.created_at at time zone 'America/Rio_Branco')::date between v_start and v_end;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'numero', r.numero,
      'cliente_id', r.cliente_id,
      'cliente_nome', r.cliente_nome,
      'status', coalesce(r.status, r.dados->>'status'),
      'total', coalesce(r.valor_total, (r.dados->>'valor_total')::numeric, 0),
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

-- ---------------------------------------------------------------------------
-- Job noturno: fecha ontem + processa dirty
-- ---------------------------------------------------------------------------
create or replace function public.job_fechar_p38_anotacao_ontem()
returns jsonb language plpgsql security definer as $$
declare
  v_ontem date := public.p38_tabatinga_ontem();
  v_month text := public.p38_month_key(v_ontem);
  v_dirty record;
  v_result jsonb := '{}'::jsonb;
begin
  perform public.p38_anotacao_compute_home_dia(v_ontem);
  perform public.p38_anotacao_compute_catalogo();
  perform public.p38_anotacao_compute_compras_resumo();
  perform public.p38_anotacao_compute_vendas_gestao_mes(v_month);

  for v_dirty in
    select domain, ref_key from public.p38_anotacao_dirty
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

  delete from public.p38_anotacao_dirty;

  v_result := jsonb_build_object(
    'success', true,
    'ontem', v_ontem,
    'monthKey', v_month,
    'home', (select payload from public.p38_anotacao where domain='home' and ref_key=to_char(v_ontem, 'YYYY-MM-DD')),
    'catalogo', (select payload from public.p38_anotacao where domain='catalogo' and ref_key='current'),
    'compras', (select payload from public.p38_anotacao where domain='compras' and ref_key='gestao-resumo')
  );
  return v_result;
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

-- Integrar no job existente do dashboard (mesmo cron 05:05 UTC)
create or replace function public.job_fechar_dashboard_kpi_ontem()
returns jsonb language plpgsql security definer as $$
declare
  v_ontem date := public.p38_tabatinga_ontem();
  v_month text := public.p38_month_key(v_ontem);
  v_dirty record;
  v_result jsonb := '{}'::jsonb;
  v_anotacao jsonb;
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

  v_anotacao := public.job_fechar_p38_anotacao_ontem();

  v_result := jsonb_build_object(
    'success', true,
    'ontem', v_ontem,
    'monthKey', v_month,
    'vendasDia', (select payload from public.dashboard_kpi_diario where domain='vendas' and ref_date=v_ontem),
    'dirtyProcessed', (select count(*) from public.dashboard_kpi_dirty),
    'anotacao', v_anotacao
  );
  return v_result;
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers dirty
-- ---------------------------------------------------------------------------
create or replace function public.trg_produto_anotacao_dirty_fn()
returns trigger language plpgsql security definer as $$
begin
  perform public.p38_anotacao_mark_dirty('catalogo', 'current', 'produto_change');
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_produto_anotacao_dirty on public.produto;
create trigger trg_produto_anotacao_dirty
  after insert or update or delete on public.produto
  for each row execute function public.trg_produto_anotacao_dirty_fn();

create or replace function public.trg_pedido_compra_anotacao_dirty_fn()
returns trigger language plpgsql security definer as $$
begin
  perform public.p38_anotacao_mark_dirty('compras', 'gestao-resumo', 'pedido_compra_change');
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_pedido_compra_anotacao_dirty on public.pedido_compra;
create trigger trg_pedido_compra_anotacao_dirty
  after insert or update or delete on public.pedido_compra
  for each row execute function public.trg_pedido_compra_anotacao_dirty_fn();

create or replace function public.trg_embarque_anotacao_dirty_fn()
returns trigger language plpgsql security definer as $$
begin
  perform public.p38_anotacao_mark_dirty('compras', 'gestao-resumo', 'embarque_change');
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_embarque_anotacao_dirty on public.embarque;
create trigger trg_embarque_anotacao_dirty
  after insert or update or delete on public.embarque
  for each row execute function public.trg_embarque_anotacao_dirty_fn();

create or replace function public.trg_pedido_venda_gestao_anotacao_dirty_fn()
returns trigger language plpgsql security definer as $$
declare
  v_month text;
  v_date date;
begin
  if TG_OP = 'DELETE' then
    v_date := (OLD.created_at at time zone 'America/Rio_Branco')::date;
  else
    v_date := (NEW.created_at at time zone 'America/Rio_Branco')::date;
  end if;
  v_month := public.p38_month_key(v_date);
  perform public.p38_anotacao_mark_dirty('vendas_gestao', v_month, 'pedido_venda_change');
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_pedido_venda_gestao_anotacao_dirty on public.pedido_venda;
create trigger trg_pedido_venda_gestao_anotacao_dirty
  after insert or update or delete on public.pedido_venda
  for each row execute function public.trg_pedido_venda_gestao_anotacao_dirty_fn();

create or replace function public.trg_rascunho_gestao_anotacao_dirty_fn()
returns trigger language plpgsql security definer as $$
declare
  v_month text;
  v_date date;
begin
  if TG_OP = 'DELETE' then
    v_date := (OLD.created_at at time zone 'America/Rio_Branco')::date;
  else
    v_date := (NEW.created_at at time zone 'America/Rio_Branco')::date;
  end if;
  v_month := public.p38_month_key(v_date);
  perform public.p38_anotacao_mark_dirty('vendas_gestao', v_month, 'rascunho_change');
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_rascunho_gestao_anotacao_dirty on public.rascunho_pedido_venda;
create trigger trg_rascunho_gestao_anotacao_dirty
  after insert or update or delete on public.rascunho_pedido_venda
  for each row execute function public.trg_rascunho_gestao_anotacao_dirty_fn();

-- Home dirty: reutiliza alterações em pedido_venda (data de venda)
create or replace function public.trg_pedido_venda_home_anotacao_dirty_fn()
returns trigger language plpgsql security definer as $$
declare
  v_date date;
begin
  if TG_OP = 'DELETE' then
    v_date := public.p38_pedido_venda_sale_date(OLD);
  else
    v_date := public.p38_pedido_venda_sale_date(NEW);
  end if;
  if v_date is not null then
    perform public.p38_anotacao_mark_dirty('home', to_char(v_date, 'YYYY-MM-DD'), 'pedido_venda_change');
  end if;
  if TG_OP = 'UPDATE' then
    v_date := public.p38_pedido_venda_sale_date(OLD);
    if v_date is not null then
      perform public.p38_anotacao_mark_dirty('home', to_char(v_date, 'YYYY-MM-DD'), 'pedido_date_move');
    end if;
  end if;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_pedido_venda_home_anotacao_dirty on public.pedido_venda;
create trigger trg_pedido_venda_home_anotacao_dirty
  after insert or update or delete on public.pedido_venda
  for each row execute function public.trg_pedido_venda_home_anotacao_dirty_fn();

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------
revoke all on public.p38_anotacao from public;
revoke all on public.p38_anotacao_dirty from public;

grant select on public.p38_anotacao to authenticated, anon, service_role;
grant select on public.p38_anotacao_dirty to authenticated, anon, service_role;

grant execute on function public.p38_anotacao_read(text, text) to authenticated, anon, service_role;
grant execute on function public.p38_anotacao_read_many(text, text[]) to authenticated, anon, service_role;
grant execute on function public.job_fechar_p38_anotacao_ontem() to service_role;
grant execute on function public.p38_anotacao_compute_vendas_gestao_mes(text) to service_role;
