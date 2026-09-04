import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  DIZIMO_MODOS,
  formatPercentualDedutivel,
  labelModoDedutivel,
  normalizarPercentualDedutivel,
} from '@/lib/dizimoCalculos';

const OPCOES = [
  DIZIMO_MODOS.TOTAL,
  DIZIMO_MODOS.PARCIAL,
  DIZIMO_MODOS.NAO_DEDUTIVEL,
];

const PARTIAL_PERCENTUAL_PATTERN = /^\d{0,3}([,.]\d{0,2})?$/;

function isValidPartialPercentualInput(raw) {
  const s = String(raw ?? '').trim();
  if (s === '') return true;
  return PARTIAL_PERCENTUAL_PATTERN.test(s);
}

function parsePercentualInput(raw) {
  const s = String(raw ?? '').trim().replace(',', '.');
  if (s === '' || s === '.') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return normalizarPercentualDedutivel(n);
}

function ParcialInlineInput({ percentual, onChange }) {
  const inputRef = useRef(null);
  const [draft, setDraft] = useState(() => formatPercentualDedutivel(percentual));

  useEffect(() => {
    setDraft(formatPercentualDedutivel(percentual));
  }, [percentual]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commitDraft = () => {
    const parsed = parsePercentualInput(draft);
    if (parsed == null) {
      const fallback = normalizarPercentualDedutivel(percentual);
      setDraft(formatPercentualDedutivel(fallback));
      onChange(fallback);
      return;
    }
    setDraft(formatPercentualDedutivel(parsed));
    onChange(parsed);
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 min-w-[3.75rem] justify-center px-1.5 py-1 rounded-lg',
        'bg-muted/40 text-foreground border border-black/[0.1] dark:border-white/15',
      )}
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => {
          const next = e.target.value;
          if (!isValidPartialPercentualInput(next)) return;
          setDraft(next);
        }}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitDraft();
            inputRef.current?.blur();
          }
        }}
        onFocus={(e) => e.target.select()}
        className="w-10 h-4 text-[11px] font-semibold text-center tabular-nums bg-transparent outline-none"
        aria-label="Percentual dedutível"
      />
      <span className="text-[10px] font-medium text-foreground/70">%</span>
    </div>
  );
}

export default function DedutibilidadeBlocoToggle({ value, onChange, className, fullWidth = false, compact = false }) {
  const modo = value?.modo || DIZIMO_MODOS.TOTAL;
  const percentual = value?.percentual ?? 100;

  const setModo = (nextModo) => {
    onChange?.({
      modo: nextModo,
      percentual: nextModo === DIZIMO_MODOS.PARCIAL ? 100 : 100,
    });
  };

  const setPercentual = (next) => {
    onChange?.({ modo: DIZIMO_MODOS.PARCIAL, percentual: normalizarPercentualDedutivel(next) });
  };

  return (
    <div
      className={cn(
        'items-center rounded-xl gap-0.5',
        compact ? 'p-0.5' : 'p-1',
        fullWidth ? 'flex w-full' : 'inline-flex shrink-0',
        'bg-muted/30 border border-border/40 dark:border-white/10',
        className,
      )}
    >
      {OPCOES.map((opcao) => {
        if (opcao === DIZIMO_MODOS.PARCIAL && modo === DIZIMO_MODOS.PARCIAL) {
          return (
            <div key={opcao} className={cn(fullWidth && 'flex-1 min-w-0 flex justify-center')}>
              <ParcialInlineInput
                percentual={percentual}
                onChange={setPercentual}
              />
            </div>
          );
        }

        const ativo = modo === opcao;
        return (
          <button
            key={opcao}
            type="button"
            onClick={() => setModo(opcao)}
            className={cn(
              'rounded-lg font-semibold transition-colors border',
              compact ? 'py-1 text-[10px]' : 'py-1.5 text-[11px]',
              fullWidth ? 'flex-1 min-w-0 px-1 text-center' : 'px-2.5 whitespace-nowrap',
              ativo
                ? 'bg-background text-foreground border-border/50 shadow-sm dark:bg-[#26262e]/80 dark:border-white/12'
                : 'text-muted-foreground border-transparent hover:bg-background/60 hover:text-foreground',
            )}
          >
            {labelModoDedutivel(opcao)}
          </button>
        );
      })}
    </div>
  );
}
