/**
 * Hub genérico de anotações P38 (Fase 3).
 * Fallback silencioso se Supabase não estiver configurado ou RPC indisponível.
 */

import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';
import { dataHoje, dataMenosDiasSistema } from '@/components/utils/dateUtils';
import { isGestaoPeriodoFechado } from '@/lib/p38GestaoCache';

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

/**
 * Cabeçalhos de gestão de vendas a partir de anotações mensais seladas.
 * @returns {Promise<{ headers: object[], rascunhos: object[], complete: boolean }|null>}
 */
export async function readVendasGestaoAnotacaoForRange(dataInicio, dataFim) {
  if (!dataInicio || !dataFim || !isGestaoPeriodoFechado(dataFim)) return null;

  const monthKeys = monthKeysBetween(dataInicio, dataFim);
  if (!monthKeys.length) return null;

  const currentMonth = dataHoje().slice(0, 7);
  const sealedKeys = monthKeys.filter((k) => k < currentMonth || isGestaoPeriodoFechado(dataFim));
  if (!sealedKeys.length) return null;

  const map = await readP38AnotacaoMany(P38_ANOTACAO_DOMAINS.VENDAS_GESTAO, sealedKeys);
  if (!map.size) return null;

  const headers = [];
  const rascunhos = [];
  for (const key of sealedKeys) {
    const payload = map.get(key);
    if (!payload) return null;
    headers.push(...filterHeadersByRange(payload.headers, dataInicio, dataFim));
    rascunhos.push(...filterHeadersByRange(payload.rascunhos, dataInicio, dataFim));
  }

  return {
    headers,
    rascunhos,
    complete: sealedKeys.length === monthKeys.length,
  };
}

/** Período selado: data fim anterior a ontem (Tabatinga). */
export function isAnotacaoDateSealed(dateKey) {
  if (!dateKey) return false;
  return dateKey < dataMenosDiasSistema(1);
}
