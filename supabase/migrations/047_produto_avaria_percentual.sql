-- Promove avaria_percentual (provisão de custo % sobre valor de compra) em produto.

alter table public.produto add column if not exists avaria_percentual numeric;

update public.produto
set avaria_percentual = coalesce(
  avaria_percentual,
  case
    when dados->>'avaria_percentual' ~ '^-?[0-9]' then (dados->>'avaria_percentual')::numeric
    else null
  end
)
where dados is not null and dados <> '{}'::jsonb;

update public.produto
set dados = dados - array['avaria_percentual']
where dados is not null
  and dados ? 'avaria_percentual'
  and avaria_percentual is not null;
