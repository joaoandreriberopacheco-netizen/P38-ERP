import React from 'react';
import { Wallet } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { P38_CHIP_ACTIVE, P38_CHIP_INACTIVE, P38_POPOVER } from './financeiroP38';
import { labelContasSaldoSelecionadas } from '@/lib/preferenciasSaldoContas';
import { FinanceiroPopoverToolbarIcon } from './FinanceiroToolbarIcon';

/**
 * Escolhe quais contas entram no total do chip de saldo (carteira).
 * `sel` vazio = todas incluídas.
 * `variant="icon"` — ícone Wallet compacto; `variant="chip"` — pill com rótulo (aba Caixas).
 */
export default function ContasSaldoPicker({
  contas = [],
  sel = [],
  onSel,
  className = '',
  variant = 'chip',
}) {
  const opcoes = contas.filter(Boolean);
  const allIds = opcoes.map((c) => c.id);
  const todasIncluidas = !sel.length || sel.length >= allIds.length;
  const label = labelContasSaldoSelecionadas(sel, opcoes);
  const tooltipLabel = todasIncluidas
    ? 'Contas no saldo total'
    : `Saldo: ${label}`;

  const estaSelecionada = (id) => !sel.length || sel.includes(id);

  const toggle = (id) => {
    const base = sel.length ? [...sel] : [...allIds];
    const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    if (next.length >= allIds.length) {
      onSel?.([]);
      return;
    }
    onSel?.(next);
  };

  const marcarTodas = () => onSel?.([]);

  if (!opcoes.length) return null;

  const painel = (
    <>
      <div className="mb-2 px-2 pt-1">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Contas no saldo total</p>
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground/80">
          Só altera o valor da carteira; a lista de movimentos mantém os filtros habituais.
        </p>
      </div>
      <button
        type="button"
        onClick={marcarTodas}
        className={`mb-1.5 w-full rounded-2xl px-3 py-2 text-left text-xs transition-colors ${todasIncluidas
          ? `${P38_CHIP_ACTIVE} font-medium`
          : 'text-muted-foreground hover:bg-secondary/80 dark:hover:bg-[#383e47]'}`}
      >
        Todas no saldo
      </button>
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {opcoes.map((c) => (
          <label
            key={c.id}
            className={`flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 transition-all ${estaSelecionada(c.id)
              ? 'bg-secondary/80 shadow-sm dark:bg-[#383e47]'
              : 'hover:bg-secondary/60 dark:hover:bg-[#383e47]/60'}`}
          >
            <Checkbox
              checked={estaSelecionada(c.id)}
              onCheckedChange={() => toggle(c.id)}
              className="h-4 w-4"
            />
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm"
              style={{ background: c.cor || '#a4ce33' }}
            />
            <span className="truncate text-xs text-foreground/90">{c.nome}</span>
          </label>
        ))}
      </div>
    </>
  );

  if (variant === 'icon') {
    return (
      <Popover>
        <FinanceiroPopoverToolbarIcon
          label={tooltipLabel}
          active={!todasIncluidas}
          className={className}
        >
          <Wallet className="h-4 w-4 text-foreground/90" />
        </FinanceiroPopoverToolbarIcon>
        <PopoverContent className={cn('w-64 p-2.5', P38_POPOVER)} align="end">
          {painel}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
            !todasIncluidas ? P38_CHIP_ACTIVE : P38_CHIP_INACTIVE,
            className,
          )}
          aria-label="Escolher contas incluídas no saldo total"
          title={tooltipLabel}
        >
          <Wallet className="h-3.5 w-3.5 shrink-0" />
          <span className="max-w-[9rem] truncate sm:max-w-[12rem]">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className={cn('w-64 p-2.5', P38_POPOVER)} align="start">
        {painel}
      </PopoverContent>
    </Popover>
  );
}
