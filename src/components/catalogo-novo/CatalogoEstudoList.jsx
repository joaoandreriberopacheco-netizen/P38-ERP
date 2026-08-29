import React, { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/components/utils';
import {
  CATALOGO_LEVEL,
  CATALOGO_LEVEL_ROW,
  CATALOGO_LEVEL_TITLE,
  CATALOGO_LIST_SHELL,
  CATALOGO_ROW_BASE,
  CATALOGO_SEP,
  CATALOGO_SUBTITLE,
  CATALOGO_TITLE,
  CATALOGO_TIPO_CHIP,
  CATALOGO_SUPPLY_BORDER,
} from '@/lib/catalogoP38Theme';
import { pathwayPapelLabel } from '@/lib/estudoCatalog/pathwayMeta';
import CatalogoSupplyLed from '@/components/catalogo-novo/CatalogoSupplyLed';

const TIPO_LABEL = { solo: 'Solo', mix: 'Mix', portfolio: 'Portfolio' };

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

function HierButton({ level, open, onToggle, title, subtitle, meta, stockLabel, stockVirtual, comfortable, children }) {
  return (
    <div className={cn(CATALOGO_LEVEL[level], CATALOGO_LEVEL_ROW[level], !open && CATALOGO_SEP)}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          CATALOGO_ROW_BASE,
          'border-l-0 w-full',
          comfortable && 'py-3 min-h-[48px]',
        )}
      >
        <div className="flex items-start gap-1.5 min-w-0 w-full">
          <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 mt-0.5 transition-transform text-[#a8942e] dark:text-[#A8B56E]', open && 'rotate-90')} />
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <p className={cn(CATALOGO_TITLE, CATALOGO_LEVEL_TITLE[level], 'flex-1 min-w-0')}>{title}</p>
              {meta}
            </div>
            {subtitle ? <p className={CATALOGO_SUBTITLE}>{subtitle}</p> : null}
          </div>
          <StockBadge label={stockLabel} virtual={stockVirtual} />
        </div>
      </button>
      {open ? children : null}
    </div>
  );
}

function SkuRow({ row, isLast, comfortable, level = 6 }) {
  const tone = row.zerado ? 'ruptura' : row.abaixo_ponto ? 'alerta' : row.alerta_estudo ? 'alerta_escuro' : 'off';
  const meta = [row.eixo_a, row.eixo_b].filter(Boolean).join(' · ');

  return (
    <div className={cn(CATALOGO_LEVEL[level], !isLast && CATALOGO_SEP)}>
      <div
        className={cn(
          CATALOGO_ROW_BASE,
          'border-l-0 cursor-default hover:bg-transparent',
          comfortable && 'py-3.5 min-h-[52px]',
          CATALOGO_SUPPLY_BORDER[tone],
        )}
      >
        <div className="flex items-start gap-1.5 min-w-0">
          <CatalogoSupplyLed tone={tone} pulse={tone === 'ruptura'} />
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className={cn(CATALOGO_SUBTITLE, 'text-foreground/90 line-clamp-2 normal-case')}>
              {row.novo_sku || row.sku_atual}
            </p>
            <p className="text-[10px] text-muted-foreground/70 tabular-nums">
              {[row.codigo_interno, meta, row.estoque_encontrado ? null : 'estoque sim.'].filter(Boolean).join(' · ')}
            </p>
          </div>
          <StockBadge label={row.estoque_label} virtual={row.estoque_virtual} />
        </div>
      </div>
    </div>
  );
}

function ProdutoCompraBlock({ pc, open, onToggle, isLast, comfortable }) {
  const skus = pc.skus || [];
  return (
    <>
      <HierButton
        level={5}
        open={open}
        onToggle={onToggle}
        title={pc.produto_compra_nome}
        subtitle={`${skus.length} SKU(s)`}
        stockLabel={pc.estoque_label}
        stockVirtual={skus.some((s) => s.estoque_virtual)}
        comfortable={comfortable}
      />
      {open && skus.map((s, i) => (
        <SkuRow key={s.codigo_interno || i} row={s} isLast={isLast && i === skus.length - 1} comfortable={comfortable} />
      ))}
    </>
  );
}

