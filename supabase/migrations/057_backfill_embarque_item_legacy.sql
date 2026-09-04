-- Backfill PedidoCompraItem e EmbarqueItem a partir de JSON legado
-- para registos criados após 030 ou que ficaram sem linhas SQL.
-- Idempotente: só insere quando o pai ainda não tem linhas na tabela filha.

-- ── PedidoCompraItem (pedidos sem nenhuma linha SQL) ─────────────────────
insert into public.pedido_compra_item (
  id,
  pedido_compra_id,
  pedido_compra_numero,
  produto_id,
  produto_nome,
  produto_unidade_id,
  unidade_sigla,
  fator_aplicado,
  quantidade_comercial,
  quantidade_base,
  custo_unitario_fator1,
  custo_total_unitario_fator1,
  total,
  ordem,
  created_at,
  updated_at,
  created_by
)
select
  pc.id || '_b' || (t.ord - 1)::text,
  pc.id,
  coalesce(pc.numero, pc.dados->>'numero'),
  nullif(item->>'produto_id', ''),
  item->>'produto_nome',
  nullif(item->>'produto_unidade_id', ''),
  coalesce(nullif(item->>'unidade_medida', ''), nullif(item->>'unidade_apresentacao', ''), 'UN'),
  coalesce(nullif(item->>'fator_conversao', '')::numeric, 1),
  coalesce(nullif(item->>'quantidade', '')::numeric, 0),
  coalesce(
    nullif(item->>'quantidade_base', '')::numeric,
    coalesce(nullif(item->>'quantidade', '')::numeric, 0)
      * coalesce(nullif(item->>'fator_conversao', '')::numeric, 1)
  ),
  coalesce(nullif(item->>'custo_unitario', '')::numeric, 0),
  coalesce(
    nullif(item->>'custo_final_unitario', '')::numeric,
    coalesce(nullif(item->>'custo_unitario', '')::numeric, 0)
  ),
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
  and not exists (
    select 1 from public.pedido_compra_item pci where pci.pedido_compra_id = pc.id
  )
  and nullif(item->>'produto_id', '') is not null
on conflict (id) do nothing;

-- ── EmbarqueItem (embarques sem nenhuma linha SQL) ────────────────────────
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
  e.id || '_b' || (t.ord - 1)::text,
  e.id,
  coalesce(e.numero, e.dados->>'numero', ''),
  coalesce(e.pedido_compra_id, e.dados->>'pedido_compra_id'),
  coalesce(
    nullif(item->>'pedido_compra_item_id', ''),
    (
      select pci.id
      from public.pedido_compra_item pci
      where pci.pedido_compra_id = coalesce(e.pedido_compra_id, e.dados->>'pedido_compra_id')
        and pci.produto_id = nullif(item->>'produto_id', '')
      order by pci.ordem
      limit 1
    )
  ),
  nullif(item->>'produto_id', ''),
  item->>'produto_nome',
  coalesce(nullif(item->>'unidade_medida', ''), nullif(item->>'unidade_apresentacao', ''), 'UN'),
  coalesce(
    nullif(item->>'quantidade_pedida', '')::numeric,
    nullif(item->>'quantidade', '')::numeric,
    0
  ),
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
    when e.dados ? 'itens_embarcados' and jsonb_array_length(e.dados->'itens_embarcados') > 0 then e.dados->'itens_embarcados'
    when e.dados ? 'itens' and jsonb_array_length(e.dados->'itens') > 0 then e.dados->'itens'
    else '[]'::jsonb
  end
) with ordinality as t(item, ord)
where jsonb_array_length(
  case
    when e.itens is not null and jsonb_array_length(e.itens) > 0 then e.itens
    when e.dados ? 'itens_embarcados' and jsonb_array_length(e.dados->'itens_embarcados') > 0 then e.dados->'itens_embarcados'
    when e.dados ? 'itens' and jsonb_array_length(e.dados->'itens') > 0 then e.dados->'itens'
    else '[]'::jsonb
  end
) > 0
  and not exists (
    select 1 from public.embarque_item ei where ei.embarque_id = e.id
  )
  and nullif(item->>'produto_id', '') is not null
on conflict (id) do nothing;
