-- 091_revert_cancelar_pedido_venda.sql
-- Remove RPC do fluxo "Cancelar venda" (revert do agente bc-49d8e560).
-- Mantém colunas promovidas em 090 (status, numero, etc.) — só desactiva a operação.

drop function if exists public.cancelar_pedido_venda(text, text, text);
