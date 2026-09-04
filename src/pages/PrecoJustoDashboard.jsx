import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { subDays, format } from 'date-fns';
import {
  ArrowLeft, Loader2, Scale, TrendingUp, Percent, DollarSign, Info,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { fetchPedidosVendaParaMargem } from '@/lib/fetchPedidosVenda90d';
import { fetchAllProdutosCatalogo } from '@/lib/fetchProdutosAtivos';
import {
  agregarProdutosPrecoJusto,
  simularPrecoJusto,
  calcularWhatIf,
  GLOBAL_MARKUP_ALVO,
  MARKUP_DESTINO,
  MARKUP_ROTINA,
  roundMoney,
  markupPct,
} from '@/lib/precoJustoCalculos';

const CORES = {
  destino: '#3b82f6',
  rotina: '#22c55e',
  conveniencia: '#f97316',
  global: '#94a3b8',
};

const PERIODOS = [
  { dias: 30, label: '30 dias' },
  { dias: 60, label: '60 dias' },
  { dias: 90, label: '90 dias' },
];

function fmtBrl(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPct(v) {
  return `${Number(v || 0).toFixed(1)}%`;
}

export default function PrecoJustoDashboard() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [dias, setDias] = useState(60);
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [mkDestino, setMkDestino] = useState(MARKUP_DESTINO * 100);
  const [mkRotina, setMkRotina] = useState(MARKUP_ROTINA * 100);

  useEffect(() => {
    let ativo = true;
    (async () => {
      setLoading(true);
      setErro(null);
      try {
        const [pedidos, prods] = await Promise.all([
          fetchPedidosVendaParaMargem(),
          fetchAllProdutosCatalogo(),
        ]);
        if (!ativo) return;
        setSales(pedidos || []);
        setProducts(prods || []);
      } catch (e) {
        if (ativo) setErro(e?.message || 'Erro ao carregar vendas');
      } finally {
        if (ativo) setLoading(false);
      }
    })();
    return () => { ativo = false; };
  }, []);

  const intervalo = useMemo(() => {
    const to = new Date();
    const from = subDays(to, dias);
    return { from, to };
  }, [dias]);

  const resultado = useMemo(() => {
    const agregado = agregarProdutosPrecoJusto(sales, products, intervalo);
    if (!agregado.length) return null;
    return simularPrecoJusto(agregado);
  }, [sales, products, intervalo]);

  const comparativoReal = useMemo(() => {
    if (!resultado) return null;
    const fatReal = resultado.detalhe_produtos.reduce((s, p) => s + p.faturamento_real, 0);
    const custo = resultado.custo_real_total;
    return {
      faturamento_real: roundMoney(fatReal),
      margem_real_pct: markupPct(custo, fatReal),
    };
  }, [resultado]);

  const whatIf = useMemo(() => {
    if (!resultado) return null;
    const d = resultado.resumo_grupos.find((g) => g.grupo === 'destino');
    const r = resultado.resumo_grupos.find((g) => g.grupo === 'rotina');
    const c = resultado.resumo_grupos.find((g) => g.grupo === 'conveniencia');
    return calcularWhatIf({
      custoTotal: resultado.custo_real_total,
      custoDestino: d?.custo_real || 0,
      custoRotina: r?.custo_real || 0,
      custoConveniencia: c?.custo_real || 0,
      markupDestinoPct: mkDestino,
      markupRotinaPct: mkRotina,
    });
  }, [resultado, mkDestino, mkRotina]);

  const chartMarkup = useMemo(() => {
    if (!resultado || !whatIf) return [];
    const convBase = resultado.resumo_grupos.find((g) => g.grupo === 'conveniencia');
    return [
      { nome: 'KVI', valor: mkDestino, cor: CORES.destino },
      { nome: 'Rotina', valor: mkRotina, cor: CORES.rotina },
      { nome: 'Conveniência', valor: whatIf.markupConvenienciaPct, cor: CORES.conveniencia },
      { nome: 'Meta global', valor: resultado.meta_global_pct, cor: CORES.global },
    ];
  }, [resultado, whatIf, mkDestino, mkRotina]);

  const chartPeso = useMemo(() => {
    if (!resultado) return [];
    return resultado.resumo_grupos.map((g) => ({
      nome: g.grupo === 'destino' ? 'KVI' : g.grupo === 'rotina' ? 'Rotina' : 'Conv.',
      peso: g.peso_custo_pct,
      cor: CORES[g.grupo],
    }));
  }, [resultado]);

  const topPorGrupo = useCallback((grupo, n = 6) => {
    if (!resultado) return [];
    return resultado.detalhe_produtos
      .filter((p) => p.grupo === grupo)
      .slice(0, n);
  }, [resultado]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1419] text-[#e8edf4] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#a4ce33]" />
        <span className="ml-3 text-sm text-[#8b9cb3]">Carregando vendas faturadas…</span>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="min-h-screen bg-[#0f1419] text-[#e8edf4] p-6">
        <p className="text-rose-400">{erro}</p>
      </div>
    );
  }

  if (!resultado) {
    return (
      <div className="min-h-screen bg-[#0f1419] text-[#e8edf4] p-6">
        <Link to="/Relatorios" className="inline-flex items-center gap-2 text-sm text-[#8b9cb3] hover:text-white mb-4">
          <ArrowLeft className="w-4 h-4" /> Relatórios
        </Link>
        <p>Nenhuma venda faturada nos últimos {dias} dias.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1419] text-[#e8edf4] pb-24">
      <div className="border-b border-white/5 bg-[#1a2332]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/Relatorios" className="text-[#8b9cb3] hover:text-white shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-semibold truncate flex items-center gap-2">
                <Scale className="w-4 h-4 text-[#a4ce33]" />
                Preço Justo — Simulador
              </h1>
              <p className="text-xs text-[#8b9cb3] truncate">
                Backtest · meta global {(GLOBAL_MARKUP_ALVO * 100).toFixed(0)}%
              </p>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            {PERIODOS.map((p) => (
              <Button
                key={p.dias}
                size="sm"
                variant={dias === p.dias ? 'default' : 'ghost'}
                className={dias === p.dias
                  ? 'bg-[#4a5240] text-white dark:bg-[#a4ce33] dark:text-[#1f1d22] h-8 text-xs'
                  : 'text-[#8b9cb3] h-8 text-xs hover:text-white'}
                onClick={() => setDias(p.dias)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-5 space-y-5">
        {/* Insight banner */}
        <div className="rounded-xl border border-[#a4ce33]/20 bg-[#a4ce33]/5 p-4 flex gap-3">
          <Info className="w-5 h-5 text-[#a4ce33] shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p>
              <strong>O que descobrimos ({dias}d):</strong> a loja fatura hoje com margem global de{' '}
              <strong className="text-[#a4ce33]">{fmtPct(comparativoReal?.margem_real_pct)}</strong>
              {' '}(alvo Preço Justo: {fmtPct(resultado.meta_global_pct)}).
              Cimento e KVI já operam perto de 20%; pisos/porcelanatos acima de 40%.
              Para fechar em 40% global, <strong className="text-orange-400">Conveniência precisaria de ~{fmtPct(whatIf?.markupConvenienciaPct)}</strong> de markup.
            </p>
            <p className="text-[#8b9cb3] text-xs">
              {resultado.detalhe_produtos.length} produtos · custo real {fmtBrl(resultado.custo_real_total)}
              {resultado.flex_count > 0 && ` · ${resultado.flex_count} promovidos a KVI pela regra flexível`}
            </p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            icon={Percent}
            label="Markup Conveniência (req.)"
            value={fmtPct(whatIf?.markupConvenienciaPct)}
            accent="text-orange-400"
          />
          <KpiCard
            icon={TrendingUp}
            label="Margem global simulada"
            value={fmtPct(whatIf?.globalMarginPct)}
          />
          <KpiCard
            icon={DollarSign}
            label="Faturamento alvo"
            value={fmtBrl(whatIf?.faturamentoAlvo)}
          />
          <KpiCard
            icon={DollarSign}
            label="Faturamento real"
            value={fmtBrl(comparativoReal?.faturamento_real)}
            sub={`margem ${fmtPct(comparativoReal?.margem_real_pct)}`}
          />
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl bg-[#1a2332] border border-white/5 p-4">
            <h2 className="text-xs uppercase tracking-wider text-[#8b9cb3] mb-3">Markup por grupo</h2>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartMarkup} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#8b9cb3', fontSize: 11 }} unit="%" />
                  <YAxis type="category" dataKey="nome" width={90} tick={{ fill: '#e8edf4', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                    formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Markup']}
                  />
                  <ReferenceLine x={resultado.meta_global_pct} stroke="#94a3b8" strokeDasharray="4 4" />
                  <Bar dataKey="valor" radius={[0, 6, 6, 0]}>
                    {chartMarkup.map((entry) => (
                      <Cell key={entry.nome} fill={entry.cor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl bg-[#1a2332] border border-white/5 p-4">
            <h2 className="text-xs uppercase tracking-wider text-[#8b9cb3] mb-3">Peso no custo (%)</h2>
            <div className="h-52 flex items-end gap-2 px-2">
              {chartPeso.map((g) => (
                <div key={g.nome} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-[#8b9cb3]">{g.peso.toFixed(1)}%</span>
                  <div
                    className="w-full rounded-t-md transition-all"
                    style={{ height: `${Math.max(g.peso * 2.2, 8)}px`, backgroundColor: g.cor }}
                  />
                  <span className="text-[10px] text-[#8b9cb3]">{g.nome}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sliders what-if */}
        <div className="rounded-xl bg-[#1a2332] border border-white/5 p-4 space-y-4">
          <h2 className="text-xs uppercase tracking-wider text-[#8b9cb3]">Cenário what-if</h2>
          <SliderRow
            label="Destino (KVI) markup %"
            value={mkDestino}
            min={5}
            max={35}
            step={0.5}
            onChange={setMkDestino}
          />
          <SliderRow
            label="Rotina markup %"
            value={mkRotina}
            min={20}
            max={60}
            step={0.5}
            onChange={setMkRotina}
          />
          <p className="text-xs text-[#8b9cb3]">
            Ajuste os markups fixos; o de Conveniência recalcula automaticamente para manter {(GLOBAL_MARKUP_ALVO * 100).toFixed(0)}% global.
          </p>
        </div>

        {/* Resumo grupos */}
        <div className="rounded-xl bg-[#1a2332] border border-white/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#8b9cb3] text-xs uppercase border-b border-white/5">
                <th className="text-left p-3">Grupo</th>
                <th className="text-right p-3">Custo real</th>
                <th className="text-right p-3">Peso custo</th>
                <th className="text-right p-3">Markup sim.</th>
                <th className="text-right p-3">Fat. simulado</th>
              </tr>
            </thead>
            <tbody>
              {resultado.resumo_grupos.map((g) => (
                <tr key={g.grupo} className="border-b border-white/5 last:border-0">
                  <td className="p-3">
                    <span className="inline-block w-2 h-2 rounded-sm mr-2" style={{ background: CORES[g.grupo] }} />
                    {g.grupo_label}
                  </td>
                  <td className="p-3 text-right font-mono text-xs">{fmtBrl(g.custo_real)}</td>
                  <td className="p-3 text-right">{g.peso_custo_pct.toFixed(1)}%</td>
                  <td className="p-3 text-right font-semibold">{g.markup_simulado_pct.toFixed(1)}%</td>
                  <td className="p-3 text-right font-mono text-xs">{fmtBrl(g.faturamento_simulado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top produtos por grupo */}
        {['destino', 'rotina', 'conveniencia'].map((grupo) => {
          const items = topPorGrupo(grupo);
          if (!items.length) return null;
          const titulo = grupo === 'destino' ? 'Destino (KVI)' : grupo === 'rotina' ? 'Rotina' : 'Conveniência';
          return (
            <div key={grupo} className="rounded-xl bg-[#1a2332] border border-white/5 p-4">
              <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-sm" style={{ background: CORES[grupo] }} />
                Top {titulo}
              </h2>
              <div className="space-y-2">
                {items.map((p) => (
                  <div key={`${p.produto_id}-${p.produto_nome}`} className="flex justify-between gap-2 text-xs border-b border-white/5 pb-2 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.produto_nome}</p>
                      <p className="text-[#8b9cb3] truncate">{p.motivo_classificacao}</p>
                    </div>
                    <div className="text-right shrink-0 font-mono">
                      <p>{fmtBrl(p.custo_real)}</p>
                      <p className="text-[#8b9cb3]">real {fmtPct(p.margem_real_pct)} → sim {fmtPct(p.markup_grupo_pct)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <p className="text-[10px] text-[#8b9cb3] text-center pb-4">
          Atualizado com vendas faturadas até {format(new Date(), 'dd/MM/yyyy HH:mm')}
        </p>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, accent = 'text-[#e8edf4]' }) {
  return (
    <div className="rounded-xl bg-[#1a2332] border border-white/5 p-3">
      <div className="flex items-center gap-1.5 text-[#8b9cb3] text-[10px] uppercase mb-1">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <p className={`text-lg font-bold ${accent}`}>{value}</p>
      {sub && <p className="text-[10px] text-[#8b9cb3]">{sub}</p>}
    </div>
  );
}

function SliderRow({ label, value, min, max, step, onChange }) {
  return (
    <div>
      <label className="flex justify-between text-xs text-[#8b9cb3] mb-1">
        <span>{label}</span>
        <span className="text-[#e8edf4] font-mono">{value}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#a4ce33]"
      />
    </div>
  );
}
