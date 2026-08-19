-- Corrige embarque E62-67G-02 (60×120): quantidades informadas em CX estavam gravadas como M².
-- Aplicado manualmente em produção via scripts/fix-embarque-e62-67g-dados.mjs (2026-08-19).

update public.embarque_item
set
  unidade_sigla = 'CX',
  quantidade_embarcada_comercial = 15,
  quantidade_recebida_comercial = 0,
  dados = jsonb_build_object(
    'fator_aplicado', 2.16,
    'produto_unidade_id', 'alt-1vx8vgq',
    'quantidade_pedida_base', 43.2,
    'quantidade_embarcada_base', 32.4,
    'quantidade_recebida_base', 0
  ),
  updated_at = now()
where id = '8cc1c96b-da36-4e00-a0d6-dc73fd80c727'
  and embarque_id = '936ef1af-54e8-4fb9-896a-8758a9cc7796';

update public.embarque_item
set
  unidade_sigla = 'CX',
  quantidade_embarcada_comercial = 13,
  quantidade_recebida_comercial = 0,
  dados = jsonb_build_object(
    'fator_aplicado', 2.16,
    'produto_unidade_id', 'alt-1vx8vgq',
    'quantidade_pedida_base', 43.2,
    'quantidade_embarcada_base', 28.08,
    'quantidade_recebida_base', 0
  ),
  updated_at = now()
where id = '7eb457b0-02e5-4482-b9ff-c4b8c863aa61'
  and embarque_id = '936ef1af-54e8-4fb9-896a-8758a9cc7796';

update public.embarque_item
set
  unidade_sigla = 'CX',
  quantidade_embarcada_comercial = 13,
  quantidade_recebida_comercial = 0,
  dados = jsonb_build_object(
    'fator_aplicado', 2.16,
    'produto_unidade_id', '3006748e-6610-4f25-90fc-2d16c02e3324',
    'quantidade_pedida_base', 43.2,
    'quantidade_embarcada_base', 28.08,
    'quantidade_recebida_base', 0
  ),
  updated_at = now()
where id = '928a84e0-8bda-4756-a8e2-842e67f4bcc2'
  and embarque_id = '936ef1af-54e8-4fb9-896a-8758a9cc7796';

update public.embarque
set
  status_recebimento = 'Pendente',
  updated_at = now()
where id = '936ef1af-54e8-4fb9-896a-8758a9cc7796'
  and pedido_compra_id = '6a5ac9a29a91e583714ef6ca';
