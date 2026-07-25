import React, { useMemo, useState } from 'react';
import {
  Search,
  X,
  SlidersHorizontal,
  Package,
  FilterX,
  Tag,
  Layers,
  Building2,
  BarChart3,
  Boxes,
} from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import SearchableFilterSelect from '@/components/compras/SearchableFilterSelect';
import ProdutosSearchStartsWithToggle from '@/components/produtos/ProdutosSearchStartsWithToggle';
import { ABCD_FILTER_VALUES, ABCD_FILTER_LABELS } from '@/lib/filterProdutos';
import {
  DEFAULT_SUGESTAO_COMPRA_FILTERS,
  SUGESTAO_STATUS_ESTOQUE_OPTIONS,
  SUGESTAO_HIERARQUIA_NIVEL_OPTIONS,
  countActiveSugestaoCompraFilters,
} from '@/lib/filterSugestaoCompraLinhas';
import { cn } from '@/lib/utils';

const SECTION_CARD = 'rounded-2xl border border-border/40 bg-muted/20 dark:bg-muted/10 p-3.5 space-y-3';
const SECTION_CARD_COMPACT = 'rounded-xl border border-border/40 bg-muted/20 dark:bg-muted/10 p-2.5 space-y-2';
const CONTROL_H = 'h-11';
const CONTROL_H_COMPACT = 'h-10';

const CHIP_BASE =
  'h-9 min-w-[2.25rem] px-2.5 rounded-xl text-xs font-semibold transition-colors border';
const CHIP_ACTIVE =
  'bg-teal-600 text-white border-teal-600 dark:bg-teal-500 dark:border-teal-500';
const CHIP_IDLE =
  'bg-card text-muted-foreground border-border/30 hover:bg-muted/50';

