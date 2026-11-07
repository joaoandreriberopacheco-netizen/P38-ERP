import React from 'react';
import { cn } from '@/lib/utils';
import ExecucaoOrcamentaria from '../components/financeiro/ExecucaoOrcamentaria';

/** DESKTOP_FULL_HEIGHT_PAGES no Layout — precisa de shell flex + scroll interno. */
export default function FluxoCaixaPage() {
  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden',
        'font-din-1451 bg-background',
      )}
    >
      <ExecucaoOrcamentaria />
    </div>
  );
}
