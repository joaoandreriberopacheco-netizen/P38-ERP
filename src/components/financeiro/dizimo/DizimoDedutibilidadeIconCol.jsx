import { CircleSlash, Scissors, ToggleRight } from 'lucide-react';
import { DIZIMO_MODOS, normalizarConfigItemDizimo } from '@/lib/dizimoCalculos';
import { cn } from '@/lib/utils';

/**
 * Coluna fixa à esquerda — ícone de dedutibilidade + % (parcial), como no relatório enxuto.
 */
export default function DizimoDedutibilidadeIconCol({ config, className }) {
  const normalizado = normalizarConfigItemDizimo(config);
  const { modo, percentual } = normalizado;

  return (
    <div
      className={cn(
        'flex w-[2.85rem] shrink-0 flex-col items-center justify-center self-stretch',
        'border-r border-border/40 dark:border-white/10',
        'py-2.5 pr-1.5 pl-1',
        className,
      )}
      aria-hidden
    >
      {modo === DIZIMO_MODOS.TOTAL ? (
        <ToggleRight
          className="h-[18px] w-[18px] text-emerald-600 dark:text-emerald-400"
          strokeWidth={2.25}
        />
      ) : null}

      {modo === DIZIMO_MODOS.PARCIAL ? (
        <>
          <Scissors
            className="h-4 w-4 text-sky-600 dark:text-sky-400"
            strokeWidth={2}
          />
          <span className="mt-1 text-[10px] font-semibold tabular-nums leading-none text-sky-600 dark:text-sky-400">
            {percentual}%
          </span>
        </>
      ) : null}

      {modo === DIZIMO_MODOS.NAO_DEDUTIVEL ? (
        <CircleSlash
          className="h-4 w-4 text-muted-foreground/30 dark:text-muted-foreground/25"
          strokeWidth={2}
        />
      ) : null}
    </div>
  );
}

export function dizimoRowBorderClass(config = {}) {
  const modo = normalizarConfigItemDizimo(config).modo;
  if (modo === DIZIMO_MODOS.NAO_DEDUTIVEL) {
    return 'border-l-muted-foreground/20 dark:border-l-white/10';
  }
  if (modo === DIZIMO_MODOS.PARCIAL) {
    return 'border-l-sky-500/70 dark:border-l-sky-400/60';
  }
  return 'border-l-emerald-600/80 dark:border-l-emerald-400/70';
}
