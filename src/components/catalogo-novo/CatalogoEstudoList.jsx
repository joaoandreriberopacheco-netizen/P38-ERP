import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/components/utils';
import {
  CATALOGO_DRILL_BACK,
  CATALOGO_DRILL_BREADCRUMB,
  CATALOGO_DRILL_BREADCRUMB_CHIP,
  CATALOGO_DRILL_BREADCRUMB_SEP,
  CATALOGO_DRILL_LEVEL_LABEL,
  CATALOGO_DRILL_LIST,
  CATALOGO_DRILL_ROW,
  CATALOGO_DRILL_ROW_BTN,
  CATALOGO_DRILL_ROW_META,
  CATALOGO_DRILL_ROW_TITLE,
  CATALOGO_LIST_SHELL,
  CATALOGO_TIPO_CHIP,
} from '@/lib/catalogoP38Theme';
import {
  drillBack,
  drillBreadcrumb,
  drillEnter,
  getDrillLevel,
} from '@/lib/estudoCatalog/catalogoEstudoDrill';
import CatalogoLinhaMixTable from '@/components/catalogo-novo/CatalogoLinhaMixTable';

const TIPO_LABEL = { solo: 'Solo', mix: 'Mix', portfolio: 'Portfolio' };

function TipoPill({ tipo }) {
  if (!tipo) return null;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 rounded border px-1 py-0 text-[9px] font-medium uppercase',
        CATALOGO_TIPO_CHIP[tipo] || CATALOGO_TIPO_CHIP.mix,
      )}
    >
      {TIPO_LABEL[tipo] || tipo}
    </span>
  );
}

function LinhaRow({ item, openKey, onToggle }) {
  const open = openKey === item.key;
  const { linha } = item;

  return (
    <div className="border-b border-border/20 dark:border-white/[0.04] last:border-b-0">
      <button
        type="button"
        onClick={() => onToggle(item.key)}
        className={cn(CATALOGO_DRILL_ROW_BTN, open && 'bg-muted/20 dark:bg-white/[0.03]')}
      >
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-[#a8942e] dark:text-[#A8B56E] transition-transform',
            open && 'rotate-90',
          )}
        />
        <span className={CATALOGO_DRILL_ROW_TITLE}>{item.label}</span>
        <TipoPill tipo={linha.linha_tipo} />
        <span className={CATALOGO_DRILL_ROW_META}>{item.meta}</span>
      </button>
      {open ? (
        <div className="px-2 pb-2 pt-0">
          <CatalogoLinhaMixTable linha={linha} />
        </div>
      ) : null}
    </div>
  );
}

/** Catálogo: drill-down (1 nível de cada vez) + tabela mix ao abrir LINHA. */
export default function CatalogoEstudoList({ tree, filtroTipos, mobileComfortable = false }) {
  const [path, setPath] = useState([]);
  const [openLinhaKey, setOpenLinhaKey] = useState(null);

  const crumbs = useMemo(() => drillBreadcrumb(path), [path]);
  const level = useMemo(() => getDrillLevel(path, tree, filtroTipos), [path, tree, filtroTipos]);

  useEffect(() => {
    setPath([]);
    setOpenLinhaKey(null);
  }, [tree, filtroTipos]);

  if (!tree?.length) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Nada encontrado com estes filtros.
      </div>
    );
  }

  const handleEnter = (item) => {
    setOpenLinhaKey(null);
    setPath((p) => drillEnter(p, item, tree, filtroTipos));
  };

  const handleBack = () => {
    setOpenLinhaKey(null);
    setPath((p) => drillBack(p));
  };

  const handleCrumb = (index) => {
    setOpenLinhaKey(null);
    setPath((p) => drillBack(p, index));
  };

  return (
    <div className={CATALOGO_LIST_SHELL}>
      {path.length > 0 ? (
        <div className="border-b border-border/25 dark:border-white/[0.06] px-2 py-2 space-y-1.5">
          <button type="button" onClick={handleBack} className={CATALOGO_DRILL_BACK}>
            <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
            Voltar
          </button>
          <nav className={CATALOGO_DRILL_BREADCRUMB} aria-label="Caminho no catálogo">
            {crumbs.map((crumb, i) => (
              <React.Fragment key={`${crumb.kind}-${crumb.key}`}>
                {i > 0 ? <span className={CATALOGO_DRILL_BREADCRUMB_SEP} aria-hidden>/</span> : null}
                <button
                  type="button"
                  onClick={() => handleCrumb(crumb.index)}
                  className={CATALOGO_DRILL_BREADCRUMB_CHIP}
                  title={crumb.label}
                >
                  {crumb.label}
                </button>
              </React.Fragment>
            ))}
          </nav>
        </div>
      ) : null}

      <p className={cn(CATALOGO_DRILL_LEVEL_LABEL, mobileComfortable && 'py-2')}>
        {level.label}
      </p>

      <div className={CATALOGO_DRILL_LIST}>
        {level.kind === 'linhas'
          ? level.items.map((item) => (
              <LinhaRow
                key={item.key}
                item={item}
                openKey={openLinhaKey}
                onToggle={(key) => setOpenLinhaKey((cur) => (cur === key ? null : key))}
              />
            ))
          : level.items.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => handleEnter(item)}
                className={CATALOGO_DRILL_ROW}
              >
                <span className={CATALOGO_DRILL_ROW_TITLE}>{item.label}</span>
                {item.meta ? <span className={CATALOGO_DRILL_ROW_META}>{item.meta}</span> : null}
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70 ml-1" />
              </button>
            ))}
      </div>

      {!level.items.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground px-3">
          Sem itens neste ramo com os filtros actuais.
        </p>
      ) : null}
    </div>
  );
}
