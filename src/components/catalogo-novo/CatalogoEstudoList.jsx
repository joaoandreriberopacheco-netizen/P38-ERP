import React, { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/components/utils';
import {
  CATALOGO_GRID_HEADER_BTN,
  CATALOGO_GRID_ROW,
  CATALOGO_LEVEL,
  CATALOGO_LEVEL_ROW,
  CATALOGO_LEVEL_TITLE,
  CATALOGO_LIST_SHELL,
  CATALOGO_SUBTITLE,
  CATALOGO_TITLE,
  CATALOGO_TIPO_CHIP,
} from '@/lib/catalogoP38Theme';
import { pathwayPapelLabel } from '@/lib/estudoCatalog/pathwayMeta';
import CatalogoLinhaMixTable from '@/components/catalogo-novo/CatalogoLinhaMixTable';

const TIPO_LABEL = { solo: 'Solo', mix: 'Mix', portfolio: 'Portfolio' };
const MAX_LEVEL = 8;

function TipoPill({ tipo }) {
  if (!tipo) return null;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 rounded-full border px-1.5 py-0 text-[9px] font-medium uppercase tracking-wide',
        CATALOGO_TIPO_CHIP[tipo] || CATALOGO_TIPO_CHIP.mix,
      )}
    >
      {TIPO_LABEL[tipo] || tipo}
    </span>
  );
}

function StockBadge({ label, virtual, className }) {
  if (!label || label === '—') return null;
  return (
    <span
      className={cn(
        'text-[11px] tabular-nums shrink-0 font-medium',
        virtual ? 'text-[#a8942e] dark:text-[#A8B56E]' : 'text-muted-foreground',
        className,
      )}
    >
      {label}
    </span>
  );
}

function GridLevel({ level, children }) {
  const lv = Math.min(Math.max(level, 0), MAX_LEVEL);
  return (
    <div className={cn(CATALOGO_LEVEL[lv], CATALOGO_LEVEL_ROW[lv])}>
      {children}
    </div>
  );
}

function GridHeader({ level, open, onToggle, title, subtitle, meta, stockLabel, stockVirtual, comfortable }) {
  return (
    <GridLevel level={level}>
      <div className={CATALOGO_GRID_ROW}>
        <button
          type="button"
          onClick={onToggle}
          className={cn(CATALOGO_GRID_HEADER_BTN, comfortable && 'py-3 min-h-[48px]')}
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 shrink-0 mt-0.5 transition-transform text-[#a8942e] dark:text-[#A8B56E]',
              open && 'rotate-90',
            )}
          />
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <p className={cn(CATALOGO_TITLE, CATALOGO_LEVEL_TITLE[level], 'flex-1 min-w-0')}>{title}</p>
              {meta}
            </div>
            {subtitle ? <p className={CATALOGO_SUBTITLE}>{subtitle}</p> : null}
          </div>
          <StockBadge label={stockLabel} virtual={stockVirtual} />
        </button>
      </div>
    </GridLevel>
  );
}

function LinhaBlock({ linha, filtroTipos, comfortable, level = 5 }) {
  const [open, setOpen] = useState(false);

  if (filtroTipos?.size && !filtroTipos.has(linha.linha_tipo)) return null;

  const pcs = linha.pcs || [];
  const solos = linha.solos || [];
  const title = linha.pathway_sufixo
    ? `${linha.linha_nome || linha.linha_display} ·${linha.pathway_sufixo}`
    : (linha.linha_nome || linha.linha_display);
  const skuCount = linha.sku_count ?? pcs.reduce((a, p) => a + p.skus.length, 0) + solos.length;
  const pcCount = pcs.length || (linha.linha_tipo === 'solo' ? 1 : 0);

  return (
    <>
      <GridHeader
        level={level}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        title={title}
        subtitle={`${pcCount} produto(s) compra · ${skuCount} SKU(s)`}
        meta={<TipoPill tipo={linha.linha_tipo} />}
        stockLabel={linha.estoque_label}
        stockVirtual={pcs.concat(solos).some((s) => s.skus?.some?.((x) => x.estoque_virtual) || s.estoque_virtual)}
        comfortable={comfortable}
      />
      {open ? (
        <GridLevel level={level + 1}>
          <CatalogoLinhaMixTable linha={linha} />
        </GridLevel>
      ) : null}
    </>
  );
}

