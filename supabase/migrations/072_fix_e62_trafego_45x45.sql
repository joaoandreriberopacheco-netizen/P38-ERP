-- Corrige linha SQL do pedido E62-67G: TRAFEGO BEGE era 45x45 (não 50x50).
-- O JSON legado (pedido_compra.itens) e embarque_item já tinham o produto certo;
-- pedido_compra_item ficou com produto_id 50x50 após backfill, gerando falsa falta de 128 M².

update public.pedido_compra_item
set
  produto_id = '6a5656e6e3ed187bdbdc2d19',
  produto_nome = 'PISO 45X45 TRAFEGO BEGE PEI 5 (2,00M²/ CX)',
  quantidade_comercial = 128,
  quantidade_base = 128,
  custo_unitario_fator1 = 24.43,
  total = 3127.04,
  updated_at = now()
where id = '6a5ac9a29a91e583714ef6ca_i13'
  and pedido_compra_id = '6a5ac9a29a91e583714ef6ca'
  and produto_id = '6a55036bd31d7a107be871f0';

update public.embarque_item
set
  pedido_compra_item_id = '6a5ac9a29a91e583714ef6ca_i13',
  updated_at = now()
where id = '96f764bf-e5a3-46ee-8f18-2cefb468dd53_b16'
  and embarque_id = '96f764bf-e5a3-46ee-8f18-2cefb468dd53'
  and produto_id = '6a5656e6e3ed187bdbdc2d19';
