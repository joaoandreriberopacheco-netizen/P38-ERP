import { cn } from '@/lib/utils';
import {
  ESTOQUE_BADGE_CLASS,
  ESTOQUE_STATUS_CLASS,
  formatEstoqueQty,
  getEstoqueAtual,
  getEstoqueMinimo,
  getEstoqueStatus,
} from '@/lib/catalogProductUi';

/**
 * Linha compacta de estoque para cards de catálogo (compras / cotação).
 */
export default function CatalogProductStockLine({
  product,
  className,
  showMinimo = true,
  size = 'sm',
}) {
  if (!product) return null;

  const atual = getEstoqueAtual(product);
  const minimo = getEstoqueMinimo(product);
  const status = getEstoqueStatus(product);
  const textSize = size === 'md' ? 'text-sm' : 'text-xs';

  return (
    <div className={cn('flex flex-wrap items-center gap-2', textSize, className)}>
      <span className="text-muted-foreground">Estoque</span>
      <span
        className={cn(
          'inline-flex items-center rounded-md px-2 py-0.5 font-semibold tabular-nums',
          ESTOQUE_BADGE_CLASS[status],
        )}
      >
        {formatEstoqueQty(atual)}
      </span>
      {showMinimo && minimo > 0 && (
        <span className={cn('tabular-nums', ESTOQUE_STATUS_CLASS[status])}>
          Mín. {formatEstoqueQty(minimo)}
        </span>
      )}
      {status === 'critical' && (
        <span className="font-medium text-red-600 dark:text-red-400">Zerado</span>
      )}
      {status === 'low' && (
        <span className="font-medium text-amber-600 dark:text-amber-400">Baixo</span>
      )}
    </div>
  );
}
