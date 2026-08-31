import React, { useState } from 'react';
import { P38PageHeader } from '@/components/layout/P38PageHeader';
import SugestaoCompra from '@/components/compras/SugestaoCompra';
import {
  SMART_SUPPLY_SUBTITLE,
  SMART_SUPPLY_TITLE,
} from '@/config/smartSupplyFlags';

export default function SugestoesCompraPage() {
  const [sugestaoKey, setSugestaoKey] = useState(0);

  return (
    <div className="min-h-screen bg-background font-din-1451 pb-[var(--p38-scroll-pad-below-nav)] md:pb-6">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <P38PageHeader
          variant="page"
          title={SMART_SUPPLY_TITLE}
          description={`${SMART_SUPPLY_SUBTITLE}. O catálogo cuida do cadastro; aqui vive a reposição (sugestão + cotação).`}
        />
        <SugestaoCompra key={sugestaoKey} />
      </div>
    </div>
  );
}
