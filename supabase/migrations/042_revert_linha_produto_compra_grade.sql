-- 042_revert_linha_produto_compra_grade.sql
-- Reverte 040 + 041: catálogo por linha arquivado; app volta ao catálogo legado (h1–h5).
-- Os ficheiros 040/041 permanecem no histórico de migrações já aplicados.

-- Colunas em produto (referências à camada linha_compra)
alter table public.produto drop column if exists linha_compra_id;
alter table public.produto drop column if exists produto_compra_id;
alter table public.produto drop column if exists eixo_a_valor_id;
alter table public.produto drop column if exists eixo_b_valor_id;
alter table public.produto drop column if exists eixo_a_texto;
alter table public.produto drop column if exists eixo_b_texto;
alter table public.produto drop column if exists no_mix_ativo;
alter table public.produto drop column if exists celula_obrigatoria;

drop function if exists public.montar_descricao_sku_grade(text, text, text, text);

-- Políticas RLS (041)
drop policy if exists "linha_compra_select_public" on public.linha_compra;
drop policy if exists "produto_compra_select_public" on public.produto_compra;
drop policy if exists "eixo_valor_select_public" on public.eixo_valor;
drop policy if exists "linha_compra_write_authenticated" on public.linha_compra;
drop policy if exists "linha_compra_update_authenticated" on public.linha_compra;
drop policy if exists "produto_compra_write_authenticated" on public.produto_compra;
drop policy if exists "produto_compra_update_authenticated" on public.produto_compra;
drop policy if exists "eixo_valor_write_authenticated" on public.eixo_valor;
drop policy if exists "eixo_valor_update_authenticated" on public.eixo_valor;

drop table if exists public.eixo_valor cascade;
drop table if exists public.produto_compra cascade;
drop table if exists public.linha_compra cascade;
