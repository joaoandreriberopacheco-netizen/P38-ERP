function round1(n) {
  return Math.round(n * 10) / 10;
}
function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

export function margemContribuicaoPercent(lucro, receitaLiquida) {
  const net = Number(receitaLiquida) || 0;
  if (net <= 0) return 0;
  return round1((Number(lucro) / net) * 100);
}

export function markupPercent(lucro, custo) {
  const c = Number(custo) || 0;
  if (c <= 0) return 0;
  return round1((Number(lucro) / c) * 100);
}

export function margemResumoFromTotais({ salesNet, cost, profit } = {}) {
  const net = Number(salesNet) || 0;
  const custo = Number(cost) || 0;
  const lucro = Number(profit) ?? net - custo;
  return {
    lucro: roundMoney(lucro),
    receitaLiquida: roundMoney(net),
    custo: roundMoney(custo),
    margemContribuicaoPct: margemContribuicaoPercent(lucro, net),
    markupPct: markupPercent(lucro, custo),
  };
}

/** Lê `monthlyTotals` do snapshot vendas (dashboard_kpi_mensal). */
export async function loadMargemKpiMensalMap(supabase, monthKeys) {
  const { data, error } = await supabase
    .from('dashboard_kpi_mensal')
    .select('month_key,payload')
    .eq('domain', 'vendas')
    .in('month_key', monthKeys);
  if (error) throw error;

  const map = {};
  for (const row of data || []) {
    const mt = row.payload?.monthlyTotals;
    if (!mt || (!mt.profit && !mt.salesNet)) continue;
    map[row.month_key] = {
      ...margemResumoFromTotais({
        salesNet: mt.salesNet,
        cost: mt.cost,
        profit: mt.profit,
      }),
      fonte: 'kpi_mensal',
    };
  }
  return map;
}

function hasMargemEntry(entry) {
  return Boolean(entry && (entry.receitaLiquida || entry.lucro || entry.custo));
}

/** `margem_competencia_snapshot` (meses civilmente fechados). */
export async function loadMargemCompetenciaSnapshotMap(supabase, monthKeys, map = {}) {
  const need = monthKeys.filter((mk) => !hasMargemEntry(map[mk]));
  if (!need.length) return map;

  const { data, error } = await supabase
    .from('margem_competencia_snapshot')
    .select('competencia,receita_liquida,custo_total,lucro_bruto')
    .in('competencia', need);
  if (error) throw error;

  for (const row of data || []) {
    const mk = row.competencia;
    if (hasMargemEntry(map[mk])) continue;
    map[mk] = {
      ...margemResumoFromTotais({
        salesNet: row.receita_liquida,
        cost: row.custo_total,
        profit: row.lucro_bruto,
      }),
      fonte: 'margem_snapshot',
    };
  }
  return map;
}

/** Completa meses em falta via Supabase (Relatório de Margem — sem Base44). */
export async function enrichMargemCompetenciasFaltantes(supabase, monthKeys, map = {}) {
  const missing = monthKeys.filter((mk) => !hasMargemEntry(map[mk]));
  if (!missing.length) return map;

  let fetchMargemKpiDataset;
  let calcularLinhasMargemVendas;
  let calcularTotaisMargem;
  let competenciaParaIntervalo;
  try {
    ({ fetchMargemKpiDataset } = await import('../../src/lib/fetchMargemKpiSupabase.js'));
    ({ calcularLinhasMargemVendas, calcularTotaisMargem, competenciaParaIntervalo } = await import(
      '../../src/lib/relatorioMargemCalculos.js'
    ));
  } catch (err) {
    console.warn('[margem] motor Supabase indisponível:', err?.message || err);
    return map;
  }

  for (const competencia of missing) {
    try {
      const intervalo = competenciaParaIntervalo(competencia);
      if (!intervalo) continue;
      const dataset = await fetchMargemKpiDataset(competencia, supabase);
      const linhas = calcularLinhasMargemVendas(
        dataset.sales,
        dataset.products,
        intervalo,
        dataset.devolucoesTroca,
        dataset.pedidosOrigemTroca,
      );
      const t = calcularTotaisMargem(linhas);
      if (!t?.receita_liquida && !t?.lucro_bruto) continue;
      map[competencia] = {
        ...margemResumoFromTotais({
          salesNet: t.receita_liquida,
          cost: t.custo_total,
          profit: t.lucro_bruto,
        }),
        fonte: 'relatorio_margem_supabase',
      };
    } catch (err) {
      console.warn(`[margem] ${competencia}:`, err?.message || err);
    }
  }
  return map;
}

export function attachMargemToPaginas(pagina1, pagina2, margemPorMes) {
  for (const row of pagina1) {
    row.margem = margemPorMes[row.monthKey] || null;
  }
  for (const row of pagina2) {
    row.margem = margemPorMes[row.monthKey] || null;
  }
}

export function margemMediaPonderada(rows, getTotal) {
  let lucro = 0;
  let net = 0;
  let custo = 0;
  for (const row of rows) {
    const m = row.margem;
    if (!m) continue;
    lucro += Number(m.lucro) || 0;
    net += Number(m.receitaLiquida) || Number(getTotal(row)) || 0;
    custo += Number(m.custo) || 0;
  }
  if (!net) return null;
  return {
    ...margemResumoFromTotais({ salesNet: net, cost: custo, profit: lucro }),
    fonte: 'media_ponderada',
  };
}