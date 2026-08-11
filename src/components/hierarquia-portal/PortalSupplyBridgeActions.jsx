import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileText, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/components/utils';
import { SMART_SUPPLY_PAGE, SMART_SUPPLY_TITLE } from '@/config/smartSupplyFlags';
import { buildPortalSupplyBridgePayload, savePortalSupplyBridge } from '@/lib/hierarquiaPortal/portalSupplyBridge';

/**
 * Ponte preview (Portal) → SMART SUPPLY de produção (SugestoesCompra).
 */
export default function PortalSupplyBridgeActions({
  linhaCodigo,
  linhaNome,
  produtoCompraNome,
  pontoFuturoLabel,
  veredicto,
  compact = false,
}) {
  const supplyPath = createPageUrl(SMART_SUPPLY_PAGE);
  const pedidosPath = createPageUrl('PedidosCompra');

  const onOpenSupply = () => {
    savePortalSupplyBridge(
      buildPortalSupplyBridgePayload({
        linhaCodigo,
        linhaNome,
        produtoCompraNome,
        pontoFuturoLabel,
        veredicto,
      }),
    );
  };

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" asChild onClick={onOpenSupply}>
          <Link to={supplyPath}>
            {SMART_SUPPLY_TITLE}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1" asChild>
          <Link to={pedidosPath}>Pedidos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <Button variant="secondary" size="sm" className="h-8 text-xs gap-1.5" asChild onClick={onOpenSupply}>
        <Link to={supplyPath}>
          <Zap className="h-3.5 w-3.5" />
          Abrir {SMART_SUPPLY_TITLE}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
      <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" asChild>
        <Link to={pedidosPath}>
          <FileText className="h-3.5 w-3.5" />
          Pedidos de compra
        </Link>
      </Button>
    </div>
  );
}
