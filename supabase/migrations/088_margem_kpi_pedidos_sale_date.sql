-- 088_margem_kpi_pedidos_sale_date.sql
-- Job KPI margem: pedidos pela data de venda (competência), não só created_at.

create or replace function public.p38_margem_kpi_pedido_ids(p_from date, p_to date)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select pv.id
  from public.pedido_venda pv
  where public.p38_pedido_venda_sale_date(pv) between p_from and p_to
    and public.p38_pedido_venda_status(pv) <> 'cancelado'
    and public.p38_pedido_venda_status(pv) not in ('orçamento', 'orcamento')
    and public.p38_pedido_venda_tipo(pv) not in ('orçamento', 'orcamento');
$$;

comment on function public.p38_margem_kpi_pedido_ids(date, date) is
  'IDs de pedido_venda na competência (data de venda Tabatinga). Job: dashboard:kpi-margem-fechar.';

grant execute on function public.p38_margem_kpi_pedido_ids(date, date) to service_role;
