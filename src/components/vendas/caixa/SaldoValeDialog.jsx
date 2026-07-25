import React from 'react';
import { Dialog } from '@/components/ui/dialog';
import { CaixaDialogContent } from './CaixaDialogContent';
import { Printer, Ticket } from 'lucide-react';
import { openPrintWindowOrShareHtml } from '@/lib/mobilePrintAndShare';
import { caixaClasses } from '@/lib/caixaP38Theme';

export default function SaldoValeDialog({ saldoResidualVale, onClose, formatValor }) {
  const tone = caixaClasses('success');
  return (
    <Dialog open={!!saldoResidualVale} onOpenChange={onClose}>
      <CaixaDialogContent className="max-w-xs mx-auto dark:bg-background">
        <div className="flex flex-col items-center gap-4 py-2">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center ${tone.well}`}>
            <Ticket className={`w-7 h-7 ${tone.icon}`} />
          </div>
          <div className="w-full bg-card rounded-2xl overflow-hidden shadow-sm" style={{ fontFamily: 'Courier New, monospace' }}>
            <div className="px-5 py-4 text-center border-b-2 border-dashed border-border/40">
              <div className="text-sm font-bold text-foreground">VAREJOSYNC</div>
              <div className="text-xs text-muted-foreground">Saldo de Vale Troca</div>
            </div>
            <div className="px-5 py-5 space-y-3 text-center">
              <p className="text-xs text-muted-foreground">Código do Vale</p>
              <p className="text-2xl font-bold font-mono text-foreground">{saldoResidualVale?.codigo}</p>
              <div className="pt-3 border-t border-dashed border-border/40">
                <p className="text-xs text-muted-foreground mb-1">Saldo Disponível</p>
                <p className={`text-3xl font-bold font-glacial ${tone.text}`}>
                  {formatValor(saldoResidualVale?.saldo)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                Apresente este código na próxima compra.<br/>O código permanece válido até o saldo zerar.
              </p>
            </div>
            <div className="px-5 py-3 text-center border-t border-border/40">
              <p className="text-xs text-muted-foreground">Não é documento fiscal</p>
            </div>
          </div>
          <div className="flex gap-3 w-full">
            <button onClick={onClose}
              className="flex-1 h-12 bg-muted text-foreground/90 rounded-2xl font-medium text-sm">
              Fechar
            </button>
            <button
              onClick={async () => {
                const { codigo, saldo } = saldoResidualVale;
                const html = `<html><head><title>Saldo Vale Troca</title>
                  <style>body{font-family:monospace;font-size:13px;padding:20px;max-width:300px;margin:0 auto;text-align:center}
                  .dashed{border-top:2px dashed #aaa;margin:12px 0}.big{font-size:26px;font-weight:bold}.code{font-size:22px;font-weight:bold;letter-spacing:2px}
                  .small{font-size:11px;color:#6b7280}
                  </style></head><body>
                  <b>VAREJOSYNC</b><br/><span class="small">Comprovante de Saldo — Vale Troca</span>
                  <div class="dashed"></div>
                  <p class="small">Código do Vale</p>
                  <p class="code">${codigo}</p>
                  <div class="dashed"></div>
                  <p class="small">Saldo Disponível</p>
                  <p class="big">R$ ${(saldo).toFixed(2).replace('.', ',')}</p>
                  <div class="dashed"></div>
                  <p class="small">Apresente este código na próxima compra.<br/>O código permanece válido até o saldo zerar.</p>
                  <div class="dashed"></div>
                  <p class="small">Não é documento fiscal</p>
                  </body></html>`;
                try {
                  await openPrintWindowOrShareHtml(html, `vale-${codigo}.html`, 'Saldo vale troca', { windowFeatures: 'width=380,height=520' });
                } catch {
                  /* popup bloqueado */
                }
              }}
              className="flex-1 h-12 bg-card text-card-foreground rounded-2xl font-medium text-sm flex items-center justify-center gap-2">
              <Printer className="w-4 h-4" /> Imprimir
            </button>
          </div>
        </div>
      </CaixaDialogContent>
    </Dialog>
  );
}