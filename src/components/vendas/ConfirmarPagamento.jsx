
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PedidoVenda } from '@/entities/PedidoVenda';
import { MovimentacaoEstoque } from '@/entities/MovimentacaoEstoque';
import { LancamentoFinanceiro } from '@/entities/LancamentoFinanceiro';
import { Produto } from '@/entities/Produto';
import { CheckCircle, Plus, Trash2, Keyboard } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

import ComprovanteCompra from './ComprovanteCompra';
import { dataHoje } from '@/components/utils/dateUtils';
import { roundToTwoDecimals, resolveValorPedidoVenda, pagamentosCobremTotal, formatCurrency } from '@/lib/financialUtils';

export default function ConfirmarPagamento({ pedido, open, onClose, onSuccess }) {
  const [pagamentos, setPagamentos] = useState([{ forma_pagamento: 'Dinheiro', valor: '' }]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pedidoFinalizado, setPedidoFinalizado] = useState(null);
  const { toast } = useToast();

  // Atalhos de teclado
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        toast({
          title: "Atalhos do Caixa",
          description: "F1: Ajuda | F2: Add Pagamento | F3: Confirmar | ESC: Cancelar",
          duration: 4000
        });
      }
      
      if (e.key === 'F2') {
        e.preventDefault();
        handleAdicionarPagamento();
      }
      
      if (e.key === 'F3' && !isProcessing) {
        e.preventDefault();
        handleConfirmar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, pagamentos, isProcessing]);

  const handleAdicionarPagamento = () => {
    setPagamentos([...pagamentos, { forma_pagamento: '', valor: '' }]);
  };

  const handleRemoverPagamento = (index) => {
    if (pagamentos.length === 1) {
      toast({
        title: "Atenção",
        description: "Deve haver pelo menos uma forma de pagamento",
        variant: "destructive"
      });
      return;
    }
    setPagamentos(pagamentos.filter((_, i) => i !== index));
  };

  const handlePagamentoChange = (index, field, value) => {
    const newPagamentos = [...pagamentos];
    newPagamentos[index][field] = field === 'valor' ? parseFloat(value) || 0 : value;
    setPagamentos(newPagamentos);
  };

  const valorTotalPedido = resolveValorPedidoVenda(pedido);
  const totalPago = roundToTwoDecimals(
    pagamentos.reduce((sum, p) => sum + (parseFloat(p.valor) || 0), 0)
  );
  const faltaPagar = roundToTwoDecimals(valorTotalPedido - totalPago);
  const pagamentoCompleto = pagamentosCobremTotal(totalPago, valorTotalPedido);

  const handleConfirmar = async () => {
    // Validar se todas as formas estão preenchidas
    const pagamentosValidos = pagamentos.filter(p => p.forma_pagamento && parseFloat(p.valor) > 0);
    
    if (pagamentosValidos.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos uma forma de pagamento válida",
        variant: "destructive"
      });
      return;
    }

    if (!pagamentoCompleto) {
      toast({
        title: "Erro",
        description: `Faltam R$ ${Math.abs(faltaPagar).toFixed(2)} para completar o pagamento`,
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Atualizar status do pedido
      await PedidoVenda.update(pedido.id, {
        status: 'Aprovado',
        pagamentos: pagamentosValidos
      });

      // 2. Criar movimentações de estoque
      const movimentacoes = pedido.itens.map(item => ({
        produto_id: item.produto_id,
        produto_nome: item.produto_nome,
        tipo: 'Saída',
        motivo: 'Venda',
        quantidade: item.quantidade,
        custo_unitario: item.custo_unitario_momento || 0,
        documento_referencia: pedido.numero,
        usuario_responsavel: 'Sistema'
      }));
      
      await MovimentacaoEstoque.bulkCreate(movimentacoes);

      // 3. Baixar estoque
      const produtosIds = pedido.itens.map(i => i.produto_id);
      const produtosAtuais = await Promise.all(produtosIds.map(id => Produto.get(id)));

      const updates = produtosAtuais.map(produto => {
        const itemVendido = pedido.itens.find(i => i.produto_id === produto.id);
        const novoEstoque = (produto.estoque_atual || 0) - (itemVendido.quantidade || 0);
        return Produto.update(produto.id, { estoque_atual: Math.max(0, novoEstoque) });
      });
      
      await Promise.all(updates);

      // 4. Criar lançamento financeiro
      await LancamentoFinanceiro.create({
        tipo: 'Receita',
        descricao: `Venda - ${pedido.numero}`,
        terceiro_id: pedido.cliente_id,
        terceiro_nome: pedido.cliente_nome,
        valor: valorTotalPedido,
        data_vencimento: dataHoje(),
        data_pagamento: dataHoje(),
        status: 'Pago',
        categoria: 'Venda de Produto',
        referencia_id: pedido.id
      });

      // 5. Preparar comprovante
      const pedidoComPagamento = {
        ...pedido,
        status: 'Aprovado',
        pagamentos: pagamentosValidos
      };

      setPedidoFinalizado(pedidoComPagamento);
      
      toast({
        title: "✓ Pagamento Confirmado!",
        description: `Pedido ${pedido.numero} aprovado`,
        className: "bg-green-100 text-green-800"
      });
      
    } catch (error) {
      toast({
        title: "Erro ao Confirmar Pagamento",
        description: error.message,
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  };

  const handleFecharComprovante = () => {
    setPedidoFinalizado(null);
    setPagamentos([{ forma_pagamento: 'Dinheiro', valor: '' }]);
    setIsProcessing(false);
    onClose();
    onSuccess();
  };

  if (pedidoFinalizado) {
    return (
      <ComprovanteCompra
        pedido={pedidoFinalizado}
        open={true}
        onClose={handleFecharComprovante}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Confirmar Recebimento de Pagamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/40 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Pedido:</p>
              <p className="font-bold">{pedido?.numero}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cliente:</p>
              <p className="font-bold">{pedido?.cliente_nome}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Valor Total:</p>
              <p className="text-2xl font-bold text-green-600">
                R$ {formatCurrency(valorTotalPedido)}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Formas de Pagamento</Label>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={handleAdicionarPagamento}
                className="gap-2"
              >
                <Plus className="w-4 h-4" /> Adicionar (F2)
              </Button>
            </div>

            {pagamentos.map((pagamento, index) => (
              <div key={index} className="grid grid-cols-[1fr,150px,40px] gap-2">
                <div>
                  <Label className="text-xs">Forma</Label>
                  <Select 
                    value={pagamento.forma_pagamento} 
                    onValueChange={(v) => handlePagamentoChange(index, 'forma_pagamento', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="Débito">Cartão de Débito</SelectItem>
                      <SelectItem value="Crédito">Cartão de Crédito</SelectItem>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="Boleto">Boleto</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Valor</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder=""
                    value={pagamento.valor}
                    onChange={(e) => handlePagamentoChange(index, 'valor', e.target.value)}
                    className="text-right"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoverPagamento(index)}
                    disabled={pagamentos.length === 1}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-blue-50 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total Pago:</span>
              <span className="font-bold">R$ {totalPago.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Falta Pagar:</span>
              <span className={`font-bold ${faltaPagar > 0 ? 'text-red-600' : 'text-green-600'}`}>
                R$ {Math.abs(faltaPagar).toFixed(2)}
              </span>
            </div>
            {pagamentoCompleto && (
              <div className="flex items-center gap-2 text-green-600 text-sm font-semibold">
                <CheckCircle className="w-4 h-4" />
                Pagamento completo!
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Keyboard className="w-4 h-4 text-muted-foreground" />
            <div className="text-xs text-muted-foreground">
              <span className="font-bold">F1:</span> Ajuda | 
              <span className="font-bold ml-2">F2:</span> Adicionar Forma de Pagamento | 
              <span className="font-bold ml-2">F3:</span> Confirmar Pagamento | 
              <span className="font-bold ml-2">ESC:</span> Cancelar
            </div>
          </div>

          <Alert>
            <AlertDescription>
              <p className="font-semibold mb-2">Ao confirmar, o sistema irá:</p>
              <ul className="text-sm space-y-1 ml-4">
                <li>• Marcar o pedido como "Aprovado"</li>
                <li>• Baixar o estoque dos produtos vendidos</li>
                <li>• Criar o lançamento financeiro de receita</li>
                <li>• Gerar comprovante de compra para impressão</li>
              </ul>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancelar (ESC)
          </Button>
          <Button 
            onClick={handleConfirmar} 
            disabled={isProcessing || !pagamentoCompleto}
            className="bg-green-600 hover:bg-green-700"
          >
            {isProcessing ? 'Processando...' : 'Confirmar e Gerar Comprovante (F3)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
