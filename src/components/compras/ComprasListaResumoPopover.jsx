import { CircleDollarSign } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { COMPRAS_KPI_ACCENT } from '@/lib/comprasP38Theme';

/**
 * Mobile: KPIs da lista de embarques/compras num ícone compacto (popover ao toque).
 */
export default function ComprasListaResumoPopover({
  label = 'Resumo financeiro da lista',
  children,
  className,
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground/80 transition-colors hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
          aria-label={label}
        >
          <CircleDollarSign className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
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
