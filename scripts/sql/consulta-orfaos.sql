-- Órfãos — conta simples (migration 095)
-- pedido − embarcado, só pedidos que já têm algum item embarcado

-- Detalhe por linha
select
  fornecedor_nome,
  pedido_compra_numero,
  produto_nome,
  unidade_sigla,
  quantidade_pedida,
  quantidade_embarcada,
  saldo_orfa
from public.pedido_compra_orfaos_v
order by fornecedor_nome, pedido_compra_numero;

-- Resumo por pedido
select * from public.pedido_compra_orfaos_resumo_v
order by fornecedor_nome, pedido_compra_numero;

-- Por fornecedor
select
  fornecedor_nome,
  count(distinct pedido_compra_id) as pedidos,
  count(*) as linhas,
  round(sum(saldo_orfa)::numeric, 2) as soma_saldo
from public.pedido_compra_orfaos_v
group by fornecedor_nome
order by soma_saldo desc;
