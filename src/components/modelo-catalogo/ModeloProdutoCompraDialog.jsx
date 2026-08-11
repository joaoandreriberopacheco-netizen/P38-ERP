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
import { insertModeloProdutoCompra } from '@/lib/modeloCatalogo/fetchModeloCatalogo';
import { slugCodigo, mapTipoLinhaUi } from '@/lib/modeloCatalogo/montarNomeSku';
import { CERAM_MASSA_CRITICA_CX, CERAM_META_VAGAS, CERAM_MIN_LINHAS_SALDAVEL } from '@/lib/modeloCatalogo/regrasCeramica';
import { toast } from 'sonner';

export default function ModeloProdutoCompraDialog({ open, onClose, onSaved, linha }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nome: '',
    meta_vagas: String(CERAM_META_VAGAS),
    massa_critica: String(CERAM_MASSA_CRITICA_CX),
    min_linhas_saldavel: String(CERAM_MIN_LINHAS_SALDAVEL),
  });

  const isPortfolio = linha && (mapTipoLinhaUi(linha.tipo) === 'portfolio' || true);

  React.useEffect(() => {
    if (open) setForm({
      nome: '',
      meta_vagas: String(CERAM_META_VAGAS),
      massa_critica: String(CERAM_MASSA_CRITICA_CX),
      min_linhas_saldavel: String(CERAM_MIN_LINHAS_SALDAVEL),
    });
  }, [open]);

  const handleSave = async () => {
    if (!linha?.id) {
      toast.error('Seleccione uma LINHA primeiro');
      return;
    }
    if (!form.nome.trim()) {
      toast.error('Nome do produto compra é obrigatório');
      return;
    }
    setLoading(true);
    try {
      const row = await insertModeloProdutoCompra({
        linha_id: linha.id,
        codigo: slugCodigo(form.nome),
        nome: form.nome.trim(),
        meta_vagas: form.meta_vagas !== '' ? Number(form.meta_vagas) : CERAM_META_VAGAS,
        massa_critica: form.massa_critica !== '' ? Number(form.massa_critica) : CERAM_MASSA_CRITICA_CX,
        min_linhas_saldavel: form.min_linhas_saldavel !== '' ? Number(form.min_linhas_saldavel) : CERAM_MIN_LINHAS_SALDAVEL,
        eixo_a_rotulo: linha.eixo_a_rotulo,
        eixo_b_rotulo: linha.eixo_b_rotulo,
        ativo: true,
      });
      toast.success(`Produto compra "${row.nome}" criado`);
      onSaved?.(row);
      onClose?.();
    } catch (e) {
      toast.error(e.message || 'Erro ao criar produto compra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo produto compra (laboratório)</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">LINHA: {linha?.nome || '—'} · herda comportamento {linha?.tipo}</p>
        <div className="space-y-3 text-sm">
          <div>
            <Label>Nome (≈ h1) *</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="CERAM BOLD LISA" />
          </div>
          {isPortfolio && (
            <>
              <div>
                <Label>Posições (vagas)</Label>
                <Input type="number" min="0" value={form.meta_vagas} onChange={(e) => setForm({ ...form, meta_vagas: e.target.value })} />
              </div>
              <div>
                <Label>Massa crítica (cx)</Label>
                <Input type="number" min="0" step="1" value={form.massa_critica} onChange={(e) => setForm({ ...form, massa_critica: e.target.value })} />
                <p className="text-[10px] text-muted-foreground mt-1">Abaixo de 16 cx perde poder de conversão real.</p>
              </div>
              <div>
                <Label>Mín. linhas saldável</Label>
                <Input type="number" min="0" value={form.min_linhas_saldavel} onChange={(e) => setForm({ ...form, min_linhas_saldavel: e.target.value })} />
                <p className="text-[10px] text-muted-foreground mt-1">Saldável com ≥ 9 posições atingindo massa crítica.</p>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
