import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, LayoutGrid, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlacialTabsList, GlacialTabsTrigger } from '@/components/ui/GlacialTabs';
import { createPageUrl } from '@/components/utils';
import { cn } from '@/components/utils';
import PortalTipoFilter from '@/components/hierarquia-portal/PortalTipoFilter';
import PortalCatalogFilters from '@/components/hierarquia-portal/PortalCatalogFilters';
import CatalogoCatalogList from '@/components/catalogo-novo/CatalogoCatalogList';
import CatalogoSmartSupplyPanel from '@/components/catalogo-novo/CatalogoSmartSupplyPanel';
import { useCatalogoPortalData } from '@/hooks/useCatalogoPortalData';
import { HIERARQUIA_PORTAL_PILOTO_LINHAS } from '@/config/hierarquiaPortalFlags';
import { SMART_SUPPLY_PORTAL_PREVIEW_LABEL } from '@/config/smartSupplyFlags';
import {
  CATALOGO_HEADER,
  CATALOGO_HEADER_ACCENT,
  CATALOGO_PAGE,
} from '@/lib/catalogoP38Theme';

const TABS = ['catalogo', 'supply'];

export default function CatalogoNovoPage() {
  const [tab, setTab] = useState('catalogo');
  const [somenteAlerta, setSomenteAlerta] = useState(false);
  const [supplyView, setSupplyView] = useState('mobile');

  const {
    loading,
    loadingVelocity,
    portalFilters,
    setPortalFilters,
    filtroLinha,
    setFiltroLinha,
    filtroTipos,
    setFiltroTipos,
    tree,
    hierarchy,
    filteredSupply,
    linhas,
    enriched,
    produtosPiloto,
    produtosFiltrados,
    tipoCounts,
    estoqueVirtualAtivo,
  } = useCatalogoPortalData();

  const linhasPilotoLabel = HIERARQUIA_PORTAL_PILOTO_LINHAS.map((l) => l.nome).join(' · ');
  const searchTerm = portalFilters.searchTerm || '';

  return (
    <div className={cn(CATALOGO_PAGE, 'flex flex-col min-h-full w-full max-w-full -mx-4 md:-mx-6 tablet-landscape:-mx-7')}>
      <div className={CATALOGO_HEADER}>
        <div className={CATALOGO_HEADER_ACCENT} aria-hidden />
        <div className="w-full px-3 md:px-4 py-3 space-y-3">
          <div className="flex flex-wrap items-start gap-3 justify-between">
            <div className="space-y-1 min-w-0">
              <Button variant="ghost" size="sm" className="h-8 -ml-2 gap-1 text-muted-foreground" asChild>
                <Link to={createPageUrl('HierarquiaPortal')}>
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Portal clássico
                </Link>
              </Button>
              <h1 className="p38-page-title flex items-center gap-2">
                <LayoutGrid className="h-5 w-5 text-[#a8942e] dark:text-[#A8B56E]" aria-hidden />
                Catálogo novo
              </h1>
              <p className="p38-page-subtitle text-sm max-w-2xl hidden md:block">
                Linhas finas · cítrico no claro · oliva-caixa no dark · LEDs pequenos (estilo embarques).
              </p>
            </div>
            <div className="rounded-lg border border-[#e8b824]/30 bg-[#e8b824]/5 dark:border-[#636B2F]/35 dark:bg-[#636B2F]/10 px-3 py-2 text-xs max-w-sm shrink-0">
              <p>
                <strong className="text-[#a8942e] dark:text-[#A8B56E]">Preview UI</strong>
                {' · '}
                {enriched.length}
                {produtosFiltrados.length !== produtosPiloto.length && (
                  <span className="opacity-75"> / {produtosPiloto.length}</span>
                )}
                {' '}SKUs
              </p>
              <p className="text-muted-foreground mt-0.5">{linhasPilotoLabel}</p>
            </div>
          </div>

          <PortalTipoFilter activeTipos={filtroTipos} onChange={setFiltroTipos} counts={tipoCounts} />

          <PortalCatalogFilters
            filters={portalFilters}
            setFilters={setPortalFilters}
            filtroLinha={filtroLinha}
            onFiltroLinhaChange={(v) => setFiltroLinha(v === 'all' ? '' : v)}
            linhas={linhas}
            extra={tab === 'supply' ? (
              <Button
                variant={somenteAlerta ? 'secondary' : 'outline'}
                size="sm"
                className="h-9 border-[#4a5240]/30 dark:border-[#636B2F]/40"
                onClick={() => setSomenteAlerta((v) => !v)}
              >
                Só alertas
              </Button>
            ) : null}
          />

          <GlacialTabsList className="w-full">
            <GlacialTabsTrigger
              value="catalogo"
              activeValue={tab}
              onSelect={setTab}
              label="Catálogo"
            />
            <GlacialTabsTrigger
              value="supply"
              activeValue={tab}
              onSelect={setTab}
              label={(
                <span className="inline-flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  {SMART_SUPPLY_PORTAL_PREVIEW_LABEL}
                </span>
              )}
            />
          </GlacialTabsList>
        </div>
      </div>

      <div className="flex-1 w-full min-w-0 px-3 md:px-4 py-4 pb-10">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            A carregar catálogo…
          </div>
        ) : tab === 'catalogo' ? (
          <CatalogoCatalogList tree={tree} filtroTipos={filtroTipos} search={searchTerm} />
        ) : (
          <CatalogoSmartSupplyPanel
            hierarchy={hierarchy}
            flatLines={filteredSupply}
            somenteAlerta={somenteAlerta}
            loadingVelocity={loadingVelocity}
            view={supplyView}
            onViewChange={setSupplyView}
          />
        )}

        {!loading && (
          <p className="text-[11px] text-muted-foreground text-center mt-4 tabular-nums">
            {enriched.length} SKUs · {filteredSupply.length} esquadras
            {estoqueVirtualAtivo ? ' · estoque virtual ~' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
