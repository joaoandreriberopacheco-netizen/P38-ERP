import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Zap, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  P38TableShell,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, createPageUrl } from '@/components/utils';
import { p38Table } from '@/lib/p38TableSurfaces';
import {
  CERAM_MIN_LINHAS_SALDAVEL,
  atingeMassaCriticaCeramica,
} from '@/lib/modeloCatalogo/regrasCeramica';
import { portalEstoqueCx } from '@/lib/hierarquiaPortal/buildPortalSupplyCeramica';
import { summarizePortalSupply } from '@/lib/hierarquiaPortal/buildPortalSupplyHierarchy';
import { montarNomePortalSku, montarSubtituloPortalSku } from '@/lib/hierarquiaPortal/montarNomePortalSku';
import { buildPortalSupplyBridgePayload, savePortalSupplyBridge } from '@/lib/hierarquiaPortal/portalSupplyBridge';
import { SMART_SUPPLY_PAGE, SMART_SUPPLY_TITLE } from '@/config/smartSupplyFlags';

/** off = saldável · amarelo = alerta · laranja = ruptura PFUT · vermelho = ruptura confirmada */
const LED_CLASS = {
  off: 'bg-muted-foreground/15 border border-muted-foreground/25 dark:bg-white/[0.06] dark:border-white/10',
  alerta: 'bg-yellow-300 shadow-[0_0_0_3px_rgba(253,224,71,0.32)] dark:bg-yellow-400',
  alerta_escuro: 'bg-yellow-500 shadow-[0_0_0_3px_rgba(234,179,8,0.34)] dark:bg-yellow-500',
  ruptura_pfut: 'bg-orange-500 shadow-[0_0_0_3px_rgba(249,115,22,0.34)] dark:bg-orange-400',
  ruptura: 'bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.34)] dark:bg-red-400',
};

const BORDER_CLASS = {
  off: 'border-l-transparent',
  alerta: 'border-l-yellow-400',
  alerta_escuro: 'border-l-yellow-500',
  ruptura_pfut: 'border-l-orange-500',
  ruptura: 'border-l-red-500',
};

function resolveSkuLed(row, massaCritica) {
  const cx = portalEstoqueCx(row);
  if (cx <= 0) return 'ruptura';
  if (row.ponto_negativo) return 'ruptura_pfut';
  if (!atingeMassaCriticaCeramica(cx, massaCritica)) {
    return cx < massaCritica / 2 ? 'alerta_escuro' : 'alerta';
  }
  return 'off';
}

function resolveEsquadraLed(eq) {
  const m = eq.metrics;
  if (eq.zerados > 0 || eq.veredicto_tom === 'critico') return 'ruptura';
  if (m?.ponto_negativo) return 'ruptura_pfut';
  if (eq.saldavel) return 'off';
  const ratio = (eq.abaixo_massa || 0) / (eq.sku_count || 1);
  return ratio >= 0.5 ? 'alerta_escuro' : 'alerta';
}

function resolveLinhaLed(linha) {
  const m = linha.metrics;
  const esquadras = linha.esquadras || [];
  if (esquadras.some((e) => e.zerados > 0 || e.veredicto_tom === 'critico')) return 'ruptura';
  if (m?.ponto_negativo) return 'ruptura_pfut';
  if (
    linha.resumo.esquadras_saldaveis === linha.resumo.esquadras_total
    && linha.resumo.esquadras_total > 0
  ) {
    return 'off';
  }
  const ratio = (linha.resumo.esquadras_alerta || 0) / (linha.resumo.esquadras_total || 1);
  return ratio >= 0.5 ? 'alerta_escuro' : 'alerta';
}

