import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, LayoutGrid, Search, SlidersHorizontal, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { createPageUrl } from '@/components/utils';
import { cn } from '@/components/utils';
import { useCompactShell } from '@/hooks/use-breakpoint';
import PortalTipoFilter from '@/components/hierarquia-portal/PortalTipoFilter';
import CatalogoEstudoList from '@/components/catalogo-novo/CatalogoEstudoList';
import CatalogoSmartSupplyPanel from '@/components/catalogo-novo/CatalogoSmartSupplyPanel';
import { useCatalogoEstudoData } from '@/hooks/useCatalogoEstudoData';
import {
  NOVO_CATALOGO_MENU_LABEL,
  NOVO_ECOSISTEMA_MENU_LABEL,
  SMART_SUPPLY_ECOSYSTEM_LABEL,
} from '@/config/smartSupplyFlags';
import {
  CATALOGO_HEADER,
  CATALOGO_HEADER_ACCENT,
  CATALOGO_PAGE,
} from '@/lib/catalogoP38Theme';

/**
 * Novo Ecosistema — shell partilhado (Compras).
 *
 * Intenção (ver docs/novo-ecossistema/README.md):
 * - Novo Catálogo: explorar bloco → sub-bloco → LINHA → produto compra → SKU (Excel estudo).
 * - Smart Supply: reposição por LINHA — LEDs, esquadras, ponto futuro, tabs Mobile/Mix/Portfolio.
 * - Mobile first: header sticky, tabs entre ecrãs, filtros em sheet; info crucial sempre legível.
 * - Única entrada de menu: Compras → Novo Ecosistema (não espalhar atalhos noutros módulos).
 *
 * @param {'catalog' | 'supply'} mode — ecrã dedicado
 */
