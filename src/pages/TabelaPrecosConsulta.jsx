import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, Package, Boxes, Loader2, Calculator } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import OrcamentoSheet from '@/components/orcamento/OrcamentoSheet';
import { calcularPrecoVendaTabela, getSaleUnitContextForTabela } from '@/lib/orcamentoPrecoTabela';
import { formatEstoqueDisponivelApresentacao, getUnidadeExibicaoSigla, hasAlternativeUnits } from '@/lib/productUnits';
import { p38Mobile } from '@/lib/p38MobileSurfaces';
import { P38MobileLineList, P38StatusDot } from '@/components/ui/p38-mobile-line';
import { p38Table } from '@/lib/p38TableSurfaces';
import { cn } from '@/components/utils';
import { filterAndSortProducts, sortProductsAlphabetically } from '@/components/compras/productMatchingUtils';

const fmtR = (n) => (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN = (n) => (n ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

// ── Card de SKU ────────────────────────────────────────────────────────────────
function SkuCard({ row, calcularPreco, tabelaSelecionada }) {
  const p      = row.produto;
  const e = p.estoque_atual  || 0;
  const m = p.estoque_minimo || 0;
  const { unidadeDefault, precoSelecionado } = getSaleUnitContextForTabela(p, tabelaSelecionada);
  const siglaVitrine = unidadeDefault?.unidade || getUnidadeExibicaoSigla(p, p.unidade_principal || 'UN');
  const precoFinal = precoSelecionado ?? calcularPreco(p);
  const listaOpts = getSaleUnitContextForTabela(p, null).unitOptions;
  const listaUnit = listaOpts.find((o) => o.unidade === siglaVitrine) || listaOpts[0];
  const precoOriginal = Number(listaUnit?.valor_unitario ?? p.preco_venda_padrao ?? 0);
  const temAjuste = tabelaSelecionada && tabelaSelecionada.fator_ajuste !== 1;
  const estoqueDisp = formatEstoqueDisponivelApresentacao(p);
  const estoqueExibicao = estoqueDisp.quantidade;
  const unidadeExibicao = estoqueDisp.sigla;

  return (
    <div
      className={cn(p38Table.mobileLine, 'flex items-center gap-4 border-l-transparent')}
      style={{ boxSizing: 'border-box' }}
    >
      {/* Thumbnail */}
      <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden">
        {p.imagem_url
          ? <img src={p.imagem_url} alt="" className="w-full h-full object-cover" />
          : <Package className="w-5 h-5 text-muted-foreground dark:text-muted-foreground" />}
      </div>

      {/* Nome + info */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="text-sm font-medium text-foreground/90 leading-snug break-words flex items-center gap-1.5 flex-wrap">
          {hasAlternativeUnits(p) && (
            <span title="Várias unidades de venda" className="inline-flex flex-shrink-0">
              <Boxes className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />
            </span>
          )}
          <span>{p.nome}</span>
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {/* Status estoque */}
          <div className="flex items-center gap-1.5">
            <P38StatusDot tone={!p.ativo ? 'muted' : e <= 0 ? 'danger' : e <= m ? 'warning' : 'success'} />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {fmtN(estoqueExibicao)} {unidadeExibicao}
            </span>
          </div>
          {/* Código */}
          {p.codigo_interno && (
            <span className="text-[10px] text-muted-foreground/80 font-mono tracking-wide whitespace-nowrap">
              #{p.codigo_interno}
            </span>
          )}
        </div>
      </div>

      {/* Preço — direita */}
      <div className="flex-shrink-0 text-right">
        {temAjuste && precoOriginal > 0 && (
          <div className="text-xs text-muted-foreground line-through whitespace-nowrap tabular-nums">
            R$ {fmtR(precoOriginal)}
          </div>
        )}
        {precoFinal > 0 && (
          <div className="text-base font-bold text-foreground whitespace-nowrap tabular-nums">
            R$ {fmtR(precoFinal)}
            <span className="text-[10px] font-normal text-muted-foreground ml-0.5">/{siglaVitrine}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function TabelaPrecosConsulta() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tabelaSelecionada, setTabelaSelecionada] = useState(null);
  const [tabelas, setTabelas] = useState([]);
  const [showOrcamento, setShowOrcamento] = useState(false);
  const [empresa, setEmpresa] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [, tabelasData, produtosData, empresaData] = await Promise.all([
        base44.auth.me(),
        base44.entities.TabelaPreco.filter({ ativo: true }),
        base44.entities.Produto.filter({ ativo: true }, '-created_date'),
        base44.entities.DadosEmpresa.list().catch(() => []),
      ]);
      setTabelas(tabelasData);
      const tabelaPadrao = tabelasData.find(t => t.is_default) || tabelasData[0];
      if (tabelaPadrao) setTabelaSelecionada(tabelaPadrao);
      setProdutos(produtosData);
      if (empresaData?.length > 0) setEmpresa(empresaData[0]);
    } catch (error) {
      toast.error('Erro ao carregar tabela de preços');
    } finally {
      setLoading(false);
    }
  };

  const produtosFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return sortProductsAlphabetically(produtos);
    return filterAndSortProducts(produtos, searchTerm);
  }, [produtos, searchTerm]);

  const calcularPreco = useCallback(
    (produto) => calcularPrecoVendaTabela(produto, tabelaSelecionada),
    [tabelaSelecionada]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden w-full bg-card relative">

      {/* Área rolável: título/chips sobem; busca fica colada no topo */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain pb-[var(--p38-scroll-pad-below-nav)] desktop-layout:pb-4">

        <div className="px-4 pt-3 pb-2 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-foreground font-glacial">Tabela de Preços</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {produtosFiltrados.length} produto{produtosFiltrados.length !== 1 ? 's' : ''}
                {searchTerm && ` · "${searchTerm}"`}
              </p>
            </div>
            <span className="shrink-0 px-3 py-2 rounded-2xl text-xs font-medium bg-muted text-muted-foreground">
              Ordem alfabética (A→Z)
            </span>
          </div>

          {tabelas.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {tabelas.map((tabela) => (
                <button
                  key={tabela.id}
                  onClick={() => setTabelaSelecionada(tabela)}
                  className={cn(
                    tabelaSelecionada?.id === tabela.id ? p38Mobile.filterChipActive : p38Mobile.filterChip,
                    'cursor-pointer active:scale-95'
                  )}
                >
                  {tabela.nome_tabela}
                  {tabela.fator_ajuste !== 1 && (
                    <span className="ml-1 opacity-70">
                      ({tabela.fator_ajuste > 1 ? '+' : ''}{((tabela.fator_ajuste - 1) * 100).toFixed(0)}%)
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-sm border-b border-border/40 px-4 py-2.5 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Nome ou código (espaço ou ; para combinar termos)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(p38Mobile.searchInput, 'text-sm pl-10 w-full')}
              aria-label="Buscar produto por nome ou código"
            />
          </div>
        </div>

        {produtosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mb-3">
              <Package className="w-7 h-7 text-muted-foreground dark:text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhum produto encontrado</p>
            {searchTerm && <p className="text-xs text-muted-foreground mt-1">Tente outros termos de busca</p>}
          </div>
        ) : (
          <P38MobileLineList
            allViewports
            className="overflow-visible max-h-none h-auto rounded-none border-0 bg-transparent desktop-layout:rounded-lg desktop-layout:border desktop-layout:border-border/40 desktop-layout:bg-background"
          >
            {produtosFiltrados.map((produto, index) => (
              <SkuCard
                key={produto.id}
                row={{ produto }}
                striped={index % 2 === 1}
                calcularPreco={calcularPreco}
                tabelaSelecionada={tabelaSelecionada}
              />
            ))}
          </P38MobileLineList>
        )}
      </div>

      <button
        onClick={() => setShowOrcamento(true)}
        className="fixed right-4 z-[55] flex h-14 w-14 items-center justify-center rounded-2xl bg-background shadow-xl transition-all hover:bg-primary/90 active:scale-95 dark:bg-muted dark:hover:bg-muted p38-bottom-fab1 lg:right-6"
        title="Novo Orçamento"
      >
        <Calculator className="w-6 h-6 text-foreground" />
      </button>

      <OrcamentoSheet
        isOpen={showOrcamento}
        onClose={() => setShowOrcamento(false)}
        produtos={produtos}
        tabelaSelecionada={tabelaSelecionada}
        calcularPreco={calcularPreco}
        nomeTabela={tabelaSelecionada?.nome_tabela}
        empresa={empresa}
      />
    </div>
  );
}