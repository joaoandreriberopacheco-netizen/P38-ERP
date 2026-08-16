import { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  ShoppingCart,
  ArrowLeft,
  User,
  Package,
  Frown,
  Minus,
  Plus,
  Trash2,
  Megaphone,
  X,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import ProductDetailDialog from './ProductDetailDialog';
import AutoWelcomeBanner from './AutoWelcomeBanner';
import AutoLostSales from './AutoLostSales';
import AutoCategoryGrid from './AutoCategoryGrid';
import AutoProductGrid from './AutoProductGrid';
import {
  AUTO_HEADER_CLASS,
  AUTO_PRIMARY_BTN,
  AUTO_SURFACE_CLASS,
  AUTO_SHELL_BG,
  AUTO_FIELD_CLASS,
  AUTO_ACCENT_TEXT,
  AUTO_ACCENT_BG,
  buildCategoryStructure,
  formatAutoMoney,
} from './autoAtendimentoUi';

export default function AutoShop({
  produtos,
  carrinho,
  cliente,
  onAddToCart,
  onRemoveFromCart,
  onUpdateQuantity,
  onProceed,
  onBack,
}) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showCartModal, setShowCartModal] = useState(false);
  const [showLostSales, setShowLostSales] = useState(false);
  const [avisos, setAvisos] = useState([]);
  const [configAuto, setConfigAuto] = useState(null);
  const [selectedProductForDetail, setSelectedProductForDetail] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const loadConfig = useCallback(async () => {
    const configs = await base44.entities.ConfigAutoAtendimento.list();
    if (configs.length > 0) {
      setConfigAuto(configs[0]);
      return;
    }
    const newConfig = await base44.entities.ConfigAutoAtendimento.create({
      titulo_boas_vindas: 'Bem-vindo à Loja!',
      subtitulo_boas_vindas: 'Escolha um departamento ou busque o produto.',
      ativo: true,
    });
    setConfigAuto(newConfig);
  }, []);

  useEffect(() => {
    base44.entities.AvisosAuto.list().then(setAvisos).catch(console.error);
    loadConfig();
  }, [loadConfig]);

  const categories = useMemo(() => buildCategoryStructure(produtos), [produtos]);

  const produtosFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    const browsing = Boolean(selectedCategory) || term.length >= 2;
    if (!browsing) return [];

    return produtos.filter((p) => {
      const matchSearch =
        !term ||
        p.nome?.toLowerCase().includes(term) ||
        (p.codigo_interno && String(p.codigo_interno).toLowerCase().includes(term)) ||
        (p.codigo_barras && String(p.codigo_barras).includes(term));

      if (!matchSearch) return false;
      if (!selectedCategory) return true;

      const catName = p.categoria_nome || p.categoria || 'Outros';
      return catName === selectedCategory || catName.startsWith(`${selectedCategory} > `);
    });
  }, [produtos, search, selectedCategory]);

  const showCategoryPicker = !selectedCategory && search.trim().length < 2;
  const totalCarrinho = carrinho.reduce((acc, item) => acc + item.total, 0);
  const totalItens = carrinho.reduce((acc, item) => acc + item.quantidade, 0);

  const openProduct = (product) => {
    setSelectedProductForDetail(product);
    setIsDetailOpen(true);
  };

  const clearBrowse = () => {
    setSelectedCategory(null);
    setSearch('');
  };

  return (
    <div className={`flex-1 flex flex-col h-full ${AUTO_SHELL_BG} overflow-hidden`}>
      {avisos.length > 0 && (
        <div className="bg-indigo-600 text-white py-1.5 overflow-hidden shrink-0">
          <div className="animate-marquee whitespace-nowrap flex gap-8 text-sm">
            {avisos.map((aviso, i) => (
              <span key={i} className="flex items-center gap-2 px-4 font-medium">
                <Megaphone className="w-4 h-4 shrink-0" />
                {aviso.mensagem}
              </span>
            ))}
          </div>
        </div>
      )}

      <header className={AUTO_HEADER_CLASS}>
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-white hover:bg-indigo-700 hover:text-white h-11 px-3"
        >
          <ArrowLeft className="w-5 h-5 mr-1" />
          Voltar
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          <ShoppingCart className="w-5 h-5 shrink-0" />
          <span className="font-bold truncate">Auto-atendimento</span>
        </div>
        {cliente ? (
          <div className="flex items-center gap-2 text-sm max-w-[40%]">
            <User className="w-4 h-4 shrink-0" />
            <span className="truncate">{cliente.nome}</span>
          </div>
        ) : (
          <span className="text-xs text-indigo-100">Consumidor final</span>
        )}
      </header>

      <div className="px-4 py-3 bg-white dark:bg-card border-b border-[#dce0d4] dark:border-border/40 shrink-0">
        <div className="max-w-4xl mx-auto flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`pl-10 h-12 text-base rounded-xl ${AUTO_FIELD_CLASS}`}
            />
          </div>
          {(selectedCategory || search.trim()) && (
            <Button variant="outline" onClick={clearBrowse} className="h-12 px-4 rounded-xl">
              Limpar
            </Button>
          )}
        </div>
        {selectedCategory && (
          <p className="text-sm text-muted-foreground mt-2 max-w-4xl mx-auto">
            Departamento: <span className="font-medium text-foreground">{selectedCategory}</span>
          </p>
        )}
      </div>

      <AutoWelcomeBanner config={configAuto} onUpdateConfig={loadConfig} visible={carrinho.length === 0} />

      <div className="flex-1 flex flex-col min-h-0 px-4 pb-28 md:pb-4">
        <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between py-3 shrink-0">
            <h2 className="text-lg font-bold text-foreground">
              {showCategoryPicker ? 'Escolha um departamento' : 'Produtos'}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setShowLostSales(true)} className="text-muted-foreground">
              <Frown className="w-4 h-4 mr-1" />
              Não encontrou?
            </Button>
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            {showCategoryPicker ? (
              <div className="overflow-y-auto">
                <AutoCategoryGrid categories={categories} onSelect={setSelectedCategory} />
                <p className="text-center text-sm text-muted-foreground mt-6">
                  Ou digite pelo menos 2 letras na busca para ver produtos em todas as categorias.
                </p>
              </div>
            ) : (
              <AutoProductGrid
                products={produtosFiltrados}
                onSelect={openProduct}
                emptyFallback={
                  <div className="text-center py-16">
                    <Package className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
                    <p className="text-muted-foreground">Nenhum produto nesta busca.</p>
                    <Button variant="link" onClick={() => setShowLostSales(true)}>Sugerir produto</Button>
                  </div>
                }
              />
            )}
          </div>
        </div>
      </div>

      {carrinho.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-card border-t border-[#dce0d4] dark:border-border/40 p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.06)]">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <button
              type="button"
              className="flex items-center gap-3 min-w-0"
              onClick={() => setShowCartModal(true)}
            >
              <div className="relative shrink-0">
                <div className={`w-11 h-11 ${AUTO_ACCENT_BG} rounded-xl flex items-center justify-center ${AUTO_ACCENT_TEXT}`}>
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {totalItens}
                </span>
              </div>
              <div className="text-left min-w-0">
                <p className="text-xs text-muted-foreground">{totalItens} itens</p>
                <p className="text-xl font-bold tabular-nums">R$ {formatAutoMoney(totalCarrinho)}</p>
              </div>
            </button>
            <Button
              size="lg"
              className={`h-12 px-6 text-base ${AUTO_PRIMARY_BTN}`}
              onClick={onProceed}
            >
              Pagamento
            </Button>
          </div>
        </div>
      )}

      <Dialog open={showCartModal} onOpenChange={setShowCartModal}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-bold text-lg">Seu carrinho</h3>
            <Button variant="ghost" size="icon" onClick={() => setShowCartModal(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {carrinho.map((item) => (
              <div key={item.produto_id} className="flex items-center gap-3 border border-border/40 rounded-xl p-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.produto_nome}</p>
                  <p className="text-xs text-muted-foreground">
                    R$ {formatAutoMoney(item.preco_unitario_praticado)} / {item.unidade_medida || 'UN'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center"
                    onClick={() => onUpdateQuantity(item.produto_id, -1)}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-6 text-center font-semibold">{item.quantidade}</span>
                  <button
                    type="button"
                    className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center"
                    onClick={() => onUpdateQuantity(item.produto_id, 1)}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <p className="font-bold tabular-nums text-sm w-20 text-right">
                  R$ {formatAutoMoney(item.total)}
                </p>
                <button type="button" onClick={() => onRemoveFromCart(item.produto_id)} className="text-red-500 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="p-4 border-t bg-muted/30">
            <div className="flex justify-between items-center mb-3">
              <span className="text-muted-foreground">Total</span>
              <span className="text-2xl font-bold tabular-nums">R$ {formatAutoMoney(totalCarrinho)}</span>
            </div>
            <Button
              className={`w-full h-12 ${AUTO_PRIMARY_BTN}`}
              onClick={() => {
                setShowCartModal(false);
                onProceed();
              }}
            >
              Ir ao pagamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProductDetailDialog
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        product={selectedProductForDetail}
        onConfirm={(product, quantity) => onAddToCart(product, quantity)}
      />

      <AutoLostSales open={showLostSales} onClose={() => setShowLostSales(false)} />
    </div>
  );
}
