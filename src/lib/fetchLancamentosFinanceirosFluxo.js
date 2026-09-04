import { base44 } from '@/api/base44Client';
import { dataHoje, fimDiaSistemaISO, inicioDiaSistemaISO } from '@/components/utils/dateUtils';
import { format, subMonths, endOfMonth } from 'date-fns';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidFluxoDateKey(value) {
  return typeof value === 'string' && DATE_KEY_RE.test(value);
}

function dedupPorId(rows) {
  const map = new Map();
  for (const row of rows || []) {
    if (row?.id) map.set(row.id, row);
  }
  return [...map.values()];
}

function normalizeRows(rows) {
  return Array.isArray(rows) ? rows : [];
}

/**
 * Lançamentos com vencimento ou pagamento no intervalo (realizados + referência de transferências).
 */
export async function fetchLancamentosFinanceirosPeriodo({
  dataInicio,
  dataFim,
  limit = 2500,
} = {}) {
  if (!isValidFluxoDateKey(dataInicio) || !isValidFluxoDateKey(dataFim)) {
    return [];
  }

  const [porVencimento, porPagamento] = await Promise.all([
    base44.entities.LancamentoFinanceiro.filter(
      { data_vencimento: { $gte: dataInicio, $lte: dataFim } },
      '-data_vencimento',
      limit,
    ).catch(() => []),
    base44.entities.LancamentoFinanceiro.filter(
      { data_pagamento: { $gte: dataInicio, $lte: dataFim } },
      '-data_pagamento',
      limit,
    ).catch(() => []),
  ]);

  return dedupPorId([...normalizeRows(porVencimento), ...normalizeRows(porPagamento)]);
}

/**
 * Programadas / em aberto (vencidas + mês corrente) — escopo leve para o toggle do fluxo.
 */
export async function fetchLancamentosProgramadosFluxo({
  dataInicio,
  dataFim,
  limit = 1200,
} = {}) {
  if (!isValidFluxoDateKey(dataInicio) || !isValidFluxoDateKey(dataFim)) {
    return [];
  }

  const rows = await base44.entities.LancamentoFinanceiro.filter(
    { data_vencimento: { $gte: dataInicio, $lte: dataFim } },
    '-data_vencimento',
    limit,
  ).catch(() => []);

  return normalizeRows(rows);
}

/** Movimentos de caixa PDV no intervalo civil. */
export async function fetchMovimentosCaixaPeriodo({
  dataInicio,
  dataFim,
  limit = 2500,
} = {}) {
  if (!isValidFluxoDateKey(dataInicio) || !isValidFluxoDateKey(dataFim)) {
    return [];
  }

  const rows = await base44.entities.MovimentosCaixa.filter(
    {
      created_date: {
        $gte: inicioDiaSistemaISO(dataInicio),
        $lte: fimDiaSistemaISO(dataFim),
      },
    },
    '-created_date',
    limit,
  ).catch(() => []);

  return normalizeRows(rows);
}

export function mergeLancamentosFluxo(realizados = [], programados = []) {
  return dedupPorId([...normalizeRows(realizados), ...normalizeRows(programados)]);
}

/** Quando o filtro UI não define datas (ex.: “tudo”), usa janela ampla mas limitada. */
export function intervaloFetchFluxoPadrao(ds, de) {
  const hoje = dataHoje();
  if (isValidFluxoDateKey(ds) && isValidFluxoDateKey(de)) {
    return { dataInicio: ds, dataFim: de };
  }
  const hojeDate = new Date(`${hoje}T12:00:00`);
  return {
    dataInicio: format(subMonths(hojeDate, 24), 'yyyy-MM-dd'),
    dataFim: hoje,
  };
}

/** Programadas: vencimento desde o corte histórico até fim do mês corrente. */
export function intervaloProgramadasFluxo(dataCorteHistorico) {
  const hoje = dataHoje();
  const hojeDate = new Date(`${hoje}T12:00:00`);
  const inicioBusca = isValidFluxoDateKey(dataCorteHistorico)
    ? dataCorteHistorico
    : format(subMonths(hojeDate, 12), 'yyyy-MM-dd');
  return { dataInicio: inicioBusca, dataFim: format(endOfMonth(hojeDate), 'yyyy-MM-dd') };
}
