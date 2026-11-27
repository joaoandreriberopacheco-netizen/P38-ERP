import { subMonths, format, parseISO, getDaysInMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const MESES_PADRAO = 6;

export function limitesQuatroPartesDoMes(daysInMonth) {
  const step = daysInMonth / 4;
  return [1, 2, 3, 4].map((part) => {
    const start = Math.floor((part - 1) * step) + 1;
    const end = part === 4 ? daysInMonth : Math.floor(part * step);
    return { part, start, end, diasNaParte: end - start + 1 };
  });
}

export function parteQuatroDoMes(day, daysInMonth) {
  const d = Number(day);
  if (!Number.isFinite(d) || d < 1 || d > daysInMonth) return null;
  const step = daysInMonth / 4;
  return Math.min(4, Math.floor((d - 1) / step) + 1);
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

function quantile(sorted, p) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * p;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export function marcarDiasOutlierValorDiario(salesByDay) {
  const dias = Object.entries(salesByDay || {})
    .map(([day, val]) => ({ day: Number(day), valor: Number(val) || 0 }))
    .filter((r) => r.valor > 0)
    .sort((a, b) => a.valor - b.valor);

  if (dias.length < 4) {
    return {
      q1: 0,
      q2: 0,
      q3: 0,
      limiteSuperior: Infinity,
      mediaDias: 0,
      mediaDiasSemOutlier: 0,
      outliers: [],
      diasNormais: dias,
    };
  }

  const valores = dias.map((d) => d.valor);
  const q1 = quantile(valores, 0.25);
  const q2 = quantile(valores, 0.5);
  const q3 = quantile(valores, 0.75);
  const iqr = q3 - q1;
  const limiteTukey = q3 + 1.5 * iqr;

  const outliers = [];
  const diasNormais = [];
  for (const row of dias) {
    if (row.valor > q3 && row.valor > limiteTukey) {
      outliers.push({
        day: row.day,
        valor: roundMoney(row.valor),
        limite: roundMoney(limiteTukey),
      });
    } else {
      diasNormais.push(row);
    }
  }

  return {
    q1: roundMoney(q1),
    q2: roundMoney(q2),
    q3: roundMoney(q3),
    limiteSuperior: roundMoney(limiteTukey),
    mediaDias: roundMoney(valores.reduce((s, x) => s + x, 0) / valores.length),
    mediaDiasSemOutlier:
      diasNormais.length > 0
        ? roundMoney(diasNormais.reduce((s, x) => s + x.valor, 0) / diasNormais.length)
        : roundMoney(q2),
    outliers,
    diasNormais,
  };
}

function agregarQuatroPartes(salesByDay, daysInMonth, apenasDias = null) {
  const allow = apenasDias === null ? null : new Set(apenasDias.map((d) => d.day));
  const parts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let total = 0;
  for (const [dayStr, val] of Object.entries(salesByDay || {})) {
    const day = Number(dayStr);
    const v = Number(val) || 0;
    if (v <= 0) continue;
    if (allow && !allow.has(day)) continue;
    const p = parteQuatroDoMes(day, daysInMonth);
    if (!p) continue;
    parts[p] += v;
    total += v;
  }
  const pct = {};
  for (const p of [1, 2, 3, 4]) {
    pct[p] = total > 0 ? round1((parts[p] / total) * 100) : 0;
  }
  return { parts, total: roundMoney(total), pctPartes: pct };
}

async function loadSalesByMonth(supabase, monthKeys) {
  const { data: mensal } = await supabase
    .from('dashboard_kpi_mensal')
    .select('month_key,payload')
    .eq('domain', 'vendas')
    .in('month_key', monthKeys);

  const byMonth = {};
  for (const mk of monthKeys) byMonth[mk] = {};

  for (const row of mensal || []) {
    const sbd = row.payload?.salesByDay;
    if (sbd && Object.keys(sbd).length) byMonth[row.month_key] = sbd;
  }

  const missing = monthKeys.filter((mk) => !Object.keys(byMonth[mk] || {}).length);
  if (missing.length) {
    let all = [];
    let from = 0;
    const minDate = monthKeys[0] + '-01';
    while (true) {
      const { data, error } = await supabase
        .from('pedido_venda')
        .select('dados,total,status,created_at')
        .gte('created_at', minDate)
        .range(from, from + 999);
      if (error || !data?.length) break;
      all = all.concat(data);
      if (data.length < 1000) break;
      from += 1000;
    }

    for (const pv of all) {
      const st = (pv.dados?.status || pv.status || '').toLowerCase();
      const tp = (pv.dados?.tipo || pv.tipo || '').toLowerCase();
      if (st === 'cancelado' || tp === 'orçamento' || tp === 'orcamento') continue;
      const sd =
        pv.dados?.data_venda && /^\d{4}/.test(String(pv.dados.data_venda))
          ? String(pv.dados.data_venda).slice(0, 10)
          : String(pv.created_at || '').slice(0, 10);
      const mk = sd.slice(0, 7);
      if (!missing.includes(mk)) continue;
      const t = Number(pv.dados?.valor_total ?? pv.total ?? 0);
      if (t <= 0) continue;
      const day = String(parseInt(sd.slice(8, 10), 10));
      if (!byMonth[mk]) byMonth[mk] = {};
      byMonth[mk][day] = (byMonth[mk][day] || 0) + t;
    }
  }

  return byMonth;
}

function mean(arr) {
  return arr.length ? round1(arr.reduce((s, x) => s + x, 0) / arr.length) : 0;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ meses?: number, refDate?: Date }} [opts]
 */
export async function runVendasSazonalidadeAnalise(supabase, opts = {}) {
  const meses = opts.meses ?? MESES_PADRAO;
  const ref = opts.refDate ?? new Date();
  const hojeKey = format(ref, 'yyyy-MM-dd');
  const monthKeys = [];
  for (let i = meses - 1; i >= 0; i--) monthKeys.push(format(subMonths(ref, i), 'yyyy-MM'));

  const byMonth = await loadSalesByMonth(supabase, monthKeys);
  const pagina1 = [];
  const pagina2 = [];
  const partMeanRaw = { 1: [], 2: [], 3: [], 4: [] };
  const partMeanFilt = { 1: [], 2: [], 3: [], 4: [] };
  const outliersDiarios = [];

  for (const mk of monthKeys) {
    const sbd = byMonth[mk] || {};
    const [y, m] = mk.split('-').map(Number);
    const daysInMonth = getDaysInMonth(new Date(y, m - 1, 1));
    const limites = limitesQuatroPartesDoMes(daysInMonth);
    const mesParcial = mk === hojeKey.slice(0, 7);

    const bruto = agregarQuatroPartes(sbd, daysInMonth, null);
    const outlierInfo = marcarDiasOutlierValorDiario(sbd);
    const filtrado = agregarQuatroPartes(sbd, daysInMonth, outlierInfo.diasNormais);

    for (const o of outlierInfo.outliers) {
      outliersDiarios.push({
        monthKey: mk,
        dia: o.day,
        data: `${mk}-${String(o.day).padStart(2, '0')}`,
        valor: o.valor,
        limite: o.limite,
        mediaMes: outlierInfo.mediaDias,
      });
    }

    for (const p of [1, 2, 3, 4]) {
      if (bruto.total > 0) partMeanRaw[p].push(bruto.pctPartes[p]);
      if (filtrado.total > 0) partMeanFilt[p].push(filtrado.pctPartes[p]);
    }

    pagina1.push({
      monthKey: mk,
      label: format(parseISO(`${mk}-01`), 'MMMM/yy', { locale: ptBR }),
      diasNoMes: daysInMonth,
      limitesPartes: limites,
      mesParcial,
      pctPartes: bruto.pctPartes,
      total: bruto.total,
      partesValor: Object.fromEntries([1, 2, 3, 4].map((p) => [p, roundMoney(bruto.parts[p])])),
    });

    pagina2.push({
      monthKey: mk,
      label: format(parseISO(`${mk}-01`), 'MMMM/yy', { locale: ptBR }),
      mesParcial,
      mediaValorDiaBruta: outlierInfo.mediaDias,
      mediaValorDiaOrganica: outlierInfo.mediaDiasSemOutlier,
      diasRemovidos: outlierInfo.outliers.map((o) => ({
        ...o,
        data: `${mk}-${String(o.day).padStart(2, '0')}`,
      })),
      totalSemOutliers: filtrado.total,
      pctPartesOrganico: filtrado.pctPartes,
      partesValorOrganico: Object.fromEntries([1, 2, 3, 4].map((p) => [p, roundMoney(filtrado.parts[p])])),
    });
  }

  return {
    janela: `${monthKeys[0]} a ${monthKeys[monthKeys.length - 1]}`,
    dataCorte: hojeKey,
    pagina1_bruto: pagina1,
    pagina2_organico: pagina2,
    padraoPartes: {
      bruto: [1, 2, 3, 4].map((p) => ({ parte: p, pctMedio: mean(partMeanRaw[p]) })),
      organico: [1, 2, 3, 4].map((p) => ({ parte: p, pctMedio: mean(partMeanFilt[p]) })),
    },
    outliersDiarios,
  };
}