function PathwayBlock({ pathway, filtroTipos, comfortable, level = 4 }) {
  const [open, setOpen] = useState(pathway.pathway_papel === 'nucleo');
  const linhas = (pathway.linhas || []).filter((lin) => !filtroTipos?.size || filtroTipos.has(lin.linha_tipo));
  if (!linhas.length) return null;

  const hidePathwayHeader = pathway.pathway_papel === 'default' && linhas.length === 1;

  if (hidePathwayHeader) {
    return linhas.map((linha) => (
      <LinhaBlock key={linha.linha_pathway_key} linha={linha} filtroTipos={filtroTipos} comfortable={comfortable} level={level} />
    ));
  }

  return (
    <>
      <GridHeader
        level={level}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        title={pathwayPapelLabel(pathway.pathway_papel)}
        subtitle={`${linhas.length} LINHA(s)`}
        stockLabel={pathway.estoque_label}
        comfortable={comfortable}
      />
      {open && linhas.map((linha) => (
        <LinhaBlock key={linha.linha_pathway_key} linha={linha} filtroTipos={filtroTipos} comfortable={comfortable} level={level + 1} />
      ))}
    </>
  );
}

function CoreBlock({ coreNode, filtroTipos, comfortable, level = 3 }) {
  const [open, setOpen] = useState(true);
  const pathways = coreNode.pathways || [];
  const linhaCount = pathways.reduce((a, p) => a + (p.linhas?.length || 0), 0);

  return (
    <>
      <GridHeader
        level={level}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        title={coreNode.core}
        subtitle={`${pathways.length} papel(is) · ${linhaCount} LINHA(s)`}
        stockLabel={coreNode.estoque_label}
        comfortable={comfortable}
      />
      {open && pathways.map((pw) => (
        <PathwayBlock key={pw.pathway_papel} pathway={pw} filtroTipos={filtroTipos} comfortable={comfortable} level={level + 1} />
      ))}
    </>
  );
}

function GrupoBlock({ grupoNode, filtroTipos, comfortable }) {
  const [open, setOpen] = useState(true);
  const cores = grupoNode.cores || [];
  const hasGrupo = Boolean(grupoNode.grupo);
  const coreLevel = hasGrupo ? 3 : 2;

  if (!hasGrupo) {
    return cores.map((coreNode) => (
      <CoreBlock key={coreNode.core} coreNode={coreNode} filtroTipos={filtroTipos} comfortable={comfortable} level={coreLevel} />
    ));
  }

  return (
    <>
      <GridHeader
        level={2}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        title={grupoNode.grupo}
        subtitle={grupoNode.sku_count != null ? `${cores.length} core(s) · ${grupoNode.sku_count} SKU(s)` : `${cores.length} core(s)`}
        stockLabel={grupoNode.estoque_label}
        comfortable={comfortable}
      />
      {open && cores.map((coreNode) => (
        <CoreBlock key={coreNode.core} coreNode={coreNode} filtroTipos={filtroTipos} comfortable={comfortable} level={coreLevel} />
      ))}
    </>
  );
}

function SubBlocoBlock({ sub, filtroTipos, comfortable }) {
  const [open, setOpen] = useState(true);
  const grupos = sub.grupos || [];
  const grupoCount = grupos.filter((g) => g.grupo).length || grupos.length;

  return (
    <>
      <GridHeader
        level={1}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        title={sub.sub_bloco}
        subtitle={sub.sku_count != null ? `${grupoCount} grupo(s) · ${sub.sku_count} SKU(s)` : `${grupoCount} grupo(s)`}
        stockLabel={sub.estoque_label}
        comfortable={comfortable}
      />
      {open && grupos.map((grupoNode) => (
        <GrupoBlock key={grupoNode.grupo || '__direct__'} grupoNode={grupoNode} filtroTipos={filtroTipos} comfortable={comfortable} />
      ))}
    </>
  );
}

function BlocoBlock({ bloco, filtroTipos, comfortable }) {
  const [open, setOpen] = useState(true);

  return (
    <>
      <GridHeader
        level={0}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        title={bloco.bloco}
        subtitle={`${bloco.sub_blocos?.length || 0} ramo(s)`}
        comfortable={comfortable}
      />
      {open && (bloco.sub_blocos || []).map((sub) => (
        <SubBlocoBlock key={sub.sub_bloco} sub={sub} filtroTipos={filtroTipos} comfortable={comfortable} />
      ))}
    </>
  );
}

/** Catálogo: árvore + tabela mix por LINHA (Produto compra | SKUs | Eixos). */
export default function CatalogoEstudoList({ tree, filtroTipos, mobileComfortable = false }) {
  const visible = useMemo(() => tree || [], [tree]);

  if (!visible.length) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Nada encontrado com estes filtros.
      </div>
    );
  }

  return (
    <div className={CATALOGO_LIST_SHELL}>
      {visible.map((bloco) => (
        <BlocoBlock key={bloco.bloco} bloco={bloco} filtroTipos={filtroTipos} comfortable={mobileComfortable} />
      ))}
    </div>
  );
}
