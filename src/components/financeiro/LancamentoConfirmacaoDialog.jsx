import React, { useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { LancamentoFormSheet } from './fluxo/LancamentoPickerDialog';
import { useCompactShell } from '@/hooks/use-breakpoint';

function ConfirmacaoBody({ processing, successTitle, successMessage, onCreateAnother, onFinish, createAnotherLabel, finishLabel }) {
  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <div className={`flex h-16 w-16 items-center justify-center rounded-full ${processing ? 'bg-muted' : 'bg-green-50 dark:bg-green-900/20'}`}>
        {processing ? (
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground dark:text-foreground/90" />
        ) : (
          <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
        )}
      </div>

      <div className="space-y-1">
        <h3 className="font-glacial text-lg font-semibold text-foreground">
          {processing ? 'Processando' : (successTitle || 'Lançamento confirmado')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {processing ? 'Aguarde enquanto salvamos o lançamento.' : (successMessage || 'Deseja adicionar outro lançamento?')}
        </p>
      </div>

      {!processing && (
        <div className="flex w-full flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={onCreateAnother}
            className="h-12 w-full rounded-2xl bg-background text-sm font-semibold text-white dark:bg-muted dark:text-foreground"
          >
            {createAnotherLabel || 'Sim (S)'}
          </button>
          <button
            type="button"
            onClick={onFinish}
            className="h-12 w-full rounded-2xl bg-muted text-sm font-medium text-foreground"
          >
            {finishLabel || 'Não (N)'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function LancamentoConfirmacaoDialog({
  open,
  mode,
  onCreateAnother,
  onFinish,
  successTitle,
  successMessage,
  stackElevated = false,
  createAnotherLabel,
  finishLabel,
}) {
  const processing = mode === 'processing';
  const isMobile = useCompactShell();

  useEffect(() => {
    if (!open || processing) return;
    const onKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (key === 's') { e.preventDefault(); onCreateAnother(); }
      if (key === 'n') { e.preventDefault(); onFinish(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, processing, onCreateAnother, onFinish]);

  const body = (
    <ConfirmacaoBody
      processing={processing}
      successTitle={successTitle}
      successMessage={successMessage}
      onCreateAnother={onCreateAnother}
      onFinish={onFinish}
      createAnotherLabel={createAnotherLabel}
      finishLabel={finishLabel}
    />
  );

  if (stackElevated && isMobile) {
    return (
      <LancamentoFormSheet open={open} onOpenChange={() => {}} elevated>
        {body}
      </LancamentoFormSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        overlayClassName={stackElevated ? 'z-[72] bg-black/70' : undefined}
        className={stackElevated
          ? 'z-[72] max-w-sm rounded-3xl border-0 bg-card p-6 shadow-xl [&>button]:hidden'
          : 'max-w-sm rounded-3xl border-0 bg-card p-6 shadow-xl [&>button]:hidden'}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {body}
      </DialogContent>
    </Dialog>
  );
}
