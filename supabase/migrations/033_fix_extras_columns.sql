-- 033_fix_extras_columns.sql
-- A migração 003 ficou registada como aplicada mas as colunas extras não existem
-- na BD P38 (provável corrida com criação tardia das tabelas). Reaplica de forma idempotente.

alter table public.terceiro add column if not exists extras jsonb not null default '{}'::jsonb;
alter table public.produto add column if not exists extras jsonb not null default '{}'::jsonb;
alter table public.formas_de_pagamento add column if not exists extras jsonb not null default '{}'::jsonb;
alter table public.contas_financeiras add column if not exists extras jsonb not null default '{}'::jsonb;
alter table public.turno_caixa add column if not exists extras jsonb not null default '{}'::jsonb;
alter table public.pedido_venda add column if not exists extras jsonb not null default '{}'::jsonb;
alter table public.movimentacao_estoque add column if not exists extras jsonb not null default '{}'::jsonb;
alter table public.lancamento_financeiro add column if not exists extras jsonb not null default '{}'::jsonb;

comment on column public.lancamento_financeiro.extras is 'Overflow JSON (ENTITIES_MANIFEST / RPCs financeiras).';
