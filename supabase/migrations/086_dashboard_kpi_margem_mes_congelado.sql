-- 086_dashboard_kpi_margem_mes_congelado.sql
-- Meses anteriores ao corrente: snapshot KPI = verdade histórica (não recalcular custos futuros).
-- O job Node marca payload.frozen=true ao gravar meses passados.

comment on function public.job_fechar_dashboard_kpi_ontem() is
  'Fecha estoque/anotações. Vendas KPI: npm run dashboard:kpi-margem-fechar — mês corrente dinâmico; passado congelado.';

-- Marca meses já gravados como congelados (sem alterar totais).
update public.dashboard_kpi_mensal m
set payload = m.payload
  || jsonb_build_object(
    'frozen', true,
    'costBasis', 'momento_venda',
    'frozenAt', coalesce(m.payload->>'frozenAt', m.computed_at::text)
  )
where m.domain = 'vendas'
  and m.month_key < public.p38_month_key(public.p38_tabatinga_hoje())
  and coalesce((m.payload->>'frozen')::boolean, false) = false;
