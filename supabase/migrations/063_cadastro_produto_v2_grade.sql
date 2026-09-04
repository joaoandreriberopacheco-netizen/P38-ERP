-- 063_cadastro_produto_v2_grade.sql
-- Grade de cadastro v2: lê SKUs reais (produto) para hidratar; grava aqui, sem misturar produção.

create table if not exists public.cadastro_v2_grade_sku (
  id uuid primary key default gen_random_uuid(),
  linha_id uuid not null references public.modelo_linha(id) on delete restrict,
  produto_compra_id uuid references public.modelo_produto_compra(id) on delete set null,
  linha_codigo text not null,
  produto_compra_codigo text,
  produto_producao_id text,
  eixo_a_texto text not null default '',
  eixo_b_texto text not null default '',
  novo_sku text not null,
  codigo_interno text,
  marca text,
  valor_compra numeric not null default 0,
  preco_venda numeric not null default 0,
  estoque_atual numeric not null default 0,
  estoque_minimo numeric not null default 0,
  hydrated_at timestamptz,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cadastro_v2_grade_linha on public.cadastro_v2_grade_sku(linha_id);
create index if not exists idx_cadastro_v2_grade_pc on public.cadastro_v2_grade_sku(produto_compra_id);
create index if not exists idx_cadastro_v2_grade_producao on public.cadastro_v2_grade_sku(produto_producao_id);

create unique index if not exists uq_cadastro_v2_grade_pc_eixos
  on public.cadastro_v2_grade_sku (linha_id, produto_compra_id, eixo_a_texto, eixo_b_texto)
  where produto_compra_id is not null and ativo = true;

create unique index if not exists uq_cadastro_v2_grade_solo_eixos
  on public.cadastro_v2_grade_sku (linha_id, eixo_a_texto, eixo_b_texto)
  where produto_compra_id is null and ativo = true;

comment on table public.cadastro_v2_grade_sku is
  'Cadastro produto v2 — grade editável; hidrata de public.produto (leitura); não escreve em produção.';
comment on column public.cadastro_v2_grade_sku.produto_producao_id is
  'Referência read-only ao SKU real (produto.id) usado na última hidratação.';

alter table public.cadastro_v2_grade_sku disable row level security;
grant select, insert, update, delete on public.cadastro_v2_grade_sku to anon, authenticated;
