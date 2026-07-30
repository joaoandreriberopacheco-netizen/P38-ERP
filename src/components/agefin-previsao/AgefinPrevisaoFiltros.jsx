import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { P38_FIELD_SURFACE } from '@/components/financeiro/fluxo/financeiroP38';

export default function AgefinPrevisaoFiltros({
  busca,
  onBuscaChange,
  centro,
  onCentroChange,
  centrosRegistrados = [],
  organizer,
  className,
}) {
  return (
    <div className={cn('flex flex-col gap-2 min-w-0', className)}>
      <div className={cn('relative min-w-0 w-full rounded-xl', P38_FIELD_SURFACE)}>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => onBuscaChange?.(e.target.value)}
          placeholder="Buscar conta"
          className="border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
          aria-label="Buscar conta"
        />
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Select value={centro || '__todos__'} onValueChange={onCentroChange}>
          <SelectTrigger className={cn('min-w-0 flex-1 sm:w-[200px] sm:flex-none rounded-xl', P38_FIELD_SURFACE)}>
            <SelectValue placeholder="Centro de custo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos__">Todos os centros</SelectItem>
            <SelectItem value="__sem__">Sem centro de custo</SelectItem>
            {centrosRegistrados.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {organizer ? <div className="flex shrink-0 items-center">{organizer}</div> : null}
      </div>
    </div>
  );
}
