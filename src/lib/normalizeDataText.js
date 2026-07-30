/**
 * Texto da base de dados / campos operacionais → sempre maiúsculas (pt-BR).
 * Interface fixa (títulos, rótulos, botões) NÃO passa por aqui — pode usar minúsculas.
 */
export function normalizeDataText(value) {
  if (value == null || value === '') return value;
  return String(value).toLocaleUpperCase('pt-BR');
}

/** Normaliza um conjunto de chaves de texto num payload antes de gravar. */
export function normalizeDataFields(obj, keys = []) {
  if (!obj || typeof obj !== 'object' || !keys.length) return obj;
  const next = { ...obj };
  for (const key of keys) {
    if (next[key] != null && next[key] !== '') {
      next[key] = normalizeDataText(next[key]);
    }
  }
  return next;
}
