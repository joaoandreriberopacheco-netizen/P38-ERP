import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import AutoHome from '@/components/vendas/auto/AutoHome';
import AutoIdentification from '@/components/vendas/auto/AutoIdentification';
import AutoRegister from '@/components/vendas/auto/AutoRegister';
import AutoShop from '@/components/vendas/auto/AutoShop';
import AutoPayment from '@/components/vendas/auto/AutoPayment';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { calculateBaseQuantity, getItemUnitKey, pickDefaultSaleUnit } from '@/lib/productUnits';
import {
  filterProdutosDisponiveisPdv,
  isProdutoDisponivelPdv,
} from '@/lib/hierarquiaPortal/produtoPdvDisponibilidade';
import { Loader2 } from 'lucide-react';

export default function AutoAtendimentoPage() {
  const [step, setStep] = useState('home');
  const [cliente, setCliente] = useState(null);
  const [carrinho, setCarrinho] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [pedidoFinalizado, setPedidoFinalizado] = useState(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoadingCatalog(true);
    try {
      const [prods] = await Promise.all([
        base44.entities.Produto.filter({ ativo: true }),
      ]);
      setProdutos(filterProdutosDisponiveisPdv(prods));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro ao carregar catálogo',
        description: 'Verifique a conexão e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoadingCatalog(false);
    }
  };

  const handleStart = () => {
    setStep('identification');
  };

  const handleIdentify = (clientData) => {
    setCliente(clientData);
    setStep('shop');
  };

  const handleSkipIdentification = () => {
    setCliente(null);
    setStep('shop');
  };

  const handleGoToRegister = () => {
    setStep('register');
  };

  const handleRegisterSuccess = (newClient) => {
    setCliente(newClient);
    setStep('shop');
  };

  const handleAddToCart = (produto, quantidade = 1) => {
    if (!isProdutoDisponivelPdv(produto)) {
      toast({
        title: 'Produto na reserva',
        description: 'Este item não está disponível para venda.',
        variant: 'destructive',
      });
      return;
    }

    setCarrinho((prev) => {
      const defaultUnit =
        pickDefaultSaleUnit(produto, 1) || {
          unidade: produto.unidade_principal || 'UN',
          fator_conversao: 1,
          valor_unitario: produto.preco_venda_padrao || 0,
        };
      const fator = Number(defaultUnit.fator_conversao) || 1;
      const preco = Number(defaultUnit.valor_unitario ?? produto.preco_venda_padrao ?? 0) || 0;
      const unidade = defaultUnit.unidade || produto.unidade_principal || 'UN';
      const itemKey = getItemUnitKey(produto.id, unidade);
      const existing = prev.find(
        (item) => (item.item_key || getItemUnitKey(item.produto_id, item.unidade_medida)) === itemKey
      );

      if (existing) {
        const novaQuantidade = existing.quantidade + quantidade;
        return prev.map((item) =>
          (item.item_key || getItemUnitKey(item.produto_id, item.unidade_medida)) === itemKey
            ? {
                ...item,
                quantidade: novaQuantidade,
                quantidade_base: calculateBaseQuantity(novaQuantidade, fator),
                total: novaQuantidade * item.preco_unitario_praticado,
              }
            : item
        );
      }

      return [
        ...prev,
        {
          item_key: itemKey,
          produto_id: produto.id,
          produto_nome: produto.nome,
          quantidade,
          quantidade_base: calculateBaseQuantity(quantidade, fator),
          unidade_medida: unidade,
          fator_conversao: fator,
          preco_unitario_praticado: preco,
          total: quantidade * preco,
          imagem: produto.imagem_url,
        },
      ];
    });
  };

  const handleRemoveFromCart = (produtoId) => {
    setCarrinho((prev) => prev.filter((item) => item.produto_id !== produtoId));
  };

  const handleUpdateQuantity = (produtoId, delta) => {
    setCarrinho((prev) =>
      prev
        .map((item) => {
          if (item.produto_id !== produtoId) return item;
          const newQty = Math.max(0, item.quantidade + delta);
          return {
            ...item,
            quantidade: newQty,
            quantidade_base: calculateBaseQuantity(newQty, item.fator_conversao || 1),
            total: newQty * item.preco_unitario_praticado,
          };
        })
        .filter((item) => item.quantidade > 0)
    );
  };

  const handleProceedToPayment = () => {
    if (carrinho.length === 0) return;
    setStep('payment');
  };

  const handlePaymentSuccess = (pedido) => {
    setPedidoFinalizado(pedido);
    setStep('success');
    setTimeout(() => {
      setStep('home');
      setCarrinho([]);
      setCliente(null);
      setPedidoFinalizado(null);
    }, 10000);
  };

  const handleBack = () => {
    if (step === 'register') setStep('identification');
    if (step === 'shop') setStep('identification');
    if (step === 'payment') setStep('shop');
  };

  if (loadingCatalog && step !== 'home') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/40 gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        <p className="text-muted-foreground">Carregando catálogo...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 dark:bg-background overflow-hidden flex flex-col">
      <AnimatePresence mode="wait">
        {step === 'home' && <AutoHome key="home" onStart={handleStart} />}
        {step === 'identification' && (
          <AutoIdentification
            key="identification"
            onIdentify={handleIdentify}
            onSkip={handleSkipIdentification}
            onRegister={handleGoToRegister}
            onBack={() => setStep('home')}
          />
        )}
        {step === 'register' && (
          <AutoRegister
            key="register"
            onSuccess={handleRegisterSuccess}
            onBack={() => setStep('identification')}
          />
        )}
        {step === 'shop' && (
          <AutoShop
            key="shop"
            produtos={produtos}
            carrinho={carrinho}
            cliente={cliente}
            onAddToCart={handleAddToCart}
            onRemoveFromCart={handleRemoveFromCart}
            onUpdateQuantity={handleUpdateQuantity}
            onProceed={handleProceedToPayment}
            onBack={handleBack}
          />
        )}
        {step === 'payment' && (
          <AutoPayment
            key="payment"
            carrinho={carrinho}
            cliente={cliente}
            onSuccess={handlePaymentSuccess}
            onBack={handleBack}
          />
        )}
        {step === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6 bg-emerald-600 text-white min-h-screen"
          >
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-emerald-600 text-5xl font-bold">
              ✓
            </div>
            <h1 className="text-3xl md:text-4xl font-bold">Compra realizada!</h1>
            <p className="text-lg text-emerald-50">Aguarde a chamada para retirada.</p>
            <div className="bg-white/15 px-8 py-6 rounded-2xl backdrop-blur-sm">
              <p className="text-sm uppercase tracking-widest mb-2 opacity-90">Pedido</p>
              <p className="text-5xl font-mono font-bold">
                {pedidoFinalizado?.numero?.split('-')[1] || '—'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-8 px-8 py-3 bg-white text-emerald-700 rounded-full font-bold text-lg hover:bg-emerald-50 transition-colors"
            >
              Nova compra
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