export default function CatalogoNovoShell({ mode = 'catalog' }) {
  const isMobile = useCompactShell();
  const [somenteAlerta, setSomenteAlerta] = useState(false);
  const [supplyView, setSupplyView] = useState('mobile');
  const [filtersOpen, setFiltersOpen] = useState(false);

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
  const isSupply = mode === 'supply';

  const title = isSupply ? SMART_SUPPLY_ECOSYSTEM_LABEL : NOVO_CATALOGO_MENU_LABEL;
  const TitleIcon = isSupply ? Zap : LayoutGrid;

  const siblingLink = isSupply
    ? { page: 'CatalogoNovo', label: NOVO_CATALOGO_MENU_LABEL }
    : { page: 'SmartSupplyNovo', label: SMART_SUPPLY_ECOSYSTEM_LABEL };

  const filterControls = (
    <>
      <PortalTipoFilter activeTipos={filtroTipos} onChange={setFiltroTipos} counts={tipoCounts} />
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => setPortalFilters((f) => ({ ...f, searchTerm: e.target.value }))}
            placeholder="Buscar SKU, LINHA, produto…"
            className="h-10 pl-8"
          />
        </div>
        <Select value={filtroLinha || 'all'} onValueChange={(v) => setFiltroLinha(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-[200px] h-10">
            <SelectValue placeholder="LINHA" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as LINHAs</SelectItem>
            {linhas.map((l) => (
              <SelectItem key={l.codigo} value={l.codigo}>{l.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {isSupply && (
        <Button
          variant={somenteAlerta ? 'secondary' : 'outline'}
          size="sm"
          className="h-9 w-full sm:w-auto border-[#4a5240]/30 dark:border-[#636B2F]/40"
          onClick={() => setSomenteAlerta((v) => !v)}
        >
          Só alertas
        </Button>
      )}
    </>
  );

  const kpiLine = useMemo(() => {
    const parts = [`${enriched.length} SKUs visíveis`];
    if (isSupply) parts.push(`${filteredSupply.length} esquadras`);
    parts.push('Excel estudo');
    return parts.join(' · ');
  }, [enriched.length, filteredSupply.length, isSupply]);

  return (
    <div
      className={cn(
        CATALOGO_PAGE,
        'flex flex-col min-h-full w-full max-w-full',
        isMobile ? 'pb-[calc(var(--p38-scroll-pad-below-nav,0px)+0.75rem)]' : 'pb-8',
      )}
    >
      <div className={cn(CATALOGO_HEADER, isMobile && 'sticky top-0 z-30')}>
        <div className={CATALOGO_HEADER_ACCENT} aria-hidden />
        <div className="w-full px-3 md:px-4 py-3 space-y-2.5 relative">
          <div className="flex items-start gap-2 min-w-0 pr-24 md:pr-0">
            <TitleIcon className="h-5 w-5 shrink-0 mt-0.5 text-[#a8942e] dark:text-[#A8B56E]" aria-hidden />
            <div className="flex-1 min-w-0 space-y-0.5">
              <p className="text-[10px] uppercase tracking-widest text-[#a8942e]/90 dark:text-[#A8B56E]/90">
                {NOVO_ECOSISTEMA_MENU_LABEL} · Compras
              </p>
              <h1 className="p38-page-title truncate">{title}</h1>
              <p className={cn('p38-page-subtitle', isMobile ? 'text-xs line-clamp-2' : 'text-sm')}>
                {isSupply
                  ? 'Reposição por LINHA — giro, ponto futuro e alertas (Excel estudo)'
                  : 'Bloco → sub-bloco → LINHA → produto compra → SKU'}
              </p>
            </div>
            {!isMobile && (
              <Button variant="outline" size="sm" className="shrink-0 h-8 text-xs" asChild>
                <Link to={createPageUrl(siblingLink.page)}>{siblingLink.label}</Link>
              </Button>
            )}
          </div>

          {isMobile && (
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-muted/40 p-1" role="tablist" aria-label={NOVO_ECOSISTEMA_MENU_LABEL}>
              {isSupply ? (
                <Link
                  to={createPageUrl('CatalogoNovo')}
                  className="inline-flex h-9 items-center justify-center rounded-lg text-xs font-medium text-muted-foreground hover:bg-background/60"
                >
                  {NOVO_CATALOGO_MENU_LABEL}
                </Link>
              ) : (
                <span className="inline-flex h-9 items-center justify-center rounded-lg bg-background text-xs font-semibold shadow-sm">
                  {NOVO_CATALOGO_MENU_LABEL}
                </span>
              )}
              {!isSupply ? (
                <Link
                  to={createPageUrl('SmartSupplyNovo')}
                  className="inline-flex h-9 items-center justify-center rounded-lg text-xs font-medium text-muted-foreground hover:bg-background/60"
                >
                  {SMART_SUPPLY_ECOSYSTEM_LABEL}
                </Link>
              ) : (
                <span className="inline-flex h-9 items-center justify-center rounded-lg bg-background text-xs font-semibold shadow-sm">
                  {SMART_SUPPLY_ECOSYSTEM_LABEL}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 text-[#a8942e] dark:text-[#A8B56E]">
              <FileSpreadsheet className="h-3 w-3" />
              {totalSkus} SKUs
            </span>
            {!isMobile && manifestMeta.sheets?.length ? (
              <>
                <span>·</span>
                <span className="truncate">{manifestMeta.sheets.map((s) => s.name.replace(/ —.*/, '')).join(' · ')}</span>
              </>
            ) : null}
          </div>

          {isMobile ? (
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="w-full h-10 gap-2 justify-center border-border/40">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filtros e tipo de LINHA
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="text-left text-base">Filtros</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-4 pb-6">{filterControls}</div>
              </SheetContent>
            </Sheet>
          ) : (
            <div className="space-y-2">{filterControls}</div>
          )}
        </div>
      </div>

      <div className="flex-1 w-full min-w-0 px-2 sm:px-3 md:px-4 py-3 md:py-4">
        {!isSupply ? (
          <CatalogoEstudoList tree={tree} filtroTipos={filtroTipos} mobileComfortable={isMobile} />
        ) : (
          <CatalogoSmartSupplyPanel
            hierarchy={hierarchy}
            flatLines={filteredSupply}
            somenteAlerta={somenteAlerta}
            loadingVelocity={false}
            view={supplyView}
            onViewChange={setSupplyView}
            mobileComfortable={isMobile}
          />
        )}

        <p className="text-[11px] text-muted-foreground text-center mt-4 px-2 tabular-nums leading-relaxed">
          {kpiLine}
          {isSupply ? ' · estoque simulado' : ''}
        </p>
      </div>
    </div>
  );
}
