import { Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import ProductSearchInputPDV from '@/components/compras/ProductSearchInputPDV';
import OcrSugestaoCriarProduto from '@/components/compras/OcrSugestaoCriarProduto';
import ProdutoThumb from '@/components/produtos/ProdutoThumb';
import { getProdutoLabel } from '@/components/compras/productMatchingUtils';
import {
  PedidoCompraItemLinhaCorpo,
  PedidoCompraItemMetaChip,
} from '@/components/compras/PedidoCompraItensListaP38';
import { P38_ACCENT } from '@/components/financeiro/fluxo/financeiroP38';
import {
  P38MobileLine,
  P38StatusPill,
  p38AccentKeyFromTone,
} from '@/components/ui/p38-mobile-line';
import { cn } from '@/lib/utils';

const LINE_TITLE_CLASS =
  '[&>div>div:first-child]:text-[14px] [&>div>div:first-child]:font-semibold sm:[&>div>div:first-child]:text-[15px]';

/**
 * Item na revisão OCR — lista densa estilo Planejamento financeiro (P38).
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
  striped = false,
}) {
  const qty = Number(item.quantidade) || 1;
  const unitPrice = getDiscountedUnitPrice(item);
  const lineTotal = qty * unitPrice;

  const selectedId =
    item.selected_product_id && item.selected_product_id !== 'create_new'
      ? item.selected_product_id
      : null;
  const catalogConfirmado = Boolean(selectedId);
  const suggestedProduct = getSuggestedProduct(item);
  const mostrarSugestaoVinculo = Boolean(suggestedProduct?.id)
    && !catalogConfirmado
    && !item.sugerir_criar_novo;
  const catalogProduto = selectedId
    ? produtos.find((p) => p.id === selectedId) || (mostrarSugestaoVinculo ? suggestedProduct : null)
    : (mostrarSugestaoVinculo ? suggestedProduct : null);
  const catalogLabel = catalogProduto ? getProdutoLabel(catalogProduto) : null;
  const temSugestaoPendente = mostrarSugestaoVinculo;

  const accentTone = item.ignored
    ? 'muted'
    : catalogConfirmado
      ? 'success'
      : temSugestaoPendente
        ? 'warning'
        : item.sugerir_criar_novo
          ? 'info'
          : 'danger';

  const metaParts = [
    item.codigo ? `Cód. ${item.codigo}` : null,
    item.marca || null,
  ].filter(Boolean);

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

  const precoLinha = (
    <span
      className={cn(
        'font-semibold tabular-nums',
        isAcrescimo ? 'text-amber-700 dark:text-amber-400' : P38_ACCENT,
      )}
    >
      R$ {formatCurrency(lineTotal)}
    </span>
  );

  const precoDetalhe = discountNumber > 0
    ? (
      <span className="text-[11px] text-muted-foreground line-through tabular-nums">
        {qty}× R$ {formatCurrency(item.preco_unitario)}
      </span>
    )
    : (
      <span className="text-[11px] text-muted-foreground tabular-nums">
        {qty}× R$ {formatCurrency(unitPrice)}
      </span>
    );

  return (
    <>
      <P38MobileLine
        thinAccent
        striped={striped}
        accent={p38AccentKeyFromTone(accentTone)}
        title={item.descricao}
        subtitle={metaParts.length ? metaParts.join(' · ') : undefined}
        meta={(
          <>
            {catalogConfirmado ? (
              <PedidoCompraItemMetaChip tone="success">Vinculado</PedidoCompraItemMetaChip>
            ) : temSugestaoPendente ? (
              <PedidoCompraItemMetaChip tone="warning">Sugestão IA</PedidoCompraItemMetaChip>
            ) : item.sugerir_criar_novo ? (
              <PedidoCompraItemMetaChip tone="info">Criar produto</PedidoCompraItemMetaChip>
            ) : (
              <PedidoCompraItemMetaChip tone="danger">Sem vínculo</PedidoCompraItemMetaChip>
            )}
            {item.confianca ? (
              <P38StatusPill tone="muted">{item.confianca}</P38StatusPill>
            ) : null}
          </>
        )}
        value={precoLinha}
        valueSub={precoDetalhe}
        trailing={(
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
            aria-label={item.ignored ? 'Incluir item no pedido' : 'Ignorar item'}
          />
        )}
        className={cn(
          LINE_TITLE_CLASS,
          'max-md:!py-3.5 max-md:min-h-[58px]',
          item.ignored && 'opacity-45',
        )}
      />

      <PedidoCompraItemLinhaCorpo className={cn(item.ignored && 'opacity-45')}>
        {catalogProduto ? (
          <div className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2.5 dark:bg-[#26262e]/80">
            <ProdutoThumb
              produto={catalogProduto}
              size="md"
              roundedClassName="rounded-lg"
              className="flex-none"
              enableGaleria
              asDiv
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {catalogConfirmado ? 'Catálogo' : 'Sugestão'}
              </p>
              <p className="mt-0.5 text-sm font-medium leading-snug text-foreground">{catalogLabel}</p>
            </div>
          </div>
        ) : null}

        {temSugestaoPendente ? (
          <Button
            type="button"
            onClick={confirmarSugestao}
            className="h-11 w-full rounded-xl bg-[#4a5240] text-sm font-semibold text-white shadow-sm hover:bg-[#4a5240]/90 dark:bg-[#a4ce33] dark:text-[#1f1d22] dark:hover:bg-[#a4ce33]/90"
          >
            <Check className="mr-2 h-4 w-4" />
            Confirmar sugestão
          </Button>
        ) : null}

        <OcrSugestaoCriarProduto
          item={item}
          index={index}
          produtos={produtos}
          onProductCreated={onProductCreated}
        />

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {catalogConfirmado ? 'Trocar produto' : 'Buscar no catálogo'}
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
            appearance="p38"
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
      </PedidoCompraItemLinhaCorpo>
    </>
  );
}
