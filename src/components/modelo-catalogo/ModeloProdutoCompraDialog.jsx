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
import { Checkbox } from '@/components/ui/checkbox';
import { insertModeloProdutoCompra } from '@/lib/modeloCatalogo/fetchModeloCatalogo';
import { slugCodigo } from '@/lib/modeloCatalogo/montarNomeSku';
import { resolveParametrosProdutoCompra } from '@/lib/modeloCatalogo/resolveParametrosModelo';
import { toast } from 'sonner';

export default function ModeloProdutoCompraDialog({ open, onClose, onSaved, linha }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nome: '',
    herdar_meta: true,
    herdar_massa: true,
    herdar_min_linhas: true,
    meta_vagas: '',
    massa_critica: '',
    min_linhas_saldavel: '',
  });

  const linhaDefaults = linha ? resolveParametrosProdutoCompra({}, linha) : null;

  React.useEffect(() => {
    if (open) {
      setForm({
        nome: '',
        herdar_meta: true,
        herdar_massa: true,
        herdar_min_linhas: true,
        meta_vagas: '',
        massa_critica: '',
        min_linhas_saldavel: '',
      });
    }
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
        meta_vagas: form.herdar_meta ? null : (form.meta_vagas !== '' ? Number(form.meta_vagas) : null),
        massa_critica: form.herdar_massa ? null : (form.massa_critica !== '' ? Number(form.massa_critica) : null),
        min_linhas_saldavel: form.herdar_min_linhas ? null : (form.min_linhas_saldavel !== '' ? Number(form.min_linhas_saldavel) : null),
        eixo_a_rotulo: null,
        eixo_b_rotulo: null,
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo produto compra (laboratório)</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          LINHA: {linha?.nome || '—'} · herda defaults salvo override abaixo.
        </p>
        {linhaDefaults && (
          <p className="text-[11px] text-muted-foreground rounded border px-2 py-1.5 bg-muted/30">
            LINHA: {linhaDefaults.meta_vagas} pos. · {linhaDefaults.massa_critica} cx · saldável ≥ {linhaDefaults.min_linhas_saldavel} linhas
          </p>
        )}
        <div className="space-y-3 text-sm">
          <div>
            <Label>Nome (≈ h1) *</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="CERAM BOLD LISA" />
          </div>

          <ParamField
            label="Posições (vagas)"
            herdar={form.herdar_meta}
            onHerdar={(v) => setForm({ ...form, herdar_meta: v })}
            value={form.meta_vagas}
            onChange={(v) => setForm({ ...form, meta_vagas: v })}
            linhaVal={linhaDefaults?.meta_vagas}
          />
          <ParamField
            label="Massa crítica (cx)"
            herdar={form.herdar_massa}
            onHerdar={(v) => setForm({ ...form, herdar_massa: v })}
            value={form.massa_critica}
            onChange={(v) => setForm({ ...form, massa_critica: v })}
            linhaVal={linhaDefaults?.massa_critica}
            hint="Abaixo perde poder de conversão real."
          />
          <ParamField
            label="Mín. linhas saldável"
            herdar={form.herdar_min_linhas}
            onHerdar={(v) => setForm({ ...form, herdar_min_linhas: v })}
            value={form.min_linhas_saldavel}
            onChange={(v) => setForm({ ...form, min_linhas_saldavel: v })}
            linhaVal={linhaDefaults?.min_linhas_saldavel}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ParamField({ label, herdar, onHerdar, value, onChange, linhaVal, hint }) {
  return (
    <div className="space-y-1.5 rounded border p-2">
      <div className="flex items-center gap-2">
        <Checkbox id={`h-${label}`} checked={herdar} onCheckedChange={(v) => onHerdar(Boolean(v))} />
        <Label htmlFor={`h-${label}`} className="text-xs font-normal cursor-pointer">
          Herdar da LINHA ({linhaVal ?? '—'})
        </Label>
      </div>
      {!herdar && (
        <>
          <Label className="text-xs">{label} (override)</Label>
          <Input type="number" min="0" step="1" value={value} onChange={(e) => onChange(e.target.value)} />
          {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
        </>
      )}
    </div>
  );
}
