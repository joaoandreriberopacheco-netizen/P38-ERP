import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, Search, SlidersHorizontal, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { createPageUrl } from '@/components/utils';
import { cn } from '@/components/utils';
import { useCompactShell } from '@/hooks/use-breakpoint';
import CatalogoTipoTabs from '@/components/catalogo-novo/CatalogoTipoTabs';
import CatalogoLeituraToggle from '@/components/catalogo-novo/CatalogoLeituraToggle';
import CatalogoEstudoList from '@/components/catalogo-novo/CatalogoEstudoList';
import CatalogoNovoCatalogPanel from '@/components/catalogo-novo/CatalogoNovoCatalogPanel';
import CatalogoNovoCadastroPanel from '@/components/catalogo-novo/CatalogoNovoCadastroPanel';
import CatalogoSmartSupplyPanel from '@/components/catalogo-novo/CatalogoSmartSupplyPanel';
import { useCatalogoEstudoData } from '@/hooks/useCatalogoEstudoData';
import { CADASTRO_PRODUTO_V2_ENABLED } from '@/config/cadastroProdutoV2Flags';
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
 * @param {'catalog' | 'supply'} mode — ecrã dedicado
 */
export default function CatalogoNovoShell({ mode = 'catalog' }) {
  const isMobile = useCompactShell();
  const [somenteAlerta, setSomenteAlerta] = useState(false);
  const [supplyView, setSupplyView] = useState('mobile');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [leitura, setLeitura] = useState('catalogo');

  const {
    loading,
    portalFilters,
    setPortalFilters,
    filtroLinha,
    setFiltroLinha,
    tipoAtivo,
    setTipoAtivo,
    treeCompra,
    hierarchy,
    filteredSupply,
    linhas,
    catalogProdutos,
    salesVelocityMap,
    refetchProdutos,
    tipoCounts,
  } = useCatalogoEstudoData();

  const searchTerm = portalFilters.searchTerm || '';
  const isSupply = mode === 'supply';

  const title = isSupply ? SMART_SUPPLY_ECOSYSTEM_LABEL : NOVO_CATALOGO_MENU_LABEL;
  const TitleIcon = isSupply ? Zap : LayoutGrid;

  const linhasVisiveis = useMemo(() => {
    if (isSupply) return linhas;
    if (leitura === 'catalogo') return linhas;
    return linhas.filter((l) => l.tipo === tipoAtivo);
  }, [linhas, tipoAtivo, isSupply, leitura]);

  const treeAtivo = treeCompra;
  const showCadastroTab = !isSupply && CADASTRO_PRODUTO_V2_ENABLED;

  const siblingLink = isSupply
    ? { page: 'CatalogoNovo', label: NOVO_CATALOGO_MENU_LABEL }
    : { page: 'SmartSupplyNovo', label: SMART_SUPPLY_ECOSYSTEM_LABEL };

  const searchAndLinhaFilters = (
    <div className="flex flex-col gap-3">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={searchTerm}
          onChange={(e) => setPortalFilters((f) => ({ ...f, searchTerm: e.target.value }))}
          placeholder="Buscar SKU, LINHA, produto…"
          className={cn('pl-9', isMobile ? 'h-12 text-base' : 'h-10')}
        />
      </div>
      <Select value={filtroLinha || 'all'} onValueChange={(v) => setFiltroLinha(v === 'all' ? '' : v)}>
        <SelectTrigger className={cn('w-full', isMobile ? 'h-12 text-base' : 'h-10')}>
          <SelectValue placeholder="LINHA" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as LINHAs</SelectItem>
          {linhasVisiveis.map((l) => (
            <SelectItem key={l.codigo} value={l.codigo}>{l.nome}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {leitura === 'compra' ? (
        <CatalogoTipoTabs tipoAtivo={tipoAtivo} onChange={setTipoAtivo} counts={tipoCounts} />
      ) : null}
    </div>
  );

  return (
    <div
      className={cn(
        CATALOGO_PAGE,
        'flex flex-col h-full min-h-0 w-full max-w-full overflow-hidden',
        isMobile ? 'pb-[var(--p38-scroll-pad-below-nav,0px)]' : 'pb-8',
      )}
    >
      <div className={cn(CATALOGO_HEADER, isMobile && 'sticky top-0 z-30 shrink-0')}>
        <div className={CATALOGO_HEADER_ACCENT} aria-hidden />
        <div className="w-full px-3 md:px-4 py-2.5 md:py-3 space-y-2 relative">
          <div className="flex items-center gap-2 min-w-0">
            <TitleIcon className="h-5 w-5 shrink-0 text-[#a8942e] dark:text-[#A8B56E]" aria-hidden />
            <div className="flex-1 min-w-0">
              {!isMobile ? (
                <p className="text-[10px] uppercase tracking-widest text-[#a8942e]/90 dark:text-[#A8B56E]/90">
                  {NOVO_ECOSISTEMA_MENU_LABEL} · Compras
                </p>
              ) : null}
              <h1 className="p38-page-title truncate">{title}</h1>
            </div>
            {!isMobile && (
              <Button variant="outline" size="sm" className="shrink-0 h-9 text-xs" asChild>
                <Link to={createPageUrl(siblingLink.page)}>{siblingLink.label}</Link>
              </Button>
            )}
          </div>

          {isMobile ? (
            <div
              className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-1"
              role="tablist"
              aria-label={NOVO_ECOSISTEMA_MENU_LABEL}
            >
              {isSupply ? (
                <Link
                  to={createPageUrl('CatalogoNovo')}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg text-xs font-medium text-muted-foreground hover:bg-background/60 active:bg-background/80"
                >
                  {NOVO_CATALOGO_MENU_LABEL}
                </Link>
              ) : (
                <span className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-background text-xs font-semibold shadow-sm">
                  {NOVO_CATALOGO_MENU_LABEL}
                </span>
              )}
              {!isSupply ? (
                <Link
                  to={createPageUrl('SmartSupplyNovo')}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg text-xs font-medium text-muted-foreground hover:bg-background/60 active:bg-background/80"
                >
                  {SMART_SUPPLY_ECOSYSTEM_LABEL}
                </Link>
              ) : (
                <span className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-background text-xs font-semibold shadow-sm">
                  {SMART_SUPPLY_ECOSYSTEM_LABEL}
                </span>
              )}
            </div>
          ) : null}

          {!isSupply ? (
            <CatalogoLeituraToggle
              leitura={leitura}
              onChange={setLeitura}
              showCadastro={showCadastroTab}
              comfortable={isMobile}
            />
          ) : null}

          {isMobile ? (
            leitura !== 'cadastro' ? (
              <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full min-h-[48px] h-12 gap-2 justify-center border-border/40 text-sm"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    Filtros
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle className="text-left text-base">Filtros</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4 pb-6">{searchAndLinhaFilters}</div>
                </SheetContent>
              </Sheet>
            ) : null
          ) : (
            <div className="space-y-2">
              {leitura !== 'cadastro' ? searchAndLinhaFilters : null}
              {isSupply ? (
                <Button
                  variant={somenteAlerta ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-9 w-full sm:w-auto border-[#4a5240]/30 dark:border-[#636B2F]/40"
                  onClick={() => setSomenteAlerta((v) => !v)}
                >
                  Só alertas
                </Button>
              ) : null}
            </div>
          )}

          {isMobile && isSupply ? (
            <Button
              variant={somenteAlerta ? 'secondary' : 'outline'}
              className="w-full min-h-[48px] h-12 border-[#4a5240]/30 dark:border-[#636B2F]/40"
              onClick={() => setSomenteAlerta((v) => !v)}
            >
              Só alertas
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 min-h-0 w-full min-w-0 flex flex-col overflow-hidden px-1 sm:px-3 md:px-4 py-1 md:py-3">
        {!isSupply && leitura === 'catalogo' ? (
          <CatalogoNovoCatalogPanel
            catalogProdutos={catalogProdutos}
            portalFilters={portalFilters}
            salesVelocityMap={salesVelocityMap}
            loading={loading}
            onRefresh={refetchProdutos}
            mobileComfortable={isMobile}
          />
        ) : null}
        {!isSupply && leitura === 'compra' ? (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <CatalogoEstudoList
              tree={treeAtivo}
              tipo={tipoAtivo}
              leitura={leitura}
              mobileComfortable={isMobile}
            />
          </div>
        ) : null}
        {!isSupply && leitura === 'cadastro' ? (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <CatalogoNovoCadastroPanel />
          </div>
        ) : null}
        {isSupply ? (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <CatalogoSmartSupplyPanel
              hierarchy={hierarchy}
              flatLines={filteredSupply}
              somenteAlerta={somenteAlerta}
              loadingVelocity={false}
              view={supplyView}
              onViewChange={setSupplyView}
              mobileComfortable={isMobile}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
