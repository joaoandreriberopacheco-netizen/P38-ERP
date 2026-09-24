const STORAGE_PREFIX = 'p38:pedidos-compra-gestao:';
const MAX_EMBARQUES = 120;

function storageKey(filtersKey, comprasVersion) {
  return `${STORAGE_PREFIX}${comprasVersion}:${filtersKey}`;
}

/** Cache de sessão — reabrir Embarques na mesma aba sem esperar rede (fallback silencioso). */
export function readPedidosCompraGestaoWarmCache(filtersKey, comprasVersion) {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(storageKey(filtersKey, comprasVersion));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.embarques || parsed.isListaParcial) return null;
    if (parsed.embarques.length > MAX_EMBARQUES) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePedidosCompraGestaoWarmCache(filtersKey, comprasVersion, data) {
  if (typeof sessionStorage === 'undefined' || !data?.embarques) return;
  if (data.isListaParcial || data.embarques.length > MAX_EMBARQUES) return;
  try {
    sessionStorage.setItem(storageKey(filtersKey, comprasVersion), JSON.stringify(data));
  } catch {
    /* quota — ignorar */
  }
}
