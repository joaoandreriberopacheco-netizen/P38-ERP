-- =============================================================================
-- 104 — Card vermelho: pedido primeiro, desmembramentos depois
-- =============================================================================
-- Regra (João André):
--   Card «Saldo a embarcar» só quando o pedido JÁ teve desmembramento/embarque real
--   (logística começou). Pedido inteiro ainda sem 1.º despacho = ritmo normal.
--   Depois, por linha: saldo pendente > 0 (ex. R64-JEC caixinha fora do embarque 01).
-- =============================================================================

create or replace function public.p38_pedido_desmembramento_iniciado(p_pedido_id text)
returns boolean
language sql
stable
as $$
  select
    exists (
      select 1
      from public.pedido_compra_desmembramento d
      where d.pedido_compra_id = p_pedido_id
    )
    or exists (
      select 1
      from public.pedido_compra_saldo_a_embarcar_v v
      where v.pedido_compra_id = p_pedido_id
        and coalesce(v.quantidade_embarcada_real_base, 0) > 0.009
    );
$$;

comment on function public.p38_pedido_desmembramento_iniciado(text) is
  'True quando o pedido já teve algum despacho real (embarque ou tabela desmembramento).';

grant execute on function public.p38_pedido_desmembramento_iniciado(text)
  to authenticated, anon, service_role;

drop view if exists public.pedido_compra_status_logistica_v;
drop view if exists public.pedido_compra_card_logistica_v;

create view public.pedido_compra_card_logistica_v as
with saldo_por_item as (
  select
    pedido_compra_id,
    pedido_item_id,
    max(pedido_compra_numero) as pedido_compra_numero,
    max(fornecedor_nome) as fornecedor_nome,
    max(fornecedor_id) as fornecedor_id,
    max(produto_id) as produto_id,
    max(produto_nome) as produto_nome,
    max(unidade_vitrine_sigla) as unidade_vitrine_sigla,
    max(fator_vitrine) as fator_vitrine,
    max(comprada_base) filter (where linha_tipo = 'pedido') as comprada_base,
    sum(despachada_base) filter (where linha_tipo = 'desmembramento') as despachada_base,
    sum(recebida_base) filter (where linha_tipo = 'desmembramento') as recebida_base,
    sum(em_transito_base) filter (where linha_tipo = 'desmembramento') as em_transito_base,
    public._p38_round_qty(
      greatest(
        coalesce(max(comprada_base) filter (where linha_tipo = 'pedido'), 0)
        - coalesce(sum(recebida_base) filter (where linha_tipo = 'desmembramento'), 0)
        - coalesce(sum(em_transito_base) filter (where linha_tipo = 'desmembramento'), 0),
        0
      )
    ) as saldo_pendente_base
  from public.pedido_compra_folha_v
  where pedido_item_id is not null
  group by pedido_compra_id, pedido_item_id
),
cards_desmembramento as (
  select
    'desmembramento'::text as card_tipo,
    d.id as card_id,
    d.pedido_compra_id,
    coalesce(d.pedido_compra_numero, pc.numero, pc.dados->>'numero') as pedido_compra_numero,
    pc.fornecedor_nome,
    pc.fornecedor_id,
    d.codigo as titulo,
    d.status,
    d.embarque_id,
    d.sequencia,
    count(di.id) as linhas,
    round(coalesce(sum(di.em_transito_base), 0)::numeric, 6) as soma_em_transito_base,
    round(coalesce(sum(di.saldo_pendente_base), 0)::numeric, 6) as soma_saldo_pendente_base,
    case
      when coalesce(sum(di.em_transito_base), 0) > 0.009 then 'Despachado'
      when coalesce(sum(di.saldo_pendente_base), 0) > 0.009 then 'Pendente'
      else 'Recebido'
    end as card_status,
    'citrus'::text as card_paleta,
    d.created_at,
    d.updated_at
  from public.pedido_compra_desmembramento d
  join public.pedido_compra pc on pc.id = d.pedido_compra_id
  left join public.pedido_compra_desmembramento_item di on di.desmembramento_id = d.id
  group by
    d.id, d.pedido_compra_id, d.pedido_compra_numero, pc.numero, pc.dados,
    pc.fornecedor_nome, pc.fornecedor_id, d.codigo, d.status, d.embarque_id,
    d.sequencia, d.created_at, d.updated_at
  having coalesce(sum(di.em_transito_base), 0) > 0.009
),
cards_saldo as (
  select
    'saldo'::text as card_tipo,
    ('saldo-' || s.pedido_compra_id || '-' || s.pedido_item_id) as card_id,
    s.pedido_compra_id,
    s.pedido_compra_numero,
    s.fornecedor_nome,
    s.fornecedor_id,
    coalesce(s.pedido_compra_numero, s.pedido_compra_id) || ' · saldo' as titulo,
    'Saldo a embarcar'::text as status,
    null::text as embarque_id,
    null::integer as sequencia,
    1 as linhas,
    s.em_transito_base as soma_em_transito_base,
    s.saldo_pendente_base as soma_saldo_pendente_base,
    'Saldo a embarcar'::text as card_status,
    'vermelho'::text as card_paleta,
    null::timestamptz as created_at,
    null::timestamptz as updated_at
  from saldo_por_item s
  join public.pedido_compra pc on pc.id = s.pedido_compra_id
  where s.saldo_pendente_base > 0.009
    and pc.status is distinct from 'Concluído'
    and public.p38_pedido_desmembramento_iniciado(s.pedido_compra_id)
),
legacy_saldo as (
  select
    'saldo'::text as card_tipo,
    ('legacy-saldo-' || v.pedido_compra_id || '-' || v.pedido_item_id) as card_id,
    v.pedido_compra_id,
    v.pedido_compra_numero,
    v.fornecedor_nome,
    v.fornecedor_id,
    coalesce(v.pedido_compra_numero, v.pedido_compra_id) || ' · saldo' as titulo,
    'Saldo a embarcar'::text as status,
    null::text as embarque_id,
    null::integer as sequencia,
    1 as linhas,
    v.quantidade_em_transito_base as soma_em_transito_base,
    v.falta_operacional_base as soma_saldo_pendente_base,
    'Saldo a embarcar'::text as card_status,
    'vermelho'::text as card_paleta,
    v.pedido_created_at as created_at,
    v.pedido_updated_at as updated_at
  from public.pedido_compra_saldo_a_embarcar_v v
  where v.falta_operacional_base > 0.009
    and v.pedido_status is distinct from 'Concluído'
    and not exists (
      select 1 from public.pedido_compra_desmembramento d where d.pedido_compra_id = v.pedido_compra_id
    )
    and public.p38_pedido_desmembramento_iniciado(v.pedido_compra_id)
)
select * from cards_desmembramento
union all
select * from cards_saldo
union all
select * from legacy_saldo;

