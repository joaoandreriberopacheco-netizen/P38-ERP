import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/components/utils';
import {
  buildFamiliasNivel2FromLinhas,
  linhaIdsComAcaoFamilia,
} from '@/lib/sugestaoFamiliasNivel2';
import { sugestaoProjecaoEstoque30dNegativa } from '@/lib/calcularSugestaoCompraVelocidade';
import { getLinhaAbcdLetter } from '@/lib/sugestaoCompraTree';

function AbcdBadge({ letter, className = '' }) {
  const value = String(letter || '').toUpperCase();
  if (!value || value === '—') return <span className="text-xs text-muted-foreground">—</span>;
  const tone =
    value === 'A' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
    : value === 'B' ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300'
    : value === 'C' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
    : value === 'E' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
    : 'bg-muted text-muted-foreground';
  return (
    <span className={cn(`inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-[10px] font-bold ${tone}`, className)}>
      {value}
    </span>
  );
}

const MENSAGEM_CLASS = {
  danger: 'text-red-600 dark:text-red-400 font-medium',
  warning: 'text-amber-700 dark:text-amber-400 font-medium',
  success: 'text-emerald-700 dark:text-emerald-400',
  muted: 'text-muted-foreground',
};

function fmtQtdBase(base) {
  const n = Number(base) || 0;
  if (n <= 0) return '—';
  return n < 10 ? n.toFixed(1).replace(/\.0$/, '') : String(Math.round(n));
}

