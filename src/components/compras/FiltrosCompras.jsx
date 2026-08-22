import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  SlidersHorizontal,
  Tag,
  Calendar,
  CalendarClock,
  CalendarCheck,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import MobileDateRangePicker from '@/components/vendas/MobileDateRangePicker';
import { useCompactShell } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';
import { formatarSoData } from '@/components/utils/dateUtils';
import {
  FILTRO_COMPRAS_SOMENTE_NAO_CONCLUIDOS_DEFAULT,
  FILTRO_COMPRAS_ULTIMOS_30_DIAS_DEFAULT,
} from '@/lib/filtroVisibilidadePedidosCompra';
import {
  COMPRAS_FILTRO_STATUS_ALL,
  COMPRAS_FILTRO_STATUS_PEDIDO,
  COMPRAS_FILTRO_STATUS_RECEBIMENTO,
} from '@/lib/comprasEmbarquesPalette';
import {
  COMPRAS_CHIP_ACTIVE_CITRUS,
  COMPRAS_CHIP_ACTIVE_OLIVE,
  COMPRAS_CHIP_IDLE,
  COMPRAS_DIVIDER_TOP,
  COMPRAS_ICON_ACCENT,
  COMPRAS_SEARCH_INPUT,
  COMPRAS_SECTION_CARD,
} from '@/lib/comprasP38Theme';
import { statusPedidoCompraExplicitos } from '@/components/compras/StatusPedidoCompraPicker';

const ETA_FILTRO_MODOS = [
  { value: 'antes', label: 'Antes de' },
  { value: 'depois', label: 'Depois de' },
  { value: 'entre', label: 'Entre' },
  { value: 'personalizado', label: 'Personalizado' },
];

const CHIP_BASE = 'inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-full transition-all font-light uppercase tracking-wide';
const CHIP_IDLE = COMPRAS_CHIP_IDLE;
const CHIP_ACTIVE = 'font-medium shadow-sm';
const SECTION_CARD = COMPRAS_SECTION_CARD;

function QuickFilterToggle({ label, checked, onCheckedChange }) {
  return (
    <button
      type="button"
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] leading-none transition-colors whitespace-nowrap font-light uppercase tracking-wide',
        checked
          ? COMPRAS_CHIP_ACTIVE_CITRUS
          : 'bg-card text-muted-foreground hover:bg-secondary/30 dark:bg-muted/50 dark:hover:bg-muted/80 dark:hover:text-foreground/80',
      )}
      aria-pressed={checked}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full shrink-0',
          checked ? 'bg-[#e8b824] dark:bg-[#a4ce33]' : 'bg-muted-foreground/35',
        )}
        aria-hidden
      />
      {label}
    </button>
  );
}

