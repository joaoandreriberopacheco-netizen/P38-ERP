import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { DEFAULT_PRODUTO_FILTERS } from '@/lib/filterProdutos';
import ProdutosEstoqueVirtualToggle from '@/components/produtos/ProdutosEstoqueVirtualToggle';
import ProdutosAnaliseAgrupamentoControl from '@/components/produtos/ProdutosAnaliseAgrupamentoControl';
import { LevelControl } from '@/components/produtos/treegrid/TreeGrid';
import { CATALOG_SORT_OPTIONS } from '@/lib/catalogProdutoPerformance';
import ProdutosNumericMetricFilter from '@/components/produtos/ProdutosNumericMetricFilter';
import ProdutosSearchStartsWithToggle from '@/components/produtos/ProdutosSearchStartsWithToggle';
import { cn } from '@/components/utils';

const STOCK_FILTER_CHIPS = [
  { value: 'all', label: 'Todos' },
  { value: 'ok', label: 'OK' },
  { value: 'baixo', label: 'Baixo' },
  { value: 'critico', label: 'Crítico' },
  { value: 'inativo', label: 'Inativo' },
];

const ATIVO_FILTER_CHIPS = [
  { value: 'all', label: 'Todos' },
  { value: 'ativos', label: 'Ativos' },
  { value: 'inativos', label: 'Inativos' },
];

const CADASTRO_FILTER_CHIPS = [
  { value: 'all', label: 'Todos' },
  { value: 'completo', label: 'Completos' },
  { value: 'incompleto', label: 'Incompletos' },
];

const CHIP_BASE =
  'h-9 rounded-xl text-xs font-medium transition-colors border border-transparent';
const CHIP_ACTIVE =
  'bg-[#4a5240] text-white border-[#4a5240] dark:bg-[#a4ce33] dark:text-[#1f1d22] dark:border-[#a4ce33]';
const CHIP_IDLE = 'bg-muted/80 text-muted-foreground active:bg-muted';

const MOBILE_FILTER_SELECT =
  'bg-muted/80 border-none h-10 text-xs w-full rounded-xl';

