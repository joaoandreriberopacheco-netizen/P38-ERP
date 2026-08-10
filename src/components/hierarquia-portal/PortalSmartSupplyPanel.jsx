import React, { useState } from 'react';
import { ChevronRight, AlertTriangle, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/components/utils';

function PfutCell({ value }) {
  const neg = value < 0;
  return (
    <span
      className={cn(
        'tabular-nums text-xs font-medium',
        neg ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
      )}
    >
      {value}
    </span>
  );
}

function SupplyLine({ line }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border/40 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50 text-sm"
      >
        <ChevronRight className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-90')} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{line.produto_compra_nome}</span>
            <Badge variant="outline" className="text-[10px]">{line.linha_tipo}</Badge>
            {line.alerta && (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" aria-label="Alerta" />
            )}
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            {line.linha_nome} · {line.categoria}
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0 text-right">
          <div>
            <p className="text-[10px] text-muted-foreground">SKUs</p>
            <p className="text-xs tabular-nums">{line.sku_count}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Estoque</p>
            <p className="text-xs tabular-nums">{line.estoque_total}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">P.FUT*</p>
            <PfutCell value={line.pfut_simulado} />
          </div>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-3 bg-muted/30">
          <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1">
            <Layers className="h-3 w-3" />
            Detalhe por SKU (preview — não gera pedido)
          </p>
          <ul className="space-y-1">
            {line.skus.map((s) => (
              <li
                key={s.produto.id}
                className="flex justify-between gap-2 text-xs text-muted-foreground"
              >
                <span className="truncate">{s.produto.nome}</span>
                <span className="shrink-0 tabular-nums">
                  est. {s.estoque}
                  {s.eixo_b ? ` · ${s.eixo_b}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function PortalSmartSupplyPanel({ lines, somenteAlerta }) {
  const visible = somenteAlerta ? lines.filter((l) => l.alerta) : lines;

  if (!visible.length) {
    return (
      <p className="text-sm text-muted-foreground p-4">
        {somenteAlerta ? 'Nenhuma esquadra em alerta com estes filtros.' : 'Sem linhas para exibir.'}
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden bg-card">
      <div className="grid grid-cols-[1fr_auto] gap-2 px-3 py-2 bg-muted/50 text-[10px] font-medium text-muted-foreground border-b">
        <span>Produto compra (linha de reposição)</span>
        <span>Indicadores</span>
      </div>
      {visible.map((line) => <SupplyLine key={line.key} line={line} />)}
      <p className="px-3 py-2 text-[10px] text-muted-foreground border-t">
        * P.FUT simulado (portal) — na SMART SUPPLY real usa vendas 90d e lead time.
      </p>
    </div>
  );
}
