-- Consultas prontas — saldo a embarcar (migration 094)
-- Supabase SQL Editor ou psql com DATABASE_URL

-- 1) Linhas com falta operacional (detalhe)
select
  pedido_compra_numero,
  fornecedor_nome,
  produto_nome,
  unidade_sigla,
  falta_operacional,
  quantidade_em_transito,
  saldo_pos_recepcao,
  diagnostico
from public.pedido_compra_saldo_a_embarcar_v
where falta_operacional > 0.009
order by fornecedor_nome, pedido_compra_numero;

-- 2) Resumo por pedido
select *
from public.pedido_compra_saldo_resumo_v
where soma_falta_operacional > 0.009
order by fornecedor_nome, pedido_compra_numero;

-- 3) Agregado por fornecedor (KPI global)
select
  fornecedor_nome,
  count(distinct pedido_compra_id) as pedidos_com_falta,
  count(*) as linhas_com_falta,
  round(sum(falta_operacional)::numeric, 2) as soma_falta_operacional,
  round(sum(quantidade_em_transito)::numeric, 2) as soma_em_transito
from public.pedido_compra_saldo_a_embarcar_v
where falta_operacional > 0.009
  and pedido_status is distinct from 'Concluído'
group by fornecedor_nome
order by soma_falta_operacional desc;

-- 4) Tintão — controlo operacional
select
  pedido_compra_numero,
  produto_nome,
  unidade_sigla,
  falta_operacional,
  diagnostico
from public.pedido_compra_saldo_a_embarcar_v
where fornecedor_nome ilike '%tint%'
  and falta_operacional > 0.009
order by pedido_compra_numero, produto_nome;
