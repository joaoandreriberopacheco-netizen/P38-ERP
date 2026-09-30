-- Pedido de compra: linhas canónicas em pedido_compra_item (não pedido_compra.itens JSON).

COMMENT ON COLUMN public.pedido_compra.itens IS
  'Legado/espelho opcional. Fonte canónica de linhas: public.pedido_compra_item. '
  'Leituras de negócio (logística, financeiro, relatórios) devem hidratar a partir de pedido_compra_item.';

CREATE INDEX IF NOT EXISTS idx_pedido_compra_item_pedido_compra_id
  ON public.pedido_compra_item (pedido_compra_id);