function MobileFilterSection({ title, hint, children }) {
  return (
    <section className="space-y-2.5 rounded-2xl border border-border/30 bg-muted/20 p-3">
      <div>
        <h3 className="text-xs font-semibold text-foreground">{title}</h3>
        {hint ? (
          <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ChipGrid({ options, value, onChange, columns = 3 }) {
  return (
    <div
      className={cn('grid gap-1.5', columns === 2 && 'grid-cols-2', columns === 3 && 'grid-cols-3')}
      role="group"
    >
      {options.map(({ value: optionValue, label }) => (
        <button
          key={optionValue}
          type="button"
          onClick={() => onChange(optionValue)}
          aria-pressed={value === optionValue}
          className={cn(CHIP_BASE, value === optionValue ? CHIP_ACTIVE : CHIP_IDLE)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Painel de filtros mobile — folha inferior com secções objetivas (desktop mantém painel inline). */
export default function ProdutosMobileFiltersSheet({
  open,
  onOpenChange,
  filters,
  categorias,
  fornecedores,
  unidadesVitrine = [],
  activeFilterCount,
  handleFilterChange,
  setFilters,
  treeLevel,
  setTreeLevel,
  sortOrder,
  setSortOrder,
}) {
  const quantidadeOperador = filters.quantidadeOperador || 'all';

  const clearFilters = () => {
    setFilters({ ...DEFAULT_PRODUTO_FILTERS });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="desktop-layout:hidden max-h-[88dvh] rounded-t-[28px] border-0 bg-background px-0 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl [&>button]:hidden"
      >
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-muted-foreground/25" />

        <div className="mb-4 flex items-start justify-between gap-3 px-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-muted">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Filtros do catálogo</p>
              <p className="text-[11px] text-muted-foreground">
                {activeFilterCount > 0
                  ? `${activeFilterCount} filtro${activeFilterCount > 1 ? 's' : ''} ativo${activeFilterCount > 1 ? 's' : ''}`
                  : 'Nenhum filtro extra além da busca'}
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-9 w-9 flex-shrink-0 rounded-xl"
            aria-label="Fechar filtros"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-[calc(88dvh-9rem)] space-y-3 overflow-y-auto overscroll-y-contain px-4 pb-2">
          <MobileFilterSection
            title="Estoque virtual"
            hint="Inclui pedidos em trânsito na visualização — ativação com confirmação."
          >
            <div className="flex items-center gap-3">
              <ProdutosEstoqueVirtualToggle filters={filters} setFilters={setFilters} />
              <p className="text-[11px] leading-snug text-muted-foreground">
                {filters.estoqueVirtual
                  ? 'Ligado: estoque e ponto futuro incluem pedidos a caminho.'
                  : 'Desligado: mostra só estoque físico.'}
              </p>
            </div>
          </MobileFilterSection>

          <MobileFilterSection
            title="Visualização da árvore"
            hint="Define quantos níveis abrem ao carregar e como os grupos se ordenam."
          >
            <div className="space-y-3">
              <div className="rounded-xl bg-muted/60 px-3 py-2.5">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Nível inicial
                </p>
                <LevelControl level={treeLevel} onChange={setTreeLevel} />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Ordenação
                </p>
                <Select value={sortOrder || 'az'} onValueChange={setSortOrder}>
                  <SelectTrigger className={MOBILE_FILTER_SELECT}>
                    <SelectValue placeholder="Ordenar catálogo" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-muted dark:border-border/40">
                    {CATALOG_SORT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </MobileFilterSection>

          <MobileFilterSection
            title="Estoque"
            hint="Situação da quantidade em relação ao mínimo."
          >
            <ChipGrid
              options={STOCK_FILTER_CHIPS}
              value={filters.statusEstoque || 'all'}
              onChange={(v) => handleFilterChange('statusEstoque', v)}
              columns={3}
            />
          </MobileFilterSection>

          <MobileFilterSection
            title="Produto"
            hint="Ativo no cadastro e completude dos dados."
          >
            <div className="space-y-3">
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Ativos / inativos
                </p>
                <ChipGrid
                  options={ATIVO_FILTER_CHIPS}
                  value={filters.ativoStatus || 'all'}
                  onChange={(v) => handleFilterChange('ativoStatus', v)}
                  columns={3}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Cadastro
                </p>
                <ChipGrid
                  options={CADASTRO_FILTER_CHIPS}
                  value={filters.cadastroIncompleto || 'all'}
                  onChange={(v) => handleFilterChange('cadastroIncompleto', v)}
                  columns={3}
                />
              </div>
            </div>
          </MobileFilterSection>

          <MobileFilterSection
            title="Origem"
            hint="Categoria de cadastro, fornecedor e unidade de vitrine (exibição no catálogo)."
          >
            <div className="space-y-2">
              <Select value={filters.categoria} onValueChange={(v) => handleFilterChange('categoria', v)}>
                <SelectTrigger className={MOBILE_FILTER_SELECT}>
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent className="dark:bg-muted dark:border-border/40">
                  <SelectItem value="all" className="text-xs">Todas as categorias</SelectItem>
                  {categorias.map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.fornecedorId} onValueChange={(v) => handleFilterChange('fornecedorId', v)}>
                <SelectTrigger className={MOBILE_FILTER_SELECT}>
                  <SelectValue placeholder="Fornecedor" />
                </SelectTrigger>
                <SelectContent className="dark:bg-muted dark:border-border/40">
                  <SelectItem value="all" className="text-xs">Todos os fornecedores</SelectItem>
                  {fornecedores.map((f) => (
                    <SelectItem key={f.id} value={f.id} className="text-xs">{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.unidadeVitrine || 'all'} onValueChange={(v) => handleFilterChange('unidadeVitrine', v)}>
                <SelectTrigger className={MOBILE_FILTER_SELECT}>
                  <SelectValue placeholder="Unidade vitrine" />
                </SelectTrigger>
                <SelectContent className="dark:bg-muted dark:border-border/40">
                  <SelectItem value="all" className="text-xs">Todas as unidades</SelectItem>
                  {unidadesVitrine.map((sigla) => (
                    <SelectItem key={sigla} value={sigla} className="text-xs">
                      {sigla}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </MobileFilterSection>

          <MobileFilterSection title="Tag" hint="Filtra produtos que contenham esta tag.">
            <Input
              placeholder="Ex.: promoção, sazonal…"
              className="bg-muted/80 border-none h-10 text-xs rounded-xl"
              value={filters.tag || ''}
              onChange={(e) => handleFilterChange('tag', e.target.value)}
            />
          </MobileFilterSection>

          <MobileFilterSection
            title="Análise por agrupamento"
            hint="Com este modo, quantidade e métricas avaliam o total do grupo no nível escolhido — não cada SKU."
          >
            <ProdutosAnaliseAgrupamentoControl
              filters={filters}
              setFilters={setFilters}
              handleFilterChange={handleFilterChange}
              compact
            />
          </MobileFilterSection>

          <MobileFilterSection
            title="Filtros numéricos"
            hint={
              filters.analisePorAgrupamento
                ? 'Aplicam-se ao total do grupo na árvore. Na lista plana, só filtros de cadastro e busca.'
                : 'Quantidade em estoque e até duas métricas combináveis (ex.: ponto futuro < 0 e lead time = 20).'
            }
          >
            <div className="space-y-3">
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Quantidade em estoque
                </p>
                <Select
                  value={quantidadeOperador}
                  onValueChange={(v) =>
                    setFilters((prev) => ({
                      ...prev,
                      quantidadeOperador: v,
                      quantidadeValorAte: v === 'between' ? prev.quantidadeValorAte : '',
                    }))
                  }
                >
                  <SelectTrigger className={MOBILE_FILTER_SELECT}>
                    <SelectValue placeholder="Condição" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-muted dark:border-border/40">
                    <SelectItem value="all" className="text-xs">Qualquer quantidade</SelectItem>
                    <SelectItem value="gt" className="text-xs">Maior que</SelectItem>
                    <SelectItem value="gte" className="text-xs">Maior ou igual a</SelectItem>
                    <SelectItem value="lt" className="text-xs">Menor que</SelectItem>
                    <SelectItem value="lte" className="text-xs">Menor ou igual a</SelectItem>
                    <SelectItem value="eq" className="text-xs">Igual a</SelectItem>
                    <SelectItem value="between" className="text-xs">Entre dois valores</SelectItem>
                  </SelectContent>
                </Select>

                <div className={cn('grid gap-2', quantidadeOperador === 'between' ? 'grid-cols-2' : 'grid-cols-1')}>
                  <Input
                    inputMode="decimal"
                    placeholder={quantidadeOperador === 'between' ? 'De' : 'Quantidade'}
                    disabled={quantidadeOperador === 'all'}
                    className="bg-muted/80 border-none h-10 text-xs rounded-xl disabled:opacity-50"
                    value={filters.quantidadeValor || ''}
                    onChange={(e) => handleFilterChange('quantidadeValor', e.target.value)}
                  />
                  {quantidadeOperador === 'between' && (
                    <Input
                      inputMode="decimal"
                      placeholder="Até"
                      className="bg-muted/80 border-none h-10 text-xs rounded-xl"
                      value={filters.quantidadeValorAte || ''}
                      onChange={(e) => handleFilterChange('quantidadeValorAte', e.target.value)}
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
              />

              <ProdutosNumericMetricFilter
                filters={filters}
                setFilters={setFilters}
                handleFilterChange={handleFilterChange}
                sectionLabel="Métrica 2 (opcional)"
                metricSlot={2}
              />
            </div>
          </MobileFilterSection>

          <MobileFilterSection
            title="Busca por texto"
            hint="Quando ligado, cada termo precisa começar o nome ou descrição."
          >
            <ProdutosSearchStartsWithToggle
              checked={!!filters.searchStartsWith}
              onChange={(v) => handleFilterChange('searchStartsWith', v)}
              className="h-10 w-full justify-between px-3"
            />
          </MobileFilterSection>
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-border/30 px-4 pt-3">
          {activeFilterCount > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={clearFilters}
              className="h-10 flex-1 rounded-xl text-xs text-red-600 dark:text-red-400 border-red-200/60 dark:border-red-900/50"
            >
              Limpar filtros
            </Button>
          ) : (
            <div className="flex-1" />
          )}
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-10 flex-1 rounded-xl text-xs bg-[#4a5240] text-white dark:bg-[#a4ce33] dark:text-[#1f1d22]"
          >
            Ver resultados
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
