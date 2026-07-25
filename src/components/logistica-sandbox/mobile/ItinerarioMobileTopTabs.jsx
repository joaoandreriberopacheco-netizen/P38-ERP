import React from 'react';
import { Waves, BadgeDollarSign, Ship } from 'lucide-react';

const tabs = [
  { value: 'Fluvial', icon: Waves, label: 'Fluvial' },
  { value: 'Fretes', icon: BadgeDollarSign, label: 'Fretes' },
  { value: 'Boats', icon: Ship, label: 'Barcos' },
];

export default function ItinerarioMobileTopTabs({ value, onChange }) {
  return (
    <div className="sticky top-0 z-20 -mx-3 px-3 py-2 bg-muted/40/95 dark:bg-background/95 backdrop-blur-sm">
      <div className="grid grid-cols-3 gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = value === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onChange(tab.value)}
              className={`min-w-0 rounded-2xl px-2 py-2.5 shadow-sm transition-all ${active ? 'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground' : 'bg-card text-muted-foreground dark:bg-muted dark:text-foreground/90'}`}
            >
              <div className="flex flex-col items-center justify-center gap-1">
                <Icon className="w-4 h-4" />
                <span className="text-[11px] leading-none truncate">{tab.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}