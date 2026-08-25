import { Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import ProductSearchInputPDV from '@/components/compras/ProductSearchInputPDV';
import ProdutoThumb from '@/components/produtos/ProdutoThumb';
import { getProdutoLabel } from '@/components/compras/productMatchingUtils';
import { cn } from '@/lib/utils';

function SpecCell({ label, value, highlight = false }) {
  return (
    <div className="min-w-0 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 text-sm font-bold tabular-nums leading-tight text-foreground',
          highlight && 'text-emerald-700 dark:text-emerald-400',
        )}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Card de item na revisão OCR (mobile) — layout vertical, inspirado no carrinho Tintão.
 */
export default function ImportadorOcrItemCard({
  item,
  index,
  isAcrescimo,
  discountNumber,
  getDiscountedUnitPrice,
  formatCurrency,
  produtos,
  getSuggestedProduct,
  setItems,
  setProductSearch,
  productSearch,
  onProductCreated,
  resolverUnidadeCompra,
  textoEquivEstoque,
}) {
  const qty = Number(item.quantidade) || 1;
  const unitPrice = getDiscountedUnitPrice(item);
  const lineTotal = qty * unitPrice;
  const metaParts = [
    item.codigo ? `Cód. ${item.codigo}` : null,
    item.marca || null,
    item.confianca ? `IA ${item.confianca}` : null,
  ].filter(Boolean);

  const selectedId =
    item.selected_product_id && item.selected_product_id !== 'create_new'
      ? item.selected_product_id
      : null;
  const suggestedProduct = getSuggestedProduct(item);
  const catalogProduto = selectedId
    ? produtos.find((p) => p.id === selectedId) || suggestedProduct
    : suggestedProduct;
  const catalogLabel = catalogProduto ? getProdutoLabel(catalogProduto) : null;
  const catalogConfirmado = Boolean(selectedId);
  const temSugestaoPendente = Boolean(suggestedProduct?.id) && !catalogConfirmado;

  const confirmarSugestao = () => {
    if (!suggestedProduct?.id) return;
    const label = getProdutoLabel(suggestedProduct);
    setItems((prev) =>
      prev.map((current, currentIndex) =>
        currentIndex === index
          ? {
              ...current,
              selected_product_id: suggestedProduct.id,
              produto_id_match: suggestedProduct.id,
              confianca: current.confianca || 'media',
              ignored: false,
            }
          : current,
      ),
    );
    setProductSearch((prev) => ({ ...prev, [index]: label }));
  };

  return (
    <article
      className={cn(
        'border-b border-border/60 px-3 py-4 last:border-b-0',
        item.ignored && 'opacity-45',
      )}
    >
      {/* Linha 1 — descrição do PDF + subtotal */}
      <div className="flex items-start gap-3">
        <div className="pt-0.5 flex-none">
          <Checkbox
            checked={!item.ignored}
            onCheckedChange={(checked) =>
              setItems((prev) =>
                prev.map((current, currentIndex) =>
                  currentIndex === index ? { ...current, ignored: !checked } : current,
                ),
              )
            }
            className="h-5 w-5"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold leading-snug text-foreground">{item.descricao}</h3>
          {metaParts.length > 0 ? (
            <p className="mt-1 text-sm text-muted-foreground leading-snug">{metaParts.join(' · ')}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {discountNumber > 0 ? (
              <p className="text-xs text-muted-foreground line-through tabular-nums">
                {qty}× R$ {formatCurrency(item.preco_unitario)}
              </p>
            ) : null}
            <p
              className={cn(
                'text-lg font-bold tabular-nums',
                isAcrescimo ? 'text-amber-700 dark:text-amber-400' : 'text-foreground',
              )}
            >
              R$ {formatCurrency(lineTotal)}
            </p>
          </div>
        </div>
      </div>

      {/* Linha 2 — foto + sugestão / catálogo (largura total) */}
      {catalogProduto ? (
        <div
          className={cn(
            'mt-3 flex items-center gap-3 rounded-2xl p-3',
            catalogConfirmado
              ? 'bg-emerald-50/80 dark:bg-emerald-950/25'
              : 'bg-amber-50/80 dark:bg-amber-950/20',
          )}
        >
          <ProdutoThumb
            produto={catalogProduto}
            size="lg"
            roundedClassName="rounded-xl"
            className="shadow-sm flex-none"
            enableGaleria
            asDiv
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {catalogConfirmado ? 'Vinculado ao catálogo' : 'Sugestão da IA'}
            </p>
            <p
              className={cn(
                'mt-1 text-sm font-semibold leading-snug',
                catalogConfirmado
                  ? 'text-emerald-800 dark:text-emerald-300'
                  : 'text-amber-900 dark:text-amber-200',
              )}
            >
              {catalogLabel}
            </p>
          </div>
        </div>
      ) : null}

      {temSugestaoPendente ? (
        <Button
          type="button"
          onClick={confirmarSugestao}
          className="mt-3 h-12 w-full rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <Check className="mr-2 h-4 w-4" />
          Confirmar sugestão
        </Button>
      ) : null}

      {/* Linha 3 — qtd / preço / total */}
      <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-muted/50 p-3">
        <SpecCell label="Qtd" value={String(qty)} />
        <SpecCell label="Preço un." value={`R$ ${formatCurrency(unitPrice)}`} />
        <SpecCell label="Total" value={`R$ ${formatCurrency(lineTotal)}`} highlight />
      </div>

      {/* Linha 4 — busca manual (largura total) */}
      <div className="mt-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {catalogConfirmado ? 'Trocar produto' : 'Ou buscar outro no catálogo'}
        </p>
        <ProductSearchInputPDV
          item={item}
          index={index}
          produtos={produtos}
          getSuggestedProduct={getSuggestedProduct}
          setItems={setItems}
          setProductSearch={setProductSearch}
          productSearch={productSearch}
          onProductCreated={onProductCreated}
          size="comfortable"
        />
        {catalogConfirmado ? (() => {
          const p = produtos.find((x) => x.id === selectedId);
          if (!p) return null;
          const opt = resolverUnidadeCompra(p, item.unidade_medida_documento);
          const eq = textoEquivEstoque(p, qty, opt);
          return (
            <p className="mt-2 text-sm text-muted-foreground">
              Comprar em:{' '}
              <span className="font-medium text-foreground">{opt?.unidade || p.unidade_principal || 'UN'}</span>
              {eq ? <span className="mt-0.5 block">{eq}</span> : null}
            </p>
          );
        })() : null}
      </div>
    </article>
  );
}
