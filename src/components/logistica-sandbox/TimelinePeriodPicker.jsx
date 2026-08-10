import React, { useEffect, useMemo, useRef } from 'react';
import { addDays, eachDayOfInterval, format, isSameDay, subDays } from 'date-fns';
import { CalendarDays } from 'lucide-react';

export default function TimelinePeriodPicker({ range, onChange }) {
  const scrollRef = useRef(null);
  const centerRef = useRef(null);

  const label = useMemo(() => {
    if (!range?.from && !range?.to) return 'Selecionar período';
    if (range?.from && range?.to) return `${format(range.from, 'dd/MM/yyyy')} → ${format(range.to, 'dd/MM/yyyy')}`;
    if (range?.from) return `${format(range.from, 'dd/MM/yyyy')} → ...`;
    return 'Selecionar período';
  }, [range]);

  const centerDate = useMemo(() => range?.from || new Date(), [range]);

  const days = useMemo(() => {
    const from = subDays(centerDate, 30);
    const to = addDays(centerDate, 30);
    return eachDayOfInterval({ from, to });
  }, [centerDate]);

  useEffect(() => {
    if (centerRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const item = centerRef.current;
      const left = item.offsetLeft - (container.clientWidth / 2) + (item.clientWidth / 2);
      container.scrollTo({ left, behavior: 'smooth' });
    }
  }, [centerDate]);

  return (
    <div className="bg-card rounded-3xl p-4 md:p-5 shadow-sm space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center shadow-sm">
          <CalendarDays className="w-5 h-5 text-foreground/90" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Período</p>
          <p className="text-sm text-foreground dark:text-foreground font-medium">Escolha manualmente a janela de tempo</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-1">
        {days.map((day) => {
          const active = range?.from && isSameDay(range.from, day);
          const isCenter = isSameDay(centerDate, day);
          return (
            <button
              key={format(day, 'yyyy-MM-dd')}
              ref={isCenter ? centerRef : null}
              type="button"
              onClick={() => onChange({ from: day, to: addDays(day, 30) })}
              className={`flex-shrink-0 rounded-2xl shadow-sm min-w-[70px] min-h-[70px] ${active ? 'bg-primary text-primary-foreground dark:bg-card dark:text-foreground' : 'bg-muted/40 text-foreground/90 dark:bg-muted dark:text-foreground'}`}
            >
              <div className="text-[10px] uppercase tracking-wide opacity-70">{format(day, 'MMM')}</div>
              <div className="text-base font-semibold leading-none mt-1">{format(day, 'dd')}</div>
              <div className="text-[10px] mt-1 opacity-70">{isCenter ? 'Hoje' : format(day, 'EEE')}</div>
            </button>
          );
        })}
      </div>

      <div className="text-sm text-foreground dark:text-foreground">{label}</div>
    </div>
  );
}