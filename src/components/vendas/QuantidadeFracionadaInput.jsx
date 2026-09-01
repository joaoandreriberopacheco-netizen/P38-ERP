import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import {
  clampQuantidade,
  formatQuantidadeDisplay,
  parseQuantidadeInput,
  resolveQuantidadeStep,
  roundQuantidade,
} from '@/lib/parseQuantidadeInput';
import { cn } from '@/lib/utils';

export default function QuantidadeFracionadaInput({
  value = 0,
  max = Infinity,
  onChange,
  className,
  inputClassName,
  buttonClassName,
  activeClassName = 'text-red-600 dark:text-red-400',
  inactiveClassName = 'text-muted-foreground',
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const step = resolveQuantidadeStep(Number.isFinite(max) ? max : value);

  const commitDraft = (raw) => {
    const next = clampQuantidade(parseQuantidadeInput(raw), 0, max);
    onChange?.(next);
    return next;
  };

  const adjust = (delta) => {
    const next = clampQuantidade(roundQuantidade((value || 0) + delta), 0, max);
    onChange?.(next);
    if (focused) setDraft(formatQuantidadeDisplay(next));
  };

  return (
    <div className={cn('flex items-center gap-2 shrink-0', className)}>
      <button
        type="button"
        onClick={() => adjust(-step)}
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl bg-secondary active:scale-95',
          buttonClassName
        )}
      >
        <Minus className="h-4 w-4 text-muted-foreground" />
      </button>
      <input
        autoComplete="off"
        type="text"
        inputMode="decimal"
        value={focused ? draft : formatQuantidadeDisplay(value)}
        onFocus={(e) => {
          setFocused(true);
          setDraft(formatQuantidadeDisplay(value));
          e.target.select();
        }}
        onBlur={() => {
          commitDraft(draft);
          setFocused(false);
        }}
        onChange={(e) => setDraft(e.target.value)}
        className={cn(
          'w-16 rounded-lg border-0 bg-transparent text-center text-base font-bold tabular-nums focus:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:bg-blue-900/20',
          (value || 0) > 0 ? activeClassName : inactiveClassName,
          inputClassName
        )}
      />
      <button
        type="button"
        onClick={() => adjust(step)}
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl bg-secondary active:scale-95',
          buttonClassName
        )}
      >
        <Plus className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}
