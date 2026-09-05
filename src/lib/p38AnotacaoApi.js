/**
 * Hub genérico de anotações P38 (Fase 3).
 * Fallback silencioso se Supabase não estiver configurado ou RPC indisponível.
 */

import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';
import { dataHoje, dataMenosDiasSistema } from '@/components/utils/dateUtils';

export const P38_ANOTACAO_DOMAINS = {
  HOME: 'home',
  CATALOGO: 'catalogo',
  COMPRAS: 'compras',
  VENDAS_GESTAO: 'vendas_gestao',
};

function normalizeRow(data) {
  if (!data?.found || !data?.payload) return null;
  return {
    refKey: data.refKey,
    payload: data.payload,
    version: data.version ?? 1,
    computedAt: data.computedAt ?? null,
  };
}

/** @returns {Promise<object|null>} */
export async function readP38Anotacao(domain, refKey) {
  if (!domain || !refKey || !isSupabaseBrowserConfigured()) return null;

  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc('p38_anotacao_read', {
      p_domain: domain,
      p_ref_key: refKey,
    });
    if (error) return null;
    return normalizeRow(data);
  } catch {
    return null;
  }
}

/** @returns {Promise<Map<string, object>>} refKey → payload */
export async function readP38AnotacaoMany(domain, refKeys = []) {
  const empty = new Map();
  if (!domain || !isSupabaseBrowserConfigured()) return empty;

  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc('p38_anotacao_read_many', {
      p_domain: domain,
      p_ref_keys: refKeys?.length ? refKeys : null,
    });
    if (error || !data?.items) return empty;

    const map = new Map();
    for (const item of data.items) {
      if (item?.refKey && item?.payload) {
        map.set(item.refKey, item.payload);
      }
    }
    return map;
  } catch {
    return empty;
  }
}

/** KPIs de vendas do dia — lê anotação selada (dias anteriores a hoje). */
export async function readHomeAnotacao(dateKey) {
  if (!dateKey || dateKey >= dataHoje()) return null;

  const row = await readP38Anotacao(P38_ANOTACAO_DOMAINS.HOME, dateKey);
  if (!row?.payload) return null;

  const vendasHoje = Number(row.payload.vendasHoje) || 0;
  const valorVendasHoje = Number(row.payload.valorVendasHoje) || 0;
  return { vendasHoje, valorVendasHoje };
}

/**
 * Home KPI via Supabase SQL (Fase 6) — anotação selada ou cálculo live no Postgres.
 * @returns {Promise<{ vendasHoje: number, valorVendasHoje: number }|null>}
 */
export async function readHomeKpi(dateKey) {
  if (!dateKey || !isSupabaseBrowserConfigured()) return null;

  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc('home_kpi_read', {
      p_date_key: dateKey,
    });
    if (error || !data?.dateKey) return null;
    return {
      vendasHoje: Number(data.vendasHoje) || 0,
      valorVendasHoje: Number(data.valorVendasHoje) || 0,
    };
  } catch {
    return null;
  }
}

/** Versão do catálogo para invalidar cache React Query do PDV. */
export async function readCatalogoAnotacaoVersion() {
  const row = await readP38Anotacao(P38_ANOTACAO_DOMAINS.CATALOGO, 'current');
  if (!row?.payload) return null;
  return row.payload.catalogVersion ?? row.version ?? null;
}

/** Resumo de compras para chave de cache da gestão. */
export async function readComprasAnotacaoResumo() {
  const row = await readP38Anotacao(P38_ANOTACAO_DOMAINS.COMPRAS, 'gestao-resumo');
  return row?.payload ?? null;
}

