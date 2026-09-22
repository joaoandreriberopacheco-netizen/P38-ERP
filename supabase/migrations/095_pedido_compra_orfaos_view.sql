-- =============================================================================
-- 095 — Órfãos: pedido − embarcado (conta relacional simples)
-- =============================================================================
-- Regra (João André):
--   1) Só entra pedido que já tem algum item embarcado (desmembramento começou).
--   2) Por linha: saldo_órfão = quantidade_pedida − quantidade_embarcada (embarques reais).
--   Embarque tipo Necessidade não conta como «embarcado» — é registo pós-recepção.
-- =============================================================================

create or replace view public.pedido_compra_orfaos_v as
with embarcado_real as (
  select
    ei.pedido_compra_id,
    ei.produto_id,
    sum(coalesce(ei.quantidade_embarcada_comercial, 0)) as quantidade_embarcada
  from public.embarque_item ei
  join public.embarque e on e.id = ei.embarque_id
  where e.tipo is distinct from 'Necessidade'
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
    coalesce(er.quantidade_embarcada, 0) as quantidade_embarcada,
    round(
      greatest(
        coalesce(pci.quantidade_comercial, 0) - coalesce(er.quantidade_embarcada, 0),
        0
      )::numeric,
      6
    ) as saldo_orfa
  from public.pedido_compra_item pci
  join public.pedido_compra pc on pc.id = pci.pedido_compra_id
  left join embarcado_real er
    on er.pedido_compra_id = pci.pedido_compra_id
   and er.produto_id = pci.produto_id
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
  'Órfãos por linha: saldo = pedido − embarcado (embarques reais). '
  'Só pedidos com pelo menos um item já embarcado.';

-- Resumo por pedido
create or replace view public.pedido_compra_orfaos_resumo_v as
select
  pedido_compra_id,
  pedido_compra_numero,
  fornecedor_nome,
  fornecedor_id,
  pedido_status,
  count(*) as linhas_orfas,
  round(sum(saldo_orfa)::numeric, 6) as soma_saldo_orfa,
  round(sum(quantidade_pedida)::numeric, 6) as soma_pedida,
  round(sum(quantidade_embarcada)::numeric, 6) as soma_embarcada
from public.pedido_compra_orfaos_v
group by
  pedido_compra_id,
  pedido_compra_numero,
  fornecedor_nome,
  fornecedor_id,
  pedido_status;

comment on view public.pedido_compra_orfaos_resumo_v is
  'Resumo de órfãos por pedido (soma saldo_orfa por linha).';
