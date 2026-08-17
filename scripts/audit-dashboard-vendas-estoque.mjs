#!/usr/bin/env node
/**
 * Audita consistência dos dashboards de Vendas e Estoque (Paiol).
 *
 * Compara:
 * - Vendas: MV vs snapshots mensais; pedidos fora da janela de fetch (created_date vs data_venda)
 * - Estoque: card Localização; CMV efetivo vs vendido; reconstrução vs cadastro
 *
 * Uso: npm run audit:dashboard
 */
import pg from 'pg';
import { loadDotEnvFiles } from './base44-env.mjs';

loadDotEnvFiles();

const TOLERANCE = 1.0; // R$ 1,00

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function fmt(n) {
  return round2(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  const report = {
    gerado_em: new Date().toISOString(),
    timezone: 'America/Rio_Branco',
    tolerancia_reais: TOLERANCE,
    vendas: {},
    estoque: {},
    alertas: [],
  };

  // ── VENDAS: MV vs snapshot mensal ──────────────────────────────────────
  const { rows: vendasMvVsSnap } = await pool.query(`
    with mv as (
      select month_key,
             round(sum(sales_net), 2) as sales_net,
             round(sum(cost), 2) as cost,
             round(sum(profit), 2) as profit,
             sum(pedido_count)::int as pedidos
      from public.mv_dashboard_vendas_dia
      where month_key >= to_char((date_trunc('month', now() at time zone 'America/Rio_Branco') - interval '5 months')::date, 'YYYY-MM')
      group by month_key
    ),
    snap as (
      select month_key,
             round((payload->'monthlyTotals'->>'salesNet')::numeric, 2) as sales_net,
             round((payload->'monthlyTotals'->>'cost')::numeric, 2) as cost,
             round((payload->'monthlyTotals'->>'profit')::numeric, 2) as profit,
             (payload->'monthlyTotals'->>'pedidoCount')::int as pedidos,
             closed_through
      from public.dashboard_kpi_mensal
      where domain = 'vendas'
        and month_key >= to_char((date_trunc('month', now() at time zone 'America/Rio_Branco') - interval '5 months')::date, 'YYYY-MM')
    )
    select
      coalesce(mv.month_key, snap.month_key) as month_key,
      mv.sales_net as mv_sales_net,
      snap.sales_net as snap_sales_net,
      mv.cost as mv_cost,
      snap.cost as snap_cost,
      mv.profit as mv_profit,
      snap.profit as snap_profit,
      mv.pedidos as mv_pedidos,
      snap.pedidos as snap_pedidos,
      snap.closed_through
    from mv
    full outer join snap on snap.month_key = mv.month_key
    order by coalesce(mv.month_key, snap.month_key) desc
  `);

  report.vendas.mv_vs_snapshot = vendasMvVsSnap.map((r) => {
    const diffNet = round2((r.mv_sales_net || 0) - (r.snap_sales_net || 0));
    const diffCost = round2((r.mv_cost || 0) - (r.snap_cost || 0));
    const diffProfit = round2((r.mv_profit || 0) - (r.snap_profit || 0));
    const ok = Math.abs(diffNet) <= TOLERANCE && Math.abs(diffCost) <= TOLERANCE;
    if (!ok) {
      report.alertas.push({
        severidade: 'alta',
        area: 'vendas',
        mes: r.month_key,
        msg: `MV ≠ snapshot: vendas líquidas diff R$ ${fmt(diffNet)}, custo diff R$ ${fmt(diffCost)}`,
      });
    }
    return {
      mes: r.month_key,
      mv: { vendas_liquidas: Number(r.mv_sales_net || 0), custo: Number(r.mv_cost || 0), lucro: Number(r.mv_profit || 0), pedidos: r.mv_pedidos },
      snapshot: { vendas_liquidas: Number(r.snap_sales_net || 0), custo: Number(r.snap_cost || 0), lucro: Number(r.snap_profit || 0), pedidos: r.snap_pedidos },
      diff: { vendas_liquidas: diffNet, custo: diffCost, lucro: diffProfit },
      fechado_ate: r.closed_through,
      ok,
    };
  });

  // ── VENDAS: dirty queue ────────────────────────────────────────────────
  const { rows: dirtyRows } = await pool.query(`
    select domain, month_key, reason, marked_at
    from public.dashboard_kpi_dirty
    order by marked_at desc
    limit 20
  `);
  report.vendas.fila_dirty = dirtyRows;
  if (dirtyRows.length > 0) {
    report.alertas.push({
      severidade: 'media',
      area: 'vendas',
      msg: `${dirtyRows.length} mês(es) na fila dirty — snapshots podem estar desatualizados`,
      meses: dirtyRows.map((r) => r.month_key),
    });
  }

  // ── VENDAS: created_date vs data_venda (gap no fetch do frontend) ────
  const { rows: dateMismatch } = await pool.query(`
    select
      count(*)::int as total_elegiveis,
      count(*) filter (
        where public.p38_month_key(public.p38_pedido_venda_sale_date(pv))
            <> to_char((pv.created_at at time zone 'America/Rio_Branco')::date, 'YYYY-MM')
      )::int as mes_venda_diferente_created,
      round(sum(public.p38_pedido_venda_total(pv)) filter (
        where public.p38_month_key(public.p38_pedido_venda_sale_date(pv))
            <> to_char((pv.created_at at time zone 'America/Rio_Branco')::date, 'YYYY-MM')
      ), 2) as valor_em_mes_errado
    from public.pedido_venda pv
    where public.p38_pedido_venda_elegivel_dashboard(pv)
      and public.p38_pedido_venda_sale_date(pv) >= (date_trunc('month', now() at time zone 'America/Rio_Branco') - interval '5 months')::date
  `);

  const { rows: dateMismatchSamples } = await pool.query(`
    select
      pv.id,
      pv.numero,
      public.p38_pedido_venda_sale_date(pv) as data_venda,
      (pv.created_at at time zone 'America/Rio_Branco')::date as created_date,
      public.p38_month_key(public.p38_pedido_venda_sale_date(pv)) as mes_venda,
      to_char((pv.created_at at time zone 'America/Rio_Branco')::date, 'YYYY-MM') as mes_created,
      public.p38_pedido_venda_total(pv) as total
    from public.pedido_venda pv
    where public.p38_pedido_venda_elegivel_dashboard(pv)
      and public.p38_month_key(public.p38_pedido_venda_sale_date(pv))
          <> to_char((pv.created_at at time zone 'America/Rio_Branco')::date, 'YYYY-MM')
      and public.p38_pedido_venda_sale_date(pv) >= (date_trunc('month', now() at time zone 'America/Rio_Branco') - interval '5 months')::date
    order by abs(public.p38_pedido_venda_total(pv)) desc
    limit 15
  `);

  report.vendas.created_vs_data_venda = {
    ...dateMismatch[0],
    valor_em_mes_errado: Number(dateMismatch[0]?.valor_em_mes_errado || 0),
    amostra: dateMismatchSamples.map((r) => ({
      id: r.id,
      numero: r.numero,
      data_venda: r.data_venda,
      created_date: r.created_date,
      mes_venda: r.mes_venda,
      mes_created: r.mes_created,
      total: Number(r.total),
    })),
    interpretacao:
      'O frontend busca pedidos por created_date mas agrupa por data_venda — pedidos com meses diferentes podem faltar ou sobrar no dashboard.',
  };

  if (Number(dateMismatch[0]?.mes_venda_diferente_created || 0) > 0) {
    report.alertas.push({
      severidade: 'alta',
      area: 'vendas',
      msg: `${dateMismatch[0].mes_venda_diferente_created} pedidos com mês de venda ≠ mês de created_date (R$ ${fmt(dateMismatch[0].valor_em_mes_errado)} afetados)`,
    });
  }

  // ── VENDAS: pedidos sem custo nos itens ────────────────────────────────
  const { rows: semCusto } = await pool.query(`
    with eligible as (
      select pv.id, public.p38_pedido_venda_total(pv) as total,
             public.p38_month_key(public.p38_pedido_venda_sale_date(pv)) as month_key
      from public.pedido_venda pv
      where public.p38_pedido_venda_elegivel_dashboard(pv)
        and public.p38_pedido_venda_sale_date(pv) >= (date_trunc('month', now() at time zone 'America/Rio_Branco') - interval '5 months')::date
    ),
    costs as (
      select pvi.pedido_venda_id,
             sum(coalesce(pvi.quantidade_base, 0) * coalesce(pvi.custo_unitario_momento, 0)) as cost
      from public.pedido_venda_item pvi
      group by pvi.pedido_venda_id
    )
    select
      e.month_key,
      count(*)::int as pedidos_sem_custo,
      round(sum(e.total), 2) as vendas_sem_custo
    from eligible e
    left join costs c on c.pedido_venda_id = e.id
    where coalesce(c.cost, 0) = 0 and e.total > 0
    group by e.month_key
    order by e.month_key desc
  `);

  report.vendas.pedidos_sem_custo_item = semCusto.map((r) => ({
    mes: r.month_key,
    pedidos: r.pedidos_sem_custo,
    vendas_liquidas: Number(r.vendas_sem_custo),
  }));

  const totalSemCusto = semCusto.reduce((s, r) => s + Number(r.pedidos_sem_custo || 0), 0);
  if (totalSemCusto > 0) {
    report.alertas.push({
      severidade: 'media',
      area: 'vendas',
      msg: `${totalSemCusto} pedidos com venda > 0 mas custo zero nos itens (lucro inflado)`,
    });
  }

  // ── ESTOQUE: card Localização (físico) ─────────────────────────────────
  const { rows: locCard } = await pool.query(`
    select
      count(*) filter (where coalesce(ativo, true))::int as produtos_ativos,
      round(sum(
        greatest(0, coalesce(estoque_atual, 0)::numeric) *
        coalesce(
          nullif(preco_custo_calculado, 0),
          nullif((dados->>'preco_custo_calculado')::numeric, 0),
          0
        )
      ) filter (where coalesce(ativo, true)), 2) as estoque_fisico_valor,
      round(sum(greatest(0, coalesce(estoque_atual, 0)::numeric)) filter (where coalesce(ativo, true)), 2) as estoque_fisico_qty
    from public.produto
  `);

  report.estoque.card_localizacao = {
    produtos_ativos: locCard[0].produtos_ativos,
    estoque_fisico_valor: Number(locCard[0].estoque_fisico_valor),
    estoque_fisico_qty: Number(locCard[0].estoque_fisico_qty),
    marca_manual_2026_08: { estoqueFisico: 234618, transitoFinanceiroAprovado: 131110, totalLocalizacao: 365728 },
    nota: 'Trânsito financeiro requer lógica de pedidos_compra/embarques — verificado separadamente abaixo.',
  };

  const diffFisico = round2(Number(locCard[0].estoque_fisico_valor) - 234618);
  if (Math.abs(diffFisico) > 5000) {
    report.alertas.push({
      severidade: 'media',
      area: 'estoque',
      msg: `Estoque físico actual (R$ ${fmt(locCard[0].estoque_fisico_valor)}) difere da marca manual Ago/26 (R$ 234.618,00) em R$ ${fmt(diffFisico)}`,
    });
  }

  // ── ESTOQUE: CMV efetivo vs vendido (últimos 3 meses) ────────────────
  const { rows: cmvRows } = await pool.query(`
    with meses as (
      select
        to_char(d, 'YYYY-MM') as month_key,
        d::date as mes_inicio,
        (d + interval '1 month' - interval '1 day')::date as mes_fim
      from generate_series(
        date_trunc('month', now() at time zone 'America/Rio_Branco') - interval '2 months',
        date_trunc('month', now() at time zone 'America/Rio_Branco'),
        interval '1 month'
      ) d
    ),
    cmv_efetivo as (
      select
        to_char(lf.data_pagamento::date, 'YYYY-MM') as month_key,
        round(sum(coalesce(lf.valor, 0)), 2) as cmv_efetivo
      from public.lancamento_financeiro lf
      where lower(trim(coalesce(lf.tipo, lf.dados->>'tipo', ''))) = 'despesa'
        and coalesce(lf.is_custo_mercadoria, (lf.dados->>'is_custo_mercadoria')::boolean, false) = true
        and lower(trim(coalesce(lf.status, lf.dados->>'status', ''))) <> 'cancelado'
        and lf.data_pagamento >= (date_trunc('month', now() at time zone 'America/Rio_Branco') - interval '2 months')::date
      group by 1
    ),
    cmv_vendido_created as (
      select
        to_char((pv.created_at at time zone 'America/Rio_Branco')::date, 'YYYY-MM') as month_key,
        round(sum(coalesce(pvi.quantidade_base, 0) * coalesce(pvi.custo_unitario_momento, 0)), 2) as cmv_vendido
      from public.pedido_venda pv
      join public.pedido_venda_item pvi on pvi.pedido_venda_id = pv.id
      where lower(trim(coalesce(pv.tipo, pv.dados->>'tipo', ''))) = 'pdv'
        and lower(trim(coalesce(pv.status, pv.dados->>'status', ''))) <> 'cancelado'
        and lower(trim(coalesce(pv.status, pv.dados->>'status', ''))) not in ('orçamento', 'orcamento', 'aguardando caixa')
        and (pv.created_at at time zone 'America/Rio_Branco')::date >= (date_trunc('month', now() at time zone 'America/Rio_Branco') - interval '2 months')::date
      group by 1
    ),
    cmv_vendido_sale_date as (
      select
        public.p38_month_key(public.p38_pedido_venda_sale_date(pv)) as month_key,
        round(sum(coalesce(pvi.quantidade_base, 0) * coalesce(pvi.custo_unitario_momento, 0)), 2) as cmv_vendido
      from public.pedido_venda pv
      join public.pedido_venda_item pvi on pvi.pedido_venda_id = pv.id
      where lower(trim(coalesce(pv.tipo, pv.dados->>'tipo', ''))) = 'pdv'
        and public.p38_pedido_venda_elegivel_dashboard(pv)
        and public.p38_pedido_venda_sale_date(pv) >= (date_trunc('month', now() at time zone 'America/Rio_Branco') - interval '2 months')::date
      group by 1
    )
    select
      m.month_key,
      coalesce(ce.cmv_efetivo, 0) as cmv_efetivo,
      coalesce(cv.cmv_vendido, 0) as cmv_vendido_created_date,
      coalesce(cvs.cmv_vendido, 0) as cmv_vendido_sale_date,
      case when coalesce(cv.cmv_vendido, 0) > 0
        then round(100.0 * coalesce(ce.cmv_efetivo, 0) / cv.cmv_vendido, 1)
        else null end as ratio_created_pct,
      case when coalesce(cvs.cmv_vendido, 0) > 0
        then round(100.0 * coalesce(ce.cmv_efetivo, 0) / cvs.cmv_vendido, 1)
        else null end as ratio_sale_date_pct
    from meses m
    left join cmv_efetivo ce on ce.month_key = m.month_key
    left join cmv_vendido_created cv on cv.month_key = m.month_key
    left join cmv_vendido_sale_date cvs on cvs.month_key = m.month_key
    order by m.month_key
  `);

  report.estoque.cmv_supply = cmvRows.map((r) => {
    const ratio = Number(r.ratio_created_pct);
    let status = 'saudavel';
    if (ratio > 105) status = 'alto';
    else if (ratio < 95 && ratio > 0) status = 'baixo';
    if (ratio > 0 && (ratio < 95 || ratio > 105)) {
      report.alertas.push({
        severidade: 'media',
        area: 'estoque',
        mes: r.month_key,
        msg: `CMV supply fora de 95-105%: ${ratio}% (efetivo R$ ${fmt(r.cmv_efetivo)} / vendido R$ ${fmt(r.cmv_vendido_created_date)})`,
      });
    }
    const diffDates = round2(Number(r.cmv_vendido_sale_date) - Number(r.cmv_vendido_created_date));
    return {
      mes: r.month_key,
      cmv_efetivo: Number(r.cmv_efetivo),
      cmv_vendido_created_date: Number(r.cmv_vendido_created_date),
      cmv_vendido_sale_date: Number(r.cmv_vendido_sale_date),
      ratio_created_pct: ratio,
      ratio_sale_date_pct: Number(r.ratio_sale_date_pct),
      diff_cmv_por_data: diffDates,
      status_gauge: status,
      nota_dashboard: 'O gauge do dashboard usa created_date para CMV vendido, não data_venda.',
    };
  });

  // ── ESTOQUE: cadastro vs extrato (resumo) ────────────────────────────
  const { rows: estoqueAlign } = await pool.query(`
    select
      count(*) filter (where abs(cadastro - extrato) <= 0.01)::int as alinhados,
      count(*) filter (where cadastro > 0 and abs(cadastro - extrato) > 0.01)::int as divergencias,
      round(sum(abs(cadastro - extrato) * custo) filter (where cadastro > 0 and abs(cadastro - extrato) > 0.01), 2) as impacto_valor_divergencias
    from (
      select p.estoque_atual::numeric as cadastro,
        sum(case when m.tipo = 'Entrada' then m.quantidade::numeric else -m.quantidade::numeric end) as extrato,
        coalesce(nullif(p.preco_custo_calculado, 0), nullif((p.dados->>'preco_custo_calculado')::numeric, 0), 0) as custo
      from public.produto p
      join public.movimentacao_estoque m on m.produto_id = p.id
      where coalesce(p.ativo, true)
      group by p.id, p.estoque_atual, p.preco_custo_calculado, p.dados
    ) t
  `);

  report.estoque.cadastro_vs_extrato = {
    ...estoqueAlign[0],
    impacto_valor_divergencias: Number(estoqueAlign[0]?.impacto_valor_divergencias || 0),
    script_detalhado: 'npm run audit:estoque-canonico',
  };

  if (Number(estoqueAlign[0]?.divergencias || 0) > 0) {
    report.alertas.push({
      severidade: 'baixa',
      area: 'estoque',
      msg: `${estoqueAlign[0].divergencias} produtos com cadastro ≠ extrato de movimentos (impacto ~R$ ${fmt(estoqueAlign[0].impacto_valor_divergencias)})`,
    });
  }

  // ── ESTOQUE: reconstrução — movimentos fora dos 3 motivos ─────────────
  const { rows: movOutros } = await pool.query(`
    select
      lower(trim(coalesce(motivo, dados->>'motivo', ''))) as motivo,
      count(*)::int as qtd,
      round(sum(abs(quantidade::numeric)), 2) as qty_abs
    from public.movimentacao_estoque
    where lower(trim(coalesce(motivo, dados->>'motivo', ''))) not in ('compra', 'venda', 'consumo interno', '')
    group by 1
    order by count(*) desc
    limit 10
  `);

  report.estoque.movimentos_ignorados_reconstrucao = movOutros;
  const totalIgnorados = movOutros.reduce((s, r) => s + Number(r.qtd || 0), 0);
  if (totalIgnorados > 100) {
    report.alertas.push({
      severidade: 'media',
      area: 'estoque',
      msg: `${totalIgnorados} movimentos ignorados na reconstrução do gráfico mensal (ajustes, transferências, etc.)`,
    });
  }

  // ── Resumo executivo ───────────────────────────────────────────────────
  report.resumo = {
    alertas_total: report.alertas.length,
    alertas_alta: report.alertas.filter((a) => a.severidade === 'alta').length,
    alertas_media: report.alertas.filter((a) => a.severidade === 'media').length,
    meses_vendas_ok: report.vendas.mv_vs_snapshot?.filter((m) => m.ok).length || 0,
    meses_vendas_total: report.vendas.mv_vs_snapshot?.length || 0,
    estoque_fisico_atual: Number(locCard[0].estoque_fisico_valor),
  };

  await pool.end();
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
