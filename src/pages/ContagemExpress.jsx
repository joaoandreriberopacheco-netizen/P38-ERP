import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, ClipboardList, Search, Loader2, Package, ShoppingCart,
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import ProductUnitSelectorDialog from '@/components/produtos/ProductUnitSelectorDialog';
import CatalogLotePicker, { CatalogLoteModeToggle } from '@/components/compras/CatalogLotePicker';
import CatalogProductStockLine from '@/components/compras/CatalogProductStockLine';
import ContagemExpressCarrinho from '@/components/estoque/contagem-express/ContagemExpressCarrinho';
import ContagemExpressPainelContagem from '@/components/estoque/contagem-express/ContagemExpressPainelContagem';
import ContagemExpressPainelSessoes from '@/components/estoque/contagem-express/ContagemExpressPainelSessoes';
import ContagemExpressFabConcluir from '@/components/estoque/contagem-express/ContagemExpressFabConcluir';
import {
  buildCountEntry,
  changeCountEntryUnit,
  formatCountQuantity,
  getCountUnitForEntry,
  getDefaultCountUnit,
  getEntryBaseQuantity,
  getEntryDisplayQuantity,
  getGroupDisplayFromBase,
  mergeLoteDraftIntoCountItens,
  resolveInventoryProductName,
  updateCountEntryQuantity,
} from '@/lib/inventoryCountUnits';
import { filterAndSortProducts } from '@/components/compras/productMatchingUtils';
import { getDefaultCountUnitLabel } from '@/lib/inventoryCountUnits';
import { calcularSaldoExtratoProduto } from '@/lib/movimentacaoEstoqueSaldo';
import {
  P38_ACCENT,
  P38_FIELD_SURFACE,
} from '@/components/financeiro/fluxo/financeiroP38';
import {
  loadContagemExpressDraft,
  saveContagemExpressDraft,
  clearContagemExpressDraft,
  createContagemExpressSessionId,
} from '@/lib/contagemExpressStorage';
import { aplicarContagemExpress, buildComparativoContagem } from '@/lib/contagemExpressApply';
import { imprimirRelatorioContagemExpress, publicarRelatorioContagemExpress } from '@/lib/contagemExpressReport';
import {
  extrairReferenciaSessao,
  sincronizarSessaoContagemExpress,
} from '@/lib/contagemExpressSessao';
import { allowProgrammaticFocusBriefly, focusField } from '@/lib/focusPolicy';
import { toast } from 'sonner';

async function carregarSaldoProduto(produtoId) {
  return calcularSaldoExtratoProduto(base44, produtoId);
}

