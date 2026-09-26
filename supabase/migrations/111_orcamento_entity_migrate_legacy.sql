-- 111_orcamento_entity_migrate_legacy.sql
-- Entidade própria de orçamento (cabeçalho + itens) e migração do legado em pedido_venda.

-- ---------------------------------------------------------------------------
-- Critério: linha de pedido_venda que era orçamento (antes da migração)
-- ---------------------------------------------------------------------------
create or replace function public.p38_pedido_venda_eh_orcamento_legado(pv public.pedido_venda)
returns boolean
language sql
stable
as $$
  select coalesce((pv.dados->>'migrado_para_orcamento')::boolean, false) is not true
     and (
       public.p38_pedido_venda_tipo(pv) in ('orçamento', 'orcamento')
       or public.p38_pedido_venda_status(pv) in ('orçamento', 'orcamento')
       or coalesce(pv.dados->>'origem', '') = 'orcamento_rapido'
     );
$$;

-- ---------------------------------------------------------------------------
-- Cabeçalho
-- ---------------------------------------------------------------------------
create table if not exists public.orcamento (
  id text primary key,
  numero text,
  cliente_id text references public.terceiro (id) on delete set null,
  cliente_nome text,
  status text not null default 'Aberto',
  subtotal numeric(14, 2) not null default 0,
  valor_desconto numeric(14, 2) not null default 0,
  valor_frete numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  observacoes text,
  tabela_preco_id text,
  vendedor_id text,
  vendedor_nome text,
  legado_pedido_venda_id text unique,
  rascunho_pedido_venda_id text,
  pedido_venda_id text,
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orcamento_created_at on public.orcamento (created_at desc);
create index if not exists idx_orcamento_updated_at on public.orcamento (updated_at desc);
create index if not exists idx_orcamento_numero on public.orcamento (numero);
create index if not exists idx_orcamento_legado_pv on public.orcamento (legado_pedido_venda_id);

-- ---------------------------------------------------------------------------
-- Itens (espelho estruturado de pedido_venda_item)
-- ---------------------------------------------------------------------------
create table if not exists public.orcamento_item (
  id text primary key,
  orcamento_id text not null references public.orcamento (id) on delete cascade,
  orcamento_numero text,
  legado_pedido_venda_item_id text,
  produto_id text,
  produto_nome text,
  produto_unidade_id text,
  unidade_sigla text not null default 'UN',
  fator_aplicado numeric(18, 6) not null default 1,
  quantidade_comercial numeric(18, 6) not null default 0,
  quantidade_base numeric(18, 6) not null default 0,
  preco_unitario_fator1 numeric(18, 6) not null default 0,
  preco_unitario_comercial numeric(18, 6) not null default 0,
  desconto_unitario_fator1 numeric(18, 6) not null default 0,
  preco_final_unitario_fator1 numeric(18, 6) not null default 0,
  custo_unitario_momento numeric(18, 6) not null default 0,
  total numeric(18, 6) not null default 0,
  ordem integer not null default 0,
  observacoes text,
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orcamento_item_orcamento on public.orcamento_item (orcamento_id);
create index if not exists idx_orcamento_item_produto on public.orcamento_item (produto_id);

-- ---------------------------------------------------------------------------
-- Backfill cabeçalhos (id estável = id legado do pedido_venda)
-- ---------------------------------------------------------------------------
insert into public.orcamento (
  id,
  numero,
  cliente_id,
  cliente_nome,
  status,
  subtotal,
  valor_desconto,
  valor_frete,
  total,
  observacoes,
  tabela_preco_id,
  vendedor_id,
  vendedor_nome,
  legado_pedido_venda_id,
  dados,
  created_at,
  updated_at
)
select
  pv.id,
  pv.numero,
  pv.cliente_id,
  coalesce(pv.cliente_nome, pv.dados->>'cliente_nome', ''),
  'Aberto',
  round(coalesce(pv.subtotal, (pv.dados->>'subtotal')::numeric, 0)::numeric, 2),
  round(coalesce(pv.valor_desconto, (pv.dados->>'valor_desconto')::numeric, 0)::numeric, 2),
  round(coalesce(pv.valor_frete, (pv.dados->>'valor_frete')::numeric, 0)::numeric, 2),
  round(coalesce(
    nullif(pv.total, 0),
    nullif((pv.dados->>'valor_total')::numeric, 0),
    pv.total,
    0
  )::numeric, 2),
  coalesce(pv.observacoes, pv.dados->>'observacoes', ''),
  coalesce(pv.tabela_preco_id, pv.dados->>'tabela_preco_id'),
  coalesce(pv.vendedor_id, pv.dados->>'vendedor_id'),
  coalesce(pv.vendedor_nome, pv.dados->>'vendedor_nome', ''),
  pv.id,
  coalesce(pv.dados, '{}'::jsonb)
    || jsonb_build_object(
      'origem', coalesce(pv.dados->>'origem', 'legado_pedido_venda'),
      'migrado_de', 'pedido_venda',
      'migrado_em', to_jsonb(now())
    ),
  coalesce(pv.created_at, now()),
  coalesce(pv.updated_at, now())
from public.pedido_venda pv
where public.p38_pedido_venda_eh_orcamento_legado(pv)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Backfill itens a partir de pedido_venda_item
-- ---------------------------------------------------------------------------
insert into public.orcamento_item (
  id,
  orcamento_id,
  orcamento_numero,
  legado_pedido_venda_item_id,
  produto_id,
  produto_nome,
  produto_unidade_id,
  unidade_sigla,
  fator_aplicado,
  quantidade_comercial,
  quantidade_base,
  preco_unitario_fator1,
  preco_unitario_comercial,
  desconto_unitario_fator1,
  preco_final_unitario_fator1,
  custo_unitario_momento,
  total,
  ordem,
  observacoes,
  dados,
  created_at,
  updated_at
)
select
  pvi.id,
  o.id,
  o.numero,
  pvi.id,
  pvi.produto_id,
  pvi.produto_nome,
  pvi.produto_unidade_id,
  coalesce(nullif(pvi.unidade_sigla, ''), 'UN'),
  coalesce(pvi.fator_aplicado, 1),
  coalesce(pvi.quantidade_comercial, 0),
  coalesce(pvi.quantidade_base, 0),
  coalesce(pvi.preco_unitario_fator1, 0),
  coalesce(pvi.preco_unitario_comercial, 0),
  coalesce(pvi.desconto_unitario_fator1, 0),
  coalesce(pvi.preco_final_unitario_fator1, 0),
  coalesce(pvi.custo_unitario_momento, 0),
  coalesce(pvi.total, 0),
  coalesce(pvi.ordem, 0),
  pvi.observacoes,
  coalesce(pvi.dados, '{}'::jsonb),
  coalesce(pvi.created_at, o.created_at, now()),
  coalesce(pvi.updated_at, o.updated_at, now())
from public.pedido_venda_item pvi
inner join public.orcamento o on o.legado_pedido_venda_id = pvi.pedido_venda_id
where not exists (
  select 1 from public.orcamento_item oi where oi.id = pvi.id
);

-- ---------------------------------------------------------------------------
-- Marca pedido_venda legado como migrado (permanece na tabela só para histórico)
-- ---------------------------------------------------------------------------
update public.pedido_venda pv
set
  dados = coalesce(pv.dados, '{}'::jsonb)
    || jsonb_build_object(
      'migrado_para_orcamento', true,
      'orcamento_id', pv.id,
      'migrado_em', now()
    ),
  updated_at = now()
where public.p38_pedido_venda_eh_orcamento_legado(pv)
  and exists (select 1 from public.orcamento o where o.legado_pedido_venda_id = pv.id);

comment on table public.orcamento is
  'Orçamento comercial (sui generis). Não é pedido de venda nem rascunho PDV.';
comment on table public.orcamento_item is
  'Linhas do orçamento — espelho estruturado de pedido_venda_item para migração.';
