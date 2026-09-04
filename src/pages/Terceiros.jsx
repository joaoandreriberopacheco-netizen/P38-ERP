import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useTerceirosListQuery, useP38QueryInvalidation } from '@/hooks/useP38Entities';
import { p38Keys } from '@/lib/p38QueryConfig';
import { P38PageHeader } from '@/components/layout/P38PageHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, P38TableShell } from '@/components/ui/table';
import { P38MobileLine, P38MobileLineList, P38StatusLabel, p38AccentKeyFromTone } from '@/components/ui/p38-mobile-line';
import { Users, PlusCircle, Edit, Trash2, Search, Download, Upload } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import ImportacaoTerceiros from '../components/terceiros/ImportacaoTerceiros';

export default function TerceirosPage() {
  const queryClient = useQueryClient();
  const { invalidateTerceiros } = useP38QueryInvalidation();
  const { data: terceiros = [], isLoading, refetch } = useTerceirosListQuery();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTerceiro, setSelectedTerceiro] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [showImportador, setShowImportador] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    cpf_cnpj: '',
    email: '',
    telefone: '',
    endereco: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
    tipo: 'Cliente',
    ativo: true
  });
  const { toast } = useToast();

  const loadTerceiros = () => refetch();

  const handleSave = async () => {
    try {
      if (selectedTerceiro) {
        await base44.entities.Terceiro.update(selectedTerceiro.id, formData);
        toast({ 
          title: "Terceiro atualizado!", 
          className: "bg-card border border-border/40 dark:border-border/40"
        });
      } else {
        const cached = queryClient.getQueryData(p38Keys.terceiros());
        const allTerceiros = Array.isArray(cached) ? cached : terceiros;
        const nextNumber = (allTerceiros.length > 0 
          ? Math.max(...allTerceiros.map(t => parseInt(t.codigo_interno?.split('-')[1] || 0))) 
          : 0) + 1;
        const prefix = formData.tipo === 'Cliente' || formData.tipo === 'Ambos' ? 'CLI' : 'FOR';
        const codigo = `${prefix}-${String(nextNumber).padStart(5, '0')}`;
        
        await base44.entities.Terceiro.create({
          ...formData,
          codigo_interno: codigo
        });
        toast({ 
          title: "Terceiro criado!", 
          className: "bg-card border border-border/40 dark:border-border/40"
        });
      }
      await invalidateTerceiros();
      if (!selectedTerceiro) resetForm();
    } catch (error) {
      toast({ 
        title: "Erro ao salvar", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Deseja realmente excluir este terceiro?')) {
      await base44.entities.Terceiro.delete(id);
      await invalidateTerceiros();
      toast({ 
        title: "Terceiro excluído!", 
        className: "bg-card border border-border/40 dark:border-border/40"
      });
    }
  };

  const handleEdit = (terceiro) => {
    setSelectedTerceiro(terceiro);
    setFormData({
      nome: terceiro.nome,
      cpf_cnpj: terceiro.cpf_cnpj || '',
      email: terceiro.email || '',
      telefone: terceiro.telefone || '',
      endereco: terceiro.endereco || '',
      bairro: terceiro.bairro || '',
      cidade: terceiro.cidade || '',
      estado: terceiro.estado || '',
      cep: terceiro.cep || '',
      tipo: terceiro.tipo,
      ativo: terceiro.ativo
    });
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedTerceiro(null);
    setFormData({
      nome: '',
      cpf_cnpj: '',
      email: '',
      telefone: '',
      endereco: '',
      bairro: '',
      cidade: '',
      estado: '',
      cep: '',
      tipo: 'Cliente',
      ativo: true
    });
  };

  const filteredTerceiros = terceiros.filter(t => {
    const matchSearch = t.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       t.cpf_cnpj?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTipo = tipoFiltro === 'todos' || t.tipo === tipoFiltro;
    return matchSearch && matchTipo;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header glacial */}
      <P38PageHeader
        title="Terceiros"
        description="Clientes, fornecedores e parceiros"
      />

      {/* Controles */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar..." 
              className="pl-6 bg-transparent border-0 border-b border-border/40 rounded-none focus:border-border/40 dark:focus:border-border/40 h-9 text-sm dark:text-foreground" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
          </div>
          <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
            <SelectTrigger className="w-full sm:w-[180px] bg-transparent border-0 border-b border-border/40 rounded-none h-9 text-sm dark:text-foreground">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent className="dark:bg-muted dark:border-border/40">
              <SelectItem value="todos">Todos os Tipos</SelectItem>
              <SelectItem value="Cliente">Cliente</SelectItem>
              <SelectItem value="Fornecedor">Fornecedor</SelectItem>
              <SelectItem value="Ambos">Ambos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-muted" title="Exportar">
            <Download className="w-4 h-4 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-muted" title="Importar" onClick={() => setShowImportador(true)}>
            <Upload className="w-4 h-4 text-muted-foreground" />
          </Button>
          <Button onClick={handleAddNew} className="gap-2 bg-primary hover:bg-primary/90 dark:bg-muted text-white h-9 px-4 rounded-xl text-sm">
            <PlusCircle className="w-4 h-4" /> <span className="hidden sm:inline">Novo</span>
          </Button>
        </div>
      </div>

      {/* Tabela */}
      {filteredTerceiros.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-2xl shadow-sm">
          <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground dark:text-foreground/90" />
          <p className="text-sm text-muted-foreground mb-4">Nenhum terceiro cadastrado</p>
          <Button onClick={handleAddNew} className="gap-2 bg-primary hover:bg-primary/90 text-white text-sm h-9 px-4">
            <PlusCircle className="w-4 h-4" /> Criar Primeiro Terceiro
          </Button>
        </div>
      ) : (
        <>
          <P38MobileLineList className="desktop-layout:hidden">
            {filteredTerceiros.map((terceiro, index) => (
              <P38MobileLine
                key={terceiro.id}
                striped={index % 2 === 1}
                accent={p38AccentKeyFromTone(terceiro.ativo !== false ? 'success' : 'muted')}
                title={terceiro.nome}
                subtitle={terceiro.codigo_interno}
                meta={
                  <>
                    <P38StatusLabel tone={terceiro.ativo !== false ? 'success' : 'muted'}>
                      {terceiro.ativo !== false ? 'Ativo' : 'Inativo'}
                    </P38StatusLabel>
                    <span>{terceiro.tipo}</span>
                    <span>{terceiro.cpf_cnpj || '-'}</span>
                  </>
                }
                value={terceiro.cidade || '-'}
                trailing={
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(terceiro)}
                      className="h-8 w-8 text-muted-foreground"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(terceiro.id)}
                      className="h-8 w-8 text-muted-foreground"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                }
              />
            ))}
          </P38MobileLineList>

          <P38TableShell className="hidden desktop-layout:block min-w-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome / Razão Social</TableHead>
                  <TableHead>CPF / CNPJ</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTerceiros.map(terceiro => (
                  <TableRow key={terceiro.id}>
                    <TableCell className="font-mono text-xs">{terceiro.codigo_interno}</TableCell>
                    <TableCell className="font-medium">{terceiro.nome}</TableCell>
                    <TableCell>{terceiro.cpf_cnpj || '-'}</TableCell>
                    <TableCell>{terceiro.cidade || '-'}</TableCell>
                    <TableCell>{terceiro.tipo}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(terceiro)}
                          className="h-8 w-8"
                        >
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(terceiro.id)}
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </P38TableShell>
        </>
      )}

      <ImportacaoTerceiros 
        isOpen={showImportador}
        onClose={() => setShowImportador(false)}
        onSuccess={loadTerceiros}
      />

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl dark:bg-background dark:border-border/40">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {selectedTerceiro ? 'Editar Terceiro' : 'Novo Terceiro'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label className="text-foreground/90">Nome / Razão Social *</Label>
                <Input 
                  value={formData.nome}
                  onChange={e => setFormData({...formData, nome: e.target.value})}
                  className="dark:bg-muted dark:border-border/40 dark:text-foreground"
                />
              </div>
              <div>
                <Label className="text-foreground/90">CPF / CNPJ</Label>
                <Input 
                  value={formData.cpf_cnpj}
                  onChange={e => setFormData({...formData, cpf_cnpj: e.target.value})}
                  className="dark:bg-muted dark:border-border/40 dark:text-foreground"
                />
              </div>
              <div>
                <Label className="text-foreground/90">Tipo *</Label>
                <Select value={formData.tipo} onValueChange={v => setFormData({...formData, tipo: v})}>
                  <SelectTrigger className="dark:bg-muted dark:border-border/40 dark:text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-muted dark:border-border/40">
                    <SelectItem value="Cliente">Cliente</SelectItem>
                    <SelectItem value="Fornecedor">Fornecedor</SelectItem>
                    <SelectItem value="Ambos">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-foreground/90">Email</Label>
                <Input 
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="dark:bg-muted dark:border-border/40 dark:text-foreground"
                />
              </div>
              <div>
                <Label className="text-foreground/90">Telefone</Label>
                <Input 
                  value={formData.telefone}
                  onChange={e => setFormData({...formData, telefone: e.target.value})}
                  className="dark:bg-muted dark:border-border/40 dark:text-foreground"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="dark:bg-muted dark:border-border/40 text-foreground/90 h-11 md:h-10 w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-muted text-white h-11 md:h-10 w-full sm:w-auto">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}