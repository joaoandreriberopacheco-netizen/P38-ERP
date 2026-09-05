import { dataMenosDiasSistema } from '@/components/utils/dateUtils';

export const FILTRO_COMPRAS_ULTIMOS_30_DIAS_DEFAULT = true;
export const FILTRO_COMPRAS_SOMENTE_NAO_CONCLUIDOS_DEFAULT = true;
export const FILTRO_COMPRAS_JANELA_DIAS = 30;

/** Estado inicial de statusSel alinhado ao padrão «Não concluídos». */
export function filtroComprasStatusSelInicial() {
  return FILTRO_COMPRAS_SOMENTE_NAO_CONCLUIDOS_DEFAULT ? ['__nao_concluido__'] : [];
}

/** Parâmetros de fetch alinhados aos toggles de visibilidade da lista. */
export function buildComprasGestaoFetchFilters({
  somenteNaoConcluidos = FILTRO_COMPRAS_SOMENTE_NAO_CONCLUIDOS_DEFAULT,
  ultimos30Dias = FILTRO_COMPRAS_ULTIMOS_30_DIAS_DEFAULT,
} = {}) {
  return { somenteNaoConcluidos, ultimos30Dias };
}

/**
 * Visibilidade padrão da lista de embarques (ao abrir a tela):
 * - Últimos 30 dias: ligado.
 * - Não concluídos: ligado — esconde concluídos; o utilizador pode alterar.
 */
export function passaFiltroVisibilidadePedidosCompra(
  item,
  {
    somenteNaoConcluidos = false,
    ultimos30Dias = FILTRO_COMPRAS_ULTIMOS_30_DIAS_DEFAULT,
    getDataPedido,
    isConcluido,
    janelaDias = FILTRO_COMPRAS_JANELA_DIAS,
  } = {},
) {
  const concluido = isConcluido(item);

  if (somenteNaoConcluidos) {
    return !concluido;
  }

  if (!ultimos30Dias) {
    return true;
  }

  if (!concluido) {
    return true;
  }

  const dataPedido = getDataPedido(item);
  if (!dataPedido) {
    return true;
  }

  const limite = dataMenosDiasSistema(janelaDias);
  return dataPedido >= limite;
}
