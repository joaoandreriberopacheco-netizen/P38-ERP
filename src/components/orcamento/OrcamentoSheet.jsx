import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Search, X, ShoppingCart, Printer, ArrowLeft, AlertCircle, Trash2, Plus, Minus, Check, User, CreditCard } from 'lucide-react';
import SimuladorCartaoSheet from '@/components/vendas/SimuladorCartaoSheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import OrcamentoCupom from './OrcamentoCupom';
import LostSalesForm from '@/components/vendas/LostSalesForm';
import ProdutoQuantidadeDialog from './ProdutoQuantidadeDialog';
import { filterAndSortProducts } from '@/components/compras/productMatchingUtils';
import { buildSaleUnitOptions, formatEstoqueDisponivelApresentacao, pickDefaultSaleUnit } from '@/lib/productUnits';
import { getPrecoPisoCustoUnidade, parsePrecoDigitado } from '@/lib/orcamentoPrecoTabela';
import ProdutoThumb from '@/components/produtos/ProdutoThumb';

const fmtR = (n) => (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Linha de produto na busca ─────────────────────────────────────────────────
function ProdutoLinha({ produto, preco, unidadeSelecionada, unitOptions, qtdNoCarrinho, onSelect }) {
  const e = produto.estoque_atual || 0;
  const m = produto.estoque_minimo || 0;
  const dotCls = !produto.ativo ? 'bg-muted'
    : e <= 0 ? 'bg-red-500'
    : e <= m ? 'bg-orange-400'
    : 'bg-green-500';

  const estoqueDisp = formatEstoqueDisponivelApresentacao(produto);

  return (
    <div
      onClick={() => onSelect(produto, preco)}
      className="flex items-center gap-3 mx-3 my-1.5 px-4 py-3 bg-muted/50/60 rounded-2xl active:bg-muted dark:active:bg-muted/60 cursor-pointer shadow-sm"
    >
      <ProdutoThumb produto={produto} size="sm" roundedClassName="rounded-xl" asDiv />
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotCls}`} />

      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground leading-snug line-clamp-2">{produto.nome}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          R$ {fmtR(preco)} / {unidadeSelecionada?.unidade || produto.unidade_principal || 'UN'} · {estoqueDisp.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {estoqueDisp.sigla} em estoque
          {unitOptions?.length > 1 ? ` · ${unitOptions.length} unidades` : ''}
        </p>
      </div>

      {qtdNoCarrinho > 0 ? (
        <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-bold text-white">{qtdNoCarrinho}</span>
        </div>
      ) : (
        <div className="w-6 h-6 rounded-full border border-border/40 flex items-center justify-center flex-shrink-0">
          <Plus className="w-3 h-3 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

// ── Tela de busca de produtos ─────────────────────────────────────────────────
function TelaBusca({ produtos, calcularPreco, itens, onSetQtd, onVerCarrinho, onOpenItemDialog, searchInputRef }) {
  const [search, setSearch] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    if (!searchInputRef) return;
    searchInputRef.current = searchRef.current;
  }, [searchInputRef]);

  useEffect(() => {
    const t = setTimeout(() => searchRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  const filtrados = useMemo(() => {
    if (!search.trim()) return [];
    return filterAndSortProducts(produtos, search, { limit: 60 });
  }, [produtos, search]);

  const totalItens = itens.reduce((s, i) => s + i.qtd, 0);
  const totalValor = itens.reduce((s, i) => s + i.preco_unit * i.qtd, 0);
  const getUnitContext = useCallback((produto) => {
    const precoBase = calcularPreco(produto);
    const mult = precoBase > 0 && (produto.preco_venda_padrao || 0) > 0
      ? precoBase / (produto.preco_venda_padrao || 1)
      : 1;
    const unitOptions = buildSaleUnitOptions(produto, mult);
    const unidadeDefault = pickDefaultSaleUnit(produto, mult) || unitOptions[0] || null;
    const precoSelecionado = unidadeDefault?.valor_unitario ?? precoBase;
    return { unitOptions, unidadeDefault, precoSelecionado };
  }, [calcularPreco]);

  const handleSelect = (produto) => {
    const { unitOptions, unidadeDefault, precoSelecionado } = getUnitContext(produto);
    onOpenItemDialog({
      produto,
      preco: precoSelecionado,
      unidadeSelecionada: unidadeDefault,
      unitOptions,
      qtdAtual: itens.find(i => i.id === produto.id)?.qtd || 0,
      onConfirm: (qtd, novoPreco, unidadeEscolhida) => {
        onSetQtd(produto, novoPreco ?? precoSelecionado, qtd, unidadeEscolhida || unidadeDefault);
      },
      onAfterConfirm: () => setTimeout(() => searchRef.current?.focus(), 80),
    });
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Barra de busca */}
      <div className="px-4 pt-3 pb-3 bg-card flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchRef}
            placeholder="Nome ou código (espaço ou ; para combinar termos)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border-none bg-muted h-12 text-base pl-11 rounded-2xl shadow-none focus-visible:ring-0 w-full"
            autoFocus
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted dark:hover:bg-primary/90"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Resultados */}
      <div className="flex-1 overflow-y-auto">
        {search.trim() === '' ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
            <Search className="w-10 h-10 opacity-30" />
            <p className="text-sm">Digite para buscar produtos</p>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
            <p className="text-sm">Nenhum produto encontrado</p>
            <p className="text-xs text-muted-foreground dark:text-foreground/90">para "{search}"</p>
          </div>
        ) : (
          filtrados.map(p => {
            const { unitOptions, unidadeDefault, precoSelecionado } = getUnitContext(p);
            const item = itens.find(i => i.id === p.id);
            return (
              <ProdutoLinha
                key={p.id}
                produto={p}
                preco={precoSelecionado}
                unidadeSelecionada={unidadeDefault}
                unitOptions={unitOptions}
                qtdNoCarrinho={item?.qtd || 0}
                onSelect={handleSelect}
              />
            );
          })
        )}
        {/* Espaço para FAB carrinho */}
        <div className="h-24" />
      </div>

      {/* FAB carrinho flutuante */}
      {totalItens > 0 && (
        <div className="absolute bottom-4 left-4 right-4">
          <button
            onClick={onVerCarrinho}
            className="w-full flex items-center justify-between bg-background dark:bg-muted text-foreground px-5 py-4 rounded-2xl shadow-xl active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart className="w-5 h-5" />
                <span className="absolute -top-2 -right-2 w-4 h-4 bg-green-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                  {totalItens}
                </span>
              </div>
              <span className="text-sm font-semibold">{totalItens} {totalItens === 1 ? 'item' : 'itens'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tabular-nums">R$ {fmtR(totalValor)}</span>
              <ShoppingCart className="w-4 h-4 opacity-60" />
            </div>
          </button>
        </div>
      )}

    </div>
  );
}

// ── Item no carrinho ──────────────────────────────────────────────────────────
function ItemCarrinho({ item, onSelect, onRemove, onUpdatePreco }) {
  const [precoDraft, setPrecoDraft] = useState(null);
  const [precoErro, setPrecoErro] = useState('');
  const displayPreco = precoDraft ?? String(item.preco_unit ?? '');

  const commitPreco = () => {
    if (!item.preco_livre) return;
    const parsed = parsePrecoDigitado(precoDraft ?? item.preco_unit);
    if (!Number.isFinite(parsed)) {
      setPrecoDraft(null);
      setPrecoErro('');
      return;
    }
    const piso = Number(item.preco_piso_custo ?? 0);
    if (parsed < piso) {
      setPrecoDraft(null);
      setPrecoErro(`Mínimo: R$ ${fmtR(piso)} (custo)`);
      return;
    }
    setPrecoDraft(null);
    setPrecoErro('');
    onUpdatePreco(item.id, parsed);
  };

  return (
    <div className="mx-3 my-1.5 px-4 py-3 bg-muted/50/60 rounded-2xl shadow-sm">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelect(item)}>
        <ProdutoThumb
          produto={{ id: item.id, nome: item.nome, imagem_url: item.imagem_url }}
          size="sm"
          roundedClassName="rounded-xl"
          asDiv
        />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-foreground leading-snug line-clamp-2">{item.nome}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {item.qtd} {item.unidade} × R$ {fmtR(item.preco_unit)}
          </p>
        </div>
        <span className="text-sm font-bold text-foreground tabular-nums flex-shrink-0">
          R$ {fmtR(item.preco_unit * item.qtd)}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onRemove(item.id); }}
          className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5 text-muted-foreground dark:text-muted-foreground hover:text-red-400 transition-colors" />
        </button>
      </div>
      {item.preco_livre && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] text-amber-500 font-medium uppercase tracking-wide whitespace-nowrap">Preço livre</span>
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-amber-600 dark:text-amber-400">R$</span>
            <input autoComplete="off"
              type="text" inputMode="decimal"
              value={displayPreco}
              onChange={e => { setPrecoDraft(e.target.value); setPrecoErro(''); }}
              onBlur={commitPreco}
              onClick={e => e.stopPropagation()}
              className="w-full pl-8 h-9 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-sm text-right border border-amber-200 dark:border-amber-800 focus:ring-1 focus:ring-amber-300 dark:focus:ring-amber-600 text-amber-900 dark:text-amber-100 font-semibold"
            />
          </div>
          {precoErro && <p className="text-[10px] text-red-500 mt-1">{precoErro}</p>}
        </div>
      )}
    </div>
  );
}

// ── Tela do carrinho ──────────────────────────────────────────────────────────
function TelaCarrinho({ itens, calcularPreco, produtos, onSetQtd, onRemove, onGerar, onSimularCartao, formatoCupom, setFormatoCupom, clienteNome, setClienteNome, onVendaPerdida, desconto, setDesconto, tipoDesconto, setTipoDesconto, observacoes, setObservacoes, onUpdatePreco, onOpenItemDialog }) {
  const subtotal = useMemo(() => itens.reduce((s, i) => s + i.preco_unit * i.qtd, 0), [itens]);
  const valorDesconto = useMemo(() => {
    if (!desconto || desconto <= 0) return 0;
    if (tipoDesconto === 'percentual') return subtotal * (desconto / 100);
    return desconto;
  }, [desconto, tipoDesconto, subtotal]);
  const total = subtotal - valorDesconto;

  const handleSelectItem = (item) => {
    const produto = produtos.find(p => p.id === item.id);
    if (!produto) return;
    const precoBase = calcularPreco(produto);
    const mult = precoBase > 0 && (produto.preco_venda_padrao || 0) > 0
      ? precoBase / (produto.preco_venda_padrao || 1)
      : 1;
    const unitOptions = buildSaleUnitOptions(produto, mult);
    const unidadeSelecionada = unitOptions.find((opt) => opt.unidade === item.unidade) || pickDefaultSaleUnit(produto, mult);
    onOpenItemDialog({
      produto,
      preco: item.preco_unit,
      unidadeSelecionada,
      unitOptions,
      qtdAtual: item.qtd,
      onConfirm: (qtd, novoPreco, unidadeEscolhida) => {
        onSetQtd(produto, novoPreco ?? item.preco_unit, qtd, unidadeEscolhida || unidadeSelecionada);
      },
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Campo cliente */}
      <div className="px-4 pt-3 pb-2 flex-shrink-0">
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Nome do cliente (opcional)"
            value={clienteNome}
            onChange={e => setClienteNome(e.target.value)}
            className="border-none bg-muted h-11 text-sm pl-10 rounded-2xl shadow-none focus-visible:ring-0"
          />
        </div>
      </div>

      {/* Lista de itens */}
      <div className="flex-1 overflow-y-auto">
        {itens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
            <ShoppingCart className="w-10 h-10 opacity-30" />
            <p className="text-sm">Carrinho vazio</p>
          </div>
        ) : (
          itens.map(item => (
            <ItemCarrinho
              key={item.id}
              item={item}
              onSelect={handleSelectItem}
              onRemove={onRemove}
              onUpdatePreco={onUpdatePreco}
            />
          ))
        )}
      </div>

      {/* Rodapé */}
      {itens.length > 0 && (
        <div className="flex-shrink-0 px-4 pb-6 pt-4 border-t border-border/40 space-y-3">
          {/* Venda Perdida */}
          <button
            onClick={onVendaPerdida}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/10 rounded-2xl transition-colors"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Registrar Venda Perdida
          </button>

          {/* Desconto */}
          <div className="bg-muted/50/60 rounded-xl p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Desconto</span>
            </div>
            <div className="flex gap-1.5 items-center">
              <div className="relative flex-1">
                <Input type="number" min="0" step="0.01"
                  value={desconto} onChange={(e) => setDesconto(parseFloat(e.target.value) || 0)}
                  className="pr-5 h-8 bg-card border-0 shadow-sm rounded-lg text-xs text-right focus:ring-1 focus:ring-border/40 dark:focus:ring-ring"
                  placeholder="0" />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{tipoDesconto === 'percentual' ? '%' : 'R$'}</span>
              </div>
              <button onClick={() => setTipoDesconto(tipoDesconto === 'percentual' ? 'fixo' : 'percentual')}
                className="h-8 px-2 bg-muted rounded-lg text-[10px] font-semibold text-foreground/90">
                {tipoDesconto === 'percentual' ? '%' : 'R$'}
              </button>
            </div>
          </div>

          {/* Observações */}
          <div className="relative">
            <Input
              placeholder="Observações (opcional)"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="border-0 bg-muted h-10 text-sm rounded-2xl shadow-none focus-visible:ring-0"
            />
          </div>

          {/* Total */}
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">{itens.length} {itens.length === 1 ? 'item' : 'itens'}</span>
            <div className="flex flex-col items-end gap-1">
              {valorDesconto > 0 && <span className="text-xs text-muted-foreground line-through">R$ {fmtR(subtotal)}</span>}
              <span className="text-2xl font-bold text-foreground font-glacial tabular-nums">R$ {fmtR(total)}</span>
            </div>
          </div>

          {/* Formato de impressão */}
          <div className="flex gap-2">
            {['80mm', 'a4'].map(fmt => (
              <button
                key={fmt}
                onClick={() => setFormatoCupom(fmt)}
                className={`flex-1 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                  formatoCupom === fmt
                    ? 'bg-muted text-foreground dark:bg-muted dark:text-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {fmt === '80mm' ? '🧾 Cupom 80mm' : '📄 Folha A4'}
              </button>
            ))}
          </div>

          {/* Botão simulador de taxa */}
          <button
            onClick={onSimularCartao}
            className="w-full flex items-center justify-center gap-2 bg-muted/50 text-muted-foreground py-3 rounded-2xl text-xs font-medium active:scale-[0.98] transition-all"
          >
            <CreditCard className="w-4 h-4" />
            Simular taxa no cartão
          </button>

          {/* Botão gerar */}
          <button
            onClick={onGerar}
            className="w-full flex items-center justify-center gap-2 bg-background dark:bg-muted text-foreground py-4 rounded-2xl text-sm font-bold shadow-lg active:scale-[0.98] transition-all"
          >
            <Printer className="w-5 h-5" />
            Gerar Orçamento
          </button>
        </div>
      )}

    </div>
  );
}

