import React, { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/components/utils';
import { CERAM_MIN_LINHAS_SALDAVEL } from '@/lib/modeloCatalogo/regrasCeramica';
import { summarizePortalSupply } from '@/lib/hierarquiaPortal/buildPortalSupplyHierarchy';
import {
  CATALOGO_HIER_L1,
  CATALOGO_HIER_L2,
  CATALOGO_HIER_L3,
  CATALOGO_KPI_STRIP,
  CATALOGO_LIST_SHELL,
  CATALOGO_ROW_BASE,
  CATALOGO_SEP,
  CATALOGO_SUBTITLE,
  CATALOGO_TITLE,
  CATALOGO_TIPO_CHIP,
  CATALOGO_SUPPLY_BORDER,
  CATALOGO_VIEW_TAB,
  CATALOGO_VIEW_TAB_GROUP,
} from '@/lib/catalogoP38Theme';
import {
  resolveEsquadraSupplyTone,
  resolveLinhaSupplyTone,
  resolveSkuSupplyTone,
} from '@/lib/catalogoSupplyTone';
import { montarNomePortalSku } from '@/lib/hierarquiaPortal/montarNomePortalSku';
import CatalogoSupplyLed from '@/components/catalogo-novo/CatalogoSupplyLed';

const SUPPLY_VIEWS = [
  { id: 'mobile', label: 'Mobile', tipos: null },
  { id: 'mix', label: 'Mix', tipos: new Set(['mix']) },
  { id: 'portfolio', label: 'Portfolio', tipos: new Set(['portfolio']) },
];

function filterHierarchyByTipos(hierarchy, tipos) {
  if (!tipos) return hierarchy || [];
  return (hierarchy || [])
    .filter((l) => tipos.has(l.linha_tipo))
    .map((l) => ({ ...l }));
}

function filterLinesByTipos(lines, tipos) {
  if (!tipos) return lines || [];
  return (lines || []).filter((l) => tipos.has(l.linha_tipo));
}

function Metric({ label, value, neg }) {
  return (
    <span className={cn('tabular-nums', neg && 'text-red-600 dark:text-red-400 font-medium')}>
      {value ?? '—'}
    </span>
  );
}

function SkuSupplyRows({ skus, massaCritica }) {
  return skus.map((s) => {
    const tone = resolveSkuSupplyTone(s, massaCritica);
    const label = montarNomePortalSku(s);
    return (
      <div key={s.produto?.id} className={cn(CATALOGO_HIER_L3, CATALOGO_SEP)}>
        <div className={cn(CATALOGO_ROW_BASE, 'pl-3 cursor-default hover:bg-transparent', CATALOGO_SUPPLY_BORDER[tone])}>
          <div className="flex items-start gap-1.5 min-w-0">
            <CatalogoSupplyLed tone={tone} pulse={tone === 'ruptura' || tone === 'ruptura_pfut'} />
            <p className={cn(CATALOGO_SUBTITLE, 'flex-1 text-foreground/85')}>{label}</p>
            <Metric value={s.estoque_label} neg={tone === 'ruptura'} />
          </div>
        </div>
      </div>
    );
  });
}

function EsquadraRow({ eq, open, onToggle, isLast, comfortable = false }) {
  const tone = resolveEsquadraSupplyTone(eq);
  const m = eq.metrics;

  return (
    <>
      <div className={cn(!isLast && !open && CATALOGO_SEP, CATALOGO_HIER_L2)}>
        <button
          type="button"
          onClick={onToggle}
          className={cn(CATALOGO_ROW_BASE, 'pl-3', CATALOGO_SUPPLY_BORDER[tone], comfortable && 'py-3 min-h-[48px]')}
        >
          <div className="flex items-start gap-1.5 min-w-0 w-full">
            <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 mt-0.5 transition-transform', open && 'rotate-90')} />
            <CatalogoSupplyLed tone={tone} pulse={tone === 'ruptura' || tone === 'ruptura_pfut'} />
            <div className="flex-1 min-w-0 space-y-0.5">
              <p className={CATALOGO_TITLE}>{eq.produto_compra_nome}</p>
              <p className={CATALOGO_SUBTITLE}>
                {eq.sku_count} SKU · est. {m?.estoque_label || '—'} · P.fut {m?.ponto_futuro_label || '—'}
              </p>
            </div>
            <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">
              {eq.linhas_com_massa_critica}/{CERAM_MIN_LINHAS_SALDAVEL}
            </span>
          </div>
        </button>
      </div>
      {open && <SkuSupplyRows skus={eq.skus} massaCritica={eq.massa_critica} />}
    </>
  );
}

function LinhaSupplyBlock({ linha, comfortable = false }) {
  const [open, setOpen] = useState(true);
  const [openEq, setOpenEq] = useState(() => new Set());
  const tone = resolveLinhaSupplyTone(linha);
  const m = linha.metrics;

  const toggleEq = (key) => {
    setOpenEq((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className={CATALOGO_SEP}>
      <div className={CATALOGO_HIER_L1}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(CATALOGO_ROW_BASE, 'pl-2', CATALOGO_SUPPLY_BORDER[tone], comfortable && 'py-3 min-h-[52px]')}
        >
          <div className="flex items-start gap-1.5 min-w-0 w-full">
            <ChevronRight className={cn('h-4 w-4 shrink-0 mt-0.5 transition-transform', open && 'rotate-90')} />
            <CatalogoSupplyLed tone={tone} pulse={tone === 'ruptura' || tone === 'ruptura_pfut'} />
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={cn(CATALOGO_TITLE, 'flex-1 min-w-0')}>{linha.linha_nome}</p>
                <span
                  className={cn(
                    'text-[9px] uppercase px-1.5 py-0 rounded-full border',
                    CATALOGO_TIPO_CHIP[linha.linha_tipo] || CATALOGO_TIPO_CHIP.mix,
                  )}
                >
                  {linha.linha_tipo}
                </span>
              </div>
              <p className={CATALOGO_SUBTITLE}>
                {linha.resumo?.sku_total} SKU · {linha.resumo?.esquadras_saldaveis}/{linha.resumo?.esquadras_total} saldáveis
              </p>
            </div>
            <div className="text-right shrink-0 text-[10px] text-muted-foreground tabular-nums">
              <div>{m?.estoque_label}</div>
              <div className={m?.ponto_negativo ? 'text-red-600 dark:text-red-400' : ''}>{m?.ponto_futuro_label}</div>
            </div>
          </div>
        </button>
      </div>
      {open && (linha.esquadras || []).map((eq, idx) => (
        <EsquadraRow
          key={eq.key}
          eq={eq}
          open={openEq.has(eq.key)}
          onToggle={() => toggleEq(eq.key)}
          isLast={idx === linha.esquadras.length - 1}
          comfortable={comfortable}
        />
      ))}
    </div>
  );
}

function SupplyKpiBar({ flatLines, linhasVisiveis }) {
  const stats = useMemo(() => summarizePortalSupply(flatLines), [flatLines]);
  return (
    <div className={CATALOGO_KPI_STRIP}>
      <span><strong>{linhasVisiveis}</strong> LINHA</span>
      <span className="text-muted-foreground">·</span>
      <span><strong>{stats.total}</strong> esq</span>
      <span className="text-muted-foreground">·</span>
      <span className="inline-flex items-center gap-1">
        <CatalogoSupplyLed tone="off" />
        <strong>{stats.saldaveis}</strong>
      </span>
      <span className="text-muted-foreground">·</span>
      <span className="inline-flex items-center gap-1">
        <CatalogoSupplyLed tone={stats.alertas > 0 ? 'alerta' : 'off'} pulse={stats.alertas > 0} />
        <strong>{stats.alertas}</strong> alerta
      </span>
    </div>
  );
}

export default function CatalogoSmartSupplyPanel({
  hierarchy,
  flatLines,
  somenteAlerta,
  loadingVelocity,
  view,
  onViewChange,
  mobileComfortable = false,
}) {
  const activeView = SUPPLY_VIEWS.find((v) => v.id === view) || SUPPLY_VIEWS[0];

  const visibleHierarchy = useMemo(() => {
    let rows = filterHierarchyByTipos(hierarchy, activeView.tipos);
    if (somenteAlerta) {
      rows = rows
        .map((linha) => ({
          ...linha,
          esquadras: (linha.esquadras || []).filter((e) => e.alerta),
        }))
        .filter((linha) => linha.esquadras.length > 0 || linha.alerta);
    }
    return rows;
  }, [hierarchy, activeView.tipos, somenteAlerta]);

  const visibleFlat = useMemo(
    () => filterLinesByTipos(flatLines, activeView.tipos),
    [flatLines, activeView.tipos],
  );

  if (!flatLines?.length) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        <CatalogoSupplyLed tone="alerta" className="mx-auto mb-2" />
        Nenhuma esquadra no piloto.
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <div className={cn(CATALOGO_VIEW_TAB_GROUP, mobileComfortable && 'sticky top-0 z-10 -mx-1 px-1 py-1 bg-background/95 backdrop-blur-sm border-b border-border/20')} role="tablist" aria-label="Visão SMART SUPPLY">
        {SUPPLY_VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            data-active={view === v.id}
            onClick={() => onViewChange(v.id)}
            className={cn(CATALOGO_VIEW_TAB, mobileComfortable && 'py-3 text-xs')}
          >
            {v.label}
          </button>
        ))}
      </div>

      <SupplyKpiBar flatLines={visibleFlat} linhasVisiveis={visibleHierarchy.length} />

      {loadingVelocity && (
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground px-3 py-1 tabular-nums">
          vendas 90d…
        </p>
      )}

      {!visibleHierarchy.length ? (
        <div className={cn(CATALOGO_LIST_SHELL, 'py-10 text-center text-sm text-muted-foreground')}>
          <CatalogoSupplyLed tone="off" className="mx-auto mb-2" />
          0 alertas nesta visão
        </div>
      ) : (
        <div className={CATALOGO_LIST_SHELL}>
          {visibleHierarchy.map((linha) => (
            <LinhaSupplyBlock key={linha.linha_codigo} linha={linha} comfortable={mobileComfortable} />
          ))}
        </div>
      )}
    </div>
  );
}

export { SUPPLY_VIEWS };
