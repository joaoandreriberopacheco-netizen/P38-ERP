import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Package, FileText, X, Percent, Minus, Plus } from 'lucide-react';
import { shareOrDownloadHtmlDocument, shouldUseMobileDocumentExport } from '@/lib/mobilePrintAndShare';
import { filterAndSortProducts } from '@/components/compras/productMatchingUtils';
import { getPrecoPisoCustoUnidade, parsePrecoDigitado } from '@/lib/orcamentoPrecoTabela';
import { toast } from 'sonner';

const fmtCurrency = (value) => `R$ ${(Number(value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtNumber = (value) => (Number(value) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

function resolvePrice(product, tableFactor) {
  return (product?.preco_venda_padrao || 0) * (tableFactor || 1);
}

function resolveMinPrice(product) {
  return product?.preco_venda_padrao || 0;
}

function QuoteRow({ item, onQtyChange, onDiscountChange, onPriceChange, onPriceBlur, onRemove }) {
  const subtotal = item.price * item.quantity;
  const total = Math.max(subtotal - item.discount, 0);

  return (
    <div className="rounded-2xl bg-card/95 dark:bg-[#233044] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground dark:text-foreground">{item.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Estoque {fmtNumber(item.stock)}</span>
            <span>Unit. {fmtCurrency(item.price)}</span>
            {item.freePrice && (
              <span className="text-amber-600 dark:text-amber-300">Piso custo {fmtCurrency(item.minPrice)}</span>
            )}
          </div>
        </div>
        <button onClick={() => onRemove(item.id)} className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted dark:hover:text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-muted/40 dark:bg-[#2b3446] p-2.5">
          <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground dark:text-foreground/90">Quantidade</div>
          <div className="flex items-center gap-2">
            <button onClick={() => onQtyChange(item.id, item.quantity - 1)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-card dark:bg-[#1f2737] text-muted-foreground dark:text-foreground shadow-sm">
              <Minus className="h-4 w-4" />
            </button>
            <Input
              type="number"
              inputMode="decimal"
              value={item.quantity}
              min="1"
              onChange={(e) => onQtyChange(item.id, e.target.value)}
              className="h-9 border-0 bg-transparent px-0 text-center text-sm font-semibold text-foreground shadow-none focus-visible:ring-0 dark:text-white"
            />
            <button onClick={() => onQtyChange(item.id, item.quantity + 1)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-card dark:bg-[#1f2737] text-muted-foreground dark:text-foreground shadow-sm">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-muted/40 dark:bg-[#2b3446] p-2.5">
          <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground dark:text-foreground/90">Preço unit.</div>
          <div className="relative">
            <Input
              type="text"
              inputMode="decimal"
              value={item.priceDraft ?? item.price}
              onChange={(e) => onPriceChange(item.id, e.target.value)}
              onBlur={() => onPriceBlur(item.id)}
              className="h-9 border-0 bg-card dark:bg-[#1f2737] pr-10 text-right text-sm font-semibold text-foreground shadow-sm focus-visible:ring-0 dark:text-white"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground dark:text-foreground/90">R$</span>
          </div>
          {item.freePrice && <div className="mt-1 text-[10px] text-amber-600 dark:text-amber-300">Preço livre</div>}
        </div>

        <div className="rounded-2xl bg-muted/40 dark:bg-[#2b3446] p-2.5">
          <div className="mb-2 flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground dark:text-foreground/90">
            <Percent className="h-3 w-3" /> Desconto
          </div>
          <div className="relative">
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              value={item.discount}
              onChange={(e) => onDiscountChange(item.id, e.target.value)}
              className="h-9 border-0 bg-card dark:bg-[#1f2737] pr-10 text-right text-sm font-semibold text-foreground shadow-sm focus-visible:ring-0 dark:text-white"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground dark:text-foreground/90">R$</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Total</span>
        <span className="font-semibold text-foreground dark:text-foreground">{fmtCurrency(total)}</span>
      </div>
    </div>
  );
}

function BudgetContent({ onClose, isMobile }) {
  const [products, setProducts] = useState([]);
  const [priceTable, setPriceTable] = useState(null);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedQuantity, setSelectedQuantity] = useState('1');
  const [selectedPrice, setSelectedPrice] = useState('0');

  useEffect(() => {
    const load = async () => {
      const [productsData, me, tables] = await Promise.all([
        base44.entities.Produto.filter({ ativo: true }),
        base44.auth.me(),
        base44.entities.TabelaPreco.filter({ ativo: true })
      ]);

      let selectedTable = tables.find((table) => table.id === me?.tabela_preco_id) || tables.find((table) => table.is_default) || tables[0] || null;
      setPriceTable(selectedTable);
      setProducts(productsData);
    };

    load();
  }, []);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return [];
    return filterAndSortProducts(products, search);
  }, [products, search]);

  useEffect(() => {
    if (!search.trim()) {
      setSelectedProduct(null);
      return;
    }
    const first = filteredProducts[0];
    if (!first) return;
    setSelectedProduct(first);
    setSelectedQuantity('1');
    setSelectedPrice(String(resolvePrice(first, priceTable?.fator_ajuste || 1)));
  }, [search, filteredProducts, priceTable]);

  const quoteTotal = useMemo(() => items.reduce((sum, item) => sum + Math.max((item.price * item.quantity) - item.discount, 0), 0), [items]);

  const handleAdd = () => {
    if (!selectedProduct) return;
    const quantity = Math.max(Number(selectedQuantity) || 1, 1);
    const precoTabela = resolvePrice(selectedProduct, priceTable?.fator_ajuste || 1);
    const pisoCusto = getPrecoPisoCustoUnidade(selectedProduct);
    let price = precoTabela;
    if (selectedProduct.preco_livre) {
      const parsed = parsePrecoDigitado(selectedPrice);
      if (!Number.isFinite(parsed)) {
        toast.error('Informe um preço válido');
        return;
      }
      if (parsed < pisoCusto) {
        toast.error(`Preço mínimo: ${fmtCurrency(pisoCusto)} (custo)`);
        return;
      }
      price = parsed;
    }
    const existing = items.find((item) => item.id === selectedProduct.id);
    if (existing) {
      setItems((current) => current.map((item) => item.id === selectedProduct.id ? { ...item, quantity: item.quantity + quantity, price } : item));
    } else {
      setItems((current) => [...current, {
        id: selectedProduct.id,
        name: selectedProduct.nome,
        stock: selectedProduct.estoque_atual || 0,
        quantity,
        price,
        minPrice: getPrecoPisoCustoUnidade(selectedProduct),
        discount: 0,
        freePrice: !!selectedProduct.preco_livre,
      }]);
    }
    setSearch('');
    setSelectedProduct(null);
    setSelectedQuantity('1');
  };

  const handleQtyChange = (id, value) => {
    const quantity = Math.max(Number(value) || 1, 1);
    setItems((current) => current.map((item) => item.id === id ? { ...item, quantity } : item));
  };

  const handleDiscountChange = (id, value) => {
    const discount = Math.max(Number(value) || 0, 0);
    setItems((current) => current.map((item) => item.id === id ? { ...item, discount } : item));
  };

  const handlePriceChange = (id, value) => {
    setItems((current) => current.map((item) => {
      if (item.id !== id) return item;
      return { ...item, priceDraft: value };
    }));
  };

  const handlePriceBlur = (id) => {
    setItems((current) => current.map((item) => {
      if (item.id !== id) return item;
      const raw = item.priceDraft ?? String(item.price);
      const parsed = parsePrecoDigitado(raw);
      if (!item.freePrice) {
        return { ...item, priceDraft: undefined };
      }
      if (!Number.isFinite(parsed)) {
        toast.error('Preço inválido — voltou ao valor anterior');
        return { ...item, priceDraft: undefined };
      }
      if (parsed < item.minPrice) {
        toast.error(`Preço mínimo: ${fmtCurrency(item.minPrice)} (custo)`);
        return { ...item, priceDraft: undefined };
      }
      return { ...item, price: parsed, priceDraft: undefined };
    }));
  };

  const handleRemove = (id) => setItems((current) => current.filter((item) => item.id !== id));

  const handleGeneratePdf = async () => {
    if (items.length === 0) return;

    const rows = items.map((item) => {
      const total = Math.max((item.price * item.quantity) - item.discount, 0);
      return `
        <tr>
          <td>${item.name}</td>
          <td>${fmtNumber(item.quantity)}</td>
          <td>${fmtCurrency(item.price)}</td>
          <td>${fmtCurrency(item.discount)}</td>
          <td>${fmtCurrency(total)}</td>
        </tr>
      `;
    }).join('');

    const docHtml = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Orçamento rápido</title>
          <style>
            body { font-family: 'DIN 1451', DINish, system-ui, sans-serif; padding: 24px; color: #111827; }
            h1 { margin: 0 0 8px; font-size: 22px; }
            p { margin: 0 0 16px; color: #6b7280; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; font-size: 13px; }
            th { color: #6b7280; font-weight: 600; }
            .total { margin-top: 18px; text-align: right; font-size: 18px; font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>Orçamento rápido</h1>
          <p>${customerName ? `Cliente: ${customerName}<br/>` : ''}Gerado em ${new Date().toLocaleString('pt-BR')}</p>
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Qtd</th>
                <th>Preço</th>
                <th>Desc.</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="total">Total geral: ${fmtCurrency(quoteTotal)}</div>
        </body>
      </html>
    `;

    if (shouldUseMobileDocumentExport()) {
      try {
        const r = await shareOrDownloadHtmlDocument(docHtml, `orcamento-rapido-${Date.now()}.html`, 'Orçamento rápido');
        if (r === 'downloaded') toast.success('Arquivo baixado — abra e use Compartilhar se quiser');
      } catch (e) {
        if (e?.name !== 'AbortError') toast.error('Não foi possível exportar o orçamento');
      }
      return;
    }

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(docHtml);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="flex items-center justify-between px-4 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Amigo rápido</p>
          <h2 className="font-glacial text-lg font-semibold text-foreground">Orçamento rápido</h2>
        </div>
        <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground dark:bg-muted dark:text-foreground/90">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid flex-1 gap-4 overflow-hidden px-4 pb-4 md:grid-cols-[1.05fr_0.95fr]">
        <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
          <div className="rounded-3xl bg-card/95 p-3 shadow-sm dark:bg-[#233044]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-foreground/90" />
              <Input
                autoFocus={!isMobile}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nome ou código (espaço ou ; para combinar termos)..."
                className="h-11 rounded-2xl border-0 bg-muted/40 pl-10 text-foreground shadow-none focus-visible:ring-0 dark:bg-[#1f2737] dark:text-white dark:placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="rounded-3xl bg-card/95 p-4 shadow-sm dark:bg-[#233044]">
            {selectedProduct ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-muted dark:bg-[#1f2737]">
                    <Package className="h-4 w-4 text-muted-foreground dark:text-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{selectedProduct.nome}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground dark:text-foreground/90">
                      <span>Estoque {fmtNumber(selectedProduct.estoque_atual)}</span>
                      {selectedProduct.codigo_interno && (
                        <span className="font-mono text-[10px] tracking-wide text-muted-foreground/80 dark:text-foreground/70">
                          #{selectedProduct.codigo_interno}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold text-foreground">{fmtCurrency(resolvePrice(selectedProduct, priceTable?.fator_ajuste || 1))}</span>
                      <span className="text-muted-foreground dark:text-foreground/90 line-through">{fmtCurrency(resolveMinPrice(selectedProduct))}</span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-muted/40 p-3 dark:bg-[#2b3446]">
                    <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground dark:text-foreground/90">Quantidade</div>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={selectedQuantity}
                      min="1"
                      onChange={(e) => setSelectedQuantity(e.target.value)}
                      className="h-10 rounded-2xl border-0 bg-card text-center text-sm font-semibold text-foreground shadow-sm focus-visible:ring-0 dark:bg-[#1f2737] dark:text-white"
                    />
                  </div>
                  <div className="rounded-2xl bg-muted/40 p-3 dark:bg-[#2b3446]">
                    <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground dark:text-foreground/90">Preço unit.</div>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={selectedPrice}
                      onChange={(e) => setSelectedPrice(e.target.value)}
                      className="h-10 rounded-2xl border-0 bg-card text-right text-sm font-semibold text-foreground shadow-sm focus-visible:ring-0 dark:bg-[#1f2737] dark:text-white"
                    />
                    {selectedProduct.preco_livre && <div className="mt-1 text-[10px] text-amber-600 dark:text-amber-300">Preço livre habilitado</div>}
                  </div>
                </div>

                <Button onClick={handleAdd} className="h-11 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-card dark:text-foreground dark:hover:bg-muted">
                  Adicionar ao orçamento
                </Button>
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground dark:text-foreground/90">
                Digite para encontrar um item e preencher quantidade e preço sem sair da tela.
              </div>
            )}
          </div>

        </div>

        <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
          <div className="rounded-3xl bg-card/95 p-4 shadow-sm dark:bg-[#233044]">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Cliente</div>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nome para compartilhar"
                  className="h-11 rounded-2xl border-0 bg-muted/40 text-foreground shadow-none focus-visible:ring-0 dark:bg-[#1f2737] dark:text-white dark:placeholder:text-muted-foreground"
                />
              </div>
              <Button onClick={handleGeneratePdf} disabled={items.length === 0} className="h-11 rounded-2xl bg-primary px-4 text-primary-foreground hover:bg-primary/90 dark:bg-card dark:text-foreground dark:hover:bg-muted">
                <FileText className="mr-2 h-4 w-4" /> PDF / WhatsApp
              </Button>
            </div>
          </div>

          <div className="rounded-3xl bg-card/95 p-4 shadow-sm dark:bg-[#233044]">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Total geral</div>
                <div className="font-glacial text-2xl font-semibold text-foreground">{fmtCurrency(quoteTotal)}</div>
              </div>
              <div className="text-right text-xs text-muted-foreground">{items.length} item(ns)</div>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {items.length === 0 ? (
              <div className="rounded-3xl bg-card/95 px-4 py-10 text-center text-sm text-muted-foreground shadow-sm dark:bg-[#233044] dark:text-foreground/90">
                Monte um orçamento sem sair da tela atual.
              </div>
            ) : items.map((item) => (
              <QuoteRow
                key={item.id}
                item={item}
                onQtyChange={handleQtyChange}
                onDiscountChange={handleDiscountChange}
                onPriceChange={handlePriceChange}
                onPriceBlur={handlePriceBlur}
                onRemove={handleRemove}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QuickBudgetSheet({ open, onOpenChange, isMobile }) {
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-[92vw] max-w-none border-0 bg-muted/40 p-0 dark:bg-[#1b2433] sm:max-w-none">
          <BudgetContent onClose={() => onOpenChange(false)} isMobile />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl border-0 bg-muted/40 p-0 shadow-2xl dark:bg-[#1b2433]">
        <BudgetContent onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}