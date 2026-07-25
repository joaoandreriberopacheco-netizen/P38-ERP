import React, { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Calendar, CheckCircle2, CircleAlert, Receipt, Paperclip, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import AnexosPanel from '@/components/anexos/AnexosPanel';
import AgefinImportador from '@/components/agefin/AgefinImportador';
import { dataHoje, formatarSoData } from '@/components/utils/dateUtils';

function formatDate(value) {
  if (!value) return '—';
  return formatarSoData(value);
}

function formatCurrency(value) {
  return `R$ ${(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

export default function AgefinDetalheDrawer({ open, onClose, recorrente, contaMes }) {
  const [showRefreshImport, setShowRefreshImport] = React.useState(false);

  if (!recorrente || !contaMes) return null;

  const isPaid = contaMes?.status === 'Pago';
  const todayKey = dataHoje();
  const isDueToday = contaMes?.data_vencimento === todayKey;
  const isOverdue = !isPaid && contaMes?.data_vencimento && contaMes.data_vencimento < todayKey;
  const hasBoleto = Boolean(contaMes?.boleto_url);
  const boletoVencido = hasBoleto && isOverdue;

  return (
    <>
      <Drawer open={open && !showRefreshImport} onOpenChange={onClose}>
        <DrawerContent className="border-0 rounded-t-[28px] bg-card px-4 pb-6">
        <DrawerHeader className="px-0 pb-2 text-left">
          <DrawerTitle className="font-glacial text-foreground">{recorrente.nome_despesa}</DrawerTitle>
          <DrawerDescription className="text-sm text-muted-foreground mt-1">
            {recorrente.terceiro_nome || 'Sem beneficiário'}
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-3">
          <div className="rounded-[22px] bg-muted/50/70 p-4 space-y-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Valor previsto</p>
                <p className="text-xl font-semibold text-foreground">{formatCurrency(recorrente.valor_previsto)}</p>
              </div>
              {isPaid ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Pago
                </span>
              ) : isOverdue ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-400/10 dark:text-red-200">
                  <CircleAlert className="w-3.5 h-3.5" /> Vencido
                </span>
              ) : isDueToday ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                  <Calendar className="w-3.5 h-3.5" /> Vence hoje
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-card p-3 shadow-sm">
                <p className="text-xs text-muted-foreground">Vencimento</p>
                <p className="mt-1 font-medium text-foreground">{formatDate(contaMes?.data_vencimento)}</p>
              </div>
              <div className="rounded-2xl bg-card p-3 shadow-sm">
                <p className="text-xs text-muted-foreground">Pago em</p>
                <p className="mt-1 font-medium text-foreground">{formatDate(contaMes?.data_pagamento)}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-card p-3 shadow-sm">
              <p className="text-xs text-muted-foreground">Descrição da conta</p>
              <p className="mt-1 text-sm text-foreground/90">{contaMes?.descricao || recorrente.nome_despesa}</p>
            </div>

            <div className="rounded-2xl bg-card p-3 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Boleto anexo</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {!hasBoleto ? 'Sem boleto anexado' : boletoVencido ? 'Boleto vencido (conferir vencimento)' : 'Boleto anexado'}
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => setShowRefreshImport(true)}
                  className="h-10 rounded-2xl bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 dark:bg-muted dark:text-foreground dark:hover:bg-card"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {hasBoleto ? 'Trocar anexo' : 'Vincular PDF'}
                </Button>
              </div>
              {boletoVencido && (
                <p className="text-xs text-red-600 dark:text-red-200">O vencimento pode estar desatualizado. Edite valor e data manualmente na conta.</p>
              )}
            </div>
          </div>

          <div className="rounded-[22px] bg-muted/50/70 p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Anexos da conta</p>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-foreground/90">
                <Receipt className="w-4 h-4 text-muted-foreground" />
                Ver boleto, comprovante e demais anexos
              </div>
              <AnexosPanel
                inline
                referenciaId={contaMes?.id}
                referenciaTipo="ContaPrevista"
                referenciaNomero={contaMes?.referencia_numero || contaMes?.descricao || recorrente.nome_despesa}
              />
            </div>
          </div>
        </div>
        </DrawerContent>
      </Drawer>

      <Dialog open={showRefreshImport} onOpenChange={setShowRefreshImport}>
        <DialogContent className="z-[120] flex min-h-0 max-h-[90vh] max-w-3xl flex-col overflow-hidden border-0 bg-transparent p-0 shadow-none">
          <div className="flex min-h-0 max-h-[85vh] flex-1 flex-col overflow-hidden rounded-[28px] bg-muted/40 dark:bg-background">
            <AgefinImportador
              modoAtualizacao
              contaPrevistaId={contaMes?.referencia_id || undefined}
              lancamentoFinanceiroId={contaMes?.id}
              onSuccess={() => {
                setShowRefreshImport(false);
                onClose?.();
                window.location.reload();
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}