import React from 'react';
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { P38_CHIP_ACTIVE, P38_CHIP_INACTIVE } from '@/components/financeiro/fluxo/financeiroP38';
import { TIPOS_LANCAMENTO_FILTRO } from '@/lib/filtroTipoFinanceiro';

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

/**
 * Seletor visível (fora do painel Filtros) para Receita / Despesa / Transferência.
 * Multi-seleção: vazio = todos; um ou mais = filtra pelos tipos marcados.
 */
export default function TipoFiltroBar({ sel = [], onSel, className }) {
  const todasSel = sel.length === 0 || sel.length === TIPOS_LANCAMENTO_FILTRO.length;

  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg border border-border/40 bg-card/50 px-2 py-2 dark:border-white/10 dark:bg-[#26262e]/60',
        className,
      )}
      role="group"
      aria-label="Filtrar por tipo de movimentação"
    >
      <span className="shrink-0 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Tipo
      </span>
      <button
        type="button"
        onClick={() => onSel?.([])}
        className={cn(
          'flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-colors',
          todasSel ? P38_CHIP_ACTIVE : P38_CHIP_INACTIVE,
        )}
      >
        Todos
      </button>
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
  );
}