function FilterSection({ title, icon: Icon, children, compact = false }) {
  return (
    <section className={compact ? SECTION_CARD_COMPACT : SECTION_CARD}>
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" /> : null}
        <h3 className={cn(
          'font-semibold uppercase tracking-wide text-muted-foreground',
          compact ? 'text-[10px]' : 'text-[11px]',
        )}
        >
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

function ActiveFilterChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-teal-600/90 dark:bg-teal-700 text-white">
      <span className="max-w-[180px] truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-black/10 transition-colors"
        aria-label={`Remover filtro ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function ChipGrid({ options, value, onChange, columns = 3 }) {
  return (
    <div
      className={cn('grid gap-1.5', columns === 2 && 'grid-cols-2', columns === 4 && 'grid-cols-4', columns === 3 && 'grid-cols-3')}
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

function AbcdMultiSelect({ selectedAbcd, onSelectedAbcd, compact = false }) {
  const toggle = (letter) => {
    if (selectedAbcd.includes(letter)) {
      onSelectedAbcd(selectedAbcd.filter((v) => v !== letter));
    } else {
      onSelectedAbcd([...selectedAbcd, letter]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Curva ABCDE">
        {ABCD_FILTER_VALUES.map((letter) => {
          const active = selectedAbcd.includes(letter);
          return (
            <button
              key={letter}
              type="button"
              onClick={() => toggle(letter)}
              aria-pressed={active}
              title={ABCD_FILTER_LABELS[letter] || `Classe ${letter}`}
              className={cn(CHIP_BASE, 'h-10 min-w-[2.5rem]', active ? CHIP_ACTIVE : CHIP_IDLE)}
            >
              {letter}
            </button>
          );
        })}
      </div>
      {!compact ? (
        <p className="text-[11px] text-muted-foreground leading-snug">
          {selectedAbcd.length === 0
            ? 'Nenhuma selecionada — mostra todas as curvas.'
            : `Mostrando curvas ${selectedAbcd.join(', ')}.`}
        </p>
      ) : null}
    </div>
  );
}

function FiltrosPainel({
  filters,
  patchFilters,
  categorias,
  fornecedores,
  allTags,
  unidadesVitrine,
  tagSearch,
  onTagSearch,
  compact = false,
}) {
  const quantidadeOperador = filters.quantidadeOperador || 'all';
  const controlH = compact ? CONTROL_H_COMPACT : CONTROL_H;

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <FilterSection title="Busca" icon={Search} compact={compact}>
        <ProdutosSearchStartsWithToggle
          checked={!!filters.searchStartsWith}
          onChange={(checked) => patchFilters({ searchStartsWith: checked })}
          className={cn('w-full justify-between px-3', compact && 'h-10')}
        />
        {!compact ? (
          <p className="text-[11px] text-muted-foreground leading-snug">
            Igual ao catálogo: termos com prefixo XX filtram área/categoria de cadastro na busca.
          </p>
        ) : null}
      </FilterSection>

      <FilterSection title="Curva ABCDE" icon={BarChart3} compact={compact}>
        <AbcdMultiSelect
          selectedAbcd={filters.selectedAbcd || []}
          onSelectedAbcd={(selectedAbcd) => patchFilters({ selectedAbcd })}
          compact={compact}
        />
      </FilterSection>

      <FilterSection title="Categoria" icon={Layers} compact={compact}>
        <SearchableFilterSelect
          value={filters.categoriaId}
          onChange={(categoriaId) => patchFilters({ categoriaId })}
          placeholder="Todas Categorias"
          searchPlaceholder="Buscar categoria..."
          options={[
            { value: 'all', label: 'Todas Categorias' },
            ...categorias.map((c) => ({ value: c.id, label: c.nome })),
          ]}
        />
      </FilterSection>

      <FilterSection title="Nível hierárquico" icon={Layers} compact={compact}>
        <ChipGrid
          options={SUGESTAO_HIERARQUIA_NIVEL_OPTIONS}
          value={filters.hierarquiaNivel || 'all'}
          onChange={(hierarquiaNivel) => patchFilters({ hierarquiaNivel })}
          columns={2}
        />
        {!compact ? (
          <p className="text-[11px] text-muted-foreground leading-snug">
            Filtra itens com o nível escolhido preenchido no cadastro (h1 a h5).
          </p>
        ) : null}
      </FilterSection>

      <FilterSection title="Fornecedor" icon={Building2} compact={compact}>
        <SearchableFilterSelect
          value={filters.fornecedorId}
          onChange={(fornecedorId) => patchFilters({ fornecedorId })}
          placeholder="Todos Fornecedores"
          searchPlaceholder="Buscar fornecedor..."
          options={[
            { value: 'all', label: 'Todos Fornecedores' },
            ...fornecedores.map((f) => ({ value: f.id, label: f.nome })),
          ]}
        />
      </FilterSection>

      <FilterSection title="Unidade vitrine" icon={Boxes} compact={compact}>
        <Select
          value={filters.unidadeVitrine || 'all'}
          onValueChange={(unidadeVitrine) => patchFilters({ unidadeVitrine })}
        >
          <SelectTrigger className={cn('bg-card border border-border/30 rounded-xl', controlH)}>
            <SelectValue placeholder="Todas as unidades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as unidades</SelectItem>
            {unidadesVitrine.map((sigla) => (
              <SelectItem key={sigla} value={sigla}>
                {sigla}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterSection>

      <FilterSection title="Ponto futuro (giro)" icon={Boxes} compact={compact}>
        <button
          type="button"
          onClick={() =>
            patchFilters({ somenteAbaixoPontoFuturo: !filters.somenteAbaixoPontoFuturo })
          }
          className={cn(
            'w-full rounded-xl text-sm flex items-center justify-center gap-2 transition-colors',
            controlH,
            filters.somenteAbaixoPontoFuturo === true
              ? 'bg-teal-600/12 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted/80',
          )}
        >
          {filters.somenteAbaixoPontoFuturo === true
            ? 'Somente abaixo do ponto futuro'
            : 'Catálogo completo'}
        </button>
        {!compact ? (
          <p className="text-[11px] text-muted-foreground leading-snug font-mono">
            Ponto futuro = estoque atual − média 30d
          </p>
        ) : null}
      </FilterSection>

      <FilterSection title="Status de estoque" icon={Boxes} compact={compact}>
        <ChipGrid
          options={SUGESTAO_STATUS_ESTOQUE_OPTIONS}
          value={filters.statusEstoque || 'all'}
          onChange={(statusEstoque) => patchFilters({ statusEstoque })}
          columns={4}
        />
      </FilterSection>

      <FilterSection title="Quantidade em estoque" icon={Boxes} compact={compact}>
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={quantidadeOperador}
            onValueChange={(quantidadeOperador) =>
              patchFilters({
                quantidadeOperador,
                quantidadeValorAte: quantidadeOperador === 'between' ? filters.quantidadeValorAte : '',
              })
            }
          >
            <SelectTrigger className={cn('bg-card border border-border/30 rounded-xl col-span-2', controlH)}>
              <SelectValue placeholder="Qualquer quantidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer quantidade</SelectItem>
              <SelectItem value="gt">Maior que</SelectItem>
              <SelectItem value="gte">Maior ou igual a</SelectItem>
              <SelectItem value="lt">Menor que</SelectItem>
              <SelectItem value="lte">Menor ou igual a</SelectItem>
              <SelectItem value="between">Entre</SelectItem>
            </SelectContent>
          </Select>
          <Input
            inputMode="decimal"
            placeholder={quantidadeOperador === 'between' ? 'De' : 'Qtd.'}
            disabled={quantidadeOperador === 'all'}
            className={cn('bg-card border border-border/30 rounded-xl disabled:opacity-50', controlH)}
            value={filters.quantidadeValor || ''}
            onChange={(e) => patchFilters({ quantidadeValor: e.target.value })}
          />
          {quantidadeOperador === 'between' ? (
            <Input
              inputMode="decimal"
              placeholder="Até"
              className={cn('bg-card border border-border/30 rounded-xl', controlH)}
              value={filters.quantidadeValorAte || ''}
              onChange={(e) => patchFilters({ quantidadeValorAte: e.target.value })}
            />
          ) : null}
        </div>
      </FilterSection>

      <FilterSection title="Quantidade sugerida" icon={Boxes} compact={compact}>
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={filters.sugestaoQuantidadeOperador || 'all'}
            onValueChange={(sugestaoQuantidadeOperador) =>
              patchFilters({
                sugestaoQuantidadeOperador,
                sugestaoQuantidadeValorAte:
                  sugestaoQuantidadeOperador === 'between' ? filters.sugestaoQuantidadeValorAte : '',
              })
            }
          >
            <SelectTrigger className={cn('bg-card border border-border/30 rounded-xl col-span-2', controlH)}>
              <SelectValue placeholder="Qualquer sugestão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer sugestão</SelectItem>
              <SelectItem value="gt">Maior que</SelectItem>
              <SelectItem value="gte">Maior ou igual a</SelectItem>
              <SelectItem value="lt">Menor que</SelectItem>
              <SelectItem value="lte">Menor ou igual a</SelectItem>
              <SelectItem value="between">Entre</SelectItem>
            </SelectContent>
          </Select>
          <Input
            inputMode="decimal"
            placeholder={filters.sugestaoQuantidadeOperador === 'between' ? 'De' : 'Qtd.'}
            disabled={(filters.sugestaoQuantidadeOperador || 'all') === 'all'}
            className={cn('bg-card border border-border/30 rounded-xl disabled:opacity-50', controlH)}
            value={filters.sugestaoQuantidadeValor || ''}
            onChange={(e) => patchFilters({ sugestaoQuantidadeValor: e.target.value })}
          />
          {filters.sugestaoQuantidadeOperador === 'between' ? (
            <Input
              inputMode="decimal"
              placeholder="Até"
              className={cn('bg-card border border-border/30 rounded-xl', controlH)}
              value={filters.sugestaoQuantidadeValorAte || ''}
              onChange={(e) => patchFilters({ sugestaoQuantidadeValorAte: e.target.value })}
            />
          ) : null}
        </div>
      </FilterSection>

      <FilterSection title="Tags" icon={Tag} compact={compact}>
        {(filters.selectedTags || []).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {filters.selectedTags.map((tag) => (
              <ActiveFilterChip
                key={tag}
                label={tag}
                onRemove={() =>
                  patchFilters({
                    selectedTags: filters.selectedTags.filter((t) => t !== tag),
                  })
                }
              />
            ))}
          </div>
        )}
        <div className="relative">
          <Input
            placeholder="Buscar tag..."
            value={tagSearch}
            onChange={(e) => onTagSearch(e.target.value)}
            className={cn('bg-card border border-border/30 rounded-xl', controlH)}
          />
          {tagSearch && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card rounded-xl shadow-lg border border-border/40 max-h-40 overflow-y-auto z-10">
              {allTags
                .filter(
                  (t) =>
                    t.toLowerCase().includes(tagSearch.toLowerCase()) &&
                    !(filters.selectedTags || []).includes(t),
                )
                .slice(0, 10)
                .map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      patchFilters({ selectedTags: [...(filters.selectedTags || []), tag] });
                      onTagSearch('');
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-muted/40 text-sm"
                  >
                    {tag}
                  </button>
                ))}
            </div>
          )}
        </div>
      </FilterSection>

      <FilterSection title="Embalagem" icon={Package} compact={compact}>
        <Select
          value={filters.roundingMode}
          onValueChange={(roundingMode) => patchFilters({ roundingMode })}
        >
          <SelectTrigger className={cn('bg-card border border-border/30 rounded-xl', controlH)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Automático (mais próximo)</SelectItem>
            <SelectItem value="up">Arredondar para cima</SelectItem>
            <SelectItem value="down">Arredondar para baixo</SelectItem>
            <SelectItem value="none">Quantidade exata</SelectItem>
          </SelectContent>
        </Select>
      </FilterSection>

      <FilterSection title="Hierarquia" icon={Layers} compact={compact}>
        <button
          type="button"
          onClick={() => patchFilters({ agruparHierarquia: !filters.agruparHierarquia })}
          className={cn(
            'w-full rounded-xl text-sm flex items-center justify-center gap-2 transition-colors',
            controlH,
            filters.agruparHierarquia
              ? 'bg-teal-600/12 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted/80',
          )}
        >
          <Layers className="h-4 w-4" />
          {filters.agruparHierarquia ? 'Agrupar famílias (h1–h4)' : 'Listar por SKU'}
        </button>
        {!compact ? (
          <p className="text-[11px] text-muted-foreground leading-snug">
            Famílias com 2+ modelos aparecem numa linha (ex.: piso 45×45 sem escolher marca).
          </p>
        ) : null}
      </FilterSection>

      <button
        type="button"
        onClick={() => patchFilters({ hidePending: !filters.hidePending })}
        className={cn(
          'w-full rounded-xl text-sm flex items-center justify-center gap-2 transition-colors',
          controlH,
          filters.hidePending
            ? 'bg-teal-600/12 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200'
            : 'bg-muted/50 text-muted-foreground hover:bg-muted/80',
        )}
      >
        <FilterX className="h-4 w-4" />
        {filters.hidePending ? 'Mostrar itens em trânsito' : 'Ocultar itens em trânsito'}
      </button>
    </div>
  );
}

/** Busca + filtros alinhados ao catálogo de produtos (no que couber). */
export default function FiltrosSugestaoCompra({
  filters,
  onFiltersChange,
  categorias,
  fornecedores,
  allTags,
  unidadesVitrine = [],
  onLimparFiltros,
  drawerOpen,
  onDrawerOpenChange,
}) {
  const [showFiltersInternal, setShowFiltersInternal] = useState(false);
  const showFilters = drawerOpen ?? showFiltersInternal;
  const setShowFilters = onDrawerOpenChange ?? setShowFiltersInternal;
  const [tagSearch, setTagSearch] = useState('');

  const patchFilters = (patch) => onFiltersChange({ ...filters, ...patch });
  const activeFilterCount = countActiveSugestaoCompraFilters(filters);

  const activeChips = useMemo(() => {
    const chips = [];
    if (filters.searchStartsWith) {
      chips.push({
        key: 'starts',
        label: 'Começa com',
        onRemove: () => patchFilters({ searchStartsWith: false }),
      });
    }
    if (filters.categoriaId !== 'all') {
      const cat = categorias.find((c) => c.id === filters.categoriaId);
      chips.push({
        key: 'cat',
        label: cat?.nome || 'Categoria',
        onRemove: () => patchFilters({ categoriaId: 'all' }),
      });
    }
    if (filters.hierarquiaNivel !== 'all') {
      const nivel = SUGESTAO_HIERARQUIA_NIVEL_OPTIONS.find((o) => o.value === filters.hierarquiaNivel);
      chips.push({
        key: 'nivel',
        label: nivel?.label || `Nível ${filters.hierarquiaNivel}`,
        onRemove: () => patchFilters({ hierarquiaNivel: 'all' }),
      });
    }
    if (filters.fornecedorId !== 'all') {
      const f = fornecedores.find((x) => x.id === filters.fornecedorId);
      chips.push({
        key: 'sup',
        label: f?.nome || 'Fornecedor',
        onRemove: () => patchFilters({ fornecedorId: 'all' }),
      });
    }
    if (filters.unidadeVitrine !== 'all') {
      chips.push({
        key: 'vitrine',
        label: `Vitrine ${filters.unidadeVitrine}`,
        onRemove: () => patchFilters({ unidadeVitrine: 'all' }),
      });
    }
    if (filters.statusEstoque !== 'all') {
      const status = SUGESTAO_STATUS_ESTOQUE_OPTIONS.find((o) => o.value === filters.statusEstoque);
      chips.push({
        key: 'status',
        label: `Estoque ${status?.label || filters.statusEstoque}`,
        onRemove: () => patchFilters({ statusEstoque: 'all' }),
      });
    }
    if (filters.quantidadeOperador !== 'all') {
      chips.push({
        key: 'qty',
        label: `Estoque ${filters.quantidadeOperador}`,
        onRemove: () =>
          patchFilters({ quantidadeOperador: 'all', quantidadeValor: '', quantidadeValorAte: '' }),
      });
    }
    if (filters.sugestaoQuantidadeOperador !== 'all') {
      chips.push({
        key: 'sug-qty',
        label: `Sugestão ${filters.sugestaoQuantidadeOperador}`,
        onRemove: () =>
          patchFilters({
            sugestaoQuantidadeOperador: 'all',
            sugestaoQuantidadeValor: '',
            sugestaoQuantidadeValorAte: '',
          }),
      });
    }
    (filters.selectedAbcd || []).forEach((letter) => {
      chips.push({
        key: `abcd-${letter}`,
        label: `Curva ${letter}`,
        onRemove: () =>
          patchFilters({
            selectedAbcd: filters.selectedAbcd.filter((v) => v !== letter),
          }),
      });
    });
    (filters.selectedTags || []).forEach((tag) => {
      chips.push({
        key: `tag-${tag}`,
        label: tag,
        onRemove: () =>
          patchFilters({
            selectedTags: filters.selectedTags.filter((t) => t !== tag),
          }),
      });
    });
    if (filters.somenteAbaixoPontoFuturo === true) {
      chips.push({
        key: 'ponto',
        label: 'Abaixo do ponto futuro',
        onRemove: () => patchFilters({ somenteAbaixoPontoFuturo: false }),
      });
    }
    if (filters.considerarPedidosAprovadosEstoque === true) {
      chips.push({
        key: 'pedidos-aprovados-estoque',
        label: 'INCLUIR PEDIDOS',
        onRemove: () => patchFilters({ considerarPedidosAprovadosEstoque: false }),
      });
    }
    if (filters.hidePending) {
      chips.push({
        key: 'pending',
        label: 'Sem em trânsito',
        onRemove: () => patchFilters({ hidePending: false }),
      });
    }
    if (filters.roundingMode !== 'auto') {
      chips.push({
        key: 'round',
        label: `Arredondamento: ${filters.roundingMode}`,
        onRemove: () => patchFilters({ roundingMode: 'auto' }),
      });
    }
    if (!filters.agruparHierarquia) {
      chips.push({
        key: 'sku',
        label: 'Por SKU',
        onRemove: () => patchFilters({ agruparHierarquia: true }),
      });
    }
    return chips;
  }, [filters, categorias, fornecedores, onFiltersChange]);

  const limpar = () => {
    onLimparFiltros();
    setTagSearch('');
  };

  const painelProps = {
    filters,
    patchFilters,
    categorias,
    fornecedores,
    allTags,
    unidadesVitrine,
    tagSearch,
    onTagSearch: setTagSearch,
  };

  return (
    <div className="space-y-2.5">
      <div className="flex gap-2.5">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoComplete="off"
            value={filters.searchTerm}
            onChange={(e) => patchFilters({ searchTerm: e.target.value })}
            placeholder="Buscar produto..."
            className="h-12 w-full rounded-2xl border border-border/30 bg-card pl-10 pr-10 text-sm text-foreground/90 shadow-sm outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-teal-300 dark:bg-muted dark:text-foreground dark:focus:ring-teal-600"
          />
          {filters.searchTerm ? (
            <button
              type="button"
              onClick={() => patchFilters({ searchTerm: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setShowFilters(true)}
          className={cn(
            'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm transition-all',
            'bg-muted dark:bg-muted text-foreground/90',
            activeFilterCount > 0 && 'ring-2 ring-teal-500/40 bg-teal-50 dark:bg-teal-950/30',
          )}
          title="Filtros"
          aria-label="Filtros"
        >
          <SlidersHorizontal className="h-5 w-5" />
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-semibold leading-none text-white dark:bg-teal-500">
              {activeFilterCount > 9 ? '9+' : activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeChips.map((chip) => (
            <ActiveFilterChip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
          ))}
          <button
            type="button"
            onClick={limpar}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline px-1"
          >
            Limpar tudo
          </button>
        </div>
      )}

      <Drawer open={showFilters} onOpenChange={setShowFilters}>
        <DrawerContent className="max-h-[88dvh] flex flex-col border-0 rounded-t-[28px] bg-card px-4 pb-0 dark:bg-card md:mx-auto md:max-w-lg [&>div:first-child]:mt-2">
          <DrawerHeader className="shrink-0 px-0 pt-0 pb-1 text-left">
            <DrawerTitle className="font-glacial text-base text-foreground">Filtros</DrawerTitle>
            {activeFilterCount > 0 ? (
              <p className="text-xs text-muted-foreground">{activeFilterCount} filtro(s) ativo(s)</p>
            ) : null}
          </DrawerHeader>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain pb-2 -mx-1 px-1">
            <FiltrosPainel {...painelProps} compact />
          </div>
          <div className="shrink-0 -mx-4 border-t border-border/40 bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:bg-card">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={limpar}
                className="h-10 flex-1 rounded-2xl bg-muted text-sm text-muted-foreground"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="h-10 flex-1 rounded-2xl bg-teal-600 text-sm text-white dark:bg-teal-500"
              >
                Aplicar
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export { DEFAULT_SUGESTAO_COMPRA_FILTERS };
