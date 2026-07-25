import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Percent, Edit, Trash2, PlusCircle, AlertCircle } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

export default function PoliticasDescontoManager() {
  const [politicas, setPoliticas] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPolitica, setSelectedPolitica] = useState(null);
  const [formData, setFormData] = useState({
    perfil: 'Vendedor Junior', desconto_maximo_percentual: 0,
    requer_aprovacao_acima: 0, pode_aprovar_descontos: false,
    observacoes: '', ativo: true
  });
  const { toast } = useToast();

  useEffect(() => { loadPoliticas(); }, []);
  const loadPoliticas = async () => { setPoliticas(await base44.entities.PoliticasDesconto.list()); };

  const handleEdit = (p) => { setSelectedPolitica(p); setFormData(p); setIsDialogOpen(true); };
  const handleAddNew = () => {
    setSelectedPolitica(null);
    setFormData({ perfil: 'Vendedor Junior', desconto_maximo_percentual: 0, requer_aprovacao_acima: 0, pode_aprovar_descontos: false, observacoes: '', ativo: true });
    setIsDialogOpen(true);
  };

  const handleDelete = async (p) => {
    if (!confirm(`Excluir política de "${p.perfil}"?`)) return;
    await base44.entities.PoliticasDesconto.delete(p.id);
    toast({ title: "Política excluída!", className: "bg-card" });
    loadPoliticas();
  };

  const handleSave = async () => {
    if (selectedPolitica) {
      await base44.entities.PoliticasDesconto.update(selectedPolitica.id, formData);
    } else {
      await base44.entities.PoliticasDesconto.create(formData);
    }
    toast({ title: "Política salva!", className: "bg-card" });
    loadPoliticas(); setIsDialogOpen(false);
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/40">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Percent className="w-4 h-4 text-muted-foreground" /> Políticas de Desconto
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Configure limites de desconto por perfil de usuário</p>
        </div>
        <Button onClick={handleAddNew} size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-muted dark:text-foreground gap-1.5 h-8 px-3 text-xs">
          <PlusCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Adicionar</span>
        </Button>
      </div>

      {/* Info */}
      <div className="flex gap-3 px-4 py-3 rounded-xl bg-muted/50/60">
        <AlertCircle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Descontos acima do limite definido exigirão aprovação de gerente/admin.
        </p>
      </div>

      {politicas.length === 0 ? (
        <div className="text-center py-12 rounded-xl bg-muted/50/50">
          <Percent className="w-10 h-10 mx-auto mb-3 text-muted-foreground dark:text-foreground/90" />
          <p className="text-sm text-muted-foreground mb-4">Nenhuma política cadastrada</p>
          <Button onClick={handleAddNew} size="sm" className="bg-primary text-white gap-1.5">
            <PlusCircle className="w-3.5 h-3.5" /> Criar Primeira Política
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {politicas.map(p => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card shadow-sm">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{p.perfil}</span>
                  {!p.ativo && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">inativa</span>}
                  {p.pode_aprovar_descontos && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">pode aprovar</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-3">
                  <span>Máx. {p.desconto_maximo_percentual}%</span>
                  <span>· Aprova acima de {p.requer_aprovacao_acima}%</span>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground/90 dark:hover:text-muted-foreground">
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(p)}
                  className="h-7 w-7 text-muted-foreground hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-sm dark:bg-background dark:border-border/40">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Percent className="w-4 h-4 text-muted-foreground" />
              {selectedPolitica ? 'Editar Política' : 'Nova Política de Desconto'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Perfil *</Label>
              <Select value={formData.perfil} onValueChange={v => setFormData({ ...formData, perfil: v })}>
                <SelectTrigger className="bg-muted/50 border-0 shadow-sm h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-muted">
                  {['Admin','Gerente','Vendedor Junior','Estoquista','Financeiro'].map(v => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Desconto Máximo (%)</Label>
                <Input type="number" step="0.1" value={formData.desconto_maximo_percentual}
                  onChange={e => setFormData({ ...formData, desconto_maximo_percentual: parseFloat(e.target.value) || 0 })}
                  className="bg-muted/50 border-0 shadow-sm h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Aprovação Acima (%)</Label>
                <Input type="number" step="0.1" value={formData.requer_aprovacao_acima}
                  onChange={e => setFormData({ ...formData, requer_aprovacao_acima: parseFloat(e.target.value) || 0 })}
                  className="bg-muted/50 border-0 shadow-sm h-9 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Observações</Label>
              <Input value={formData.observacoes}
                onChange={e => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Ex: Política padrão para vendedores..."
                className="bg-muted/50 border-0 shadow-sm h-9 text-sm" />
            </div>
            <div className="space-y-2 pt-1">
              {[
                { key: 'pode_aprovar_descontos', label: 'Pode aprovar descontos de outros' },
                { key: 'ativo', label: 'Política ativa' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50">
                  <input type="checkbox" checked={formData[key]}
                    onChange={e => setFormData({ ...formData, [key]: e.target.checked })}
                    className="w-4 h-4 accent-primary" />
                  <p className="text-xs font-medium text-foreground/90">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setIsDialogOpen(false)} className="h-8 text-xs">Cancelar</Button>
            <Button size="sm" onClick={handleSave}
              className="bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-muted dark:text-foreground h-8 text-xs">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}