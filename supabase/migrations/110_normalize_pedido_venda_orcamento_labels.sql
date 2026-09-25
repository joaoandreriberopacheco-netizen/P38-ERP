-- 110_normalize_pedido_venda_orcamento_labels.sql
-- Alinha colunas `tipo` / `status` ao valor canónico `Orçamento` (Gestão + orçamento rápido).

update public.pedido_venda pv
set
  tipo = 'Orçamento',
  updated_at = now()
where tipo is distinct from 'Orçamento'
  and public.p38_pedido_venda_tipo(pv) in ('orçamento', 'orcamento');

update public.pedido_venda pv
set
  status = 'Orçamento',
  updated_at = now()
where status is distinct from 'Orçamento'
  and public.p38_pedido_venda_status(pv) in ('orçamento', 'orcamento');

update public.pedido_venda pv
set
  dados = jsonb_set(
    jsonb_set(coalesce(pv.dados, '{}'::jsonb), '{tipo}', '"Orçamento"'::jsonb, true),
    '{status}',
    '"Orçamento"'::jsonb,
    true
  ),
  updated_at = now()
where pv.dados->>'origem' = 'orcamento_rapido'
  and (
    coalesce(pv.dados->>'tipo', '') is distinct from 'Orçamento'
    or coalesce(pv.dados->>'status', '') is distinct from 'Orçamento'
  );
