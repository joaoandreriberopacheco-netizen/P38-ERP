import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FileText, Edit, Trash2, PlusCircle } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

export default function CategoriasFinanceirasManager() {
  const [categorias, setCategorias] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategoria, setSelectedCategoria] = useState(null);
  const [formData, setFormData] = useState({ nome: '', tipo: 'Receita', cor: '#3B82F6', orcamento_mensal: 0, ativo: true });
  const { toast } = useToast();

  useEffect(() => { loadCategorias(); }, []);
  const loadCategorias = async () => { setCategorias(await base44.entities.CategoriaFinanceira.list()); };

  const handleEdit = (c) => { setSelectedCategoria(c); setFormData(c); setIsDialogOpen(true); };
  const handleAddNew = () => {
    setSelectedCategoria(null);
    setFormData({ nome: '', tipo: 'Receita', cor: '#3B82F6', orcamento_mensal: 0, ativo: true });
    setIsDialogOpen(true);
  };

  const handleDelete = async (cat) => {
    if (!confirm(`Excluir "${cat.nome}"?`)) return;
    await base44.entities.CategoriaFinanceira.delete(cat.id);
    toast({ title: "Categoria excluída!", className: "bg-card" });
    loadCategorias();
  };

  const handleSave = async () => {
    if (selectedCategoria) {
      await base44.entities.CategoriaFinanceira.update(selectedCategoria.id, formData);
    } else {
      await base44.entities.CategoriaFinanceira.create(formData);
    }
    toast({ title: "Categoria salva!", className: "bg-card" });
    loadCategorias(); setIsDialogOpen(false);
  };

  const receitas  = categorias.filter(c => c.tipo === 'Receita' || c.tipo === 'Ambos');
  const despesas  = categorias.filter(c => c.tipo === 'Despesa' || c.tipo === 'Ambos');

  const CatList = ({ items, label, emptyText }) => (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">{label} ({items.length})</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">{emptyText}</p>
      ) : items.map(cat => (
        <div key={cat.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-card shadow-sm">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.cor }} />
          <span className="flex-1 text-sm text-foreground/90 truncate">{cat.nome}</span>
          {!cat.ativo && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">inativa</span>}
          <div className="flex gap-1 flex-shrink-0">
            <Button variant="ghost" size="icon" onClick={() => handleEdit(cat)}
              className="h-6 w-6 text-muted-foreground hover:text-foreground/90 dark:hover:text-muted-foreground">
              <Edit className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(cat)}
              className="h-6 w-6 text-muted-foreground hover:text-red-500">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between pb-3 border-b border-border/40">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" /> Categorias Financeiras
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Organize receitas e despesas</p>
        </div>
        <Button onClick={handleAddNew} size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-muted dark:text-foreground gap-1.5 h-8 px-3 text-xs">
          <PlusCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Nova Categoria</span>
        </Button>
      </div>

      {categorias.length === 0 ? (
        <div className="text-center py-12 rounded-xl bg-muted/50/50">
          <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground dark:text-foreground/90" />
          <p className="text-sm text-muted-foreground mb-4">Nenhuma categoria cadastrada</p>
          <Button onClick={handleAddNew} size="sm" className="bg-primary text-white gap-1.5">
            <PlusCircle className="w-3.5 h-3.5" /> Criar Primeira
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CatList items={receitas} label="Receitas" emptyText="Nenhuma categoria de receita" />
          <CatList items={despesas} label="Despesas" emptyText="Nenhuma categoria de despesa" />
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-sm dark:bg-background dark:border-border/40">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              {selectedCategoria ? 'Editar Categoria' : 'Nova Categoria'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Nome *</Label>
              <Input placeholder="Ex: Vendas, Aluguel..." value={formData.nome}
                onChange={e => setFormData({ ...formData, nome: e.target.value })}
                className="bg-muted/50 border-0 shadow-sm h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Tipo *</Label>
                <Select value={formData.tipo} onValueChange={v => setFormData({ ...formData, tipo: v })}>
                  <SelectTrigger className="bg-muted/50 border-0 shadow-sm h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-muted">
                    <SelectItem value="Receita">Receita</SelectItem>
                    <SelectItem value="Despesa">Despesa</SelectItem>
                    <SelectItem value="Ambos">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Cor</Label>
                <Input type="color" value={formData.cor}
                  onChange={e => setFormData({ ...formData, cor: e.target.value })}
                  className="bg-muted/50 border-0 shadow-sm h-9 px-2" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Orçamento Mensal</Label>
              <Input type="number" step="0.01" value={formData.orcamento_mensal}
                onChange={e => setFormData({ ...formData, orcamento_mensal: parseFloat(e.target.value) || 0 })}
                className="bg-muted/50 border-0 shadow-sm h-9 text-sm" />
              <p className="text-[11px] text-muted-foreground">Meta/limite mensal para esta categoria</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50">
              <input type="checkbox" checked={formData.ativo}
                onChange={e => setFormData({ ...formData, ativo: e.target.checked })}
                className="w-4 h-4 accent-primary" />
              <p className="text-xs font-medium text-foreground/90">Categoria ativa</p>
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