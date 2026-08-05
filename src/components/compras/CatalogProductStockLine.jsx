import { cn } from '@/lib/utils';
import {
  ESTOQUE_BADGE_CLASS,
  ESTOQUE_STATUS_CLASS,
  formatEstoqueQty,
  getEstoqueAtual,
  getEstoqueMinimo,
  getEstoqueStatus,
} from '@/lib/catalogProductUi';
import { formatQuantidadeCatalogoApresentacao } from '@/lib/productUnits';

/**
 * Linha compacta de estoque para cards de catálogo (compras / cotação).
 * `apresentacao`: exibe na unidade de vitrine/padrão do produto (não na base fator-1).
 */
export default function CatalogProductStockLine({
  product,
  className,
  showMinimo = true,
  size = 'sm',
  apresentacao = false,
}) {
  if (!product) return null;

  const atualBase = getEstoqueAtual(product);
  const minimoBase = getEstoqueMinimo(product);
  const status = getEstoqueStatus(product);
  const textSize = size === 'md' ? 'text-sm' : 'text-xs';

  const atualApresentacao = apresentacao
    ? formatQuantidadeCatalogoApresentacao(product, atualBase)
    : null;
  const minimoApresentacao = apresentacao && minimoBase > 0
    ? formatQuantidadeCatalogoApresentacao(product, minimoBase)
    : null;

  const atualLabel = apresentacao && atualApresentacao
    ? `${formatEstoqueQty(atualApresentacao.quantidade)} ${atualApresentacao.sigla}`
    : formatEstoqueQty(atualBase);
  const minimoLabel = apresentacao && minimoApresentacao
    ? `${formatEstoqueQty(minimoApresentacao.quantidade)} ${minimoApresentacao.sigla}`
    : formatEstoqueQty(minimoBase);

  return (
    <div className={cn('flex flex-wrap items-center gap-2', textSize, className)}>
      <span className="text-muted-foreground">Estoque</span>
      <span
        className={cn(
          'inline-flex items-center rounded-md px-2 py-0.5 font-semibold tabular-nums',
          ESTOQUE_BADGE_CLASS[status],
        )}
      >
        {atualLabel}
      </span>
      {showMinimo && minimoBase > 0 && (
        <span className={cn('tabular-nums', ESTOQUE_STATUS_CLASS[status])}>
          Mín. {minimoLabel}
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
