import React, { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/components/utils';
import {
  CATALOGO_HIER_L0,
  CATALOGO_HIER_L1,
  CATALOGO_HIER_L2,
  CATALOGO_HIER_L3,
  CATALOGO_LIST_SHELL,
  CATALOGO_ROW_BASE,
  CATALOGO_SEP,
  CATALOGO_SUBTITLE,
  CATALOGO_TITLE,
  CATALOGO_TIPO_CHIP,
  CATALOGO_SUPPLY_BORDER,
} from '@/lib/catalogoP38Theme';
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

function SkuRow({ row, isLast }) {
  const tone = row.zerado ? 'ruptura' : row.abaixo_ponto ? 'alerta' : row.alerta_estudo ? 'alerta_escuro' : 'off';
  const meta = [row.eixo_a, row.eixo_b].filter(Boolean).join(' · ');

  return (
    <div className={cn('relative', !isLast && CATALOGO_SEP, CATALOGO_HIER_L3)}>
      <div
        className={cn(
          CATALOGO_ROW_BASE,
          'pl-3 cursor-default hover:bg-transparent',
          CATALOGO_SUPPLY_BORDER[tone],
        )}
      >
        <div className="flex items-start gap-1.5 min-w-0">
          <CatalogoSupplyLed tone={tone} pulse={tone === 'ruptura'} />
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className={cn(CATALOGO_SUBTITLE, 'text-foreground/85 line-clamp-2 normal-case')}>
              {row.novo_sku || row.sku_atual}
            </p>
            <p className="text-[10px] text-muted-foreground/70 tabular-nums">
              {[row.codigo_interno, meta].filter(Boolean).join(' · ')}
            </p>
          </div>
          <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">{row.estoque_label}</span>
        </div>
      </div>
    </div>
  );
}

function ProdutoCompraBlock({ pc, open, onToggle, isLast }) {
  const skus = pc.skus || [];
  return (
    <>
      <div className={cn('relative', !isLast && !open && CATALOGO_SEP, CATALOGO_HIER_L2)}>
        <button
          type="button"
          onClick={onToggle}
          className={cn(CATALOGO_ROW_BASE, 'pl-3 border-l-[#e8b824]/45 dark:border-l-[#636B2F]/50')}
        >
          <div className="flex items-start gap-1.5 min-w-0 w-full">
            <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 mt-0.5 transition-transform text-[#a8942e] dark:text-[#A8B56E]', open && 'rotate-90')} />
            <div className="flex-1 min-w-0 space-y-0.5">
              <p className={CATALOGO_TITLE}>{pc.produto_compra_nome}</p>
              <p className={CATALOGO_SUBTITLE}>{skus.length} SKU(s)</p>
            </div>
          </div>
        </button>
      </div>
      {open && skus.map((s, i) => (
        <SkuRow key={s.codigo_interno || i} row={s} isLast={isLast && i === skus.length - 1} />
      ))}
    </>
  );
}

function LinhaBlock({ linha, filtroTipos }) {
  const [open, setOpen] = useState(false);
  const [openPc, setOpenPc] = useState(() => new Set());

  if (filtroTipos?.size && !filtroTipos.has(linha.linha_tipo)) return null;

  const pcs = linha.pcs || [];
  const solos = linha.solos || [];
  const totalSkus = pcs.reduce((a, p) => a + (p.skus?.length || 0), 0) + solos.length;

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
      <div className={cn(CATALOGO_HIER_L2, CATALOGO_SEP)}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(CATALOGO_ROW_BASE, 'pl-3 border-l-[#4a5240]/45 dark:border-l-[#636B2F]/55')}
        >
          <div className="flex items-start gap-1.5 min-w-0 w-full">
            <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 mt-0.5 transition-transform', open && 'rotate-90')} />
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={cn(CATALOGO_TITLE, 'flex-1 min-w-0')}>{linha.linha_nome}</p>
                <TipoPill tipo={linha.linha_tipo} />
              </div>
              <p className={CATALOGO_SUBTITLE}>
                {linha.core ? `${linha.core} · ` : ''}{totalSkus} SKU(s)
              </p>
            </div>
          </div>
        </button>
      </div>
      {open && (
        <>
          {pcs.map((pc, idx) => (
            <ProdutoCompraBlock
              key={pc.produto_compra_codigo}
              pc={pc}
              open={openPc.has(pc.produto_compra_codigo)}
              onToggle={() => togglePc(pc.produto_compra_codigo)}
              isLast={idx === pcs.length - 1 && !solos.length}
            />
          ))}
          {solos.map((s, i) => (
            <SkuRow key={s.codigo_interno || i} row={s} isLast={i === solos.length - 1} />
          ))}
        </>
      )}
    </>
  );
}

function SubBlocoBlock({ sub, filtroTipos }) {
  const [open, setOpen] = useState(true);
  const skuCount = (sub.linhas || []).reduce((acc, lin) => {
    const pcs = lin.pcs || [];
    const solos = lin.solos || [];
    return acc + pcs.reduce((a, p) => a + (p.skus?.length || 0), 0) + solos.length;
  }, 0);

  return (
    <>
      <div className={cn(CATALOGO_HIER_L1, CATALOGO_SEP)}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(CATALOGO_ROW_BASE, 'pl-2 border-l-[#e8b824]/50 dark:border-l-[#636B2F]/55')}
        >
          <div className="flex items-start gap-1.5 min-w-0 w-full">
            <ChevronRight className={cn('h-4 w-4 shrink-0 mt-0.5 transition-transform', open && 'rotate-90')} />
            <div className="flex-1 min-w-0">
              <p className={CATALOGO_TITLE}>{sub.sub_bloco}</p>
              <p className={CATALOGO_SUBTITLE}>{sub.linhas?.length || 0} LINHA(s) · {skuCount} SKU(s)</p>
            </div>
          </div>
        </button>
      </div>
      {open && (sub.linhas || []).map((linha) => (
        <LinhaBlock key={linha.linha_codigo} linha={linha} filtroTipos={filtroTipos} />
      ))}
    </>
  );
}

function BlocoBlock({ bloco, filtroTipos }) {
  const [open, setOpen] = useState(true);

  return (
    <div className={CATALOGO_SEP}>
      <div className={cn(CATALOGO_HIER_L0, 'px-3 py-2 bg-[#e8b824]/[0.06] dark:bg-[#636B2F]/[0.12] border-l-2 border-l-[#e8b824]/60 dark:border-l-[#636B2F]/70')}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full text-left flex items-center gap-2"
        >
          <ChevronRight className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-90')} />
          <p className="text-xs uppercase tracking-wide font-medium text-[#a8942e] dark:text-[#A8B56E] flex-1">
            {bloco.bloco}
          </p>
        </button>
      </div>
      {open && (bloco.sub_blocos || []).map((sub) => (
        <SubBlocoBlock key={sub.sub_bloco} sub={sub} filtroTipos={filtroTipos} />
      ))}
    </div>
  );
}

/** Catálogo com camadas do Excel: bloco → sub_bloco → LINHA → produto compra → SKU */
export default function CatalogoEstudoList({ tree, filtroTipos }) {
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
        <BlocoBlock key={bloco.bloco} bloco={bloco} filtroTipos={filtroTipos} />
      ))}
    </div>
  );
}
