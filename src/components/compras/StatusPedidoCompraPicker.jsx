import React from 'react';
import { Layers, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { P38_CHIP_ACTIVE, P38_CHIP_INACTIVE, P38_POPOVER } from '@/components/financeiro/fluxo/financeiroP38';
import { COMPRAS_FILTRO_STATUS_PEDIDO } from '@/lib/comprasEmbarquesPalette';

export function statusPedidoCompraExplicitos(statusSel = []) {
  return (statusSel || []).filter((s) => s !== '__nao_concluido__');
}

export function labelStatusPedidoCompraPicker(statusSel = []) {
  const explicit = statusPedidoCompraExplicitos(statusSel);
  if (explicit.length === 0) return 'Status do pedido';
  if (explicit.length === 1) {
    return COMPRAS_FILTRO_STATUS_PEDIDO.find((o) => o.codigo === explicit[0])?.label || explicit[0];
  }
  return `${explicit.length} status`;
}

/**
 * Seletor rápido de status — mesmo padrão do ContasSaldoPicker (fluxo de caixa).
 * Os toggles «Últimos 30 dias» e «Não concluídos» mantêm-se; quando há status
 * escolhidos aqui, estes têm a última palavra no filtro.
 */
export default function StatusPedidoCompraPicker({
  statusSel = [],
  onStatusSel,
  onFiltroSomenteNaoConcluidos,
  className = '',
}) {
  const explicit = statusPedidoCompraExplicitos(statusSel);
  const temSelecaoExplicita = explicit.length > 0;
  const label = labelStatusPedidoCompraPicker(statusSel);
  const allCodigos = COMPRAS_FILTRO_STATUS_PEDIDO.map((o) => o.codigo);

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
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${temSelecaoExplicita ? P38_CHIP_ACTIVE : P38_CHIP_INACTIVE} ${className}`}
          aria-label="Filtrar por status do pedido"
        >
          <Layers className="h-3.5 w-3.5 shrink-0" />
          <span className="max-w-[9rem] truncate sm:max-w-[12rem]">{label}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent className={`w-72 p-2.5 ${P38_POPOVER}`} align="start">
        <div className="mb-2 px-2 pt-1">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Status do pedido</p>
          <p className="mt-1 text-[10px] leading-snug text-muted-foreground/80">
            Complementa os atalhos «30 dias» e «Não concluídos». Ao escolher aqui, este filtro prevalece.
          </p>
        </div>
        <button
          type="button"
          onClick={limparSelecao}
          className={`mb-1.5 w-full rounded-2xl px-3 py-2 text-left text-xs transition-colors ${!temSelecaoExplicita
            ? `${P38_CHIP_ACTIVE} font-medium`
            : 'text-muted-foreground hover:bg-secondary/80 dark:hover:bg-[#383e47]'}`}
        >
          Usar só os atalhos (30 dias / não concluídos)
        </button>
        <button
          type="button"
          onClick={marcarTodos}
          className={`mb-1.5 w-full rounded-2xl px-3 py-2 text-left text-xs transition-colors ${explicit.length === allCodigos.length
            ? `${P38_CHIP_ACTIVE} font-medium`
            : 'text-muted-foreground hover:bg-secondary/80 dark:hover:bg-[#383e47]'}`}
        >
          Todos os status
        </button>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {COMPRAS_FILTRO_STATUS_PEDIDO.map((option) => {
            const selected = explicit.includes(option.codigo);
            return (
              <label
                key={option.codigo}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 transition-all ${selected
                  ? 'bg-secondary/80 shadow-sm dark:bg-[#383e47]'
                  : 'hover:bg-secondary/60 dark:hover:bg-[#383e47]/60'}`}
              >
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => toggle(option.codigo)}
                  className="h-4 w-4"
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
