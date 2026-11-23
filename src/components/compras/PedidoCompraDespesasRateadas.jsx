import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { COMPRAS_FIELD_H12 } from '@/lib/comprasP38Theme';
import {
  newDespesaRateadaRow,
  normalizeDespesasRateadasForEdit,
  somaDespesasRateadas,
  despesaRateadaProntaParaPersistir,
} from '@/lib/pedidoCompraDespesasRateadas';

const parseValorInput = (raw) => {
  const s = String(raw ?? '').trim().replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};

const valorToDisplay = (valor) =>
  valor > 0 ? String(valor).replace('.', ',') : '';

function DespesaDescricaoInput({ value, disabled, onChange }) {
  const ref = useRef(null);

  const syncHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    syncHeight();
  }, [value, syncHeight]);

  return (
    <Textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        syncHeight();
      }}
      disabled={disabled}
      placeholder="Ex.: Frete, taxa..."
      className={cn(
        COMPRAS_FIELD_H12,
        'min-h-10 max-h-40 w-full min-w-0 resize-none overflow-hidden py-2 leading-snug',
        '!min-h-10',
      )}
    />
  );
}

function DespesaValorInput({ rowId, valor, disabled, onCommit }) {
  const [text, setText] = useState(() => valorToDisplay(valor));

  useEffect(() => {
    setText(valorToDisplay(valor));
  }, [rowId]);

  const flush = useCallback(
    (nextText) => {
      onCommit(parseValorInput(nextText));
    },
    [onCommit],
  );

  return (
    <Input
      type="text"
      inputMode="decimal"
      className={cn(COMPRAS_FIELD_H12, 'h-10 w-full tabular-nums text-right')}
      placeholder="0,00"
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        flush(next);
      }}
      onBlur={() => flush(text)}
      disabled={disabled}
    />
  );
}

export default function PedidoCompraDespesasRateadas({
  despesas = [],
  onChange,
  formatCurrency,
  valorItensFinanceiro = 0,
  valorTotalPedido = 0,
  isLocked = false,
  className,
}) {
  const { toast } = useToast();
  const rows = useMemo(() => normalizeDespesasRateadasForEdit(despesas), [despesas]);
  const totalDespesas = somaDespesasRateadas(rows);
  const fmt = (n) => (typeof formatCurrency === 'function' ? formatCurrency(n) : String(n ?? 0));
  const lastRowRef = useRef(null);
  const prevCountRef = useRef(rows.length);

  useEffect(() => {
    if (rows.length > prevCountRef.current && lastRowRef.current) {
      lastRowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    prevCountRef.current = rows.length;
  }, [rows.length]);

  const emit = (nextRows) => {
    onChange?.(normalizeDespesasRateadasForEdit(nextRows));
  };

  const handleField = (id, patch) => {
    emit(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleConfirmRow = (row) => {
    if (!despesaRateadaProntaParaPersistir(row)) {
      toast({
        title: 'Preencha a despesa',
        description: 'Informe a descrição ou o valor antes de guardar a linha.',
        variant: 'destructive',
      });
      return;
    }
    emit(rows);
    toast({
      title: 'Despesa guardada',
      description: 'A linha ficará no pedido quando você salvar o pedido.',
      className: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100',
    });
  };

  return (
    <section
      className={cn(
        'relative z-10 bg-card px-4 py-4 desktop-layout:px-6',
        className,
      )}
      data-pulse-sensor="pedido-compra-despesas-rateadas"
    >
      <div
        className="sticky top-0 z-30 -mx-4 mb-3 border-b border-border/40 bg-card/95 px-4 py-2.5 backdrop-blur-sm desktop-layout:-mx-6 desktop-layout:px-6"
        data-pulse-sensor="pedido-compra-despesas-totais"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs tabular-nums">
          <span className="text-muted-foreground">
            Despesas:{' '}
            <span className="font-medium text-foreground">{fmt(totalDespesas)}</span>
          </span>
          <span className="text-muted-foreground">
            Base itens:{' '}
            <span className="font-medium text-foreground">{fmt(valorItensFinanceiro)}</span>
          </span>
          <span className="text-muted-foreground sm:ml-auto">
            Total pedido:{' '}
            <span className="font-semibold text-foreground">{fmt(valorTotalPedido)}</span>
          </span>
        </div>
      </div>

      <div className="relative z-10 space-y-2">
        {rows.map((row, index) => {
          const pronta = despesaRateadaProntaParaPersistir(row);
          return (
            <div
              key={row.id}
              ref={index === rows.length - 1 ? lastRowRef : null}
              className={cn(
                'relative z-10 flex w-full min-w-0 items-start gap-2 rounded-xl border px-3 py-2',
                pronta
                  ? 'border-emerald-500/35 bg-emerald-500/5'
                  : 'border-border/50 bg-muted/20',
              )}
            >
              <div className="min-w-0 flex-1 self-stretch">
                <Label className="sr-only">Descrição</Label>
                <DespesaDescricaoInput
                  value={row.descricao}
                  disabled={isLocked}
                  onChange={(descricao) => handleField(row.id, { descricao })}
                />
              </div>
              <div className="flex w-[5.75rem] shrink-0 flex-col gap-1 sm:w-28">
                <Label className="sr-only">Valor</Label>
                <DespesaValorInput
                  rowId={row.id}
                  valor={row.valor}
                  disabled={isLocked}
                  onCommit={(valor) => handleField(row.id, { valor })}
                />
              </div>
              <div className="flex shrink-0 items-start gap-0.5 pt-0.5">
                {!isLocked && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-9 w-9',
                      pronta
                        ? 'text-emerald-600 hover:text-emerald-800'
                        : 'text-muted-foreground',
                    )}
                    onClick={() => handleConfirmRow(row)}
                    aria-label="Guardar despesa na lista"
                    title="Guardar linha"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-red-500 hover:text-red-700"
                  onClick={() => emit(rows.filter((r) => r.id !== row.id))}
                  disabled={isLocked}
                  aria-label="Remover despesa"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {!isLocked && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 h-9 gap-1.5"
          onClick={() => emit([...rows, newDespesaRateadaRow()])}
        >
          <Plus className="w-4 h-4" />
          Adicionar despesa
        </Button>
      )}
    </section>
  );
}