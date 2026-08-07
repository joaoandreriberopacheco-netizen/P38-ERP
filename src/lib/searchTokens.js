import { normalizeSearchText } from '@/lib/normalizeSearchText';

/** Espaço e ";" separam termos com o mesmo efeito (espaço é mais prático no mobile). */
export const SEARCH_TERM_SEPARATOR_RE = /[;\s]+/;

export function parseSearchTerms(rawTerm, normalize = normalizeSearchText) {
  return String(rawTerm || '')
    .split(SEARCH_TERM_SEPARATOR_RE)
    .map(normalize)
    .filter(Boolean);
}
