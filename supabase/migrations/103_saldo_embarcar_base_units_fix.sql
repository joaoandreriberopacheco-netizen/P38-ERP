-- =============================================================================
-- 103 — Corrigir saldo a embarcar: motor só em base + vitrine na leitura
-- =============================================================================
-- Bug (ex.: Ausier G62-HUF): view 094 subtraía quantidade comercial (CX) de
-- quantidade_pedida_base (M²) → falta_operacional inflada (67,62 em vez de 0).
--
-- Regra: agregar embarques em BASE (× fator_aplicado); KPI vitrine = ÷ fator.
-- =============================================================================

create or replace function public.compra_para_base(
  p_qty numeric,
  p_fator numeric default 1
)
returns numeric
language sql
immutable
as $$
  select public._p38_round_qty(
    coalesce(p_qty, 0) * coalesce(nullif(p_fator, 0), 1)
  );
$$;

create or replace function public.compra_para_exibicao(
  p_qty_base numeric,
  p_fator numeric default 1
)
returns numeric
language sql
immutable
as $$
  select public._p38_round_qty(
    case
      when coalesce(nullif(p_fator, 0), 1) > 0
        then coalesce(p_qty_base, 0) / coalesce(nullif(p_fator, 0), 1)
      else coalesce(p_qty_base, 0)
    end
  );
$$;

-- Views 102 dependem de pedido_compra_saldo_a_embarcar_v — recriar depois do fix
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
    coalesce(ei.quantidade_embarcada_comercial, 0) as qtd_embarcada,
    coalesce(ei.quantidade_recebida_comercial, 0) as qtd_recebida,
    coalesce(
      nullif(trim(ei.unidade_sigla), ''),
      ei.dados->>'unidade_medida',
      'UN'
    ) as unidade_sigla,
    (ec.tipo is distinct from 'Necessidade') as embarque_real
  from embarque_codigo ec
  join public.embarque_item ei on ei.embarque_id = ec.embarque_id
),
fator_por_produto as (
  select distinct on (pci.pedido_compra_id, pci.produto_id)
    pci.pedido_compra_id,
    pci.produto_id,
    coalesce(nullif(pci.fator_aplicado, 0), 1) as fator_vitrine,
    coalesce(nullif(trim(pci.unidade_sigla), ''), pci.dados->>'unidade_medida', 'UN') as unidade_vitrine_sigla
  from public.pedido_compra_item pci
  order by pci.pedido_compra_id, pci.produto_id, pci.ordem
),
totais_reais as (
  select
    le.pedido_compra_id,
    le.produto_id,
    public._p38_round_qty(
      sum(public.compra_para_base(le.qtd_embarcada, fp.fator_vitrine))
    ) as quantidade_embarcada_real_base,
    public._p38_round_qty(
      sum(public.compra_para_base(le.qtd_recebida, fp.fator_vitrine))
    ) as quantidade_recebida_real_base,
    public._p38_round_qty(
      sum(
        greatest(
          public.compra_para_base(le.qtd_embarcada, fp.fator_vitrine)
          - public.compra_para_base(le.qtd_recebida, fp.fator_vitrine),
          0
        )
      )
    ) as quantidade_em_transito_base
  from linhas_embarque le
  left join fator_por_produto fp
    on fp.pedido_compra_id = le.pedido_compra_id
   and fp.produto_id = le.produto_id
  where le.embarque_real
  group by le.pedido_compra_id, le.produto_id
),
totais_necessidade as (
  select
    le.pedido_compra_id,
    le.produto_id,
    public._p38_round_qty(
      sum(greatest(public.compra_para_base(le.qtd_embarcada, fp.fator_vitrine), 0))
    ) as saldo_pos_recepcao_base
  from linhas_embarque le
  left join fator_por_produto fp
    on fp.pedido_compra_id = le.pedido_compra_id
   and fp.produto_id = le.produto_id
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
    coalesce(nullif(pci.fator_aplicado, 0), 1) as fator_vitrine,
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
  'Saldo a embarcar por linha. Motor em base; falta_operacional_vitrine = saldo pendente na UM vitrine. '
  'Migration 103 corrige mistura CX/M² da 094.';

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

comment on view public.pedido_compra_saldo_resumo_v is
  'Resumo por pedido — falta_operacional em vitrine; soma_falta_operacional_base em fator-1.';

-- Recriar views dependentes (migration 102) com colunas base corrigidas
create or replace view public.pedido_compra_card_logistica_v as
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
)
select * from cards_desmembramento
union all
select * from cards_saldo
union all
select * from legacy_saldo;

create or replace view public.pedido_compra_status_logistica_v as
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
    round(coalesce(sum(falta_operacional_base), 0)::numeric, 6) as falta_legacy_base
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
        when coalesce(l.falta_legacy_base, 0) > 0.009 then 'Saldo a embarcar'
        when coalesce(l.transito_legacy, 0) > 0.009 then 'Em trânsito'
        else coalesce(nullif(trim(pc.status_embarque), ''), 'Pendente')
      end
  end as status_embarque_calc,
  case
    when coalesce(a.recebida_base, 0) > 0.009
      and coalesce(a.saldo_pedido_base, a.saldo_desmembramento_base, l.falta_legacy_base, 0) <= 0.009
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
        when coalesce(l.falta_legacy_base, 0) > 0.009 then 'FALTA_EMBARCAR'
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

grant select on public.pedido_compra_saldo_a_embarcar_v to authenticated, anon, service_role;
grant select on public.pedido_compra_saldo_resumo_v to authenticated, anon, service_role;
grant select on public.pedido_compra_card_logistica_v to authenticated, anon, service_role;
grant select on public.pedido_compra_status_logistica_v to authenticated, anon, service_role;

grant execute on function public.compra_para_base(numeric, numeric) to authenticated, anon, service_role;
grant execute on function public.compra_para_exibicao(numeric, numeric) to authenticated, anon, service_role;
