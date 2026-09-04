-- 062_modelo_linha_parametros_portfolio.sql
-- Defaults na LINHA; produto_compra sobrescreve quando preenchido (null = herda).

alter table public.modelo_linha
  add column if not exists meta_vagas integer,
  add column if not exists massa_critica numeric,
  add column if not exists min_linhas_saldavel integer;

alter table public.modelo_produto_compra
  alter column meta_vagas drop not null,
  alter column massa_critica drop not null,
  alter column min_linhas_saldavel drop not null;

alter table public.modelo_produto_compra
  alter column min_linhas_saldavel drop default;

comment on column public.modelo_linha.meta_vagas is 'Default de posições — PC null herda';
comment on column public.modelo_linha.massa_critica is 'Default massa crítica (cx) — PC null herda';
comment on column public.modelo_linha.min_linhas_saldavel is 'Default mín. linhas saldável — PC null herda';

-- Cerâmica piloto: preencher LINHAS existentes se ainda vazias
update public.modelo_linha
set
  meta_vagas = coalesce(meta_vagas, 12),
  massa_critica = coalesce(massa_critica, 16),
  min_linhas_saldavel = coalesce(min_linhas_saldavel, 9)
where codigo in ('CERAMICA_BOLD', 'CERAMICA_RETIF');

-- PC passa a herdar da linha (override só quando necessário)
update public.modelo_produto_compra pc
set
  meta_vagas = null,
  massa_critica = null,
  min_linhas_saldavel = null
from public.modelo_linha l
where pc.linha_id = l.id
  and l.codigo in ('CERAMICA_BOLD', 'CERAMICA_RETIF');
