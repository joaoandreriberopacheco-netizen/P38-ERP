-- 085_dashboard_kpi_margem_job.sql
-- KPI vendas do dashboard passa a ser gravado pelo job Node (Relatório de Margem).
-- O SQL legado dashboard_kpi_compute_vendas_dia (custo_unitario_momento) deixa de correr no cron.

comment on function public.dashboard_kpi_compute_vendas_dia(date) is
  'LEGADO — custo_unitario_momento. Substituído por scripts/dashboard-kpi-margem-fechar.mjs (relatorio_margem_v1).';

create or replace function public.job_fechar_dashboard_kpi_ontem()
returns jsonb language plpgsql security definer as $$
declare
  v_ontem date := public.p38_tabatinga_ontem();
  v_month text := public.p38_month_key(v_ontem);
  v_anotacao jsonb;
begin
  -- Vendas: npm run dashboard:kpi-margem-fechar (GitHub Actions 05:10 UTC ou manual).
  -- Vendas: mês corrente dinâmico; meses passados congelados (ver migration 086).
  perform public.dashboard_kpi_compute_estoque_dia(v_ontem);

  v_anotacao := public.job_fechar_p38_anotacao_ontem();

  return jsonb_build_object(
    'success', true,
    'ontem', v_ontem,
    'monthKey', v_month,
    'vendasKpiSource', 'relatorio_margem_v1_node_job',
    'vendasDia', (
      select payload
      from public.dashboard_kpi_diario
      where domain = 'vendas' and ref_date = v_ontem
    ),
    'vendasMensal', (
      select payload
      from public.dashboard_kpi_mensal
      where domain = 'vendas' and month_key = v_month
    ),
    'dirtyVendasPending', (
      select count(*) from public.dashboard_kpi_dirty where domain = 'vendas'
    ),
    'anotacao', v_anotacao
  );
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

grant execute on function public.job_fechar_dashboard_kpi_ontem() to service_role;
