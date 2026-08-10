import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PlusCircle, Edit, Trash2, CreditCard } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

const TIPO_ICONS = {
  'Dinheiro': '💵', 'PIX': '⚡', 'Cartão Débito': '💳',
  'Cartão Crédito': '💳', 'Boleto': '📄', 'Transferência': '🔁',
};

export default function FormasPagamentoManager() {
  const [formasPagamento, setFormasPagamento] = useState([]);
  const [contas, setContas] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedForma, setSelectedForma] = useState(null);
  const [formData, setFormData] = useState({
    nome: '', tipo: 'Dinheiro', conta_destino_id: '', conta_destino_nome: '',
    prazo_recebimento_dias: 0, tipo_taxa: 'Percentual', valor_taxa: 0, parcelas_max: 1,
    adquirente: '', ativo: true
  });
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [formasData, contasData] = await Promise.all([
      base44.entities.FormasDePagamento.list(),
      base44.entities.ContasFinanceiras.list()
    ]);
    setFormasPagamento(formasData);
    setContas(contasData);
  };

  const handleSave = async () => {
    const conta = contas.find(c => c.id === formData.conta_destino_id);
    const dataToSave = { ...formData, conta_destino_nome: conta?.nome || '' };
    if (selectedForma) {
      await base44.entities.FormasDePagamento.update(selectedForma.id, dataToSave);
      toast({ title: "✓ Forma de pagamento atualizada", className: "bg-card", duration: 2000 });
    } else {
      await base44.entities.FormasDePagamento.create(dataToSave);
      toast({ title: "✓ Forma de pagamento criada", className: "bg-card", duration: 2000 });
    }
    loadData(); setIsDialogOpen(false); resetForm();
  };

  const handleEdit = (forma) => {
    setSelectedForma(forma);
    setFormData({ nome: forma.nome, tipo: forma.tipo, conta_destino_id: forma.conta_destino_id,
      conta_destino_nome: forma.conta_destino_nome, prazo_recebimento_dias: forma.prazo_recebimento_dias,
      tipo_taxa: forma.tipo_taxa, valor_taxa: forma.valor_taxa, parcelas_max: forma.parcelas_max,
      adquirente: forma.adquirente || '', ativo: forma.ativo });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Deseja realmente excluir esta forma de pagamento?')) {
      await base44.entities.FormasDePagamento.delete(id);
      toast({ title: "✓ Excluída", className: "bg-card", duration: 2000 });
      loadData();
    }
  };

  const resetForm = () => {
    setSelectedForma(null);
    setFormData({ nome: '', tipo: 'Dinheiro', conta_destino_id: '', conta_destino_nome: '',
      prazo_recebimento_dias: 0, tipo_taxa: 'Percentual', valor_taxa: 0, parcelas_max: 1, adquirente: '', ativo: true });
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between pb-3 border-b border-border/40">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-muted-foreground" /> Formas de Pagamento
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">PIX, dinheiro, cartões e outras formas</p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-muted dark:text-foreground gap-1.5 h-8 px-3 text-xs">
          <PlusCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Nova Forma</span>
        </Button>
      </div>

      {formasPagamento.length === 0 ? (
        <div className="text-center py-12 rounded-xl bg-muted/50/50">
          <CreditCard className="w-10 h-10 mx-auto mb-3 text-muted-foreground dark:text-foreground/90" />
          <p className="text-sm text-muted-foreground mb-4">Nenhuma forma cadastrada</p>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} size="sm"
            className="bg-primary text-white gap-1.5">
            <PlusCircle className="w-3.5 h-3.5" /> Criar Primeira
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {formasPagamento.map(forma => (
            <div key={forma.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card shadow-sm">
              <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center text-base flex-shrink-0">
                {TIPO_ICONS[forma.tipo] || '💳'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground truncate">{forma.nome}</span>
                  {!forma.ativo && (
                    <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">inativa</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-2">
                  <span>{forma.tipo}</span>
                  {forma.adquirente && <span>· {forma.adquirente}</span>}
                  <span>· {forma.tipo_taxa === 'Percentual' ? `${forma.valor_taxa}%` : `R$ ${forma.valor_taxa?.toFixed(2)}`}</span>
                  <span>· D+{forma.prazo_recebimento_dias}d</span>
                  {forma.conta_destino_nome && <span>· {forma.conta_destino_nome}</span>}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" onClick={() => handleEdit(forma)}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground/90 dark:hover:text-muted-foreground">
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(forma.id)}
                  className="h-7 w-7 text-muted-foreground hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-sm dark:bg-background dark:border-border/40 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              {selectedForma ? 'Editar Forma de Pagamento' : 'Nova Forma de Pagamento'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Nome *</Label>
              <Input value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})}
                placeholder="Ex: Cielo Crédito 3x"
                className="bg-muted/50 border-0 shadow-sm h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Tipo *</Label>
                <Select value={formData.tipo} onValueChange={v => setFormData({...formData, tipo: v})}>
                  <SelectTrigger className="bg-muted/50 border-0 shadow-sm h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-muted">
                    {['Dinheiro','PIX','Cartão Débito','Cartão Crédito','Boleto','Transferência'].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Adquirente</Label>
                <Input value={formData.adquirente} onChange={e => setFormData({...formData, adquirente: e.target.value})}
                  placeholder="Cielo, Stone..." className="bg-muted/50 border-0 shadow-sm h-9 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Conta Destino *</Label>
              <Select value={formData.conta_destino_id} onValueChange={v => setFormData({...formData, conta_destino_id: v})}>
                <SelectTrigger className="bg-muted/50 border-0 shadow-sm h-9 text-sm">
                  <SelectValue placeholder="Selecione a conta..." />
                </SelectTrigger>
                <SelectContent className="dark:bg-muted">
                  {contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Tipo Taxa</Label>
                <Select value={formData.tipo_taxa} onValueChange={v => setFormData({...formData, tipo_taxa: v})}>
                  <SelectTrigger className="bg-muted/50 border-0 shadow-sm h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-muted">
                    <SelectItem value="Percentual">%</SelectItem>
                    <SelectItem value="Fixo">R$</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Taxa</Label>
                <Input type="number" step="0.01" value={formData.valor_taxa}
                  onChange={e => setFormData({...formData, valor_taxa: parseFloat(e.target.value) || 0})}
                  className="bg-muted/50 border-0 shadow-sm h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Parcelas Máx</Label>
                <Input type="number" value={formData.parcelas_max}
                  onChange={e => setFormData({...formData, parcelas_max: parseInt(e.target.value) || 1})}
                  className="bg-muted/50 border-0 shadow-sm h-9 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Prazo Recebimento (dias)</Label>
              <Input type="number" value={formData.prazo_recebimento_dias}
                onChange={e => setFormData({...formData, prazo_recebimento_dias: parseInt(e.target.value) || 0})}
                className="bg-muted/50 border-0 shadow-sm h-9 text-sm" />
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