import React, { useMemo, useState } from 'react';
import { ChevronRight, AlertTriangle, CheckCircle2, Info, Layers, Package } from 'lucide-react';
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
import { summarizePortalSupply } from '@/lib/hierarquiaPortal/buildPortalSupplyHierarchy';
import PortalSupplyBridgeActions from '@/components/hierarquia-portal/PortalSupplyBridgeActions';

const TIPO_LABEL = { solo: 'Solo', mix: 'Mix', portfolio: 'Portfolio' };

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

function MetricCell({ label, negativo }) {
  if (!label || label === '—') return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn('tabular-nums text-sm whitespace-nowrap', negativo && 'text-red-600 dark:text-red-400 font-medium')}>
      {label}
    </span>
  );
}

function SupplySummary({ hierarchy, flatLines, somenteAlerta }) {
  const stats = useMemo(() => summarizePortalSupply(flatLines), [flatLines]);
  const linhas = hierarchy?.length ?? 0;

  return (
    <div className="rounded-lg border border-violet-500/30 bg-violet-50/50 dark:bg-violet-950/20 px-4 py-3 space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span><strong>{linhas}</strong> LINHA(s) piloto</span>
        <span><strong>{stats.total}</strong> esquadra(s)</span>
        <span className="text-green-700 dark:text-green-400"><strong>{stats.saldaveis}</strong> saldável(eis)</span>
        <span className="text-amber-700 dark:text-amber-300"><strong>{stats.alertas}</strong> em alerta</span>
        {somenteAlerta && <span className="text-xs text-muted-foreground">(filtro: só alertas)</span>}
      </div>
      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>
          SMART SUPPLY observa a <strong>LINHA</strong> e consolida dos SKUs: estoque vitrine, média 30d e ponto futuro.
          O <strong>catálogo</strong> cuida do cadastro; daqui sai a <strong>ponte para cotação</strong> ao fornecedor (Sugestões de Compra).
          Regra cerâmica piloto: {CERAM_META_VAGAS} pos · {CERAM_MASSA_CRITICA_CX} CX · ≥ {CERAM_MIN_LINHAS_SALDAVEL} linhas saldáveis.
        </span>
      </p>
    </div>
  );
}

function SkuDetailList({ skus, massaCritica }) {
  return (
    <ul className="space-y-1">
      {skus.map((s) => {
        const cx = portalEstoqueCx(s);
        const ok = atingeMassaCriticaCeramica(cx, massaCritica);
        return (
          <li
            key={s.produto.id}
            className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-xs border-b border-border/30 dark:border-white/5 py-1.5 last:border-0 items-center"
          >
            <span className="truncate text-foreground/90">{s.produto.nome}</span>
            <MetricCell label={s.estoque_label} negativo={cx <= 0} />
            <MetricCell label={s.media30_label} />
            <MetricCell label={s.ponto_futuro_label} negativo={s.ponto_negativo} />
          </li>
        );
      })}
    </ul>
  );
}

