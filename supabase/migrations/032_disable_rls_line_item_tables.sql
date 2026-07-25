-- 032_disable_rls_line_item_tables.sql
-- Tabelas criadas na 030 herdam RLS activo sem policies → PostgREST (anon) devolve [].
-- Alinha com 025 (single-tenant) e pedido_venda_item (RLS off).

alter table if exists public.pedido_compra_item disable row level security;
alter table if exists public.embarque_item disable row level security;

grant select, insert, update, delete on public.pedido_compra_item to anon, authenticated;
grant select, insert, update, delete on public.embarque_item to anon, authenticated;
