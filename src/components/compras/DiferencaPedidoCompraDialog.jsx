import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { roundToTwoDecimals } from '@/lib/financialUtils';

const fmt = (n) =>
  `R$ ${roundToTwoDecimals(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Pergunta o que fazer com a diferença de valor ao salvar correção de itens
 * em pedido que já tem vínculo financeiro.
 *
 * resolucao:
 * - `ajuste_lancamento` — gera conta a pagar (diff > 0) ou a receber/crédito (diff < 0)
 * - `somente_itens` — atualiza só itens/totais do pedido, sem novo lançamento
 */
export default function DiferencaPedidoCompraDialog({
  open,
  onOpenChange,
  valorAnterior = 0,
  valorNovo = 0,
  diferencaValor = 0,
  temParcelasPagas = false,
  onEscolher,
  loading = false,
}) {
  const diff = roundToTwoDecimals(diferencaValor);
  const diffPositiva = diff > 0;
  const diffAbs = Math.abs(diff);

  const handle = (resolucao) => {
    onEscolher?.(resolucao);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            Diferença no total do pedido
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            O total dos itens mudou. O financeiro <span className="font-medium text-foreground">não é alterado automaticamente</span>{' '}
            — escolha o que fazer com a diferença:
          </p>
          <div className="rounded-xl bg-muted/50 px-3 py-2.5 space-y-1 text-xs tabular-nums">
            <div className="flex justify-between">
              <span>Total anterior</span>
              <span className="font-medium text-foreground">{fmt(valorAnterior)}</span>
            </div>
            <div className="flex justify-between">
              <span>Novo total</span>
              <span className="font-medium text-foreground">{fmt(valorNovo)}</span>
            </div>
            <div className="flex justify-between border-t border-border/40 pt-1.5 mt-1.5">
              <span>Diferença</span>
              <span className={`font-semibold ${diffPositiva ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {diffPositiva ? '+' : '−'}{fmt(diffAbs)}
              </span>
            </div>
          </div>
          {temParcelasPagas && (
            <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
              Este pedido já tem parcelas pagas. Ajustes no financeiro devem ser explícitos.
            </p>
          )}
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            className="w-full rounded-xl h-11"
            disabled={loading}
            onClick={() => handle('ajuste_lancamento')}
          >
            {diffPositiva
              ? 'Pagar a diferença (gerar conta a pagar)'
              : 'Crédito do fornecedor (gerar conta a receber)'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full rounded-xl h-11"
            disabled={loading}
            onClick={() => handle('somente_itens')}
          >
            Só corrigir itens — não registrar no financeiro agora
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full rounded-xl"
            disabled={loading}
            onClick={() => onOpenChange?.(false)}
          >
            Cancelar salvamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
