import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { invokeRecalcularEstoqueProduto } from "@/lib/p38StockRecalc";
import { calcularSaldoExtratoProduto, parseEstoqueCadastro } from "@/lib/movimentacaoEstoqueSaldo";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Search, Plus, Minus, Trash2,
  CheckCircle2, Loader2, Package, ChevronDown, ChevronUp, Boxes, Send
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ProductUnitSelectorDialog from "@/components/produtos/ProductUnitSelectorDialog";
import { hydrateConferenciasItensFromSql } from "@/lib/fetchConferenciaItens";
import { omitConferenciaEspelho } from "@/lib/omitEspelhoPersist";
import { syncConferenciaItens } from "@/lib/syncConferenciaItens";
import {
  buildCountEntry,
  changeCountEntryUnit,
  formatCountQuantity,
  getCountUnitForEntry,
  getEntryBaseQuantity,
  getEntryDisplayQuantity,
  getGroupDisplayFromBase,
  resolveInventoryProductName,
  updateCountEntryQuantity,
} from "@/lib/inventoryCountUnits";
import { filterAndSortProducts } from "@/components/compras/productMatchingUtils";

export default function PDVAuditoria() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const conferencia_id = urlParams.get("id");

  const [conferencia, setConferencia] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [busca, setBusca] = useState("");
  const [produtosFiltrados, setProdutosFiltrados] = useState([]);
  const [itens, setItens] = useState([]); // { produto_id, produto_nome, quantidade_contada }
  const [saving, setSaving] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mostrarBusca, setMostrarBusca] = useState(false);
  const [itemExpandido, setItemExpandido] = useState(null);
  const [unitSelector, setUnitSelector] = useState({ open: false, itemIdx: null, product: null });
  const buscaRef = useRef(null);

  useEffect(() => {
    if (!conferencia_id) return navigate(createPageUrl("AuditoriaEstoque"));
    carregar();
  }, [conferencia_id]);

  const carregar = async () => {
    setLoading(true);
    const [conf, prods] = await Promise.all([
      base44.entities.ConferenciaEstoque.filter({ id: conferencia_id }),
      base44.entities.Produto.list("campo_hierarquico_1", 2000),
    ]);
    if (conf.length === 0) return navigate(createPageUrl("AuditoriaEstoque"));
    const [conferenciaHidratada] = await hydrateConferenciasItensFromSql(base44, [conf[0]]);
    setConferencia(conferenciaHidratada);
    setItens(conferenciaHidratada.itens_conferidos || []);
    setProdutos(prods);
    setLoading(false);
  };

  useEffect(() => {
    if (!busca.trim()) { setProdutosFiltrados([]); return; }
    setProdutosFiltrados(filterAndSortProducts(produtos, busca));
  }, [busca, produtos]);

  useEffect(() => {
    if (mostrarBusca && buscaRef.current) buscaRef.current.focus();
  }, [mostrarBusca]);

  const salvarItens = useCallback(async (novosItens) => {
    setSaving(true);
    try {
      await syncConferenciaItens(conferencia_id, novosItens, produtos);
    } catch (err) {
      console.warn('Sincronia ConferenciaItem falhou:', err?.message || err);
    }
    setSaving(false);
  }, [conferencia_id, produtos]);

  const adicionarProduto = async (produto) => {
    const novosItens = [...itens, buildCountEntry(produto, 1)];
    setItens(novosItens);
    setBusca("");
    setMostrarBusca(false);
    setItemExpandido(produto.id);
    await salvarItens(novosItens);
  };

  const atualizarQtd = async (idx, delta) => {
    const novosItens = itens.map((item, i) => {
      if (i !== idx) return item;
      const produto = produtos.find(p => p.id === item.produto_id);
      const qtdAtual = getEntryDisplayQuantity(item, produto);
      return updateCountEntryQuantity(item, produto, Math.max(0, qtdAtual + delta));
    });
    setItens(novosItens);
    await salvarItens(novosItens);
  };

  const definirQtd = async (idx, valor) => {
    const qtd = parseFloat(valor) || 0;
    const novosItens = itens.map((item, i) => {
      if (i !== idx) return item;
      const produto = produtos.find(p => p.id === item.produto_id);
      return updateCountEntryQuantity(item, produto, qtd);
    });
    setItens(novosItens);
    await salvarItens(novosItens);
  };

  const abrirSeletorUnidadeItem = (idx) => {
    const item = itens[idx];
    const produto = produtos.find(p => p.id === item?.produto_id);
    if (!produto) return;
    setUnitSelector({ open: true, itemIdx: idx, product: produto });
  };

  const aplicarUnidadeSelecionada = async (unitOption) => {
    if (!unitOption || unitSelector.itemIdx === null) {
      setUnitSelector({ open: false, itemIdx: null, product: null });
      return;
    }

    const novosItens = itens.map((item, idx) => {
      if (idx !== unitSelector.itemIdx) return item;
      const produto = produtos.find(p => p.id === item.produto_id);
      return changeCountEntryUnit(item, produto, unitOption);
    });
    setItens(novosItens);
    setUnitSelector({ open: false, itemIdx: null, product: null });
    await salvarItens(novosItens);
  };

  const removerItem = async (idx) => {
    const novosItens = itens.filter((_, i) => i !== idx);
    setItens(novosItens);
    if (itemExpandido === idx) setItemExpandido(null);
    await salvarItens(novosItens);
  };

  const finalizar = async () => {
    setFinalizando(true);

    const produtosIds = [...new Set(itens.map(item => item.produto_id).filter(Boolean))];
    const produtosConferidos = await Promise.all(
      produtosIds.map((produtoId) => base44.entities.Produto.filter({ id: produtoId }))
    );

    const mapaProdutos = produtosConferidos.reduce((acc, resultado) => {
      const produto = resultado?.[0];
      if (produto?.id) acc[produto.id] = produto;
      return acc;
    }, {});

    const totaisConferidos = itens.reduce((acc, item) => {
      if (!item.produto_id) return acc;
      const produto = mapaProdutos[item.produto_id] || produtos.find(p => p.id === item.produto_id);
      acc[item.produto_id] = (acc[item.produto_id] || 0) + getEntryBaseQuantity(item, produto);
      return acc;
    }, {});

    const movimentacoesPayload = await Promise.all(
      Object.entries(totaisConferidos).map(async ([produtoId, quantidadeContada]) => {
        const produto = mapaProdutos[produtoId];
        if (!produto) return null;

        const saldoExtrato = await calcularSaldoExtratoProduto(base44, produtoId);
        const diferenca = quantidadeContada - saldoExtrato;
        if (Math.abs(diferenca) < 1e-6) return null;

        const cadastro = parseEstoqueCadastro(produto.estoque_atual);
        const obsExtra = cadastro !== saldoExtrato
          ? ` (saldo extrato ${saldoExtrato}; cadastro ${cadastro})`
          : "";

        return {
          produto_id: produto.id,
          produto_nome: produto.nome || produto.campo_hierarquico_1 || "Produto",
          tipo: diferenca > 0 ? "Entrada" : "Saída",
          motivo: "Ajuste de Inventário",
          quantidade: Math.abs(diferenca),
          custo_unitario: Number(produto.preco_custo_calculado) || Number(produto.valor_compra) || 0,
          referencia_tipo: "ConferenciaEstoque",
          referencia_id: conferencia_id,
          referencia_numero: conferencia?.nome_conferencia || conferencia_id,
          observacoes: `Ajuste automático — contagem física ${quantidadeContada}${obsExtra} · ${conferencia?.nome_conferencia || conferencia_id}`,
          usuario_responsavel: conferencia?.responsavel_nome || conferencia?.responsavel_id || "Sistema",
        };
      })
    );

    const movimentacoes = movimentacoesPayload.filter(Boolean);
    const idsRecalc = [...new Set(movimentacoes.map((m) => m.produto_id).filter(Boolean))];

    await Promise.all([
      base44.entities.ConferenciaEstoque.update(conferencia_id, omitConferenciaEspelho({
        status: "Concluída",
        data_fim: new Date().toISOString(),
        ajuste_aplicado: true,
      })),
      ...movimentacoes.map((movimentacao) => base44.entities.MovimentacaoEstoque.create(movimentacao)),
    ]);

    for (const pid of idsRecalc) {
      await invokeRecalcularEstoqueProduto(base44, pid);
    }

    setFinalizando(false);
    navigate(createPageUrl("AuditoriaEstoque"));
  };

  // Agrupa itens com o mesmo produto_id
  const itensAgrupados = itens.reduce((acc, item, idx) => {
    const produto = produtos.find(p => p.id === item.produto_id);
    const quantidadeBase = getEntryBaseQuantity(item, produto);
    const quantidadeDisplay = getEntryDisplayQuantity(item, produto);
    const unit = getCountUnitForEntry(produto, item);
    const existente = acc.findIndex(a => a.produto_id === item.produto_id);
    if (existente >= 0) {
      acc[existente].totalBase += quantidadeBase;
      acc[existente].entradas.push({ idx, qtd: quantidadeDisplay, unidade: unit.unidade, base: quantidadeBase });
    } else {
      acc.push({
        produto_id: item.produto_id,
        produto_nome: item.produto_nome,
        totalBase: quantidadeBase,
        display: getGroupDisplayFromBase(produto, quantidadeBase),
        entradas: [{ idx, qtd: quantidadeDisplay, unidade: unit.unidade, base: quantidadeBase }],
      });
    }
    const grupoAtual = existente >= 0 ? acc[existente] : acc[acc.length - 1];
    grupoAtual.display = getGroupDisplayFromBase(produto, grupoAtual.totalBase);
    return acc;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-card">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-dvh bg-background font-din-1451 flex flex-col w-full max-w-full overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm px-4 py-3 flex items-center gap-3 border-b border-border/40">
        <button
          onClick={() => navigate(createPageUrl("AuditoriaEstoque"))}
          className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold font-glacial text-foreground truncate">
            {conferencia?.nome_conferencia}
          </h1>
          <p className="text-xs text-muted-foreground">
            {itens.length} entr{itens.length !== 1 ? "adas" : "ada"} · {itensAgrupados.length} produto{itensAgrupados.length !== 1 ? "s" : ""}
          </p>
        </div>
        {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground flex-shrink-0" />}
        {!saving && <div className="w-4 h-4" />}
      </div>

      {/* Lista de itens agrupados */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-3 pb-[calc(var(--p38-bottom-nav-total)+10rem+env(safe-area-inset-bottom,0px))]">
        {itensAgrupados.length === 0 && (
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Package className="w-7 h-7 text-muted-foreground dark:text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">Nenhum produto conferido</p>
            <p className="text-muted-foreground dark:text-muted-foreground text-xs mt-1">Busque e adicione produtos abaixo</p>
          </div>
        )}

        {itensAgrupados.map((grupo) => (
          <div key={grupo.produto_id} className="bg-muted/50/50 rounded-2xl overflow-hidden">
            {/* Linha principal do produto */}
            <button
              onClick={() => setItemExpandido(prev => prev === grupo.produto_id ? null : grupo.produto_id)}
              className="w-full flex items-center gap-3 p-3.5 text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-card dark:bg-muted flex items-center justify-center flex-shrink-0 shadow-sm">
                <Package className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{grupo.produto_nome}</p>
                <p className="text-xs text-muted-foreground">
                  {grupo.entradas.length} entrada{grupo.entradas.length !== 1 ? "s" : ""}
                  {grupo.display?.fator_conversao > 1 && (
                    <span> · base {formatCountQuantity(grupo.totalBase)} {grupo.display.unidade_base}</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-right">
                  <span className="text-lg font-bold font-glacial text-foreground">
                    {formatCountQuantity(grupo.display?.quantidade ?? grupo.totalBase)}
                  </span>
                  <span className="ml-1 text-xs font-semibold text-muted-foreground">
                    {grupo.display?.unidade || "UN"}
                  </span>
                </div>
                {itemExpandido === grupo.produto_id
                  ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                }
              </div>
            </button>

            {/* Entradas expandidas */}
            {itemExpandido === grupo.produto_id && (
              <div className="border-t border-border/40 divide-y divide-border/40 dark:divide-border/40">
                {grupo.entradas.map((entrada, eIdx) => (
                         <div key={entrada.idx} className="flex items-center gap-2 px-3 py-2.5 min-w-0">
                           <span className="text-xs text-muted-foreground w-14 flex-shrink-0">
                             Entrada {eIdx + 1}
                           </span>
                           <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
                      <button
                        onClick={() => atualizarQtd(entrada.idx, -1)}
                        className="min-h-11 min-w-11 rounded-lg bg-muted flex items-center justify-center"
                      >
                        <Minus className="w-3 h-3 text-muted-foreground" />
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirSeletorUnidadeItem(entrada.idx)}
                        className="h-7 inline-flex items-center gap-1 rounded-lg bg-card dark:bg-muted px-2 text-[11px] font-semibold text-muted-foreground shadow-sm"
                        title="Trocar unidade"
                      >
                        <Boxes className="w-3 h-3" />
                        {entrada.unidade || "UN"}
                      </button>
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={entrada.qtd}
                        onChange={e => definirQtd(entrada.idx, e.target.value)}
                        className="w-14 text-center text-sm font-medium border-0 bg-transparent focus-visible:ring-0 p-0 h-7"
                      />
                      <button
                        onClick={() => atualizarQtd(entrada.idx, 1)}
                        className="min-h-11 min-w-11 rounded-lg bg-muted flex items-center justify-center"
                      >
                        <Plus className="w-3 h-3 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => removerItem(entrada.idx)}
                        className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center ml-1"
                      >
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
                {/* Adicionar outra entrada do mesmo produto */}
                <button
                  onClick={() => {
                    const prod = produtos.find(p => p.id === grupo.produto_id);
                    if (prod) adicionarProduto(prod);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-xs text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground"
                >
                  <Plus className="w-3 h-3" /> Adicionar outra entrada
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Barra de busca */}
      <div className="fixed left-0 right-0 z-[55] max-w-full space-y-2 overflow-x-hidden border-t border-border/40 bg-card p-3 dark:border-border/40 dark:bg-background p38-bottom-dock">
        {/* Resultados da busca */}
        {produtosFiltrados.length > 0 && (
          <div className="max-h-72 overflow-y-auto bg-card rounded-2xl shadow-xl border border-border/40 divide-y divide-border/30 dark:divide-border/40">
            {produtosFiltrados.map(prod => {
              const nome = resolveInventoryProductName(prod);
              const contagens = itens.filter(i => i.produto_id === prod.id);
              const totalBase = contagens.reduce((s, i) => s + getEntryBaseQuantity(i, prod), 0);
              const totalDisplay = getGroupDisplayFromBase(prod, totalBase);
              return (
                <button
                  key={prod.id}
                  onClick={() => adicionarProduto(prod)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{nome}</p>
                    <p className="text-xs text-muted-foreground">{prod.codigo_interno || prod.codigo_barras || ""}</p>
                  </div>
                  {contagens.length > 0 && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-xs text-green-500 font-medium">
                        {formatCountQuantity(totalDisplay.quantidade)} {totalDisplay.unidade}
                      </span>
                    </div>
                  )}
                  <Plus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}

        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground dark:text-muted-foreground" />
          <Input
            ref={buscaRef}
            placeholder="Buscar produto..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            onFocus={() => setMostrarBusca(true)}
            className="pl-9 rounded-xl border-0 bg-muted/50 h-11 focus-visible:ring-1 focus-visible:ring-border/40 dark:focus-visible:ring-ring w-full"
          />
        </div>
      </div>

      {/* FAB Finalizar — acima da barra de busca */}
      <button
        type="button"
        onClick={finalizar}
        disabled={finalizando || itens.length === 0}
        title="Finalizar conferência"
        aria-label="Finalizar conferência"
        className="fixed right-4 z-[56] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:shadow-xl active:scale-95 disabled:pointer-events-none disabled:opacity-40 bottom-[calc(var(--p38-bottom-nav-total)+4.75rem)]"
      >
        {finalizando
          ? <Loader2 className="w-6 h-6 animate-spin" />
          : <Send className="w-6 h-6" />
        }
      </button>

      <ProductUnitSelectorDialog
        open={unitSelector.open}
        product={unitSelector.product}
        mode="sale"
        onClose={() => setUnitSelector({ open: false, itemIdx: null, product: null })}
        onConfirm={aplicarUnidadeSelecionada}
      />
    </div>
  );
}