import React, { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { COMPRAS_FIELD_H12, COMPRAS_SEP } from '@/lib/comprasP38Theme';
import {
  newDespesaRateadaRow,
  normalizeDespesasRateadas,
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
  isLocked = false,
  className,
}) {
  const rows = useMemo(() => normalizeDespesasRateadas(despesas), [despesas]);
  const totalDespesas = somaDespesasRateadas(rows);

  const emit = (nextRows) => {
    onChange?.(normalizeDespesasRateadas(nextRows));
  };

  const handleField = (id, patch) => {
    emit(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  return (
    <section
      className={cn('bg-card px-4 py-4 desktop-layout:px-6', COMPRAS_SEP, className)}
      data-pulse-sensor="pedido-compra-despesas-rateadas"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">Despesas rateadas</h3>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
            Frete ou outras cobranças do fornecedor sobre os produtos. O valor é dividido entre
            os itens na proporção do valor financeiro de cada linha.
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground tabular-nums">
          <span className="block">
            Base produtos:{' '}
            <span className="text-foreground font-medium">{formatCurrency(valorItensFinanceiro)}</span>
          </span>
          <span className="block">
            Total despesas:{' '}
            <span className="text-foreground font-medium">{formatCurrency(totalDespesas)}</span>
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">Nenhuma despesa adicional cadastrada.</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-12 gap-2 items-center rounded-xl border border-border/50 bg-muted/20 px-3 py-2"
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
          ))
        )}
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