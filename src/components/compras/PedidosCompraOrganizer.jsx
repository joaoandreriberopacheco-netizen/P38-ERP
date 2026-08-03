import React from 'react';
import { CalendarDays, Building2, Truck, Clock3, ArrowDownUp } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const OPTIONS = [
  { value: 'eta_transportadora', label: 'ETA/Transportadora', icon: Truck },
  { value: 'data_pedido', label: 'Data base', icon: CalendarDays },
  { value: 'fornecedor', label: 'Fornecedor', icon: Building2 },
  { value: 'status', label: 'Status', icon: Clock3 },
];

export default function PedidosCompraOrganizer({ groupBy, sortOrder, onGroupByChange, onSortOrderToggle }) {
  const current = OPTIONS.find((option) => option.value === groupBy) || OPTIONS[0];
  const CurrentIcon = current.icon;

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center justify-center w-10 h-10 rounded-xl bg-card shadow-sm hover:shadow-md transition text-foreground/90" title="Agrupar pedidos">
            <CurrentIcon className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="rounded-xl border-0 shadow-lg dark:bg-muted">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <DropdownMenuItem
                key={option.value}
                onClick={() => onGroupByChange(option.value)}
                className="gap-2 cursor-pointer dark:text-foreground dark:hover:bg-primary/90"
              >
                <Icon className="w-4 h-4" />
                <span>{option.label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        onClick={onSortOrderToggle}
        className="flex items-center justify-center w-10 h-10 rounded-xl bg-card shadow-sm hover:shadow-md transition text-foreground/90"
        title={sortOrder === 'desc' ? 'Mais recente primeiro' : 'Mais antigo primeiro'}
      >
        <ArrowDownUp className={`w-4 h-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
}