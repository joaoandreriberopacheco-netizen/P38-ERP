import React, { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { CaixaDialogContent } from './CaixaDialogContent';
import { Button } from '@/components/ui/button';
import { caixaClasses } from '@/lib/caixaP38Theme';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Ban, Pencil } from 'lucide-react';

export default function GerenciarMovimentoDialog({ open, onOpenChange, movimento, onEdit, onCancel }) {
  const [valor, setValor] = useState('0,00');
  const [observacao, setObservacao] = useState('');
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (!movimento) return;
    setValor((movimento.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setObservacao(movimento.observacao || '');
    setMotivo('');
  }, [movimento]);

  const handleValorChange = (e) => {
    const nums = e.target.value.replace(/\D/g, '') || '0';
    setValor((parseInt(nums, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  if (!movimento) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <CaixaDialogContent className="max-w-lg rounded-[28px] border-0 bg-card p-0 shadow-2xl dark:bg-background">
        <div className="border-b border-border/40 px-4 py-3 dark:border-border/40">
          <div className="flex items-center gap-3">
            <button onClick={() => onOpenChange(false)} className="rounded-2xl p-2 hover:bg-muted">
              <ArrowLeft className="h-5 w-5 text-foreground/90" />
            </button>
            <div>
              <p className="text-lg font-semibold text-foreground">Ajustar movimento</p>
              <p className="text-xs text-muted-foreground">{movimento.numero}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4 md:p-5">
          <div>
            <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valor</Label>
            <Input value={valor} onChange={handleValorChange} className="h-11 rounded-2xl border-0 bg-muted shadow-sm dark:bg-muted" />
          </div>
          <div>
            <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} className="min-h-[96px] rounded-[24px] border-0 bg-muted shadow-sm dark:bg-muted" />
          </div>
          <div>
            <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Motivo do ajuste</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} className="min-h-[88px] rounded-[24px] border-0 bg-muted shadow-sm dark:bg-muted" />
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <Button onClick={() => onEdit({ valor, observacao, motivo })} disabled={!motivo.trim()} className="h-11 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-card dark:text-foreground">
              <Pencil className="mr-2 h-4 w-4" />Salvar edição
            </Button>
            <Button onClick={() => onCancel({ motivo })} disabled={!motivo.trim()} variant="outline" className={`h-11 rounded-2xl border-0 shadow-sm ${caixaClasses('danger').text} ${caixaClasses('danger').hover}`}>
              <Ban className="mr-2 h-4 w-4" />Cancelar movimento
            </Button>
          </div>
        </div>
      </CaixaDialogContent>
    </Dialog>
  );
}