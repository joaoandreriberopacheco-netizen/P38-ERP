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
  const tone = row.zerado ? 'ruptura' : row.abaixo_ponto ? 'alerta' : 'off';
  const nome = row.novo_sku || row.produto?.nome || row.produto?.descricao || '—';
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
            <p className={cn(CATALOGO_SUBTITLE, 'text-foreground/85 line-clamp-2')}>{nome}</p>
            {meta ? <p className="text-[10px] text-muted-foreground/70 tabular-nums">{meta}</p> : null}
          </div>
          <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">{row.estoque_label || '—'}</span>
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
        <SkuRow key={s.produto?.id || i} row={s} isLast={isLast && i === skus.length - 1} />
      ))}
    </>
  );
}

function LinhaBlock({ linha, filtroTipos }) {
  const [open, setOpen] = useState(true);
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
    <div className={CATALOGO_SEP}>
      <div className={cn(CATALOGO_HIER_L1)}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(CATALOGO_ROW_BASE, 'border-l-[#4a5240]/55 dark:border-l-[#636B2F]/55 pl-2')}
        >
          <div className="flex items-start gap-1.5 min-w-0 w-full">
            <ChevronRight className={cn('h-4 w-4 shrink-0 mt-0.5 transition-transform', open && 'rotate-90')} />
            <CatalogoSupplyLed tone="off" className="mt-1.5" />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <p className={cn(CATALOGO_TITLE, 'flex-1 min-w-0')}>{linha.linha_nome}</p>
                <TipoPill tipo={linha.linha_tipo} />
              </div>
              <p className={CATALOGO_SUBTITLE}>{totalSkus} SKU(s) · {pcs.length} produto(s) compra</p>
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
            <SkuRow
              key={s.produto?.id || i}
              row={s}
              isLast={i === solos.length - 1}
            />
          ))}
        </>
      )}
    </div>
  );
}

export default function CatalogoCatalogList({ tree, filtroTipos, search = '' }) {
  const q = search.trim().toLowerCase();

  const filteredTree = useMemo(() => {
    if (!q) return tree || [];
    return (tree || [])
      .map((cat) => ({
        ...cat,
        linhas: (cat.linhas || []).filter((linha) => {
          if (linha.linha_nome?.toLowerCase().includes(q)) return true;
          const hitPc = (linha.pcs || []).some(
            (pc) =>
              pc.produto_compra_nome?.toLowerCase().includes(q)
              || (pc.skus || []).some((s) =>
                (s.novo_sku || s.produto?.nome || '').toLowerCase().includes(q),
              ),
          );
          return hitPc;
        }),
      }))
      .filter((cat) => cat.linhas?.length);
  }, [tree, q]);

  if (!filteredTree.length) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Nada encontrado com estes filtros.
      </div>
    );
  }

  return (
    <div className={CATALOGO_LIST_SHELL}>
      {filteredTree.map((cat) => (
        <div key={cat.nome} className={CATALOGO_SEP}>
          <div className={cn(CATALOGO_HIER_L0, 'px-3 py-2 bg-muted/20 dark:bg-white/[0.03]')}>
            <p className="text-[10px] uppercase tracking-wide text-[#a8942e] dark:text-[#A8B56E] font-medium">
              {cat.nome}
            </p>
          </div>
          {(cat.linhas || []).map((linha) => (
            <LinhaBlock key={linha.linha_codigo} linha={linha} filtroTipos={filtroTipos} />
          ))}
        </div>
      ))}
    </div>
  );
}
