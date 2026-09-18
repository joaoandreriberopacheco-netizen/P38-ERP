/**
 * Normaliza nome de embarcação para exibição.
 * Remove prefixos operacionais comuns (F/B, N/M) que contaminam a identificação.
 */
export function normalizeEmbarcacaoDisplayName(name = '') {
  return String(name || '')
    .replace(/^\s*(F\s*\/\s*B\.?|F\/B\.?|N\s*\/\s*M\.?|N\/M\.?|FB\.?|NM\.?)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getEmbarcacaoDisplayName(evento = {}) {
  const raw = evento.embarcacao_nome || evento.transportadora_nome || '';
  const normalized = normalizeEmbarcacaoDisplayName(raw);
  return normalized || raw || 'Embarcação';
}
