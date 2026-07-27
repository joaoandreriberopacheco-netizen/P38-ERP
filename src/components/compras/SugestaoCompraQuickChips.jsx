import React from 'react';
import { ArrowDown, ArrowUp, RefreshCw, SlidersHorizontal, TrendingUp, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SUGESTAO_COMPRA_SORT_COLUMNS } from '@/lib/sugestaoCompraColumnSort';
import { SUGESTAO_OPERATIONAL_MODES, SUGESTAO_VIEW_MODES } from '@/lib/sugestaoCompraOperationalMode';
import { cn } from '@/components/utils';

const CHIP_ACTIVE =
  'bg-teal-600 text-white border-teal-600 dark:bg-teal-500 dark:border-teal-500';
const CHIP_IDLE = 'bg-muted/50 text-muted-foreground border-border/30';

export default function SugestaoCompraQuickChips({
  somenteAbaixoPontoFuturo,
  onToggleSomenteAbaixo,
  considerarPedidosAprovadosEstoque,
  onToggleConsiderarPedidos,
  operationalMode = 'livre',
  onOperationalModeChange,
  viewMode = SUGESTAO_VIEW_MODES.familias,
  onViewModeChange,
  columnSort,
  onSortColumn,
  onOpenRelatorio,
  gerandoRelatorio,
  filteredCount = 0,
  activeFilterCount = 0,
  onOpenFilters,
  onRefresh,
  isLoading,
  size = 'sm',
}) {
  const currentColumn = SUGESTAO_COMPRA_SORT_COLUMNS.find((c) => c.id === columnSort.column)
    || SUGESTAO_COMPRA_SORT_COLUMNS[0];
  const SortIcon = columnSort.direction === 'desc' ? ArrowDown : ArrowUp;
  const chipClass = size === 'md'
    ? 'h-9 px-3 rounded-full text-xs font-medium border transition-colors'
    : 'h-8 px-2.5 rounded-full text-[11px] font-medium border transition-colors';

  return (
    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
      <button
        type="button"
        onClick={() => onViewModeChange?.(
          viewMode === SUGESTAO_VIEW_MODES.familias
            ? SUGESTAO_VIEW_MODES.detalhe
            : SUGESTAO_VIEW_MODES.familias,
        )}
        className={cn(
          chipClass,
          viewMode === SUGESTAO_VIEW_MODES.familias ? CHIP_ACTIVE : CHIP_IDLE,
        )}
        title="Famílias nível 2 falam primeiro (ex.: PISO › 45×45)"
      >
        Famílias
      </button>
      <button
        type="button"
        onClick={onToggleSomenteAbaixo}
        className={cn(chipClass, somenteAbaixoPontoFuturo ? CHIP_ACTIVE : CHIP_IDLE)}
      >
        Com ação
      </button>
      <button
        type="button"
        onClick={() => onOperationalModeChange?.(
          operationalMode === SUGESTAO_OPERATIONAL_MODES.radar
            ? SUGESTAO_OPERATIONAL_MODES.livre
            : SUGESTAO_OPERATIONAL_MODES.radar,
        )}
        className={cn(
          chipClass,
          operationalMode === SUGESTAO_OPERATIONAL_MODES.radar ? CHIP_ACTIVE : CHIP_IDLE,
        )}
        title="Macro: hierarquia nível 2 recolhida, scan P.FUT negativo"
      >
        Radar
      </button>
      <button
        type="button"
        onClick={() => onOperationalModeChange?.(
          operationalMode === SUGESTAO_OPERATIONAL_MODES.bisturi
            ? SUGESTAO_OPERATIONAL_MODES.livre
            : SUGESTAO_OPERATIONAL_MODES.bisturi,
        )}
        className={cn(
          chipClass,
          operationalMode === SUGESTAO_OPERATIONAL_MODES.bisturi ? CHIP_ACTIVE : CHIP_IDLE,
        )}
        title="Micro: expandir categorias sinalizadas e caçar P.FUT por SKU"
      >
        Bisturi
      </button>
      <button
        type="button"
        onClick={onToggleConsiderarPedidos}
        className={cn(chipClass, considerarPedidosAprovadosEstoque ? CHIP_ACTIVE : CHIP_IDLE)}
      >
        Incluir pedidos
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-1 font-medium border',
              chipClass,
              'bg-muted/50 text-foreground/85 border-border/30',
            )}
          >
            <TrendingUp className={size === 'md' ? 'w-4 h-4 rotate-90' : 'w-3.5 h-3.5 rotate-90'} />
            {currentColumn.label}
            <SortIcon className={size === 'md' ? 'w-3.5 h-3.5 opacity-70' : 'w-3 h-3 opacity-70'} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[70vh] overflow-y-auto">
          <DropdownMenuLabel className="text-xs">Ordenar por</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {SUGESTAO_COMPRA_SORT_COLUMNS.map((col) => (
            <DropdownMenuItem
              key={col.id}
              onClick={() => onSortColumn(col.id)}
              className={columnSort.column === col.id ? 'font-semibold' : ''}
            >
              {col.label}
              {columnSort.column === col.id
                ? (columnSort.direction === 'desc' ? ' (↓)' : ' (↑)')
                : ''}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        type="button"
        onClick={onOpenRelatorio}
        disabled={gerandoRelatorio || filteredCount === 0}
        className={cn(
          'inline-flex items-center gap-1 font-medium border border-border/30',
          chipClass,
          gerandoRelatorio || filteredCount === 0
            ? 'bg-muted/30 text-muted-foreground/60'
            : 'bg-muted/50 text-muted-foreground',
        )}
      >
        <FileSpreadsheet className={size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
        {gerandoRelatorio ? 'Gerando...' : 'Relatório'}
      </button>
      {onOpenFilters ? (
        <button
          type="button"
          onClick={onOpenFilters}
          className={cn(
            'inline-flex items-center gap-1 font-medium border border-border/30',
            chipClass,
            activeFilterCount > 0
              ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200'
              : 'bg-muted/50 text-muted-foreground',
          )}
        >
          <SlidersHorizontal className={size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
          Filtros
          {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
      ) : null}
      {onRefresh ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'rounded-full bg-muted/50 shrink-0',
            size === 'md' ? 'h-9 w-9' : 'h-8 w-8',
          )}
          onClick={onRefresh}
          disabled={isLoading}
          title="Atualizar"
        >
          <RefreshCw className={cn(
            'text-muted-foreground',
            size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5',
            isLoading && 'animate-spin',
          )}
          />
        </Button>
      ) : null}
    </div>
  );
}
