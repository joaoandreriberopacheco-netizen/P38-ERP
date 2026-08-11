import React, { useState } from 'react';
import SugestaoCompra from '@/components/compras/SugestaoCompra';
import HierarquiaPortalEntry from '@/components/hierarquia-portal/HierarquiaPortalEntry';

export default function SugestoesCompraPage() {
  const [sugestaoKey, setSugestaoKey] = useState(0);

  return (
    <div className="min-h-screen bg-background font-din-1451 pb-[var(--p38-scroll-pad-below-nav)] md:pb-6">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold text-foreground font-glacial">
              Sugestões de Compra
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Análise inteligente de estoque e reposição
            </p>
          </div>
          <HierarquiaPortalEntry className="shrink-0" />
        </div>
        <SugestaoCompra key={sugestaoKey} />
      </div>
    </div>
  );
}