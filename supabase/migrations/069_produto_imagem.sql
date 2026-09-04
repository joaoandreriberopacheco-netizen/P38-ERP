-- 069_produto_imagem.sql
-- Galeria de imagens por produto (principal = cerâmica solitária; demais = ambiente, piso, faces…).

create table if not exists public.produto_imagem (
  id uuid primary key default gen_random_uuid(),
  produto_id text not null references public.produto(id) on delete cascade,
  url text not null,
  tipo text not null default 'principal'
    check (tipo in ('principal', 'ambiente', 'piso', 'face', 'outro')),
  ordem integer not null default 0,
  principal boolean not null default false,
  fonte text not null default 'manual'
    check (fonte in ('formigres', 'manual', 'upload', 'import')),
  fonte_ref text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_produto_imagem_produto_url
  on public.produto_imagem (produto_id, url);

create unique index if not exists uq_produto_imagem_principal
  on public.produto_imagem (produto_id)
  where principal = true and ativo = true;

create index if not exists idx_produto_imagem_produto
  on public.produto_imagem (produto_id, ordem)
  where ativo = true;

comment on table public.produto_imagem is
  'Galeria de imagens do produto. principal=true → cerâmica solitária (espelha produto.imagem_url).';
comment on column public.produto_imagem.fonte_ref is
  'Referência externa (ex.: id do produto no site Formigres).';

alter table public.produto_imagem disable row level security;
grant select, insert, update, delete on public.produto_imagem to anon, authenticated;
