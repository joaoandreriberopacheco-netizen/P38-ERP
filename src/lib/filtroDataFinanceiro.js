import {
  format,
  isWithinInterval,
  startOfDay,
  endOfDay,
  addDays,
  startOfMonth,
  endOfMonth,
  isBefore,
} from 'date-fns';
import { dataHoje, toLocalDateKey } from '@/components/utils/dateUtils';

export function parseDataFinanceira(value) {
  if (!value || typeof value !== 'string') return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Chave YYYY-MM-DD no fuso do negócio (Tabatinga). */
export function dataFinanceiraKey(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return toLocalDateKey(value);
}

export function hojeFinanceiroStr() {
  return dataHoje();
}

export function periodoRangeFinanceiro(periodo, cs, ce) {
  const h = new Date();
  if (periodo === 'vencidas') return { s: null, e: startOfDay(h), vencidas: true };
  if (periodo === 'hoje') return { s: startOfDay(h), e: endOfDay(h) };
  if (periodo === 'semana') return { s: startOfDay(h), e: endOfDay(addDays(h, 7)) };
  if (periodo === 'mes') return { s: startOfMonth(h), e: endOfMonth(h) };
  if (periodo === 'futuras') return { s: addDays(h, 1), e: null };
  if (periodo === 'personalizado') {
    return {
      s: cs ? startOfDay(new Date(cs)) : null,
      e: ce ? endOfDay(new Date(ce)) : null,
    };
  }
  return { s: null, e: null };
}

/** Aplica chips de período a uma data (yyyy-MM-dd ou Date parseável). */
export function passaFiltroPeriodo(dataStr, dataDate, periodo, ds, de, hojeStr) {
  if (periodo === 'vencidas') {
    if (!dataStr || dataStr >= hojeStr) return false;
  } else if (periodo === 'mes') {
    if (!dataStr || !ds || !de) return false;
    if (!isWithinInterval(new Date(`${dataStr}T12:00:00`), { start: ds, end: de })) return false;
  } else if (ds && de && dataDate) {
    if (!isWithinInterval(dataDate, { start: ds, end: de })) return false;
  } else if (ds && !de && dataDate) {
    if (isBefore(dataDate, ds)) return false;
  }
  return true;
}

export const PERIODOS_DATA_PAGAMENTO = [
  { v: 'hoje', l: 'Hoje' },
  { v: 'semana', l: '7 dias' },
  { v: 'mes', l: 'Mês' },
  { v: 'todas', l: 'Todas' },
  { v: 'personalizado', l: 'Personalizado' },
];

/** Data padrão para ocultar histórico confuso no Fluxo de Caixa (ajustável pelo utilizador). */
export const DATA_CORTE_HISTORICO_PADRAO = '2026-08-12';

const STORAGE_MOSTRAR_HISTORICO = 'p38-fluxo-mostrar-historico-anterior';
const STORAGE_OCULTAR_HISTORICO_LEGADO = 'p38-fluxo-ocultar-historico';
const STORAGE_DATA_CORTE = 'p38-fluxo-data-corte-historico';

export function lerPreferenciasCorteHistorico() {
  if (typeof window === 'undefined') {
    return { mostrarHistoricoAnterior: false, dataCorte: DATA_CORTE_HISTORICO_PADRAO };
  }
  try {
    const salvo = localStorage.getItem(STORAGE_MOSTRAR_HISTORICO);
    if (salvo !== null) {
      return {
        mostrarHistoricoAnterior: salvo === 'true',
        dataCorte: localStorage.getItem(STORAGE_DATA_CORTE) || DATA_CORTE_HISTORICO_PADRAO,
      };
    }
    const legado = localStorage.getItem(STORAGE_OCULTAR_HISTORICO_LEGADO);
    if (legado !== null) {
      return {
        mostrarHistoricoAnterior: legado !== 'true',
        dataCorte: localStorage.getItem(STORAGE_DATA_CORTE) || DATA_CORTE_HISTORICO_PADRAO,
      };
    }
    return { mostrarHistoricoAnterior: false, dataCorte: DATA_CORTE_HISTORICO_PADRAO };
  } catch {
    return { mostrarHistoricoAnterior: false, dataCorte: DATA_CORTE_HISTORICO_PADRAO };
  }
}

export function gravarPreferenciasCorteHistorico(mostrarHistoricoAnterior, dataCorte) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_MOSTRAR_HISTORICO, mostrarHistoricoAnterior ? 'true' : 'false');
    if (dataCorte) localStorage.setItem(STORAGE_DATA_CORTE, dataCorte);
  } catch {
    /* ignore quota / private mode */
  }
}

/** Por defeito oculta lançamentos anteriores à data de corte; liga "mostrar histórico" para ver tudo. */
export function passaFiltroCorteHistorico(dataKey, { mostrarHistoricoAnterior, dataCorte }) {
  if (mostrarHistoricoAnterior || !dataCorte) return true;
  if (!dataKey || dataKey === 'sem-data') return false;
  return dataKey >= dataCorte;
}

function normalizarTextoConta(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Contas de migração / transição — ocultas por defeito em Caixas e Bancos. */
export function isContaTransicao(conta) {
  if (!conta) return false;
  const tipo = normalizarTextoConta(conta.tipo);
  const nome = normalizarTextoConta(conta.nome);
  return tipo.includes('transicao') || nome.includes('transicao');
}
