/** Bridge sessionStorage: Orçamento rápido → PDV vendedor. */
export const ORCAMENTO_RAPIDO_PDV_KEY = 'p38_orcamento_rapido_para_pdv';
const TTL_MS = 30 * 60 * 1000;

export function prepararOrcamentoParaPdv({
  items = [],
  clienteNome = '',
  observacoes = '',
  valorDesconto = 0,
  orcamentoId = '',
  orcamentoNumero = '',
} = {}) {
  const payload = {
    ts: Date.now(),
    items,
    clienteNome,
    observacoes,
    valorDesconto: Number(valorDesconto) || 0,
    orcamentoId,
    orcamentoNumero,
  };
  sessionStorage.setItem(ORCAMENTO_RAPIDO_PDV_KEY, JSON.stringify(payload));
  return payload;
}

export function consumirOrcamentoParaPdv() {
  try {
    const raw = sessionStorage.getItem(ORCAMENTO_RAPIDO_PDV_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(ORCAMENTO_RAPIDO_PDV_KEY);
    const data = JSON.parse(raw);
    if (!data?.ts || Date.now() - data.ts > TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}
