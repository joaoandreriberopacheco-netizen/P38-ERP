import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CreditCard, Smartphone, ArrowLeft, Loader2, Printer, CheckCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import SimuladorCartaoSheet from '@/components/vendas/SimuladorCartaoSheet';
import { omitPedidoVendaEspelho } from '@/lib/omitEspelhoPersist';
import { syncPedidoVendaItens } from '@/lib/syncPedidoVendaItens';

export default function AutoPayment({ carrinho, cliente, onSuccess, onBack }) {
  const [processing, setProcessing] = useState(false);
  const [method, setMethod] = useState(null); // 'credit', 'debit', 'pix'
  const [pedidoFinalizado, setPedidoFinalizado] = useState(null);
  const [itensCupom, setItensCupom] = useState([]);
  const [showSimulador, setShowSimulador] = useState(false);
  const { toast } = useToast();

  const total = carrinho.reduce((acc, item) => acc + item.total, 0);

  const handleProcessPayment = async (selectedMethod) => {
    setMethod(selectedMethod);
    setProcessing(true);

    // Simulação de tempo de processamento da maquininha
    setTimeout(async () => {
      try {
        // Criar pedido
        const user = await base44.auth.me();
        
        // Gerar número do pedido (simulado ou via backend se tivesse contador)
        const randomNum = Math.floor(Math.random() * 10000);
        const numeroPedido = `AUTO-${randomNum}`;

        const itensLegado = carrinho.map(item => ({
            produto_id: item.produto_id,
            produto_nome: item.produto_nome,
            quantidade: item.quantidade,
            preco_unitario_praticado: item.preco_unitario_praticado,
            total: item.total
          }));

        const pedidoData = omitPedidoVendaEspelho({
          numero: numeroPedido,
          tipo: 'PDV Autosserviço',
          cliente_id: cliente?.id,
          cliente_nome: cliente?.nome || 'Consumidor Final',
          vendedor_id: user.id, // Atribui ao usuário logado (totem)
          vendedor_nome: 'Totem Autosserviço',
          status: 'Finalizado',
          valor_total: total,
          pagamentos: [{
            forma_pagamento: selectedMethod === 'pix' ? 'PIX' : selectedMethod === 'credit' ? 'Cartão de Crédito' : 'Cartão de Débito',
            valor: total,
            parcelas: 1
          }],
          origem: 'Totem'
        });

        const pedido = await base44.entities.PedidoVenda.create(pedidoData);

        try {
          await syncPedidoVendaItens(pedido.id, itensLegado);
        } catch (canonicalErr) {
          console.warn('Sincronia PedidoVendaItem falhou:', canonicalErr?.message || canonicalErr);
        }

        setItensCupom(itensLegado);
        setPedidoFinalizado(pedido);
        // onSuccess(pedido); // Movido para depois da impressão
      } catch (error) {
        console.error(error);
        toast({
          title: "Erro no pagamento",
          description: "Houve um erro ao processar seu pagamento. Tente novamente.",
          variant: "destructive"
        });
        setProcessing(false);
        setMethod(null);
      }
    }, 3000); // 3 segundos de simulação
  };

  if (pedidoFinalizado) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background p-4">
        <div className="bg-card p-8 rounded-3xl shadow-xl max-w-md w-full border border-border/40 relative overflow-hidden">
            {/* Recibo Effect Top */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
            
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Pagamento Aprovado!</h2>
              <p className="text-muted-foreground">Seu pedido foi enviado para separação.</p>
            </div>

            {/* Cupom Visual */}
            <div className="bg-muted/40 dark:bg-muted/30 p-6 rounded-xl border border-dashed border-border/40 dark:border-border/40 mb-8 font-mono text-sm">
              <div className="text-center border-b border-dashed border-border/40 dark:border-border/40 pb-4 mb-4">
                <h3 className="font-bold text-lg uppercase">VarejoSync</h3>
                <p>Pedido #{pedidoFinalizado.numero}</p>
                <p className="text-xs text-muted-foreground">{new Date().toLocaleString()}</p>
              </div>
              
              <div className="space-y-2 mb-4">
                {itensCupom.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="truncate flex-1 pr-4">{item.quantidade}x {item.produto_nome}</span>
                    <span>{item.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              
              <div className="border-t border-dashed border-border/40 dark:border-border/40 pt-4 flex justify-between font-bold text-lg">
                <span>TOTAL</span>
                <span>R$ {pedidoFinalizado.valor_total.toFixed(2)}</span>
              </div>
              
              <div className="text-center mt-6 text-xs text-muted-foreground">
                <p>Obrigado pela preferência!</p>
                <p>Retire sua senha no painel.</p>
              </div>
            </div>

            <Button 
              onClick={() => onSuccess(pedidoFinalizado)}
              className="w-full h-14 text-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl mb-3"
            >
              <Printer className="w-5 h-5 mr-2" />
              Imprimir e Finalizar
            </Button>
             <Button 
              variant="ghost"
              onClick={() => onSuccess(pedidoFinalizado)}
              className="w-full text-muted-foreground"
            >
              Não imprimir
            </Button>
        </div>
      </div>
    );
  }

  return (
    <>
    <motion.div 
      className="flex-1 flex flex-col bg-background"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <div className="p-6 border-b border-border/40 bg-card flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} disabled={processing}>
          <ArrowLeft className="w-5 h-5 mr-2" /> Voltar
        </Button>
        <h2 className="text-xl font-bold">Pagamento</h2>
        <div className="w-20"></div> {/* Spacer */}
      </div>

      <div className="flex-1 flex flex-col md:flex-row">
        {/* Resumo */}
        <div className="w-full md:w-1/3 p-8 bg-card border-r border-border/40">
          <h3 className="text-lg font-semibold mb-6">Resumo do Pedido</h3>
          <div className="space-y-4 mb-8">
            {carrinho.map(item => (
              <div key={item.produto_id} className="flex items-center gap-3 text-sm">
                <div className="w-10 h-10 bg-muted rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {item.imagem ? (
                    <img src={item.imagem} alt={item.produto_nome} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                       <div className="w-4 h-4 bg-current rounded-sm opacity-50" />
                    </div>
                  )}
                </div>
                <span className="text-muted-foreground flex-1 truncate">{item.quantidade}x {item.produto_nome}</span>
                <span className="font-medium flex-shrink-0">R$ {item.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border/40 pt-6">
            <div className="flex justify-between items-center text-2xl font-bold">
              <span>Total</span>
              <span className="text-emerald-600">R$ {total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Métodos de Pagamento */}
        <div className="flex-1 p-8 flex flex-col justify-center items-center bg-background">
          {processing ? (
            <div className="text-center">
              <div className="relative w-24 h-24 mx-auto mb-8">
                <div className="absolute inset-0 border-4 border-border/40 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <h3 className="text-2xl font-bold mb-2">Processando Pagamento...</h3>
              <p className="text-muted-foreground">Siga as instruções na maquininha de cartão</p>
            </div>
          ) : (
            <div className="w-full max-w-md space-y-4">
              <h3 className="text-xl font-semibold mb-6 text-center">Escolha a forma de pagamento</h3>

              {/* Simulador de taxa */}
              <button
                onClick={() => setShowSimulador(true)}
                className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-muted-foreground hover:bg-muted/40 dark:hover:bg-muted rounded-xl py-2.5 transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                Simular taxa no cartão
              </button>
              
              <button
                onClick={() => handleProcessPayment('credit')}
                className="w-full p-6 bg-card hover:bg-indigo-50 dark:hover:bg-primary/90 border-2 border-transparent hover:border-indigo-500 rounded-2xl shadow-sm transition-all flex items-center gap-4 group"
              >
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center group-hover:bg-indigo-200">
                  <CreditCard className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-lg">Cartão de Crédito</p>
                  <p className="text-sm text-muted-foreground">Visa, Mastercard, Elo...</p>
                </div>
              </button>

              <button
                onClick={() => handleProcessPayment('debit')}
                className="w-full p-6 bg-card hover:bg-indigo-50 dark:hover:bg-primary/90 border-2 border-transparent hover:border-indigo-500 rounded-2xl shadow-sm transition-all flex items-center gap-4 group"
              >
                <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900/50 rounded-full flex items-center justify-center group-hover:bg-teal-200">
                  <CreditCard className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-lg">Cartão de Débito</p>
                  <p className="text-sm text-muted-foreground">Pagamento à vista</p>
                </div>
              </button>

              <button
                onClick={() => handleProcessPayment('pix')}
                className="w-full p-6 bg-card hover:bg-indigo-50 dark:hover:bg-primary/90 border-2 border-transparent hover:border-indigo-500 rounded-2xl shadow-sm transition-all flex items-center gap-4 group"
              >
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center group-hover:bg-emerald-200">
                  <Smartphone className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-lg">PIX</p>
                  <p className="text-sm text-muted-foreground">QR Code instantâneo</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
    <SimuladorCartaoSheet
      open={showSimulador}
      onClose={() => setShowSimulador(false)}
      valorTotal={total}
      valorDesconto={0}
    />
    </>
  );
}