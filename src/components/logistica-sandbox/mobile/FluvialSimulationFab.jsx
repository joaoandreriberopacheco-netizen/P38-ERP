import React from 'react';
import { CalendarDays } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import TimelineDatePicker from '@/components/logistica-sandbox/TimelineDatePicker';

export default function FluvialSimulationFab({ value, onChange }) {
  return (
    <div className="fixed right-4 z-[55] md:hidden p38-bottom-fab1">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-14 h-14 rounded-full bg-primary text-primary-foreground dark:bg-muted dark:text-foreground shadow-xl flex items-center justify-center"
          >
            <CalendarDays className="w-5 h-5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" side="top" className="w-[320px] max-w-[calc(100vw-2rem)] p-0 rounded-[28px] border-0 shadow-2xl bg-transparent">
          <TimelineDatePicker value={value} onChange={onChange} compact />
        </PopoverContent>
      </Popover>
    </div>
  );
}