function EsquadraRow({ line, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const m = line.metrics;

  return (
    <>
      <TableRow className={cn(p38Table.row, 'bg-background/90 dark:bg-[#2a2e35]/90 text-sm')}>
        <TableCell className={cn(p38Table.cell, 'w-8 px-1')}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-secondary/40 ml-4"
          >
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
          </button>
        </TableCell>
        <TableCell className={cn(p38Table.cell, 'min-w-0')}>
          <div className="flex items-center gap-2 flex-wrap pl-2">
            <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium truncate">{line.produto_compra_nome}</span>
            <VeredictoBadge tom={line.veredicto_tom} saldavel={line.saldavel} />
          </div>
          <p className="text-[10px] text-muted-foreground pl-7 mt-0.5 truncate">{line.veredicto}</p>
          <div className="pl-7 mt-1">
            <PortalSupplyBridgeActions
              compact
              linhaCodigo={line.linha_codigo}
              linhaNome={line.linha_nome}
              produtoCompraNome={line.produto_compra_nome}
              pontoFuturoLabel={m?.ponto_futuro_label}
              veredicto={line.veredicto}
            />
          </div>
        </TableCell>
        <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[52px]')}>{line.sku_count}</TableCell>
        <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[100px]')}>
          <MetricCell label={m?.estoque_label} />
        </TableCell>
        <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[88px]')}>
          <MetricCell label={m?.media30_label} />
        </TableCell>
        <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[88px]')}>
          <MetricCell label={m?.ponto_futuro_label} negativo={m?.ponto_negativo} />
        </TableCell>
        <TableCell className={cn(p38Table.cell, p38Table.cellNumeric, 'w-[56px]')}>
          <span className="text-xs tabular-nums">{line.linhas_com_massa_critica}/{CERAM_MIN_LINHAS_SALDAVEL}</span>
        </TableCell>
      </TableRow>
      {open && (
        <TableRow className="bg-muted/10 dark:bg-[#252830]">
          <TableCell colSpan={7} className={cn(p38Table.cell, 'py-2 pl-12')}>
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground mb-1 grid grid-cols-[1fr_auto_auto_auto] gap-2">
              <span>SKU</span><span>Estoque</span><span>Média 30d</span><span>P. futuro</span>
            </p>
            <SkuDetailList skus={line.skus} massaCritica={line.massa_critica} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function LinhaBlock({ linha, somenteAlerta }) {
  const [open, setOpen] = useState(true);
  const esquadras = somenteAlerta ? linha.esquadras.filter((e) => e.alerta) : linha.esquadras;
  if (!esquadras.length) return null;

  const m = linha.metrics;
  const r = linha.resumo;

  return (
    <div className="border-b border-border/40 dark:border-white/10 last:border-0">
      <div
        className={cn(
          'w-full grid grid-cols-[auto_1fr_repeat(5,auto)] gap-x-3 gap-y-1 items-center px-3 py-3',
          'bg-muted/40 dark:bg-[#343a42]',
          linha.alerta && 'border-l-2 border-l-amber-500',
          !linha.alerta && r.esquadras_saldaveis === r.esquadras_total && 'border-l-2 border-l-green-600/60',
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-8 w-8 items-center justify-center rounded hover:bg-secondary/40"
          aria-expanded={open}
        >
          <ChevronRight className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-90')} />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-semibold text-sm">{linha.linha_nome}</span>
            <Badge variant="outline" className="text-[10px]">{TIPO_LABEL[linha.linha_tipo] || linha.linha_tipo}</Badge>
            <span className="text-[10px] text-muted-foreground">{r.esquadras_saldaveis}/{r.esquadras_total} esquadras saldáveis · {r.sku_total} SKUs</span>
          </div>
          <p className={cn(
            'text-[11px] mt-1 leading-snug',
            linha.veredicto_tom === 'ok' && 'text-green-700 dark:text-green-400',
            linha.veredicto_tom === 'alerta' && 'text-amber-800 dark:text-amber-200',
          )}
          >
            {linha.veredicto_linha}
          </p>
          <PortalSupplyBridgeActions
            linhaCodigo={linha.linha_codigo}
            linhaNome={linha.linha_nome}
            pontoFuturoLabel={m?.ponto_futuro_label}
            veredicto={linha.veredicto_linha}
          />
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-[9px] uppercase text-muted-foreground">Estoque</p>
          <MetricCell label={m?.estoque_label} />
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-[9px] uppercase text-muted-foreground">Média 30d</p>
          <MetricCell label={m?.media30_label} />
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-[9px] uppercase text-muted-foreground">P. futuro</p>
          <MetricCell label={m?.ponto_futuro_label} negativo={m?.ponto_negativo} />
        </div>
        <div className="text-right hidden md:block w-16" />
      </div>

      {open && (
        <Table className="table-auto">
          <TableBody>
            {esquadras.map((eq) => (
              <EsquadraRow key={eq.key} line={eq} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
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
      <div className="rounded-lg border border-border/40 dark:border-white/10 bg-muted/20 dark:bg-[#2f343c] p-8 text-center space-y-2">
        <p className="text-sm text-muted-foreground">Nenhuma esquadra no piloto cerâmica.</p>
        <p className="text-xs text-muted-foreground">Verifique se os SKUs do Excel existem no cadastro (código interno).</p>
      </div>
    );
  }

  if (!visibleLinhas.length) {
    return (
      <div className="space-y-3">
        <SupplySummary hierarchy={hierarchy} flatLines={flatLines} somenteAlerta={somenteAlerta} />
        <div className="rounded-lg border border-green-500/30 bg-green-50/30 dark:bg-green-950/20 p-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-green-800 dark:text-green-200">Nenhuma LINHA em alerta</p>
          <p className="text-xs text-muted-foreground mt-1">Estoque e giro dentro do esperado nas esquadras visíveis.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SupplySummary hierarchy={hierarchy} flatLines={flatLines} somenteAlerta={somenteAlerta} />
      {loadingVelocity && (
        <p className="text-[11px] text-muted-foreground px-1">A carregar vendas 90d para calcular giro e ponto futuro…</p>
      )}

      <P38TableShell
        className={cn(
          'max-h-[min(72vh,900px)] border-border/40 dark:border-white/10 overflow-hidden',
          'bg-background dark:bg-[#2a2e35]',
          'shadow-sm dark:shadow-[0_4px_18px_rgba(0,0,0,0.35)]',
        )}
      >
        <div className={cn(
          p38Table.headerSolid,
          'bg-muted dark:bg-[#383e47] border-b-2 border-[#4a5240] dark:border-[#a4ce33]',
          'grid grid-cols-[auto_1fr_repeat(5,auto)] gap-x-3 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground',
        )}
        >
          <span className="w-4" />
          <span>LINHA / esquadra</span>
          <span className="text-right w-[52px] hidden sm:inline">SKUs</span>
          <span className="text-right w-[100px] hidden sm:inline">Estoque</span>
          <span className="text-right w-[88px] hidden sm:inline">Média 30d</span>
          <span className="text-right w-[88px] hidden sm:inline">P. futuro</span>
          <span className="text-right w-[56px] hidden md:inline">Massa</span>
        </div>
        <div className="overflow-y-auto max-h-[min(65vh,820px)]">
          {visibleLinhas.map((linha) => (
            <LinhaBlock key={linha.linha_codigo} linha={linha} somenteAlerta={somenteAlerta} />
          ))}
        </div>
      </P38TableShell>
    </div>
  );
}
