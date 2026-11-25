-- Despesas rateadas no pedido de compra (ex.: frete fornecedor) — array JSON no cabeçalho.

alter table public.pedido_compra
  add column if not exists despesas_rateadas jsonb not null default '[]'::jsonb;

comment on column public.pedido_compra.despesas_rateadas is
  'Lista de despesas adicionais rateadas nos itens: [{ id, descricao, valor }].';

update public.pedido_compra
set despesas_rateadas = coalesce(dados->'despesas_rateadas', '[]'::jsonb)
where dados is not null
  and dados ? 'despesas_rateadas'
  and (despesas_rateadas is null or despesas_rateadas = '[]'::jsonb);

update public.pedido_compra
set dados = dados - 'despesas_rateadas'
where dados is not null
  and dados ? 'despesas_rateadas';