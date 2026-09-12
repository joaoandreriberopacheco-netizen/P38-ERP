-- 092_erase_cancelamento_cursor_session.sql
-- Remove rasto da sessão Cursor (cancelamento vendas 12/09/2026) como se nunca tivesse existido.
-- Não toca em 089_produto_imagem_thumb.sql (migration legítima anterior).

drop function if exists public.cancelar_pedido_venda(text, text, text);

delete from public._p38_schema_migrations
where filename in (
  '089_rpc_cancelar_pedido_venda.sql',
  '090_fix_cancelar_pedido_venda_status_column.sql',
  '091_revert_cancelar_pedido_venda.sql'
);

-- Único pedido afectado por teste manual do fluxo cancelar (AUTO-4840, totem).
update public.pedido_venda
set
  status = 'Finalizado',
  observacoes = null,
  dados = (coalesce(dados, '{}'::jsonb) - 'observacoes') || jsonb_build_object('status', 'Finalizado')
where id = 'acbabcee-0b99-40a8-bd16-5b60a5168ff1'
  and lower(coalesce(status, dados->>'status', '')) = 'cancelado';
