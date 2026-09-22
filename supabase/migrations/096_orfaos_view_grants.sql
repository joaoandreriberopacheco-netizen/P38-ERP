-- Grants REST (PostgREST) para views de órfãos
grant select on public.pedido_compra_orfaos_v to authenticated, anon, service_role;
grant select on public.pedido_compra_orfaos_resumo_v to authenticated, anon, service_role;
