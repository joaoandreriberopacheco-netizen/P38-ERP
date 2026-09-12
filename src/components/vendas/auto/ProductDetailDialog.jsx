import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronDown, Minus, Plus, ShoppingCart, X } from 'lucide-react';
import { pickDefaultSaleUnit, getUnidadeExibicaoSigla } from '@/lib/productUnits';
import AutoProductImageGallery from './AutoProductImageGallery';
import {
  AUTO_PDP_CTA,
  AUTO_PDP_FIELD,
  AUTO_PDP_TAB,
  AUTO_PDP_TAB_ACTIVE,
  AUTO_DISPLAY,
  AUTO_EYEBROW,
  AUTO_BODY,
  AUTO_PRICE_PDP,
  AUTO_SUBHEADING,
  formatAutoMoney,
} from './autoAtendimentoUi';

const PDP_TABS = [
  {
    id: 'detalhes',
    label: 'Detalhes',
    content: (product, displayUnit) => (
      <div className="space-y-3">
        {product.descricao ? (
          <p className={AUTO_BODY}>{product.descricao}</p>
        ) : (
          <p className={AUTO_BODY}>
            Produto disponível para retirada ou entrega conforme disponibilidade na loja.
          </p>
        )}
        <ul className={`${AUTO_BODY} space-y-1`}>
          {displayUnit?.unidade && (
            <li>
              <span className="text-[#6b6b6b]">Unidade:</span> {displayUnit.unidade}
            </li>
          )}
          {(product.categoria_nome || product.categoria) && (
            <li>
              <span className="text-[#6b6b6b]">Categoria:</span>{' '}
              {product.categoria_nome || product.categoria}
            </li>
          )}
          {product.marca && (
            <li>
              <span className="text-[#6b6b6b]">Marca:</span> {product.marca}
            </li>
          )}
        </ul>
      </div>
    ),
  },
  {
    id: 'entrega',
    label: 'Entrega',
    content: () => (
      <p className={AUTO_BODY}>
        Consulte no balcão os prazos de entrega e retirada. Produtos sob encomenda podem ter
        prazo adicional conforme fornecedor.
      </p>
    ),
  },
  {
    id: 'devolucao',
    label: 'Devolução',
    content: () => (
      <p className={AUTO_BODY}>
        Trocas e devoluções seguem a política da loja e legislação vigente. Guarde a nota fiscal
        e embalagem original quando aplicável.
      </p>
    ),
  },
];

export default function ProductDetailDialog({ isOpen, onClose, product, onConfirm }) {
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('detalhes');

  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setActiveTab('detalhes');
    }
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
  const itemCode = product.codigo_interno || product.codigo_barras;
  const activeTabDef = PDP_TABS.find((t) => t.id === activeTab) || PDP_TABS[0];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        hideClose
        className="max-w-5xl max-h-[94dvh] gap-0 overflow-hidden p-0 sm:rounded-2xl border-border/30 font-din-1451 shadow-2xl"
      >
        <div className="relative flex max-h-[94dvh] flex-col overflow-hidden bg-white">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute right-3 top-3 z-20 h-10 w-10 rounded-full bg-white/90 shadow-sm hover:bg-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </Button>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto touch-pan-y md:flex-row">
            {/* Galeria — ~60% (referência PDP) */}
            <div className="w-full shrink-0 md:w-[58%]">
              <AutoProductImageGallery
                product={product}
                precoLabel={precoLabel}
                variant="pdp"
                mainClassName="min-h-[min(58vw,360px)] md:min-h-[480px]"
              />
            </div>

            {/* Informação — ~40% editorial */}
            <div className="flex min-w-0 flex-1 flex-col bg-white px-5 py-6 sm:px-8 sm:py-8 md:max-w-[42%]">
              <div className="flex-1 space-y-6">
                <header className="space-y-2 pr-10">
                  <h2 className={AUTO_DISPLAY}>{product.nome}</h2>
                  {itemCode && (
                    <p className={`${AUTO_EYEBROW} normal-case tracking-[0.06em]`}>
                      Código {itemCode}
                    </p>
                  )}
                </header>

                {product.descricao && (
                  <p className={`${AUTO_SUBHEADING} line-clamp-4`}>{product.descricao}</p>
                )}

                <div className="space-y-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className={AUTO_PRICE_PDP}>R$ {formatAutoMoney(unitPrice)}</span>
                    <span className="text-sm text-[#6b6b6b]">/ {displayUnit.unidade || 'UN'}</span>
                  </div>
                  {quantity > 1 && (
                    <p className="text-sm font-medium text-[#4a5240]">
                      Total: R$ {formatAutoMoney(total)}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                  <div className={`${AUTO_PDP_FIELD} flex items-center justify-between sm:max-w-[140px]`}>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-[#242424] hover:bg-white/60"
                      aria-label="Diminuir quantidade"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-[2rem] text-center text-base font-semibold tabular-nums">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => q + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-[#242424] hover:bg-white/60"
                      aria-label="Aumentar quantidade"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <ChevronDown className="ml-1 h-4 w-4 text-[#6b6b6b] opacity-60" aria-hidden="true" />
                  </div>

                  <Button
                    onClick={() => {
                      onConfirm(product, quantity);
                      onClose();
                    }}
                    className={`${AUTO_PDP_CTA} sm:flex-1`}
                  >
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    Adicionar ao carrinho
                  </Button>
                </div>
              </div>

              <footer className="mt-8 border-t border-border/40 pt-5">
                <nav className="flex flex-wrap gap-6 sm:gap-8" aria-label="Informações do produto">
                  {PDP_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={activeTab === tab.id ? AUTO_PDP_TAB_ACTIVE : AUTO_PDP_TAB}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
                <div className="mt-4 min-h-[4.5rem]">
                  {activeTabDef.content(product, displayUnit)}
                </div>
              </footer>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
