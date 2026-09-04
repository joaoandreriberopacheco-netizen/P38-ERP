import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { RefreshCw, ChevronRight, FileEdit, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { lancamentoStackDialogClass, lancamentoStackOverlayClass } from './fluxo/LancamentoPickerDialog';

const OPCOES_PAGAMENTO = [
  { value: 'apenas_esta',  label: 'Apenas esta',          desc: 'Altera somente este lançamento' },
  { value: 'todas',        label: 'Todas',                 desc: 'Altera todas do grupo (exceto pagas)' },
  { value: 'futuras',      label: 'Esta e futuras',        desc: 'A partir desta data (exceto pagas)' },
  { value: 'passadas',     label: 'Esta e anteriores',     desc: 'Até esta data (exceto pagas)' },
];

const OPCOES_CADASTRO = [
  { value: 'apenas_esta', label: 'Só esta parcela', desc: 'Descrição, valor e vencimento só neste mês.' },
  {
    value: 'futuras',
    label: 'Esta e as futuras',
    desc: 'Parcelas em aberto desta mesma conta (mesmo vínculo), a partir desta competência. Não mistura outras linhas do mesmo grupo.',
  },
  { value: 'todas', label: 'Todas em aberto', desc: 'Todas as parcelas não pagas desta mesma conta (mesmo vínculo).' },
];

export default function RecorrenciaEscopoDialog({
  open,
  onClose,
  onConfirm,
  mode = 'pagamento',
  stackElevated = false,
}) {
  const [working, setWorking] = useState(false);

  if (!open) return null;
  const opcoes = mode === 'cadastro' ? OPCOES_CADASTRO : OPCOES_PAGAMENTO;
  const Icon = mode === 'cadastro' ? FileEdit : RefreshCw;
  const titulo = mode === 'cadastro' ? 'Recorrência — dados da conta' : 'Lançamento recorrente';
  const subtitulo =
    mode === 'cadastro'
      ? 'Aplicar descrição, valor e vencimento onde?'
      : 'Como deseja aplicar a alteração?';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        overlayClassName={stackElevated ? lancamentoStackOverlayClass : undefined}
        hideClose={stackElevated}
        className={cn(
          'sm:max-w-xs gap-0 overflow-hidden rounded-2xl p-0 dark:border-border/40 dark:bg-background',
          stackElevated && lancamentoStackDialogClass('sm:max-w-xs'),
        )}
      >
        <div className="px-5 pt-5 pb-3 flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">{titulo}</p>
        </div>
        <p className="text-xs text-muted-foreground px-5 pb-3">{subtitulo}</p>
        <div className="h-px bg-muted" />
        <div className="divide-y divide-border/30 dark:divide-border/40">
          {opcoes.map(op => (
            <button
              key={op.value}
              type="button"
              disabled={working}
              onClick={async () => {
                setWorking(true);
                try {
                  await Promise.resolve(onConfirm(op.value));
                } finally {
                  setWorking(false);
                  onClose();
                }
              }}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 dark:hover:bg-card/5 active:bg-muted dark:active:bg-card/10 transition-colors text-left disabled:opacity-50 disabled:pointer-events-none"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{op.label}</p>
                <p className="text-[0.65rem] text-muted-foreground mt-0.5">{op.desc}</p>
              </div>
              {working ? (
                <Loader2 className="w-4 h-4 text-muted-foreground animate-spin flex-none" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground dark:text-muted-foreground flex-none" />
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}