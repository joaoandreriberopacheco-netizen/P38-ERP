import React from 'react';
import { Boxes } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  P38MobileLine,
  P38StatusLabel,
} from '@/components/ui/p38-mobile-line';
import { P38_ACCENT } from '@/components/financeiro/fluxo/financeiroP38';
import {
  buildPurchaseUnitOptions,
  pickDefaultPurchaseUnit,
  formatQuantidadeCatalogoApresentacao,
  getItemCompraExibicaoVitrine,
} from '@/lib/productUnits';
import {
  ESTOQUE_BADGE_CLASS,
  formatEstoqueQty,
  getEstoqueAtual,
  getEstoqueMinimo,
  getEstoqueStatus,
} from '@/lib/catalogProductUi';

const LINE_TITLE_CLASS =
  '[&>div>div:first-child]:text-[14px] [&>div>div:first-child]:font-semibold sm:[&>div>div:first-child]:text-[15px]';

/**
 * Linha de catálogo no pedido de compra — lista densa estilo Planejamento financeiro.
 */
export default function CatalogProdutoSearchRow({
  product,
  items = [],
  idx = 0,
  isSelected = false,
  isLocked = false,
  formatCurrency,
  catalogItemRef,
  onSelect,
  onOpenUnitSelector,
}) {
  const inCart = items.find((i) => i.produto_id === product.id);
  const purchaseOpts = buildPurchaseUnitOptions(product);
  const defaultUnit = pickDefaultPurchaseUnit(product);
  const variasUnidades = purchaseOpts.length > 1;
  const custoApresentacao = defaultUnit?.valor_unitario ?? product.valor_compra;
  const unitSigla = defaultUnit?.unidade || product.unidade_principal || 'UN';
  const status = getEstoqueStatus(product);
  const estoqueApres = formatQuantidadeCatalogoApresentacao(product, getEstoqueAtual(product));
  const minimoBase = getEstoqueMinimo(product);
  const minimoApres = minimoBase > 0
    ? formatQuantidadeCatalogoApresentacao(product, minimoBase)
    : null;

  const exibCart = inCart ? getItemCompraExibicaoVitrine(inCart, product) : null;

  const meta = (
    <>
      <span className="font-mono text-[11px] text-muted-foreground">
        #{product.codigo_interno || '—'}
      </span>
      <span
        className={cn(
          'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
          ESTOQUE_BADGE_CLASS[status],
        )}
      >
        Est. {formatEstoqueQty(estoqueApres.quantidade)} {estoqueApres.sigla}
      </span>
      {minimoApres && minimoBase > 0 ? (
        <span className="text-[11px] text-muted-foreground tabular-nums">
          Mín. {formatEstoqueQty(minimoApres.quantidade)} {minimoApres.sigla}
        </span>
      ) : null}
      {status === 'critical' ? (
        <P38StatusLabel tone="danger">Zerado</P38StatusLabel>
      ) : status === 'low' ? (
        <P38StatusLabel tone="warning">Baixo</P38StatusLabel>
      ) : null}
      {variasUnidades ? (
        <button
          type="button"
          className={cn('inline-flex items-center gap-1 text-[11px] font-semibold hover:underline', P38_ACCENT)}
          onClick={(e) => {
            e.stopPropagation();
            onOpenUnitSelector?.(product);
          }}
        >
          <Boxes className="h-3 w-3 shrink-0" aria-hidden />
          Outra un.
        </button>
      ) : null}
      {inCart ? (
        <P38StatusLabel tone="success">
          {exibCart.quantidade_formatada} {exibCart.unidade_medida} no carrinho
        </P38StatusLabel>
      ) : null}
    </>
  );

  return (
    <div ref={catalogItemRef} className="min-w-0">
      <P38MobileLine
        as="button"
        type="button"
        thinAccent
        striped={idx % 2 === 1}
        accent={inCart ? 'success' : isSelected ? 'info' : 'none'}
        disabled={isLocked}
        onClick={() => {
          if (!isLocked) onSelect?.(product);
        }}
        className={cn(
          'w-full text-left',
          LINE_TITLE_CLASS,
          'max-md:!py-3 max-md:min-h-[52px]',
          isLocked && 'pointer-events-none opacity-50',
        )}
        title={product.nome}
        subtitle={`Un. compra ${unitSigla}`}
        meta={meta}
        value={formatCurrency(custoApresentacao)}
        valueSub={inCart ? formatCurrency(inCart.total || exibCart?.total || 0) : null}
      />
    </div>
  );
}
