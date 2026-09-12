import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Minus, Plus, ShoppingCart, X } from 'lucide-react';
import { pickDefaultSaleUnit, getUnidadeExibicaoSigla } from '@/lib/productUnits';
import AutoProductImageGallery from './AutoProductImageGallery';
import {
  AUTO_PRIMARY_BTN,
  AUTO_SURFACE_CLASS,
  AUTO_ACCENT_TEXT,
  AUTO_ACCENT_BG,
  AUTO_CITRUS_BORDER,
  AUTO_CITRUS_TEXT,
  AUTO_BORDER_CLASS,
  AUTO_DISPLAY,
  AUTO_EYEBROW,
  AUTO_LABEL,
  AUTO_PRICE_LARGE,
  AUTO_SECTION_TITLE,
  AUTO_SUBHEADING,
  formatAutoMoney,
} from './autoAtendimentoUi';

export default function ProductDetailDialog({ isOpen, onClose, product, onConfirm }) {
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (isOpen) setQuantity(1);
  }, [isOpen, product?.id]);

  if (!product) return null;

  const displayUnit =
    pickDefaultSaleUnit(product, 1) || {
      unidade: getUnidadeExibicaoSigla(product),
      valor_unitario: product.preco_venda_padrao || 0,
    };

  const unitPrice = Number(displayUnit.valor_unitario) || 0;
  const total = unitPrice * quantity;
  const precoLabel = `R$ ${formatAutoMoney(unitPrice)} / ${displayUnit.unidade || 'UN'}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        hideClose
        className="max-w-4xl max-h-[94dvh] gap-0 overflow-hidden p-0 sm:rounded-2xl border-border/40 font-din-1451"
      >
        <div className="flex max-h-[94dvh] flex-col overflow-hidden bg-white">
          <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-4 py-3">
            <p className={AUTO_EYEBROW}>Detalhe do produto</p>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-10 w-10 rounded-full hover:bg-secondary/60"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto touch-pan-y md:flex-row">
            {/* Galeria — coluna esquerda (PDP) */}
            <div className="w-full shrink-0 border-b border-border/35 md:w-[52%] md:border-b-0 md:border-r">
              <AutoProductImageGallery
                product={product}
                precoLabel={precoLabel}
                mainClassName="min-h-[min(56vw,320px)] md:min-h-[380px]"
              />
            </div>

            {/* Informação — coluna direita (PDP) */}
            <div className="flex min-w-0 flex-1 flex-col bg-white p-5 sm:p-6 md:p-8">
              <div className="flex-1 space-y-5">
                <div>
                  <h2 className={AUTO_DISPLAY}>
                    {product.nome}
                  </h2>
                  {(product.codigo_interno || product.codigo_barras) && (
                    <p className={`mt-2 ${AUTO_SUBHEADING} text-sm`}>
                      {product.codigo_interno ? `Cód. ${product.codigo_interno}` : ''}
                      {product.codigo_interno && product.codigo_barras ? ' · ' : ''}
                      {product.codigo_barras ? `EAN ${product.codigo_barras}` : ''}
                    </p>
                  )}
                </div>

                <div className={`rounded-2xl border p-4 ${AUTO_CITRUS_BORDER} bg-[#fafafa]`}>
                  <p className={AUTO_LABEL}>Preço</p>
                  <div className="mt-1 flex flex-wrap items-baseline gap-2">
                    <span className={AUTO_PRICE_LARGE}>
                      R$ {formatAutoMoney(unitPrice)}
                    </span>
                    <span className="text-sm text-muted-foreground">/ {displayUnit.unidade || 'UN'}</span>
                  </div>
                  {quantity > 1 && (
                    <p className={`mt-2 text-sm font-medium ${AUTO_CITRUS_TEXT}`}>
                      Total: R$ {formatAutoMoney(total)}
                    </p>
                  )}
                </div>

                <div className={`flex items-center justify-between rounded-2xl border p-4 ${AUTO_SURFACE_CLASS}`}>
                  <span className={AUTO_SECTION_TITLE}>Quantidade</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ${AUTO_ACCENT_BG} ${AUTO_ACCENT_TEXT}`}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center text-lg font-bold tabular-nums">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => q + 1)}
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ${AUTO_ACCENT_BG} ${AUTO_ACCENT_TEXT}`}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className={`h-12 flex-1 rounded-xl border ${AUTO_BORDER_CLASS}`}
                >
                  Voltar
                </Button>
                <Button
                  onClick={() => {
                    onConfirm(product, quantity);
                    onClose();
                  }}
                  className={`h-12 flex-1 rounded-xl ${AUTO_PRIMARY_BTN}`}
                >
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  Adicionar · R$ {formatAutoMoney(total)}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
