import React, { useEffect, useRef } from 'react';
import { printOrShareElementAsPdf, shouldUseMobileDocumentExport } from '@/lib/mobilePrintAndShare';
import { Dialog } from '@/components/ui/dialog';
import { CaixaDialogContent } from './CaixaDialogContent';
import { Button } from '@/components/ui/button';
import SafeActionButton from '@/components/ui/safe-action-button';
import { Printer, X, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { caixaClasses, conferenciaTone } from '@/lib/caixaP38Theme';

const fmt = (v) =>
  `R$ ${roundToTwoDecimals(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function RelatorioFechamentoCaixa({ turno, caixaData, open, onClose, onContinuar, isContinuing = false }) {
  const jaImprimiu = useRef(false);

  useEffect(() => {
    if (open && !jaImprimiu.current) {
      jaImprimiu.current = true;
      setTimeout(() => window.print(), 500);
    } else if (!open) {
      jaImprimiu.current = false;
    }
  }, [open]);

  if (!turno || !caixaData) return null;

  const dinheiroConferido = roundToTwoDecimals(caixaData.dinheiroConferido || 0);
  const totalConferido = roundToTwoDecimals(
    dinheiroConferido +
      caixaData.recebimentos.pix +
      (caixaData.recebimentos.credito || 0) +
      (caixaData.recebimentos.debito || 0)
  );
  const esperado = roundToTwoDecimals(caixaData.liquidez - (caixaData.recebimentos.vale || 0));
  const diferenca = roundToTwoDecimals(totalConferido - esperado);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <CaixaDialogContent className="max-w-md p-0 gap-0 bg-card">
        <div className="no-print flex items-center justify-between p-4 border-b border-border/40">
          <h2 className="text-lg font-semibold text-foreground font-glacial">
            Relatório de Fechamento
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Conteúdo imprimível */}
        <div id="relatorio-fechamento-caixa-print" className="p-6 space-y-6" style={{ fontFamily: "'Ubuntu Sans Mono', 'Cousine', monospace" }}>
          {/* Cabeçalho */}
          <div className="text-center border-b-2 border-border/40 dark:border-border/40 pb-4">
            <div className="text-2xl font-bold text-foreground mb-1">FECHAMENTO DE CAIXA</div>
            <div className="text-sm text-muted-foreground">Turno {turno.numero}</div>
          </div>

          {/* Dados do turno */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Abertura:</span>
              <span className="font-mono text-foreground">
                {format(new Date(turno.data_abertura), 'dd/MM/yyyy HH:mm')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fechamento:</span>
              <span className="font-mono text-foreground">
                {format(new Date(turno.data_fechamento || new Date()), 'dd/MM/yyyy HH:mm')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Operador:</span>
              <span className="font-medium text-foreground">{turno.usuario_abertura_nome}</span>
            </div>
          </div>

          {/* Saldos */}
          <div className="border-t-2 border-border/40 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Saldo Inicial:</span>
              <span className="font-mono font-medium text-foreground">{fmt(turno.saldo_inicial)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">+ Vendas:</span>
              <span className="font-mono font-medium text-foreground">{fmt(caixaData.totalVendas)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">+ Reforços:</span>
              <span className="font-mono font-medium text-foreground">{fmt(caixaData.reforcos)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">- Sangrias:</span>
              <span className="font-mono font-medium text-foreground">{fmt(caixaData.sangrias)}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t border-border/40 dark:border-border/40 pt-2">
              <span className="text-foreground">Saldo do Turno:</span>
              <span className="font-mono text-foreground">{fmt(caixaData.saldoAtual)}</span>
            </div>
          </div>

          {/* Recebimentos */}
          <div className="border-t-2 border-border/40 pt-4 space-y-2">
            <div className="text-sm font-semibold text-foreground/90 mb-2">RECEBIMENTOS</div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Dinheiro:</span>
              <span className="font-mono font-medium text-foreground">{fmt(caixaData.recebimentos.dinheiro)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">PIX:</span>
              <span className="font-mono font-medium text-foreground">{fmt(caixaData.recebimentos.pix)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cartão Débito:</span>
              <span className="font-mono font-medium text-foreground">{fmt(caixaData.recebimentos.debito || 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cartão Crédito:</span>
              <span className="font-mono font-medium text-foreground">{fmt(caixaData.recebimentos.credito || 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Vale Compra:</span>
              <span className="font-mono font-medium text-foreground">{fmt(caixaData.recebimentos.vale || 0)}</span>
            </div>
          </div>

          {/* Conferência */}
          <div className="border-t-2 border-border/40 dark:border-border/40 pt-4 space-y-2">
            <div className="text-sm font-semibold text-foreground/90 mb-2">CONFERÊNCIA</div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Dinheiro na Gaveta:</span>
              <span className="font-mono font-medium text-foreground">{fmt(caixaData.liquidez)}</span>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span className="text-foreground">Total Conferido:</span>
              <span className="font-mono text-foreground">{fmt(totalConferido)}</span>
            </div>
            <div className={`flex justify-between text-base font-bold pt-2 border-t border-border/40 dark:border-border/40 ${
              caixaClasses(conferenciaTone({ temDiferenca: Math.abs(diferenca) >= 0.01, diferenca })).panelText
            }`}>
              <span>Diferença:</span>
              <span className="font-mono">{diferenca >= 0 ? '+' : ''}{fmt(diferenca)}</span>
            </div>
          </div>

          {/* Status */}
          <div className="text-center pt-4 border-t border-border/40">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${caixaClasses('success').panel}`}>
              <CheckCircle className={`w-5 h-5 ${caixaClasses('success').icon}`} />
              <span className={`text-sm font-medium ${caixaClasses('success').panelText}`}>Caixa Fechado</span>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="no-print flex gap-2 p-4 border-t border-border/40">
          <Button
            variant="outline"
            onClick={() => {
              void printOrShareElementAsPdf('relatorio-fechamento-caixa-print', {
                formato: '80mm',
                fileBaseName: `fechamento-${turno?.numero || 'caixa'}`,
                title: 'Relatório de fechamento',
              });
            }}
            className="flex-1 gap-2"
          >
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
          <SafeActionButton
            onClick={onContinuar}
            isLoading={isContinuing}
            loadingText="Finalizando..."
            className="flex-1 bg-card text-card-foreground hover:bg-primary"
          >
            Continuar
          </SafeActionButton>
        </div>
      </CaixaDialogContent>
    </Dialog>
  );
}