function monthKeysBetween(dataInicio, dataFim) {
  const keys = [];
  const start = new Date(`${dataInicio}T12:00:00`);
  const end = new Date(`${dataFim}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return keys;

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= endMonth) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    keys.push(`${y}-${m}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

function filterHeadersByRange(headers, dataInicio, dataFim) {
  if (!Array.isArray(headers)) return [];
  return headers.filter((row) => {
    const raw = row?.created_date || row?.data_venda;
    if (!raw) return false;
    const dateKey = String(raw).slice(0, 10);
    return dateKey >= dataInicio && dateKey <= dataFim;
  });
}

function normalizeGestaoHeader(row = {}) {
  return {
    ...row,
    valor_total: row.valor_total ?? row.total ?? 0,
    total: row.total ?? row.valor_total ?? 0,
    pagamentos: row.pagamentos ?? row.dados?.pagamentos ?? [],
    vendedor_nome: row.vendedor_nome ?? row.dados?.vendedor_nome ?? null,
  };
}

function normalizeGestaoRascunho(row = {}) {
  return {
    ...row,
    valor_total: row.valor_total ?? row.total ?? 0,
    senha_atendimento: row.senha_atendimento ?? row.dados?.senha_atendimento ?? null,
    vendedor_nome: row.vendedor_nome ?? row.dados?.vendedor_nome ?? null,
  };
}

function splitGestaoRangeAteOntem(dataInicio, dataFim) {
  const hoje = dataHoje();
  const ontem = dataMenosDiasSistema(1);

  let pastStart = null;
  let pastEnd = null;
  if (dataInicio <= ontem) {
    pastStart = dataInicio;
    pastEnd = dataFim <= ontem ? dataFim : ontem;
  }

  let liveRange = null;
  if (dataFim >= hoje) {
    const liveStart = dataInicio > hoje ? dataInicio : hoje;
    if (liveStart <= dataFim) {
      liveRange = { dataInicio: liveStart, dataFim };
    }
  }

  return { pastStart, pastEnd, liveRange };
}

/**
 * Cabeçalhos parciais de gestão — passado até ontem (anotação) + só hoje live.
 * @returns {Promise<{ headers: object[], rascunhos: object[], liveRange: object|null, complete: boolean }|null>}
 */
export async function readVendasGestaoAnotacaoPartial(dataInicio, dataFim) {
  if (!dataInicio || !dataFim) return null;

  const { pastStart, pastEnd, liveRange } = splitGestaoRangeAteOntem(dataInicio, dataFim);
  const headers = [];
  const rascunhos = [];
  let pastComplete = !pastStart;

  if (pastStart && pastEnd) {
    const monthKeys = monthKeysBetween(pastStart, pastEnd);
    if (!monthKeys.length) {
      pastComplete = true;
    } else {
      const map = await readP38AnotacaoMany(P38_ANOTACAO_DOMAINS.VENDAS_GESTAO, monthKeys);
      pastComplete = true;
      for (const key of monthKeys) {
        const payload = map.get(key);
        if (!payload) {
          pastComplete = false;
          continue;
        }
        headers.push(
          ...filterHeadersByRange(payload.headers, pastStart, pastEnd).map(normalizeGestaoHeader),
        );
        rascunhos.push(
          ...filterHeadersByRange(payload.rascunhos, pastStart, pastEnd).map(normalizeGestaoRascunho),
        );
      }
    }
  }

  return {
    headers,
    rascunhos,
    liveRange,
    complete: !liveRange && pastComplete,
  };
}

/**
 * Cabeçalhos de gestão de vendas a partir de anotações mensais seladas.
 * @returns {Promise<{ headers: object[], rascunhos: object[], complete: boolean }|null>}
 */
export async function readVendasGestaoAnotacaoForRange(dataInicio, dataFim) {
  const partial = await readVendasGestaoAnotacaoPartial(dataInicio, dataFim);
  if (!partial?.complete) return null;
  return {
    headers: partial.headers,
    rascunhos: partial.rascunhos,
    complete: true,
  };
}

/** Período selado: data fim anterior a ontem (Tabatinga). */
export function isAnotacaoDateSealed(dateKey) {
  if (!dateKey) return false;
  return dateKey < dataMenosDiasSistema(1);
}
