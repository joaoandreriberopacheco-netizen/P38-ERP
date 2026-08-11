import React, { useState } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { insertModeloLinha } from '@/lib/modeloCatalogo/fetchModeloCatalogo';
import { slugCodigo } from '@/lib/modeloCatalogo/montarNomeSku';
import { CERAM_MASSA_CRITICA_CX, CERAM_META_VAGAS, CERAM_MIN_LINHAS_SALDAVEL } from '@/lib/modeloCatalogo/regrasCeramica';
import { toast } from 'sonner';

const TIPOS = [
  { value: 'solo', label: 'Solo — sem produto compra' },
  { value: 'linha_mix', label: 'Mix — grelha completa' },
  { value: 'portfolio', label: 'Portfolio — vagas + massa crítica' },
];

export default function ModeloLinhaDialog({ open, onClose, onSaved, initialCategoria = '' }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nome: '',
    categoria_nome: initialCategoria,
    tipo: 'portfolio',
    eixo_a_rotulo: 'Formato',
    eixo_b_rotulo: 'Cor / Modelo',
    meta_vagas: String(CERAM_META_VAGAS),
    massa_critica: String(CERAM_MASSA_CRITICA_CX),
    min_linhas_saldavel: String(CERAM_MIN_LINHAS_SALDAVEL),
    ordem: 100,
  });

  React.useEffect(() => {
    if (open) {
      setForm((f) => ({ ...f, categoria_nome: initialCategoria || f.categoria_nome }));
    }
  }, [open, initialCategoria]);

  const isPortfolio = form.tipo === 'portfolio' || form.tipo === 'linha_mix';

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast.error('Nome da LINHA é obrigatório');
      return;
    }
    setLoading(true);
    try {
      const row = await insertModeloLinha({
        codigo: slugCodigo(form.nome),
        nome: form.nome.trim(),
        categoria_nome: form.categoria_nome.trim(),
        tipo: form.tipo,
        eixo_a_rotulo: form.eixo_a_rotulo.trim() || null,
        eixo_b_rotulo: form.eixo_b_rotulo.trim() || null,
        meta_vagas: isPortfolio && form.meta_vagas !== '' ? Number(form.meta_vagas) : null,
        massa_critica: isPortfolio && form.massa_critica !== '' ? Number(form.massa_critica) : null,
        min_linhas_saldavel: isPortfolio && form.min_linhas_saldavel !== '' ? Number(form.min_linhas_saldavel) : null,
        ordem: Number(form.ordem) || 100,
        ativo: true,
      });
      toast.success(`LINHA "${row.nome}" criada — produtos compra herdam estes defaults`);
      onSaved?.(row);
      onClose?.();
    } catch (e) {
      toast.error(e.message || 'Erro ao criar LINHA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova LINHA (laboratório)</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">Defaults da LINHA — cada produto compra pode sobrescrever.</p>
        <div className="space-y-3 text-sm">
          <div>
            <Label>Categoria</Label>
            <Input value={form.categoria_nome} onChange={(e) => setForm({ ...form, categoria_nome: e.target.value })} placeholder="E - PISOS E REVESTIMENTOS" />
          </div>
          <div>
            <Label>Nome da LINHA *</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="CERÂMICA BOLD" />
          </div>
          <div>
            <Label>Comportamento *</Label>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Rótulo eixo A</Label>
              <Input value={form.eixo_a_rotulo} onChange={(e) => setForm({ ...form, eixo_a_rotulo: e.target.value })} />
            </div>
            <div>
              <Label>Rótulo eixo B</Label>
              <Input value={form.eixo_b_rotulo} onChange={(e) => setForm({ ...form, eixo_b_rotulo: e.target.value })} />
            </div>
          </div>
          {isPortfolio && (
            <>
              <div>
                <Label>Posições (default LINHA)</Label>
                <Input type="number" min="0" value={form.meta_vagas} onChange={(e) => setForm({ ...form, meta_vagas: e.target.value })} />
              </div>
              <div>
                <Label>Massa crítica cx (default LINHA)</Label>
                <Input type="number" min="0" value={form.massa_critica} onChange={(e) => setForm({ ...form, massa_critica: e.target.value })} />
              </div>
              <div>
                <Label>Mín. linhas saldável (default LINHA)</Label>
                <Input type="number" min="0" value={form.min_linhas_saldavel} onChange={(e) => setForm({ ...form, min_linhas_saldavel: e.target.value })} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>Criar LINHA</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
