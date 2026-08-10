-- 040_linha_produto_compra_grade.sql
-- Camada de compra: LINHA + PRODUTO_COMPRA + grades de eixo (A×B).
-- SKU descrição = produto_compra + eixos; hierarquia h1-h5 permanece legado.

create table if not exists public.linha_compra (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  tipo text not null check (tipo in ('solo', 'linha_mix', 'portfolio')),
  eixo_a_rotulo text,
  eixo_b_rotulo text,
  meta_cobertura_pct numeric,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.produto_compra (
  id uuid primary key default gen_random_uuid(),
  linha_id uuid not null references public.linha_compra(id) on delete restrict,
  codigo text not null,
  nome text not null,
  eixo_a_rotulo text,
  eixo_b_rotulo text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (linha_id, codigo)
);

create index if not exists idx_produto_compra_linha on public.produto_compra(linha_id);

create table if not exists public.eixo_valor (
  id uuid primary key default gen_random_uuid(),
  linha_id uuid references public.linha_compra(id) on delete cascade,
  produto_compra_id uuid references public.produto_compra(id) on delete cascade,
  eixo text not null check (eixo in ('A', 'B')),
  codigo text not null,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint eixo_valor_scope_check check (linha_id is not null or produto_compra_id is not null)
);

create unique index if not exists uq_eixo_valor_linha
  on public.eixo_valor (linha_id, eixo, codigo)
  where produto_compra_id is null and linha_id is not null;

create unique index if not exists uq_eixo_valor_produto
  on public.eixo_valor (produto_compra_id, eixo, codigo)
  where produto_compra_id is not null;

create index if not exists idx_eixo_valor_linha on public.eixo_valor(linha_id);
create index if not exists idx_eixo_valor_produto on public.eixo_valor(produto_compra_id);

alter table public.produto add column if not exists linha_compra_id uuid references public.linha_compra(id);
alter table public.produto add column if not exists produto_compra_id uuid references public.produto_compra(id);
alter table public.produto add column if not exists eixo_a_valor_id uuid references public.eixo_valor(id);
alter table public.produto add column if not exists eixo_b_valor_id uuid references public.eixo_valor(id);
alter table public.produto add column if not exists eixo_a_texto text;
alter table public.produto add column if not exists eixo_b_texto text;
alter table public.produto add column if not exists no_mix_ativo boolean not null default false;
alter table public.produto add column if not exists celula_obrigatoria boolean not null default false;

create index if not exists idx_produto_linha_compra on public.produto(linha_compra_id);
create index if not exists idx_produto_produto_compra on public.produto(produto_compra_id);

create or replace function public.montar_descricao_sku_grade(
  p_produto_compra_nome text,
  p_eixo_a text,
  p_eixo_b text,
  p_marca text default null
)
returns text
language sql
immutable
as $$
  select trim(both from concat_ws(' ',
    nullif(trim(p_produto_compra_nome), ''),
    nullif(trim(p_eixo_a), ''),
    nullif(trim(p_eixo_b), ''),
    nullif(trim(p_marca), '')
  ));
$$;

grant select on public.linha_compra to anon, authenticated, service_role;
grant select on public.produto_compra to anon, authenticated, service_role;
grant select on public.eixo_valor to anon, authenticated, service_role;

grant insert, update, delete on public.linha_compra to service_role;
grant insert, update, delete on public.produto_compra to service_role;
grant insert, update, delete on public.eixo_valor to service_role;

grant insert, update on public.linha_compra to authenticated;
grant insert, update on public.produto_compra to authenticated;
grant insert, update on public.eixo_valor to authenticated;
