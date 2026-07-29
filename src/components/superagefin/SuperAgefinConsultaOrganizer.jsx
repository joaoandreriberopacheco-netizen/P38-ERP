import React from 'react';
import { CalendarDays, Building2, Tag, Wallet, ArrowDownUp, Layers, Sparkles } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const OPTIONS_CONSULTA = [
  { value: 'vencimento', label: 'Data de vencimento', icon: CalendarDays },
  { value: 'favorecido', label: 'Favorecido', icon: Building2 },
  { value: 'status', label: 'Status', icon: Wallet },
  { value: 'categoria', label: 'Categoria', icon: Tag },
];

const OPTIONS_BOLETO = [
  { value: 'mes', label: 'Mês de vencimento', icon: CalendarDays },
  { value: 'grupo', label: 'Série / grupo', icon: Layers },
  { value: 'favorecido', label: 'Favorecido', icon: Building2 },
  { value: 'origem', label: 'Origem', icon: Sparkles },
];

const OPTIONS_RECORRENTES = [
  { value: 'nome', label: 'Nome da despesa', icon: Tag },
  { value: 'dia', label: 'Dia de vencimento', icon: CalendarDays },
  { value: 'situacao', label: 'Situação', icon: Wallet },
];

const OPTIONS_PREVISAO = [
  { value: 'vencimento', label: 'Data de vencimento', icon: CalendarDays },
  { value: 'favorecido', label: 'Favorecido', icon: Building2 },
  { value: 'status', label: 'Status', icon: Wallet },
  { value: 'categoria', label: 'Categoria', icon: Tag },
  { value: 'centro_custo', label: 'Centro de custo', icon: Layers },
];

const OPTIONS_CONTAS_FIXAS = [
  { value: 'centro_custo', label: 'Centro de custo', icon: Layers },
  { value: 'dia_vencimento', label: 'Dia de vencimento', icon: CalendarDays },
  { value: 'favorecido', label: 'Favorecido', icon: Building2 },
  { value: 'categoria', label: 'Categoria', icon: Tag },
];

const VARIANT_MAP = {
  consulta: OPTIONS_CONSULTA,
  previsao: OPTIONS_PREVISAO,
  contasFixas: OPTIONS_CONTAS_FIXAS,
  boleto: OPTIONS_BOLETO,
  recorrentes: OPTIONS_RECORRENTES,
};

export default function SuperAgefinConsultaOrganizer({
  variant = 'consulta',
  groupBy,
  sortOrder,
  onGroupByChange,
  onSortOrderToggle,
}) {
  const OPTIONS = VARIANT_MAP[variant] || VARIANT_MAP.consulta;
  const current = OPTIONS.find((option) => option.value === groupBy) || OPTIONS[0];
  const CurrentIcon = current.icon;

  const sortTitle =
    groupBy === 'vencimento' || groupBy === 'dia_vencimento'
      ? sortOrder === 'asc'
        ? 'Vencimento: mais antigo primeiro'
        : 'Vencimento: mais recente primeiro'
      : sortOrder === 'desc'
        ? 'Ordem: mais recente / Z–A'
        : 'Ordem: mais antigo / A–Z';

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted shadow-sm transition hover:shadow-md dark:bg-muted text-foreground/90"
            title="Agrupar contas"
          >
            <CurrentIcon className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-xl border-0 shadow-lg dark:bg-muted">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <DropdownMenuItem
                key={option.value}
                onClick={() => onGroupByChange(option.value)}
                className="cursor-pointer gap-2 dark:text-foreground dark:hover:bg-primary/90"
              >
                <Icon className="h-4 w-4" />
                <span>{option.label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        type="button"
        onClick={onSortOrderToggle}
        className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted shadow-sm transition hover:shadow-md dark:bg-muted text-foreground/90"
        title={sortTitle}
      >
        <ArrowDownUp className={`h-4 w-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
}
