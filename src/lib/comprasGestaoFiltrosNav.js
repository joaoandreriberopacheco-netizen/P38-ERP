import { FILTRO_COMPRAS_ENCOMENDA_DEFAULT } from '@/lib/pedidoCompraEncomenda';
import {
  FILTRO_COMPRAS_SOMENTE_NAO_CONCLUIDOS_DEFAULT,
  FILTRO_COMPRAS_ULTIMOS_30_DIAS_DEFAULT,
  filtroComprasStatusSelInicial,
} from '@/lib/filtroVisibilidadePedidosCompra';

/**
 * Memória de módulo: mantém filtros ao sair da lista (detalhe/entrada) e voltar na mesma sessão SPA.
 * F5 recarrega o bundle e repõe os defaults — não usa sessionStorage/localStorage.
 */
let navFiltrosSnapshot = null;

export function buildComprasGestaoFiltrosDefault() {
  return {
    filtroUltimos30Dias: FILTRO_COMPRAS_ULTIMOS_30_DIAS_DEFAULT,
    filtroSomenteNaoConcluidos: FILTRO_COMPRAS_SOMENTE_NAO_CONCLUIDOS_DEFAULT,
    filtroEncomenda: FILTRO_COMPRAS_ENCOMENDA_DEFAULT,
    search: '',
    statusSel: filtroComprasStatusSelInicial(),
    tagsSel: [],
    dataInicial: '',
    dataFinal: '',
    etaFiltroModo: '',
    etaData: '',
    etaInicial: '',
    etaFinal: '',
    recebimentoInicial: '',
    recebimentoFinal: '',
    groupBy: 'eta_transportadora',
    sortOrder: 'asc',
    activeView: 'embarques',
  };
}

function cloneArray(value, fallback = []) {
  return Array.isArray(value) ? [...value] : [...fallback];
}

/** Estado inicial da página — defaults ou último snapshot da navegação na sessão. */
export function readComprasGestaoFiltrosNav() {
  const defaults = buildComprasGestaoFiltrosDefault();
  if (!navFiltrosSnapshot) return defaults;
  return {
    ...defaults,
    ...navFiltrosSnapshot,
    statusSel: cloneArray(navFiltrosSnapshot.statusSel, defaults.statusSel),
    tagsSel: cloneArray(navFiltrosSnapshot.tagsSel, defaults.tagsSel),
  };
}

export function writeComprasGestaoFiltrosNav(partial) {
  if (!partial || typeof partial !== 'object') return;
  navFiltrosSnapshot = {
    ...(navFiltrosSnapshot || {}),
    ...partial,
    ...(partial.statusSel != null ? { statusSel: cloneArray(partial.statusSel) } : {}),
    ...(partial.tagsSel != null ? { tagsSel: cloneArray(partial.tagsSel) } : {}),
  };
}