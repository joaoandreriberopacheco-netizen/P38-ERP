-- Pedido de compra: flag de encomenda (venda antes da recepção).
-- Resumo global de estoque exclui trânsito destes pedidos para não inflar físico+trânsito.

alter table public.pedido_compra
  add column if not exists is_encomenda boolean not null default false;

comment on column public.pedido_compra.is_encomenda is
  'true = compra atrelada a encomenda/cliente; não entra no trânsito do Resumo global de estoque.';

update public.pedido_compra
set is_encomenda = case
  when lower(coalesce(dados->>'is_encomenda', '')) in ('true', '1', 'sim', 'yes') then true
  else false
end
where dados is not null
  and dados ? 'is_encomenda';

update public.pedido_compra
set dados = coalesce(dados, '{}'::jsonb) || jsonb_build_object('is_encomenda', is_encomenda)
where is_encomenda is true;

create index if not exists idx_pedido_compra_is_encomenda
  on public.pedido_compra (is_encomenda)
  where is_encomenda = true;
