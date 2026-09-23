-- =============================================================================
-- 106 — Saldo a embarcar: fator da LINHA de embarque (CX→M²), não só do pedido
-- =============================================================================
-- Bug (ex.: SQF-7ZH Tintão): pedido em M² (fator_aplicado=1), despacho em CX com
-- fator em embarque_item.dados (2.02, 2.5…). View 103 usava fator do pedido →
-- 30 CX contados como 30 M² em vez de 60,6 M².
-- Fix: ler quantidade_*_base de dados ou comercial × fator da linha de embarque.
-- =============================================================================

create or replace function public.p38_embarque_item_fator(
  p_ei_dados jsonb,
  p_pci_fator numeric default 1
)
returns numeric
language sql
immutable
as $$
  select coalesce(
    nullif((p_ei_dados->>'fator_aplicado')::numeric, 0),
    nullif((p_ei_dados->>'fator_apresentacao')::numeric, 0),
    nullif(p_pci_fator, 0),
    1::numeric
  );
$$;

comment on function public.p38_embarque_item_fator(jsonb, numeric) is
  'Fator CX→base da linha de embarque (dados JSONB), fallback pedido_compra_item.';

create or replace function public.p38_embarque_item_qty_base(
  p_comercial numeric,
  p_ei_dados jsonb,
  p_campo_base text,
  p_pci_fator numeric default 1
)
returns numeric
language sql
immutable
as $$
  select public._p38_round_qty(
    coalesce(
      nullif((p_ei_dados->>p_campo_base)::numeric, 0),
      public.compra_para_base(
        coalesce(p_comercial, 0),
        public.p38_embarque_item_fator(p_ei_dados, p_pci_fator)
      )
    )
  );
$$;

comment on function public.p38_embarque_item_qty_base(numeric, jsonb, text, numeric) is
  'Quantidade em base: prioriza dados.quantidade_*_base; senão comercial × fator linha.';

grant execute on function public.p38_embarque_item_fator(jsonb, numeric)
  to authenticated, anon, service_role;
grant execute on function public.p38_embarque_item_qty_base(numeric, jsonb, text, numeric)
  to authenticated, anon, service_role;

drop view if exists public.pedido_compra_status_logistica_v;
drop view if exists public.pedido_compra_card_logistica_v;
drop view if exists public.pedido_compra_saldo_resumo_v;
drop view if exists public.pedido_compra_saldo_a_embarcar_v;

