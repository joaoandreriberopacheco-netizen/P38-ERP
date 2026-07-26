import React from 'react';
import { CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import SugestaoCompraQuickChips from '@/components/compras/SugestaoCompraQuickChips';
import ProdutosTreeByCategoryToggle from '@/components/produtos/ProdutosTreeByCategoryToggle';
import { LevelControl } from '@/components/produtos/treegrid/TreeGrid';
import { SUGESTAO_VIEW_MODES } from '@/lib/sugestaoCompraOperationalMode';
import { cn } from '@/components/utils';

export default function SugestaoCompraDesktopToolbar({
  filteredCount,
  selectedCount,
  allSelected,
  someSelected,
  onSelectAllVisible,
  columnSort,
  onSortColumn,
  groupByCategory,
  onGroupByCategoryChange,
  somenteAbaixoPontoFuturo,
  onToggleSomenteAbaixo,
  considerarPedidosAprovadosEstoque,
  onToggleConsiderarPedidos,
  operationalMode,
  onOperationalModeChange,
  viewMode = 'familias',
  onViewModeChange,
  onOpenRelatorio,
  gerandoRelatorio,
  activeFilterCount,
  onOpenFilters,
  onRefresh,
  isLoading,
  treeLevel,
  onTreeLevelChange,
}) {
  return (
    <div className="space-y-2.5 rounded-xl border border-border/40 bg-muted/25 dark:bg-muted/15 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SugestaoCompraQuickChips
          somenteAbaixoPontoFuturo={somenteAbaixoPontoFuturo}
          onToggleSomenteAbaixo={onToggleSomenteAbaixo}
          considerarPedidosAprovadosEstoque={considerarPedidosAprovadosEstoque}
          onToggleConsiderarPedidos={onToggleConsiderarPedidos}
          operationalMode={operationalMode}
          onOperationalModeChange={onOperationalModeChange}
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
          size="md"
        />
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {viewMode === SUGESTAO_VIEW_MODES.detalhe ? (
            <>
              <ProdutosTreeByCategoryToggle
                checked={groupByCategory}
                onChange={onGroupByCategoryChange}
                className="h-9"
              />
              <div className="flex items-center gap-1 rounded-xl bg-card/80 dark:bg-card/40 border border-border/30 px-2 h-9">
                <span className="text-[10px] text-muted-foreground">nível</span>
                <LevelControl level={treeLevel} onChange={onTreeLevelChange} />
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <Button
          type="button"
          variant={allSelected ? 'default' : 'outline'}
          size="sm"
          className={cn(
            'h-9 rounded-xl gap-2 text-sm font-medium shrink-0',
            allSelected && 'bg-teal-600 hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500',
          )}
          onClick={() => onSelectAllVisible?.(!allSelected)}
        >
          {allSelected ? (
            <CheckSquare className="w-4 h-4 shrink-0" />
          ) : (
            <Square className="w-4 h-4 shrink-0" />
          )}
          {allSelected
            ? `Desmarcar visíveis (${filteredCount})`
            : `Selecionar visíveis (${filteredCount})`}
        </Button>
        {someSelected && !allSelected ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {selectedCount} de {filteredCount} marcados
          </span>
        ) : null}
        {selectedCount > 0 ? (
          <button
            type="button"
            onClick={() => onSelectAllVisible?.(false)}
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            Limpar seleção
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function SugestaoCompraDesktopSelectHeader({
  allSelected,
  someSelected,
  onSelectAllVisible,
}) {
  return (
    <Checkbox
      checked={allSelected || (someSelected ? true : false)}
      onCheckedChange={(checked) => onSelectAllVisible?.(checked === true)}
      className="h-5 w-5 border-2 data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600"
      aria-label="Selecionar todos os itens visíveis"
      title="Selecionar visíveis"
    />
  );
}
