import { base44 } from '@/api/base44Client';
import { competenciaParaIntervalo } from '@/lib/relatorioMargemCalculos';
import { lancamentoRecorrenteContaPagarParaListaBoleto } from '@/lib/agefinLancamentosRecorrencia';
import { filtrarLancamentosPlanejamento } from '@/lib/agefinConsultaData';

const CACHE_TTL_MS = 90_000;

/** @type {{ at: number, data?: unknown[], promise?: Promise<unknown[]> } | null} */
let contasPagarAgefinCache = null;

/** @type {{ at: number, data?: unknown[], promise?: Promise<unknown[]> } | null} */
let recorrentesCache = null;

/** @type {Map<string, { at: number, data?: unknown[], promise?: Promise<unknown[]> }>} */
const mesVencimentoCache = new Map();

/** @type {Map<string, { at: number, data?: unknown[], promise?: Promise<unknown[]> }>} */
const mesBudgetCache = new Map();

function dedupPorId(rows) {
  const porId = new Map();
  for (const row of rows || []) {
    if (row?.id) porId.set(row.id, row);
  }
  return [...porId.values()];
}

/** Últimos 24 meses — cobre contas antigas sem flag is_recorrente. */
function dataLimiteRecorrentes() {
  const d = new Date();
  d.setMonth(d.getMonth() - 24);
  return d.toISOString().slice(0, 10);
}

function competenciaLimites(competencia) {
  const intervalo = competenciaParaIntervalo(competencia);
  if (!intervalo) return null;
  const from = intervalo.from.toISOString().slice(0, 10);
  const to = intervalo.to.toISOString().slice(0, 10);
  return { from, to, prefix: String(competencia || '').slice(0, 7) };
}

function lerCache(map, key) {
  const entry = map.get(key);
  if (!entry?.data) return null;
  if (Date.now() - entry.at >= CACHE_TTL_MS) {
    map.delete(key);
    return null;
  }
  return entry.data;
}

function escreverCache(map, key, data) {
  map.set(key, { at: Date.now(), data });
  return data;
}

async function comCache(map, key, fetcher) {
  const cached = lerCache(map, key);
  if (cached) return cached;

  const entry = map.get(key);
  if (entry?.promise) return entry.promise;

  const promise = fetcher()
    .then((rows) => escreverCache(map, key, Array.isArray(rows) ? rows : []))
    .catch((error) => {
      const stale = map.get(key)?.data;
      if (stale) return stale;
      throw error;
    })
    .finally(() => {
      const current = map.get(key);
      if (current?.promise) {
        const { promise: _p, ...rest } = current;
        map.set(key, rest);
      }
    });

  map.set(key, { ...(entry || {}), promise });
  return promise;
}

/**
 * Mesma carga bruta da AGEFIN Consulta (list + filtro no cliente).
 * Evita filter server-side que pode falhar no Base44 e devolver [].
 */
export async function listarLancamentosFinanceirosAgefinBruto() {
  const desde = dataLimiteRecorrentes();
  const rows = await base44.entities.LancamentoFinanceiro.filter(
    { data_vencimento: { $gte: desde } },
    '-data_vencimento',
    5000,
  ).catch(() => base44.entities.LancamentoFinanceiro.list('-data_vencimento', 5000));
  return Array.isArray(rows) ? rows : [];
}

export function invalidarCacheLancamentosFinanceiros() {
  contasPagarAgefinCache = null;
  recorrentesCache = null;
  mesVencimentoCache.clear();
  mesBudgetCache.clear();
}

/**
 * Contas a pagar recentes — mesma base que a AGEFIN Consulta (tag conta_pagar).
 * Usado para sincronizar cadastro do planejamento com o financeiro real.
 */
