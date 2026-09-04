import React from 'react';
import { P38PageHeader } from '@/components/layout/P38PageHeader';
import VisaoFinanceiraPlano from '@/components/config/VisaoFinanceiraPlano';

export default function VisaoFinanceiraPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-4 overflow-x-hidden">
      <P38PageHeader
        variant="page"
        title="Visão Financeira"
        description="Visão consolidada e analítica das despesas planejadas do negócio"
      />

      <VisaoFinanceiraPlano />
    </div>
  );
}