export default function SugestaoCompraFamiliasRadar({
  linhas = [],
  salesVelocityMap = {},
  incluirPedidosAprovados = false,
  somenteUrgentes = false,
  selectedItems = {},
  onToggleSelected,
  onQuantidadeLinhaChange,
  renderFornecedorSelect,
  sugestaoDisplayLinha,
}) {
  const [expanded, setExpanded] = useState(() => new Set());

  const familias = useMemo(() => {
    let list = buildFamiliasNivel2FromLinhas(linhas, {
      incluirPedidosAprovados,
      salesVelocityMap,
    });
    if (somenteUrgentes) {
      list = list.filter(
        (f) =>
          sugestaoProjecaoEstoque30dNegativa(f.projecao) ||
          (Number(f.qtdSugeridaBase) || 0) > 0 ||
          f.skusComAcao > 0,
      );
    }
    return list;
  }, [linhas, incluirPedidosAprovados, salesVelocityMap, somenteUrgentes]);

  const toggleExpand = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const familiaSelecionada = (familia) => {
    const ids = linhaIdsComAcaoFamilia(familia);
    const alvo = ids.length ? ids : familia.linhaIds;
    return alvo.length > 0 && alvo.every((id) => selectedItems[id]);
  };

  const toggleFamilia = (familia, checked) => {
    const ids = linhaIdsComAcaoFamilia(familia);
    const alvo = ids.length ? ids : familia.linhaIds;
    for (const id of alvo) onToggleSelected?.(id, checked);
  };

  if (!familias.length) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Nenhuma família (nível 2) encontrada com os filtros actuais.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/40 overflow-hidden bg-card">
      <div className="px-3 py-2 border-b border-border/30 bg-muted/20 text-[11px] text-muted-foreground">
        Famílias falam primeiro (nível 2). Ordenado: ruptura futura → curva ABCD → velocidade.
        Expanda para ver modelos (SKUs).
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[720px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border/30 bg-muted/10">
              <th className="w-8 p-2" />
              <th className="w-8 p-2" />
              <th className="text-left p-2 font-medium">Família</th>
              <th className="text-center p-2 font-medium w-12">ABCD</th>
              <th className="text-right p-2 font-medium">Estoque</th>
              <th className="text-right p-2 font-medium">Média 30d</th>
              <th className="text-right p-2 font-medium">P. futuro</th>
              <th className="text-right p-2 font-medium">Qtd sug.</th>
              <th className="text-left p-2 font-medium min-w-[10rem]">O que diz</th>
            </tr>
          </thead>
          <tbody>
            {familias.map((familia) => {
              const isOpen = expanded.has(familia.key);
              const ruptura = sugestaoProjecaoEstoque30dNegativa(familia.projecao);
              const projTexto = familia.projecao?.projecao_estoque_30d_texto || '—';
              const sel = familiaSelecionada(familia);

              return (
                <React.Fragment key={familia.key}>
                  <tr
                    className={cn(
                      'border-b border-border/20 hover:bg-muted/20 transition-colors',
                      ruptura && 'bg-red-50/50 dark:bg-red-950/20',
                    )}
                  >
                    <td className="p-2 align-middle">
                      <button
                        type="button"
                        className="p-0.5 rounded text-muted-foreground hover:text-foreground"
                        onClick={() => toggleExpand(familia.key)}
                        aria-expanded={isOpen}
                      >
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="p-2 align-middle">
                      <Checkbox
                        checked={sel}
                        onCheckedChange={(v) => toggleFamilia(familia, v === true)}
                        aria-label={`Selecionar ${familia.label}`}
                      />
                    </td>
                    <td className="p-2 align-middle">
                      <div className="font-medium text-foreground leading-snug">{familia.label}</div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Layers className="w-3 h-3" />
                        {familia.skuCount} modelo(s)
                        {familia.skusRuptura > 0 ? (
                          <span className="text-red-600 dark:text-red-400">
                            · {familia.skusRuptura} em ruptura
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-2 text-center align-middle">
                      <AbcdBadge letter={familia.curvaDominante} size="sm" />
                    </td>
                    <td className="p-2 text-right align-middle tabular-nums">{familia.estoqueTexto}</td>
                    <td className="p-2 text-right align-middle tabular-nums">{familia.media30dTexto}</td>
                    <td
                      className={cn(
                        'p-2 text-right align-middle tabular-nums font-medium',
                        ruptura && 'text-red-600 dark:text-red-400',
                      )}
                    >
                      {projTexto}
                    </td>
                    <td className="p-2 text-right align-middle tabular-nums">
                      {fmtQtdBase(familia.qtdSugeridaBase)}
                    </td>
                    <td className={cn('p-2 align-middle text-xs', MENSAGEM_CLASS[familia.mensagem.tom])}>
                      {familia.mensagem.texto}
                    </td>
                  </tr>
                  {isOpen
                    ? familia.linhas.map((linha) => {
                        const disp = sugestaoDisplayLinha?.(linha) || {};
                        const linhaRuptura = sugestaoProjecaoEstoque30dNegativa(linha?.sugestao);
                        return (
                          <tr
                            key={linha.id}
                            className="border-b border-border/10 bg-muted/5 text-xs"
                          >
                            <td className="p-1" />
                            <td className="p-2 align-middle">
                              <Checkbox
                                checked={!!selectedItems[linha.id]}
                                onCheckedChange={(v) => onToggleSelected?.(linha.id, v === true)}
                              />
                            </td>
                            <td className="p-2 pl-6 align-middle text-muted-foreground" colSpan={2}>
                              <span className="text-foreground">{linha.label || linha.produto?.nome}</span>
                              <AbcdBadge letter={getLinhaAbcdLetter(linha)} size="sm" className="ml-2 inline" />
                            </td>
                            <td className="p-2 text-right tabular-nums align-middle">
                              {linha.sugestao?.estoque_atual_texto || '—'}
                            </td>
                            <td className="p-2 text-right tabular-nums align-middle">
                              {linha.sugestao?.media_30d_texto || '—'}
                            </td>
                            <td
                              className={cn(
                                'p-2 text-right tabular-nums align-middle',
                                linhaRuptura && 'text-red-600 dark:text-red-400',
                              )}
                            >
                              {linha.sugestao?.projecao_estoque_30d_texto || '—'}
                            </td>
                            <td className="p-2 text-right align-middle">
                              <input
                                type="number"
                                min={0}
                                step="any"
                                className="w-20 h-7 rounded-md border border-border/40 bg-background px-1.5 text-right text-xs"
                                value={disp.quantidade ?? ''}
                                onChange={(e) =>
                                  onQuantidadeLinhaChange?.(linha, e.target.value)
                                }
                              />
                            </td>
                            <td className="p-2 align-middle">{renderFornecedorSelect?.(linha)}</td>
                          </tr>
                        );
                      })
                    : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
