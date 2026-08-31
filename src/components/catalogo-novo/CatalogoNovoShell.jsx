import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, Search, SlidersHorizontal, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createPageUrl } from '@/components/utils';
import { cn } from '@/components/utils';
import { useCompactShell } from '@/hooks/use-breakpoint';
import { useScrollChromeVisibility } from '@/hooks/useScrollChromeVisibility';
import { P38ScrollChromeCollapse } from '@/components/layout/P38ScrollChromeCollapse';
import CatalogoTipoTabs from '@/components/catalogo-novo/CatalogoTipoTabs';
import CatalogoLeituraToggle from '@/components/catalogo-novo/CatalogoLeituraToggle';
import CatalogoEstudoList from '@/components/catalogo-novo/CatalogoEstudoList';
import CatalogoNovoCatalogPanel from '@/components/catalogo-novo/CatalogoNovoCatalogPanel';
import CatalogoNovoCadastroPanel from '@/components/catalogo-novo/CatalogoNovoCadastroPanel';
import CatalogoSmartSupplyPanel from '@/components/catalogo-novo/CatalogoSmartSupplyPanel';
import ProdutosMobileFiltersSheet from '@/components/produtos/ProdutosMobileFiltersSheet';
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
import {
  COMPRAS_FILTER_BADGE,
  COMPRAS_MOBILE_ICON_BTN,
  COMPRAS_SEARCH_INPUT_COMPACT,
} from '@/lib/comprasP38Theme';
import {
  collectCatalogVitrineUnits,
  countActiveProdutoFilters,
} from '@/lib/filterProdutos';
import { createCatalogStockContext } from '@/lib/catalogEstoqueVirtual';

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
  const [sortOrder, setSortOrder] = useState('az');
  const [treeLevel, setTreeLevel] = useState(4);

  const { chromeVisible, scrollRef } = useScrollChromeVisibility(isMobile, {
    revealMode: 'top-only',
  });

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
  const SiblingIcon = isSupply ? LayoutGrid : Zap;
  const siblingPage = isSupply ? 'CatalogoNovo' : 'SmartSupplyNovo';
  const siblingLabel = isSupply ? NOVO_CATALOGO_MENU_LABEL : SMART_SUPPLY_ECOSYSTEM_LABEL;

  const linhasVisiveis = useMemo(() => {
    if (isSupply) return linhas;
    if (leitura === 'catalogo') return linhas;
    return linhas.filter((l) => l.tipo === tipoAtivo);
  }, [linhas, tipoAtivo, isSupply, leitura]);

  const treeAtivo = treeCompra;
  const showCadastroTab = !isSupply && CADASTRO_PRODUTO_V2_ENABLED;

  const estoqueVirtualAtivo = portalFilters.estoqueVirtual === true;
  const catalogStockContext = useMemo(
    () => (estoqueVirtualAtivo ? createCatalogStockContext(true, null) : null),
    [estoqueVirtualAtivo],
  );

  const categorias = useMemo(() => {
    const set = new Set();
    for (const p of catalogProdutos) {
      if (p.categoria) set.add(p.categoria);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [catalogProdutos]);

  const unidadesVitrine = useMemo(
    () => collectCatalogVitrineUnits(catalogProdutos),
    [catalogProdutos],
  );

  const activeFilterCount = useMemo(
    () => countActiveProdutoFilters(portalFilters),
    [portalFilters],
  );

  const handleFilterChange = useCallback(
    (key, value) => setPortalFilters((prev) => ({ ...prev, [key]: value })),
    [setPortalFilters],
  );

  const filterSheetExtraTop = (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold text-foreground mb-1.5">LINHA</p>
        <Select value={filtroLinha || 'all'} onValueChange={(v) => setFiltroLinha(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-10 w-full rounded-xl">
            <SelectValue placeholder="LINHA" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as LINHAs</SelectItem>
            {linhasVisiveis.map((l) => (
              <SelectItem key={l.codigo} value={l.codigo}>{l.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {!isSupply && leitura === 'compra' ? (
        <CatalogoTipoTabs tipoAtivo={tipoAtivo} onChange={setTipoAtivo} counts={tipoCounts} />
      ) : null}
      {isSupply ? (
        <Button
          variant={somenteAlerta ? 'secondary' : 'outline'}
          className="w-full min-h-[44px] border-[#4a5240]/30 dark:border-[#636B2F]/40"
          onClick={() => setSomenteAlerta((v) => !v)}
        >
          Só alertas
        </Button>
      ) : null}
    </div>
  );

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

  const mobileSearchBar = (
    <div className="flex min-w-0 items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          autoComplete="off"
          value={searchTerm}
          onChange={(e) => setPortalFilters((f) => ({ ...f, searchTerm: e.target.value }))}
          placeholder="Buscar SKU, LINHA, produto…"
          className={COMPRAS_SEARCH_INPUT_COMPACT}
        />
        {searchTerm ? (
          <button
            type="button"
            onClick={() => setPortalFilters((f) => ({ ...f, searchTerm: '' }))}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Limpar busca"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => setFiltersOpen(true)}
        className={cn(COMPRAS_MOBILE_ICON_BTN, 'relative shrink-0')}
        title="Filtros"
        aria-label="Filtros do catálogo"
        aria-expanded={filtersOpen}
      >
        <SlidersHorizontal className="h-4 w-4" />
        {activeFilterCount > 0 ? (
          <span className={COMPRAS_FILTER_BADGE}>
            {activeFilterCount > 9 ? '9+' : activeFilterCount}
          </span>
        ) : null}
      </button>
    </div>
  );

  const mobileTitleRow = (
    <div className="flex items-center gap-2 min-w-0 px-3 pt-1 pb-2">
      <TitleIcon className="h-5 w-5 shrink-0 text-[#a8942e] dark:text-[#A8B56E]" aria-hidden />
      <h1 className="p38-page-title flex-1 min-w-0 truncate text-base leading-tight">{title}</h1>
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 shrink-0 rounded-xl"
        asChild
        title={siblingLabel}
        aria-label={siblingLabel}
      >
        <Link to={createPageUrl(siblingPage)}>
          <SiblingIcon className="h-5 w-5 text-[#a8942e] dark:text-[#A8B56E]" />
        </Link>
      </Button>
    </div>
  );

  const mobileContent = (
    <>
      <P38ScrollChromeCollapse visible={chromeVisible} enabled className="shrink-0 border-b border-border/25">
        {mobileTitleRow}
      </P38ScrollChromeCollapse>

      {leitura !== 'cadastro' ? (
        <div className="shrink-0 px-3 pb-2 bg-background">{mobileSearchBar}</div>
      ) : null}

      <div className="flex-1 min-h-0 w-full min-w-0 flex flex-col overflow-hidden px-1">
        {!isSupply && leitura === 'catalogo' ? (
          <CatalogoNovoCatalogPanel
            catalogProdutos={catalogProdutos}
            portalFilters={portalFilters}
            salesVelocityMap={salesVelocityMap}
            catalogStockContext={catalogStockContext}
            loading={loading}
            onRefresh={refetchProdutos}
            mobileComfortable={isMobile}
            scrollRef={scrollRef}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
          />
        ) : null}
        {!isSupply && leitura === 'compra' ? (
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y pb-[var(--p38-scroll-pad-below-nav)]">
            <CatalogoEstudoList
              tree={treeAtivo}
              tipo={tipoAtivo}
              leitura={leitura}
              mobileComfortable={isMobile}
            />
          </div>
        ) : null}
        {!isSupply && leitura === 'cadastro' ? (
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y pb-[var(--p38-scroll-pad-below-nav)]">
            <CatalogoNovoCadastroPanel />
          </div>
        ) : null}
        {isSupply ? (
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y pb-[var(--p38-scroll-pad-below-nav)]">
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

      <ProdutosMobileFiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={portalFilters}
        categorias={categorias}
        fornecedores={[]}
        unidadesVitrine={unidadesVitrine}
        activeFilterCount={activeFilterCount}
        handleFilterChange={handleFilterChange}
        setFilters={setPortalFilters}
        treeLevel={treeLevel}
        setTreeLevel={setTreeLevel}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        extraTop={filterSheetExtraTop}
      />
    </>
  );

  const desktopContent = (
    <>
      <div className={CATALOGO_HEADER}>
        <div className={CATALOGO_HEADER_ACCENT} aria-hidden />
        <div className="w-full px-3 md:px-4 py-2.5 md:py-3 space-y-2 relative">
          <div className="flex items-center gap-2 min-w-0">
            <TitleIcon className="h-5 w-5 shrink-0 text-[#a8942e] dark:text-[#A8B56E]" aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-[#a8942e]/90 dark:text-[#A8B56E]/90">
                {NOVO_ECOSISTEMA_MENU_LABEL} · Compras
              </p>
              <h1 className="p38-page-title truncate">{title}</h1>
            </div>
            <Button variant="outline" size="sm" className="shrink-0 h-9 text-xs" asChild>
              <Link to={createPageUrl(siblingPage)}>{siblingLabel}</Link>
            </Button>
          </div>

          {!isSupply ? (
            <CatalogoLeituraToggle
              leitura={leitura}
              onChange={setLeitura}
              showCadastro={showCadastroTab}
            />
          ) : null}

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
        </div>
      </div>

      <div className="flex-1 min-h-0 w-full min-w-0 flex flex-col overflow-hidden px-1 sm:px-3 md:px-4 py-1 md:py-3">
        {!isSupply && leitura === 'catalogo' ? (
          <CatalogoNovoCatalogPanel
            catalogProdutos={catalogProdutos}
            portalFilters={portalFilters}
            salesVelocityMap={salesVelocityMap}
            catalogStockContext={catalogStockContext}
            loading={loading}
            onRefresh={refetchProdutos}
          />
        ) : null}
        {!isSupply && leitura === 'compra' ? (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <CatalogoEstudoList
              tree={treeAtivo}
              tipo={tipoAtivo}
              leitura={leitura}
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
            />
          </div>
        ) : null}
      </div>
    </>
  );

  return (
    <div
      className={cn(
        CATALOGO_PAGE,
        'flex flex-col h-full min-h-0 w-full max-w-full overflow-hidden',
        isMobile ? 'pb-[var(--p38-scroll-pad-below-nav,0px)]' : 'pb-8',
      )}
    >
      {isMobile ? mobileContent : desktopContent}
    </div>
  );
}
