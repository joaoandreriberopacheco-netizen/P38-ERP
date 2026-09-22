-- Órfãos — view pedido_compra_orfaos_v (migration 099)
-- Ver docs/compras-saldo-a-embarcar-plano.md § órfãos

-- Detalhe HHW-5NP (exemplo: Java = 1 CX, Coliseu = 0)
select produto_nome,
       quantidade_pedida_base,
       quantidade_recebida_base,
       saldo_orfa_base,
       saldo_orfa,
       unidade_vitrine_sigla
from public.pedido_compra_orfaos_v
where pedido_compra_numero = 'HHW-5NP';

-- Por fornecedor
select fornecedor_nome, pedido_compra_numero, produto_nome, saldo_orfa
from public.pedido_compra_orfaos_v
order by fornecedor_nome, pedido_compra_numero;

-- Resumo por pedido
select * from public.pedido_compra_orfaos_resumo_v
order by fornecedor_nome, pedido_compra_numero;
