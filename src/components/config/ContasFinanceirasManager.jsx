import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Wallet, Edit, Trash2, PlusCircle, Scale, ArrowRightLeft } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import AjusteSaldoDialog from '@/components/config/AjusteSaldoDialog';
import { resolveContaDestinoCaixaPDV } from '@/lib/contaDestinoCaixaPDV';
import {
  calcularSaldosTodasContas,
  getSaldoExibicaoConta,
} from '@/lib/saldoContaFinanceira';

export default function ContasFinanceirasManager() {
  const [contas, setContas] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAjusteOpen, setIsAjusteOpen] = useState(false);
  const [selectedConta, setSelectedConta] = useState(null);
  const [saldosCalculados, setSaldosCalculados] = useState({});
  const [formData, setFormData] = useState({
    nome: '', tipo: 'Conta Bancária', banco: '', agencia: '', conta: '',
    saldo_inicial: 0, saldo_atual: 0, cor: '#10B981', observacoes: '', ativo: true, is_caixa_pdv: false,
    is_caixa_geral: false,
  });
  const { toast } = useToast();

  useEffect(() => { loadContas(); }, []);

  const loadContas = async () => {
    const [data, lancs, movs] = await Promise.all([
      base44.entities.ContasFinanceiras.list(),
      base44.entities.LancamentoFinanceiro.list(),
      base44.entities.MovimentosCaixa.list(),
    ]);
    setContas(data);
    setSaldosCalculados(calcularSaldosTodasContas(data, lancs, movs));
  };

  const handleEdit = (conta) => { setSelectedConta(conta); setFormData(conta); setIsDialogOpen(true); };

  const handleAddNew = () => {
    setSelectedConta(null);
    setFormData({ nome: '', tipo: 'Conta Bancária', banco: '', agencia: '', conta: '',
      saldo_inicial: 0, saldo_atual: 0, cor: '#10B981', observacoes: '', ativo: true, is_caixa_pdv: false,
      is_caixa_geral: false });
    setIsDialogOpen(true);
  };

  const handleAjusteSaldo = (conta) => {
    setSelectedConta(conta);
    setIsAjusteOpen(true);
  };

  const handleDelete = async (conta) => {
    if (!confirm(`Excluir conta "${conta.nome}"?`)) return;
    await base44.entities.ContasFinanceiras.delete(conta.id);
    toast({ title: "Conta excluída!", className: "bg-card" });
    loadContas();
  };

  const handleSave = async () => {
    const dataToSave = { ...formData };
    if (!selectedConta) dataToSave.saldo_atual = dataToSave.saldo_inicial;
    if (dataToSave.is_caixa_geral) {
      const outras = contas.filter((c) => c.is_caixa_geral && c.id !== selectedConta?.id);
      await Promise.all(
        outras.map((c) => base44.entities.ContasFinanceiras.update(c.id, { is_caixa_geral: false }))
      );
    }
    if (selectedConta) {
      await base44.entities.ContasFinanceiras.update(selectedConta.id, dataToSave);
    } else {
      await base44.entities.ContasFinanceiras.create(dataToSave);
    }
    toast({ title: "Conta salva!", className: "bg-card" });
    loadContas(); setIsDialogOpen(false);
  };

  const contaDestinoCaixaPDV = resolveContaDestinoCaixaPDV(contas);

  const handleDefinirDestinoCaixaPDV = async (contaId) => {
    if (!contaId) return;
    try {
      await Promise.all(
        contas.map((c) =>
          base44.entities.ContasFinanceiras.update(c.id, { is_caixa_geral: c.id === contaId })
        )
      );
      const conta = contas.find((c) => c.id === contaId);
      toast({
        title: 'Conta destino definida',
        description: `Recolhimentos e fechamentos do caixa PDV irão para "${conta?.nome}".`,
        className: 'bg-card',
      });
      loadContas();
    } catch (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    }
  };

  const fmtR = (n) => (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between pb-3 border-b border-border/40">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Wallet className="w-4 h-4 text-muted-foreground" /> Contas Financeiras
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Caixas físicos, contas bancárias e carteiras digitais</p>
        </div>
        <Button onClick={handleAddNew} size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-muted dark:text-foreground gap-1.5 h-8 px-3 text-xs">
          <PlusCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Nova Conta</span>
        </Button>
      </div>

      <div className="rounded-xl bg-muted/50/60 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
          <p className="text-xs font-semibold text-foreground/90">Destino do caixa PDV</p>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Recolhimentos durante o turno e o dinheiro do fechamento de caixa são transferidos para esta conta financeira.
        </p>
        <Select
          value={contaDestinoCaixaPDV?.id || ''}
          onValueChange={handleDefinirDestinoCaixaPDV}
        >
          <SelectTrigger className="bg-card border-0 shadow-sm h-9 text-sm">
            <SelectValue placeholder="Selecione a conta destino..." />
          </SelectTrigger>
          <SelectContent className="dark:bg-muted">
            {contas.filter((c) => c.ativo !== false).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {contas.length === 0 ? (
        <div className="text-center py-12 rounded-xl bg-muted/50/50">
          <Wallet className="w-10 h-10 mx-auto mb-3 text-muted-foreground dark:text-foreground/90" />
          <p className="text-sm text-muted-foreground mb-4">Nenhuma conta cadastrada</p>
          <Button onClick={handleAddNew} size="sm" className="bg-primary text-white gap-1.5">
            <PlusCircle className="w-3.5 h-3.5" /> Criar Primeira Conta
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {contas.map(conta => (
            <div key={conta.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-sm ${conta.ativo ? 'bg-card' : 'bg-muted/50/50'}`}>
              {/* Dot de cor */}
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: conta.cor }} />
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground truncate">{conta.nome}</span>
                  {conta.is_caixa_pdv && (
                    <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">PDV</span>
                  )}
                  {conta.is_caixa_geral && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 px-1.5 py-0.5 rounded-full">Destino PDV</span>
                  )}
                  {!conta.ativo && (
                    <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">inativa</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-2">
                  <span>{conta.tipo}</span>
                  {conta.banco && <span>· {conta.banco}{conta.agencia ? ` ag.${conta.agencia}` : ''}</span>}
                </div>
              </div>
              {/* Saldo */}
              <div className="flex-shrink-0 text-right">
                <div className="text-sm font-semibold text-foreground/90 tabular-nums">
                  R$ {fmtR(getSaldoExibicaoConta(conta, saldosCalculados))}
                </div>
              </div>
              {/* Ações */}
              <div className="flex gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" onClick={() => handleAjusteSaldo(conta)}
                  className="h-7 w-7 text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400">
                  <Scale className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleEdit(conta)}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground/90 dark:hover:text-muted-foreground">
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(conta)}
                  className="h-7 w-7 text-muted-foreground hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AjusteSaldoDialog
        open={isAjusteOpen}
        onOpenChange={setIsAjusteOpen}
        conta={selectedConta}
        saldoCalculado={selectedConta ? getSaldoExibicaoConta(selectedConta, saldosCalculados) : 0}
        onSaved={loadContas}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-sm dark:bg-background dark:border-border/40 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              {selectedConta ? 'Editar Conta' : 'Nova Conta Financeira'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Nome *</Label>
              <Input placeholder="Ex: Caixa Loja 1, Banco Itaú" value={formData.nome}
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
                    {['Caixa Físico','Conta Bancária','Carteira Digital','Poupança','Investimento'].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
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
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Banco</Label>
                <Input value={formData.banco} onChange={e => setFormData({ ...formData, banco: e.target.value })}
                  placeholder="Itaú" className="bg-muted/50 border-0 shadow-sm h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Agência</Label>
                <Input value={formData.agencia} onChange={e => setFormData({ ...formData, agencia: e.target.value })}
                  placeholder="0000" className="bg-muted/50 border-0 shadow-sm h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Conta</Label>
                <Input value={formData.conta} onChange={e => setFormData({ ...formData, conta: e.target.value })}
                  placeholder="00000-0" className="bg-muted/50 border-0 shadow-sm h-9 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Saldo Inicial</Label>
              <Input type="number" step="0.01" value={formData.saldo_inicial} disabled={!!selectedConta}
                onChange={e => setFormData({ ...formData, saldo_inicial: parseFloat(e.target.value) || 0 })}
                className="bg-muted/50 border-0 shadow-sm h-9 text-sm" />
              {!!selectedConta && <p className="text-[11px] text-muted-foreground">Saldo inicial não pode ser editado</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Observações</Label>
              <Input value={formData.observacoes} onChange={e => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Informações adicionais..." className="bg-muted/50 border-0 shadow-sm h-9 text-sm" />
            </div>
            <div className="space-y-2 pt-1">
              {[
                { key: 'ativo', label: 'Conta ativa' },
                { key: 'is_caixa_pdv', label: 'Usar como Caixa PDV', desc: 'Pode ser atribuída a um usuário de ponto de venda' },
                { key: 'is_caixa_geral', label: 'Destino de recolhimento e fechamento do caixa PDV', desc: 'Dinheiro retirado no PDV e no fechamento entra nesta conta' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-start gap-2 px-3 py-2 rounded-xl bg-muted/50">
                  <input type="checkbox" checked={formData[key]}
                    onChange={e => setFormData({ ...formData, [key]: e.target.checked })}
                    className="w-4 h-4 mt-0.5 accent-primary" />
                  <div>
                    <p className="text-xs font-medium text-foreground/90">{label}</p>
                    {desc && <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>}
                  </div>
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