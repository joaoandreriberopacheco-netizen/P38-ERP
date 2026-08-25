import { Checkbox } from '@/components/ui/checkbox';
import ProductSearchInputPDV from '@/components/compras/ProductSearchInputPDV';
import ProdutoThumb from '@/components/produtos/ProdutoThumb';
import { getProdutoLabel } from '@/components/compras/productMatchingUtils';
import { cn } from '@/lib/utils';

function SpecCell({ label, value, highlight = false }) {
  return (
    <div className="min-w-0">
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
 * Card de item na revisão OCR (mobile) — inspirado no carrinho Tintão / Formigres.
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

  return (
    <article
      className={cn(
        'border-b border-border/60 py-4 last:border-b-0',
        item.ignored && 'opacity-45',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="pt-1 flex-none">
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

        <ProdutoThumb
          produto={catalogProduto}
          size="lg"
          roundedClassName="rounded-lg"
          className="shadow-sm"
          enableGaleria
          asDiv
        />

        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 items-start">
            <div className="min-w-0">
              <h3 className="text-base font-bold leading-snug text-foreground">{item.descricao}</h3>
              {metaParts.length > 0 ? (
                <p className="mt-1 text-sm text-muted-foreground leading-snug">{metaParts.join(' · ')}</p>
              ) : null}
              {catalogLabel ? (
                <p
                  className={cn(
                    'mt-1.5 text-sm font-medium leading-snug',
                    catalogConfirmado
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-300',
                  )}
                >
                  {catalogConfirmado ? 'Catálogo: ' : 'Sugestão: '}
                  {catalogLabel}
                </p>
              ) : null}
            </div>
            <div className="text-right flex-none">
              {discountNumber > 0 ? (
                <p className="text-xs text-muted-foreground line-through tabular-nums">
                  {qty}× R$ {formatCurrency(item.preco_unitario)}
                </p>
              ) : null}
              <p
                className={cn(
                  'text-base font-bold tabular-nums',
                  isAcrescimo ? 'text-amber-700 dark:text-amber-400' : 'text-foreground',
                )}
              >
                R$ {formatCurrency(lineTotal)}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Subtotal
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-muted/50 p-3">
            <SpecCell label="Qtd" value={String(qty)} />
            <SpecCell label="Preço un." value={`R$ ${formatCurrency(unitPrice)}`} />
            <SpecCell label="Total" value={`R$ ${formatCurrency(lineTotal)}`} highlight />
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Produto no catálogo
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
        </div>
      </div>
    </article>
  );
}
