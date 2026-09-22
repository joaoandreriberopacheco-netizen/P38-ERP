-- Órfãos — view pedido_compra_orfaos_v (migration 098)
-- Ver docs/compras-saldo-a-embarcar-plano.md § órfãos

-- Detalhe HHW-5NP (exemplo)
select produto_nome, quantidade_pedida, quantidade_desmembrada,
       quantidade_embarcada, quantidade_recebida, saldo_orfa
from public.pedido_compra_orfaos_v
where pedido_compra_numero = 'HHW-5NP';

-- Por fornecedor
select fornecedor_nome, pedido_compra_numero, produto_nome, saldo_orfa
from public.pedido_compra_orfaos_v
order by fornecedor_nome, pedido_compra_numero;

-- Resumo por pedido
select * from public.pedido_compra_orfaos_resumo_v
order by fornecedor_nome, pedido_compra_numero;
