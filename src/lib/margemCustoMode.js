/**
 * Modo de custo no Margem / dashboard KPI.
 *
 * - cadastro_atual: preços do catálogo hoje (mês corrente, gestão ao vivo)
 * - momento_venda: custo_unitario_momento gravado na linha (meses fechados)
 */
import { toLocalDateKey } from '@/components/utils/dateUtils';
import { getCurrentMonthKey } from '@/lib/dashboardVendasPeriod';

export const MARGEM_CUSTO_CADASTRO_ATUAL = 'cadastro_atual';
export const MARGEM_CUSTO_MOMENTO_VENDA = 'momento_venda';

/** Mês civil já encerrado (anterior ao mês corrente Tabatinga). */
export function isMargemMesFechado(monthKey) {
  return String(monthKey || '').slice(0, 7) < getCurrentMonthKey();
}

/** Custo por venda: fechado → momento; corrente → cadastro. */
export function margemCustoModeParaVenda(sale) {
  const key = toLocalDateKey(sale?.created_date ?? sale?.created_at);
  if (!key) return MARGEM_CUSTO_CADASTRO_ATUAL;
  return isMargemMesFechado(key.slice(0, 7))
    ? MARGEM_CUSTO_MOMENTO_VENDA
    : MARGEM_CUSTO_CADASTRO_ATUAL;
}

/**
 * Modo para um intervalo de relatório.
 * Só usa cadastro dinâmico se o fim do intervalo cair no mês corrente.
 */
export function margemCustoModeParaIntervalo(from, to) {
  const toKey = to ? toLocalDateKey(to) : null;
  if (!toKey) return MARGEM_CUSTO_CADASTRO_ATUAL;
  return isMargemMesFechado(toKey.slice(0, 7))
    ? MARGEM_CUSTO_MOMENTO_VENDA
    : MARGEM_CUSTO_CADASTRO_ATUAL;
}

/** KPI mensal congelado — não recalcular com custos futuros. */
export function shouldFreezeMargemMonthPayload(monthKey, currentMonthKey = getCurrentMonthKey()) {
  return String(monthKey || '').slice(0, 7) < String(currentMonthKey || '').slice(0, 7);
}
