import { CircleDollarSign } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { COMPRAS_KPI_ACCENT } from '@/lib/comprasP38Theme';

const ICON_BTN =
  'relative flex shrink-0 items-center justify-center w-10 h-10 rounded-xl bg-card shadow-sm hover:shadow-md transition text-foreground/90';

/**
 * Mobile: KPIs da lista de embarques/compras num ícone compacto (popover ao toque).
 */
export default function ComprasListaResumoPopover({
  label = 'Resumo financeiro da lista',
  children,
  className,
  'data-tour': dataTour,
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-tour={dataTour}
          className={cn(ICON_BTN, className)}
          title={label}
          aria-label={label}
        >
          <CircleDollarSign className="h-4 w-4" strokeWidth={2} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={6}
        className="max-w-[min(20rem,calc(100vw-2rem))] space-y-2 p-3.5 text-left font-din-1451 text-sm leading-normal normal-case"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

export function ComprasListaResumoEmbarques({ count, valorTotal, valorPagoNaoEntregue }) {
  return (
    <>
      <p className="text-foreground/90">
        {count} embarque{count === 1 ? '' : 's'} visíveis · R${' '}
        {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </p>
      <p className={cn('text-sm', COMPRAS_KPI_ACCENT)}>
        Aprovados financeiramente e ainda não recebidos no filtro: R${' '}
        {valorPagoNaoEntregue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </p>
    </>
  );
}

export function ComprasListaResumoSaldo({ count, valorTotal }) {
  return (
    <p className="text-foreground/90">
      {count} embarque{count === 1 ? '' : 's'} pendentes · R${' '}
      {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
    </p>
  );
}

export function ComprasListaResumoConsulta({ count }) {
  return (
    <p className="text-foreground/90">
      {count} embarque{count === 1 ? '' : 's'} no período
    </p>
  );
}
