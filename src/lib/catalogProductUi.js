/**
 * Estoque e helpers visuais partilhados — busca de catálogo (normal + lote).
 */

export function getEstoqueAtual(product) {
  const n = Number(product?.estoque_atual);
  return Number.isFinite(n) ? n : 0;
}

export function getEstoqueMinimo(product) {
  const n = Number(product?.estoque_minimo);
  return Number.isFinite(n) ? n : 0;
}

/** @returns {'ok' | 'low' | 'critical'} */
export function getEstoqueStatus(product) {
  const atual = getEstoqueAtual(product);
  const minimo = getEstoqueMinimo(product);
  if (atual <= 0) return 'critical';
  if (minimo > 0 && atual <= minimo) return 'low';
  return 'ok';
}

export function formatEstoqueQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export const ESTOQUE_STATUS_CLASS = {
  ok: 'text-muted-foreground',
  low: 'text-amber-600 dark:text-amber-400',
  critical: 'text-red-600 dark:text-red-400',
};

export const ESTOQUE_BADGE_CLASS = {
  ok: 'bg-muted/80 text-foreground/90',
  low: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};
