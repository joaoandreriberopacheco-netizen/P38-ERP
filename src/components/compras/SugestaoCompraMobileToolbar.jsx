import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import SugestaoCompraQuickChips from '@/components/compras/SugestaoCompraQuickChips';

export default function SugestaoCompraMobileToolbar({
  filteredCount,
  selectedCount,
  allSelected,
  onSelectAll,
  columnSort,
  onSortColumn,
  activeFilterCount,
  onOpenFilters,
  somenteAbaixoPontoFuturo,
  onToggleSomenteAbaixo,
  onOpenRelatorio,
  gerandoRelatorio,
  considerarPedidosAprovadosEstoque,
  onToggleConsiderarPedidos,
  viewMode,
  onViewModeChange,
  onRefresh,
  isLoading,
}) {
  return (
    <div className="shrink-0 space-y-2 px-2.5 pt-1 pb-2 w-full min-w-0 max-w-full overflow-hidden bg-background">
      <SugestaoCompraQuickChips
        somenteAbaixoPontoFuturo={somenteAbaixoPontoFuturo}
        onToggleSomenteAbaixo={onToggleSomenteAbaixo}
        considerarPedidosAprovadosEstoque={considerarPedidosAprovadosEstoque}
        onToggleConsiderarPedidos={onToggleConsiderarPedidos}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        columnSort={columnSort}
        onSortColumn={onSortColumn}
        onOpenRelatorio={onOpenRelatorio}
        gerandoRelatorio={gerandoRelatorio}
        filteredCount={filteredCount}
        activeFilterCount={activeFilterCount}
        onOpenFilters={onOpenFilters}
        onRefresh={onRefresh}
        isLoading={isLoading}
        size="sm"
      />

      <label className="inline-flex items-center gap-2 min-h-[32px] text-[11px] text-muted-foreground cursor-pointer">
        <Checkbox checked={allSelected} onCheckedChange={onSelectAll} className="h-4 w-4" />
        <span>
          Selecionar {filteredCount}
          {selectedCount > 0 ? ` · ${selectedCount} marcados` : ''}
        </span>
      </label>
    </div>
  );
}
