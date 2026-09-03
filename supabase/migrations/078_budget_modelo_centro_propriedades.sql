-- 078_budget_modelo_centro_propriedades.sql
-- CASA ISRAEL - ESTIVAS e APARTAMENTO DE MANAUS → centro Propriedades

update public.budget_modelo
set
  dados = jsonb_set(
    coalesce(dados, '{}'::jsonb),
    '{centro_custo}',
    '"Propriedades"'::jsonb,
    true
  ),
  updated_at = now()
where lower(trim(coalesce(dados->>'nome', ''))) in (
  lower('CASA ISRAEL - ESTIVAS'),
  lower('APARTAMENTO DE MANAUS')
);
