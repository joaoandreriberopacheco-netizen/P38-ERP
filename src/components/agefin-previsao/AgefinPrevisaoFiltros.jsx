import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const FIELD =
  'bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-900 shadow-none focus:ring-0 focus-visible:ring-0';

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
    <div className={cn('flex flex-col gap-3 min-w-0 sm:flex-row sm:flex-wrap sm:items-center', className)}>
      <div className="flex min-w-0 items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:min-w-[200px] sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={busca}
            onChange={(e) => onBuscaChange?.(e.target.value)}
            placeholder="Buscar conta ou fornecedor"
            className={cn(FIELD, 'h-auto pl-9')}
            aria-label="Buscar conta"
          />
        </div>
        {organizer ? <div className="flex shrink-0 items-center sm:hidden">{organizer}</div> : null}
      </div>

      <Select value={centro || '__todos__'} onValueChange={onCentroChange}>
        <SelectTrigger className={cn('w-full sm:w-[200px] h-auto', FIELD)}>
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

      {organizer ? <div className="hidden shrink-0 items-center sm:ml-auto sm:flex">{organizer}</div> : null}
    </div>
  );
}
