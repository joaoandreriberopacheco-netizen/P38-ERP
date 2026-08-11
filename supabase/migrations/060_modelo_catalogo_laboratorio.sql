-- 060_modelo_catalogo_laboratorio.sql
-- Laboratório catálogo modelo (universo paralelo — NÃO substitui public.produto).
-- Pode referenciar produto (espelho read-only); nunca altera produção via triggers.

create table if not exists public.modelo_linha (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  categoria_nome text not null default '',
  tipo text not null check (tipo in ('solo', 'linha_mix', 'portfolio')),
  eixo_a_rotulo text,
  eixo_b_rotulo text,
  ordem integer not null default 0,
  ativo boolean not null default true,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.modelo_produto_compra (
  id uuid primary key default gen_random_uuid(),
  linha_id uuid not null references public.modelo_linha(id) on delete restrict,
  codigo text not null,
  nome text not null,
  meta_vagas integer,
  massa_critica numeric,
  eixo_a_rotulo text,
  eixo_b_rotulo text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (linha_id, codigo)
);

create index if not exists idx_modelo_produto_compra_linha on public.modelo_produto_compra(linha_id);

create table if not exists public.modelo_eixo_valor (
  id uuid primary key default gen_random_uuid(),
  linha_id uuid references public.modelo_linha(id) on delete cascade,
  produto_compra_id uuid references public.modelo_produto_compra(id) on delete cascade,
  eixo text not null check (eixo in ('A', 'B')),
  codigo text not null,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint modelo_eixo_valor_scope_check check (linha_id is not null or produto_compra_id is not null)
);

create unique index if not exists uq_modelo_eixo_linha
  on public.modelo_eixo_valor (linha_id, eixo, codigo)
  where produto_compra_id is null and linha_id is not null;

create unique index if not exists uq_modelo_eixo_produto
  on public.modelo_eixo_valor (produto_compra_id, eixo, codigo)
  where produto_compra_id is not null;

create table if not exists public.modelo_sku (
  id uuid primary key default gen_random_uuid(),
  linha_id uuid not null references public.modelo_linha(id) on delete restrict,
  produto_compra_id uuid references public.modelo_produto_compra(id) on delete set null,
  eixo_a_texto text,
  eixo_b_texto text,
  eixo_a_valor_id uuid references public.modelo_eixo_valor(id) on delete set null,
  eixo_b_valor_id uuid references public.modelo_eixo_valor(id) on delete set null,
  nome text not null,
  codigo_interno text,
  marca text,
  estoque_simulado numeric not null default 0,
  estoque_minimo_simulado numeric not null default 0,
  espelho_produto_id text,
  espelho_codigo_interno text,
  dados jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_modelo_sku_linha on public.modelo_sku(linha_id);
create index if not exists idx_modelo_sku_produto_compra on public.modelo_sku(produto_compra_id);
create index if not exists idx_modelo_sku_espelho on public.modelo_sku(espelho_produto_id);

create or replace function public.montar_nome_modelo_sku(
  p_produto_compra_nome text,
  p_eixo_a text,
  p_eixo_b text,
  p_marca text default null
) returns text
language sql immutable
as $$
  select trim(both from concat_ws(' ',
    nullif(trim(p_produto_compra_nome), ''),
    nullif(trim(p_eixo_a), ''),
    nullif(trim(p_eixo_b), ''),
    nullif(trim(p_marca), '')
  ));
$$;

comment on table public.modelo_linha is 'Laboratório: LINHA (solo/mix/portfolio) — universo paralelo';
comment on table public.modelo_produto_compra is 'Laboratório: produto compra (≈ h1 futuro); meta_vagas + massa_critica para portfolio';
comment on table public.modelo_sku is 'Laboratório: SKU modelo; espelho_produto_id lê produção sem sync automático';

comment on column public.modelo_sku.espelho_produto_id is 'ID texto do produto produção (read-only; sem FK para evitar acoplamento)';

alter table public.modelo_linha disable row level security;
alter table public.modelo_produto_compra disable row level security;
alter table public.modelo_eixo_valor disable row level security;
alter table public.modelo_sku disable row level security;

grant select, insert, update, delete on public.modelo_linha to anon, authenticated;
grant select, insert, update, delete on public.modelo_produto_compra to anon, authenticated;
grant select, insert, update, delete on public.modelo_eixo_valor to anon, authenticated;
grant select, insert, update, delete on public.modelo_sku to anon, authenticated;
