import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cancelarPedidoVenda } from '@/lib/cancelarPedidoVenda';

export default function CancelarPedidoVendaDialog({ open, onClose, pedido, onSuccess }) {
  const [motivo, setMotivo] = useState('');
  const [senhaAutorizacao, setSenhaAutorizacao] = useState('');
  const [processando, setProcessando] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setMotivo('');
      setSenhaAutorizacao('');
      setProcessando(false);
    }
  }, [open]);

  const handleConfirmar = async () => {
    if (!pedido?.id) return;
    const motivoLimpo = motivo.trim();
    if (!motivoLimpo) {
      toast({
        title: 'Informe o motivo',
        description: 'Descreva por que a venda está sendo cancelada.',
        variant: 'destructive',
      });
      return;
    }
    const senha = senhaAutorizacao.trim();
    if (!senha) {
      toast({
        title: 'Informe a senha',
        description: 'Digite a senha de autorização para confirmar o cancelamento.',
        variant: 'destructive',
      });
      return;
    }

    setProcessando(true);
    try {
      const resultado = await cancelarPedidoVenda({
        pedidoId: pedido.id,
        motivo: motivoLimpo,
        senhaAutorizacao: senha,
      });
      toast({
        title: 'Venda cancelada',
        description: `${resultado.numero || pedido.numero} foi cancelada. Estoque e financeiro estornados; o registro permanece no histórico.`,
        className: 'bg-emerald-100 text-emerald-800',
      });
      onSuccess?.(resultado);
      onClose?.();
    } catch (error) {
      toast({
        title: 'Erro ao cancelar venda',
        description: error?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setProcessando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !processando && !next && onClose?.()}>
      <DialogContent className="max-w-md dark:bg-card">
        <DialogHeader>
          <DialogTitle className="text-foreground">Cancelar venda</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 dark:bg-amber-900/20">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1 text-sm text-amber-900 dark:text-amber-100">
              <p>
                O pedido <strong>{pedido?.numero}</strong> será mantido no sistema com status <strong>Cancelado</strong>.
              </p>
              <p>
                Serão estornados os movimentos de estoque e cancelados os lançamentos financeiros vinculados, como na exclusão de documentos — sem apagar o registro da venda.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo-cancelamento-venda">Motivo do cancelamento</Label>
            <Textarea
              id="motivo-cancelamento-venda"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: venda duplicada, erro de operador, cliente desistiu..."
              rows={4}
              disabled={processando}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="senha-cancelamento-venda">Senha de autorização</Label>
            <Input
              id="senha-cancelamento-venda"
              type="password"
              autoComplete="off"
              value={senhaAutorizacao}
              onChange={(e) => setSenhaAutorizacao(e.target.value)}
              placeholder="Senha para autorizar o cancelamento"
              disabled={processando}
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={processando}
            >
              Voltar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1"
              onClick={handleConfirmar}
              disabled={processando}
            >
              {processando ? 'Cancelando...' : 'Confirmar cancelamento'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
