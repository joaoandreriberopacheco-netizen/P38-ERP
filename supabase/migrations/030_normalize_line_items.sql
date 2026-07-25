-- 030_normalize_line_items.sql
-- Fase 2: extrai arrays JSONB (itens) para tabelas filhas estruturadas.
-- Mantém o array JSONB no pai como espelho legado (sem apagar).

-- ---------------------------------------------------------------------------
-- pedido_venda_item — adiciona colunas estruturadas à tabela existente
-- ---------------------------------------------------------------------------
alter table public.pedido_venda_item add column if not exists pedido_venda_id text;
alter table public.pedido_venda_item add column if not exists pedido_venda_numero text;
alter table public.pedido_venda_item add column if not exists produto_id text;
alter table public.pedido_venda_item add column if not exists produto_nome text;
alter table public.pedido_venda_item add column if not exists produto_unidade_id text;
alter table public.pedido_venda_item add column if not exists unidade_sigla text default 'UN';
alter table public.pedido_venda_item add column if not exists fator_aplicado numeric(18,6) default 1;
alter table public.pedido_venda_item add column if not exists quantidade_comercial numeric(18,6) not null default 0;
alter table public.pedido_venda_item add column if not exists quantidade_base numeric(18,6) not null default 0;
alter table public.pedido_venda_item add column if not exists preco_unitario_fator1 numeric(18,6) default 0;
alter table public.pedido_venda_item add column if not exists preco_unitario_comercial numeric(18,6) default 0;
alter table public.pedido_venda_item add column if not exists desconto_unitario_fator1 numeric(18,6) default 0;
alter table public.pedido_venda_item add column if not exists preco_final_unitario_fator1 numeric(18,6) default 0;
alter table public.pedido_venda_item add column if not exists custo_unitario_momento numeric(18,6) default 0;
alter table public.pedido_venda_item add column if not exists total numeric(18,6) default 0;
alter table public.pedido_venda_item add column if not exists ordem integer not null default 0;
alter table public.pedido_venda_item add column if not exists observacoes text;

create index if not exists idx_pedido_venda_item_pedido on public.pedido_venda_item (pedido_venda_id);
create index if not exists idx_pedido_venda_item_produto on public.pedido_venda_item (produto_id);

-- Backfill a partir de pedido_venda.itens (ou dados->itens como fallback)
insert into public.pedido_venda_item (
  id,
  pedido_venda_id,
  pedido_venda_numero,
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
  total,
  custo_unitario_momento,
  ordem,
  created_at,
  updated_at,
  created_by
)
select
  pv.id || '_i' || (t.ord - 1)::text,
  pv.id,
  coalesce(pv.numero, pv.dados->>'numero'),
  nullif(item->>'produto_id', ''),
  item->>'produto_nome',
  nullif(item->>'produto_unidade_id', ''),
  coalesce(nullif(item->>'unidade_medida', ''), 'UN'),
  coalesce(nullif(item->>'fator_conversao', '')::numeric, 1),
  coalesce(nullif(item->>'quantidade', '')::numeric, 0),
  coalesce(nullif(item->>'quantidade_base', '')::numeric, 0),
  coalesce(nullif(item->>'preco_unitario_praticado', '')::numeric, 0),
  coalesce(nullif(item->>'preco_unitario_apresentacao', '')::numeric, 0),
  coalesce(nullif(item->>'desconto_unitario', '')::numeric, 0),
  coalesce(nullif(item->>'total', '')::numeric, 0),
  coalesce(nullif(item->>'custo_unitario_momento', '')::numeric, 0),
  (t.ord - 1)::integer,
  coalesce(pv.created_at, now()),
  coalesce(pv.updated_at, now()),
  pv.created_by
