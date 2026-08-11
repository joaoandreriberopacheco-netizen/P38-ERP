import React, { useMemo, useState } from 'react';
import { ChevronRight, AlertTriangle, CheckCircle2, Info, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  P38TableShell,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/components/utils';
import { p38Table } from '@/lib/p38TableSurfaces';
import {
  CERAM_MASSA_CRITICA_CX,
  CERAM_META_VAGAS,
  CERAM_MIN_LINHAS_SALDAVEL,
  atingeMassaCriticaCeramica,
} from '@/lib/modeloCatalogo/regrasCeramica';
import { portalEstoqueCx } from '@/lib/hierarquiaPortal/buildPortalSupplyCeramica';
import { summarizePortalSupply } from '@/lib/hierarquiaPortal/buildPortalSupplyCeramica';

const TIPO_BADGE = {
  solo: 'bg-slate-200/80 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
  mix: 'bg-blue-200/80 text-blue-900 dark:bg-blue-900/60 dark:text-blue-100',
  portfolio: 'bg-violet-200/80 text-violet-800 dark:bg-violet-900/60 dark:text-violet-100',
};

const TIPO_LABEL = { solo: 'Solo', mix: 'Mix', portfolio: 'Portfolio' };

function TipoBadge({ tipo }) {
  return (
    <Badge variant="secondary" className={cn('text-[10px] font-normal uppercase tracking-wide', TIPO_BADGE[tipo] || '')}>
      {TIPO_LABEL[tipo] || tipo}
    </Badge>
  );
}

function VeredictoBadge({ tom, saldavel }) {
  if (saldavel) {
    return (
      <Badge className="text-[10px] bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200 gap-1">
        <CheckCircle2 className="h-3 w-3" /> Saldável
      </Badge>
    );
  }
  if (tom === 'critico') {
    return (
      <Badge variant="destructive" className="text-[10px] gap-1">
        <AlertTriangle className="h-3 w-3" /> Crítico
      </Badge>
    );
  }
  return (
    <Badge className="text-[10px] bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100 gap-1">
      <AlertTriangle className="h-3 w-3" /> Alerta
    </Badge>
  );
}

function PfutCell({ value, saldavel }) {
  if (saldavel) {
    return <span className="tabular-nums text-sm text-green-700 dark:text-green-400 font-medium">OK</span>;
  }
  const neg = value < 0;
  return (
    <span className={cn('tabular-nums text-sm font-medium', neg ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
      {neg ? 'Repor' : value}
    </span>
  );
}

function SupplySummary({ lines, somenteAlerta }) {
  const stats = useMemo(() => summarizePortalSupply(lines), [lines]);
  return (
    <div className="rounded-lg border border-violet-500/30 bg-violet-50/50 dark:bg-violet-950/20 px-4 py-3 space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span><strong>{stats.total}</strong> esquadra(s) cerâmica</span>
        <span className="text-green-700 dark:text-green-400"><strong>{stats.saldaveis}</strong> saldável(eis)</span>
        <span className="text-amber-700 dark:text-amber-300"><strong>{stats.alertas}</strong> em alerta</span>
        {somenteAlerta && <span className="text-xs text-muted-foreground">(filtro: só alertas)</span>}
      </div>
      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>
          Regra piloto (igual laboratório Modelo): cada <strong>produto compra</strong> tem até{' '}
          <strong>{CERAM_META_VAGAS} posições</strong>; massa crítica <strong>{CERAM_MASSA_CRITICA_CX} CX</strong>;
          esquadra <strong>saldável</strong> quando ≥ <strong>{CERAM_MIN_LINHAS_SALDAVEL} linhas</strong> (ex_b) atingem a massa.
          Estoque em <strong>unidade vitrine</strong>. Preview — não gera pedido.
        </span>
      </p>
    </div>
  );
}

function SupplyRow({ line, open, onToggle }) {
  return (
    <>
      <TableRow
        className={cn(
          p38Table.row,
          'bg-background dark:bg-[#2f343c]/80',
          line.alerta && 'border-l-2 border-l-amber-500 dark:border-l-amber-400',
          line.saldavel && 'border-l-2 border-l-green-600/70 dark:border-l-green-500/70',
        )}
      >
        <TableCell className={cn(p38Table.cell, 'w-8 px-1')}>
          <button
            type="button"
            onClick={onToggle}
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-secondary/40"
            aria-expanded={open}
          >
            <ChevronRight className={cn('h-4 w-4 transition-transform', open && 'rotate-90')} />
          </button>
        </TableCell>
        <TableCell className={cn(p38Table.cell, 'min-w-0')}>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="truncate text-sm font-medium">{line.produto_compra_nome}</span>
            <VeredictoBadge tom={line.veredicto_tom} saldavel={line.saldavel} />
            <TipoBadge tipo={line.linha_tipo} />
          </div>
          <p className="truncate text-[11px] text-muted-foreground mt-0.5">
            {line.linha_nome} · {line.categoria}
          </p>
          <p className={cn(
            'text-[11px] mt-1 leading-snug',
            line.veredicto_tom === 'ok' && 'text-green-700 dark:text-green-400',
            line.veredicto_tom === 'alerta' && 'text-amber-800 dark:text-amber-200',
            line.veredicto_tom === 'critico' && 'text-red-700 dark:text-red-300',
          )}
          >
            {line.veredicto}
          </p>
        </TableCell>
        <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[56px]')}>
          <span className="tabular-nums text-sm">{line.sku_count}</span>
        </TableCell>
        <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[72px]')}>
          <span className="tabular-nums text-sm">{line.linhas_com_massa_critica}/{CERAM_MIN_LINHAS_SALDAVEL}</span>
          <p className="text-[9px] text-muted-foreground">c/ massa</p>
        </TableCell>
        <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[120px]')}>
          <span className="tabular-nums text-sm whitespace-nowrap">{line.estoque_label || '—'}</span>
        </TableCell>
        <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[64px]')}>
          <PfutCell value={line.pfut_simulado} saldavel={line.saldavel} />
        </TableCell>
      </TableRow>
      {open && (
        <TableRow className="bg-muted/20 dark:bg-[#2a2e35] hover:bg-muted/20 dark:hover:bg-[#2a2e35]">
          <TableCell colSpan={6} className={cn(p38Table.cell, 'py-3')}>
            <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1 uppercase tracking-wide">
              <Layers className="h-3 w-3" />
              {line.posicoes_ocupadas}/{line.meta_vagas} posições · massa {line.massa_critica} CX · saldável ≥ {line.min_linhas_saldavel} linhas
            </p>
            <ul className="space-y-1">
              {line.skus.map((s) => {
                const cx = portalEstoqueCx(s);
                const ok = atingeMassaCriticaCeramica(cx, line.massa_critica);
                return (
                  <li
                    key={s.produto.id}
                    className="flex justify-between gap-3 text-xs border-b border-border/30 dark:border-white/5 py-1.5 last:border-0"
                  >
                    <span className="truncate text-foreground/90">{s.produto.nome}</span>
                    <span className={cn('shrink-0 tabular-nums whitespace-nowrap text-right', ok ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground')}>
                      {s.estoque_label || `${cx} CX`}
                      {ok ? ' ✓ massa' : cx <= 0 ? ' · zerado' : ` · < ${line.massa_critica} CX`}
                      {s.eixo_b ? ` · ${s.eixo_b}` : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function SupplyLine({ line }) {
  const [open, setOpen] = useState(false);
  return <SupplyRow line={line} open={open} onToggle={() => setOpen((v) => !v)} />;
}

export default function PortalSmartSupplyPanel({ lines, somenteAlerta }) {
  const visible = somenteAlerta ? lines.filter((l) => l.alerta) : lines;

  if (!lines.length) {
    return (
      <div className="rounded-lg border border-border/40 dark:border-white/10 bg-muted/20 dark:bg-[#2f343c] p-8 text-center space-y-2">
        <p className="text-sm text-muted-foreground">Nenhuma esquadra no piloto cerâmica.</p>
        <p className="text-xs text-muted-foreground">Verifique se os SKUs do Excel existem no cadastro (código interno).</p>
      </div>
    );
  }

  if (!visible.length) {
    return (
      <div className="space-y-3">
        <SupplySummary lines={lines} somenteAlerta={somenteAlerta} />
        <div className="rounded-lg border border-green-500/30 bg-green-50/30 dark:bg-green-950/20 p-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-green-800 dark:text-green-200">Nenhuma esquadra em alerta</p>
          <p className="text-xs text-muted-foreground mt-1">Todas as esquadras visíveis estão saldáveis ou dentro da regra.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SupplySummary lines={lines} somenteAlerta={somenteAlerta} />

      <P38TableShell
        className={cn(
          'max-h-[min(70vh,880px)] border-border/40 dark:border-white/10',
          'bg-background dark:bg-[#2a2e35]',
          'shadow-sm dark:shadow-[0_4px_18px_rgba(0,0,0,0.35)]',
        )}
      >
        <Table className="table-auto min-w-[760px]">
          <TableHeader
            className={cn(
              p38Table.headerSolid,
              'bg-muted dark:bg-[#383e47]',
              'border-b-2 border-[#4a5240] dark:border-[#a4ce33]',
            )}
          >
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className={cn(p38Table.head, 'w-8')} />
              <TableHead className={p38Table.head}>Produto compra · situação</TableHead>
              <TableHead className={cn(p38Table.head, p38Table.headRight, 'w-[56px]')}>SKUs</TableHead>
              <TableHead className={cn(p38Table.head, p38Table.headRight, 'w-[72px]')}>Massa</TableHead>
              <TableHead className={cn(p38Table.head, p38Table.headRight, 'w-[120px]')}>Estoque vitrine</TableHead>
              <TableHead className={cn(p38Table.head, p38Table.headRight, 'w-[64px]')}>Acção</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((line) => (
              <SupplyLine key={line.key} line={line} />
            ))}
          </TableBody>
        </Table>
      </P38TableShell>
    </div>
  );
}