export async function listarContasPagarAgefinCache({ force = false } = {}) {
  const now = Date.now();
  if (!force && contasPagarAgefinCache?.data && now - contasPagarAgefinCache.at < CACHE_TTL_MS) {
    return contasPagarAgefinCache.data;
  }
  if (contasPagarAgefinCache?.promise) return contasPagarAgefinCache.promise;

  const promise = (async () => {
    const rows = await listarLancamentosFinanceirosAgefinBruto();
    return filtrarLancamentosPlanejamento(rows);
  })()
    .then((rows) => {
      const data = Array.isArray(rows) ? rows : [];
      contasPagarAgefinCache = { at: Date.now(), data };
      return data;
    })
    .catch((error) => {
      if (contasPagarAgefinCache?.data) return contasPagarAgefinCache.data;
      throw error;
    })
    .finally(() => {
      if (contasPagarAgefinCache?.promise) {
        const { promise: _p, ...rest } = contasPagarAgefinCache;
        contasPagarAgefinCache = rest;
      }
    });

  contasPagarAgefinCache = { ...(contasPagarAgefinCache || {}), promise };
  return promise;
}

/** ~25 contas recorrentes — inclui lançamentos com tag recorrente / frequência, não só is_recorrente. */
export async function listarLancamentosRecorrentesCache({ force = false } = {}) {
  const now = Date.now();
  if (!force && recorrentesCache?.data && now - recorrentesCache.at < CACHE_TTL_MS) {
    return recorrentesCache.data;
  }
  if (recorrentesCache?.promise) return recorrentesCache.promise;

  const promise = (async () => {
    const desde = dataLimiteRecorrentes();
    const [porFlag, porDespesaRecente] = await Promise.all([
      base44.entities.LancamentoFinanceiro.filter({ is_recorrente: true }, '-data_vencimento', 400).catch(
        () => [],
      ),
      base44.entities.LancamentoFinanceiro.filter(
        { tipo: 'Despesa', data_vencimento: { $gte: desde } },
        '-data_vencimento',
        1200,
      ).catch(() => []),
    ]);
    const merged = dedupPorId([...(porFlag || []), ...(porDespesaRecente || [])]);
    return merged.filter(lancamentoRecorrenteContaPagarParaListaBoleto);
  })()
    .then((rows) => {
      const data = Array.isArray(rows) ? rows : [];
      recorrentesCache = { at: Date.now(), data };
      return data;
    })
    .catch((error) => {
      if (recorrentesCache?.data) return recorrentesCache.data;
      throw error;
    })
    .finally(() => {
      if (recorrentesCache?.promise) {
        const { promise: _p, ...rest } = recorrentesCache;
        recorrentesCache = rest;
      }
    });

  recorrentesCache = { ...(recorrentesCache || {}), promise };
  return promise;
}

/** Lançamentos com vencimento na competência (pauta do mês). */
export async function listarLancamentosVencimentoCompetenciaCache(competencia) {
  const limites = competenciaLimites(competencia);
  if (!limites) return [];

  return comCache(mesVencimentoCache, limites.prefix, async () => {
    try {
      return await base44.entities.LancamentoFinanceiro.filter(
        {
          data_vencimento: { $gte: limites.from, $lte: limites.to },
        },
        '-data_vencimento',
        500,
      );
    } catch {
      const rows = await base44.entities.LancamentoFinanceiro.filter(
        { data_vencimento: { $gte: limites.from } },
        '-data_vencimento',
        500,
      );
      return (rows || []).filter(
        (l) => String(l?.data_vencimento || '').slice(0, 7) === limites.prefix,
      );
    }
  });
}

/** Lançamentos do mês para budgets/realizado (pagamento ou vencimento na competência). */
export async function listarLancamentosMesCompetenciaCache(competencia) {
  const limites = competenciaLimites(competencia);
  if (!limites) return [];

  return comCache(mesBudgetCache, limites.prefix, async () => {
    const [porPagamento, porVencimento] = await Promise.all([
      base44.entities.LancamentoFinanceiro.filter(
        { data_pagamento: { $gte: limites.from, $lte: limites.to } },
        '-data_pagamento',
        500,
      ).catch(() => []),
      base44.entities.LancamentoFinanceiro.filter(
        { data_vencimento: { $gte: limites.from, $lte: limites.to } },
        '-data_vencimento',
        500,
      ).catch(() => []),
    ]);

    const porId = new Map();
    for (const row of [...(porPagamento || []), ...(porVencimento || [])]) {
      if (row?.id) porId.set(row.id, row);
    }
    return [...porId.values()];
  });
}