from public.pedido_venda pv
cross join lateral jsonb_array_elements(
  case
    when pv.itens is not null and jsonb_array_length(pv.itens) > 0 then pv.itens
    when pv.dados ? 'itens' and jsonb_array_length(pv.dados->'itens') > 0 then pv.dados->'itens'
    else '[]'::jsonb
  end
) with ordinality as t(item, ord)
where jsonb_array_length(
  case
    when pv.itens is not null and jsonb_array_length(pv.itens) > 0 then pv.itens
    when pv.dados ? 'itens' and jsonb_array_length(pv.dados->'itens') > 0 then pv.dados->'itens'
    else '[]'::jsonb
  end
) > 0
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- pedido_compra_item
-- ---------------------------------------------------------------------------
create table if not exists public.pedido_compra_item (
  id text primary key,
  pedido_compra_id text not null,
  pedido_compra_numero text,
  produto_id text,
  produto_nome text,
  produto_unidade_id text,
  unidade_sigla text default 'UN',
  fator_aplicado numeric(18,6) default 1,
  quantidade_comercial numeric(18,6) not null default 0,
  quantidade_base numeric(18,6) not null default 0,
  quantidade_vinculada numeric(18,6) default 0,
  custo_unitario_fator1 numeric(18,6) default 0,
  custo_total_unitario_fator1 numeric(18,6) default 0,
  total numeric(18,6) default 0,
  ordem integer not null default 0,
  observacoes text,
  dados jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pedido_compra_item_pedido on public.pedido_compra_item (pedido_compra_id);
create index if not exists idx_pedido_compra_item_produto on public.pedido_compra_item (produto_id);

insert into public.pedido_compra_item (
  id,
  pedido_compra_id,
  pedido_compra_numero,
  produto_id,
  produto_nome,
  unidade_sigla,
  fator_aplicado,
  quantidade_comercial,
  quantidade_base,
  quantidade_vinculada,
  custo_unitario_fator1,
  custo_total_unitario_fator1,
  total,
  ordem,
  created_at,
  updated_at,
  created_by
)
select
  pc.id || '_i' || (t.ord - 1)::text,
  pc.id,
  coalesce(pc.numero, pc.dados->>'numero'),
  nullif(item->>'produto_id', ''),
  item->>'produto_nome',
  coalesce(nullif(item->>'unidade_medida', ''), 'UN'),
  coalesce(nullif(item->>'fator_conversao', '')::numeric, 1),
  coalesce(nullif(item->>'quantidade', '')::numeric, 0),
  coalesce(nullif(item->>'quantidade_base', '')::numeric, 0),
  coalesce(nullif(item->>'quantidade_vinculada', '')::numeric, 0),
  coalesce(nullif(item->>'custo_unitario', '')::numeric, 0),
  coalesce(nullif(item->>'custo_final_unitario', '')::numeric, 0),
  coalesce(nullif(item->>'total', '')::numeric, 0),
  (t.ord - 1)::integer,
  coalesce(pc.created_at, now()),
  coalesce(pc.updated_at, now()),
  pc.created_by
from public.pedido_compra pc
cross join lateral jsonb_array_elements(
  case
    when pc.itens is not null and jsonb_array_length(pc.itens) > 0 then pc.itens
    when pc.dados ? 'itens' and jsonb_array_length(pc.dados->'itens') > 0 then pc.dados->'itens'
    else '[]'::jsonb
  end
) with ordinality as t(item, ord)
where jsonb_array_length(
  case
    when pc.itens is not null and jsonb_array_length(pc.itens) > 0 then pc.itens
    when pc.dados ? 'itens' and jsonb_array_length(pc.dados->'itens') > 0 then pc.dados->'itens'
    else '[]'::jsonb
  end
) > 0
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- embarque_item
-- ---------------------------------------------------------------------------
create table if not exists public.embarque_item (
  id text primary key,
  embarque_id text not null,
  embarque_numero text,
  pedido_compra_id text,
  pedido_compra_item_id text,
  produto_id text,
  produto_nome text,
  unidade_sigla text default 'UN',
  quantidade_pedida_comercial numeric(18,6) default 0,
  quantidade_embarcada_comercial numeric(18,6) default 0,
  quantidade_recebida_comercial numeric(18,6) default 0,
  divergencia_tipo text default 'Nenhuma',
  produto_id_recebido_diferente text,
  produto_nome_recebido_diferente text,
  acordo_financeiro_lancamento_id text,
  ordem integer not null default 0,
  observacoes text,
  dados jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_embarque_item_embarque on public.embarque_item (embarque_id);
create index if not exists idx_embarque_item_produto on public.embarque_item (produto_id);

insert into public.embarque_item (
  id,
  embarque_id,
  embarque_numero,
  pedido_compra_id,
  pedido_compra_item_id,
  produto_id,
  produto_nome,
  unidade_sigla,
  quantidade_pedida_comercial,
  quantidade_embarcada_comercial,
  quantidade_recebida_comercial,
  divergencia_tipo,
  produto_id_recebido_diferente,
  produto_nome_recebido_diferente,
  acordo_financeiro_lancamento_id,
  ordem,
  created_at,
  updated_at,
  created_by
)
select
  e.id || '_i' || (t.ord - 1)::text,
  e.id,
  coalesce(e.dados->>'numero', ''),
  coalesce(e.pedido_compra_id, e.dados->>'pedido_compra_id'),
  nullif(item->>'pedido_compra_item_id', ''),
  nullif(item->>'produto_id', ''),
  item->>'produto_nome',
  coalesce(nullif(item->>'unidade_medida', ''), 'UN'),
  coalesce(nullif(item->>'quantidade_pedida', '')::numeric, 0),
  coalesce(nullif(item->>'quantidade_embarcada', '')::numeric, 0),
  coalesce(nullif(item->>'quantidade_recebida', '')::numeric, 0),
  coalesce(nullif(item->>'divergencia_tipo', ''), 'Nenhuma'),
  nullif(item->>'produto_id_recebido_diferente', ''),
  nullif(item->>'produto_nome_recebido_diferente', ''),
  nullif(item->>'acordo_financeiro_lancamento_id', ''),
  (t.ord - 1)::integer,
  coalesce(e.created_at, now()),
  coalesce(e.updated_at, now()),
  e.created_by
from public.embarque e
cross join lateral jsonb_array_elements(
  case
    when e.itens is not null and jsonb_array_length(e.itens) > 0 then e.itens
    when e.dados ? 'itens' and jsonb_array_length(e.dados->'itens') > 0 then e.dados->'itens'
    else '[]'::jsonb
  end
) with ordinality as t(item, ord)
where jsonb_array_length(
  case
    when e.itens is not null and jsonb_array_length(e.itens) > 0 then e.itens
    when e.dados ? 'itens' and jsonb_array_length(e.dados->'itens') > 0 then e.dados->'itens'
    else '[]'::jsonb
  end
) > 0
on conflict (id) do nothing;
