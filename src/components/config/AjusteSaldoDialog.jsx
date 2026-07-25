import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowUpCircle, ArrowDownCircle, Scale } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { sincronizarSaldosAposAlteracao } from '@/lib/sincronizarSaldoContasFinanceiras';
import { dataHoje } from '@/components/utils/dateUtils';

export default function AjusteSaldoDialog({ open, onOpenChange, conta, saldoCalculado, onSaved }) {
  const [saldoInformado, setSaldoInformado] = useState('0');
  const [dataMovimento, setDataMovimento] = useState(dataHoje());
  const [observacao, setObservacao] = useState('Ajuste manual de saldo');
  const [currentUser, setCurrentUser] = useState(null);
  const { toast } = useToast();

  const saldoAtual = saldoCalculado != null
    ? Number(saldoCalculado)
    : Number(conta?.saldo_atual || 0);

  useEffect(() => {
    if (open && conta) {
      setSaldoInformado(String(saldoAtual));
      setDataMovimento(dataHoje());
      setObservacao('Ajuste manual de saldo');
      base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
    }
  }, [open, conta?.id, saldoAtual]);

  if (!conta) return null;

  const saldoNovo = Number(saldoInformado || 0);
  const diferenca = saldoNovo - saldoAtual;
  const isReforco = diferenca > 0;
  const isSangria = diferenca < 0;
  const formatValor = (valor) => `R$ ${Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleSalvar = async () => {
    if (diferenca === 0) {
      toast({ title: 'Nenhum ajuste necessário', className: 'bg-card' });
      onOpenChange(false);
      return;
    }

    await base44.entities.MovimentosCaixa.create({
      tipo: isReforco ? 'Reforço' : 'Sangria',
      valor: Math.abs(diferenca),
      observacao: observacao || 'Ajuste manual de saldo',
      data_movimento: dataMovimento,
      conta_id: conta.id,
      usuario_responsavel_id: currentUser?.id || 'sistema',
      usuario_responsavel_nome: currentUser?.full_name || currentUser?.email || 'Sistema',
    });

    await sincronizarSaldosAposAlteracao(base44, [conta.id]);

    toast({
      title: isReforco ? 'Ajuste para mais registrado' : 'Ajuste para menos registrado',
      className: 'bg-card',
    });

    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm dark:bg-background dark:border-border/40">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Scale className="w-4 h-4 text-muted-foreground" />
            Ajuste de Saldo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-2xl bg-muted/50 p-3 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground">Conta</p>
            <p className="text-sm font-medium text-foreground">{conta.nome}</p>
            <p className="text-xs text-muted-foreground">
              Saldo atual: {formatValor(saldoAtual)}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-medium">Novo saldo real</Label>
            <Input
              type="number"
              step="0.01"
              value={saldoInformado}
              onChange={(e) => setSaldoInformado(e.target.value)}
              className="bg-muted/50 border-0 shadow-sm h-10 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-medium">Data do ajuste</Label>
            <Input
              type="date"
              value={dataMovimento}
              max={dataHoje()}
              onChange={(e) => setDataMovimento(e.target.value)}
              className="bg-muted/50 border-0 shadow-sm h-10 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-medium">Observação</Label>
            <Input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="bg-muted/50 border-0 shadow-sm h-10 text-sm"
            />
          </div>

          <div className="rounded-2xl bg-card p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Diferença</span>
              <div className="flex items-center gap-2">
                {isReforco && <ArrowUpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                {isSangria && <ArrowDownCircle className="w-4 h-4 text-red-600 dark:text-red-400" />}
                <span className={`text-sm font-semibold ${isReforco ? 'text-emerald-600 dark:text-emerald-400' : isSangria ? 'text-red-600 dark:text-red-400' : 'text-foreground/90'}`}>
                  {diferenca >= 0 ? '+' : '-'}{formatValor(Math.abs(diferenca))}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Será criado um movimento de {isReforco ? 'reforço' : isSangria ? 'sangria' : 'ajuste zero'}.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">Cancelar</Button>
          <Button size="sm" onClick={handleSalvar} className="bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-muted dark:text-foreground h-8 text-xs">
            Confirmar Ajuste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