// ── Sheet principal ───────────────────────────────────────────────────────────
export default function OrcamentoSheet({ isOpen, onClose, produtos, tabelaSelecionada, calcularPreco, nomeTabela, empresa }) {
  const [itens, setItens] = useState([]);
  const [tela, setTela] = useState('busca'); // 'busca' | 'carrinho'
  const [showCupom, setShowCupom] = useState(false);
  const [formatoCupom, setFormatoCupom] = useState('80mm');
  const [clienteNome, setClienteNome] = useState('');
  const [showLostSales, setShowLostSales] = useState(false);
  const [showSimuladorCartao, setShowSimuladorCartao] = useState(false);
  const [desconto, setDesconto] = useState(0);
  const [tipoDesconto, setTipoDesconto] = useState('percentual');
  const [observacoes, setObservacoes] = useState('');
  const [itemDialog, setItemDialog] = useState(null);
  const searchInputRef = useRef(null);

  const openItemDialog = useCallback((payload) => setItemDialog(payload), []);
  const closeItemDialog = useCallback(() => setItemDialog(null), []);

  useEffect(() => {
    if (!isOpen || tela !== 'busca') return;
    const t = setTimeout(() => searchInputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [isOpen, tela]);

  const subtotal = useMemo(() => itens.reduce((s, i) => s + i.preco_unit * i.qtd, 0), [itens]);
  const valorDesconto = useMemo(() => {
    if (!desconto || desconto <= 0) return 0;
    if (tipoDesconto === 'percentual') return subtotal * (desconto / 100);
    return desconto;
  }, [desconto, tipoDesconto, subtotal]);
  const total = subtotal - valorDesconto;

  // Adiciona, atualiza ou remove (qtd=0) um item
  const handleSetQtd = useCallback((produto, preco, qtd, unidadeSelecionada = null) => {
    setItens(prev => {
      if (qtd <= 0) return prev.filter(i => i.id !== produto.id);
      const existe = prev.find(i => i.id === produto.id);
      const unidade = unidadeSelecionada?.unidade || produto.unidade_principal || 'UN';
      const fator = unidadeSelecionada?.fator_conversao ?? 1;
      const precoPisoCusto = getPrecoPisoCustoUnidade(produto, unidadeSelecionada);
      if (existe) {
        return prev.map(i =>
          i.id === produto.id
            ? {
                ...i,
                qtd,
                imagem_url: produto.imagem_url || i.imagem_url || null,
                preco_unit: preco ?? i.preco_unit,
                unidade,
                unidade_medida: unidade,
                unidade_sigla: unidade,
                fator_conversao: fator,
                quantidade_base: qtd * fator,
                preco_referencia_tabela: i.preco_referencia_tabela ?? preco,
                preco_piso_custo: precoPisoCusto,
              }
            : i
        );
      }
      return [...prev, {
        id: produto.id,
        nome: produto.nome,
        imagem_url: produto.imagem_url || null,
        preco_unit: preco,
        qtd,
        unidade,
        unidade_medida: unidade,
        unidade_sigla: unidade,
        fator_conversao: fator,
        quantidade_base: qtd * fator,
        preco_livre: produto.preco_livre || false,
        preco_referencia_tabela: preco,
        preco_piso_custo: precoPisoCusto,
      }];
    });
  }, []);

  const handleUpdatePreco = useCallback((id, novoPreco) => {
    setItens(prev => prev.map(i => {
      if (i.id !== id) return i;
      return { ...i, preco_unit: Number(novoPreco) || 0 };
    }));
  }, []);

  const handleRemove = useCallback((id) => setItens(prev => prev.filter(i => i.id !== id)), []);


  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setItens([]);
      setTela('busca');
      setShowCupom(false);
      setClienteNome('');
    }, 300);
  };

  if (!isOpen) return null;

  if (showCupom) {
    return (
      <OrcamentoCupom
        itens={itens}
        total={total}
        desconto={valorDesconto}
        subtotal={subtotal}
        observacoes={observacoes}
        formato={formatoCupom}
        nomeTabela={nomeTabela}
        clienteNome={clienteNome}
        empresa={empresa}
        onVoltar={() => setShowCupom(false)}
        onClose={handleClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-card relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/40 flex-shrink-0">
        <button
          onClick={tela === 'carrinho' ? () => setTela('busca') : handleClose}
          className="p-2 -ml-1 rounded-2xl hover:bg-muted transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>

        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-foreground font-glacial">
            {tela === 'carrinho' ? 'Revisar Orçamento' : 'Novo Orçamento'}
          </h2>
          {nomeTabela && <p className="text-[11px] text-muted-foreground truncate">{nomeTabela}</p>}
        </div>

        {/* Botão carrinho no header quando na tela de busca */}
        {tela === 'busca' && itens.length > 0 && (
          <button
            onClick={() => setTela('carrinho')}
            className="relative p-2 rounded-2xl hover:bg-muted transition-colors"
          >
            <ShoppingCart className="w-5 h-5 text-muted-foreground" />
            <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-green-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
              {itens.reduce((s, i) => s + i.qtd, 0)}
            </span>
          </button>
        )}

        {tela === 'busca' && (
          <button onClick={handleClose} className="p-2 rounded-2xl hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* LostSalesForm */}
      <LostSalesForm
        open={showLostSales}
        onClose={() => setShowLostSales(false)}
        currentUser={null}
      />

      {/* Corpo */}
      <div className="flex-1 overflow-hidden">
        {tela === 'busca' ? (
          <TelaBusca
            produtos={produtos}
            calcularPreco={calcularPreco}
            itens={itens}
            onSetQtd={handleSetQtd}
            onVerCarrinho={() => setTela('carrinho')}
            onOpenItemDialog={openItemDialog}
            searchInputRef={searchInputRef}
          />
        ) : (
           <>
             <TelaCarrinho
               itens={itens}
               calcularPreco={calcularPreco}
               produtos={produtos}
               onSetQtd={handleSetQtd}
               onRemove={handleRemove}
               onUpdatePreco={handleUpdatePreco}
               onOpenItemDialog={openItemDialog}
               onGerar={() => setShowCupom(true)}
               onSimularCartao={() => setShowSimuladorCartao(true)}
               formatoCupom={formatoCupom}
               setFormatoCupom={setFormatoCupom}
               clienteNome={clienteNome}
               setClienteNome={setClienteNome}
               onVendaPerdida={() => setShowLostSales(true)}
               desconto={desconto}
               setDesconto={setDesconto}
               tipoDesconto={tipoDesconto}
               setTipoDesconto={setTipoDesconto}
               observacoes={observacoes}
               setObservacoes={setObservacoes}
             />
             <SimuladorCartaoSheet
               open={showSimuladorCartao}
               onClose={() => setShowSimuladorCartao(false)}
               valorTotal={total}
               valorDesconto={valorDesconto}
             />
           </>
         )}
      </div>

      {itemDialog && (
        <ProdutoQuantidadeDialog
          embedded
          produto={itemDialog.produto}
          preco={itemDialog.preco}
          qtdAtual={itemDialog.qtdAtual}
          unidadeSelecionada={itemDialog.unidadeSelecionada}
          unitOptions={itemDialog.unitOptions}
          onClose={closeItemDialog}
          dialogTitleId="orcamento-item-dialog-title"
          overlayClassName="z-[10]"
          selectContentClassName="z-[70]"
          onConfirm={(qtd, novoPreco, unidadeEscolhida) => {
            itemDialog.onConfirm(qtd, novoPreco, unidadeEscolhida);
            closeItemDialog();
            itemDialog.onAfterConfirm?.();
          }}
        />
      )}
    </div>
  );
}