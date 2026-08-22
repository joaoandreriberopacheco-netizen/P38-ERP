import React from 'react';
import { Waves, BadgeDollarSign, Ship } from 'lucide-react';

const options = [
  { value: 'Fluvial', icon: Waves },
  { value: 'Fretes', icon: BadgeDollarSign },
  { value: 'Boats', icon: Ship },
];

export default function RouteModeToggle({ value, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory">
      {options.map((option) => {
        const Icon = option.icon;
        const active = value === option.value;
        return (
          <button
            key={option.value}
            {...(option.value === 'Fluvial' ? { 'data-pulse-sensor': 'itinerario-fluvial.modo-fluvial' } : {})}
            onClick={() => onChange(option.value)}
            className={`snap-start flex items-center justify-center gap-2 min-w-[132px] px-4 py-3 rounded-2xl shadow-sm text-sm whitespace-nowrap transition-all ${active ? 'bg-muted text-foreground dark:bg-muted dark:text-foreground' : 'bg-muted/70 text-muted-foreground dark:bg-background dark:text-muted-foreground'}`}
          >
            <Icon className="w-4 h-4" />
            <span>{option.value}</span>
          </button>
        );
      })}
    </div>
  );
}