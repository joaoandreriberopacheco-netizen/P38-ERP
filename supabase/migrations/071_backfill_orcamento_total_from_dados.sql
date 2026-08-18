-- 071_backfill_orcamento_total_from_dados.sql
-- Corrige orçamentos cujo `total` foi inflado após sync de linas (preço tabela).

update public.pedido_venda pv
set
  total = round((pv.dados->>'valor_total')::numeric, 2),
  subtotal = round(coalesce((pv.dados->>'subtotal')::numeric, pv.subtotal::numeric), 2),
  updated_at = now()
where public.p38_pedido_venda_tipo(pv) in ('orçamento', 'orcamento')
   or public.p38_pedido_venda_status(pv) in ('orçamento', 'orcamento')
  and pv.dados->>'valor_total' ~ '^-?\d'
  and pv.total::numeric > (pv.dados->>'valor_total')::numeric * 1.15;
