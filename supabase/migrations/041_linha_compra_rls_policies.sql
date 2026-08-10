-- 041_linha_compra_rls_policies.sql
-- RLS estava activo sem políticas → browser Supabase não lia linha_compra / produto_compra / eixo_valor.

alter table public.linha_compra enable row level security;
alter table public.produto_compra enable row level security;
alter table public.eixo_valor enable row level security;

-- SELECT (catálogo no browser — anon + sessão autenticada)
drop policy if exists "linha_compra_select_public" on public.linha_compra;
create policy "linha_compra_select_public"
  on public.linha_compra for select
  to anon, authenticated
  using (true);

drop policy if exists "produto_compra_select_public" on public.produto_compra;
create policy "produto_compra_select_public"
  on public.produto_compra for select
  to anon, authenticated
  using (true);

drop policy if exists "eixo_valor_select_public" on public.eixo_valor;
create policy "eixo_valor_select_public"
  on public.eixo_valor for select
  to anon, authenticated
  using (true);

-- WRITE (cadastro / migração IA via utilizador autenticado)
drop policy if exists "linha_compra_write_authenticated" on public.linha_compra;
create policy "linha_compra_write_authenticated"
  on public.linha_compra for insert
  to authenticated
  with check (true);

drop policy if exists "linha_compra_update_authenticated" on public.linha_compra;
create policy "linha_compra_update_authenticated"
  on public.linha_compra for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "produto_compra_write_authenticated" on public.produto_compra;
create policy "produto_compra_write_authenticated"
  on public.produto_compra for insert
  to authenticated
  with check (true);

drop policy if exists "produto_compra_update_authenticated" on public.produto_compra;
create policy "produto_compra_update_authenticated"
  on public.produto_compra for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "eixo_valor_write_authenticated" on public.eixo_valor;
create policy "eixo_valor_write_authenticated"
  on public.eixo_valor for insert
  to authenticated
  with check (true);

drop policy if exists "eixo_valor_update_authenticated" on public.eixo_valor;
create policy "eixo_valor_update_authenticated"
  on public.eixo_valor for update
  to authenticated
  using (true)
  with check (true);
