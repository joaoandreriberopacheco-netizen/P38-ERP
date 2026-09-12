import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CreditCard, Smartphone, ArrowLeft, Loader2, Printer, CheckCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import SimuladorCartaoSheet from '@/components/vendas/SimuladorCartaoSheet';
import AutoShellHeader from './AutoShellHeader';
import {
  AUTO_PRIMARY_BTN,
  AUTO_PAGE_CANVAS,
  AUTO_EDITORIAL_PANEL,
  AUTO_GHOST_BTN,
  AUTO_ACCENT_TEXT,
  AUTO_IMAGE_STAGE,
  AUTO_DISPLAY,
  AUTO_EYEBROW,
  AUTO_HEADING,
  AUTO_PRICE_LARGE,
  AUTO_SECTION_TITLE,
  AUTO_SUBHEADING,
  AUTO_VITRINE_CARD,
  formatAutoMoney,
} from './autoAtendimentoUi';
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
      <div className={`flex-1 flex flex-col items-center justify-center p-4 sm:p-8 ${AUTO_PAGE_CANVAS}`}>
        <div className={`${AUTO_EDITORIAL_PANEL} max-w-md w-full relative overflow-hidden`}>
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#e8b824]/80 via-[#4a5240]/60 to-transparent" />
            
            <div className="text-center mb-8">
              <div className={`w-20 h-20 ${AUTO_IMAGE_STAGE} rounded-full flex items-center justify-center mx-auto mb-4`}>
                <CheckCircle className="w-10 h-10 text-[#4a5240]" />
              </div>
              <p className={AUTO_EYEBROW}>Confirmado</p>
              <h2 className={`${AUTO_DISPLAY} mt-1`}>Pagamento aprovado</h2>
              <p className={AUTO_SUBHEADING}>Seu pedido foi enviado para separação.</p>
            </div>

            <div className="bg-[#f8fafb] p-6 rounded-xl border border-dashed border-[#d4dde4] mb-8 font-mono text-sm">
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
              className={`w-full h-14 text-lg font-bold rounded-xl mb-3 ${AUTO_PRIMARY_BTN}`}
            >
              <Printer className="w-5 h-5 mr-2" />
              Imprimir e Finalizar
            </Button>
             <Button 
              variant="ghost"
              onClick={() => onSuccess(pedidoFinalizado)}
              className={`${AUTO_GHOST_BTN} mt-2 border-0 shadow-none`}
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
      className={`flex-1 flex flex-col h-full min-h-0 overflow-hidden ${AUTO_PAGE_CANVAS}`}
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      <AutoShellHeader>
        <Button variant="ghost" onClick={onBack} disabled={processing} className="text-[#242424] hover:bg-secondary/60">
          <ArrowLeft className="w-5 h-5 mr-2" /> Voltar
        </Button>
        <h2 className="text-sm font-medium tracking-tight text-[#242424]">Pagamento</h2>
        <div className="w-16" />
      </AutoShellHeader>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {/* Resumo */}
        <div className={`w-full md:w-1/3 p-6 sm:p-8 min-h-0 p38-stage-panel-scroll touch-pan-y bg-white border-r border-[#e8ecef]/80`}>
          <h3 className={`${AUTO_SECTION_TITLE} mb-6`}>Resumo do pedido</h3>
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
              <span className="font-medium flex-shrink-0 text-[#4a5240] dark:text-[#a4ce33]">R$ {item.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border/40 pt-6">
            <div className="flex justify-between items-center">
              <span className={AUTO_SECTION_TITLE}>Total</span>
              <span className={AUTO_PRICE_LARGE}>R$ {formatAutoMoney(total)}</span>
            </div>
          </div>
        </div>

        {/* Métodos de Pagamento */}
        <div className={`flex-1 min-h-0 p-6 sm:p-8 flex flex-col justify-center items-center p38-stage-panel-scroll touch-pan-y ${AUTO_PAGE_CANVAS}`}>
          {processing ? (
            <div className="text-center">
              <div className="relative w-24 h-24 mx-auto mb-8">
                <div className="absolute inset-0 border-4 border-border/40 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-[#4a5240] rounded-full border-t-transparent animate-spin"></div>
              </div>
              <h3 className={`${AUTO_HEADING} mb-2`}>Processando pagamento</h3>
              <p className={AUTO_SUBHEADING}>Siga as instruções na maquininha de cartão</p>
            </div>
          ) : (
            <div className="w-full max-w-md space-y-4">
              <p className={`${AUTO_EYEBROW} text-center mb-2`}>Pagamento</p>
              <h3 className={`${AUTO_HEADING} mb-6 text-center`}>Escolha a forma</h3>

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
                className={`w-full p-6 ${AUTO_VITRINE_CARD} flex items-center gap-4 group`}
              >
                <div className={`w-12 h-12 ${AUTO_IMAGE_STAGE} rounded-full flex items-center justify-center`}>
                  <CreditCard className={`w-6 h-6 ${AUTO_ACCENT_TEXT}`} />
                </div>
                <div className="text-left">
                  <p className="font-medium text-lg text-[#242424]">Cartão de Crédito</p>
                  <p className={AUTO_SUBHEADING}>Visa, Mastercard, Elo...</p>
                </div>
              </button>

              <button
                onClick={() => handleProcessPayment('debit')}
                className={`w-full p-6 ${AUTO_VITRINE_CARD} flex items-center gap-4 group`}
              >
                <div className="w-12 h-12 bg-[#e8b824]/15 rounded-full flex items-center justify-center group-hover:bg-[#e8b824]/25">
                  <CreditCard className="w-6 h-6 text-[#c99710] dark:text-[#e8b824]" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-lg text-[#242424]">Cartão de Débito</p>
                  <p className={AUTO_SUBHEADING}>Pagamento à vista</p>
                </div>
              </button>

              <button
                onClick={() => handleProcessPayment('pix')}
                className={`w-full p-6 ${AUTO_VITRINE_CARD} flex items-center gap-4 group`}
              >
                <div className={`w-12 h-12 ${AUTO_IMAGE_STAGE} rounded-full flex items-center justify-center`}>
                  <Smartphone className={`w-6 h-6 ${AUTO_ACCENT_TEXT}`} />
                </div>
                <div className="text-left">
                  <p className="font-medium text-lg text-[#242424]">PIX</p>
                  <p className={AUTO_SUBHEADING}>QR Code instantâneo</p>
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