-- 048: turno_caixa_id e movimentos_ids — colunas promovidas estavam só em dados jsonb.
-- Causa: _p38_insert_lancamento e processar_venda_caixa gravavam turno_caixa_id apenas em dados,
-- e o filtro do caixa PDV (Supabase) usa a coluna → receitas/recolhimentos “sumiam” do balanço.

-- ---------------------------------------------------------------------------
-- 1) Backfill colunas a partir de dados
-- ---------------------------------------------------------------------------
update public.pedido_venda
set turno_caixa_id = nullif(dados->>'turno_caixa_id', '')
where turno_caixa_id is null
  and nullif(dados->>'turno_caixa_id', '') is not null;

update public.lancamento_financeiro
set turno_caixa_id = nullif(dados->>'turno_caixa_id', '')
where turno_caixa_id is null
  and nullif(dados->>'turno_caixa_id', '') is not null;

-- movimentos_ids do turno: reconstruir a partir dos MovimentosCaixa reais
update public.turno_caixa t
set movimentos_ids = sub.ids
from (
  select
    m.turno_caixa_id,
    jsonb_agg(m.id::text order by m.created_at) as ids
  from public.movimentos_caixa m
  where m.turno_caixa_id is not null
  group by m.turno_caixa_id
) sub
where t.id = sub.turno_caixa_id;

-- ---------------------------------------------------------------------------
-- 2) Triggers: manter coluna sincronizada quando dados jsonb tiver o campo
-- ---------------------------------------------------------------------------
create or replace function public._p38_sync_turno_caixa_id_column()
returns trigger language plpgsql as $$
begin
  if new.turno_caixa_id is null
     and new.dados is not null
     and nullif(new.dados->>'turno_caixa_id', '') is not null then
    new.turno_caixa_id := nullif(new.dados->>'turno_caixa_id', '');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pedido_venda_turno_caixa_id on public.pedido_venda;
create trigger trg_pedido_venda_turno_caixa_id
  before insert or update on public.pedido_venda
  for each row execute function public._p38_sync_turno_caixa_id_column();

drop trigger if exists trg_lancamento_financeiro_turno_caixa_id on public.lancamento_financeiro;
create trigger trg_lancamento_financeiro_turno_caixa_id
  before insert or update on public.lancamento_financeiro
  for each row execute function public._p38_sync_turno_caixa_id_column();

-- ---------------------------------------------------------------------------
-- 3) _p38_insert_lancamento: gravar colunas promovidas (não só dados jsonb)
-- ---------------------------------------------------------------------------
create or replace function public._p38_insert_lancamento(p jsonb)
returns text language plpgsql security definer as $$
declare
  v_id text := coalesce(nullif(p->>'id', ''), gen_random_uuid()::text);
begin
  insert into public.lancamento_financeiro (
    id,
    tipo,
    descricao,
    terceiro_id,
    terceiro_nome,
    valor,
    valor_liquido,
    data_vencimento,
    data_pagamento,
    data_liquidacao_prevista,
    data_liquidacao_efetiva,
    status,
    status_conciliacao,
    categoria,
    categoria_id,
    centro_custo,
    centro_custo_id,
    conta_financeira_id,
    conta_financeira_nome,
    forma_pagamento,
    forma_pagamento_id,
    forma_pagamento_tipo,
    turno_caixa_id,
    grupo_lancamento_id,
    referencia_tipo,
    referencia_id,
    referencia_numero,
    observacoes,
    tags,
    dados,
    extras
  ) values (
    v_id,
    p->>'tipo',
    p->>'descricao',
    nullif(p->>'terceiro_id', ''),
    nullif(p->>'terceiro_nome', ''),
    coalesce(nullif(p->>'valor', '')::numeric, 0),
    nullif(p->>'valor_liquido', '')::numeric,
    nullif(p->>'data_vencimento', '')::date,
    nullif(p->>'data_pagamento', '')::date,
    nullif(p->>'data_liquidacao_prevista', '')::date,
    nullif(p->>'data_liquidacao_efetiva', '')::date,
    coalesce(p->>'status', 'Em Aberto'),
    p->>'status_conciliacao',
    p->>'categoria',
    nullif(p->>'categoria_id', ''),
    nullif(p->>'centro_custo', ''),
    nullif(p->>'centro_custo_id', ''),
    nullif(p->>'conta_financeira_id', ''),
    nullif(p->>'conta_financeira_nome', ''),
    p->>'forma_pagamento',
    nullif(p->>'forma_pagamento_id', ''),
    p->>'forma_pagamento_tipo',
    nullif(p->>'turno_caixa_id', ''),
    nullif(p->>'grupo_lancamento_id', ''),
    p->>'referencia_tipo',
    nullif(p->>'referencia_id', ''),
    p->>'referencia_numero',
    p->>'observacoes',
    case when p ? 'tags' then p->'tags' else null end,
    p,
    coalesce(p->'extras', '{}'::jsonb)
  );
  return v_id;
end;
$$;
