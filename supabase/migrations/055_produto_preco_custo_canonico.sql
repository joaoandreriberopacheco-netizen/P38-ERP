-- Custo unitário fator-1 canónico (mesma regra de calcPrecoCustoFromComponents no app).
-- Mantém public.produto.preco_custo_calculado sincronizado para relatórios, dashboards e SQL.

create or replace function public.p38_parse_numeric_text(p_raw text)
returns numeric
language sql
immutable
as $$
  select coalesce(
    nullif(regexp_replace(coalesce(p_raw, ''), '[^0-9.,-]', '', 'g'), '')::numeric,
    0
  );
$$;

comment on function public.p38_parse_numeric_text(text) is
  'Converte texto numérico (ex.: desconto_compra_padrao) para numeric; alinhado ao normalizeNumber do app.';

create or replace function public.p38_calc_preco_custo_fator1(
  p_valor_compra numeric,
  p_custo_frete numeric,
  p_custo_imposto1 numeric,
  p_custo_imposto2 numeric,
  p_custo_outros numeric,
  p_avaria_percentual numeric,
  p_desconto_compra text
)
returns numeric
language sql
immutable
as $$
  select round(
    (
      coalesce(p_valor_compra, 0)
      + coalesce(p_custo_frete, 0)
      + coalesce(p_custo_imposto1, 0)
      + coalesce(p_custo_imposto2, 0)
      + coalesce(p_custo_outros, 0)
      + case
          when coalesce(p_avaria_percentual, 0) > 0 and coalesce(p_valor_compra, 0) > 0
            then p_valor_compra * p_avaria_percentual / 100.0
          else 0
        end
      - public.p38_parse_numeric_text(p_desconto_compra)
    )::numeric,
    2
  );
$$;

comment on function public.p38_calc_preco_custo_fator1(numeric, numeric, numeric, numeric, numeric, numeric, text) is
  'Custo total por unidade base (fator-1): compra + frete + impostos + outros + avaria% − desconto compra.';

create or replace function public.trg_produto_recalc_preco_custo()
returns trigger
language plpgsql
as $$
begin
  new.preco_custo_calculado := public.p38_calc_preco_custo_fator1(
    new.valor_compra,
    new.custo_frete_padrao,
    new.custo_imposto1_padrao,
    new.custo_imposto2_padrao,
    new.custo_outros_padrao,
    new.avaria_percentual,
    new.desconto_compra_padrao
  );
  return new;
end;
$$;

drop trigger if exists trg_produto_recalc_preco_custo on public.produto;

create trigger trg_produto_recalc_preco_custo
before insert or update of
  valor_compra,
  custo_frete_padrao,
  custo_imposto1_padrao,
  custo_imposto2_padrao,
  custo_outros_padrao,
  avaria_percentual,
  desconto_compra_padrao
on public.produto
for each row
execute function public.trg_produto_recalc_preco_custo();

-- Backfill: alinha produtos existentes (importações / legado podem divergir).
update public.produto
set preco_custo_calculado = public.p38_calc_preco_custo_fator1(
  valor_compra,
  custo_frete_padrao,
  custo_imposto1_padrao,
  custo_imposto2_padrao,
  custo_outros_padrao,
  avaria_percentual,
  desconto_compra_padrao
);