function LinhaBlock({ linha, filtroTipos, comfortable }) {
  const [open, setOpen] = useState(false);
  const [openPc, setOpenPc] = useState(() => new Set());

  if (filtroTipos?.size && !filtroTipos.has(linha.linha_tipo)) return null;

  const pcs = linha.pcs || [];
  const solos = linha.solos || [];
  const title = linha.pathway_sufixo
    ? `${linha.linha_nome || linha.linha_display} ·${linha.pathway_sufixo}`
    : (linha.linha_nome || linha.linha_display);

  const togglePc = (codigo) => {
    setOpenPc((prev) => {
      const next = new Set(prev);
      if (next.has(codigo)) next.delete(codigo);
      else next.add(codigo);
      return next;
    });
  };

  return (
    <>
      <HierButton
        level={4}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        title={title}
        subtitle={`${linha.sku_count ?? pcs.reduce((a, p) => a + p.skus.length, 0) + solos.length} SKU(s)`}
        meta={<TipoPill tipo={linha.linha_tipo} />}
        stockLabel={linha.estoque_label}
        stockVirtual={pcs.concat(solos).some((s) => s.skus?.some?.((x) => x.estoque_virtual) || s.estoque_virtual)}
        comfortable={comfortable}
      />
      {open && (
        <>
          {pcs.map((pc, idx) => (
            <ProdutoCompraBlock
              key={pc.produto_compra_codigo}
              pc={pc}
              open={openPc.has(pc.produto_compra_codigo)}
              onToggle={() => togglePc(pc.produto_compra_codigo)}
              isLast={idx === pcs.length - 1 && !solos.length}
              comfortable={comfortable}
            />
          ))}
          {solos.map((s, i) => (
            <SkuRow key={s.codigo_interno || i} row={s} isLast={i === solos.length - 1} comfortable={comfortable} />
          ))}
        </>
      )}
    </>
  );
}

function PathwayBlock({ pathway, filtroTipos, comfortable }) {
  const [open, setOpen] = useState(pathway.pathway_papel === 'nucleo');
  const linhas = (pathway.linhas || []).filter((lin) => !filtroTipos?.size || filtroTipos.has(lin.linha_tipo));
  if (!linhas.length) return null;

  const hidePathwayHeader = pathway.pathway_papel === 'default' && linhas.length === 1;

  if (hidePathwayHeader) {
    return linhas.map((linha) => (
      <LinhaBlock key={linha.linha_pathway_key} linha={linha} filtroTipos={filtroTipos} comfortable={comfortable} />
    ));
  }

  return (
    <>
      <HierButton
        level={3}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        title={pathwayPapelLabel(pathway.pathway_papel)}
        subtitle={`${linhas.length} LINHA(s)`}
        stockLabel={pathway.estoque_label}
        comfortable={comfortable}
      />
      {open && linhas.map((linha) => (
        <LinhaBlock key={linha.linha_pathway_key} linha={linha} filtroTipos={filtroTipos} comfortable={comfortable} />
      ))}
    </>
  );
}

function CoreBlock({ coreNode, filtroTipos, comfortable }) {
  const [open, setOpen] = useState(true);
  const pathways = coreNode.pathways || [];
  const linhaCount = pathways.reduce((a, p) => a + (p.linhas?.length || 0), 0);

  return (
    <>
      <HierButton
        level={2}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        title={coreNode.core}
        subtitle={`${pathways.length} papel(is) · ${linhaCount} LINHA(s)`}
        stockLabel={coreNode.estoque_label}
        comfortable={comfortable}
      />
      {open && pathways.map((pw) => (
        <PathwayBlock key={pw.pathway_papel} pathway={pw} filtroTipos={filtroTipos} comfortable={comfortable} />
      ))}
    </>
  );
}

function SubBlocoBlock({ sub, filtroTipos, comfortable }) {
  const [open, setOpen] = useState(true);
  const cores = sub.cores || [];

  return (
    <>
      <HierButton
        level={1}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        title={sub.sub_bloco}
        subtitle={sub.sku_count != null ? `${cores.length} core(s) · ${sub.sku_count} SKU(s)` : `${cores.length} core(s)`}
        stockLabel={sub.estoque_label}
        comfortable={comfortable}
      />
      {open && cores.map((coreNode) => (
        <CoreBlock key={coreNode.core} coreNode={coreNode} filtroTipos={filtroTipos} comfortable={comfortable} />
      ))}
    </>
  );
}

function BlocoBlock({ bloco, filtroTipos, comfortable }) {
  const [open, setOpen] = useState(true);

  return (
    <div className={CATALOGO_SEP}>
      <HierButton
        level={0}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        title={bloco.bloco}
        subtitle={`${bloco.sub_blocos?.length || 0} etapa(s)`}
        comfortable={comfortable}
      />
      {open && (bloco.sub_blocos || []).map((sub) => (
        <SubBlocoBlock key={sub.sub_bloco} sub={sub} filtroTipos={filtroTipos} comfortable={comfortable} />
      ))}
    </div>
  );
}

/** Catálogo: bloco → sub_bloco → core → pathway → LINHA → produto compra → SKU */
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
