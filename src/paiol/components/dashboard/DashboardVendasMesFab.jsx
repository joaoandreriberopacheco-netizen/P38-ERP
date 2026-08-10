import React, { useMemo, useState } from 'react';
import { CalendarDays, Check, X } from 'lucide-react';
import { listSelectableMonthOptions } from '@/lib/dashboardVendasPeriod';

export default function DashboardVendasMesFab({ selectedMonthKey, onSelectMonthKey }) {
  const [open, setOpen] = useState(false);
  const months = useMemo(() => listSelectableMonthOptions(), []);
  const selected = months.find((m) => m.key === selectedMonthKey) || months[0];

  const handleSelect = (key) => {
    onSelectMonthKey(key);
    setOpen(false);
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[54] bg-black/25 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <div className="fixed right-4 z-[55] flex flex-col items-end gap-2 p38-bottom-fab1 lg:bottom-6 lg:right-6">
        {open && (
          <div
            className="mb-1 w-[min(100vw-2rem,18rem)] max-h-[min(60vh,22rem)] overflow-y-auto rounded-2xl border border-border/60 bg-card shadow-2xl p-1.5"
            role="listbox"
            aria-label="Selecionar mês do dashboard"
          >
            <p className="px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Período do dashboard
            </p>
            {months.map((month) => {
              const isSelected = month.key === selectedMonthKey;
              return (
                <button
                  key={month.key}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(month.key)}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition ${
                    isSelected
                      ? 'bg-primary/15 text-foreground'
                      : 'text-foreground/90 hover:bg-muted/70'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block font-medium capitalize">{month.monthLabel}</span>
                    {month.isCurrent ? (
                      <span className="text-[10px] text-lime-600 dark:text-lime-300">Mês atual</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Fechamento no último dia</span>
                    )}
                  </span>
                  {isSelected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={`flex h-14 min-w-[3.5rem] items-center justify-center gap-2 rounded-full px-4 shadow-xl transition-all duration-200 ${
            open
              ? 'bg-muted text-foreground dark:bg-muted'
              : 'bg-[#4a5240] text-white dark:bg-[#a4ce33] dark:text-[#1f1d22]'
          }`}
          title="Escolher mês do dashboard"
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          {open ? (
            <X className="h-6 w-6" />
          ) : (
            <>
              <CalendarDays className="h-5 w-5 shrink-0" />
              <span className="text-xs font-semibold tracking-wide">{selected?.shortLabel || 'MÊS'}</span>
            </>
          )}
        </button>
      </div>
    </>
  );
}
