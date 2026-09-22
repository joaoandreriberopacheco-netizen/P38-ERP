-- =============================================================================
-- 098 — Órfãos v3: desmembrado − recebido / embarcado, exclui trânsito
-- =============================================================================

drop view if exists public.pedido_compra_orfaos_resumo_v;
drop view if exists public.pedido_compra_orfaos_v;

create view public.pedido_compra_orfaos_v as
with movimento_real as (
  select
    ei.pedido_compra_id,
    ei.produto_id,
    sum(coalesce(ei.quantidade_pedida_comercial, 0)) as quantidade_desmembrada,
    sum(coalesce(ei.quantidade_embarcada_comercial, 0)) as quantidade_embarcada,
    sum(coalesce(ei.quantidade_recebida_comercial, 0)) as quantidade_recebida
  from public.embarque_item ei
  join public.embarque e on e.id = ei.embarque_id
  where e.tipo is distinct from 'Necessidade'
  group by ei.pedido_compra_id, ei.produto_id
),
necessidade as (
  select
    ei.pedido_compra_id,
    ei.produto_id,
    sum(greatest(coalesce(ei.quantidade_embarcada_comercial, 0), 0)) as saldo_necessidade
  from public.embarque_item ei
  join public.embarque e on e.id = ei.embarque_id
  where e.tipo = 'Necessidade'
  group by ei.pedido_compra_id, ei.produto_id
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
    coalesce(pci.quantidade_comercial, 0) as quantidade_pedida,
    coalesce(mr.quantidade_desmembrada, 0) as quantidade_desmembrada,
    coalesce(mr.quantidade_embarcada, 0) as quantidade_embarcada,
    coalesce(mr.quantidade_recebida, 0) as quantidade_recebida,
    coalesce(n.saldo_necessidade, 0) as saldo_necessidade,
    round(
      (
        coalesce(n.saldo_necessidade, 0)
        + case
            when coalesce(mr.quantidade_desmembrada, 0) <= 0.009 then 0
            when coalesce(mr.quantidade_desmembrada, 0) + 0.009 < coalesce(pci.quantidade_comercial, 0)
              then greatest(coalesce(mr.quantidade_desmembrada, 0) - coalesce(mr.quantidade_recebida, 0), 0)
            when coalesce(mr.quantidade_recebida, 0) + 0.009 >= coalesce(mr.quantidade_embarcada, 0)
              then 0
            else greatest(coalesce(mr.quantidade_desmembrada, 0) - coalesce(mr.quantidade_embarcada, 0), 0)
          end
      )::numeric,
      6
    ) as saldo_orfa
  from public.pedido_compra_item pci
  join public.pedido_compra pc on pc.id = pci.pedido_compra_id
  left join movimento_real mr
    on mr.pedido_compra_id = pci.pedido_compra_id
   and mr.produto_id = pci.produto_id
  left join necessidade n
    on n.pedido_compra_id = pci.pedido_compra_id
   and n.produto_id = pci.produto_id
),
pedidos_com_embarque as (
  select pedido_compra_id
  from linhas
  group by pedido_compra_id
  having sum(quantidade_embarcada) > 0.009
)
select l.*
from linhas l
join pedidos_com_embarque pe on pe.pedido_compra_id = l.pedido_compra_id
where l.saldo_orfa > 0.009
  and l.pedido_status is distinct from 'Concluído';

comment on view public.pedido_compra_orfaos_v is
  'Órfãos: só dentro do desmembrado. Parcial: desmembrado−recebido. '
  'Total desmembrado com recepções fechadas: 0 (+ Necessidade). '
  'Em trânsito (embarcado>recebido) não entra.';

create view public.pedido_compra_orfaos_resumo_v as
select
  pedido_compra_id,
  pedido_compra_numero,
  fornecedor_nome,
  fornecedor_id,
  pedido_status,
  count(*) as linhas_orfas,
  round(sum(saldo_orfa)::numeric, 6) as soma_saldo_orfa,
  round(sum(quantidade_pedida)::numeric, 6) as soma_pedida,
  round(sum(quantidade_desmembrada)::numeric, 6) as soma_desmembrada,
  round(sum(quantidade_embarcada)::numeric, 6) as soma_embarcada,
  round(sum(quantidade_recebida)::numeric, 6) as soma_recebida
from public.pedido_compra_orfaos_v
group by
  pedido_compra_id,
  pedido_compra_numero,
  fornecedor_nome,
  fornecedor_id,
  pedido_status;

comment on view public.pedido_compra_orfaos_resumo_v is
  'Resumo de órfãos por pedido (migration 098).';

grant select on public.pedido_compra_orfaos_v to authenticated, anon, service_role;
grant select on public.pedido_compra_orfaos_resumo_v to authenticated, anon, service_role;