export default function ContagemExpress() {
  const navigate = useNavigate();
  const buscaRef = useRef(null);

  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState(null);
  const [conferenciaId, setConferenciaId] = useState(null);
  const [itens, setItens] = useState([]);
  const [usuario, setUsuario] = useState(null);

  const [view, setView] = useState('sessoes');
  const [busca, setBusca] = useState('');
  const [produtosFiltrados, setProdutosFiltrados] = useState([]);

  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [modoContagem, setModoContagem] = useState('adicionar');
  const [quantidadePendente, setQuantidadePendente] = useState('');
  const [entradaPendente, setEntradaPendente] = useState(null);
  const [saldoInfo, setSaldoInfo] = useState({ loading: false, saldoExtrato: null });

  const [unitSelector, setUnitSelector] = useState({ open: false, product: null });
  const [comparativo, setComparativo] = useState([]);
  const [loadingComparativo, setLoadingComparativo] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [imprimindo, setImprimindo] = useState(false);
  const [focarBuscaAposLimpar, setFocarBuscaAposLimpar] = useState(false);
  const [modoLote, setModoLote] = useState(false);
  const [loteDraft, setLoteDraft] = useState({});

  const persistItens = useCallback(async (novosItens, sid = sessionId, confId = conferenciaId) => {
    setItens(novosItens);
    if (sid) saveContagemExpressDraft(sid, novosItens, confId);
    if (confId) {
      try {
        await sincronizarSessaoContagemExpress(base44, confId, novosItens);
      } catch (error) {
        console.error(error);
      }
    }
  }, [sessionId, conferenciaId]);

  useEffect(() => {
    if (produtoSelecionado || !focarBuscaAposLimpar) return undefined;

    allowProgrammaticFocusBriefly();
    const timer = window.setTimeout(() => {
      allowProgrammaticFocusBriefly();
      focusField(buscaRef.current, { preventScroll: true });
      setFocarBuscaAposLimpar(false);
    }, 50);

    return () => window.clearTimeout(timer);
  }, [produtoSelecionado, focarBuscaAposLimpar]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const draft = loadContagemExpressDraft();
      const [prods, me] = await Promise.all([
        base44.entities.Produto.list('campo_hierarquico_1', 2000),
        base44.auth.me().catch(() => null),
      ]);
      setProdutos(prods);
      setUsuario(me);

      if (draft.conferenciaId) {
        setConferenciaId(draft.conferenciaId);
        setSessionId(draft.sessionId || createContagemExpressSessionId());
        setItens(draft.itens || []);
      } else {
        setSessionId(createContagemExpressSessionId());
      }
      setView('sessoes');
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!busca.trim()) {
      setProdutosFiltrados([]);
      return;
    }
    const list = filterAndSortProducts(produtos, busca);
    setProdutosFiltrados(
      [...list].sort((a, b) =>
        resolveInventoryProductName(a).localeCompare(
          resolveInventoryProductName(b),
          'pt-BR',
          { sensitivity: 'base', numeric: true },
        ),
      ),
    );
  }, [busca, produtos]);

  const itensAgrupados = useMemo(() => {
    return itens.reduce((acc, item, idx) => {
      const produto = produtos.find((p) => p.id === item.produto_id);
      const quantidadeBase = getEntryBaseQuantity(item, produto);
      const quantidadeDisplay = getEntryDisplayQuantity(item, produto);
      const unit = getCountUnitForEntry(produto, item);
      const existente = acc.findIndex((a) => a.produto_id === item.produto_id);

      if (existente >= 0) {
        acc[existente].totalBase += quantidadeBase;
        acc[existente].entradas.push({
          idx,
          qtd: quantidadeDisplay,
          unidade: unit.unidade,
          base: quantidadeBase,
        });
      } else {
        acc.push({
          produto_id: item.produto_id,
          produto_nome: item.produto_nome,
          totalBase: quantidadeBase,
          display: getGroupDisplayFromBase(produto, quantidadeBase),
          entradas: [{ idx, qtd: quantidadeDisplay, unidade: unit.unidade, base: quantidadeBase }],
          _produto: produto,
        });
      }

      const grupoAtual = existente >= 0 ? acc[existente] : acc[acc.length - 1];
      grupoAtual.display = getGroupDisplayFromBase(produto, grupoAtual.totalBase);
      grupoAtual._produto = produto;
      return acc;
    }, []).sort((a, b) =>
      (a.produto_nome || '').localeCompare(b.produto_nome || '', 'pt-BR', {
        sensitivity: 'base',
        numeric: true,
      }),
    );
  }, [itens, produtos]);

  const totalCarrinhoProduto = useCallback((produtoId) => {
    return itens
      .filter((i) => i.produto_id === produtoId)
      .reduce((sum, item) => {
        const produto = produtos.find((p) => p.id === item.produto_id);
        return sum + getEntryBaseQuantity(item, produto);
      }, 0);
  }, [itens, produtos]);

  const carregarSaldoSelecionado = useCallback(async (produtoId) => {
    if (!produtoId) return;
    setSaldoInfo({ loading: true, saldoExtrato: null });
    try {
      const saldo = await carregarSaldoProduto(produtoId);
      setSaldoInfo({ loading: false, saldoExtrato: saldo });
    } catch {
      setSaldoInfo({ loading: false, saldoExtrato: null });
    }
  }, []);

  const iniciarSelecao = (produto, { modo = 'adicionar', quantidadeInicial = '' } = {}) => {
    allowProgrammaticFocusBriefly();
    const entry = buildCountEntry(produto, 1);
    setProdutoSelecionado(produto);
    setModoContagem(modo);
    setQuantidadePendente(quantidadeInicial === '' ? '' : String(quantidadeInicial));
    setEntradaPendente(entry);
    setBusca('');
    setProdutosFiltrados([]);
    void carregarSaldoSelecionado(produto.id);
    setTimeout(() => buscaRef.current?.blur(), 50);
  };

  const limparSelecao = ({ focarBusca = false } = {}) => {
    setProdutoSelecionado(null);
    setQuantidadePendente('');
    setEntradaPendente(null);
    setSaldoInfo({ loading: false, saldoExtrato: null });
    setBusca('');
    setProdutosFiltrados([]);
    if (focarBusca) {
      setFocarBuscaAposLimpar(true);
    }
  };

  const handleSessaoCancelada = (sessao) => {
    if (conferenciaId === sessao.id) {
      clearContagemExpressDraft();
      setConferenciaId(null);
      setItens([]);
      setComparativo([]);
      setSessionId(createContagemExpressSessionId());
      limparSelecao();
    }
  };

  const continuarSessao = (sessao) => {
    const sid = extrairReferenciaSessao(sessao) || createContagemExpressSessionId();
    const itensSessao = sessao.itens_conferidos || [];
    setConferenciaId(sessao.id);
    setSessionId(sid);
    setItens(itensSessao);
    saveContagemExpressDraft(sid, itensSessao, sessao.id);
    setView('contagem');
    limparSelecao();
  };

  const pausarEAbrirSessoes = async () => {
    if (conferenciaId && itens.length > 0) {
      try {
        await sincronizarSessaoContagemExpress(base44, conferenciaId, itens);
      } catch (error) {
        console.error(error);
      }
    }
    setView('sessoes');
    limparSelecao();
  };

  const entradaPreview = useMemo(() => {
    if (!produtoSelecionado || !entradaPendente) return null;
    const qtd = parseFloat(quantidadePendente) || 0;
    return updateCountEntryQuantity(entradaPendente, produtoSelecionado, qtd);
  }, [produtoSelecionado, entradaPendente, quantidadePendente]);

  const pendenteBase = entradaPreview
    ? getEntryBaseQuantity(entradaPreview, produtoSelecionado)
    : 0;

  const carrinhoBaseParaPainel = produtoSelecionado && modoContagem === 'adicionar'
    ? totalCarrinhoProduto(produtoSelecionado.id)
    : 0;

  const unidadePainel = entradaPreview
    ? getCountUnitForEntry(produtoSelecionado, entradaPreview).unidade
    : 'UN';

  const cartProductIds = useMemo(
    () => itensAgrupados.map((g) => g.produto_id),
    [itensAgrupados],
  );

  const handleConfirmLote = async () => {
    const draftCount = Object.keys(loteDraft).length;
    if (draftCount === 0) return;
    const novosItens = mergeLoteDraftIntoCountItens(itens, loteDraft, produtos);
    allowProgrammaticFocusBriefly();
    await persistItens(novosItens);
    setLoteDraft({});
    setModoLote(false);
    setBusca('');
    setProdutosFiltrados([]);
    toast.success(`${draftCount} produto(s) adicionado(s) à contagem.`);
  };

  const confirmarProduto = () => {
    if (!produtoSelecionado || !entradaPreview) return;
    const qtd = parseFloat(quantidadePendente);
    if (quantidadePendente === '' || Number.isNaN(qtd) || qtd < 0) return;

    let novosItens;
    if (modoContagem === 'substituir') {
      novosItens = [
        ...itens.filter((i) => i.produto_id !== produtoSelecionado.id),
        entradaPreview,
      ];
    } else {
      novosItens = [...itens, entradaPreview];
    }

    allowProgrammaticFocusBriefly();
    persistItens(novosItens);
    limparSelecao({ focarBusca: true });
  };

  const removerDoCarrinho = async (produtoId) => {
    if (!produtoId) return;
    const novosItens = itens.filter((i) => i.produto_id !== produtoId);
    allowProgrammaticFocusBriefly();
    await persistItens(novosItens);
    limparSelecao({ focarBusca: view === 'contagem' });

    if (view === 'carrinho') {
      if (novosItens.length === 0) {
        setComparativo([]);
        return;
      }
      setLoadingComparativo(true);
      try {
        const rows = await buildComparativoContagem(base44, novosItens, produtos);
        setComparativo(rows);
      } catch (error) {
        console.error(error);
        toast.error('Não foi possível atualizar as diferenças.');
      }
      setLoadingComparativo(false);
    }
  };

  const abrirCarrinho = async () => {
    setView('carrinho');
    if (itens.length === 0) {
      setComparativo([]);
      return;
    }
    setLoadingComparativo(true);
    try {
      const rows = await buildComparativoContagem(base44, itens, produtos);
      setComparativo(rows);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível calcular as diferenças.');
    }
    setLoadingComparativo(false);
  };

  const handleSalvarClick = () => {
    if (itens.length === 0) return;
    void handleSalvarContagem();
  };

  const handleImprimir = async () => {
    if (itens.length === 0) return;
    setImprimindo(true);
    try {
      const rows = comparativo.length > 0
        ? comparativo
        : await buildComparativoContagem(base44, itens, produtos);
      if (!comparativo.length) setComparativo(rows);
      await imprimirRelatorioContagemExpress({
        referenciaNumero: sessionId,
        usuarioNome: usuario?.nome || usuario?.full_name || usuario?.email || 'Operador',
        comparativo: rows,
        produtos,
        rascunho: true,
      });
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível gerar o relatório.');
    }
    setImprimindo(false);
  };

  const handleSalvarContagem = async () => {
    setFinalizando(true);
    try {
      const comparativoPre = await buildComparativoContagem(base44, itens, produtos);
      const usuarioNome = usuario?.nome || usuario?.full_name || usuario?.email || usuario?.id || 'Operador';
      const usuarioEmail = usuario?.email || usuario?.id || '';

      const resultado = await aplicarContagemExpress(base44, {
        itens,
        produtos,
        sessionId,
        conferenciaId,
        usuarioNome,
        usuarioEmail,
      });

      await publicarRelatorioContagemExpress({
        referenciaNumero: resultado.referenciaNumero,
        usuarioNome,
        dataLancamento: resultado.dataLancamento,
        comparativo: comparativoPre,
        produtos,
        movimentacoes: resultado.movimentacoes,
      });

      clearContagemExpressDraft();
      setConferenciaId(null);
      setSessionId(createContagemExpressSessionId());
      setItens([]);
      setComparativo([]);
      setView('sessoes');
      limparSelecao();

      toast.success(
        `Contagem lançada: ${resultado.ajustesAplicados} movimento(s) em ${resultado.produtosContados} produto(s). Relatório gerado.`
      );
    } catch (error) {
      console.error(error);
      toast.error('Erro ao lançar a contagem. Tente novamente.');
    }
    setFinalizando(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (view === 'sessoes') {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-background font-din-1451">
        <ContagemExpressPainelSessoes
          usuario={usuario}
          produtos={produtos}
          onContinuar={continuarSessao}
          onSessaoCancelada={handleSessaoCancelada}
          onVoltar={() => navigate(createPageUrl('Dashboard'))}
        />
      </div>
    );
  }

  if (view === 'carrinho') {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-background font-din-1451">
        <ContagemExpressCarrinho
          itensAgrupados={itensAgrupados}
          comparativo={comparativo}
          loadingComparativo={loadingComparativo}
          finalizando={finalizando}
          imprimindo={imprimindo}
          onVoltar={() => setView('contagem')}
          onSalvar={handleSalvarClick}
          onImprimir={handleImprimir}
          onEditarItem={(grupo) => {
            const produto = grupo._produto || produtos.find((p) => p.id === grupo.produto_id);
            if (!produto) return;
            setView('contagem');
            iniciarSelecao(produto, {
              modo: 'substituir',
              quantidadeInicial: grupo.display?.quantidade ?? grupo.totalBase,
            });
          }}
          onRemoverItem={(grupo) => removerDoCarrinho(grupo.produto_id)}
        />
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full max-w-full flex-col overflow-hidden bg-background font-din-1451">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/40 px-3 py-2.5">
        <button
          type="button"
          onClick={pausarEAbrirSessoes}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold font-glacial text-foreground">
          Contagem Express
        </h1>
        {!produtoSelecionado && (
          <CatalogLoteModeToggle
            active={modoLote}
            onClick={() => {
              setModoLote((v) => !v);
              setLoteDraft({});
            }}
          />
        )}
        <button
          type="button"
          onClick={pausarEAbrirSessoes}
          aria-label="Contagens"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground"
        >
          <ClipboardList className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={abrirCarrinho}
          aria-label="Carrinho"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground"
        >
          <ShoppingCart className="h-4 w-4" />
          {itensAgrupados.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#a4ce33] px-0.5 text-[9px] font-bold text-[#1f1d22]">
              {itensAgrupados.length}
            </span>
          )}
        </button>
      </div>

      {!produtoSelecionado && !modoLote && (
        <div className="shrink-0 px-3 pt-3">
          <div className={cn('relative rounded-2xl', P38_FIELD_SURFACE)}>
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={buscaRef}
              variant="search"
              placeholder="Buscar produto..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-14 border-0 bg-transparent pl-12 text-base shadow-none focus-visible:ring-0"
            />
          </div>
        </div>
      )}

      <div
        className={`min-h-0 flex-1 overflow-hidden flex flex-col ${
          modoLote && !produtoSelecionado ? '' : 'overflow-y-auto overscroll-contain px-3 py-3'
        } ${
          itens.length > 0
            ? 'pb-[calc(var(--p38-bottom-nav-total,0px)+5.5rem)]'
            : 'pb-[calc(var(--p38-bottom-nav-total,0px)+0.5rem)]'
        }`}
      >
        {produtoSelecionado ? (
          <ContagemExpressPainelContagem
            produto={produtoSelecionado}
            produtoNome={resolveInventoryProductName(produtoSelecionado)}
            quantidade={quantidadePendente}
            unidade={unidadePainel}
            saldoInfo={saldoInfo}
            totalNoCarrinhoBase={carrinhoBaseParaPainel}
            pendenteBase={pendenteBase}
            onQuantidadeChange={setQuantidadePendente}
            onMenos={() => {
              const q = Math.max(0, (parseFloat(quantidadePendente) || 0) - 1);
              setQuantidadePendente(String(q));
            }}
            onMais={() => {
              const q = (parseFloat(quantidadePendente) || 0) + 1;
              setQuantidadePendente(String(q));
            }}
            onTrocarUnidade={() => setUnitSelector({ open: true, product: produtoSelecionado })}
            onConfirmar={confirmarProduto}
            onCancelar={limparSelecao}
            onRemover={modoContagem === 'substituir'
              ? () => removerDoCarrinho(produtoSelecionado.id)
              : undefined}
            confirmLabel={modoContagem === 'substituir' ? 'Atualizar' : 'Confirmar'}
          />
        ) : modoLote ? (
          <CatalogLotePicker
            products={produtos}
            search={busca}
            onSearchChange={setBusca}
            draft={loteDraft}
            onDraftChange={setLoteDraft}
            onConfirm={handleConfirmLote}
            onExit={() => {
              setModoLote(false);
              setLoteDraft({});
            }}
            cartProductIds={cartProductIds}
            getUnitLabel={getDefaultCountUnitLabel}
            confirmLabel="Confirmar contagens"
            searchPlaceholder="Ex: areia fina; cimento..."
            exitModeLabel="Contagem unitária"
            emptySearchTitle="Busque para contar em lote"
            emptySearchHint="Combine termos — ex:"
            emptySearchExample="AREIA FINA"
            sortResultsAlphabetically
            showStockLine
          />
        ) : produtosFiltrados.length > 0 ? (
          <div className="space-y-3">
            <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {produtosFiltrados.length} resultado{produtosFiltrados.length !== 1 ? 's' : ''} · ordem alfabética
            </p>
            {produtosFiltrados.map((prod) => {
              const nome = resolveInventoryProductName(prod);
              const noCarrinho = itensAgrupados.find((g) => g.produto_id === prod.id);
              const estoqueDisplay = getGroupDisplayFromBase(prod, prod.estoque_atual || 0);
              const unidade = getDefaultCountUnit(prod).unidade;
              return (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => {
                    allowProgrammaticFocusBriefly();
                    iniciarSelecao(prod);
                  }}
                  className={cn(
                    'w-full rounded-2xl p-5 text-left transition-all active:scale-[0.99]',
                    P38_FIELD_SURFACE,
                    noCarrinho && 'ring-2 ring-[#a4ce33]/40 dark:ring-[#a4ce33]/30',
                  )}
                >
                  <p className="text-base font-medium leading-snug text-foreground">{nome}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-mono text-xs">#{prod.codigo_interno || '—'}</span>
                    <span className="mx-2">·</span>
                    <span>{unidade}</span>
                  </p>
                  <CatalogProductStockLine product={prod} className="mt-2" />
                  {noCarrinho ? (
                    <p className={cn('mt-2 text-sm font-semibold', P38_ACCENT)}>
                      Já contado: {formatCountQuantity(noCarrinho.display?.quantidade)}{' '}
                      {noCarrinho.display?.unidade}
                      <span className="ml-2 font-normal text-muted-foreground">
                        (sistema {formatCountQuantity(estoqueDisplay.quantidade)} {estoqueDisplay.unidade})
                      </span>
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : busca.trim() ? (
          <div className="py-16 text-center text-muted-foreground">
            <Package className="mx-auto mb-4 h-14 w-14 opacity-20" />
            <p className="font-medium">Nenhum produto para &quot;{busca}&quot;</p>
          </div>
        ) : null}
      </div>

      <ContagemExpressFabConcluir
        visivel={itens.length > 0}
        loading={finalizando}
        totalItens={itensAgrupados.length}
        onClick={handleSalvarClick}
      />

      <ProductUnitSelectorDialog
        open={unitSelector.open}
        product={unitSelector.product}
        mode="sale"
        onClose={() => setUnitSelector({ open: false, product: null })}
        onConfirm={(unitOption) => {
          if (!unitOption || !entradaPendente || !produtoSelecionado) {
            setUnitSelector({ open: false, product: null });
            return;
          }
          setEntradaPendente(changeCountEntryUnit(entradaPendente, produtoSelecionado, unitOption));
          setUnitSelector({ open: false, product: null });
        }}
      />
    </div>
  );
}