function SupplyLed({ tone = 'alerta', tip, pulse = false, className }) {
  const dot = (
    <span
      className={cn(
        'inline-block w-2.5 h-2.5 rounded-full shrink-0',
        LED_CLASS[tone] || LED_CLASS.alerta,
        pulse && tone !== 'off' && 'animate-pulse',
        className,
      )}
      aria-hidden
    />
  );

  if (!tip) return dot;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded p-0.5 -m-0.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label={tip}
        >
          {dot}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[280px] font-normal normal-case leading-snug">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

function Num({ value, negativo }) {
  if (!value || value === '—') {
    return <span className="text-muted-foreground/50 tabular-nums">—</span>;
  }
  return (
    <span
      className={cn(
        'tabular-nums text-sm',
        negativo && 'text-red-600 dark:text-red-400 font-semibold',
      )}
    >
      {value}
    </span>
  );
}

function RangerBar({ hierarchy, flatLines, somenteAlerta }) {
  const stats = useMemo(() => summarizePortalSupply(flatLines), [flatLines]);
  const linhas = hierarchy?.length ?? 0;
  const supplyPath = createPageUrl(SMART_SUPPLY_PAGE);

  const onOpenSupply = () => {
    savePortalSupplyBridge(
      buildPortalSupplyBridgePayload({
        linhaCodigo: '',
        linhaNome: '',
        produtoCompraNome: '',
        pontoFuturoLabel: '',
        veredicto: 'portal_preview',
      }),
    );
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border/40 dark:border-white/10 bg-muted/30 dark:bg-[#343a42]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums">
        <span>
          <strong>{linhas}</strong> LINHA
        </span>
        <span className="text-muted-foreground">·</span>
        <span>
          <strong>{stats.total}</strong> esq
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="inline-flex items-center gap-1.5">
          <SupplyLed tone="off" />
          <strong>{stats.saldaveis}</strong>
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="inline-flex items-center gap-1.5">
          <SupplyLed tone={stats.alertas > 0 ? 'alerta' : 'off'} pulse={stats.alertas > 0} />
          <strong>{stats.alertas}</strong>
        </span>
        {somenteAlerta && (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground ml-1">só alertas</span>
        )}
      </div>
      <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 shrink-0" asChild onClick={onOpenSupply}>
        <Link to={supplyPath}>
          <Zap className="h-3.5 w-3.5" />
          {SMART_SUPPLY_TITLE}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </Button>
    </div>
  );
}

function SkuRows({ skus, massaCritica }) {
  return skus.map((s) => {
    const cx = portalEstoqueCx(s);
    const tone = resolveSkuLed(s, massaCritica);
    const label = montarNomePortalSku(s);
    const code = montarSubtituloPortalSku(s);
    return (
      <TableRow
        key={s.produto.id}
        className={cn(p38Table.row, 'bg-muted/5 dark:bg-[#252830]/90 h-8 border-l-2', BORDER_CLASS[tone])}
      >
        <TableCell className={cn(p38Table.cell, 'w-8 px-1')} />
        <TableCell className={cn(p38Table.cell, 'w-8 px-1')}>
          <SupplyLed tone={tone} pulse={tone === 'ruptura' || tone === 'ruptura_pfut'} />
        </TableCell>
        <TableCell className={cn(p38Table.cell, 'min-w-0 max-w-0')}>
          <div className="pl-10 min-w-0">
            <span className="block truncate text-xs text-muted-foreground">{label}</span>
            {code && (
              <span className="block truncate text-[10px] text-muted-foreground/60 tabular-nums">{code}</span>
            )}
          </div>
        </TableCell>
        <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[52px]')} />
        <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[100px]')}>
          <Num value={s.estoque_label} negativo={cx <= 0} />
        </TableCell>
        <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[88px]')}>
          <Num value={s.media30_label} />
        </TableCell>
        <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[88px]')}>
          <Num value={s.ponto_futuro_label} negativo={s.ponto_negativo} />
        </TableCell>
        <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[56px]')} />
      </TableRow>
    );
  });
}

function EsquadraRows({ esquadras, openSet, toggleOpen }) {
  return esquadras.map((eq) => {
    const open = openSet.has(eq.key);
    const m = eq.metrics;
    const tone = resolveEsquadraLed(eq);

    return (
      <React.Fragment key={eq.key}>
        <TableRow
          className={cn(
            p38Table.row,
            'bg-background/90 dark:bg-[#2a2e35]/95 h-9 border-l-2',
            BORDER_CLASS[tone],
          )}
        >
          <TableCell className={cn(p38Table.cell, 'w-8 px-1')}>
            <button
              type="button"
              onClick={() => toggleOpen(eq.key)}
              className="flex h-7 w-7 items-center justify-center rounded hover:bg-secondary/40 ml-3"
              aria-expanded={open}
            >
              <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
            </button>
          </TableCell>
          <TableCell className={cn(p38Table.cell, 'w-8 px-1')}>
            <SupplyLed tone={tone} tip={eq.veredicto} pulse={tone === 'ruptura' || tone === 'ruptura_pfut'} />
          </TableCell>
          <TableCell className={cn(p38Table.cell, 'min-w-0 max-w-0')}>
            <span className="block truncate text-sm pl-5 font-medium">{eq.produto_compra_nome}</span>
          </TableCell>
          <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[52px] text-sm')}>
            {eq.sku_count}
          </TableCell>
          <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[100px]')}>
            <Num value={m?.estoque_label} />
          </TableCell>
          <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[88px]')}>
            <Num value={m?.media30_label} />
          </TableCell>
          <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[88px]')}>
            <Num value={m?.ponto_futuro_label} negativo={m?.ponto_negativo} />
          </TableCell>
          <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[56px] text-xs tabular-nums')}>
            {eq.linhas_com_massa_critica}/{CERAM_MIN_LINHAS_SALDAVEL}
          </TableCell>
        </TableRow>
        {open && <SkuRows skus={eq.skus} massaCritica={eq.massa_critica} />}
      </React.Fragment>
    );
  });
}

function SupplyTreeTable({ linhas }) {
  const [openLinhas, setOpenLinhas] = useState(() => new Set(linhas.map((l) => l.linha_codigo)));
  const [openEsquadras, setOpenEsquadras] = useState(new Set());

  const toggleLinha = (codigo) => {
    setOpenLinhas((prev) => {
      const next = new Set(prev);
      if (next.has(codigo)) next.delete(codigo);
      else next.add(codigo);
      return next;
    });
  };

  const toggleEsquadra = (key) => {
    setOpenEsquadras((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <P38TableShell
      className={cn(
        'max-h-[min(72vh,900px)] border-border/40 dark:border-white/10 overflow-hidden',
        'bg-background dark:bg-[#2a2e35]',
        'shadow-sm dark:shadow-[0_4px_18px_rgba(0,0,0,0.35)]',
      )}
    >
      <Table className="table-fixed min-w-[720px]">
        <TableHeader
          className={cn(
            p38Table.headerSolid,
            'bg-muted dark:bg-[#383e47] border-b-2 border-[#4a5240] dark:border-[#a4ce33]',
          )}
        >
          <TableRow className="hover:bg-transparent border-none">
            <TableHead className={cn(p38Table.head, 'w-8 px-1')} />
            <TableHead className={cn(p38Table.head, 'w-8 px-1')} />
            <TableHead className={cn(p38Table.head, 'min-w-0')}>LINHA / esquadra</TableHead>
            <TableHead className={cn(p38Table.head, p38Table.headRight, 'w-[52px]')}>SKUs</TableHead>
            <TableHead className={cn(p38Table.head, p38Table.headRight, 'w-[100px]')}>Estoque</TableHead>
            <TableHead className={cn(p38Table.head, p38Table.headRight, 'w-[88px]')}>Média 30d</TableHead>
            <TableHead className={cn(p38Table.head, p38Table.headRight, 'w-[88px]')}>P. futuro</TableHead>
            <TableHead className={cn(p38Table.head, p38Table.headRight, 'w-[56px]')}>Massa</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map((linha) => {
            const linhaOpen = openLinhas.has(linha.linha_codigo);
            const m = linha.metrics;
            const tone = resolveLinhaLed(linha);

            return (
              <React.Fragment key={linha.linha_codigo}>
                <TableRow
                  className={cn(
                    p38Table.row,
                    'bg-muted/40 dark:bg-[#343a42] h-10 border-l-[3px]',
                    BORDER_CLASS[tone],
                  )}
                >
                  <TableCell className={cn(p38Table.cell, 'w-8 px-1')}>
                    <button
                      type="button"
                      onClick={() => toggleLinha(linha.linha_codigo)}
                      className="flex h-7 w-7 items-center justify-center rounded hover:bg-secondary/40"
                      aria-expanded={linhaOpen}
                    >
                      <ChevronRight className={cn('h-4 w-4 transition-transform', linhaOpen && 'rotate-90')} />
                    </button>
                  </TableCell>
                  <TableCell className={cn(p38Table.cell, 'w-8 px-1')}>
                    <SupplyLed tone={tone} tip={linha.veredicto_linha} pulse={tone === 'ruptura' || tone === 'ruptura_pfut'} />
                  </TableCell>
                  <TableCell className={cn(p38Table.cell, 'min-w-0 max-w-0')}>
                    <span className="block truncate text-sm font-semibold">{linha.linha_nome}</span>
                  </TableCell>
                  <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[52px] text-sm')}>
                    {linha.resumo.sku_total}
                  </TableCell>
                  <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[100px]')}>
                    <Num value={m?.estoque_label} />
                  </TableCell>
                  <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[88px]')}>
                    <Num value={m?.media30_label} />
                  </TableCell>
                  <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[88px]')}>
                    <Num value={m?.ponto_futuro_label} negativo={m?.ponto_negativo} />
                  </TableCell>
                  <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[56px] text-xs tabular-nums')}>
                    {linha.resumo.esquadras_saldaveis}/{linha.resumo.esquadras_total}
                  </TableCell>
                </TableRow>
                {linhaOpen && (
                  <EsquadraRows
                    esquadras={linha.esquadras}
                    openSet={openEsquadras}
                    toggleOpen={toggleEsquadra}
                  />
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </P38TableShell>
  );
}

export default function PortalSmartSupplyPanel({ hierarchy, flatLines, somenteAlerta, loadingVelocity }) {
  const visibleLinhas = useMemo(() => {
    if (!somenteAlerta) return hierarchy || [];
    return (hierarchy || [])
      .map((linha) => ({
        ...linha,
        esquadras: linha.esquadras.filter((e) => e.alerta),
      }))
      .filter((linha) => linha.esquadras.length > 0 || linha.alerta);
  }, [hierarchy, somenteAlerta]);

  if (!flatLines?.length) {
    return (
      <div className="rounded-lg border border-border/40 dark:border-white/10 bg-muted/20 dark:bg-[#2f343c] p-8 text-center">
        <SupplyLed tone="alerta" className="mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Nenhuma esquadra no piloto.</p>
      </div>
    );
  }

  if (!visibleLinhas.length) {
    return (
      <div className="space-y-3">
        <RangerBar hierarchy={hierarchy} flatLines={flatLines} somenteAlerta={somenteAlerta} />
        <div className="rounded-lg border border-border/40 dark:border-white/10 bg-muted/20 dark:bg-emerald-950/10 p-8 text-center">
          <SupplyLed tone="off" className="mx-auto mb-3" />
          <p className="text-sm tabular-nums">0 alertas</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        <RangerBar hierarchy={hierarchy} flatLines={flatLines} somenteAlerta={somenteAlerta} />
        {loadingVelocity && (
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground px-1 tabular-nums">
            vendas 90d…
          </p>
        )}
        <SupplyTreeTable linhas={visibleLinhas} />
      </div>
    </TooltipProvider>
  );
}
