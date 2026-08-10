-- Backfill PedidoVendaItem a partir de JSON legado (itens / dados->itens).
-- Idempotente: só insere quando o pedido ainda não tem linhas SQL.

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
  preco_final_unitario_fator1,
  total,
  custo_unitario_momento,
  ordem,
  created_at,
  updated_at,
  created_by
)
select
  pv.id || '_b' || (t.ord - 1)::text,
  pv.id,
  coalesce(pv.numero, pv.dados->>'numero'),
  nullif(item->>'produto_id', ''),
  item->>'produto_nome',
  nullif(item->>'produto_unidade_id', ''),
  coalesce(
    nullif(item->>'unidade_medida', ''),
    nullif(item->>'unidade_apresentacao', ''),
    'UN'
  ),
  coalesce(nullif(item->>'fator_conversao', '')::numeric, 1),
  coalesce(nullif(item->>'quantidade', '')::numeric, 0),
  coalesce(
    nullif(item->>'quantidade_base', '')::numeric,
    coalesce(nullif(item->>'quantidade', '')::numeric, 0)
      * coalesce(nullif(item->>'fator_conversao', '')::numeric, 1)
  ),
  coalesce(nullif(item->>'preco_unitario_praticado', '')::numeric, 0),
  coalesce(
    nullif(item->>'preco_unitario_apresentacao', '')::numeric,
    coalesce(nullif(item->>'preco_unitario_praticado', '')::numeric, 0)
      * coalesce(nullif(item->>'fator_conversao', '')::numeric, 1)
  ),
  coalesce(nullif(item->>'desconto_unitario', '')::numeric, 0),
  greatest(
    0,
    coalesce(nullif(item->>'preco_unitario_praticado', '')::numeric, 0)
      - coalesce(nullif(item->>'desconto_unitario', '')::numeric, 0)
  ),
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
  and not exists (
    select 1 from public.pedido_venda_item pvi where pvi.pedido_venda_id = pv.id
  )
  and nullif(item->>'produto_id', '') is not null
on conflict (id) do nothing;
