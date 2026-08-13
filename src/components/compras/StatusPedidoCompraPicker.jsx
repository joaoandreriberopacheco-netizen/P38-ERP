import React from 'react';
import { Layers } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/components/utils';
import { P38_CHIP_ACTIVE, P38_POPOVER } from '@/components/financeiro/fluxo/financeiroP38';
import { COMPRAS_FILTRO_STATUS_PICKER } from '@/lib/comprasEmbarquesPalette';

export function statusPedidoCompraExplicitos(statusSel = []) {
  return (statusSel || []).filter((s) => s !== '__nao_concluido__');
}

export function labelStatusPedidoCompraPicker(statusSel = []) {
  const explicit = statusPedidoCompraExplicitos(statusSel);
  if (explicit.length === 0) return 'Status';
  if (explicit.length === 1) {
    return COMPRAS_FILTRO_STATUS_PICKER.find((o) => o.codigo === explicit[0])?.label || explicit[0];
  }
  return `${explicit.length} status`;
}

/** Botão ícone — mesmo tamanho do agrupador (caminhão / seta). */
const ICON_BTN =
  'relative flex items-center justify-center w-10 h-10 rounded-xl bg-card shadow-sm hover:shadow-md transition text-foreground/90';

/**
 * Seletor de status ao lado do agrupador (caminhão + ordenação).
 */
export default function StatusPedidoCompraPicker({
  statusSel = [],
  onStatusSel,
  onFiltroSomenteNaoConcluidos,
  className = '',
}) {
  const explicit = statusPedidoCompraExplicitos(statusSel);
  const temSelecaoExplicita = explicit.length > 0;
  const allCodigos = COMPRAS_FILTRO_STATUS_PICKER.map((o) => o.codigo);

  const toggle = (codigo) => {
    const base = explicit.length ? [...explicit] : [];
    const next = base.includes(codigo) ? base.filter((c) => c !== codigo) : [...base, codigo];
    if (next.length === 0) {
      onStatusSel?.(statusSel.filter((s) => s === '__nao_concluido__'));
      return;
    }
    onStatusSel?.(next);
  };

  const limparSelecao = () => {
    onStatusSel?.(statusSel.filter((s) => s === '__nao_concluido__'));
  };

  const marcarTodos = () => {
    onFiltroSomenteNaoConcluidos?.(false);
    onStatusSel?.([...allCodigos]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            ICON_BTN,
            temSelecaoExplicita && 'ring-2 ring-[#4a5240]/35 dark:ring-[#a4ce33]/45',
            className,
          )}
          title={labelStatusPedidoCompraPicker(statusSel)}
          aria-label={`Filtrar status: ${labelStatusPedidoCompraPicker(statusSel)}`}
        >
          <Layers className="w-4 h-4" />
          {temSelecaoExplicita ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#4a5240] px-0.5 text-[9px] font-semibold leading-none text-white dark:bg-[#a4ce33] dark:text-[#1f1d22]">
              {explicit.length > 9 ? '9+' : explicit.length}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent className={`w-56 p-2 ${P38_POPOVER}`} align="end" sideOffset={6}>
        <div className="mb-1 flex gap-1 px-1">
          <button
            type="button"
            onClick={limparSelecao}
            className={cn(
              'flex-1 rounded-xl px-2 py-1.5 text-[10px] transition-colors',
              !temSelecaoExplicita
                ? `${P38_CHIP_ACTIVE} font-medium`
                : 'text-muted-foreground hover:bg-secondary/80 dark:hover:bg-[#383e47]',
            )}
          >
            Atalhos
          </button>
          <button
            type="button"
            onClick={marcarTodos}
            className={cn(
              'flex-1 rounded-xl px-2 py-1.5 text-[10px] transition-colors',
              explicit.length === allCodigos.length
                ? `${P38_CHIP_ACTIVE} font-medium`
                : 'text-muted-foreground hover:bg-secondary/80 dark:hover:bg-[#383e47]',
            )}
          >
            Todos
          </button>
        </div>
        <div className="max-h-56 space-y-0.5 overflow-y-auto">
          {COMPRAS_FILTRO_STATUS_PICKER.map((option) => {
            const selected = explicit.includes(option.codigo);
            return (
              <label
                key={option.codigo}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 transition-all',
                  selected
                    ? 'bg-secondary/80 dark:bg-[#383e47]'
                    : 'hover:bg-secondary/60 dark:hover:bg-[#383e47]/60',
                )}
              >
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => toggle(option.codigo)}
                  className="h-3.5 w-3.5"
                />
                <span className={`inline-flex h-5 items-center rounded-full px-2 text-[10px] font-medium ${option.chip}`}>
                  {option.label}
                </span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
