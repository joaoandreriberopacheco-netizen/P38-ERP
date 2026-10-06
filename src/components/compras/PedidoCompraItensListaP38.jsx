import React from 'react';
import { cn } from '@/lib/utils';
import { P38_FIELD_SURFACE, P38_ACCENT } from '@/components/financeiro/fluxo/financeiroP38';
import {
  P38MobileLine,
  P38MobileLineList,
  P38StatusLabel,
  p38AccentKeyFromTone,
} from '@/components/ui/p38-mobile-line';

const LINE_TITLE_CLASS =
  '[&>div>div:first-child]:text-[15px] [&>div>div:first-child]:font-semibold sm:[&>div>div:first-child]:text-base';

/** Lista de itens do pedido — mesmo feeling do Planejamento financeiro (borda suave + linhas densas). */
export function PedidoCompraItensListaShell({ className, children }) {
  return (
    <P38MobileLineList
      allViewports
      className={cn(
        'min-w-0 w-full max-w-full overflow-hidden rounded-xl border border-border/50',
        P38_FIELD_SURFACE,
        className,
      )}
    >
      {children}
    </P38MobileLineList>
  );
}

/** Linha resumo (nome, qtd × preço, total à direita). */
export function PedidoCompraItemLinhaResumo({
  nome,
  detalhe,
  meta,
  totalFormatado,
  onClick,
  trailing,
  striped = false,
  accentTone = 'muted',
  className,
}) {
  return (
    <P38MobileLine
      thinAccent
      striped={striped}
      accent={p38AccentKeyFromTone(accentTone)}
      onClick={onClick}
      title={nome}
      subtitle={detalhe}
      meta={meta}
      value={<span className={cn('font-semibold tabular-nums', P38_ACCENT)}>{totalFormatado}</span>}
      trailing={trailing}
      className={cn(
        LINE_TITLE_CLASS,
        'max-md:!py-3.5 max-md:min-h-[58px]',
        onClick && 'cursor-pointer',
        className,
      )}
    />
  );
}

/** Bloco expansível dentro de uma linha (recepção / embarque com inputs). */
export function PedidoCompraItemLinhaCorpo({ children, className }) {
  return (
    <P38MobileLine
      as="div"
      thinAccent
      accent="muted"
      className={cn('!block !items-stretch !py-3 max-md:min-h-0', className)}
    >
      <div className="w-full min-w-0 space-y-3 font-din-1451">{children}</div>
    </P38MobileLine>
  );
}

export function PedidoCompraItemMetaChip({ tone = 'muted', children }) {
  return <P38StatusLabel tone={tone}>{children}</P38StatusLabel>;
}

/** Campo numérico centralizado — recepção / embarque. */
export const PEDIDO_COMPRA_INPUT_QTD_CLASS =
  'h-12 text-lg bg-background dark:bg-[#26262e] border-0 rounded-xl shadow-sm font-semibold text-foreground text-center placeholder:text-muted-foreground disabled:opacity-60';
