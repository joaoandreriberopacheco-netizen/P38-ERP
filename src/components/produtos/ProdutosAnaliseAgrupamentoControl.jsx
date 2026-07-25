import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATALOG_GROUP_ANALYSIS_LEVELS } from '@/lib/catalogGroupAnalysis';
import { cn } from '@/components/utils';

/**
 * Modo análise por agrupamento: quantidade e métricas avaliam o total do grupo
 * no nível escolhido (independente do nível de expansão da TreeGrid).
 */
export default function ProdutosAnaliseAgrupamentoControl({
  filters,
  setFilters,
  handleFilterChange,
  className = '',
  compact = false,
}) {
  const active = filters.analisePorAgrupamento === true;
  const nivel = filters.analiseAgrupamentoNivel || '2';

  return (
    <div className={cn('flex flex-wrap items-center gap-2 min-w-0', className)}>
      <label
        className={cn(
          'flex items-center gap-1.5 flex-shrink-0 cursor-pointer select-none rounded-lg bg-muted/80 px-2',
          compact ? 'h-9' : 'h-9 flex-1 min-w-[10rem]',
        )}
        title={
          active
            ? 'Filtros numéricos aplicam-se ao total do grupo'
            : 'Filtros numéricos aplicam-se a cada SKU'
        }
      >
        <Switch
          checked={active}
          onCheckedChange={(checked) =>
            setFilters((prev) => ({ ...prev, analisePorAgrupamento: checked }))
          }
          className="scale-[0.72] data-[state=checked]:bg-muted dark:data-[state=checked]:bg-muted"
        />
        <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
          Análise por agrupamento
        </span>
      </label>

      {active ? (
        <Select value={nivel} onValueChange={(v) => handleFilterChange('analiseAgrupamentoNivel', v)}>
          <SelectTrigger
            className={cn(
              'bg-muted/80 border-none text-xs rounded-lg min-w-0',
              compact ? 'h-9 w-[7.5rem]' : 'h-9 flex-1 min-w-[7.5rem]',
            )}
          >
            <SelectValue placeholder="Nível" />
          </SelectTrigger>
          <SelectContent className="dark:bg-muted dark:border-border/40">
            {CATALOG_GROUP_ANALYSIS_LEVELS.map(({ value, label }) => (
              <SelectItem key={value} value={value} className="text-xs">
                Filtrar em {label.toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}
