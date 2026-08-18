-- 070_pedido_venda_elegivel_status_orcamento.sql
-- Orçamento (status ou tipo) não conta como venda nos snapshots/KPI SQL.

create or replace function public.p38_pedido_venda_elegivel_dashboard(pv public.pedido_venda)
returns boolean language sql stable as $$
  select public.p38_pedido_venda_status(pv) <> 'cancelado'
     and public.p38_pedido_venda_status(pv) not in ('orçamento', 'orcamento')
     and public.p38_pedido_venda_tipo(pv) not in ('orçamento', 'orcamento')
     and public.p38_pedido_venda_sale_date(pv) is not null;
$$;
