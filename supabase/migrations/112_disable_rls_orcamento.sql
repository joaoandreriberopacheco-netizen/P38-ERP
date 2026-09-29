-- 112_disable_rls_orcamento.sql
-- orcamento / orcamento_item herdaram RLS activo sem policies → browser (anon) vê lista vazia.
-- Alinha com pedido_venda_item (032) e modo single-tenant (008).

alter table if exists public.orcamento disable row level security;
alter table if exists public.orcamento_item disable row level security;

grant select, insert, update, delete on public.orcamento to anon, authenticated;
grant select, insert, update, delete on public.orcamento_item to anon, authenticated;
