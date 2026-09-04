import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { lancamentoStackClasses } from '@/components/financeiro/fluxo/LancamentoPickerDialog';

export default function BudgetCategoriaDialog({
  open,
  onClose,
  categoria,
  onSave,
  saving,
  stackElevated = false,
  stackLevel = 2,
}) {
  const [nome, setNome] = useState('');
  const [ativo, setAtivo] = useState(true);
  const stack = lancamentoStackClasses(stackElevated ? stackLevel : 0);

  useEffect(() => {
    if (!open) return;
    setNome(categoria?.nome || '');
    setAtivo(categoria?.ativo !== false && categoria?.ativa !== false);
  }, [open, categoria]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave?.({
      ...categoria,
      nome: nome.trim(),
      tipo: 'Despesa',
      ativo,
      ativa: ativo,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent
        overlayClassName={stack.overlay}
        className={cn('max-w-sm rounded-2xl', stack.content)}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-muted-foreground" />
            {categoria?.id ? 'Editar categoria' : 'Nova categoria de despesa'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Alimentação, Combustível..."
              required
              autoFocus
            />
          </div>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-2.5">
            <span className="text-sm">Categoria ativa</span>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </label>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onClose?.()}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !nome.trim()}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
