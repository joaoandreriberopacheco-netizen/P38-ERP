import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet, LayoutGrid, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GlacialTabsList, GlacialTabsTrigger } from '@/components/ui/GlacialTabs';
import { createPageUrl } from '@/components/utils';
import { cn } from '@/components/utils';
import PortalTipoFilter from '@/components/hierarquia-portal/PortalTipoFilter';
import CatalogoEstudoList from '@/components/catalogo-novo/CatalogoEstudoList';
import CatalogoSmartSupplyPanel from '@/components/catalogo-novo/CatalogoSmartSupplyPanel';
import { useCatalogoEstudoData } from '@/hooks/useCatalogoEstudoData';
import { SMART_SUPPLY_PORTAL_PREVIEW_LABEL } from '@/config/smartSupplyFlags';
import {
  CATALOGO_HEADER,
  CATALOGO_HEADER_ACCENT,
  CATALOGO_PAGE,
} from '@/lib/catalogoP38Theme';

export default function CatalogoNovoPage() {
  const [tab, setTab] = useState('catalogo');
  const [somenteAlerta, setSomenteAlerta] = useState(false);
  const [supplyView, setSupplyView] = useState('mobile');

  const {
    manifestMeta,
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
    totalSkus,
    tipoCounts,
  } = useCatalogoEstudoData();

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
                  Portal clássico (piloto live)
                </Link>
              </Button>
              <h1 className="p38-page-title flex items-center gap-2">
                <LayoutGrid className="h-5 w-5 text-[#a8942e] dark:text-[#A8B56E]" aria-hidden />
                Catálogo novo
              </h1>
              <p className="p38-page-subtitle text-sm max-w-2xl hidden md:block">
                Dados do Excel de estudo — sem Supabase. Camadas: bloco → sub-bloco → LINHA → produto compra → SKU.
              </p>
            </div>
            <div className="rounded-lg border border-[#e8b824]/30 bg-[#e8b824]/5 dark:border-[#636B2F]/35 dark:bg-[#636B2F]/10 px-3 py-2 text-xs max-w-sm shrink-0 space-y-1">
              <p className="flex items-center gap-1.5 text-[#a8942e] dark:text-[#A8B56E] font-medium">
                <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                Base: Excel externo
              </p>
              <p className="text-muted-foreground">
                {totalSkus} SKUs · {manifestMeta.sheets?.map((s) => s.name.replace(/ —.*/, '')).join(' · ')}
              </p>
              <p className="text-[10px] text-muted-foreground/80 truncate" title={manifestMeta.source}>
                {manifestMeta.source}
              </p>
            </div>
          </div>

          <PortalTipoFilter activeTipos={filtroTipos} onChange={setFiltroTipos} counts={tipoCounts} />

          <div className="flex flex-wrap gap-2 items-center">
            <Input
              value={searchTerm}
              onChange={(e) => setPortalFilters((f) => ({ ...f, searchTerm: e.target.value }))}
              placeholder="Buscar no estudo Excel…"
              className="h-9 flex-1 min-w-[200px] max-w-md"
            />
            <Select value={filtroLinha || 'all'} onValueChange={(v) => setFiltroLinha(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="LINHA" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as LINHAs</SelectItem>
                {linhas.map((l) => (
                  <SelectItem key={l.codigo} value={l.codigo}>{l.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tab === 'supply' && (
              <Button
                variant={somenteAlerta ? 'secondary' : 'outline'}
                size="sm"
                className="h-9 border-[#4a5240]/30 dark:border-[#636B2F]/40"
                onClick={() => setSomenteAlerta((v) => !v)}
              >
                Só alertas
              </Button>
            )}
          </div>

          <GlacialTabsList className="w-full">
            <GlacialTabsTrigger value="catalogo" activeValue={tab} onSelect={setTab} label="Catálogo" />
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
        {tab === 'catalogo' ? (
          <CatalogoEstudoList tree={tree} filtroTipos={filtroTipos} />
        ) : (
          <CatalogoSmartSupplyPanel
            hierarchy={hierarchy}
            flatLines={filteredSupply}
            somenteAlerta={somenteAlerta}
            loadingVelocity={false}
            view={supplyView}
            onViewChange={setSupplyView}
          />
        )}

        <p className="text-[11px] text-muted-foreground text-center mt-4 tabular-nums">
          {enriched.length} SKUs visíveis · {filteredSupply.length} esquadras · estoque simulado (preview)
        </p>
      </div>
    </div>
  );
}
