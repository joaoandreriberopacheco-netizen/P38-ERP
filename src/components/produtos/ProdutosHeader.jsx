import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { createPageUrl } from '@/components/utils';
import { Columns, Download, Upload, Sparkles, Wand2, PlusCircle, SlidersHorizontal, Search, X, Image as ImageIcon, BarChart3, Filter, Percent, Loader2, Tag, Tags, LayoutGrid, TrendingUp, Gauge } from 'lucide-react';
import { DEFAULT_PRODUTO_FILTERS, ABCD_FILTER_VALUES, ABCD_FILTER_LABELS } from '@/lib/filterProdutos';
import ProdutosSearchStartsWithToggle from '@/components/produtos/ProdutosSearchStartsWithToggle';
import CatalogSearchInput from '@/components/produtos/CatalogSearchInput';
import ProdutosSomentePositivosToggle from '@/components/produtos/ProdutosSomentePositivosToggle';
import ProdutosEstoqueVirtualToggle from '@/components/produtos/ProdutosEstoqueVirtualToggle';
import ProdutosAnaliseAgrupamentoControl from '@/components/produtos/ProdutosAnaliseAgrupamentoControl';
import ProdutosAbcdQuickFilter from '@/components/produtos/ProdutosAbcdQuickFilter';
import ProdutosNumericMetricFilter from '@/components/produtos/ProdutosNumericMetricFilter';
import HierarquiaPortalEntry from '@/components/hierarquia-portal/HierarquiaPortalEntry';
import ModeloCatalogoEntry from '@/components/modelo-catalogo/ModeloCatalogoEntry';
import CadastroProdutoV2Entry from '@/components/cadastro-produto-v2/CadastroProdutoV2Entry';
import { LevelControl } from '@/components/produtos/treegrid/TreeGrid';
import ProdutosTreeByCategoryToggle from '@/components/produtos/ProdutosTreeByCategoryToggle';
import ProdutosMobileFiltersSheet from '@/components/produtos/ProdutosMobileFiltersSheet';
import { useCompactShell } from '@/hooks/use-breakpoint';
import { cn } from '@/components/utils';
import {
  PRODUTOS_DROPDOWN_ITEM,
  PRODUTOS_DROPDOWN_MENU,
  PRODUTOS_FILTER_BADGE,
  PRODUTOS_FILTER_OPEN,
  PRODUTOS_FILTER_PANEL,
  PRODUTOS_ICON_ACCENT,
  PRODUTOS_ICON_BTN,
  PRODUTOS_PAGE_HEADER,
  PRODUTOS_SEARCH_INPUT,
  PRODUTOS_SEARCH_SHELL,
} from '@/lib/produtosP38Theme';

