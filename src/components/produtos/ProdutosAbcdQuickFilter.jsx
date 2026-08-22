import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/components/utils';
import { ABCD_FILTER_VALUES } from '@/lib/filterProdutos';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  PRODUTOS_CHIP_ACTIVE,
  PRODUTOS_CHIP_IDLE,
  PRODUTOS_CHIP_SHELL,
  PRODUTOS_DROPDOWN_MENU,
  PRODUTOS_FILTER_OPEN,
  PRODUTOS_ICON_BTN,
} from '@/lib/produtosP38Theme';

const CHIP_BASE =
  'h-8 min-w-[2rem] px-2 rounded-lg text-xs font-semibold transition-colors border border-transparent';

function mobileAbcdSummary(abcd) {
  const current = abcd || 'all';
  if (current === 'all') return { short: 'ABC', detail: 'Todas' };
  return { short: current, detail: `Classe ${current}` };
}

function AbcdChipRow({ current, onChange, className = '' }) {
  return (
    <div className={cn(PRODUTOS_CHIP_SHELL, className)} role="group">
      <button
        type="button"
        onClick={() => onChange('all')}
        className={cn(CHIP_BASE, 'px-2.5 font-medium flex-1', current === 'all' ? PRODUTOS_CHIP_ACTIVE : PRODUTOS_CHIP_IDLE)}
        title="Todas as classes ABCD"
        aria-pressed={current === 'all'}
      >
        Tod
      </button>
      {ABCD_FILTER_VALUES.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={cn(CHIP_BASE, 'flex-1', current === value ? PRODUTOS_CHIP_ACTIVE : PRODUTOS_CHIP_IDLE)}
          title={`Classe ${value}`}
          aria-pressed={current === value}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

/** Atalho A/B/C/D — desktop: chips inline; mobile: botão + chips horizontais no popover. */
export default function ProdutosAbcdQuickFilter({ abcd = 'all', onChange }) {
  const current = abcd || 'all';
  const isActive = current !== 'all';
  const summary = mobileAbcdSummary(current);
  const [open, setOpen] = useState(false);

  const handleChange = (value) => {
    onChange(value);
    setOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'desktop-layout:hidden flex h-10 max-w-[7.5rem] flex-shrink-0 items-center gap-1 rounded-xl px-2.5 text-left transition-colors',
              PRODUTOS_ICON_BTN,
              isActive && PRODUTOS_FILTER_OPEN,
              isActive ? 'text-[#a8942e] dark:text-[#a4ce33]' : 'text-muted-foreground',
            )}
            title={`Curva ABCD: ${summary.detail}`}
            aria-label={`Curva ABCD: ${summary.detail}`}
          >
            <span className="flex min-w-0 flex-col leading-none">
              <span className="text-[9px] font-medium uppercase tracking-wide opacity-70">Curva</span>
              <span className="truncate text-xs font-semibold">{summary.short}</span>
            </span>
            <ChevronDown className="ml-auto h-3.5 w-3.5 flex-shrink-0 opacity-70" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className={cn('w-[min(17.5rem,calc(100vw-1.5rem))] rounded-xl p-3', PRODUTOS_DROPDOWN_MENU)}
        >
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Curva ABCD
          </p>
          <AbcdChipRow current={current} onChange={handleChange} />
          <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
            {isActive
              ? `Mostrando produtos com classe ${current} (gravada no cadastro).`
              : 'Usa a curva ABCD atualizada pelo processo noturno no cadastro de cada produto.'}
          </p>
        </PopoverContent>
      </Popover>

      <AbcdChipRow
        current={current}
        onChange={onChange}
        className="hidden desktop-layout:flex flex-shrink-0"
      />
    </>
  );
}
