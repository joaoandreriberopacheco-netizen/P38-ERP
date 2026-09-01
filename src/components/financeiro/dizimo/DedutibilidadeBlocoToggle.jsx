import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { DIZIMO_MODOS, labelModoDedutivel } from '@/lib/dizimoCalculos';

const OPCOES = [
  DIZIMO_MODOS.TOTAL,
  DIZIMO_MODOS.PARCIAL,
  DIZIMO_MODOS.NAO_DEDUTIVEL,
];

function clampPercentual(value) {
  const n = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function ParcialInlineInput({ percentual, onChange }) {
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 min-w-[3.25rem] justify-center px-1.5 py-1 rounded-lg',
        'bg-muted/40 text-foreground border border-black/[0.1] dark:border-white/15',
      )}
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={percentual}
        onChange={(e) => onChange(clampPercentual(e.target.value))}
        onFocus={(e) => e.target.select()}
        className="w-8 h-4 text-[11px] font-semibold text-center tabular-nums bg-transparent outline-none"
        aria-label="Percentual dedutível"
      />
      <span className="text-[10px] font-medium text-foreground/70">%</span>
    </div>
  );
}

export default function DedutibilidadeBlocoToggle({ value, onChange, className }) {
  const modo = value?.modo || DIZIMO_MODOS.TOTAL;
  const percentual = value?.percentual ?? 100;

  const setModo = (nextModo) => {
    onChange?.({
      modo: nextModo,
      percentual: nextModo === DIZIMO_MODOS.PARCIAL ? 100 : 100,
    });
  };

  const setPercentual = (next) => {
    onChange?.({ modo: DIZIMO_MODOS.PARCIAL, percentual: clampPercentual(next) });
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-xl p-1 gap-0.5 shrink-0',
        'bg-background border border-black/[0.08] dark:border-white/12',
        className,
      )}
    >
      {OPCOES.map((opcao) => {
        if (opcao === DIZIMO_MODOS.PARCIAL && modo === DIZIMO_MODOS.PARCIAL) {
          return (
            <ParcialInlineInput
              key={opcao}
              percentual={percentual}
              onChange={setPercentual}
            />
          );
        }

        const ativo = modo === opcao;
        return (
          <button
            key={opcao}
            type="button"
            onClick={() => setModo(opcao)}
            className={cn(
              'px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap border',
              ativo
                ? 'bg-muted/40 text-foreground border-black/[0.1] dark:border-white/15'
                : 'text-foreground/55 border-transparent hover:bg-muted/25 hover:text-foreground',
            )}
          >
            {labelModoDedutivel(opcao)}
          </button>
        );
      })}
    </div>
  );
}
