import React, { useMemo, useRef, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { COMPRAS_FIELD_H12 } from '@/lib/comprasP38Theme';
import {
  newDespesaRateadaRow,
  normalizeDespesasRateadasForEdit,
  somaDespesasRateadas,
} from '@/lib/pedidoCompraDespesasRateadas';

const parseValorInput = (raw) => {
  const s = String(raw ?? '').trim().replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};

export default function PedidoCompraDespesasRateadas({
  despesas = [],
  onChange,
  formatCurrency,
  valorItensFinanceiro = 0,
  valorTotalPedido = 0,
  isLocked = false,
  className,
}) {
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
        {rows.map((row, index) => (
            <div
              key={row.id}
              ref={index === rows.length - 1 ? lastRowRef : null}
              className="relative z-10 grid grid-cols-12 gap-2 items-center rounded-xl border border-border/50 bg-muted/20 px-3 py-2"
            >
              <div className="col-span-12 sm:col-span-7">
                <Label className="sr-only">Descrição</Label>
                <Input
                  className={cn(COMPRAS_FIELD_H12, 'h-10')}
                  placeholder="Ex.: Frete, taxa, seguro..."
                  value={row.descricao}
                  onChange={(e) => handleField(row.id, { descricao: e.target.value })}
                  disabled={isLocked}
                />
              </div>
              <div className="col-span-10 sm:col-span-4">
                <Label className="sr-only">Valor</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  className={cn(COMPRAS_FIELD_H12, 'h-10 tabular-nums text-right')}
                  placeholder="0,00"
                  value={row.valor > 0 ? String(row.valor).replace('.', ',') : ''}
                  onChange={(e) => {
                    const valor = parseValorInput(e.target.value);
                    handleField(row.id, { valor });
                  }}
                  disabled={isLocked}
                />
              </div>
              <div className="col-span-2 sm:col-span-1 flex justify-end">
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
          ))}
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