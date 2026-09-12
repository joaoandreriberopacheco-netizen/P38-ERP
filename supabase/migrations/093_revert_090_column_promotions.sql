-- 093_revert_090_column_promotions.sql
-- Desfaz efeitos da 090_fix_cancelar_pedido_venda_status_column (sessão Cursor cancelamento).
-- Não remove colunas core de pedido_venda/lancamento_financeiro (existiam antes da 090).

-- Evita re-disparar triggers de dashboard/anotações durante UPDATE em massa.
alter table public.pedido_venda disable trigger trg_pedido_venda_celulas_dirty;

-- Reverte backfill: coluna só preenchida a partir de dados (coalesce da 090).
update public.pedido_venda
set status = null
where dados is not null
  and dados <> '{}'::jsonb
  and nullif(trim(dados->>'status'), '') is not null
  and status is not distinct from dados->>'status';

update public.pedido_venda
set numero = null
where dados is not null
  and dados <> '{}'::jsonb
  and nullif(trim(dados->>'numero'), '') is not null
  and numero is not distinct from dados->>'numero';

update public.pedido_venda
set observacoes = null
where dados is not null
  and dados <> '{}'::jsonb
  and nullif(trim(dados->>'observacoes'), '') is not null
  and observacoes is not distinct from dados->>'observacoes';

update public.pedido_venda
set pagamentos = null
where dados is not null
  and dados <> '{}'::jsonb
  and dados ? 'pagamentos'
  and pagamentos is not distinct from coalesce(dados->'pagamentos', '[]'::jsonb);

alter table public.pedido_venda enable trigger trg_pedido_venda_celulas_dirty;

-- Logística: 090 promoveu status/pedido_venda_id; app usa dados + pedido_venda_id (manifest).
update public.agenda_logistica
set
  pedido_venda_id = null,
  status = null
where dados is not null
  and dados <> '{}'::jsonb
  and pedido_venda_id is not distinct from dados->>'pedido_venda_id'
  and status is not distinct from dados->>'status';

update public.ordem_separacao
set
  pedido_venda_id = null,
  status = null
where dados is not null
  and dados <> '{}'::jsonb
  and pedido_venda_id is not distinct from dados->>'pedido_venda_id'
  and status is not distinct from dados->>'status';

update public.protocolo_entrega
set
  pedido_venda_id = null,
  status = null
where dados is not null
  and dados <> '{}'::jsonb
  and pedido_venda_id is not distinct from dados->>'pedido_venda_id'
  and status is not distinct from dados->>'status';

-- Colunas que a 090 forçou em tabelas JSONB-first (não estão no manifest de colunas dedicadas).
alter table public.ordem_separacao drop column if exists status;
alter table public.protocolo_entrega drop column if exists status;

-- agenda_logistica já tinha pedido_venda_id/status na 002; a 090 acrescentou dados jsonb.
alter table public.agenda_logistica drop column if exists dados;
