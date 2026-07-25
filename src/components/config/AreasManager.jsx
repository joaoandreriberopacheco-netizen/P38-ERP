import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit3, Trash2, MapPin, Download, Loader2, FileUp, FileText } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function AreasManager() {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingArea, setEditingArea] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [formData, setFormData] = useState({ codigo: '', nome: '', descricao: '', ativo: true });
  const { toast } = useToast();

  useEffect(() => { loadAreas(); }, []);

  const loadAreas = async () => {
    setLoading(true);
    const data = await base44.entities.Area.list();
    setAreas(data.sort((a, b) => a.nome.localeCompare(b.nome)));
    setLoading(false);
  };

  const handleSave = async () => {
    if (editingArea) {
      await base44.entities.Area.update(editingArea.id, formData);
      toast({ title: 'Área atualizada!' });
    } else {
      await base44.entities.Area.create(formData);
      toast({ title: 'Área criada!' });
    }
    loadAreas(); handleClose();
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja realmente excluir esta área?')) return;
    await base44.entities.Area.delete(id);
    toast({ title: 'Área excluída!' }); loadAreas();
  };

  const handleEdit = (area) => { setEditingArea(area); setFormData(area); setShowDialog(true); };
  const handleClose = () => {
    setShowDialog(false); setEditingArea(null);
    setFormData({ codigo: '', nome: '', descricao: '', ativo: true });
  };

  const handleExport = () => {
    const csv = [['Código','Nome','Descrição','Ativo'], ...areas.map(a => [a.codigo, a.nome, a.descricao || '', a.ativo ? 'Sim' : 'Não'])]
      .map(r => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'areas.csv'; link.click();
  };

  const handleDownloadTemplate = () => {
    const template = [['Código','Nome','Descrição','Ativo'],['A1','HIDRÁULICA','Produtos de hidráulica','Sim'],['A2','ELÉTRICA','Produtos de elétrica','Sim']]
      .map(r => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'template_areas.csv'; link.click();
  };

  const handleImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setImporting(true); setImportResult(null);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const { data } = await base44.functions.invoke('importarAreas', { file_url });
    setImportResult(data); loadAreas();
    toast({ title: 'Importação concluída!', description: `${data.criadas} criadas, ${data.atualizadas} atualizadas` });
    setImporting(false); e.target.value = '';
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/40">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" /> Áreas / Setores
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Áreas e setores da loja</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" onClick={handleDownloadTemplate} className="h-8 w-8" title="Template CSV">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleExport} className="h-8 w-8" title="Exportar">
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
          <div className="relative">
            <input type="file" id="import-areas" className="hidden" accept=".csv,.txt" onChange={handleImport} disabled={importing} />
            <Button variant="ghost" size="icon" onClick={() => document.getElementById('import-areas').click()}
              disabled={importing} className="h-8 w-8" title="Importar CSV">
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5 text-muted-foreground" />}
            </Button>
          </div>
          <Button onClick={() => setShowDialog(true)} size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-muted dark:text-foreground gap-1.5 h-8 px-3 text-xs">
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nova Área</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : areas.length === 0 ? (
        <div className="text-center py-12 rounded-xl bg-muted/50/50">
          <MapPin className="w-10 h-10 mx-auto mb-3 text-muted-foreground dark:text-foreground/90" />
          <p className="text-sm text-muted-foreground mb-4">Nenhuma área cadastrada</p>
          <Button onClick={() => setShowDialog(true)} size="sm" className="bg-primary text-white gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Criar Primeira
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {areas.map(area => (
            <div key={area.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-primary dark:bg-muted flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-white">{area.codigo}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{area.nome}</p>
                {area.descricao && <p className="text-xs text-muted-foreground truncate">{area.descricao}</p>}
              </div>
              {!area.ativo && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full flex-shrink-0">inativa</span>
              )}
              <div className="flex gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" onClick={() => handleEdit(area)}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground/90 dark:hover:text-muted-foreground">
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(area.id)}
                  className="h-7 w-7 text-muted-foreground hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {importResult?.erros > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400">
          {importResult.detalhes?.erros?.map((e, i) => <p key={i}>{e}</p>)}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm dark:bg-background dark:border-border/40">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              {editingArea ? 'Editar Área' : 'Nova Área'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Código *</Label>
                <Input value={formData.codigo}
                  onChange={e => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                  placeholder="A1" className="bg-muted/50 border-0 shadow-sm h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Nome *</Label>
                <Input value={formData.nome}
                  onChange={e => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Hidráulica" className="bg-muted/50 border-0 shadow-sm h-9 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Descrição</Label>
              <Textarea value={formData.descricao || ''}
                onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descrição opcional..."
                className="bg-muted/50 border-0 shadow-sm text-sm resize-none" rows={2} />
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50">
              <Checkbox checked={formData.ativo} onCheckedChange={v => setFormData({ ...formData, ativo: v })} id="area-ativo" />
              <Label htmlFor="area-ativo" className="text-xs font-medium text-foreground/90 cursor-pointer">Área ativa</Label>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={handleClose} className="h-8 text-xs">Cancelar</Button>
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