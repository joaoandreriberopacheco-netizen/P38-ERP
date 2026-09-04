import React from 'react';
import { cn } from '@/components/utils';
import ConsultaComprasPedidos from '@/components/compras/ConsultaComprasPedidos';
import { format } from 'date-fns';

const MOBILE_EXPORT_WIDTH_PX = 390;

export default function ConsultaComprasExportDocument({
  pedidosFiltrados = [],
  groupBy = 'eta_transportadora',
  sortOrder = 'asc',
  produtosMap = {},
  showDetalheCustos = true,
  theme = 'light',
  filtrosDesc = '',
  contextLabel = 'Consulta de compras',
}) {
  const geradoEm = format(new Date(), 'dd/MM/yyyy HH:mm');

  return (
    <div
      className={cn(
        'bg-background text-foreground font-din-1451',
        theme === 'dark' ? 'dark' : 'light',
      )}
      style={{ width: MOBILE_EXPORT_WIDTH_PX }}
    >
      <div
        id="consulta-export-capture"
        className="px-4 py-5 min-w-0 max-w-full overflow-visible"
        style={{ paddingBottom: 24 }}
      >
        {filtrosDesc ? (
          <p className="text-[10px] leading-snug text-muted-foreground mb-3 font-light normal-case">
            {filtrosDesc}
          </p>
        ) : null}
        <p className="text-[10px] text-muted-foreground mb-3 font-light tabular-nums">
          Gerado em {geradoEm}
        </p>
        <ConsultaComprasPedidos
          exportMode
          showDetalheCustos={showDetalheCustos}
          produtosMap={produtosMap}
          pedidosFiltrados={pedidosFiltrados}
          groupBy={groupBy}
          sortOrder={sortOrder}
          contextLabel={contextLabel}
          modoFixo="embarque"
        />
      </div>
    </div>
  );
}

export { MOBILE_EXPORT_WIDTH_PX };