create view public.pedido_compra_saldo_a_embarcar_v as
with embarque_codigo as (
  select
    e.id as embarque_id,
    e.pedido_compra_id,
    e.tipo,
    e.status,
    e.status_recebimento,
    coalesce(
      nullif(trim(e.dados->>'codigo_exibicao'), ''),
      nullif(trim(pc.numero || '-' || e.numero), ''),
      e.numero
    ) as codigo_exibicao
  from public.embarque e
  join public.pedido_compra pc on pc.id = e.pedido_compra_id
),
linhas_embarque as (
  select
    ec.pedido_compra_id,
    ec.embarque_id,
    ec.codigo_exibicao,
    ec.tipo as embarque_tipo,
    ec.status as embarque_status,
    ec.status_recebimento,
    ei.produto_id,
    ei.pedido_compra_item_id,
    public.p38_embarque_item_qty_base(
      ei.quantidade_embarcada_comercial,
      ei.dados,
      'quantidade_embarcada_base',
      pci.fator_aplicado
    ) as qtd_embarcada_base,
    public.p38_embarque_item_qty_base(
      ei.quantidade_recebida_comercial,
      ei.dados,
      'quantidade_recebida_base',
      pci.fator_aplicado
    ) as qtd_recebida_base,
    coalesce(
      nullif(trim(ei.unidade_sigla), ''),
      ei.dados->>'unidade_medida',
      'UN'
    ) as unidade_sigla,
    (ec.tipo is distinct from 'Necessidade') as embarque_real
  from embarque_codigo ec
  join public.embarque_item ei on ei.embarque_id = ec.embarque_id
  left join public.pedido_compra_item pci on pci.id = ei.pedido_compra_item_id
),
fator_por_produto as (
  select distinct on (pci.pedido_compra_id, pci.produto_id)
    pci.pedido_compra_id,
    pci.produto_id,
    case
      when coalesce(ef.fator_embarque_max, 0) > coalesce(nullif(pci.fator_aplicado, 0), 1)
        then ef.fator_embarque_max
      else coalesce(nullif(pci.fator_aplicado, 0), 1)
    end as fator_vitrine,
    coalesce(nullif(trim(pci.unidade_sigla), ''), pci.dados->>'unidade_medida', 'UN') as unidade_vitrine_sigla
  from public.pedido_compra_item pci
  left join lateral (
    select max(
      public.p38_embarque_item_fator(ei.dados, pci.fator_aplicado)
    ) as fator_embarque_max
    from public.embarque_item ei
    join public.embarque e on e.id = ei.embarque_id
    where e.pedido_compra_id = pci.pedido_compra_id
      and ei.produto_id = pci.produto_id
      and coalesce(e.tipo, 'Embarque') is distinct from 'Necessidade'
  ) ef on true
  order by pci.pedido_compra_id, pci.produto_id, pci.ordem
),
totais_reais as (
  select
    le.pedido_compra_id,
    le.produto_id,
    public._p38_round_qty(sum(le.qtd_embarcada_base)) as quantidade_embarcada_real_base,
    public._p38_round_qty(sum(le.qtd_recebida_base)) as quantidade_recebida_real_base,
    public._p38_round_qty(
      sum(greatest(le.qtd_embarcada_base - le.qtd_recebida_base, 0))
    ) as quantidade_em_transito_base
  from linhas_embarque le
  where le.embarque_real
  group by le.pedido_compra_id, le.produto_id
),
totais_necessidade as (
  select
    le.pedido_compra_id,
    le.produto_id,
    public._p38_round_qty(sum(greatest(le.qtd_embarcada_base, 0))) as saldo_pos_recepcao_base
  from linhas_embarque le
  where not le.embarque_real
  group by le.pedido_compra_id, le.produto_id
),
calc as (
  select
    pc.id as pedido_compra_id,
    coalesce(pc.numero, pc.dados->>'numero') as pedido_compra_numero,
    pc.fornecedor_nome,
    pc.fornecedor_id,
    pc.status as pedido_status,
    pc.status_aprovacao_financeira,
    pc.status_embarque,
    pci.id as pedido_item_id,
    pci.produto_id,
    coalesce(nullif(trim(pci.produto_nome), ''), pci.dados->>'produto_nome') as produto_nome,
    coalesce(nullif(trim(pci.unidade_sigla), ''), pci.dados->>'unidade_medida', 'UN') as unidade_sigla,
    coalesce(pci.quantidade_comercial, 0) as quantidade_pedida_comercial,
    coalesce(pci.quantidade_base, 0) as quantidade_pedida_base,
    coalesce(nullif(pci.fator_aplicado, 0), fp.fator_vitrine, 1) as fator_vitrine,
    coalesce(fp.unidade_vitrine_sigla, pci.unidade_sigla, 'UN') as unidade_vitrine_sigla,
    coalesce(tr.quantidade_embarcada_real_base, 0) as quantidade_embarcada_real_base,
    coalesce(tr.quantidade_recebida_real_base, 0) as quantidade_recebida_real_base,
    coalesce(tr.quantidade_em_transito_base, 0) as quantidade_em_transito_base,
    coalesce(tn.saldo_pos_recepcao_base, 0) as saldo_pos_recepcao_base,
    public._p38_round_qty(
      greatest(
        coalesce(pci.quantidade_base, 0) - coalesce(tr.quantidade_embarcada_real_base, 0),
        0
      )
    ) as saldo_nunca_embarcado_base,
    public._p38_round_qty(
      greatest(
        coalesce(pci.quantidade_base, 0)
        - coalesce(tr.quantidade_recebida_real_base, 0)
        - coalesce(tr.quantidade_em_transito_base, 0),
        0
      )
    ) as falta_operacional_base,
    coalesce(pci.total, 0) as valor_linha_pedido,
    pci.ordem as pedido_item_ordem,
    pc.created_at as pedido_created_at,
    pc.updated_at as pedido_updated_at
  from public.pedido_compra_item pci
  join public.pedido_compra pc on pc.id = pci.pedido_compra_id
  left join fator_por_produto fp
    on fp.pedido_compra_id = pci.pedido_compra_id
   and fp.produto_id = pci.produto_id
  left join totais_reais tr
    on tr.pedido_compra_id = pci.pedido_compra_id
   and tr.produto_id = pci.produto_id
  left join totais_necessidade tn
    on tn.pedido_compra_id = pci.pedido_compra_id
   and tn.produto_id = pci.produto_id
)
select
  c.*,
  public.compra_para_exibicao(c.quantidade_embarcada_real_base, c.fator_vitrine) as quantidade_embarcada_real,
  public.compra_para_exibicao(c.quantidade_recebida_real_base, c.fator_vitrine) as quantidade_recebida_real,
  public.compra_para_exibicao(c.quantidade_em_transito_base, c.fator_vitrine) as quantidade_em_transito,
  public.compra_para_exibicao(c.saldo_nunca_embarcado_base, c.fator_vitrine) as saldo_nunca_embarcado,
  public.compra_para_exibicao(c.saldo_pos_recepcao_base, c.fator_vitrine) as saldo_pos_recepcao,
  public.compra_para_exibicao(c.falta_operacional_base, c.fator_vitrine) as falta_operacional,
  public.compra_para_exibicao(c.falta_operacional_base, c.fator_vitrine) as falta_operacional_vitrine,
  case
    when c.falta_operacional_base > 0.009 then 'FALTA_EMBARCAR'
    when c.quantidade_em_transito_base > 0.009 then 'EM_TRANSITO'
    when c.quantidade_pedida_base - c.quantidade_recebida_real_base <= 0.009 then 'OK'
    else 'REVISAR'
  end as diagnostico
