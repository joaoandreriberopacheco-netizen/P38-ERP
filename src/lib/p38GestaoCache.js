import { dataMenosDiasSistema } from '@/components/utils/dateUtils';
import { isValidGestaoDateKey } from '@/lib/fetchPedidosVendaGestao';

/** Período civilmente fechado: data fim anterior a ontem (Tabatinga). */
export function isGestaoPeriodoFechado(dataFim) {
  if (!isValidGestaoDateKey(dataFim)) return false;
  return dataFim < dataMenosDiasSistema(1);
}

/** staleTime React Query para listas de gestão por intervalo de datas. */
export function getGestaoDateRangeStaleTime(dataFim) {
  return isGestaoPeriodoFechado(dataFim) ? Number.POSITIVE_INFINITY : 30 * 1000;
}
