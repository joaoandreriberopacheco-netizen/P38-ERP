import React from 'react';
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, BarChart3 } from 'lucide-react';
import { Popover, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { P38_CHIP_ACTIVE, P38_CHIP_INACTIVE, P38_POPOVER } from '@/components/financeiro/fluxo/financeiroP38';
import { TIPOS_LANCAMENTO_FILTRO, labelTiposSelecionados } from '@/lib/filtroTipoFinanceiro';
import { FinanceiroPopoverToolbarIcon } from '@/components/financeiro/fluxo/FinanceiroToolbarIcon';

const TIPOS = [
  { value: 'Receita', label: 'Receitas', icon: ArrowDownLeft },
  { value: 'Despesa', label: 'Despesas', icon: ArrowUpRight },
  { value: 'Transferência', label: 'Transferências', icon: ArrowRightLeft },
];

function chipAtivo(tipo, sel) {
  return sel.length === 0 || sel.includes(tipo);
}

function toggleTipo(tipo, sel, onSel) {
  if (sel.includes(tipo)) {
    onSel(sel.filter((x) => x !== tipo));
  } else {
    onSel([...sel, tipo]);
  }
}

function TipoFiltroPainel({ sel = [], onSel }) {
  const todasSel = sel.length === 0 || sel.length === TIPOS_LANCAMENTO_FILTRO.length;

  return (
    <div className="space-y-2" role="group" aria-label="Filtrar por tipo de movimentação">
      <p className="px-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        Tipo de lançamento
      </p>
      <button
        type="button"
        onClick={() => onSel?.([])}
        className={cn(
          'flex w-full items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-colors',
          todasSel ? P38_CHIP_ACTIVE : P38_CHIP_INACTIVE,
        )}
      >
        Todos
      </button>
      <div className="flex flex-wrap gap-1.5">
        {TIPOS.map(({ value, label, icon: Icon }) => {
          const ativo = chipAtivo(value, sel);
          return (
            <button
              key={value}
              type="button"
              onClick={() => toggleTipo(value, sel, onSel)}
              aria-pressed={ativo && !todasSel ? true : todasSel ? undefined : false}
              className={cn(
                'flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap',
                todasSel ? P38_CHIP_INACTIVE : ativo ? P38_CHIP_ACTIVE : P38_CHIP_INACTIVE,
                !todasSel && !ativo && 'opacity-45',
              )}
            >
              <Icon className="h-3 w-3 shrink-0" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Filtro Receita / Despesa / Transferência (multi).
 * `variant="icon"` — botão Lucide ao lado da impressora; `variant="bar"` — faixa visível.
 */
export default function TipoFiltroBar({ sel = [], onSel, className, variant = 'icon' }) {
  const filtrado = sel.length > 0;
  const tooltipLabel = filtrado
    ? `Tipo: ${labelTiposSelecionados(sel)}`
    : 'Filtrar por tipo de lançamento';

  if (variant === 'bar') {
    return (
      <div
        className={cn(
          'flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg border border-border/40 bg-card/50 px-2 py-2 dark:border-white/10 dark:bg-[#26262e]/60',
          className,
        )}
      >
        <TipoFiltroPainel sel={sel} onSel={onSel} />
      </div>
    );
  }

  return (
    <Popover>
      <FinanceiroPopoverToolbarIcon
        label={tooltipLabel}
        active={filtrado}
        className={className}
      >
        <BarChart3 className="h-4 w-4 text-foreground/90" />
      </FinanceiroPopoverToolbarIcon>
      <PopoverContent className={cn('w-56 p-2.5', P38_POPOVER)} align="end">
        <TipoFiltroPainel sel={sel} onSel={onSel} />
      </PopoverContent>
    </Popover>
  );
}