function FilterSection({ title, icon: Icon, children, className }) {
  return (
    <section className={cn(SECTION_CARD, className)}>
      <div className="flex items-center gap-2">
        {Icon ? <Icon className={cn('h-3.5 w-3.5 shrink-0', COMPRAS_ICON_ACCENT)} /> : null}
        <h3 className="text-[11px] font-light uppercase tracking-wide text-muted-foreground">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function ActiveFilterChip({ label, onRemove, tone = 'neutral' }) {
  const toneClass =
    tone === 'accent'
      ? 'bg-[#e8b824] text-[#242424] dark:bg-[#a4ce33] dark:text-[#1f1d22]'
      : 'bg-card text-foreground/90 shadow-sm';

  return (
    <span className={cn(CHIP_BASE, 'normal-case tracking-normal', toneClass)}>
      <span className="max-w-[180px] truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        aria-label={`Remover filtro ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function formatDateLabel(value) {
  if (!value) return '';
  return formatarSoData(value) || value;
}

function StatusChip({ option, selected, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(option.codigo)}
      className={cn(
        CHIP_BASE,
        selected ? cn(option.chip, CHIP_ACTIVE) : CHIP_IDLE,
      )}
    >
      {selected ? <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" /> : null}
      {option.label}
    </button>
  );
}

function FiltrosComprasPainel({
  statusSel,
  onStatusSel,
  todasTags,
  tagsSel,
  onTagsSel,
  dataInicial,
  onDataInicial,
  dataFinal,
  onDataFinal,
  etaFiltroModo,
  onEtaFiltroModo,
  etaData,
  onEtaData,
  etaInicial,
  onEtaInicial,
  etaFinal,
  onEtaFinal,
  recebimentoInicial,
  onRecebimentoInicial,
  recebimentoFinal,
  onRecebimentoFinal,
  onFiltroSomenteNaoConcluidos,
  searchTag,
  onSearchTag,
  layout = 'drawer',
}) {
  const tagsFiltradas = useMemo(() => {
    const sorted = [...(todasTags || [])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (!searchTag.trim()) return sorted;
    return sorted.filter((t) => t.toLowerCase().includes(searchTag.toLowerCase()));
  }, [todasTags, searchTag]);

  const toggleStatus = (codigo) => {
    if (statusSel.includes(codigo)) {
      onStatusSel(statusSel.filter((s) => s !== codigo));
      return;
    }
    if (codigo === 'Concluído') {
      onStatusSel([...statusSel.filter((s) => s !== '__nao_concluido__'), codigo]);
      return;
    }
    onStatusSel([...statusSel, codigo]);
  };

  const toggleTag = (tag) => {
    if (tagsSel.includes(tag)) {
      onTagsSel(tagsSel.filter((t) => t !== tag));
    } else {
      onTagsSel([...tagsSel, tag]);
    }
  };

  const selecionarModoEta = (modo) => {
    if (etaFiltroModo === modo) {
      onEtaFiltroModo('');
      onEtaData('');
      onEtaInicial('');
      onEtaFinal('');
      return;
    }
    onEtaFiltroModo(modo);
    onEtaData('');
    onEtaInicial('');
    onEtaFinal('');
  };

  const dateFieldClass = 'h-11 text-sm bg-card dark:bg-muted border-0 shadow-sm rounded-xl';

  return (
    <div
      className={cn(
        'space-y-4 font-din-1451',
        layout === 'desktop' && 'grid grid-cols-1 xl:grid-cols-2 gap-4 space-y-0',
      )}
    >
      <FilterSection title="Período do pedido" icon={Calendar} className={layout === 'desktop' ? 'h-full' : undefined}>
        <MobileDateRangePicker
          startDate={dataInicial}
          endDate={dataFinal}
          onApply={(inicio, fim) => {
            onDataInicial(inicio);
            onDataFinal(fim);
          }}
          onClear={() => {
            onDataInicial('');
            onDataFinal('');
          }}
        />
      </FilterSection>

      <FilterSection title="Período da ETA" icon={CalendarClock} className={layout === 'desktop' ? 'h-full' : undefined}>
        <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
          {ETA_FILTRO_MODOS.map((modo) => {
            const selected = etaFiltroModo === modo.value;
            return (
              <button
                key={modo.value}
                type="button"
                onClick={() => selecionarModoEta(modo.value)}
                className={cn(
                  CHIP_BASE,
                  'justify-center px-2.5 sm:px-3 normal-case',
                  selected ? cn(CHIP_ACTIVE, COMPRAS_CHIP_ACTIVE_OLIVE) : CHIP_IDLE,
                )}
              >
                {modo.label}
              </button>
            );
          })}
        </div>

        {(etaFiltroModo === 'antes' || etaFiltroModo === 'depois') && (
          <div>
            <label className="mb-1.5 block text-[11px] font-light text-muted-foreground uppercase tracking-wide">
              {etaFiltroModo === 'antes' ? 'Até a data' : 'A partir da data'}
            </label>
            <Input
              type="date"
              value={etaData}
              onChange={(e) => onEtaData(e.target.value)}
              className={dateFieldClass}
            />
          </div>
        )}

        {etaFiltroModo === 'entre' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1.5 block text-[11px] font-light text-muted-foreground uppercase tracking-wide">De</label>
              <Input
                type="date"
                value={etaInicial}
                onChange={(e) => onEtaInicial(e.target.value)}
                className={dateFieldClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-light text-muted-foreground uppercase tracking-wide">Até</label>
              <Input
                type="date"
                value={etaFinal}
                onChange={(e) => onEtaFinal(e.target.value)}
                className={dateFieldClass}
              />
            </div>
          </div>
        )}

        {etaFiltroModo === 'personalizado' && (
          <MobileDateRangePicker
            startDate={etaInicial}
            endDate={etaFinal}
            onApply={(inicio, fim) => {
              onEtaInicial(inicio);
              onEtaFinal(fim);
            }}
            onClear={() => {
              onEtaInicial('');
              onEtaFinal('');
            }}
          />
        )}
      </FilterSection>

      <FilterSection title="Período de recebimento" icon={CalendarCheck} className={layout === 'desktop' ? 'h-full' : undefined}>
        <p className="text-[10px] font-light text-muted-foreground leading-snug">
          Filtra embarques concluídos pela data em que foram recebidos.
        </p>
        <MobileDateRangePicker
          startDate={recebimentoInicial}
          endDate={recebimentoFinal}
          onApply={(inicio, fim) => {
            onRecebimentoInicial(inicio);
            onRecebimentoFinal(fim);
          }}
          onClear={() => {
            onRecebimentoInicial('');
            onRecebimentoFinal('');
          }}
        />
      </FilterSection>

      <FilterSection
        title="Status do pedido"
        icon={Layers}
        className={layout === 'desktop' ? 'xl:col-span-2' : undefined}
      >
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {COMPRAS_FILTRO_STATUS_PEDIDO.map((option) => (
            <StatusChip
              key={option.codigo}
              option={option}
              selected={statusSel.includes(option.codigo)}
              onToggle={toggleStatus}
            />
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Status do recebimento" icon={Layers} className={layout === 'desktop' ? 'xl:col-span-2' : undefined}>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {COMPRAS_FILTRO_STATUS_RECEBIMENTO.map((option) => (
            <StatusChip
              key={option.codigo}
              option={option}
              selected={statusSel.includes(option.codigo)}
              onToggle={toggleStatus}
            />
          ))}
        </div>
      </FilterSection>

      {(todasTags?.length > 0) && (
        <FilterSection title="Tags" icon={Tag} className={layout === 'desktop' ? 'xl:col-span-2' : undefined}>
          <div className="space-y-2">
            <div className="relative">
              <Tag className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar tag..."
                className="h-10 pl-8 text-xs bg-card dark:bg-muted border-0 shadow-sm rounded-xl"
                value={searchTag}
                onChange={(e) => onSearchTag(e.target.value)}
              />
            </div>
            <div className={cn('overflow-y-auto space-y-0.5 pr-1', layout === 'desktop' ? 'max-h-44' : 'max-h-32')}>
              {tagsFiltradas.map((tag) => (
                <label
                  key={tag}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 hover:bg-muted/50 dark:hover:bg-muted/40"
                >
                  <Checkbox
                    checked={tagsSel.includes(tag)}
                    onCheckedChange={() => toggleTag(tag)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="truncate text-xs font-light text-foreground/90">{tag}</span>
                </label>
              ))}
            </div>
          </div>
        </FilterSection>
      )}
    </div>
  );
}

export default function FiltrosCompras({
  search,
  onSearch,
  filtroUltimos30Dias = FILTRO_COMPRAS_ULTIMOS_30_DIAS_DEFAULT,
  onFiltroUltimos30Dias,
  filtroSomenteNaoConcluidos = FILTRO_COMPRAS_SOMENTE_NAO_CONCLUIDOS_DEFAULT,
  onFiltroSomenteNaoConcluidos,
  statusSel,
  onStatusSel,
  todasTags,
  tagsSel,
  onTagsSel,
  dataInicial,
  onDataInicial,
  dataFinal,
  onDataFinal,
  etaFiltroModo,
  onEtaFiltroModo,
  etaData,
  onEtaData,
  etaInicial,
  onEtaInicial,
  etaFinal,
  onEtaFinal,
  recebimentoInicial,
  onRecebimentoInicial,
  recebimentoFinal,
  onRecebimentoFinal,
  hasActiveFilters,
  onLimparFiltros,
}) {
  const isMobile = useCompactShell();
  const [showFilters, setShowFilters] = useState(false);
  const [searchTag, setSearchTag] = useState('');

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (dataInicial || dataFinal) count += 1;
    if (recebimentoInicial || recebimentoFinal) count += 1;
    if (
      etaFiltroModo &&
      ((['antes', 'depois'].includes(etaFiltroModo) && etaData) ||
        (['entre', 'personalizado'].includes(etaFiltroModo) && (etaInicial || etaFinal)))
    ) {
      count += 1;
    }
    count += statusPedidoCompraExplicitos(statusSel).length;
    count += tagsSel.length;
    return count;
  }, [dataInicial, dataFinal, recebimentoInicial, recebimentoFinal, etaFiltroModo, etaData, etaInicial, etaFinal, statusSel, tagsSel]);

  const activeChips = useMemo(() => {
    const chips = [];

    if (dataInicial || dataFinal) {
      const label = dataInicial && dataFinal
        ? `Pedido: ${formatDateLabel(dataInicial)} – ${formatDateLabel(dataFinal)}`
        : dataInicial
          ? `Pedido desde ${formatDateLabel(dataInicial)}`
          : `Pedido até ${formatDateLabel(dataFinal)}`;
      chips.push({
        key: 'periodo-pedido',
        label,
        tone: 'neutral',
        onRemove: () => {
          onDataInicial('');
          onDataFinal('');
        },
      });
    }

    if (recebimentoInicial || recebimentoFinal) {
      const label = recebimentoInicial && recebimentoFinal
        ? `Recebimento: ${formatDateLabel(recebimentoInicial)} – ${formatDateLabel(recebimentoFinal)}`
        : recebimentoInicial
          ? `Recebimento desde ${formatDateLabel(recebimentoInicial)}`
          : `Recebimento até ${formatDateLabel(recebimentoFinal)}`;
      chips.push({
        key: 'periodo-recebimento',
        label,
        tone: 'accent',
        onRemove: () => {
          onRecebimentoInicial('');
          onRecebimentoFinal('');
        },
      });
    }

    if (etaFiltroModo) {
      let etaLabel = '';
      if (etaFiltroModo === 'antes' && etaData) etaLabel = `ETA até ${formatDateLabel(etaData)}`;
      if (etaFiltroModo === 'depois' && etaData) etaLabel = `ETA desde ${formatDateLabel(etaData)}`;
      if (etaFiltroModo === 'entre' && (etaInicial || etaFinal)) {
        etaLabel = etaInicial && etaFinal
          ? `ETA: ${formatDateLabel(etaInicial)} – ${formatDateLabel(etaFinal)}`
          : etaInicial
            ? `ETA desde ${formatDateLabel(etaInicial)}`
            : `ETA até ${formatDateLabel(etaFinal)}`;
      }
      if (etaFiltroModo === 'personalizado' && (etaInicial || etaFinal)) {
        etaLabel = etaInicial && etaFinal
          ? `ETA: ${formatDateLabel(etaInicial)} – ${formatDateLabel(etaFinal)}`
          : etaInicial
            ? `ETA desde ${formatDateLabel(etaInicial)}`
            : `ETA até ${formatDateLabel(etaFinal)}`;
      }
      if (etaLabel) {
        chips.push({
          key: 'periodo-eta',
          label: etaLabel,
          tone: 'accent',
          onRemove: () => {
            onEtaFiltroModo('');
            onEtaData('');
            onEtaInicial('');
            onEtaFinal('');
          },
        });
      }
    }

    statusPedidoCompraExplicitos(statusSel)
      .forEach((codigo) => {
        const status = COMPRAS_FILTRO_STATUS_ALL.find((s) => s.codigo === codigo);
        chips.push({
          key: `status-${codigo}`,
          label: status?.label || codigo,
          tone: 'neutral',
          onRemove: () => onStatusSel(statusSel.filter((s) => s !== codigo)),
        });
      });

    tagsSel.forEach((tag) => {
      chips.push({
        key: `tag-${tag}`,
        label: tag,
        tone: 'accent',
        onRemove: () => onTagsSel(tagsSel.filter((t) => t !== tag)),
      });
    });

    return chips;
  }, [
    dataInicial,
    dataFinal,
    recebimentoInicial,
    recebimentoFinal,
    etaFiltroModo,
    etaData,
    etaInicial,
    etaFinal,
    statusSel,
    tagsSel,
    onDataInicial,
    onDataFinal,
    onRecebimentoInicial,
    onRecebimentoFinal,
    onEtaFiltroModo,
    onEtaData,
    onEtaInicial,
    onEtaFinal,
    onStatusSel,
    onTagsSel,
  ]);

  const painelProps = {
    statusSel,
    onStatusSel,
    todasTags,
    tagsSel,
    onTagsSel,
    dataInicial,
    onDataInicial,
    dataFinal,
    onDataFinal,
    etaFiltroModo,
    onEtaFiltroModo,
    etaData,
    onEtaData,
    etaInicial,
    onEtaInicial,
    etaFinal,
    onEtaFinal,
    recebimentoInicial,
    onRecebimentoInicial,
    recebimentoFinal,
    onRecebimentoFinal,
    onFiltroSomenteNaoConcluidos,
    searchTag,
    onSearchTag: setSearchTag,
  };

  const limparFiltrosInterno = () => {
    onLimparFiltros();
    setSearchTag('');
  };

  const quickToggles = (
    <div className="flex flex-wrap items-center gap-1.5">
      <QuickFilterToggle
        label="Últimos 30 dias"
        checked={filtroUltimos30Dias}
        onCheckedChange={(next) => onFiltroUltimos30Dias?.(next)}
      />
      <QuickFilterToggle
        label="Não concluídos"
        checked={filtroSomenteNaoConcluidos}
        onCheckedChange={(next) => {
          onFiltroSomenteNaoConcluidos?.(next);
          if (next) {
            onStatusSel(
              statusPedidoCompraExplicitos(statusSel)
                .filter((s) => s !== 'Concluído')
                .concat('__nao_concluido__'),
            );
          } else {
            onStatusSel(statusSel.filter((s) => s !== '__nao_concluido__'));
          }
        }}
      />
    </div>
  );

  const filterToggleButton = (
    <button
      type="button"
      onClick={isMobile ? () => setShowFilters(true) : undefined}
      className={cn(
        'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm transition-all',
        'bg-muted dark:bg-muted text-foreground/90',
        !isMobile && showFilters && 'ring-2 ring-[#e8b824]/28 bg-[#e8b824]/8 dark:bg-[#a4ce33]/10',
      )}
      title="Filtros"
      aria-label="Filtros"
      aria-expanded={showFilters}
    >
      <SlidersHorizontal className="h-5 w-5" />
      {hasActiveFilters && (
        <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#e8b824] px-1 text-[10px] font-semibold leading-none text-[#242424] dark:bg-[#a4ce33] dark:text-[#1f1d22]">
          {activeFilterCount > 9 ? '9+' : activeFilterCount}
        </span>
      )}
    </button>
  );

  const searchBar = (
    <div className="relative min-w-0 flex-1">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        autoComplete="off"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Buscar pedido, embarque, fornecedor..."
        className={COMPRAS_SEARCH_INPUT}
      />
      {search ? (
        <button
          type="button"
          onClick={() => onSearch('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Limpar busca"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );

  if (isMobile) {
    return (
      <div className="space-y-2.5 min-w-0">
        <div className="flex gap-2.5 min-w-0">
          {searchBar}
          {filterToggleButton}
        </div>

        {quickToggles}

        {activeChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activeChips.map((chip) => (
              <ActiveFilterChip key={chip.key} label={chip.label} tone={chip.tone} onRemove={chip.onRemove} />
            ))}
            <button
              type="button"
              onClick={limparFiltrosInterno}
              className="text-xs font-light text-muted-foreground underline-offset-2 hover:underline px-1"
            >
              Limpar tudo
            </button>
          </div>
        )}

        <Drawer open={showFilters} onOpenChange={setShowFilters}>
          <DrawerContent className="max-h-[92vh] border-0 rounded-t-[28px] bg-card px-4 pb-0 dark:bg-card">
            <DrawerHeader className="px-0 pb-1 text-left shrink-0">
              <DrawerTitle className="font-glacial font-light uppercase tracking-wide text-foreground">Filtros</DrawerTitle>
              {activeFilterCount > 0 ? (
                <p className="text-xs font-light text-muted-foreground">{activeFilterCount} filtro(s) ativo(s)</p>
              ) : null}
            </DrawerHeader>

            <div className="overflow-y-auto pb-4 -mx-1 px-1 max-h-[calc(92vh-9rem)]">
              <FiltrosComprasPainel {...painelProps} layout="drawer" />
            </div>

            <div className={cn('sticky bottom-0 -mx-4 bg-card/95 px-4 py-3 backdrop-blur-sm dark:bg-card/95', COMPRAS_DIVIDER_TOP)}>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={limparFiltrosInterno}
                  className="h-11 flex-1 rounded-2xl bg-card text-sm font-light text-muted-foreground shadow-sm dark:bg-muted"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className="h-11 flex-1 rounded-2xl bg-[#e8b824] text-sm font-light text-[#242424] dark:bg-[#a4ce33] dark:text-[#1f1d22]"
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

  return (
    <Collapsible open={showFilters} onOpenChange={setShowFilters} className="space-y-2.5 min-w-0">
      <div className="flex items-center gap-2.5 min-w-0">
        {searchBar}
        <CollapsibleTrigger asChild>
          {filterToggleButton}
        </CollapsibleTrigger>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={limparFiltrosInterno}
            className="hidden lg:inline-flex h-10 items-center gap-1 rounded-xl px-3 text-xs font-light text-muted-foreground hover:bg-muted/60 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Limpar filtros
          </button>
        ) : null}
      </div>

      {quickToggles}

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeChips.map((chip) => (
            <ActiveFilterChip key={chip.key} label={chip.label} tone={chip.tone} onRemove={chip.onRemove} />
          ))}
        </div>
      )}

      <CollapsibleContent>
        <div className={cn(COMPRAS_SECTION_CARD, 'p-4')}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-light uppercase tracking-wide text-foreground">
              <SlidersHorizontal className={cn('h-4 w-4', COMPRAS_ICON_ACCENT)} />
              Filtros avançados
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(false)}
              className="inline-flex items-center gap-1 text-xs font-light text-muted-foreground hover:text-foreground"
            >
              Recolher
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>

          <FiltrosComprasPainel {...painelProps} layout="desktop" />

          <div className={cn('mt-4 flex justify-end gap-2 pt-3', COMPRAS_DIVIDER_TOP)}>
            <button
              type="button"
              onClick={limparFiltrosInterno}
              className="h-10 rounded-xl px-4 text-sm font-light text-muted-foreground hover:bg-muted/60 transition-colors"
            >
              Limpar tudo
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(false)}
              className="h-10 rounded-xl bg-[#e8b824] px-4 text-sm font-light text-[#242424] dark:bg-[#a4ce33] dark:text-[#1f1d22]"
            >
              Fechar painel
            </button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
