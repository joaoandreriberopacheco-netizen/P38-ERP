import React from 'react';
import { FLUVIAL_VIEW_MODES } from '@/components/logistica-sandbox/fluvialDataUtils';

export default function FluvialViewModeToggle({ value, onChange, className = '' }) {
  return (
    <div className={`rounded-3xl bg-card border border-border/40 shadow-sm p-2 ${className}`}>
      <p className="px-2 pt-1 pb-2 text-xs text-muted-foreground uppercase tracking-wide">Ponto de vista</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {FLUVIAL_VIEW_MODES.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`px-3 py-3 rounded-2xl text-sm transition-all min-h-[64px] flex items-center justify-center text-center leading-tight ${
                active
                  ? 'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground shadow-sm'
                  : 'bg-muted/40 text-muted-foreground dark:bg-muted/60 dark:text-foreground/90'
              }`}
            >
              <span className="break-words">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
