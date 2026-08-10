import React from 'react';
import { CalendarDays, ArrowDownUp } from 'lucide-react';

const viewOptions = [
  { value: 'chegada_manaus', label: 'Chegada em Manaus' },
  { value: 'saida_manaus', label: 'Saída de Manaus' },
  { value: 'chegada_tabatinga', label: 'Chegada em Tabatinga' },
];

export default function TimelineViewControls({ viewMode, onViewModeChange }) {
  return (
    <div className="bg-card rounded-3xl p-4 md:p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center shadow-sm">
          <ArrowDownUp className="w-5 h-5 text-foreground/90" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Visualização</p>
          <p className="text-sm text-foreground dark:text-foreground font-medium">Escolha o marco principal e até quando quer ver</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="w-4 h-4" /> Marco principal
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {viewOptions.map((option) => {
            const active = option.value === viewMode;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onViewModeChange(option.value)}
                className={`px-3 py-3 rounded-2xl shadow-sm text-sm transition-all min-h-[72px] flex items-center justify-center text-center leading-tight ${active ? 'bg-primary text-primary-foreground dark:bg-card dark:text-foreground' : 'bg-muted/40 text-muted-foreground dark:bg-muted dark:text-foreground/90'}`}
              >
                <span className="break-words">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>


    </div>
  );
}