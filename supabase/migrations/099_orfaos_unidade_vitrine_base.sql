-- =============================================================================
-- 099 — Órfãos v4: quantidades em base (M²) + exibição em unidade vitrine (CX)
-- =============================================================================
-- Corrige mistura CX/M² em embarque_item (ex.: Java HHW-5NP: 23 CX recebidas
-- = 46 M², falta 1 CX = 2 M² — não 25 M² comerciais).
-- =============================================================================

drop view if exists public.pedido_compra_orfaos_resumo_v;
drop view if exists public.pedido_compra_orfaos_v;

create view public.pedido_compra_orfaos_v as
with ei_base as (
  select
    ei.id,
    ei.embarque_id,
    ei.pedido_compra_id,
    ei.produto_id,
    coalesce(
      nullif((ei.dados->>'quantidade_pedida_base')::numeric, 0),
      coalesce(ei.quantidade_pedida_comercial, 0)
        * coalesce(nullif((ei.dados->>'fator_aplicado')::numeric, 0), 1)
    ) as qtd_pedida_base,
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
movimento_real as (
  select
    eb.pedido_compra_id,
    eb.produto_id,
    sum(eb.qtd_embarcada_base) as quantidade_desmembrada_base,
    sum(eb.qtd_embarcada_base) as quantidade_embarcada_base,
    sum(eb.qtd_recebida_base) as quantidade_recebida_base,
    sum(greatest(eb.qtd_embarcada_base - eb.qtd_recebida_base, 0)) as quantidade_em_transito_base,
    count(distinct eb.embarque_id) as qtd_embarques
  from ei_base eb
  join public.embarque e on e.id = eb.embarque_id
  where e.tipo is distinct from 'Necessidade'
  group by eb.pedido_compra_id, eb.produto_id
),
necessidade as (
  select
    eb.pedido_compra_id,
    eb.produto_id,
    sum(greatest(eb.qtd_embarcada_base, 0)) as saldo_necessidade_base
  from ei_base eb
  join public.embarque e on e.id = eb.embarque_id
  where e.tipo = 'Necessidade'
  group by eb.pedido_compra_id, eb.produto_id
),
linhas as (
  select
    pc.id as pedido_compra_id,
    coalesce(pc.numero, pc.dados->>'numero') as pedido_compra_numero,
    pc.fornecedor_nome,
    pc.fornecedor_id,
    pc.status as pedido_status,
    pci.id as pedido_item_id,
    pci.produto_id,
    coalesce(nullif(trim(pci.produto_nome), ''), pci.dados->>'produto_nome') as produto_nome,
    coalesce(nullif(trim(pci.unidade_sigla), ''), pci.dados->>'unidade_medida', 'UN') as unidade_sigla,
    coalesce(pci.quantidade_base, pci.quantidade_comercial, 0) as quantidade_pedida_base,
    coalesce(mr.quantidade_desmembrada_base, 0) as quantidade_desmembrada_base,
    coalesce(mr.quantidade_embarcada_base, 0) as quantidade_embarcada_base,
    coalesce(mr.quantidade_recebida_base, 0) as quantidade_recebida_base,
    coalesce(mr.quantidade_em_transito_base, 0) as quantidade_em_transito_base,
    coalesce(mr.qtd_embarques, 0) as qtd_embarques,
    coalesce(n.saldo_necessidade_base, 0) as saldo_necessidade_base,
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
    round(
      (
        coalesce(n.saldo_necessidade_base, 0)
        + case
            when coalesce(mr.quantidade_embarcada_base, 0) <= 0.009 then 0
            when coalesce(mr.quantidade_recebida_base, 0) + 0.009 >= coalesce(mr.quantidade_embarcada_base, 0)
              and coalesce(mr.quantidade_recebida_base, 0)
                + coalesce(mr.quantidade_em_transito_base, 0) + 0.009
                < coalesce(pci.quantidade_base, pci.quantidade_comercial, 0)
              and (
                coalesce(mr.qtd_embarques, 0) > 1
                or coalesce(mr.quantidade_embarcada_base, 0) + 0.009
                  >= coalesce(pci.quantidade_base, pci.quantidade_comercial, 0)
              )
              then greatest(
                coalesce(pci.quantidade_base, pci.quantidade_comercial, 0)
                - coalesce(mr.quantidade_recebida_base, 0)
                - coalesce(mr.quantidade_em_transito_base, 0),
                0
              )
            when coalesce(mr.quantidade_desmembrada_base, 0) + 0.009
              < coalesce(pci.quantidade_base, pci.quantidade_comercial, 0)
              then greatest(
                coalesce(mr.quantidade_desmembrada_base, 0)
                - coalesce(mr.quantidade_recebida_base, 0),
                0
              )
            when coalesce(mr.quantidade_recebida_base, 0) + 0.009
              >= coalesce(mr.quantidade_embarcada_base, 0)
              then 0
            else greatest(
              coalesce(mr.quantidade_embarcada_base, 0)
              - coalesce(mr.quantidade_recebida_base, 0),
              0
            )
          end
      )::numeric,
      6
    ) as saldo_orfa_base
  from public.pedido_compra_item pci
  join public.pedido_compra pc on pc.id = pci.pedido_compra_id
  left join movimento_real mr
    on mr.pedido_compra_id = pci.pedido_compra_id
   and mr.produto_id = pci.produto_id
  left join necessidade n
    on n.pedido_compra_id = pci.pedido_compra_id
   and n.produto_id = pci.produto_id
  left join public.produto p on p.id = pci.produto_id
),
linhas_com_vitrine as (
  select
    l.*,
    round(
      case
        when coalesce(l.fator_vitrine, 1) <= 0.009 then l.saldo_orfa_base
        when upper(replace(replace(l.unidade_vitrine_sigla, '²', '2'), ' ', ''))
          in ('CX', 'PAC', 'CT', 'FD', 'SC', 'PCT', 'PT', 'DZ', 'GL', 'RL', 'BAL', 'FAR')
          and abs(l.saldo_orfa_base / l.fator_vitrine - round(l.saldo_orfa_base / l.fator_vitrine)) <= 0.02
          then round(l.saldo_orfa_base / l.fator_vitrine)
        else round((l.saldo_orfa_base / l.fator_vitrine)::numeric, 2)
      end,
      6
    ) as saldo_orfa
  from linhas l
),
pedidos_com_embarque as (
  select pedido_compra_id
  from linhas_com_vitrine
  group by pedido_compra_id
  having sum(quantidade_embarcada_base) > 0.009
)
select
  l.pedido_compra_id,
  l.pedido_compra_numero,
  l.fornecedor_nome,
  l.fornecedor_id,
  l.pedido_status,
  l.pedido_item_id,
  l.produto_id,
  l.produto_nome,
  l.unidade_sigla,
  l.quantidade_pedida_base,
  l.quantidade_desmembrada_base,
  l.quantidade_embarcada_base,
  l.quantidade_recebida_base,
  l.quantidade_em_transito_base,
  l.saldo_necessidade_base,
  l.unidade_vitrine_sigla,
  l.fator_vitrine,
  l.saldo_orfa_base,
  l.saldo_orfa,
  -- aliases legados (comercial = vitrine para leitura humana)
  l.quantidade_pedida_base as quantidade_pedida,
  l.quantidade_desmembrada_base as quantidade_desmembrada,
  l.quantidade_embarcada_base as quantidade_embarcada,
  l.quantidade_recebida_base as quantidade_recebida
from linhas_com_vitrine l
join pedidos_com_embarque pe on pe.pedido_compra_id = l.pedido_compra_id
where l.saldo_orfa_base > 0.009
  and l.pedido_status is distinct from 'Concluído';

comment on view public.pedido_compra_orfaos_v is
  'Órfãos v4: saldos em base (M²) com saldo_orfa em unidade vitrine (CX). '
  'Recepções fechadas em múltiplos embarques: pedido−recebido. '
  'Desmembrado parcial: desmembrado−recebido. Trânsito excluído.';

create view public.pedido_compra_orfaos_resumo_v as
select
  pedido_compra_id,
  pedido_compra_numero,
  fornecedor_nome,
  fornecedor_id,
  pedido_status,
  count(*) as linhas_orfas,
  round(sum(saldo_orfa)::numeric, 6) as soma_saldo_orfa,
  round(sum(saldo_orfa_base)::numeric, 6) as soma_saldo_orfa_base,
  round(sum(quantidade_pedida_base)::numeric, 6) as soma_pedida_base,
  round(sum(quantidade_desmembrada_base)::numeric, 6) as soma_desmembrada_base,
  round(sum(quantidade_embarcada_base)::numeric, 6) as soma_embarcada_base,
  round(sum(quantidade_recebida_base)::numeric, 6) as soma_recebida_base
from public.pedido_compra_orfaos_v
group by
  pedido_compra_id,
  pedido_compra_numero,
  fornecedor_nome,
  fornecedor_id,
  pedido_status;

comment on view public.pedido_compra_orfaos_resumo_v is
  'Resumo de órfãos por pedido (migration 099 — vitrine + base).';

grant select on public.pedido_compra_orfaos_v to authenticated, anon, service_role;
grant select on public.pedido_compra_orfaos_resumo_v to authenticated, anon, service_role;
