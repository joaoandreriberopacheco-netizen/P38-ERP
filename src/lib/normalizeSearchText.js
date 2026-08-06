/**
 * Normaliza texto para comparação em buscas e filtros:
 * trim, minúsculas, sem acentos nem cedilha (joão = joao, ç = c, JOÃO = joao).
 */
export function normalizeSearchText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Compara haystack com needle após normalização (substring ou prefixo). */
export function searchTextIncludes(haystack, needle, { startsWith = false } = {}) {
  const h = normalizeSearchText(haystack);
  const n = normalizeSearchText(needle);
  if (!n) return true;
  return startsWith ? h.startsWith(n) : h.includes(n);
}

/** Todos os termos devem aparecer no haystack (aceita termos brutos ou já normalizados). */
export function searchTextIncludesAll(haystack, terms, { startsWith = false } = {}) {
  const h = normalizeSearchText(haystack);
  const normalizedTerms = terms.map((t) => normalizeSearchText(t)).filter(Boolean);
  if (normalizedTerms.length === 0) return true;
  const match = startsWith
    ? (term) => h.startsWith(term)
    : (term) => h.includes(term);
  return normalizedTerms.every(match);
}
