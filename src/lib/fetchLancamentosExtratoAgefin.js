import { base44 } from '@/api/base44Client';
import { inicioDiaSistemaISO, fimDiaSistemaISO } from '@/components/utils/dateUtils';
import { boundsMesCivil, dataHoje } from '@/components/utils/dateUtils';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidExtratoDateKey(value) {
  return typeof value === 'string' && DATE_KEY_RE.test(value);
}

function normalizeRows(rows) {
  return Array.isArray(rows) ? rows : [];
}

/** Lançamentos de uma conta no período (vencimento ou pagamento). */
export async function fetchLancamentosExtratoConta({
  contaId,
  isCaixaGeral = false,
  dataInicio,
  dataFim,
  limit = 2000,
} = {}) {
  if (!isValidExtratoDateKey(dataInicio) || !isValidExtratoDateKey(dataFim)) {
    return [];
  }

  const dateFilter = {
    $gte: inicioDiaSistemaISO(dataInicio),
    $lte: fimDiaSistemaISO(dataFim),
  };

  const [porVencimento, porPagamento] = await Promise.all([
    base44.entities.LancamentoFinanceiro.filter(
      { data_vencimento: dateFilter },
      '-data_vencimento',
      limit,
    ).catch(() => []),
    base44.entities.LancamentoFinanceiro.filter(
      { data_pagamento: { $gte: dataInicio, $lte: dataFim } },
      '-data_pagamento',
      limit,
    ).catch(() => []),
  ]);

  const merged = new Map();
  for (const row of [...normalizeRows(porVencimento), ...normalizeRows(porPagamento)]) {
    if (!row?.id) continue;
    if (isCaixaGeral) {
      if (!row.conta_financeira_id) merged.set(row.id, row);
    } else if (row.conta_financeira_id === contaId) {
      merged.set(row.id, row);
    }
  }
  return [...merged.values()];
}

export async function fetchMovimentosExtratoConta({
  contaId,
  dataInicio,
  dataFim,
  limit = 1500,
} = {}) {
  if (!contaId || !isValidExtratoDateKey(dataInicio) || !isValidExtratoDateKey(dataFim)) {
    return [];
  }

  const rows = await base44.entities.MovimentosCaixa.filter(
    {
      conta_id: contaId,
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

/** Contas a pagar AGEFIN no mês civil (substitui list 5000). */
export async function fetchLancamentosSuperAgefinMes(monthDate) {
  const ymd = dataHoje();
  const year = monthDate?.getFullYear?.() ?? Number(ymd.slice(0, 4));
  const monthIndex = monthDate?.getMonth?.() ?? Number(ymd.slice(5, 7)) - 1;
  const { start, end } = boundsMesCivil(year, monthIndex);

  const rows = await base44.entities.LancamentoFinanceiro.filter(
    { data_vencimento: { $gte: start, $lte: end } },
    '-data_vencimento',
    2500,
  ).catch(() => []);

  return normalizeRows(rows);
}
