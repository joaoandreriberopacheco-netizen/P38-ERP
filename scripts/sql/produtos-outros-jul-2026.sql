-- Produtos vendidos em jul/2026 com "Outros Custos" cadastrado (> 0).
-- Colar no SQL Editor do Supabase (projecto zhonvxkkqabfdyehyxpu).

with vendas as (
  select pv.id
  from public.pedido_venda pv
  where public.p38_pedido_venda_sale_date(pv) between '2026-07-01'::date and '2026-07-31'::date
    and coalesce(pv.status, pv.dados->>'status', '') = any(
      array['Financeiro OK', 'Pedido Concluído', 'Em Separação', 'Em Rota de Entrega']
    )
),
vendidos as (
  select
    pvi.produto_id,
    sum(coalesce(pvi.quantidade_base, 0))::numeric as quantidade_base
  from public.pedido_venda_item pvi
  inner join vendas v on v.id = pvi.pedido_venda_id
  where pvi.produto_id is not null
  group by pvi.produto_id
),
detalhe as (
  select
    p.id,
    coalesce(p.codigo_interno, p.dados->>'codigo_interno', '') as codigo,
    coalesce(p.nome, p.dados->>'nome', '') as nome,
    coalesce(p.campo_hierarquico_1, p.dados->>'campo_hierarquico_1', 'Outros') as linha,
    coalesce(p.custo_outros_padrao, (p.dados->>'custo_outros_padrao')::numeric, 0) as outros_unit,
    vd.quantidade_base,
    round(
      coalesce(p.custo_outros_padrao, (p.dados->>'custo_outros_padrao')::numeric, 0) * vd.quantidade_base,
      2
    ) as outros_total
  from vendidos vd
  inner join public.produto p on p.id = vd.produto_id
)
select
  (select count(*) from vendidos) as produtos_vendidos_total,
  (select count(*) from detalhe where outros_unit > 0) as produtos_com_outros_cadastrado,
  round((select coalesce(sum(outros_total), 0) from detalhe where outros_unit > 0), 2) as soma_outros_periodo;

-- Lista completa (descomente para ver nomes):
-- select codigo, nome, linha, outros_unit, quantidade_base, outros_total
-- from detalhe
-- where outros_unit > 0
-- order by outros_total desc, nome;
