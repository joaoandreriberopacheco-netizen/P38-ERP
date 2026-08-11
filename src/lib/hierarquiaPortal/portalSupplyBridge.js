/** Chave sessionStorage — ponte Portal SMART SUPPLY → Sugestões de Compra. */
export const PORTAL_SUPPLY_BRIDGE_KEY = 'p38_portal_supply_bridge';

/**
 * Grava contexto da LINHA/esquadra e abre Sugestões de Compra (cotação fornecedor).
 * @returns {string} path para navigate/Link
 */
export function buildPortalSupplyBridgePayload({ linhaCodigo, linhaNome, produtoCompraNome, pontoFuturoLabel, veredicto }) {
  const searchTerm = produtoCompraNome || linhaNome || '';
  return {
    searchTerm,
    linha_codigo: linhaCodigo || '',
    linha_nome: linhaNome || '',
    produto_compra: produtoCompraNome || '',
    ponto_futuro: pontoFuturoLabel || '',
    veredicto: veredicto || '',
    source: 'portal_smart_supply',
    at: new Date().toISOString(),
  };
}

export function savePortalSupplyBridge(payload) {
  try {
    sessionStorage.setItem(PORTAL_SUPPLY_BRIDGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}

export function readPortalSupplyBridge() {
  try {
    const raw = sessionStorage.getItem(PORTAL_SUPPLY_BRIDGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PORTAL_SUPPLY_BRIDGE_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
