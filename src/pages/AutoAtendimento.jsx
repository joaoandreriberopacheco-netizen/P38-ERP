import React, { useState, useEffect } from 'react';
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

export default function AutoAtendimentoPage() {
  const [step, setStep] = useState('home'); // home, identification, register, shop, payment, success
  const [cliente, setCliente] = useState(null); // Cliente identificado/cadastrado
  const [carrinho, setCarrinho] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [config, setConfig] = useState(null);
  const [pedidoFinalizado, setPedidoFinalizado] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [prods, configs] = await Promise.all([
        base44.entities.Produto.filter({ ativo: true }),
        base44.entities.ConfiguracoesVenda.list()
      ]);
      setProdutos(filterProdutosDisponiveisPdv(prods));
      setConfig(configs[0]);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
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

    setCarrinho(prev => {
      const defaultUnit = pickDefaultSaleUnit(produto, 1) || { unidade: produto.unidade_principal || 'UN', fator_conversao: 1, valor_unitario: produto.preco_venda_padrao || 0 };
      const fator = Number(defaultUnit.fator_conversao) || 1;
      const preco = Number(defaultUnit.valor_unitario ?? produto.preco_venda_padrao ?? 0) || 0;
      const unidade = defaultUnit.unidade || produto.unidade_principal || 'UN';
      const itemKey = getItemUnitKey(produto.id, unidade);
      const existing = prev.find(item => (item.item_key || getItemUnitKey(item.produto_id, item.unidade_medida)) === itemKey);
      if (existing) {
        const novaQuantidade = existing.quantidade + quantidade;
        return prev.map(item => 
          (item.item_key || getItemUnitKey(item.produto_id, item.unidade_medida)) === itemKey
            ? {
                ...item,
                quantidade: novaQuantidade,
                quantidade_base: calculateBaseQuantity(novaQuantidade, fator),
                total: novaQuantidade * item.preco_unitario_praticado
              }
            : item
        );
      }
      return [...prev, {
        item_key: itemKey,
        produto_id: produto.id,
        produto_nome: produto.nome,
        quantidade: quantidade,
        quantidade_base: calculateBaseQuantity(quantidade, fator),
        unidade_medida: unidade,
        fator_conversao: fator,
        preco_unitario_praticado: preco,
        total: quantidade * preco,
        imagem: produto.imagem_url // Se tiver
      }];
    });
    toast({
      title: "Adicionado!",
      description: `${produto.nome} adicionado ao carrinho.`,
      duration: 1500
    });
  };

  const handleRemoveFromCart = (produtoId) => {
    setCarrinho(prev => prev.filter(item => item.produto_id !== produtoId));
  };

  const handleUpdateQuantity = (produtoId, delta) => {
    setCarrinho(prev => prev.map(item => {
      if (item.produto_id === produtoId) {
        const newQty = Math.max(0, item.quantidade + delta);
        return { ...item, quantidade: newQty, total: newQty * item.preco_unitario_praticado };
      }
      return item;
    }).filter(item => item.quantidade > 0));
  };

  const handleProceedToPayment = () => {
    if (carrinho.length === 0) return;
    setStep('payment');
  };

  const handlePaymentSuccess = (pedido) => {
    setPedidoFinalizado(pedido);
    setStep('success');
    // Reset após alguns segundos ou botão
    setTimeout(() => {
      setStep('home');
      setCarrinho([]);
      setCliente(null);
      setPedidoFinalizado(null);
    }, 10000); // 10 segundos na tela de sucesso
  };

  const handleBack = () => {
    if (step === 'register') setStep('identification');
    if (step === 'shop') setStep('identification');
    if (step === 'payment') setStep('shop');
  };

  return (
    <div className="min-h-screen bg-muted dark:bg-background overflow-hidden flex flex-col">
      <AnimatePresence mode="wait">
        {step === 'home' && (
          <AutoHome key="home" onStart={handleStart} />
        )}
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
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6 bg-emerald-600 text-white"
          >
            <div className="w-32 h-32 bg-card rounded-full flex items-center justify-center text-emerald-600 text-6xl">
              ✓
            </div>
            <h1 className="text-4xl font-bold">Compra Realizada!</h1>
            <p className="text-xl opacity-90">Retire sua senha e aguarde a chamada.</p>
            <div className="bg-card/20 p-6 rounded-xl backdrop-blur-sm mt-8">
              <p className="text-sm uppercase tracking-widest mb-2">Seu Pedido</p>
              <p className="text-6xl font-mono font-bold">{pedidoFinalizado?.numero?.split('-')[1] || '000'}</p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="mt-12 px-8 py-3 bg-card text-emerald-600 rounded-full font-bold text-lg hover:bg-emerald-50 transition-colors"
            >
              Nova Compra
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}