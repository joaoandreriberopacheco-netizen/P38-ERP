import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/components/utils';
import { summarizePortalSupply } from '@/lib/hierarquiaPortal/buildPortalSupplyHierarchy';
import { buildPortalSupplyBridgePayload, savePortalSupplyBridge } from '@/lib/hierarquiaPortal/portalSupplyBridge';
import { SMART_SUPPLY_PAGE, SMART_SUPPLY_TITLE } from '@/config/smartSupplyFlags';
import { buildSupplyDrilldownTree } from '@/lib/smartSupply/buildSupplyDrilldownTree';
import { SUPPLY_CURSOR } from '@/lib/smartSupply/smartSupplyCursorTableTheme';
import SmartSupplyDrilldownTable from '@/components/smart-supply/SmartSupplyDrilldownTable';

function RangerBar({ flatLines, drilldownRoots, somenteAlerta }) {
  const stats = useMemo(() => summarizePortalSupply(flatLines), [flatLines]);
  const linhas = drilldownRoots?.reduce((n, cat) => n + (cat.children?.length || 0), 0) ?? 0;
  const supplyPath = createPageUrl(SMART_SUPPLY_PAGE);

  const onOpenSupply = () => {
    savePortalSupplyBridge(
      buildPortalSupplyBridgePayload({
        linhaCodigo: '',
        linhaNome: '',
        produtoCompraNome: '',
        pontoFuturoLabel: '',
        veredicto: 'portal_preview',
      }),
    );
  };

  return (
    <div className={SUPPLY_CURSOR.ranger}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums text-muted-foreground">
        <span>
          <strong className="text-foreground/90">{linhas}</strong> LINHA
        </span>
        <span>·</span>
        <span>
          <strong className="text-foreground/90">{stats.total}</strong> esq
        </span>
        <span>·</span>
        <span>
          <strong className="text-[#e8b824]">{stats.saldaveis}</strong> saldáveis
        </span>
        <span>·</span>
        <span>
          <strong className="text-foreground/90">{stats.alertas}</strong> alertas
        </span>
        {somenteAlerta && (
          <span className="text-[10px] uppercase tracking-wide ml-1">só alertas</span>
        )}
      </div>
      <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 shrink-0 shadow-none" asChild onClick={onOpenSupply}>
        <Link to={supplyPath}>
          <Zap className="h-3.5 w-3.5" />
          {SMART_SUPPLY_TITLE}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </Button>
    </div>
  );
}

export default function PortalSmartSupplyPanel({ supplyLines, flatLines, somenteAlerta, loadingVelocity, velocityMap = {} }) {
  const drilldownRoots = useMemo(
    () => buildSupplyDrilldownTree(supplyLines, velocityMap),
    [supplyLines, velocityMap],
  );

  if (!flatLines?.length) {
    return (
      <div className="py-12 text-center border-b border-border/25 dark:border-white/[0.06]">
        <p className="text-sm text-muted-foreground">Nenhuma esquadra no piloto.</p>
        <p className="text-xs text-muted-foreground/70 mt-2 max-w-md mx-auto">
          Excel + produtos activos com código no manifest. FORRO PVC: ver{' '}
          <code className="text-[10px]">docs/smart-supply/EXCEL-FORRO-PVC.md</code>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0 border border-border/25 dark:border-white/[0.06] rounded-none overflow-hidden">
      <RangerBar flatLines={flatLines} drilldownRoots={drilldownRoots} somenteAlerta={somenteAlerta} />
      {loadingVelocity && (
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground px-3 py-1 tabular-nums border-b border-border/20 dark:border-white/[0.06]">
          vendas 90d…
        </p>
      )}
      <SmartSupplyDrilldownTable roots={drilldownRoots} somenteAlerta={somenteAlerta} />
    </div>
  );
}
