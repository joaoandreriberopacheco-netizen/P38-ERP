-- 061_modelo_produto_compra_min_linhas_saldavel.sql
-- Cerâmica: saldável quando >= min_linhas_saldavel posições atingem massa_critica (cx).

alter table public.modelo_produto_compra
  add column if not exists min_linhas_saldavel integer not null default 9;

comment on column public.modelo_produto_compra.massa_critica is 'Limiar em cx — abaixo perde poder de conversão real';
comment on column public.modelo_produto_compra.meta_vagas is 'Teto de posições (opções) no portfolio';
comment on column public.modelo_produto_compra.min_linhas_saldavel is 'Mín. posições com massa crítica para considerar saldável';
