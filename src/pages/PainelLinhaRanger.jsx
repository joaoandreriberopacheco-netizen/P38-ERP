import React from 'react';
import PainelLinhaRanger from '@/components/compras/PainelLinhaRanger';

export default function PainelLinhaRangerPage() {
  return (
    <div className="min-h-screen bg-background font-din-1451 pb-[var(--p38-scroll-pad-below-nav)] md:pb-6">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground font-glacial">
            Painel LINHA — Blade Ranger
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Formação por corredor: análise preditiva de ruptura linha a linha
          </p>
        </div>
        <PainelLinhaRanger />
      </div>
    </div>
  );
}
