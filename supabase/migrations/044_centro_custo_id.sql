-- 044_centro_custo_id.sql
-- Promove centro_custo_id (e centro_custo no LF) para colunas dedicadas,
-- alinhado a categoria_id / CategoriaFinanceira.

-- === lancamento_financeiro ===
alter table public.lancamento_financeiro add column if not exists centro_custo text;
alter table public.lancamento_financeiro add column if not exists centro_custo_id text;

update public.lancamento_financeiro set
  centro_custo = case when centro_custo is null then dados->>'centro_custo' else centro_custo end,
  centro_custo_id = case when centro_custo_id is null then dados->>'centro_custo_id' else centro_custo_id end
where dados is not null and dados <> '{}'::jsonb;

update public.lancamento_financeiro
  set dados = dados - array['centro_custo', 'centro_custo_id']
where dados is not null and dados <> '{}'::jsonb
  and (dados ? 'centro_custo' or dados ? 'centro_custo_id');

create index if not exists idx_lancamento_financeiro_centro_custo_id
  on public.lancamento_financeiro (centro_custo_id);

-- === budget_modelo ===
alter table public.budget_modelo add column if not exists centro_custo_id text;

update public.budget_modelo set
  centro_custo_id = case when centro_custo_id is null then dados->>'centro_custo_id' else centro_custo_id end
where dados is not null and dados <> '{}'::jsonb;

update public.budget_modelo
  set dados = dados - array['centro_custo_id']
where dados is not null and dados <> '{}'::jsonb
  and dados ? 'centro_custo_id';

create index if not exists idx_budget_modelo_centro_custo_id
  on public.budget_modelo (centro_custo_id);

-- === folha_previsao_modelo ===
alter table public.folha_previsao_modelo add column if not exists centro_custo_id text;

update public.folha_previsao_modelo set
  centro_custo_id = case when centro_custo_id is null then dados->>'centro_custo_id' else centro_custo_id end
where dados is not null and dados <> '{}'::jsonb;

update public.folha_previsao_modelo
  set dados = dados - array['centro_custo_id']
where dados is not null and dados <> '{}'::jsonb
  and dados ? 'centro_custo_id';

create index if not exists idx_folha_previsao_modelo_centro_custo_id
  on public.folha_previsao_modelo (centro_custo_id);
