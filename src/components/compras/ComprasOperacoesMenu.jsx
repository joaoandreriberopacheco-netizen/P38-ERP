import { DollarSign, CheckSquare, Send, FileUp, FileText, Download, MoreHorizontal } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/components/utils';
import { P38_POPOVER } from '@/components/financeiro/fluxo/financeiroP38';

const ICON_BTN =
  'relative flex items-center justify-center w-10 h-10 rounded-xl bg-card shadow-sm hover:shadow-md transition text-foreground/90';

export default function ComprasOperacoesMenu({
  onImportarPedido,
  onImportarNF,
  onDownloadTemplate,
  onEnviarFinanceiroLote,
  onToggleModoSelecao,
  onAtualizarPrecosFiltrados,
  modoSelecao = false,
  quantidadeSelecionados = 0,
  enviandoLote = false,
  className = '',
}) {
  const items = [
    {
      icon: DollarSign,
      label: 'Atualizar preços (filtrados)',
      onClick: onAtualizarPrecosFiltrados,
    },
    {
      icon: CheckSquare,
      label: modoSelecao ? 'Cancelar seleção' : 'Selecionar embarques',
      onClick: onToggleModoSelecao,
      active: modoSelecao,
    },
    ...(modoSelecao ? [{
      icon: Send,
      label: enviandoLote ? 'Enviando...' : `Enviar ao financeiro${quantidadeSelecionados ? ` (${quantidadeSelecionados})` : ''}`,
      onClick: onEnviarFinanceiroLote,
      disabled: enviandoLote || quantidadeSelecionados === 0,
      highlight: true,
    }] : []),
    { divider: true },
    {
      icon: FileUp,
      label: 'Importar pedido (PDF)',
      onClick: onImportarPedido,
    },
    {
      icon: FileText,
      label: 'Importar NF',
      onClick: onImportarNF,
    },
    {
      icon: Download,
      label: 'Baixar template',
      onClick: onDownloadTemplate,
    },
  ].filter(Boolean);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(ICON_BTN, modoSelecao && 'ring-2 ring-primary/30', className)}
          title="Mais ações"
          aria-label="Mais ações de compras"
        >
          <MoreHorizontal className="w-4 h-4" />
          {modoSelecao ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-semibold leading-none text-primary-foreground">
              !
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent className={cn('w-64 p-2', P38_POPOVER)} align="end" sideOffset={6}>
        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Operações</p>
        {items.map((item, idx) => {
          if (item.divider) {
            return <div key={`div-${idx}`} className="my-1 border-t border-border/40" />;
          }
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onClick={item.onClick}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-2 py-2.5 text-left text-sm transition-colors disabled:opacity-40',
                item.highlight
                  ? 'bg-emerald-600/10 text-emerald-800 hover:bg-emerald-600/15 dark:text-emerald-300'
                  : item.active
                    ? 'bg-primary/10 text-foreground hover:bg-primary/15'
                    : 'text-foreground hover:bg-muted/60',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="leading-snug">{item.label}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
