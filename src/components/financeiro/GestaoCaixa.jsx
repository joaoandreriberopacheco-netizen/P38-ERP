import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { buildSubstituicoesVendaCaixa } from '@/lib/substituicoesVendaCaixa';
import { getDataMovimentoCaixa } from '@/lib/saldoContaFinanceira';

export default function GestaoCaixa() {
  const [fluxoCaixa, setFluxoCaixa] = useState({
    vendas: 0,
    sangrias: 0,
    reforcos: 0,
    saldo: 0
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tipoMovimento, setTipoMovimento] = useState('');
  const [movimentoData, setMovimentoData] = useState({
    valor: 0,
    observacao: '',
    conta_id: ''
  });
  const [currentUser, setCurrentUser] = useState(null);
  const [contas, setContas] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const user = await base44.auth.me();
    setCurrentUser(user);

    const contasData = await base44.entities.ContasFinanceiras.list();
    setContas(contasData);

    const hoje = new Date();
    const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

    const [todasVendas, todosVales, todasDevolucoes] = await Promise.all([
      base44.entities.PedidoVenda.list(),
      base44.entities.ValeCompra.list(),
      base44.entities.DevolucaoTroca.list(),
    ]);
    const vendasDia = todasVendas.filter(v =>
      (v.status === 'Finalizado' || v.status === 'Financeiro OK' || v.status === 'Pedido Concluído') &&
      new Date(v.created_date) >= inicioDia
    );
    const subCtx = buildSubstituicoesVendaCaixa({
      vendas: vendasDia,
      vales: todosVales,
      devolucoes: todasDevolucoes,
    });
    const totalVendas = subCtx.totalVendasUtil;

    // Buscar movimentos de caixa do dia
    const todosMovimentos = await base44.entities.MovimentosCaixa.list();
    const movimentosDia = todosMovimentos.filter(m => 
      new Date(getDataMovimentoCaixa(m)) >= inicioDia
    );

    const totalSangrias = movimentosDia
      .filter(m => m.tipo === 'Sangria')
      .reduce((acc, m) => acc + (m.valor || 0), 0);

    const totalReforcos = movimentosDia
      .filter(m => m.tipo === 'Reforço')
      .reduce((acc, m) => acc + (m.valor || 0), 0);

    const saldoDia = totalVendas + totalReforcos - totalSangrias;

    setFluxoCaixa({
      vendas: totalVendas,
      sangrias: totalSangrias,
      reforcos: totalReforcos,
      saldo: saldoDia
    });
  };

  const handleAbrirDialog = async (tipo) => {
    setTipoMovimento(tipo);
    // Recarrega contas sempre que abre o dialog para garantir lista atualizada
    const contasData = await base44.entities.ContasFinanceiras.filter({ ativo: true });
    setContas(contasData);
    // Pré-seleciona a conta Caixa Geral se existir
    const caixaGeral = contasData.find(c => c.is_caixa_geral);
    setMovimentoData({ valor: 0, observacao: '', conta_id: caixaGeral?.id || '' });
    setIsDialogOpen(true);
  };

  const handleRegistrarMovimento = async () => {
    if (!movimentoData.conta_id) {
      alert('Selecione uma conta financeira');
      return;
    }

    if (movimentoData.valor <= 0) {
      alert('Valor deve ser maior que zero');
      return;
    }

    // Gerar número sequencial
    const todosMovimentos = await base44.entities.MovimentosCaixa.list();
    const proximoNumero = todosMovimentos.length + 1;
    const numeroFormatado = `MCX-${String(proximoNumero).padStart(5, '0')}`;

    // Criar movimento
    await base44.entities.MovimentosCaixa.create({
      numero: numeroFormatado,
      tipo: tipoMovimento,
      valor: movimentoData.valor,
      observacao: movimentoData.observacao,
      conta_id: movimentoData.conta_id,
      usuario_responsavel_id: currentUser.id,
      usuario_responsavel_nome: currentUser.full_name
    });

    // Atualizar saldo da conta
    const conta = contas.find(c => c.id === movimentoData.conta_id);
    if (conta) {
      const novoSaldo = tipoMovimento === 'Reforço'
        ? (conta.saldo_atual || 0) + movimentoData.valor
        : (conta.saldo_atual || 0) - movimentoData.valor;

      await base44.entities.ContasFinanceiras.update(conta.id, {
        saldo_atual: novoSaldo
      });
    }

    setIsDialogOpen(false);
    loadData();
  };

  const formatCurrency = (value) => {
    return `R$ ${(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] bg-card dark:bg-card shadow-sm p-4 md:p-5 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-medium text-foreground font-glacial">Caixa do dia</h3>
            <p className="text-sm text-muted-foreground">Resumo das movimentações e atalhos rápidos</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => handleAbrirDialog('Sangria')} className="h-11 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90">
              Sangria
            </Button>
            <Button onClick={() => handleAbrirDialog('Reforço')} variant="ghost" className="h-11 rounded-2xl bg-muted dark:bg-muted text-foreground/90 hover:bg-muted dark:hover:bg-muted">
              Reforço
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-muted dark:bg-muted p-4">
            <div className="text-xs text-muted-foreground mb-1">Vendas</div>
            <div className="text-xl font-semibold text-foreground">{formatCurrency(fluxoCaixa.vendas)}</div>
          </div>
          <div className="rounded-2xl bg-muted dark:bg-muted p-4">
            <div className="text-xs text-muted-foreground mb-1">Reforços</div>
            <div className="text-xl font-semibold text-foreground">{formatCurrency(fluxoCaixa.reforcos)}</div>
          </div>
          <div className="rounded-2xl bg-muted dark:bg-muted p-4">
            <div className="text-xs text-muted-foreground mb-1">Sangrias</div>
            <div className="text-xl font-semibold text-foreground">{formatCurrency(fluxoCaixa.sangrias)}</div>
          </div>
          <div className="rounded-2xl bg-muted dark:bg-muted p-4">
            <div className="text-xs text-muted-foreground mb-1">Saldo</div>
            <div className="text-xl font-semibold text-foreground">{formatCurrency(fluxoCaixa.saldo)}</div>
          </div>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="dark:bg-card dark:border-border/40 rounded-3xl border-0">
          <DialogHeader>
            <DialogTitle className="text-foreground font-glacial">
              Registrar {tipoMovimento}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-foreground/90">Valor</Label>
              <Input type="number" step="0.01" value={movimentoData.valor} onChange={e => setMovimentoData({...movimentoData, valor: parseFloat(e.target.value) || 0})} placeholder="0,00" className="mt-1 h-11 rounded-2xl bg-muted dark:bg-muted border-0 dark:text-foreground" />
            </div>
            <div>
              <Label className="text-foreground/90">Conta Financeira</Label>
              <Select value={movimentoData.conta_id} onValueChange={v => setMovimentoData({...movimentoData, conta_id: v})}>
                <SelectTrigger className="mt-1 h-11 rounded-2xl bg-muted dark:bg-muted border-0 dark:text-foreground">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="dark:bg-card dark:border-border/40">
                  {contas.map(conta => (
                    <SelectItem key={conta.id} value={conta.id}>{conta.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-foreground/90">Observação</Label>
              <Textarea value={movimentoData.observacao} onChange={e => setMovimentoData({...movimentoData, observacao: e.target.value})} placeholder="Motivo do movimento..." className="mt-1 rounded-2xl bg-muted dark:bg-muted border-0 dark:text-foreground" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-2xl">Cancelar</Button>
            <Button onClick={handleRegistrarMovimento} className="rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground border border-primary/80 dark:border-transparent">Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}