comment on view public.pedido_compra_card_logistica_v is
  'Cards logística. Vermelho = saldo pendente só após desmembramento iniciado no pedido.';

create view public.pedido_compra_status_logistica_v as
with agg as (
  select
    pedido_compra_id,
    max(pedido_compra_numero) as pedido_compra_numero,
    max(fornecedor_nome) as fornecedor_nome,
    count(*) filter (where linha_tipo = 'pedido') as linhas_pedido,
    count(*) filter (where linha_tipo = 'desmembramento') as linhas_desmembramento,
    round(coalesce(sum(saldo_pendente_base) filter (where linha_tipo = 'pedido'), 0)::numeric, 6) as saldo_pedido_base,
    round(coalesce(sum(em_transito_base) filter (where linha_tipo = 'desmembramento'), 0)::numeric, 6) as transito_base,
    round(coalesce(sum(saldo_pendente_base) filter (where linha_tipo = 'desmembramento'), 0)::numeric, 6) as saldo_desmembramento_base,
    round(coalesce(sum(recebida_base) filter (where linha_tipo = 'desmembramento'), 0)::numeric, 6) as recebida_base
  from public.pedido_compra_folha_v
  group by pedido_compra_id
),
legacy as (
  select
    pedido_compra_id,
    round(coalesce(sum(falta_operacional), 0)::numeric, 6) as falta_legacy,
    round(coalesce(sum(quantidade_em_transito), 0)::numeric, 6) as transito_legacy,
    round(
      coalesce(sum(falta_operacional_base) filter (
        where public.p38_pedido_desmembramento_iniciado(pedido_compra_id)
      ), 0)::numeric,
      6
    ) as falta_legacy_card_base
  from public.pedido_compra_saldo_a_embarcar_v
  group by pedido_compra_id
)
select
  pc.id as pedido_compra_id,
  coalesce(pc.numero, pc.dados->>'numero') as pedido_compra_numero,
  pc.fornecedor_nome,
  pc.fornecedor_id,
  pc.status as pedido_status,
  pc.status_embarque,
  pc.status_aprovacao_financeira,
  coalesce(a.linhas_desmembramento, 0) as linhas_desmembramento,
  public.p38_pedido_desmembramento_iniciado(pc.id) as desmembramento_iniciado,
  case
    when coalesce(a.linhas_desmembramento, 0) > 0 then
      case
        when coalesce(a.transito_base, 0) > 0.009 and coalesce(a.saldo_desmembramento_base, 0) <= 0.009
          then 'Em trânsito'
        when coalesce(a.saldo_desmembramento_base, 0) > 0.009
          then 'Saldo a embarcar'
        when coalesce(a.recebida_base, 0) > 0.009
          then 'Parcialmente recebido'
        else coalesce(nullif(trim(pc.status_embarque), ''), 'Pendente')
      end
    else
      case
        when coalesce(l.falta_legacy_card_base, 0) > 0.009 then 'Saldo a embarcar'
        when coalesce(l.transito_legacy, 0) > 0.009 then 'Em trânsito'
        else coalesce(nullif(trim(pc.status_embarque), ''), 'Pendente')
      end
  end as status_embarque_calc,
  case
    when coalesce(a.recebida_base, 0) > 0.009
      and coalesce(a.saldo_pedido_base, a.saldo_desmembramento_base, l.falta_legacy_card_base, 0) <= 0.009
      then 'Recebido'
    when coalesce(a.recebida_base, 0) > 0.009 then 'Parcial'
    else coalesce(nullif(trim(pc.status_recebimento_geral), ''), 'Pendente')
  end as status_recebimento_geral,
  case
    when coalesce(a.linhas_desmembramento, 0) > 0 then
      case
        when coalesce(a.saldo_desmembramento_base, 0) > 0.009 then 'FALTA_EMBARCAR'
        when coalesce(a.transito_base, 0) > 0.009 then 'EM_TRANSITO'
        else 'OK'
      end
    else
      case
        when coalesce(l.falta_legacy_card_base, 0) > 0.009 then 'FALTA_EMBARCAR'
        when coalesce(l.transito_legacy, 0) > 0.009 then 'EM_TRANSITO'
        else 'OK'
      end
  end as diagnostico,
  public.p38_pedido_usa_folha_desmembramento(pc.id) as usa_folha_v2,
  pc.created_at,
  pc.updated_at
from public.pedido_compra pc
left join agg a on a.pedido_compra_id = pc.id
left join legacy l on l.pedido_compra_id = pc.id;

grant select on public.pedido_compra_card_logistica_v to authenticated, anon, service_role;
grant select on public.pedido_compra_status_logistica_v to authenticated, anon, service_role;
