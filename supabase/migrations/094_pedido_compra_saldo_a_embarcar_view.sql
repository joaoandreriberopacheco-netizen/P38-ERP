-- =============================================================================
-- 094 — View global: saldo a embarcar por linha de pedido de compra
-- =============================================================================
-- Fonte de verdade read-only alinhada a scripts/sql/auditoria-pedido-compra-tintao-e62.sql
--
-- Métricas:
--   saldo_nunca_embarcado  = pedido − embarcado (embarques reais)
--   saldo_pos_recepcao     = registado em embarque.tipo = 'Necessidade'
--   falta_operacional      = pedido − recebido − em_trânsito (KPI "falta embarcar")
-- =============================================================================

create or replace view public.pedido_compra_saldo_a_embarcar_v as
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
totais_reais as (
  select
    le.pedido_compra_id,
    le.produto_id,
    sum(le.qtd_embarcada) as quantidade_embarcada_real,
    sum(le.qtd_recebida) as quantidade_recebida_real,
    sum(greatest(le.qtd_embarcada - le.qtd_recebida, 0)) as quantidade_em_transito
  from linhas_embarque le
  where le.embarque_real
  group by le.pedido_compra_id, le.produto_id
),
totais_necessidade as (
  select
    le.pedido_compra_id,
    le.produto_id,
    sum(greatest(le.qtd_embarcada, 0)) as saldo_pos_recepcao
  from linhas_embarque le
  where not le.embarque_real
  group by le.pedido_compra_id, le.produto_id
)
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
  coalesce(tr.quantidade_embarcada_real, 0) as quantidade_embarcada_real,
  coalesce(tr.quantidade_recebida_real, 0) as quantidade_recebida_real,
  coalesce(tr.quantidade_em_transito, 0) as quantidade_em_transito,
  round(
    greatest(
      coalesce(pci.quantidade_comercial, 0) - coalesce(tr.quantidade_embarcada_real, 0),
      0
    )::numeric,
    6
  ) as saldo_nunca_embarcado,
  round(coalesce(tn.saldo_pos_recepcao, 0)::numeric, 6) as saldo_pos_recepcao,
  round(
    greatest(
      coalesce(pci.quantidade_comercial, 0)
      - coalesce(tr.quantidade_recebida_real, 0)
      - coalesce(tr.quantidade_em_transito, 0),
      0
    )::numeric,
    6
  ) as falta_operacional,
  case
    when greatest(
      coalesce(pci.quantidade_comercial, 0)
      - coalesce(tr.quantidade_recebida_real, 0)
      - coalesce(tr.quantidade_em_transito, 0),
      0
    ) > 0.009 then 'FALTA_EMBARCAR'
    when coalesce(tr.quantidade_em_transito, 0) > 0.009 then 'EM_TRANSITO'
    when coalesce(pci.quantidade_comercial, 0) - coalesce(tr.quantidade_recebida_real, 0) <= 0.009
      then 'OK'
    else 'REVISAR'
  end as diagnostico,
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
 and tn.produto_id = pci.produto_id;

comment on view public.pedido_compra_saldo_a_embarcar_v is
  'Saldo a embarcar por linha de pedido: embarques reais vs Necessidade pós-recepção. '
  'falta_operacional = pedido − recebido − em_trânsito (KPI operacional).';

-- View agregada por pedido (KPIs rápidos)
create or replace view public.pedido_compra_saldo_resumo_v as
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
  'Resumo por pedido: somas de falta_operacional, em_trânsito e saldo pós-recepção.';
