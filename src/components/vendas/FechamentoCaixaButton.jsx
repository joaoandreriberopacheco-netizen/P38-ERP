import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Lock } from 'lucide-react';
import SafeActionButton from '@/components/ui/safe-action-button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import {
  resolveContaDestinoCaixaPDV,
  resolverSaldoGavetaCaixaPDV,
  transferirDinheiroFechamentoCaixaPDV,
} from '@/lib/contaDestinoCaixaPDV';
import RelatorioFechamentoCaixa from './caixa/RelatorioFechamentoCaixa';

/**
 * Botão de fechamento de caixa com proteção contra clique duplo.
 */
export default function FechamentoCaixaButton({
  caixaData,
  recebimentosDinheiro,
  turnoAtivo,
  currentUser,
  contaCaixaPDV,
  onFechado,
}) {
  const { toast } = useToast();
  const [showRelatorio, setShowRelatorio] = useState(false);
  const [turnoFechado, setTurnoFechado] = useState(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [showConfirmacao, setShowConfirmacao] = useState(false);

  const handleFechar = async () => {
    if (isClosing) return;
    setIsClosing(true);
    const dinheiroConferido = roundToTwoDecimals(
      parseFloat(recebimentosDinheiro.replace(/\./g, '').replace(',', '.')) || 0
    );
    const totalConferido = roundToTwoDecimals(
      dinheiroConferido +
        caixaData.recebimentos.pix +
        (caixaData.recebimentos.credito || 0) +
        (caixaData.recebimentos.debito || 0)
    );
    const esperado = roundToTwoDecimals(caixaData.liquidez - (caixaData.recebimentos.vale || 0));
    const diferenca = roundToTwoDecimals(totalConferido - esperado);

    try {
      const [todasContas, lancamentos, movimentos] = await Promise.all([
        base44.entities.ContasFinanceiras.list(),
        base44.entities.LancamentoFinanceiro.list(),
        base44.entities.MovimentosCaixa.list(),
      ]);
      const contaDestino = resolveContaDestinoCaixaPDV(todasContas);
      const { saldoGaveta } = await resolverSaldoGavetaCaixaPDV(
        base44,
        contaCaixaPDV,
        lancamentos,
        movimentos,
      );
      const saldoRestante = roundToTwoDecimals(saldoGaveta);

      if (saldoRestante > 0 && !contaDestino) {
        toast({
          title: 'Conta destino não configurada',
          description: 'Em Configurações → Financeiro → Contas, defina para onde vai o dinheiro do caixa PDV antes de fechar.',
          variant: 'destructive',
        });
        return;
      }

      if (contaDestino && saldoRestante > 0) {
        const observacao = `Fechamento de turno ${turnoAtivo.numero} - Transferido para ${contaDestino.nome}`;
        const movimentoFechamento = await base44.entities.MovimentosCaixa.create({
          numero: `MCX-${String(Date.now()).slice(-5)}`,
          tipo: 'Sangria',
          valor: saldoRestante,
          observacao,
          conta_id: contaCaixaPDV.id,
          turno_caixa_id: turnoAtivo.id,
          usuario_responsavel_id: currentUser.id,
          usuario_responsavel_nome: currentUser.full_name,
        });
        await transferirDinheiroFechamentoCaixaPDV({
          base44,
          contaCaixaPDV,
          contaDestino,
          descricao: observacao,
          movimentoId: movimentoFechamento.id,
          lancamentos,
          movimentos,
        });
      } else if (contaCaixaPDV?.id) {
        await transferirDinheiroFechamentoCaixaPDV({
          base44,
          contaCaixaPDV,
          contaDestino,
          descricao: `Fechamento de turno ${turnoAtivo.numero}`,
          lancamentos,
          movimentos,
        });
      }

      await base44.entities.TurnoCaixa.update(turnoAtivo.id, {
        data_fechamento: new Date().toISOString(),
        usuario_fechamento_id: currentUser.id,
        usuario_fechamento_nome: currentUser.full_name,
        saldo_final: caixaData.saldoAtual,
        total_vendas: caixaData.totalVendas,
        total_reforcos: caixaData.reforcos,
        total_sangrias: caixaData.sangrias,
        recebimentos_dinheiro: caixaData.recebimentos.dinheiro,
        recebimentos_pix: caixaData.recebimentos.pix,
        recebimentos_credito: caixaData.recebimentos.credito || 0,
        recebimentos_debito: caixaData.recebimentos.debito || 0,
        dinheiro_conferido: dinheiroConferido,
        diferenca,
        status: 'Fechado',
      });

      // Buscar turno atualizado para o relatório
      const turnoAtualizado = await base44.entities.TurnoCaixa.filter({ id: turnoAtivo.id });
      setTurnoFechado(turnoAtualizado[0]);
      setShowRelatorio(true);
    } catch (error) {
      toast({ title: 'Erro ao fechar caixa', description: error.message, variant: 'destructive' });
    } finally {
      setIsClosing(false);
    }
  };

  const handleContinuar = async () => {
    if (isContinuing) return;
    setIsContinuing(true);
    toast({
      title: '✓ Caixa fechado!',
      description: 'Turno encerrado com sucesso.',
      className: 'bg-emerald-100 text-emerald-800',
    });
    setShowRelatorio(false);
    onFechado?.();
    setTimeout(() => {
      setIsContinuing(false);
    }, 300);
  };

  return (
    <>
      <SafeActionButton
        onClick={() => setShowConfirmacao(true)}
        isLoading={isClosing}
        loadingText="Fechando..."
        className="flex-1 h-12 bg-card text-card-foreground rounded-2xl font-semibold flex items-center justify-center gap-2 text-sm"
        style={{ minHeight: '48px' }}
      >
        <Lock className="w-4 h-4" /> Fechar Caixa
      </SafeActionButton>

      <AlertDialog open={showConfirmacao} onOpenChange={setShowConfirmacao}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-[28px] border-0 bg-card p-5 shadow-2xl sm:w-full sm:max-w-lg sm:p-6 dark:bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar fechamento do caixa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esse botão é sensível. O caixa só será fechado depois desta confirmação de segurança.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl border-0">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleFechar} className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-card dark:text-foreground">Fechar agora</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RelatorioFechamentoCaixa
        turno={turnoFechado}
        caixaData={{ ...caixaData, dinheiroConferido: parseFloat(recebimentosDinheiro.replace(/\./g, '').replace(',', '.')) || 0 }}
        open={showRelatorio}
        onClose={() => setShowRelatorio(false)}
        onContinuar={handleContinuar}
        isContinuing={isContinuing}
      />
    </>
  );
}