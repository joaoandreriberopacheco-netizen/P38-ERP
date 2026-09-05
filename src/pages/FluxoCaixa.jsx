import React from 'react';
import { useCompactShell } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';
import ExecucaoOrcamentaria from '../components/financeiro/ExecucaoOrcamentaria';

export default function FluxoCaixaPage() {
  const isPhone = useCompactShell();

  return (
    <div
      className={cn(
        'w-full min-w-0 max-w-full font-din-1451 bg-background',
        isPhone && 'flex h-full min-h-0 flex-col overflow-hidden',
      )}
    >
      <ExecucaoOrcamentaria />
    </div>
  );
}
