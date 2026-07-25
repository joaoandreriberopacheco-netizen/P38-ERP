import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/components/utils';
import {
  CATALOG_NUMERIC_METRIC_FIELDS,
  getCatalogMetricFilterKeys,
  NUMERIC_COMPARISON_OPERATORS,
} from '@/lib/catalogNumericFilters';

const MOBILE_FILTER_SELECT =
  'bg-muted/80 border-none h-9 text-xs w-full rounded-xl';

const INLINE_SELECT =
  'bg-muted/80 border-none h-9 text-xs rounded-lg';

const INLINE_INPUT =
  'bg-muted/80 border-none h-9 text-xs rounded-lg disabled:opacity-50';

function FilterSectionLabel({ children, className }) {
  return (
    <p
      className={cn(
        'text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-0.5',
        className,
      )}
    >
      {children}
    </p>
  );
}

/**
 * Filtro numérico reutilizável: métrica + operador + valor(es).
 * `metricSlot` 1 ou 2 — use os dois em conjunto com os restantes filtros.
 */
export default function ProdutosNumericMetricFilter({
  filters,
  setFilters,
  handleFilterChange,
  sectionLabel = 'Métrica',
  metricSlot = 1,
  variant = 'stacked',
}) {
  const { campo: campoKey, operador: operadorKey, valor: valorKey, valorAte: valorAteKey } =
    getCatalogMetricFilterKeys(metricSlot);

  const metricaCampo = filters[campoKey] || 'all';
  const metricaOperador = filters[operadorKey] || 'all';
  const metricActive = metricaCampo !== 'all' && metricaOperador !== 'all';
  const isInline = variant === 'inline';

  const metricSelect = (
    <Select
      value={metricaCampo}
      onValueChange={(v) =>
        setFilters((prev) => ({
          ...prev,
          [campoKey]: v,
          ...(v === 'all'
            ? {
                [operadorKey]: 'all',
                [valorKey]: '',
                [valorAteKey]: '',
              }
            : null),
        }))
      }
    >
      <SelectTrigger
        className={cn(
          MOBILE_FILTER_SELECT,
          isInline && INLINE_SELECT,
          isInline && 'min-w-0 flex-[1.4]',
          !isInline && 'desktop-layout:h-9 desktop-layout:rounded-lg',
        )}
      >
        <SelectValue placeholder="Métrica" />
      </SelectTrigger>
      <SelectContent className="dark:bg-muted dark:border-border/40">
        {CATALOG_NUMERIC_METRIC_FIELDS.map(({ value, label }) => (
          <SelectItem key={value} value={value} className="text-sm md:text-xs">
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const operatorSelect = (
    <Select
      value={metricaOperador}
      onValueChange={(v) =>
        setFilters((prev) => ({
          ...prev,
          [operadorKey]: v,
          [valorAteKey]: v === 'between' ? prev[valorAteKey] : '',
        }))
      }
      disabled={metricaCampo === 'all'}
    >
      <SelectTrigger
        className={cn(
          MOBILE_FILTER_SELECT,
          isInline && INLINE_SELECT,
          isInline && 'min-w-0 flex-1',
          !isInline && 'desktop-layout:h-9 desktop-layout:rounded-lg disabled:opacity-50',
        )}
      >
        <SelectValue placeholder="Comparação" />
      </SelectTrigger>
      <SelectContent className="dark:bg-muted dark:border-border/40">
        {NUMERIC_COMPARISON_OPERATORS.map(({ value, label }) => (
          <SelectItem key={value} value={value} className="text-sm md:text-xs">
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const valueInput = (
    <Input
      inputMode="decimal"
      placeholder={metricaOperador === 'between' ? 'De' : 'Valor'}
      disabled={!metricActive}
      className={cn(
        MOBILE_FILTER_SELECT,
        isInline && INLINE_INPUT,
        isInline && 'w-full min-w-[4.5rem] flex-[0.7]',
        !isInline && 'desktop-layout:rounded-lg',
      )}
      value={filters[valorKey] || ''}
      onChange={(e) => handleFilterChange(valorKey, e.target.value)}
    />
  );

  const valueAteInput =
    metricaOperador === 'between' ? (
      <Input
        inputMode="decimal"
        placeholder="Até"
        disabled={!metricActive}
        className={cn(
          MOBILE_FILTER_SELECT,
          isInline && INLINE_INPUT,
          isInline && 'w-full min-w-[4.5rem] flex-[0.7]',
          !isInline && 'desktop-layout:rounded-lg',
        )}
        value={filters[valorAteKey] || ''}
        onChange={(e) => handleFilterChange(valorAteKey, e.target.value)}
      />
    ) : null;

  if (isInline) {
    return (
      <div className="space-y-1 min-w-0">
        {sectionLabel ? <FilterSectionLabel>{sectionLabel}</FilterSectionLabel> : null}
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {metricSelect}
          {operatorSelect}
          {valueInput}
          {valueAteInput}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {sectionLabel ? <FilterSectionLabel>{sectionLabel}</FilterSectionLabel> : null}
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">{metricSelect}</div>
        <div className="col-span-2">{operatorSelect}</div>
        {valueInput}
        {valueAteInput}
      </div>
    </div>
  );
}
