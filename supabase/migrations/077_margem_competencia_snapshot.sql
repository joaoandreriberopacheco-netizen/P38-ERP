-- 077_margem_competencia_snapshot.sql
-- Snapshot do lucro bruto por competência (base Relatório de Margem).
-- Meses civilmente fechados ficam gravados para Dízimo, Budgets e Visão Financeira.

create table if not exists public.margem_competencia_snapshot (
  competencia text not null primary key check (competencia ~ '^\d{4}-\d{2}$'),
  receita_liquida numeric not null default 0,
  custo_total numeric not null default 0,
  lucro_bruto numeric not null default 0,
  quantidade_produtos integer not null default 0,
  source_version text not null default 'relatorio_margem_v1',
  computed_at timestamptz not null default now()
);

create index if not exists idx_margem_competencia_snapshot_computed
  on public.margem_competencia_snapshot (computed_at desc);

grant select, insert, update, delete on public.margem_competencia_snapshot to anon, authenticated, service_role;