function ProdutosHeader({
  stats,
  filters,
  categorias,
  fornecedores,
  unidadesVitrine = [],
  activeFilterCount,
  isSummaryFiltered = false,
  isFilterOpen,
  setIsFilterOpen,
  handleFilterChange,
  handleExportarCatalogo,
  handleBaixarTemplateUnificado,
  setIsMassImageUploaderOpen,
  handleAddNew,
  setFilters,
  formatarNumero,
  hasFilteredProdutos = false,
  treeLevel,
  setTreeLevel,
  sortOrder = 'az',
  setSortOrder,
  setIsColumnSelectorOpen,
  onGerarRelatorioEstoque,
  gerandoRelatorioEstoque = false,
  onGerarRelatorioVendas,
  gerandoRelatorioVendas = false,
  onGerarRelatorioVendasV2,
  gerandoRelatorioVendasV2 = false,
  onGerarRelatorioIep,
  gerandoRelatorioIep = false,
  onOpenCatalogTagPrint,
  onOpenMassTag,
  onOpenMassCategory,
  onOpenMassPrecificacao,
  onOpenPontosPedido,
  groupTreeByCategory = false,
  onGroupTreeByCategoryChange,
  onClearFilters,
}) {
  const isMobileLayout = useCompactShell();
  const quantidadeOperador = filters.quantidadeOperador || 'all';

  const clearFilters = () => {
    if (onClearFilters) {
      onClearFilters();
      return;
    }
    setFilters({ ...DEFAULT_PRODUTO_FILTERS });
  };

  return (
    <div className={PRODUTOS_PAGE_HEADER}>
      <div className="w-full min-w-0 px-3 py-2 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-foreground truncate font-glacial">Catálogo</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground min-w-0">
              {isSummaryFiltered && (
                <Filter
                  className="w-3 h-3 p38-text-accent flex-shrink-0"
                  aria-label="Resumo sob filtros ativos"
                />
              )}
              <span className="truncate">{stats.total} produtos</span>
              <span className="truncate">
                R$ {formatarNumero(stats.valorEstoqueAtivo || 0)}
                {filters.estoqueVirtual ? ' ~' : ''}
              </span>
              {stats.abaixoMinimo > 0 && <span className="text-red-500 flex-shrink-0">{stats.abaixoMinimo} abaixo mín.</span>}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0 min-w-0 max-w-[58vw] sm:max-w-none overflow-x-auto overscroll-x-contain">
            <CadastroProdutoV2Entry size="icon" className="h-9 w-9 px-0" variant="ghost" />
            <HierarquiaPortalEntry size="icon" className="h-9 w-9 px-0" variant="ghost" />
            <ModeloCatalogoEntry size="icon" className="h-9 w-9 px-0" variant="ghost" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 flex-shrink-0"
              onClick={() => onOpenCatalogTagPrint?.()}
              title="Etiquetas em PDF A4"
              aria-label="Etiquetas em PDF A4"
            >
              <Tags className="h-4 w-4 p38-text-accent" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 flex-shrink-0"
                  title="Relatórios do catálogo"
                  disabled={gerandoRelatorioEstoque || gerandoRelatorioVendas || gerandoRelatorioVendasV2 || gerandoRelatorioIep}
                >
                  {gerandoRelatorioEstoque || gerandoRelatorioVendas || gerandoRelatorioVendasV2 || gerandoRelatorioIep ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : (
                    <BarChart3 className="w-4 h-4 p38-text-accent" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={PRODUTOS_DROPDOWN_MENU}>
                <DropdownMenuItem
                  onClick={() => {
                    window.setTimeout(() => onGerarRelatorioEstoque?.(), 0);
                  }}
                  className={cn(
                    cn('text-sm', PRODUTOS_DROPDOWN_ITEM),
                    gerandoRelatorioEstoque && 'pointer-events-none opacity-50',
                  )}
                >
                  <BarChart3 className="w-4 h-4 mr-2 p38-text-accent" />
                  Estoque enxuto
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    window.setTimeout(() => onGerarRelatorioVendas?.('30d'), 0);
                  }}
                  className={cn(
                    cn('text-sm', PRODUTOS_DROPDOWN_ITEM),
                    gerandoRelatorioVendas && 'pointer-events-none opacity-50',
                  )}
                >
                  <TrendingUp className="w-4 h-4 mr-2 p38-text-accent" />
                  Desempenho — 30 dias
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    window.setTimeout(() => onGerarRelatorioVendas?.('60d'), 0);
                  }}
                  className={cn(
                    cn('text-sm', PRODUTOS_DROPDOWN_ITEM),
                    gerandoRelatorioVendas && 'pointer-events-none opacity-50',
                  )}
                >
                  <TrendingUp className="w-4 h-4 mr-2 p38-text-accent" />
                  Desempenho — 60 dias
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    window.setTimeout(() => onGerarRelatorioVendasV2?.(), 0);
                  }}
                  className={cn(
                    cn('text-sm', PRODUTOS_DROPDOWN_ITEM),
                    gerandoRelatorioVendasV2 && 'pointer-events-none opacity-50',
                  )}
                >
                  <TrendingUp className="w-4 h-4 mr-2 p38-text-accent" />
                  Desempenho v2 (beta) — 30+60d
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    window.setTimeout(() => onOpenCatalogTagPrint?.(), 0);
                  }}
                  className={cn('text-sm', PRODUTOS_DROPDOWN_ITEM)}
                >
                  <Tags className="w-4 h-4 mr-2 p38-text-accent" />
                  Etiquetas em PDF A4
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    window.setTimeout(() => onGerarRelatorioIep?.(), 0);
                  }}
                  className={cn(
                    cn('text-sm', PRODUTOS_DROPDOWN_ITEM),
                    gerandoRelatorioIep && 'pointer-events-none opacity-50',
                  )}
                >
                  <BarChart3 className="w-4 h-4 mr-2 p38-text-accent" />
                  Curva ABC / IEP
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 flex-shrink-0"
              title="Recalcular pontos de pedido (estoque mínimo)"
              onClick={() => onOpenPontosPedido?.()}
            >
              <Gauge className="w-4 h-4 p38-text-accent" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 flex-shrink-0"
              title="Classificar categorias com IA"
              onClick={() => onOpenMassCategory?.()}
              disabled={!hasFilteredProdutos}
            >
              <LayoutGrid className="w-4 h-4 p38-text-accent" />
            </Button>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleExportarCatalogo} title="Exportar">
                <Download className="w-4 h-4 text-muted-foreground" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9" title="Importar">
                    <Upload className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={PRODUTOS_DROPDOWN_MENU}>
                  {hasFilteredProdutos && (
                    <DropdownMenuItem
                      onClick={() => {
                        window.setTimeout(() => onOpenMassPrecificacao?.(), 0);
                      }}
                      className={cn('text-sm', PRODUTOS_DROPDOWN_ITEM)}
                    >
                      <SlidersHorizontal className="w-4 h-4 mr-2 p38-text-accent" />Ajustar precificação nos filtrados
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleBaixarTemplateUnificado} className={cn('text-sm', PRODUTOS_DROPDOWN_ITEM)}>
                    <Download className="w-4 h-4 mr-2" />Template
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className={cn('text-sm', PRODUTOS_DROPDOWN_ITEM)}>
                    <Link to={createPageUrl('ImportacaoProdutos')}>
                      <Upload className="w-4 h-4 mr-2" />Importar CSV
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsMassImageUploaderOpen(true)} className={cn('text-sm', PRODUTOS_DROPDOWN_ITEM)}>
                    <ImageIcon className="w-4 h-4 mr-2" />Importar Imagens
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9" title="IA">
                    <Sparkles className="w-4 h-4 p38-text-accent" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={PRODUTOS_DROPDOWN_MENU}>
                  {hasFilteredProdutos && (
                    <DropdownMenuItem
                      onClick={() => {
                        window.setTimeout(() => onOpenMassTag?.(), 0);
                      }}
                      className={cn('text-sm', PRODUTOS_DROPDOWN_ITEM)}
                    >
                      <Sparkles className="w-4 h-4 mr-2 p38-text-accent" />Tagificação em Massa
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild className={cn('text-sm', PRODUTOS_DROPDOWN_ITEM)}>
                    <Link to={createPageUrl('OtimizacaoEstoqueIA')}>
                      <Sparkles className="w-4 h-4 mr-2 p38-text-accent" />Otimizar Estoque
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className={cn('text-sm', PRODUTOS_DROPDOWN_ITEM)}>
                    <Link to={createPageUrl('EstimativaEmbalagensIA')}>
                      <Wand2 className="w-4 h-4 mr-2 p38-text-accent" />Estimar Embalagens
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={handleAddNew} variant="ghost" size="icon" className="h-9 w-9" title="Novo produto">
                <PlusCircle className="h-4 w-4 text-foreground/90" />
              </Button>
            </div>
          </div>
        </div>

        {/* Busca larga no topo; atalhos e filtros logo abaixo (sem scroll horizontal). */}
        <div className="flex flex-col gap-2 min-w-0">
          <div className={cn('relative w-full min-w-0', PRODUTOS_SEARCH_SHELL)}>
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none desktop-layout:left-3" />
            <CatalogSearchInput
              placeholder="Nome ou descrição (espaço ou ; para combinar). XXmolhadas ou XXj- filtra por categoria..."
              className={PRODUTOS_SEARCH_INPUT}
              value={filters.searchTerm}
              onChange={(value) => handleFilterChange('searchTerm', value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 desktop-layout:gap-2 min-w-0">
            <ProdutosSomentePositivosToggle filters={filters} setFilters={setFilters} />
            <ProdutosEstoqueVirtualToggle filters={filters} setFilters={setFilters} />
            <ProdutosAbcdQuickFilter
              abcd={filters.abcd}
              onChange={(value) => handleFilterChange('abcd', value)}
            />
            {hasFilteredProdutos && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn('h-10 w-10 flex-shrink-0', PRODUTOS_ICON_BTN, 'desktop-layout:hidden')}
                  onClick={() => onOpenMassCategory?.()}
                  title="Classificar categorias com IA"
                  aria-label="Classificar categorias com IA"
                >
                  <LayoutGrid className="w-4 h-4 p38-text-accent" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden desktop-layout:inline-flex h-10 flex-shrink-0 gap-1.5 rounded-xl text-xs font-medium border-[#4a5240]/30 dark:border-[#a4ce33]/30"
                  onClick={() => onOpenMassCategory?.()}
                  title="Classificar categorias com IA"
                >
                  <LayoutGrid className="w-3.5 h-3.5 p38-text-accent" />
                  Categorias IA
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn('h-10 w-10 flex-shrink-0', PRODUTOS_ICON_BTN, 'desktop-layout:hidden')}
                  onClick={() => onOpenMassTag?.()}
                  title="Tagificação em massa com IA"
                  aria-label="Tagificação em massa com IA"
                >
                  <Tag className="w-4 h-4 p38-text-accent" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden desktop-layout:inline-flex h-10 flex-shrink-0 gap-1.5 rounded-xl text-xs font-medium border-[#4a5240]/30 dark:border-[#a4ce33]/30"
                  onClick={() => onOpenMassTag?.()}
                  title="Tagificação em massa com IA"
                >
                  <Tag className="w-3.5 h-3.5 p38-text-accent" />
                  Tags IA
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn('h-10 w-10 flex-shrink-0', PRODUTOS_ICON_BTN, 'desktop-layout:hidden')}
                  onClick={() => onOpenMassPrecificacao?.()}
                  title="Ajustar precificação nos produtos do filtro atual"
                  aria-label="Ajustar precificação nos produtos do filtro atual"
                >
                  <SlidersHorizontal className="w-4 h-4 p38-text-accent" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden desktop-layout:inline-flex h-10 flex-shrink-0 gap-1.5 rounded-xl text-xs font-medium border-[#4a5240]/30 dark:border-[#a4ce33]/30"
                  onClick={() => onOpenMassPrecificacao?.()}
                  title="Ajustar precificação nos produtos do filtro atual"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 p38-text-accent" />
                  Precificação
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-10 w-10 flex-shrink-0 rounded-xl relative',
                PRODUTOS_ICON_BTN,
                isFilterOpen && PRODUTOS_FILTER_OPEN,
                activeFilterCount > 0 && 'text-[#f07a1a] dark:text-[#a4ce33]',
              )}
              onClick={() => setIsFilterOpen(v => !v)}
              title="Mais filtros"
            >
              <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
              {activeFilterCount > 0 && (
                <span className={cn('absolute -top-0.5 -right-0.5 w-4 h-4 text-[10px] rounded-full flex items-center justify-center font-bold', PRODUTOS_FILTER_BADGE)}>
                  {activeFilterCount}
                </span>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-10 w-10 flex-shrink-0', PRODUTOS_ICON_BTN)}
              onClick={() => setIsColumnSelectorOpen(true)}
              title="Colunas"
            >
              <Columns className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {isFilterOpen && (
          <div className="hidden desktop-layout:flex desktop-layout:flex-col desktop-layout:gap-3 desktop-layout:pb-1 min-w-0">
            {/* Visualização da árvore */}
            <div className="grid grid-cols-4 gap-2 min-w-0">
              <div className={cn('col-span-2 flex items-center gap-2 px-3 h-9 min-w-0', PRODUTOS_FILTER_PANEL)}>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex-shrink-0">
                  Nível TreeGrid
                </span>
                <LevelControl level={treeLevel} onChange={setTreeLevel} />
              </div>
              <div className={cn('col-span-2 flex items-center gap-2 px-3 h-9 min-w-0', PRODUTOS_FILTER_PANEL)}>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex-shrink-0">
                  Agrupamento
                </span>
                <ProdutosTreeByCategoryToggle
                  checked={groupTreeByCategory}
                  onChange={onGroupTreeByCategoryChange}
                  className="h-9 bg-transparent px-0"
                />
              </div>
              <div className="col-span-4">
                <ProdutosAnaliseAgrupamentoControl
                  filters={filters}
                  setFilters={setFilters}
                  handleFilterChange={handleFilterChange}
                />
              </div>
            </div>

            {/* Cadastro e classificação */}
            <div className="grid grid-cols-4 gap-2 min-w-0">
              <Select value={filters.categoria} onValueChange={v => handleFilterChange('categoria', v)}>
                <SelectTrigger className="bg-card border-0 shadow-sm h-9 text-xs rounded-lg">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent className={PRODUTOS_DROPDOWN_MENU}>
                  <SelectItem value="all" className="text-xs">Todas as categorias</SelectItem>
                  {categorias.map(cat => <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filters.fornecedorId} onValueChange={v => handleFilterChange('fornecedorId', v)}>
                <SelectTrigger className="bg-card border-0 shadow-sm h-9 text-xs rounded-lg">
                  <SelectValue placeholder="Fornecedor" />
                </SelectTrigger>
                <SelectContent className={PRODUTOS_DROPDOWN_MENU}>
                  <SelectItem value="all" className="text-xs">Todos os fornecedores</SelectItem>
                  {fornecedores.map(f => <SelectItem key={f.id} value={f.id} className="text-xs">{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filters.unidadeVitrine || 'all'} onValueChange={(v) => handleFilterChange('unidadeVitrine', v)}>
                <SelectTrigger className="bg-card border-0 shadow-sm h-9 text-xs rounded-lg">
                  <SelectValue placeholder="Unidade vitrine" />
                </SelectTrigger>
                <SelectContent className={PRODUTOS_DROPDOWN_MENU}>
                  <SelectItem value="all" className="text-xs">Todas as unidades</SelectItem>
                  {unidadesVitrine.map((sigla) => (
                    <SelectItem key={sigla} value={sigla} className="text-xs">
                      {sigla}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.statusEstoque} onValueChange={v => handleFilterChange('statusEstoque', v)}>
                <SelectTrigger className="bg-card border-0 shadow-sm h-9 text-xs rounded-lg">
                  <SelectValue placeholder="Status do estoque" />
                </SelectTrigger>
                <SelectContent className={PRODUTOS_DROPDOWN_MENU}>
                  <SelectItem value="all" className="text-xs">Todos os status</SelectItem>
                  <SelectItem value="ok" className="text-xs">OK</SelectItem>
                  <SelectItem value="baixo" className="text-xs">Baixo</SelectItem>
                  <SelectItem value="critico" className="text-xs">Crítico</SelectItem>
                  <SelectItem value="inativo" className="text-xs">Inativo</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.ativoStatus || 'all'} onValueChange={v => handleFilterChange('ativoStatus', v)}>
                <SelectTrigger className="bg-card border-0 shadow-sm h-9 text-xs rounded-lg">
                  <SelectValue placeholder="Ativos/Inativos" />
                </SelectTrigger>
                <SelectContent className={PRODUTOS_DROPDOWN_MENU}>
                  <SelectItem value="all" className="text-xs">Ativos e inativos</SelectItem>
                  <SelectItem value="ativos" className="text-xs">Somente ativos</SelectItem>
                  <SelectItem value="inativos" className="text-xs">Somente inativos</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.cadastroIncompleto} onValueChange={v => handleFilterChange('cadastroIncompleto', v)}>
                <SelectTrigger className="bg-card border-0 shadow-sm h-9 text-xs rounded-lg">
                  <SelectValue placeholder="Cadastro" />
                </SelectTrigger>
                <SelectContent className={PRODUTOS_DROPDOWN_MENU}>
                  <SelectItem value="all" className="text-xs">Todos os cadastros</SelectItem>
                  <SelectItem value="incompleto" className="text-xs">Incompleto</SelectItem>
                  <SelectItem value="completo" className="text-xs">Completo</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.abcd || 'all'} onValueChange={v => handleFilterChange('abcd', v)}>
                <SelectTrigger className="bg-card border-0 shadow-sm h-9 text-xs rounded-lg">
                  <SelectValue placeholder="Curva ABCD" />
                </SelectTrigger>
                <SelectContent className={PRODUTOS_DROPDOWN_MENU}>
                  <SelectItem value="all" className="text-xs">Todas as classes</SelectItem>
                  {ABCD_FILTER_VALUES.map((value) => (
                    <SelectItem key={value} value={value} className="text-xs">
                      {ABCD_FILTER_LABELS[value] || value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Filtrar por tag..."
                className="bg-card border-0 shadow-sm h-9 text-xs rounded-lg"
                value={filters.tag || ''}
                onChange={e => handleFilterChange('tag', e.target.value)}
              />
            </div>

            {/* Filtros numéricos: estoque + duas métricas */}
            <div className={cn(PRODUTOS_FILTER_PANEL, 'p-2.5 space-y-2.5 min-w-0')}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Filtros numéricos
                {filters.estoqueVirtual ? (
                  <span className="ml-2 normal-case font-medium text-sky-700 dark:text-sky-300">
                    · estoque virtual ativo
                  </span>
                ) : null}
                {filters.analisePorAgrupamento ? (
                  <span className="ml-2 normal-case font-medium text-amber-800 dark:text-amber-300">
                    · por agrupamento (nível {filters.analiseAgrupamentoNivel || '2'})
                  </span>
                ) : null}
              </p>
              {filters.analisePorAgrupamento ? (
                <p className="text-[10px] leading-snug text-muted-foreground -mt-1">
                  Quantidade e métricas avaliam o total do grupo na árvore. Na vista plana, aplicam-se só filtros de cadastro e busca.
                </p>
              ) : null}

              <div className="space-y-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-0.5">
                  Quantidade em estoque
                </p>
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <Select
                    value={quantidadeOperador}
                    onValueChange={v => setFilters(prev => ({
                      ...prev,
                      quantidadeOperador: v,
                      quantidadeValorAte: v === 'between' ? prev.quantidadeValorAte : '',
                    }))}
                  >
                    <SelectTrigger className="bg-card border-0 shadow-sm h-9 text-xs rounded-lg min-w-0 flex-1">
                      <SelectValue placeholder="Quantidade" />
                    </SelectTrigger>
                    <SelectContent className={PRODUTOS_DROPDOWN_MENU}>
                      <SelectItem value="all" className="text-xs">Qualquer quantidade</SelectItem>
                      <SelectItem value="gt" className="text-xs">Maior que</SelectItem>
                      <SelectItem value="gte" className="text-xs">Maior ou igual a</SelectItem>
                      <SelectItem value="lt" className="text-xs">Menor que</SelectItem>
                      <SelectItem value="lte" className="text-xs">Menor ou igual a</SelectItem>
                      <SelectItem value="eq" className="text-xs">Igual a</SelectItem>
                      <SelectItem value="between" className="text-xs">Entre</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    inputMode="decimal"
                    placeholder={quantidadeOperador === 'between' ? 'De' : 'Qtd.'}
                    disabled={quantidadeOperador === 'all'}
                    className="bg-card border-0 shadow-sm h-9 text-xs rounded-lg disabled:opacity-50 w-full min-w-[4.5rem] flex-[0.7]"
                    value={filters.quantidadeValor || ''}
                    onChange={e => handleFilterChange('quantidadeValor', e.target.value)}
                  />

                  {quantidadeOperador === 'between' && (
                    <Input
                      inputMode="decimal"
                      placeholder="Até"
                      className="bg-card border-0 shadow-sm h-9 text-xs rounded-lg w-full min-w-[4.5rem] flex-[0.7]"
                      value={filters.quantidadeValorAte || ''}
                      onChange={e => handleFilterChange('quantidadeValorAte', e.target.value)}
                    />
                  )}
                </div>
              </div>

              <ProdutosNumericMetricFilter
                filters={filters}
                setFilters={setFilters}
                handleFilterChange={handleFilterChange}
                sectionLabel="Métrica 1"
                metricSlot={1}
                variant="inline"
              />

              <ProdutosNumericMetricFilter
                filters={filters}
                setFilters={setFilters}
                handleFilterChange={handleFilterChange}
                sectionLabel="Métrica 2 (opcional — combina com a 1)"
                metricSlot={2}
                variant="inline"
              />
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <div className="flex-1 min-w-0">
                <ProdutosSearchStartsWithToggle
                  checked={!!filters.searchStartsWith}
                  onChange={v => handleFilterChange('searchStartsWith', v)}
                  className="h-9 w-full justify-between px-2.5"
                />
              </div>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="h-9 px-2.5 text-xs text-red-500 dark:text-red-400 flex items-center gap-1 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                  Limpar
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {isMobileLayout ? (
        <ProdutosMobileFiltersSheet
          open={isFilterOpen}
          onOpenChange={setIsFilterOpen}
          filters={filters}
          categorias={categorias}
          fornecedores={fornecedores}
          unidadesVitrine={unidadesVitrine}
          activeFilterCount={activeFilterCount}
          handleFilterChange={handleFilterChange}
          setFilters={setFilters}
          treeLevel={treeLevel}
          setTreeLevel={setTreeLevel}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
        />
      ) : null}
    </div>
  );
}

export default memo(ProdutosHeader);
