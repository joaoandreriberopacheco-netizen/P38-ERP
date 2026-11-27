import { subMonths, format, parseISO, getDaysInMonth, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const MESES_PADRAO = 6;
export const PARTES_NO_MES = 3;

/** Domingo (0) não entra; segunda–sábado contam. */
export function isDomingoNoMes(monthKey, day) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = Number(day);
  if (!y || !m || !d) return false;
  return getDay(new Date(y, m - 1, d, 12, 0, 0, 0)) === 0;
}

export function filtrarSalesByDayDiasUteis(salesByDay, monthKey) {
  const out = {};
  for (const [dayStr, val] of Object.entries(salesByDay || {})) {
    if (isDomingoNoMes(monthKey, dayStr)) continue;
    out[dayStr] = val;
  }
  return out;
}

export function limitesTresPartesDoMes(daysInMonth) {
  const step = daysInMonth / PARTES_NO_MES;
  return [1, 2, 3].map((part) => {
    const start = Math.floor((part - 1) * step) + 1;
    const end = part === PARTES_NO_MES ? daysInMonth : Math.floor(part * step);
    return { part, start, end, diasNaParte: end - start + 1 };
  });
}

export function parteTresDoMes(day, daysInMonth) {
  const d = Number(day);
  if (!Number.isFinite(d) || d < 1 || d > daysInMonth) return null;
  const step = daysInMonth / PARTES_NO_MES;
  return Math.min(PARTES_NO_MES, Math.floor((d - 1) / step) + 1);
}

/** Compat legado (scripts antigos). */
export const limitesQuatroPartesDoMes = limitesTresPartesDoMes;
export const parteQuatroDoMes = parteTresDoMes;

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

