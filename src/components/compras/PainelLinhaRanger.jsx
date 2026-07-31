import React, { useEffect, useMemo, useState } from 'react';
import { Flame, RefreshCw, Shield, Swords } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/utils';
import { fetchProdutosAtivos } from '@/lib/fetchProdutosAtivos';
import { fetchPedidosVenda90d } from '@/lib/fetchPedidosVenda90d';
import { buildCatalogSalesVelocityMap } from '@/lib/catalogSalesVelocity';
import { LINHAS_MESTRE } from '@/lib/inferirLinha';
import { buildLinhaTree } from '@/lib/painelLinhaRanger';

const LUZ_STYLES = {
  VERMELHA: 'bg-red-500 text-white',
  AMARELA: 'bg-amber-400 text-gray-900',
  VERDE: 'bg-emerald-600 text-white',
  CINZA: 'bg-muted-foreground/40 text-white',
};

function LuzPill({ luz, label }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        LUZ_STYLES[luz] || LUZ_STYLES.CINZA,
        luz === 'VERMELHA' && 'animate-pulse',
      )}
    >
      {label || luz}
    </span>
  );
}

function filterTreeRows(rows, somenteIncendios) {
  if (!somenteIncendios) return rows;
  const includeIdx = new Set();
  let linhaIdx = -1;
  let compraIdx = -1;
  rows.forEach((r, i) => {
    if (r.nivel === 'LINHA') {
      linhaIdx = i;
      compraIdx = -1;
    }
    if (r.nivel === 'PRODUTO COMPRA') compraIdx = i;
    if (r.nivel === 'SKU' && (r.luz === 'VERMELHA' || r.luz === 'AMARELA')) {
      if (linhaIdx >= 0) includeIdx.add(linhaIdx);
      if (compraIdx >= 0) includeIdx.add(compraIdx);
      includeIdx.add(i);
    }
  });
  return rows.filter((_, i) => includeIdx.has(i));
}

function fmtNum(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

export default function PainelLinhaRanger() {
  const [produtos, setProdutos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [somenteIncendios, setSomenteIncendios] = useState(true);
  const [linhaFiltro, setLinhaFiltro] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [p, ped] = await Promise.all([fetchProdutosAtivos(), fetchPedidosVenda90d()]);
      setProdutos(p);
      setPedidos(ped);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const velocityMap = useMemo(
    () => buildCatalogSalesVelocityMap(produtos, pedidos),
    [produtos, pedidos],
  );

  const { rows, resumoLinhas } = useMemo(
    () => buildLinhaTree(produtos, velocityMap, LINHAS_MESTRE),
    [produtos, velocityMap],
  );

  const displayRows = useMemo(() => {
    let r = filterTreeRows(rows, somenteIncendios);
    if (linhaFiltro) r = r.filter((row) => row.linha_codigo === linhaFiltro);
    return r;
  }, [rows, somenteIncendios, linhaFiltro]);

  const totais = useMemo(() => {
    let verm = 0;
    let amar = 0;
    for (const r of resumoLinhas) {
      verm += r.vermelhas || 0;
      amar += r.amarelas || 0;
    }
    return { verm, amar };
  }, [resumoLinhas]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card/50 p-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Formação Gladiador + painel Blade Ranger</p>
            <p className="mt-1">
              LINHA → produto de compra → SKU. Luz amarela = risco no ponto futuro; vermelha = ruptura.
              O objetivo é apagar incêndios na formação, não repor SKU isolado.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 mr-1', loading && 'animate-spin')} />
          Atualizar
        </Button>
        <Button
          variant={somenteIncendios ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSomenteIncendios((v) => !v)}
        >
          <Flame className="w-4 h-4 mr-1" />
          Só incêndios
        </Button>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={linhaFiltro}
          onChange={(e) => setLinhaFiltro(e.target.value)}
        >
          <option value="">Todas as LINHAS</option>
          {resumoLinhas.map((l) => (
            <option key={l.codigo} value={l.codigo}>
              {l.nome} ({l.vermelhas}V / {l.amarelas}A)
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground ml-auto tabular-nums">
          {totais.verm} vermelhas · {totais.amar} amarelas
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {resumoLinhas
          .filter((l) => l.vermelhas > 0 || l.amarelas > 0)
          .slice(0, 10)
          .map((l) => (
            <button
              key={l.codigo}
              type="button"
              onClick={() => setLinhaFiltro(l.codigo === linhaFiltro ? '' : l.codigo)}
              className={cn(
                'rounded-lg border p-2 text-left transition-colors',
                linhaFiltro === l.codigo
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-border hover:bg-muted/50',
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <LuzPill luz={l.luz} />
                <span className="text-[10px] uppercase text-muted-foreground">{l.tipo}</span>
              </div>
              <div className="text-xs font-semibold truncate">{l.nome}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {l.vermelhas}V · {l.amarelas}A · {l.skus} SKUs
              </div>
            </button>
          ))}
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto max-h-[min(70vh,720px)]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
              <tr className="text-left text-muted-foreground">
                <th className="p-2 w-24">Luz</th>
                <th className="p-2 min-w-[240px]">Formação (árvore)</th>
                <th className="p-2 w-20">Estoque</th>
                <th className="p-2 w-20">Média 30d</th>
                <th className="p-2 w-24">P. futuro</th>
                <th className="p-2 w-20">Sugestão</th>
                <th className="p-2 min-w-[140px]">Ação Ranger</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">Carregando formação…</td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Nenhum incêndio neste filtro — formação saudável ou sem vendas recentes.
                  </td>
                </tr>
              ) : (
                displayRows.map((row, idx) => (
                  <tr
                    key={`${row.nivel}-${idx}-${row.tree}`}
                    className={cn(
                      'border-t border-border/50',
                      row.nivel === 'LINHA' && 'bg-muted/30',
                      row.nivel === 'PRODUTO COMPRA' && 'bg-muted/15',
                    )}
                  >
                    <td className="p-2">
                      <LuzPill luz={row.luz} label={row.nivel === 'SKU' ? row.luz : ''} />
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1.5">
                        {row.nivel === 'LINHA' && <Swords className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                        <span
                          className={cn(
                            row.nivel === 'LINHA' && 'font-semibold text-sm',
                            row.nivel === 'PRODUTO COMPRA' && 'font-medium',
                          )}
                        >
                          {row.tree}
                        </span>
                      </div>
                      {row.nivel === 'SKU' && row.sku_nome && (
                        <div className="text-[10px] text-muted-foreground truncate max-w-md mt-0.5">
                          {row.sku_nome}
                        </div>
                      )}
                    </td>
                    <td className="p-2 tabular-nums">{row.nivel === 'SKU' ? fmtNum(row.estoque) : '—'}</td>
                    <td className="p-2 tabular-nums">{row.nivel === 'SKU' ? fmtNum(row.media30) : '—'}</td>
                    <td
                      className={cn(
                        'p-2 tabular-nums',
                        row.nivel === 'SKU' && Number(row.ponto_futuro) < 0 && 'text-amber-700 dark:text-amber-300 font-medium',
                      )}
                    >
                      {row.nivel === 'SKU' ? fmtNum(row.ponto_futuro) : '—'}
                    </td>
                    <td className="p-2 tabular-nums font-medium">
                      {row.nivel === 'SKU' && row.sugestao > 0 ? fmtNum(row.sugestao) : '—'}
                    </td>
                    <td className="p-2 text-muted-foreground">{row.acao || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
