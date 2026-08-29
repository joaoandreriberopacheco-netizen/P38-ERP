import React from 'react';
import { cn } from '@/components/utils';
import { CATALOGO_SUPPLY_LED } from '@/lib/catalogoP38Theme';

export default function CatalogoSupplyLed({ tone = 'off', pulse = false, className }) {
  return (
    <span
      className={cn(
        'inline-block w-1.5 h-1.5 rounded-full shrink-0 mt-1',
        CATALOGO_SUPPLY_LED[tone] || CATALOGO_SUPPLY_LED.alerta,
        pulse && tone !== 'off' && 'animate-pulse',
        className,
      )}
      aria-hidden
    />
  );
}
