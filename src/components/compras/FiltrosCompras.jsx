import React, { useState, useMemo, useRef } from 'react';
import {
  Search,
  X,
  SlidersHorizontal,
  Tag,
  Calendar,
  CalendarClock,
  Layers,
  Building2,
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

const ETA_FILTRO_MODOS = [
  { value: 'antes', label: 'Antes de' },
  { value: 'depois', label: 'Depois de' },
  { value: 'entre', label: 'Entre' },
  { value: 'personalizado', label: 'Personalizado' },
];

const STATUS_OPTIONS = [
  { codigo: '__nao_concluido__', label: 'Somente não concluídos', cor: 'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground' },
  { codigo: 'Rascunho', label: 'Rascunho', cor: 'bg-muted text-foreground/90' },
  { codigo: 'Aguardando Liberação', label: 'Aguardando Liberação', cor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200' },
  { codigo: 'Aguardando Aprovação Financeira', label: 'Aguardando Liberação', cor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200' },
  { codigo: 'Aprovado', label: 'Aprovado', cor: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' },
  { codigo: 'Despachado', label: 'Despachado', cor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200' },
  { codigo: 'Em Trânsito', label: 'Em Trânsito', cor: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' },
  { codigo: 'Pendência', label: 'Pendência', cor: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200' },
  { codigo: 'Devolvido', label: 'Devolvido', cor: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200' },
  { codigo: 'Concluído', label: 'Concluído', cor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
  { codigo: 'Cancelado', label: 'Cancelado', cor: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' },
  { codigo: 'Aguardando Embarque', label: '↳ Ag. Embarque', cor: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-200' },
  { codigo: 'Recebido OK', label: '↳ Recebido OK', cor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
  { codigo: 'Recebido Parcial', label: '↳ Recebido Parcial', cor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
  { codigo: 'Com Divergência', label: '↳ Com Divergência', cor: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200' },
];

const CHIP_BASE = 'inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full transition-all';
const CHIP_IDLE = 'bg-muted/80 dark:bg-muted text-muted-foreground hover:bg-muted';
const CHIP_ACTIVE = 'bg-teal-600 dark:bg-teal-500 text-white font-medium shadow-sm';
const SECTION_CARD = 'rounded-2xl border border-border/40 bg-muted/20 dark:bg-muted/10 p-3.5 space-y-3';

function QuickFilterToggle({ label, checked, onCheckedChange }) {
  return (
    <button
      type="button"
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] leading-none transition-colors whitespace-nowrap',
        checked
          ? 'bg-teal-600/12 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200 font-medium'
          : 'bg-muted/50 text-muted-foreground hover:bg-muted/80 hover:text-foreground/80',
      )}
      aria-pressed={checked}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full shrink-0',
          checked ? 'bg-teal-600 dark:bg-teal-400' : 'bg-muted-foreground/35',
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
        {Icon ? <Icon className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" /> : null}
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function ActiveFilterChip({ label, onRemove, tone = 'neutral' }) {
  const toneClass =
    tone === 'accent'
      ? 'bg-teal-600/90 dark:bg-teal-700 text-white'
      : 'bg-card border border-border/50 text-foreground/90 shadow-sm';

  return (
    <span className={cn(CHIP_BASE, toneClass)}>
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

function FiltrosComprasPainel({
  statusSel,
  onStatusSel,
  fornecedores,
  fornecedorSel,
  onFornecedorSel,
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
  onFiltroSomenteNaoConcluidos,
  searchFornecedor,
  onSearchFornecedor,
  searchTag,
  onSearchTag,
  fornecedorInputRef,
  onKeepInputVisible,
  layout = 'drawer',
}) {
  const tagsFiltradas = useMemo(() => {
    const sorted = [...(todasTags || [])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (!searchTag.trim()) return sorted;
    return sorted.filter((t) => t.toLowerCase().includes(searchTag.toLowerCase()));
  }, [todasTags, searchTag]);

  const fornecedoresFiltrados = useMemo(() => {
    const sorted = [...fornecedores].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    if (!searchFornecedor.trim()) return sorted;
    const lower = searchFornecedor.toLowerCase();
    return sorted.filter((f) => f.nome.toLowerCase().includes(lower));
  }, [fornecedores, searchFornecedor]);

  const toggleStatus = (codigo) => {
    if (statusSel.includes(codigo)) {
      onStatusSel(statusSel.filter((s) => s !== codigo));
      return;
    }
    if (codigo === 'Concluído') {
      onStatusSel([...statusSel.filter((s) => s !== '__nao_concluido__'), codigo]);
      return;
    }
    if (codigo === '__nao_concluido__') {
      const ativar = !statusSel.includes(codigo);
      onFiltroSomenteNaoConcluidos?.(ativar);
      onStatusSel(ativar
        ? statusSel.filter((s) => s !== 'Concluído').concat(codigo)
        : statusSel.filter((s) => s !== codigo));
      return;
    }
    onStatusSel([...statusSel, codigo]);
  };

  const toggleFornecedor = (id) => {
    if (fornecedorSel.includes(id)) {
      onFornecedorSel(fornecedorSel.filter((f) => f !== id));
    } else {
      onFornecedorSel([...fornecedorSel, id]);
    }
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

  const dateFieldClass = 'h-11 text-sm bg-card dark:bg-muted border border-border/30 shadow-sm rounded-xl';

  return (
    <div
      className={cn(
        'space-y-4',
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
                  'justify-center px-2.5 sm:px-3',
                  selected ? CHIP_ACTIVE : CHIP_IDLE,
                )}
              >
                {modo.label}
              </button>
            );
          })}
        </div>

        {(etaFiltroModo === 'antes' || etaFiltroModo === 'depois') && (
          <div>
            <label className="mb-1.5 block text-[11px] text-muted-foreground">
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
              <label className="mb-1.5 block text-[11px] text-muted-foreground">De</label>
              <Input
                type="date"
                value={etaInicial}
                onChange={(e) => onEtaInicial(e.target.value)}
                className={dateFieldClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] text-muted-foreground">Até</label>
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

      <FilterSection
        title="Status"
        icon={Layers}
        className={layout === 'desktop' ? 'xl:col-span-2' : undefined}
      >
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {STATUS_OPTIONS.map((s) => {
            const selected = statusSel.includes(s.codigo);
            return (
              <button
                key={s.codigo}
                type="button"
                onClick={() => toggleStatus(s.codigo)}
                className={cn(
                  CHIP_BASE,
                  selected ? `${s.cor} font-medium shadow-sm` : CHIP_IDLE,
                )}
              >
                {selected ? <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" /> : null}
                {s.label}
              </button>
            );
          })}
        </div>
      </FilterSection>

      {(todasTags?.length > 0) && (
        <FilterSection title="Tags" icon={Tag}>
          <div className="space-y-2">
            <div className="relative">
              <Tag className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar tag..."
                className="h-10 pl-8 text-xs bg-card dark:bg-muted border border-border/30 shadow-sm rounded-xl"
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
                  <span className="truncate text-xs text-foreground/90">{tag}</span>
                </label>
              ))}
            </div>
          </div>
        </FilterSection>
      )}

      {fornecedores.length > 0 && (
        <FilterSection title="Fornecedores" icon={Building2}>
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={fornecedorInputRef}
                placeholder="Buscar fornecedor..."
                className="h-10 pl-8 text-xs bg-card dark:bg-muted border border-border/30 shadow-sm rounded-xl"
                value={searchFornecedor}
                onFocus={() => onKeepInputVisible?.(fornecedorInputRef)}
                onChange={(e) => onSearchFornecedor(e.target.value)}
              />
            </div>
            <div className={cn('overflow-y-auto space-y-0.5 pr-1', layout === 'desktop' ? 'max-h-52' : 'max-h-40')}>
              {fornecedoresFiltrados.map((f) => (
                <label
                  key={f.id}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 hover:bg-muted/50 dark:hover:bg-muted/40"
                >
                  <Checkbox
                    checked={fornecedorSel.includes(f.id)}
                    onCheckedChange={() => toggleFornecedor(f.id)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="truncate text-xs text-foreground/90">{f.nome}</span>
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
  fornecedores,
  fornecedorSel,
  onFornecedorSel,
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
  hasActiveFilters,
  onLimparFiltros,
}) {
  const isMobile = useCompactShell();
  const [showFilters, setShowFilters] = useState(false);
  const [searchFornecedor, setSearchFornecedor] = useState('');
  const [searchTag, setSearchTag] = useState('');
  const fornecedorInputRef = useRef(null);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (dataInicial || dataFinal) count += 1;
    if (
      etaFiltroModo &&
      ((['antes', 'depois'].includes(etaFiltroModo) && etaData) ||
        (['entre', 'personalizado'].includes(etaFiltroModo) && (etaInicial || etaFinal)))
    ) {
      count += 1;
    }
    count += statusSel.filter((s) => s !== '__nao_concluido__').length;
    count += fornecedorSel.length;
    count += tagsSel.length;
    return count;
  }, [dataInicial, dataFinal, etaFiltroModo, etaData, etaInicial, etaFinal, statusSel, fornecedorSel, tagsSel]);

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

    statusSel
      .filter((s) => s !== '__nao_concluido__')
      .forEach((codigo) => {
        const status = STATUS_OPTIONS.find((s) => s.codigo === codigo);
        chips.push({
          key: `status-${codigo}`,
          label: status?.label || codigo,
          tone: 'neutral',
          onRemove: () => onStatusSel(statusSel.filter((s) => s !== codigo)),
        });
      });

    fornecedores
      .filter((f) => fornecedorSel.includes(f.id))
      .forEach((f) => {
        chips.push({
          key: `fornecedor-${f.id}`,
          label: f.nome,
          tone: 'neutral',
          onRemove: () => onFornecedorSel(fornecedorSel.filter((id) => id !== f.id)),
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
    etaFiltroModo,
    etaData,
    etaInicial,
    etaFinal,
    statusSel,
    fornecedores,
    fornecedorSel,
    tagsSel,
    onDataInicial,
    onDataFinal,
    onEtaFiltroModo,
    onEtaData,
    onEtaInicial,
    onEtaFinal,
    onStatusSel,
    onFornecedorSel,
    onTagsSel,
  ]);

  const painelProps = {
    statusSel,
    onStatusSel,
    fornecedores,
    fornecedorSel,
    onFornecedorSel,
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
    onFiltroSomenteNaoConcluidos,
    searchFornecedor,
    onSearchFornecedor: setSearchFornecedor,
    searchTag,
    onSearchTag: setSearchTag,
    fornecedorInputRef,
    onKeepInputVisible: (inputRef) => {
      if (typeof window === 'undefined' || !inputRef?.current) return;
      window.setTimeout(() => {
        inputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 220);
    },
  };

  const limparFiltrosInterno = () => {
    onLimparFiltros();
    setSearchFornecedor('');
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
            onStatusSel(statusSel.filter((s) => s !== 'Concluído').concat('__nao_concluido__'));
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
        !isMobile && showFilters && 'ring-2 ring-teal-500/40 bg-teal-50 dark:bg-teal-950/30',
      )}
      title="Filtros"
      aria-label="Filtros"
      aria-expanded={showFilters}
    >
      <SlidersHorizontal className="h-5 w-5" />
      {hasActiveFilters && (
        <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-semibold leading-none text-white dark:bg-teal-500">
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
        placeholder="Buscar embarque, pedido, fornecedor..."
        className="h-12 w-full rounded-2xl border border-border/30 bg-card pl-10 pr-10 text-sm text-foreground/90 shadow-sm outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-teal-300 dark:bg-muted dark:text-foreground dark:focus:ring-teal-600"
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
      <div className="space-y-2.5">
        <div className="flex gap-2.5">
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
              className="text-xs text-muted-foreground underline-offset-2 hover:underline px-1"
            >
              Limpar tudo
            </button>
          </div>
        )}

        <Drawer open={showFilters} onOpenChange={setShowFilters}>
          <DrawerContent className="max-h-[92vh] border-0 rounded-t-[28px] bg-card px-4 pb-0 dark:bg-card">
            <DrawerHeader className="px-0 pb-1 text-left shrink-0">
              <DrawerTitle className="font-glacial text-foreground">Filtros</DrawerTitle>
              {activeFilterCount > 0 ? (
                <p className="text-xs text-muted-foreground">{activeFilterCount} filtro(s) ativo(s)</p>
              ) : null}
            </DrawerHeader>

            <div className="overflow-y-auto pb-4 -mx-1 px-1 max-h-[calc(92vh-9rem)]">
              <FiltrosComprasPainel {...painelProps} layout="drawer" />
            </div>

            <div className="sticky bottom-0 -mx-4 border-t border-border/40 bg-card/95 px-4 py-3 backdrop-blur-sm dark:bg-card/95">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={limparFiltrosInterno}
                  className="h-11 flex-1 rounded-2xl bg-muted text-sm text-muted-foreground dark:bg-muted"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className="h-11 flex-1 rounded-2xl bg-teal-600 text-sm text-white dark:bg-teal-500"
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
    <Collapsible open={showFilters} onOpenChange={setShowFilters} className="space-y-2.5">
      <div className="flex items-center gap-2.5">
        {searchBar}
        <CollapsibleTrigger asChild>
          {filterToggleButton}
        </CollapsibleTrigger>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={limparFiltrosInterno}
            className="hidden lg:inline-flex h-10 items-center gap-1 rounded-xl px-3 text-xs text-muted-foreground hover:bg-muted/60 transition-colors"
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
        <div className="rounded-2xl border border-border/40 bg-card/80 p-4 shadow-sm dark:bg-card/60">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <SlidersHorizontal className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              Filtros avançados
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(false)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Recolher
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>

          <FiltrosComprasPainel {...painelProps} layout="desktop" />

          <div className="mt-4 flex justify-end gap-2 border-t border-border/30 pt-3">
            <button
              type="button"
              onClick={limparFiltrosInterno}
              className="h-10 rounded-xl px-4 text-sm text-muted-foreground hover:bg-muted/60 transition-colors"
            >
              Limpar tudo
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(false)}
              className="h-10 rounded-xl bg-teal-600 px-4 text-sm text-white dark:bg-teal-500"
            >
              Fechar painel
            </button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
