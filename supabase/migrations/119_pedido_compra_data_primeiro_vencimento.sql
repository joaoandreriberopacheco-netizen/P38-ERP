-- Primeiro vencimento / data de pagamento do pedido de compra (opcional no formulário).
-- Estava em entityColumnManifest mas sem coluna física → PostgREST "schema cache".

alter table public.pedido_compra
  add column if not exists data_primeiro_vencimento date;

comment on column public.pedido_compra.data_primeiro_vencimento is
  'Data do primeiro vencimento (parcelado) ou pagamento (à vista). Opcional até envio ao financeiro.';

update public.pedido_compra
set data_primeiro_vencimento = case
  when dados->>'data_primeiro_vencimento' ~ '^\d{4}-\d{2}-\d{2}' then left(dados->>'data_primeiro_vencimento', 10)::date
  else data_primeiro_vencimento
end
where dados is not null
  and dados ? 'data_primeiro_vencimento'
  and data_primeiro_vencimento is null;

update public.pedido_compra
set dados = dados - 'data_primeiro_vencimento'
where dados is not null
  and dados ? 'data_primeiro_vencimento'
  and data_primeiro_vencimento is not null;