import { dataHoje } from '@/components/utils/dateUtils';
import { isValidGestaoDateKey } from '@/lib/fetchPedidosVendaGestao';

/** Período sem hoje: passado até ontem (Tabatinga). */
export function isGestaoPeriodoFechado(dataFim) {
  if (!isValidGestaoDateKey(dataFim)) return false;
  return dataFim < dataHoje();
}

/** staleTime React Query para listas de gestão por intervalo de datas. */
export function getGestaoDateRangeStaleTime(dataFim) {
  return isGestaoPeriodoFechado(dataFim) ? Number.POSITIVE_INFINITY : 30 * 1000;
}
