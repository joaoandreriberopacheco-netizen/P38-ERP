import React, { useEffect, useMemo, useState } from 'react';
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
import { isPortfolioLinha, resolveEixosCadastro } from '@/lib/cadastroProdutoV2/resolveEixosCadastro';
import { toast } from 'sonner';

const EMPTY = {
  nome: '',
  usar_eixo_a: true,
  usar_eixo_b: true,
  eixo_a_rotulo: '',
  eixo_b_rotulo: '',
  herdar_meta: true,
  herdar_massa: true,
  herdar_min_linhas: true,
  meta_vagas: '',
  massa_critica: '',
  min_linhas_saldavel: '',
};

export default function CadastroProdutoCompraDialog({ open, onClose, onSaved, linha }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const portfolio = isPortfolioLinha(linha);
  const linhaDefaults = linha ? resolveParametrosProdutoCompra({}, linha) : null;
  const linhaEixos = useMemo(() => resolveEixosCadastro(null, linha), [linha]);

  useEffect(() => {
    if (!open || !linha) return;
    setForm({
      ...EMPTY,
      usar_eixo_a: linhaEixos.useA,
      usar_eixo_b: linhaEixos.useB,
      eixo_a_rotulo: linha?.eixo_a_rotulo || '',
      eixo_b_rotulo: linha?.eixo_b_rotulo || '',
    });
  }, [open, linha, linhaEixos.useA, linhaEixos.useB]);

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
        meta_vagas: portfolio && !form.herdar_meta ? (form.meta_vagas !== '' ? Number(form.meta_vagas) : null) : null,
        massa_critica: portfolio && !form.herdar_massa ? (form.massa_critica !== '' ? Number(form.massa_critica) : null) : null,
        min_linhas_saldavel: portfolio && !form.herdar_min_linhas ? (form.min_linhas_saldavel !== '' ? Number(form.min_linhas_saldavel) : null) : null,
        eixo_a_rotulo: form.usar_eixo_a ? (form.eixo_a_rotulo.trim() || linha?.eixo_a_rotulo || 'Eixo A') : '',
        eixo_b_rotulo: form.usar_eixo_b ? (form.eixo_b_rotulo.trim() || linha?.eixo_b_rotulo || 'Eixo B') : '',
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
          <DialogTitle>Novo produto compra</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          LINHA: {linha?.nome || '—'} · o ângulo/tipo da peça entra no nome do produto compra, não num eixo.
        </p>

        <div className="space-y-3 text-sm">
          <div>
            <Label>Nome do produto compra *</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder={portfolio ? 'CERAM BOLD ANTI' : 'JOELHO SOLDÁVEL 90°'}
            />
          </div>

          <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Eixos (0–2)</p>
            <p className="text-[11px] text-muted-foreground">Não é obrigatório usar os dois. Desmarque o que não variar neste produto compra.</p>
            <EixoToggle
              id="eixo-a"
              label="Usar eixo A"
              checked={form.usar_eixo_a}
              onChecked={(v) => setForm({ ...form, usar_eixo_a: v })}
              rotulo={form.eixo_a_rotulo}
              onRotulo={(v) => setForm({ ...form, eixo_a_rotulo: v })}
              placeholder={linha?.eixo_a_rotulo || 'Formato'}
              disabled={!form.usar_eixo_a}
            />
            <EixoToggle
              id="eixo-b"
              label="Usar eixo B"
              checked={form.usar_eixo_b}
              onChecked={(v) => setForm({ ...form, usar_eixo_b: v })}
              rotulo={form.eixo_b_rotulo}
              onRotulo={(v) => setForm({ ...form, eixo_b_rotulo: v })}
              placeholder={linha?.eixo_b_rotulo || 'Bitola / cor'}
              disabled={!form.usar_eixo_b}
            />
          </div>

          {portfolio && linhaDefaults && (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Parâmetros portfolio</p>
              <ParamField
                label="Posições (vagas)"
                herdar={form.herdar_meta}
                onHerdar={(v) => setForm({ ...form, herdar_meta: v })}
                value={form.meta_vagas}
                onChange={(v) => setForm({ ...form, meta_vagas: v })}
                linhaVal={linhaDefaults.meta_vagas}
              />
              <ParamField
                label="Massa crítica (cx)"
                herdar={form.herdar_massa}
                onHerdar={(v) => setForm({ ...form, herdar_massa: v })}
                value={form.massa_critica}
                onChange={(v) => setForm({ ...form, massa_critica: v })}
                linhaVal={linhaDefaults.massa_critica}
              />
              <ParamField
                label="Mín. linhas saldável"
                herdar={form.herdar_min_linhas}
                onHerdar={(v) => setForm({ ...form, herdar_min_linhas: v })}
                value={form.min_linhas_saldavel}
                onChange={(v) => setForm({ ...form, min_linhas_saldavel: v })}
                linhaVal={linhaDefaults.min_linhas_saldavel}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>Criar produto compra</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EixoToggle({ id, label, checked, onChecked, rotulo, onRotulo, placeholder, disabled }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChecked(Boolean(v))} />
        <Label htmlFor={id} className="text-xs font-normal cursor-pointer">{label}</Label>
      </div>
      {checked && (
        <Input
          className="h-8 text-xs"
          value={rotulo}
          onChange={(e) => onRotulo(e.target.value)}
          placeholder={`Rótulo — ${placeholder}`}
          disabled={disabled}
        />
      )}
    </div>
  );
}

function ParamField({ label, herdar, onHerdar, value, onChange, linhaVal }) {
  return (
    <div className="space-y-1 rounded border p-2">
      <div className="flex items-center gap-2">
        <Checkbox id={`h-${label}`} checked={herdar} onCheckedChange={(v) => onHerdar(Boolean(v))} />
        <Label htmlFor={`h-${label}`} className="text-xs font-normal cursor-pointer">
          Herdar da LINHA ({linhaVal ?? '—'})
        </Label>
      </div>
      {!herdar && (
        <>
          <Label className="text-xs">{label}</Label>
          <Input type="number" min="0" step="1" value={value} onChange={(e) => onChange(e.target.value)} />
        </>
      )}
    </div>
  );
}
