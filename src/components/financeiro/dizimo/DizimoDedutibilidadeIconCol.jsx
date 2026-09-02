import { Check, CircleSlash, Scissors } from 'lucide-react';
import { DIZIMO_MODOS, normalizarConfigItemDizimo } from '@/lib/dizimoCalculos';
import { cn } from '@/lib/utils';

/** Tabela aberta — divisória ícone|texto um pouco mais grossa que as demais. */
export const DIZIMO_LINHA_ICON_DIVISOR = 'border-r-[1.5px] border-border/50 dark:border-white/15';
export const DIZIMO_LINHA_FINA = 'border-border/25 dark:border-white/[0.07]';
export const DIZIMO_LINHA_VALOR_DIVISOR = 'border-r border-border/20 dark:border-white/[0.06]';

export function percentualDedutivelExibicao(config = {}) {
  const { modo, percentual } = normalizarConfigItemDizimo(config);
  if (modo === DIZIMO_MODOS.TOTAL) return 100;
  if (modo === DIZIMO_MODOS.NAO_DEDUTIVEL) return 0;
  return percentual;
}

export function classesTomDedutibilidade(config = {}) {
  const modo = normalizarConfigItemDizimo(config).modo;
  if (modo === DIZIMO_MODOS.NAO_DEDUTIVEL) {
    return 'text-muted-foreground/40 dark:text-muted-foreground/35';
  }
  if (modo === DIZIMO_MODOS.PARCIAL) {
    return 'text-sky-600 dark:text-sky-400';
  }
  return 'text-emerald-600 dark:text-emerald-400';
}

/**
 * Coluna fixa — ícone + percentual (sempre visível), estilo relatório enxuto.
 */
export default function DizimoDedutibilidadeIconCol({ config, className }) {
  const normalizado = normalizarConfigItemDizimo(config);
  const { modo } = normalizado;
  const pct = percentualDedutivelExibicao(config);
  const tone = classesTomDedutibilidade(config);

  return (
    <div
      className={cn(
        'flex w-[3rem] shrink-0 flex-col items-center justify-center self-stretch',
        DIZIMO_LINHA_ICON_DIVISOR,
        'py-2.5 pr-1.5 pl-1.5',
        className,
      )}
      aria-hidden
    >
      {modo === DIZIMO_MODOS.TOTAL ? (
        <Check className={cn('h-4 w-4', tone)} strokeWidth={2.75} />
      ) : null}

      {modo === DIZIMO_MODOS.PARCIAL ? (
        <Scissors className={cn('h-4 w-4', tone)} strokeWidth={2} />
      ) : null}

      {modo === DIZIMO_MODOS.NAO_DEDUTIVEL ? (
        <CircleSlash className={cn('h-4 w-4', tone)} strokeWidth={2} />
      ) : null}

      <span className={cn('mt-1 text-[10px] font-light tabular-nums leading-none', tone)}>
        {pct}%
      </span>
    </div>
  );
}
