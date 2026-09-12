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
import AutoShellHeader from './AutoShellHeader';
import {
  AUTO_COVER_CLASS,
  AUTO_COVER_MUTED,
  AUTO_PRIMARY_BTN,
  AUTO_PAGE_CANVAS,
  AUTO_FIELD_CLASS,
  AUTO_ACCENT_TEXT,
  AUTO_CITRUS_TEXT,
  AUTO_SECTION_TITLE,
  AUTO_SUBHEADING,
  AUTO_PRICE,
  AUTO_STICKY_BAR,
  AUTO_STORE_MAX,
  AUTO_LABEL,
  AUTO_VITRINE_CARD,
  AUTO_EYEBROW,
  AUTO_TOOLBAR,
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
    <div className={`flex-1 flex flex-col h-full min-h-0 ${AUTO_PAGE_CANVAS} overflow-hidden`}>
      {avisos.length > 0 && (
        <div className={`${AUTO_COVER_CLASS} py-1.5 overflow-hidden shrink-0`}>
          <div className="animate-marquee whitespace-nowrap flex gap-8 text-sm">
            {avisos.map((aviso, i) => (
              <span key={i} className={`flex items-center gap-2 px-4 font-medium ${AUTO_CITRUS_TEXT}`}>
                <Megaphone className="w-4 h-4 shrink-0 text-[#e8b824]" />
                {aviso.mensagem}
              </span>
            ))}
          </div>
        </div>
      )}

      <AutoShellHeader>
        <Button
          variant="ghost"
          onClick={onBack}
          className="h-11 px-3 text-[#242424] hover:bg-secondary/60"
        >
          <ArrowLeft className="w-5 h-5 mr-1" />
          Voltar
        </Button>
        <div className="flex flex-col items-center min-w-0">
          <span className={AUTO_EYEBROW}>Loja</span>
          <span className="font-medium truncate text-[#242424]">Auto-atendimento</span>
        </div>
        {cliente ? (
          <div className="flex items-center gap-2 text-sm max-w-[40%] text-[#404040]">
            <User className="w-4 h-4 shrink-0" />
            <span className="truncate">{cliente.nome}</span>
          </div>
        ) : (
          <span className={`text-xs ${AUTO_COVER_MUTED} bg-[#242424] px-2.5 py-1 rounded-full`}>
            Consumidor final
          </span>
        )}
      </AutoShellHeader>

      <div className={AUTO_TOOLBAR}>
        <div className={`${AUTO_STORE_MAX} flex gap-2`}>
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6b6b6b]" />
            <Input
              placeholder="Buscar por nome ou código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`pl-11 ${AUTO_FIELD_CLASS}`}
            />
          </div>
          {(selectedCategory || search.trim()) && (
            <Button variant="outline" onClick={clearBrowse} className={`h-12 px-4 rounded-lg border-[#d4dde4] bg-white hover:bg-[#f8fafb]`}>
              Limpar
            </Button>
          )}
        </div>
        {selectedCategory && (
          <p className={`${AUTO_SUBHEADING} mt-2 ${AUTO_STORE_MAX}`}>
            Departamento: <span className="font-medium text-[#242424]">{selectedCategory}</span>
          </p>
        )}
      </div>

      <AutoWelcomeBanner
        config={configAuto}
        onUpdateConfig={loadConfig}
        visible={carrinho.length === 0 && showCategoryPicker}
      />

      <div className="flex-1 flex flex-col min-h-0 px-4 pb-28 md:pb-4">
        <div className={`${AUTO_STORE_MAX} flex-1 flex flex-col min-h-0`}>
          <div className="flex items-center justify-between py-4 shrink-0">
            <h2 className={AUTO_SECTION_TITLE}>
              {showCategoryPicker ? 'Departamentos' : 'Produtos'}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setShowLostSales(true)} className="text-[#6b6b6b]">
              <Frown className="w-4 h-4 mr-1" />
              Não encontrou?
            </Button>
          </div>

          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {showCategoryPicker ? (
              <div className="flex-1 min-h-0 p38-stage-panel-scroll touch-pan-y">
                <AutoCategoryGrid categories={categories} onSelect={setSelectedCategory} />
                <p className={`text-center mt-8 pb-4 ${AUTO_SUBHEADING}`}>
                  Ou digite pelo menos 2 letras na busca para ver produtos em todas as categorias.
                </p>
              </div>
            ) : (
              <AutoProductGrid
                products={produtosFiltrados}
                onSelect={openProduct}
                className="flex-1 min-h-0 p38-stage-panel-scroll touch-pan-y"
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
        <div className={`${AUTO_STICKY_BAR} p-4`}>
          <div className={`${AUTO_STORE_MAX} flex items-center justify-between gap-4`}>
            <button
              type="button"
              className="flex items-center gap-3 min-w-0"
              onClick={() => setShowCartModal(true)}
            >
              <div className="relative shrink-0">
                <div className="w-11 h-11 rounded-xl bg-[#eef4f8] flex items-center justify-center text-[#4a5240]">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {totalItens}
                </span>
              </div>
              <div className="text-left min-w-0">
                <p className={AUTO_LABEL}>{totalItens} itens</p>
                <p className={AUTO_PRICE}>R$ {formatAutoMoney(totalCarrinho)}</p>
              </div>
            </button>
            <Button
              size="lg"
              className={`h-12 px-8 ${AUTO_PRIMARY_BTN} w-auto`}
              onClick={onProceed}
            >
              Pagamento
            </Button>
          </div>
        </div>
      )}

      <Dialog open={showCartModal} onOpenChange={setShowCartModal}>
        <DialogContent hideClose className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 font-din-1451 rounded-2xl border-[#e8ecef]/80">
          <div className="p-5 border-b border-[#e8ecef]/80 flex items-center justify-between bg-white">
            <div>
              <p className={AUTO_EYEBROW}>Carrinho</p>
              <h3 className="text-lg font-medium text-[#242424]">Seu pedido</h3>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setShowCartModal(false)} className="rounded-full">
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f8fafb]">
            {carrinho.map((item) => (
              <div key={item.produto_id} className={`flex items-center gap-3 rounded-2xl p-3 ${AUTO_VITRINE_CARD}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate text-[#242424]">{item.produto_nome}</p>
                  <p className="text-xs text-[#6b6b6b]">
                    R$ {formatAutoMoney(item.preco_unitario_praticado)} / {item.unidade_medida || 'UN'}
                  </p>
                </div>
                <div className={`flex items-center gap-1 rounded-lg border border-[#d4dde4] bg-[#eef4f8] px-1`}>
                  <button
                    type="button"
                    className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-white/60"
                    onClick={() => onUpdateQuantity(item.produto_id, -1)}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-6 text-center font-semibold tabular-nums">{item.quantidade}</span>
                  <button
                    type="button"
                    className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-white/60"
                    onClick={() => onUpdateQuantity(item.produto_id, 1)}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <p className="font-medium tabular-nums text-sm w-20 text-right text-[#4a5240]">
                  R$ {formatAutoMoney(item.total)}
                </p>
                <button type="button" onClick={() => onRemoveFromCart(item.produto_id)} className="text-red-500/80 p-1 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="p-5 border-t border-[#e8ecef]/80 bg-white">
            <div className="flex justify-between items-center mb-4">
              <span className={AUTO_SECTION_TITLE}>Total</span>
              <span className="text-2xl font-medium tabular-nums text-[#242424]">R$ {formatAutoMoney(totalCarrinho)}</span>
            </div>
            <Button
              className={AUTO_PRIMARY_BTN}
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