function agregarPartesDoMes(salesByDay, daysInMonth, monthKey, apenasDias = null) {
  const allow = apenasDias === null ? null : new Set(apenasDias.map((d) => d.day));
  const parts = { 1: 0, 2: 0, 3: 0 };
  let total = 0;
  for (const [dayStr, val] of Object.entries(salesByDay || {})) {
    const day = Number(dayStr);
    const v = Number(val) || 0;
    if (v <= 0) continue;
    if (isDomingoNoMes(monthKey, day)) continue;
    if (allow && !allow.has(day)) continue;
    const p = parteTresDoMes(day, daysInMonth);
    if (!p) continue;
    parts[p] += v;
    total += v;
  }
  const pct = {};
  for (const p of [1, 2, 3]) {
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

  const diarioByMonth = await loadKpiDiarioByMonth(supabase, monthKeys);
  for (const mk of monthKeys) {
    if (Object.keys(byMonth[mk] || {}).length) continue;
  const daily = diarioByMonth[mk];
    if (daily && Object.keys(daily).length) {
      byMonth[mk] = daily;
    }
  }

  const missing = monthKeys.filter((mk) => !Object.keys(byMonth[mk] || {}).length);
  if (missing.length) {
    const minDate = monthKeys[0] + '-01';
    const pedidos = await fetchPedidosVendaDeduped(supabase, minDate);

    for (const pv of pedidos) {
      if (!pedidoElegivelVendasKpi(pv)) continue;
      const sd = resolveDataVendaKey(pv);
      if (!sd) continue;
      const mk = sd.slice(0, 7);
      if (!missing.includes(mk)) continue;
      const t = valorTotalPedido(pv);
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

function resolveDataVendaKey(pv) {
  const dados = pv?.dados && typeof pv.dados === 'object' ? pv.dados : {};
  for (const field of ['data_venda', 'data_emissao', 'data_fechamento']) {
    const raw = dados[field] ?? pv[field];
    if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
      return raw.slice(0, 10);
    }
  }
  const created = pv?.created_at ?? pv?.created_date;
  return typeof created === 'string' ? created.slice(0, 10) : null;
}

function pedidoElegivelVendasKpi(pv) {
  const dados = pv?.dados && typeof pv.dados === 'object' ? pv.dados : {};
  const st = String(dados.status ?? pv.status ?? '')
    .trim()
    .toLowerCase();
  const tp = String(dados.tipo ?? pv.tipo ?? '')
    .trim()
    .toLowerCase();
  if (st === 'cancelado') return false;
  if (tp === 'orçamento' || tp === 'orcamento' || st === 'orçamento' || st === 'orcamento') return false;
  return true;
}

function valorTotalPedido(pv) {
  const dados = pv?.dados && typeof pv.dados === 'object' ? pv.dados : {};
  return Number(dados.valor_total ?? pv.valor_total ?? pv.total ?? 0);
}

/** Paginação PostgREST pode repetir linhas — sempre deduplicar por `id`. */
async function fetchPedidosVendaDeduped(supabase, minCreatedAt) {
  const byId = new Map();
  let from = 0;
  const pageSize = 1000;
  const maxPages = 200;
  for (let page = 0; page < maxPages; page += 1) {
    const { data, error } = await supabase
      .from('pedido_venda')
      .select('id,dados,total,status,created_at')
      .gte('created_at', minCreatedAt)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    let novos = 0;
    for (const row of data) {
      const id = row?.id;
      if (id == null || byId.has(String(id))) continue;
      byId.set(String(id), row);
      novos += 1;
    }
    if (data.length < pageSize) break;
    if (novos === 0) break;
    from += pageSize;
  }
  return [...byId.values()];
}

async function loadKpiDiarioByMonth(supabase, monthKeys) {
  const { data, error } = await supabase
    .from('dashboard_kpi_diario')
    .select('month_key,ref_date,payload')
    .eq('domain', 'vendas')
    .in('month_key', monthKeys);
  if (error || !data?.length) return {};
  const byMonth = {};
  for (const row of data) {
    const mk = row.month_key;
    const day = String(Number(row.payload?.day) || new Date(row.ref_date).getDate());
    const val = Number(row.payload?.salesNet ?? row.payload?.salesGross ?? 0);
    if (!byMonth[mk]) byMonth[mk] = {};
    if (val > 0) byMonth[mk][day] = (byMonth[mk][day] || 0) + val;
  }
  return byMonth;
}

const PARTES_LIST = [1, 2, 3];

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
  const partMeanRaw = { 1: [], 2: [], 3: [] };
  const partMeanFilt = { 1: [], 2: [], 3: [] };
  const outliersDiarios = [];

  for (const mk of monthKeys) {
    const sbdUteis = filtrarSalesByDayDiasUteis(byMonth[mk] || {}, mk);
    const [y, m] = mk.split('-').map(Number);
    const daysInMonth = getDaysInMonth(new Date(y, m - 1, 1));
    const limites = limitesTresPartesDoMes(daysInMonth);
    const mesParcial = mk === hojeKey.slice(0, 7);

    const bruto = agregarPartesDoMes(sbdUteis, daysInMonth, mk, null);
    const outlierInfo = marcarDiasOutlierValorDiario(sbdUteis);
    const filtrado = agregarPartesDoMes(sbdUteis, daysInMonth, mk, outlierInfo.diasNormais);

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

    for (const p of PARTES_LIST) {
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
      partesValor: Object.fromEntries(PARTES_LIST.map((p) => [p, roundMoney(bruto.parts[p])])),
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
      partesValorOrganico: Object.fromEntries(PARTES_LIST.map((p) => [p, roundMoney(filtrado.parts[p])])),
    });
  }

  return {
    janela: `${monthKeys[0]} a ${monthKeys[monthKeys.length - 1]}`,
    dataCorte: hojeKey,
    regras: {
      partesNoMes: PARTES_NO_MES,
      diasContados: 'segunda a sábado (domingo excluído do total e das partes)',
    },
    pagina1_bruto: pagina1,
    pagina2_organico: pagina2,
    padraoPartes: {
      bruto: PARTES_LIST.map((p) => ({ parte: p, pctMedio: mean(partMeanRaw[p]) })),
      organico: PARTES_LIST.map((p) => ({ parte: p, pctMedio: mean(partMeanFilt[p]) })),
    },
    outliersDiarios,
  };
}