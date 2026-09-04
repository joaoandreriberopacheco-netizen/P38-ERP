-- 067_portal_catalog.sql
-- Catálogo auxiliar do Portal Hierarquia (piloto cerâmica).
-- Hierarquia, reserva e import Excel vivem aqui — não alteram public.produto.

create table if not exists public.portal_catalog (
  id uuid primary key default gen_random_uuid(),
  codigo_interno text not null,
  produto_id text,
  categoria_nome text not null default '',
  linha_codigo text not null,
  linha_nome text not null,
  linha_tipo text not null default 'portfolio'
    check (linha_tipo in ('solo', 'mix', 'portfolio')),
  linha_ordem integer not null default 10,
  produto_compra_codigo text,
  produto_compra_nome text,
  eixo_a_texto text not null default '',
  eixo_b_texto text not null default '',
  novo_sku text not null default '',
  reserva_portal boolean not null default false,
  fonte text not null default 'excel'
    check (fonte in ('excel', 'manual', 'cadastro_v2', 'manifest')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_portal_catalog_codigo
  on public.portal_catalog (codigo_interno)
  where ativo = true;

create index if not exists idx_portal_catalog_linha
  on public.portal_catalog (linha_codigo, produto_compra_codigo);

create index if not exists idx_portal_catalog_reserva
  on public.portal_catalog (reserva_portal)
  where reserva_portal = true;

comment on table public.portal_catalog is
  'Catálogo auxiliar do Portal Hierarquia — SKUs piloto (cerâmica). Leitura de produto só para estoque/preço; escrita isolada.';
comment on column public.portal_catalog.produto_id is
  'Referência opcional read-only ao SKU real (produto.id).';
comment on column public.portal_catalog.reserva_portal is
  'Oculta SKU no portal/PDV piloto sem inactivar public.produto.';

alter table public.portal_catalog disable row level security;
grant select, insert, update, delete on public.portal_catalog to anon, authenticated;