from calc c;

comment on view public.pedido_compra_saldo_a_embarcar_v is
  'Saldo a embarcar. Base agregada com fator da linha de embarque (106); vitrine na leitura.';

create view public.pedido_compra_saldo_resumo_v as
select
  pedido_compra_id,
  pedido_compra_numero,
  fornecedor_nome,
  fornecedor_id,
  pedido_status,
  status_aprovacao_financeira,
  status_embarque,
  count(*) filter (where falta_operacional_base > 0.009) as linhas_com_falta,
  count(*) filter (
    where quantidade_em_transito_base > 0.009 and falta_operacional_base <= 0.009
  ) as linhas_so_em_transito,
  round(coalesce(sum(falta_operacional), 0)::numeric, 6) as soma_falta_operacional,
  round(coalesce(sum(quantidade_em_transito), 0)::numeric, 6) as soma_em_transito,
  round(coalesce(sum(saldo_pos_recepcao), 0)::numeric, 6) as soma_saldo_pos_recepcao,
  round(coalesce(sum(falta_operacional_base), 0)::numeric, 6) as soma_falta_operacional_base,
  round(coalesce(sum(valor_linha_pedido), 0)::numeric, 2) as valor_total_pedido,
  pedido_created_at,
  pedido_updated_at
from public.pedido_compra_saldo_a_embarcar_v
group by
  pedido_compra_id,
  pedido_compra_numero,
  fornecedor_nome,
  fornecedor_id,
  pedido_status,
  status_aprovacao_financeira,
  status_embarque,
  pedido_created_at,
  pedido_updated_at;

-- Cards / status (105) — dependem da view corrigida
create view public.pedido_compra_card_logistica_v as
with cards_desmembramento as (
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
    ('saldo-' || v.pedido_compra_id || '-' || v.pedido_item_id) as card_id,
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
    and public.p38_pedido_desmembramento_iniciado(v.pedido_compra_id)
)
select * from cards_desmembramento
union all
select * from cards_saldo;

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
    when coalesce(l.falta_legacy_card_base, 0) > 0.009 then 'Saldo a embarcar'
    when coalesce(a.linhas_desmembramento, 0) > 0 then
      case
        when coalesce(a.transito_base, 0) > 0.009 and coalesce(a.saldo_desmembramento_base, 0) <= 0.009
          then 'Em trânsito'
        when coalesce(a.recebida_base, 0) > 0.009
          then 'Parcialmente recebido'
        else coalesce(nullif(trim(pc.status_embarque), ''), 'Pendente')
      end
    else
      case
        when coalesce(l.transito_legacy, 0) > 0.009 then 'Em trânsito'
        else coalesce(nullif(trim(pc.status_embarque), ''), 'Pendente')
      end
  end as status_embarque_calc,
  case
    when coalesce(a.recebida_base, 0) > 0.009
      and coalesce(l.falta_legacy_card_base, 0) <= 0.009
      then 'Recebido'
    when coalesce(a.recebida_base, 0) > 0.009 then 'Parcial'
    else coalesce(nullif(trim(pc.status_recebimento_geral), ''), 'Pendente')
  end as status_recebimento_geral,
  case
    when coalesce(l.falta_legacy_card_base, 0) > 0.009 then 'FALTA_EMBARCAR'
    when coalesce(a.linhas_desmembramento, 0) > 0 and coalesce(a.transito_base, 0) > 0.009 then 'EM_TRANSITO'
    when coalesce(l.transito_legacy, 0) > 0.009 then 'EM_TRANSITO'
    else 'OK'
  end as diagnostico,
  public.p38_pedido_usa_folha_desmembramento(pc.id) as usa_folha_v2,
  pc.created_at,
  pc.updated_at
from public.pedido_compra pc
left join agg a on a.pedido_compra_id = pc.id
left join legacy l on l.pedido_compra_id = pc.id;

grant select on public.pedido_compra_saldo_a_embarcar_v to authenticated, anon, service_role;
grant select on public.pedido_compra_saldo_resumo_v to authenticated, anon, service_role;
grant select on public.pedido_compra_card_logistica_v to authenticated, anon, service_role;
grant select on public.pedido_compra_status_logistica_v to authenticated, anon, service_role;
