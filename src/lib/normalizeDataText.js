/** Normaliza texto operacional (inputs, células, selects) para maiúsculas. */
export function normalizeDataText(value) {
  if (value == null || value === '') return value;
  return String(value).toLocaleUpperCase('pt-BR');
}
