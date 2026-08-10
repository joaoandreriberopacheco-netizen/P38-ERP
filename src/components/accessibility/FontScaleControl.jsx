import React, { useState } from 'react';
import { FONT_SCALE_OPTIONS, getStoredFontScale, setStoredFontScale } from '@/lib/fontScale';

export default function FontScaleControl({ compact = false }) {
  const [scale, setScale] = useState(() => getStoredFontScale());

  const handleSelect = (value) => {
    const nextScale = setStoredFontScale(value);
    setScale(nextScale);
  };

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-foreground/90">Tamanho da fonte</span>
        <span className="text-xs text-muted-foreground">Acessibilidade</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {FONT_SCALE_OPTIONS.map((option) => {
          const active = scale === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`h-10 rounded-2xl text-sm font-medium shadow-sm transition-colors ${active ? 'bg-primary text-primary-foreground dark:bg-card dark:text-foreground' : 'bg-muted text-muted-foreground dark:bg-muted dark:text-foreground/90'}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}