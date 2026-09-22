-- =============================================================================
-- 101 — Saldo a embarcar em base (M²) + falta_operacional em vitrine (CX)
-- =============================================================================
-- Alinha pedido_compra_saldo_a_embarcar_v à lógica da migration 099/100.
-- falta_operacional = pedido_base − recebido_base − trânsito_base
-- =============================================================================

drop view if exists public.pedido_compra_saldo_resumo_v;
drop view if exists public.pedido_compra_saldo_a_embarcar_v;

create view public.pedido_compra_saldo_a_embarcar_v as
with ei_base as (
  select
    ei.embarque_id,
    ei.pedido_compra_id,
    ei.produto_id,
    coalesce(
      nullif((ei.dados->>'quantidade_embarcada_base')::numeric, 0),
      coalesce(ei.quantidade_embarcada_comercial, 0)
        * coalesce(nullif((ei.dados->>'fator_aplicado')::numeric, 0), 1)
    ) as qtd_embarcada_base,
    coalesce(
      nullif((ei.dados->>'quantidade_recebida_base')::numeric, 0),
      coalesce(ei.quantidade_recebida_comercial, 0)
        * coalesce(nullif((ei.dados->>'fator_aplicado')::numeric, 0), 1)
    ) as qtd_recebida_base
  from public.embarque_item ei
),
embarque_codigo as (
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
    eb.produto_id,
    eb.qtd_embarcada_base,
    eb.qtd_recebida_base,
    (ec.tipo is distinct from 'Necessidade') as embarque_real
  from embarque_codigo ec
  join ei_base eb on eb.embarque_id = ec.embarque_id
),
totais_reais as (
  select
    le.pedido_compra_id,
    le.produto_id,
    sum(le.qtd_embarcada_base) as quantidade_embarcada_real,
    sum(le.qtd_recebida_base) as quantidade_recebida_real,
    sum(greatest(le.qtd_embarcada_base - le.qtd_recebida_base, 0)) as quantidade_em_transito
  from linhas_embarque le
  where le.embarque_real
  group by le.pedido_compra_id, le.produto_id
),
totais_necessidade as (
  select
    le.pedido_compra_id,
    le.produto_id,
    sum(greatest(le.qtd_embarcada_base, 0)) as saldo_pos_recepcao
  from linhas_embarque le
  where not le.embarque_real
  group by le.pedido_compra_id, le.produto_id
),
linhas as (
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
    coalesce(pci.quantidade_base, pci.quantidade_comercial, 0) as quantidade_pedida_base,
    coalesce(tr.quantidade_embarcada_real, 0) as quantidade_embarcada_real,
    coalesce(tr.quantidade_recebida_real, 0) as quantidade_recebida_real,
    coalesce(tr.quantidade_em_transito, 0) as quantidade_em_transito,
    round(
      greatest(
        coalesce(pci.quantidade_base, pci.quantidade_comercial, 0)
        - coalesce(tr.quantidade_embarcada_real, 0),
        0
      )::numeric,
      6
    ) as saldo_nunca_embarcado,
    round(coalesce(tn.saldo_pos_recepcao, 0)::numeric, 6) as saldo_pos_recepcao,
    round(
      greatest(
        coalesce(pci.quantidade_base, pci.quantidade_comercial, 0)
        - coalesce(tr.quantidade_recebida_real, 0)
        - coalesce(tr.quantidade_em_transito, 0),
        0
      )::numeric,
      6
    ) as falta_operacional,
    coalesce(
      nullif(trim(p.unidade_vitrine), ''),
      nullif(trim(p.dados->>'unidade_vitrine'), ''),
      'UN'
    ) as unidade_vitrine_sigla,
    coalesce(
      (
        select max(coalesce(nullif((alt->>'fator_conversao')::numeric, 0), 1))
        from jsonb_array_elements(coalesce(p.unidades_alternativas, p.dados->'unidades_alternativas', '[]'::jsonb)) alt
        where upper(replace(replace(trim(coalesce(alt->>'unidade', alt->>'sigla', '')), '²', '2'), ' ', ''))
          = upper(replace(replace(
              coalesce(nullif(trim(p.unidade_vitrine), ''), nullif(trim(p.dados->>'unidade_vitrine'), ''), 'CX'),
              '²', '2'), ' ', ''))
      ),
      (
        select max(coalesce(nullif((alt->>'fator_conversao')::numeric, 0), 1))
        from jsonb_array_elements(coalesce(p.unidades_alternativas, p.dados->'unidades_alternativas', '[]'::jsonb)) alt
        where coalesce(nullif((alt->>'fator_conversao')::numeric, 0), 1) > 1.009
      ),
      coalesce(nullif(pci.fator_aplicado, 0), nullif((pci.dados->>'fator_conversao')::numeric, 0), 1)
    ) as fator_vitrine,
    coalesce(pci.total, 0) as valor_linha_pedido,
    pci.ordem as pedido_item_ordem,
    pc.created_at as pedido_created_at,
    pc.updated_at as pedido_updated_at
  from public.pedido_compra_item pci
  join public.pedido_compra pc on pc.id = pci.pedido_compra_id
  left join totais_reais tr
    on tr.pedido_compra_id = pci.pedido_compra_id
   and tr.produto_id = pci.produto_id
  left join totais_necessidade tn
    on tn.pedido_compra_id = pci.pedido_compra_id
   and tn.produto_id = pci.produto_id
  left join public.produto p on p.id = pci.produto_id
)
select
  l.*,
  round(
    case
      when coalesce(l.fator_vitrine, 1) <= 0.009 then l.falta_operacional
      when upper(replace(replace(l.unidade_vitrine_sigla, '²', '2'), ' ', ''))
        in ('CX', 'PAC', 'CT', 'FD', 'SC', 'PCT', 'PT', 'DZ', 'GL', 'RL', 'BAL', 'FAR')
        and abs(l.falta_operacional / l.fator_vitrine - round(l.falta_operacional / l.fator_vitrine)) <= 0.02
        then round(l.falta_operacional / l.fator_vitrine)
      else round((l.falta_operacional / l.fator_vitrine)::numeric, 2)
    end,
    6
  ) as falta_operacional_vitrine
from linhas l;

comment on view public.pedido_compra_saldo_a_embarcar_v is
  'Saldo a embarcar por linha (base M²). falta_operacional = pedido − recebido − trânsito. '
  'falta_operacional_vitrine converte para CX/PAC. Migration 101.';

create view public.pedido_compra_saldo_resumo_v as
select
  pedido_compra_id,
  pedido_compra_numero,
  fornecedor_nome,
  fornecedor_id,
  pedido_status,
  status_aprovacao_financeira,
  status_embarque,
  count(*) filter (where falta_operacional > 0.009) as linhas_com_falta,
  count(*) filter (
    where quantidade_em_transito > 0.009 and falta_operacional <= 0.009
  ) as linhas_so_em_transito,
  round(coalesce(sum(falta_operacional), 0)::numeric, 6) as soma_falta_operacional,
  round(coalesce(sum(falta_operacional_vitrine), 0)::numeric, 6) as soma_falta_operacional_vitrine,
  round(coalesce(sum(quantidade_em_transito), 0)::numeric, 6) as soma_em_transito,
  round(coalesce(sum(saldo_pos_recepcao), 0)::numeric, 6) as soma_saldo_pos_recepcao,
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
  'Resumo por pedido: falta_operacional em base e vitrine (migration 101).';

grant select on public.pedido_compra_saldo_a_embarcar_v to authenticated, anon, service_role;
grant select on public.pedido_compra_saldo_resumo_v to authenticated, anon, service_role;
