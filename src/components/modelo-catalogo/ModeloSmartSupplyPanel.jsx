import React, { useState } from 'react';
import { ChevronRight, AlertTriangle, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/components/utils';
import { TIPO_LINHA_LABEL } from '@/lib/modeloCatalogo/montarNomeSku';

function PfutCell({ value }) {
  const neg = value < 0;
  return (
    <span className={cn('tabular-nums text-xs font-medium', neg ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
      {value}
    </span>
  );
}

function SupplyLine({ line }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/40 last:border-0">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50 text-sm">
        <ChevronRight className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-90')} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{line.produto_compra_nome}</span>
            <Badge variant="outline" className="text-[10px]">{TIPO_LINHA_LABEL[line.linha_tipo] || line.linha_tipo}</Badge>
            {line.alerta && <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />}
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{line.linha_nome} · {line.categoria}</p>
        </div>
        <div className="flex items-center gap-4 shrink-0 text-right">
          <div><p className="text-[10px] text-muted-foreground">SKUs</p><p className="text-xs tabular-nums">{line.sku_count}</p></div>
          <div><p className="text-[10px] text-muted-foreground">Est. sim.</p><p className="text-xs tabular-nums">{line.estoque_total}</p></div>
          <div><p className="text-[10px] text-muted-foreground">P.FUT*</p><PfutCell value={line.pfut_simulado} /></div>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-3 bg-muted/30">
          {line.meta_vagas != null && (
            <p className="text-[10px] text-muted-foreground mb-1">Portfolio: {line.meta_vagas} vagas · limiar {line.massa_critica ?? '—'}</p>
          )}
          <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1">
            <Layers className="h-3 w-3" /> Detalhe por SKU (simulado — não gera pedido real)
          </p>
          <ul className="space-y-1">
            {line.skus.map((s) => (
              <li key={s.id} className="flex justify-between gap-2 text-xs text-muted-foreground">
                <span className="truncate">{s.nome}</span>
                <span className="shrink-0 tabular-nums">est. {Number(s.estoque_simulado) || 0}{s.eixo_b_texto ? ` · ${s.eixo_b_texto}` : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ModeloSmartSupplyPanel({ lines, somenteAlerta }) {
  const visible = somenteAlerta ? lines.filter((l) => l.alerta) : lines;
  if (!visible.length) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma linha de compra simulada.</p>;
  }
  return (
    <div className="rounded-lg border bg-card divide-y">
      <p className="text-[11px] text-muted-foreground px-3 py-2 border-b">* P.FUT simulado = estoque simulado − ponto simulado (laboratório)</p>
      {visible.map((line) => (
        <SupplyLine key={line.produto_compra_id || line.linha_id} line={line} />
      ))}
    </div>
  );
}
