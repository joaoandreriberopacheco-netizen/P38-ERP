import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package2, Boxes } from 'lucide-react';
import { toast } from 'sonner';

export default function LoteVolumesGenericosDialog({ isOpen, onClose, manifestos, onSuccess }) {
  const [descricao, setDescricao] = useState('Volume Genérico');
  const [quantidadePorManifesto, setQuantidadePorManifesto] = useState('1');
  const [pesoPorManifesto, setPesoPorManifesto] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!descricao.trim()) {
      toast.error('Informe a descrição do volume');
      return;
    }

    const quantidade = parseInt(quantidadePorManifesto, 10);
    if (!quantidade || quantidade <= 0) {
      toast.error('Informe uma quantidade válida');
      return;
    }

    const peso = pesoPorManifesto ? parseFloat(pesoPorManifesto) : null;
    if (pesoPorManifesto && (Number.isNaN(peso) || peso < 0)) {
      toast.error('Informe um peso válido');
      return;
    }

    try {
      setSaving(true);

      await Promise.all(
        manifestos.map((manifesto) => {
          const volumesAtuais = Array.isArray(manifesto.volumes) ? manifesto.volumes : [];
          const novosVolumes = [...volumesAtuais, {
            descricao: descricao.trim(),
            quantidade,
            peso_kg: peso,
          }];

          return base44.entities.ManifestoEntrada.update(manifesto.id, {
            volumes: novosVolumes,
          });
        })
      );

      toast.success(`Volumes genéricos criados em ${manifestos.length} manifesto(s)`);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Erro ao criar volumes em lote:', error);
      toast.error('Erro ao criar volumes em lote');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-0 rounded-3xl shadow-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground dark:text-foreground">
            <Boxes className="w-5 h-5 text-foreground/90" />
            Criar volumes genéricos em lote
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-2xl bg-muted/70 p-3 text-sm text-muted-foreground">
            {manifestos.length} manifesto(s) serão atualizados.
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Descrição</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Volume Genérico"
              className="h-11 rounded-2xl border-0 bg-muted/70 shadow-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Quantidade por manifesto</Label>
              <Input
                type="number"
                value={quantidadePorManifesto}
                onChange={(e) => setQuantidadePorManifesto(e.target.value)}
                className="h-11 rounded-2xl border-0 bg-muted/70 shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Peso (kg) opcional</Label>
              <Input
                type="number"
                step="0.01"
                value={pesoPorManifesto}
                onChange={(e) => setPesoPorManifesto(e.target.value)}
                placeholder="Ex: 12.5"
                className="h-11 rounded-2xl border-0 bg-muted/70 shadow-sm"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} className="border-0 bg-muted rounded-2xl shadow-sm">
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={saving || manifestos.length === 0} className="bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-muted dark:hover:bg-muted/90 dark:text-foreground rounded-2xl shadow-sm gap-2">
            <Package2 className="w-4 h-4" />
            {saving ? 'Criando...' : 'Criar em lote'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}