/** Arredonda quantidade comercial (até 6 casas). */
export function roundQuantidade(value) {
  return Math.round((Number(value) || 0) * 1_000_000) / 1_000_000;
}

/** Aceita "0,66", "0.66", "1.234,56" (milhar BR) ou número. */
export function parseQuantidadeInput(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const str = String(value ?? '').trim();
  if (!str) return 0;
  const normalized = str.includes(',') ? str.replace(/\./g, '').replace(',', '.') : str;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function clampQuantidade(value, min = 0, max = Infinity) {
  const n = roundQuantidade(value);
  if (n < min) return roundQuantidade(min);
  if (Number.isFinite(max) && n > max) return roundQuantidade(max);
  return n;
}

export function formatQuantidadeDisplay(value) {
  const n = roundQuantidade(value);
  if (!n) return '0';
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 6, minimumFractionDigits: 0 });
}

/** Passo dos botões +/- conforme a quantidade máxima do item. */
export function resolveQuantidadeStep(maxValue = 0) {
  const max = Math.abs(Number(maxValue) || 0);
  if (max > 0 && !Number.isInteger(max)) {
    const decimals = (String(max).split('.')[1] || '').length;
    return Math.pow(10, -Math.min(Math.max(decimals, 2), 6));
  }
  return 0.01;
}
