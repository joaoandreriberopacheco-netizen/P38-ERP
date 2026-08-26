import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense, startTransition, lazy } from 'react';
import { Button } from '@/components/ui/button';
import ProdutosAccessGuard from '@/components/guard/ProdutosAccessGuard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { base44 } from '@/api/base44Client';
import { roundToTwoDecimals, formatCurrency } from '@/lib/financialUtils';
import { dataHoje } from '@/components/utils/dateUtils';
import ProdutoFormCompleto from '../components/produtos/ProdutoFormCompleto';
const ColumnSelector = lazy(() => import('../components/produtos/ColumnSelector'));
const MassImageUploader = lazy(() => import('../components/produtos/MassImageUploader'));
const MassTagGenerator = lazy(() => import('../components/produtos/MassTagGenerator'));
const MassCategoryClassifier = lazy(() => import('../components/produtos/MassCategoryClassifier'));
const MassPrecificacaoDialog = lazy(() => import('../components/produtos/MassPrecificacaoDialog'));
const PontosPedidoCatalogoDialog = lazy(() => import('../components/produtos/PontosPedidoCatalogoDialog'));
const CatalogTagPrintDialog = lazy(() => import('../components/produtos/CatalogTagPrintDialog'));
import TreeGrid, { TREE_GRID_EXPAND_ALL_LEVEL } from '../components/produtos/treegrid/TreeGrid';
import MobileHierarquica, { CatalogoMobileScrollShell } from '../components/produtos/MobileHierarquica';
import ProdutoFAB from '../components/produtos/ProdutoFAB';
import ExcluirProdutoDialog from '../components/produtos/ExcluirProdutoDialog';
import ProdutosHeader from '../components/produtos/ProdutosHeader';
import ProdutosCommandBar from '../components/produtos/ProdutosCommandBar';
import ProdutosPlanaTable from '../components/produtos/ProdutosPlanaTable';
import { isCadastroIncompleto } from '../components/produtos/ProdutosHelpers';
import {
  filterProdutos,
  countActiveProdutoFilters,
  describeProdutoFilters,
  getCatalogProdutoEntryFilters,
  collectCatalogVitrineUnits,
  DEFAULT_PRODUTO_FILTERS,
} from '@/lib/filterProdutos';
import {
  CATALOG_SALES_WINDOW_LABELS,
  normalizeCatalogSalesWindow,
  buildCatalogSalesVelocityMap,
} from '@/lib/catalogSalesVelocity';
import { filtersNeedSalesVelocity } from '@/lib/catalogNumericFilters';
import { createCatalogStockContext } from '@/lib/catalogEstoqueVirtual';
import { fetchPedidosCompraParaSugestaoEstoque } from '@/lib/fetchPedidosCompraParaSugestaoEstoque';
import { buildPendenteAprovadoFinanceiroPorProduto } from '@/lib/sugestaoCompraEstoquePendente';
import { saveCatalogProdutoFilters } from '@/lib/catalogProdutoFiltersStorage';
import { sumCatalogStockTotals, lineEstoqueQuantidade, lineValorCustoTotal } from '@/lib/catalogStockTotals';
import {
  loadCatalogProdutoColumns,
  saveCatalogProdutoColumns,
} from '@/lib/catalogProdutoColumnsStorage';
import { compareProdutosForCatalogSort } from '@/lib/catalogProdutoPerformance';
import { useDesktopContent } from '@/hooks/use-breakpoint';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { p38Keys } from '@/lib/p38QueryConfig';
import { downloadBlob } from '@/lib/mobilePrintAndShare';
import {
  useProdutosComIepQuery,
  useFornecedoresQuery,
  usePedidosVenda90dQuery,
} from '@/hooks/useP38Entities';
import { usePermissoesUsuario } from '@/hooks/usePermissoesUsuario';
import { filtrarColunasCatalogoPorPermissao } from '@/lib/permissaoKit';

const CATALOG_GROUP_BY_CATEGORY_KEY = 'catalogo.groupTreeByCategory';

/** Selects do painel de filtros — feedback imediato no controlo. */
const IMMEDIATE_CATALOG_FILTER_KEYS = new Set([
  'categoria',
  'fornecedorId',
  'statusEstoque',
  'abcd',
  'cadastroIncompleto',
  'ativoStatus',
  'unidadeVitrine',
  'searchStartsWith',
  'quantidadeOperador',
]);

function catalogRowsShallowEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function readGroupTreeByCategoryPreference() {
  try {
    return localStorage.getItem(CATALOG_GROUP_BY_CATEGORY_KEY) === '1';
  } catch {
    return false;
  }
}

/** Base44 por vezes devolve GET/list com campos de vitrine vazios; não podem apagar valores já bons. */
function isEmptyishVitrine(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}

const VITRINE_MERGE_KEYS = ['unidade_vitrine'];

function mergeProdutoPreferVitrine(baseRow, fromGet) {
  if (!fromGet || typeof fromGet !== 'object') return baseRow || fromGet;
  if (!baseRow || typeof baseRow !== 'object') return fromGet;
  const merged = { ...baseRow, ...fromGet };
  for (const k of VITRINE_MERGE_KEYS) {
    if (isEmptyishVitrine(fromGet[k]) && !isEmptyishVitrine(baseRow[k])) {
      merged[k] = baseRow[k];
    }
  }
  return merged;
}

/** O que acabou de ser gravado no formulário — prevalece sobre list/get ainda stale no mesmo tick. */
function applyJustSavedUnitSnapshot(merged, snap) {
  if (!merged || !snap || merged.id !== snap.id) return merged;
  const out = { ...merged };
  for (const k of VITRINE_MERGE_KEYS) {
    // `''` significa vitrine na unidade base — tem de gravar no estado; não usar isEmptyish aqui.
    if (Object.prototype.hasOwnProperty.call(snap, k)) out[k] = snap[k];
  }
  if (typeof snap.unidade_show_ativa === 'boolean') out.unidade_show_ativa = snap.unidade_show_ativa;
  if (Array.isArray(snap.unidades_alternativas)) out.unidades_alternativas = snap.unidades_alternativas;
  if (Array.isArray(snap.unidades)) out.unidades = snap.unidades;
  if (!isEmptyishVitrine(snap.unidade_principal)) out.unidade_principal = snap.unidade_principal;
  return out;
}

function calculateProdutoStats(produtosList, catalogStockContext = null) {
  let abaixoMin = 0;
  const list = Array.isArray(produtosList) ? produtosList : [];

  list.forEach((p) => {
    if (p.estoque_atual <= p.estoque_minimo && p.ativo) abaixoMin++;
  });

  const totals = sumCatalogStockTotals(list, catalogStockContext);
  let valorEstoqueAtivo = 0;
  for (const p of list) {
    const qtd = lineEstoqueQuantidade(p, catalogStockContext);
    if (qtd > 0) valorEstoqueAtivo += lineValorCustoTotal(p, catalogStockContext);
  }

  return {
    total: totals.count,
    valorEstoque: totals.totalCusto,
    valorEstoqueAtivo,
    abaixoMinimo: abaixoMin,
  };
}

function ProdutosPageContent() {
  const { tem: podePerm } = usePermissoesUsuario();
  const podeVerCusto = podePerm('estoque.ver_custo_compra', 'estoque.visualizar_produtos');

  const [produtos, setProdutos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    valorEstoque: 0,
    valorEstoqueAtivo: 0,
    abaixoMinimo: 0,
  });

  const [filters, setFilters] = useState(() => getCatalogProdutoEntryFilters());
  const [sortOrder, setSortOrder] = useState('az');
  const [viewMode, setViewMode] = useState('plana'); // 'dinamica' | 'plana'
  const [groupTreeByCategory, setGroupTreeByCategory] = useState(readGroupTreeByCategoryPreference);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProduto, setSelectedProduto] = useState(null);
  const [produtoSimilarBase, setProdutoSimilarBase] = useState(null);
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const [produtoParaExcluir, setProdutoParaExcluir] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState(() => loadCatalogProdutoColumns());
  const visibleColumnsEffective = useMemo(
    () => filtrarColunasCatalogoPorPermissao(visibleColumns, podeVerCusto),
    [visibleColumns, podeVerCusto]
  );
  // ── Nível de expansão do TreeGrid (controlado pelo painel fixo externo) ─────
  const [treeLevel, setTreeLevel] = useState(TREE_GRID_EXPAND_ALL_LEVEL);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isMassImageUploaderOpen, setIsMassImageUploaderOpen] = useState(false);
  const [isMassTagOpen, setIsMassTagOpen] = useState(false);
  const [isMassCategoryOpen, setIsMassCategoryOpen] = useState(false);
  const [isMassPrecificacaoOpen, setIsMassPrecificacaoOpen] = useState(false);
  const [isPontosPedidoOpen, setIsPontosPedidoOpen] = useState(false);
  const [isCatalogTagPrintOpen, setIsCatalogTagPrintOpen] = useState(false);
  // States for unified import (products + costs)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);

  // States for costs only import (original functionality, kept for now but could be refactored)
  const [isImportCustosDialogOpen, setIsImportCustosDialogOpen] = useState(false);
  const [importCustosFile, setImportCustosFile] = useState(null);
  const [isProcessingCustos, setIsProcessingCustos] = useState(false);
  const [previewCustosData, setPreviewCustosData] = useState(null);
  const [isPreviewCustosDialogOpen, setIsPreviewCustosDialogOpen] = useState(false);
  const [gerandoRelatorioEstoque, setGerandoRelatorioEstoque] = useState(false);
  const [gerandoRelatorioVendas, setGerandoRelatorioVendas] = useState(false);
  const [gerandoRelatorioVendasV2, setGerandoRelatorioVendasV2] = useState(false);
  const [gerandoRelatorioIep, setGerandoRelatorioIep] = useState(false);
  const relatorioEstoqueAutoRef = useRef(false);
  const relatorioVendasAutoRef = useRef(false);
  const catalogExpandedKeysRef = useRef(new Set());

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isDesktop = useDesktopContent();
  const { data: produtosQuery, refetch: refetchProdutos } = useProdutosComIepQuery();
  const { data: fornecedoresQuery, refetch: refetchFornecedores } = useFornecedoresQuery();

  /** Evita que um `Produto.get` antigo (ex.: abertura do formulário) sobrescreva o estado após save/`loadData`. */
  const produtoDetailFetchGenRef = useRef(0);
  /** Pacote de unidades/vitrine recém-gravado pelo `ProdutoFormCompleto` — aplicado em `loadData` antes de repassar a prop ao form. */
  const justSavedUnitSnapshotRef = useRef(null);

  const applyCatalogSnapshot = useCallback((produtosData, fornecedoresData) => {
    const safeProdutos = Array.isArray(produtosData)
      ? produtosData.filter((p) => p && typeof p === 'object' && p !== null)
      : [];
    const safeFornecedores = Array.isArray(fornecedoresData)
      ? fornecedoresData.filter((f) => f && typeof f === 'object' && f !== null)
      : [];

    setProdutos((prev) => (catalogRowsShallowEqual(prev, safeProdutos) ? prev : safeProdutos));
    setFornecedores((prev) => (catalogRowsShallowEqual(prev, safeFornecedores) ? prev : safeFornecedores));

    const catSet = new Set();
    safeProdutos.forEach((p) => {
      if (p.categoria_nome) catSet.add(p.categoria_nome);
    });
    const nextCategorias = Array.from(catSet);
    setCategorias((prev) => {
      if (prev.length === nextCategorias.length && prev.every((c, i) => c === nextCategorias[i])) return prev;
      return nextCategorias;
    });

    const nextStats = calculateProdutoStats(safeProdutos);
    setStats((prev) => {
      if (
        prev.total === nextStats.total
        && prev.valorEstoque === nextStats.valorEstoque
        && prev.valorEstoqueAtivo === nextStats.valorEstoqueAtivo
        && prev.abaixoMinimo === nextStats.abaixoMinimo
      ) {
        return prev;
      }
      return nextStats;
    });
    return safeProdutos;
  }, []);

  useEffect(() => {
    if (produtosQuery) {
      applyCatalogSnapshot(produtosQuery, fornecedoresQuery ?? []);
    }
  }, [produtosQuery, fornecedoresQuery, applyCatalogSnapshot]);

  useEffect(() => {
    const timer = window.setTimeout(() => saveCatalogProdutoFilters(filters), 250);
    return () => window.clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    saveCatalogProdutoColumns(visibleColumns);
  }, [visibleColumns]);

  const loadData = useCallback(async () => {
    const [{ data: produtosData }, { data: fornecedoresData }] = await Promise.all([
      refetchProdutos(),
      refetchFornecedores(),
    ]);
    const safeProdutos = applyCatalogSnapshot(produtosData ?? [], fornecedoresData ?? []);

    if (isFormOpen && selectedProduto?.id) {
      const editingId = selectedProduto.id;
      const savedSnap = justSavedUnitSnapshotRef.current;
      produtoDetailFetchGenRef.current += 1;
      const gen = produtoDetailFetchGenRef.current;
      const fromList = safeProdutos.find((item) => item?.id === editingId);
      try {
        const full = await base44.entities.Produto.get(editingId);
        if (gen === produtoDetailFetchGenRef.current) {
          if (full && typeof full === 'object') {
            let merged = fromList ? mergeProdutoPreferVitrine(fromList, full) : full;
            if (savedSnap?.id === editingId) merged = applyJustSavedUnitSnapshot(merged, savedSnap);
            setSelectedProduto(merged);
          } else if (fromList) {
            let merged = fromList;
            if (savedSnap?.id === editingId) merged = applyJustSavedUnitSnapshot(merged, savedSnap);
            setSelectedProduto(merged);
          }
        }
      } catch (e) {
        console.warn('[Produtos] Produto.get ao refrescar edição falhou; usando linha da lista.', e);
        if (gen === produtoDetailFetchGenRef.current && fromList) {
          let merged = fromList;
          if (savedSnap?.id === editingId) merged = applyJustSavedUnitSnapshot(merged, savedSnap);
          setSelectedProduto(merged);
        }
      }
    }

  }, [refetchProdutos, refetchFornecedores, applyCatalogSnapshot, isFormOpen, selectedProduto?.id]);

  const handleSave = async (unitSnapshot) => {
    if (unitSnapshot?.id) {
      justSavedUnitSnapshotRef.current = unitSnapshot;
      const patchRow = (row) =>
        row?.id === unitSnapshot.id ? applyJustSavedUnitSnapshot(row, unitSnapshot) : row;
      setProdutos((prev) => prev.map(patchRow));
      setSelectedProduto((prev) =>
        prev?.id === unitSnapshot.id ? applyJustSavedUnitSnapshot(prev, unitSnapshot) : prev
      );
    }
    try {
      await loadData();
    } finally {
      justSavedUnitSnapshotRef.current = null;
    }
    // setIsFormOpen(false); // Mantendo aberto para feedback
  };

  const handleEdit = React.useCallback((produto) => {
    setProdutoSimilarBase(null);
    setSelectedProduto(produto);
    setIsFormOpen(true);
    const id = produto?.id;
    if (!id) return;
    const gen = ++produtoDetailFetchGenRef.current;
    base44.entities.Produto.get(id)
      .then((full) => {
        if (gen !== produtoDetailFetchGenRef.current) return;
        if (full && typeof full === 'object') {
          setSelectedProduto((prev) => (prev?.id === id ? mergeProdutoPreferVitrine(prev, full) : prev));
        }
      })
      .catch((e) => {
        console.warn('[Produtos] Produto.get ao abrir edição falhou.', e);
      });
  }, []);

  const handleAddNew = React.useCallback(() => {
    setProdutoSimilarBase(null);
    setSelectedProduto(null);
    setIsFormOpen(true);
  }, []);

  const handleCreateSimilar = React.useCallback((produto) => {
    setSelectedProduto(null);
    setProdutoSimilarBase(produto);
    setIsFormOpen(true);
  }, []);

  const handleFilterChange = React.useCallback((key, value) => {
    const apply = (prev) => ({ ...prev, [key]: value });
    if (IMMEDIATE_CATALOG_FILTER_KEYS.has(key)) {
      setFilters(apply);
      return;
    }
    startTransition(() => setFilters(apply));
  }, []);

  const setFiltersDeferred = useCallback((update) => {
    startTransition(() => setFilters(update));
  }, []);

  const handleClearCatalogFilters = useCallback(() => {
    setFiltersDeferred({ ...DEFAULT_PRODUTO_FILTERS });
  }, [setFiltersDeferred]);

  const formatarNumero = React.useCallback((numero) => {
    return formatCurrency(numero);
  }, []);

  const handleExportarCatalogo = useCallback(() => {
    const headers = [
      "codigo_interno",
      "codigo_barras",
      "campo_hierarquico_1",
      "campo_hierarquico_2",
      "campo_hierarquico_3",
      "campo_hierarquico_4",
      "campo_hierarquico_5",
      "nome",
      "campos_pendentes",
      "tipo",
      "categoria",
      "marca",
      "tags",
      "imagem_url",
      "valor_compra",
      "frete_percentual",
      "imposto_1_percentual",
      "imposto_2_percentual",
      "desconto_comercial_percentual",
      "outros_custos_percentual",
      "preco_custo_calculado",
      "fornecedor_codigo",
      "preco_venda_padrao",
      "preco_venda_tipo",
      "preco_venda_percentual",
      "dimensoes_cm",
      "volume_cm3",
      "peso_kg",
      "tempo_reposicao_dias",
      "estoque_atual",
      "estoque_minimo",
      "estoque_ideal",
      "estoque_maximo",
      "estoque_avariado",
      "unidade_principal",
      "unidades_por_pacote",
      "controla_serial",
      "controla_lote_validade",
      "ativo"
    ];

    let csvContent = "\uFEFF";
    csvContent += headers.join(";") + "\n";

    produtos.forEach(p => {
      const fornecedor = fornecedores.find(f => f.id === p.fornecedor_padrao_id);
      const fornecedorCodigo = fornecedor?.codigo_interno || '';
      const tagsString = Array.isArray(p.tags) ? p.tags.join(',') : '';
      
      // Identificar campos pendentes
      const cadastroStatus = isCadastroIncompleto(p);
      const camposPendentes = [];
      if (cadastroStatus.checks.semCategoria) camposPendentes.push('Categoria');
      if (cadastroStatus.checks.semFornecedor) camposPendentes.push('Fornecedor');
      if (cadastroStatus.checks.semPrecoVenda) camposPendentes.push('Preço de venda');
      if (cadastroStatus.checks.semCodigoBarras) camposPendentes.push('Cód.Barras');
      if (cadastroStatus.checks.semImagem) camposPendentes.push('Imagem');
      const camposPendentesString = camposPendentes.length > 0 ? camposPendentes.join(', ') : '';

      const row = [
        p.codigo_interno || '',
        p.codigo_barras || '',
        p.campo_hierarquico_1 || '',
        p.campo_hierarquico_2 || '',
        p.campo_hierarquico_3 || '',
        p.campo_hierarquico_4 || '',
        p.campo_hierarquico_5 || '',
        p.nome || '',
        camposPendentesString,
        p.tipo || 'Produto',
        p.categoria_nome || '',
        p.marca || '',
        tagsString,
        p.imagem_url || '',
        formatarNumero(p.valor_compra || 0),
        formatarNumero(p.custo_frete_padrao || 0),
        formatarNumero(p.custo_imposto1_padrao || 0),
        formatarNumero(p.custo_imposto2_padrao || 0),
        formatarNumero(p.desconto_compra_padrao || 0),
        formatarNumero(p.custo_outros_padrao || 0),
        formatarNumero(p.preco_custo_calculado || 0),
        fornecedorCodigo,
        formatarNumero(p.preco_venda_padrao || 0),
        p.preco_venda_tipo || 'percentual',
        formatarNumero(p.preco_venda_percentual || 0),
        p.dimensoes_cm || '',
        formatarNumero(p.volume_cm3 || 0),
        formatarNumero(p.peso_kg || 0),
        p.tempo_reposicao_dias || 0,
        formatarNumero(p.estoque_atual || 0),
        formatarNumero(p.estoque_minimo || 0),
        formatarNumero(p.estoque_ideal || 0),
        formatarNumero(p.estoque_maximo || 0),
        formatarNumero(p.estoque_avariado || 0),
        p.unidade_principal || 'UN',
        p.unidades_por_pacote || 1,
        p.controla_serial ? 'true' : 'false',
        p.controla_lote_validade ? 'true' : 'false',
        p.ativo ? 'true' : 'false'
      ];
      csvContent += row.join(";") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `catalogo_produtos_${dataHoje()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Catálogo exportado!",
      description: `${produtos.length} produtos exportados com todos os campos.`,
      className: "bg-card border border-border/40 dark:bg-muted dark:text-foreground dark:border-border/40",
      duration: 3000
    });
  }, [produtos, fornecedores, formatarNumero, toast]);



  const handleBaixarTemplateUnificado = useCallback(() => {
    const headers = [
      "codigo_interno",
      "codigo_barras",
      "campo_hierarquico_1",
      "campo_hierarquico_2",
      "campo_hierarquico_3",
      "campo_hierarquico_4",
      "campo_hierarquico_5",
      "nome",
      "tipo",
      "categoria",
      "marca",
      "tags",
      "imagem_url",
      "valor_compra",
      "frete_percentual",
      "imposto_1_percentual",
      "imposto_2_percentual",
      "desconto_comercial_percentual",
      "outros_custos_percentual",
      "fornecedor_codigo",
      "preco_venda_padrao",
      "dimensoes_cm",
      "peso_kg",
      "tempo_reposicao_dias",
      "estoque_atual",
      "estoque_minimo",
      "estoque_ideal",
      "estoque_maximo",
      "estoque_avariado",
      "unidade_principal",
      "unidades_por_pacote",
      "controla_serial",
      "controla_lote_validade",
      "ativo"
    ];
    
    let csvContent = "\uFEFF";
    csvContent += "# TEMPLATE COMPLETO DE IMPORTAÇÃO/ATUALIZAÇÃO DE PRODUTOS\n";
    csvContent += "# Se codigo_barras existir, o produto será ATUALIZADO, senão será CRIADO\n";
    csvContent += "# CAMPO_HIERARQUICO_1: obrigatório (ex: Torneira). Define o agrupamento principal na tabela.\n";
    csvContent += "# CAMPO_HIERARQUICO_2..5: opcionais (ex: Mesa, Cromada, 1/2\", Deca). Formam subgrupos.\n";
    csvContent += "# NOME: deixe vazio para gerar automaticamente pela concatenação dos campos hierárquicos\n";
    csvContent += "# TIPO: Produto ou Serviço\n";
    csvContent += "# TAGS: separadas por vírgula (ex: torneira,banheiro,metais)\n";
    csvContent += "# DIMENSOES: formato AxLxP (ex: 30x20x15)\n";
    csvContent += "# Custos em PERCENTUAL (sistema calcula valor em R$)\n";
    csvContent += "# PRECO_VENDA_PADRAO: informe o valor final de venda (sistema calcula markup automaticamente)\n";
    csvContent += "# ESTOQUE_ATUAL: estoque livre para venda\n";
    csvContent += "# CODIGO_INTERNO: gerado automaticamente, não preencher\n";
    csvContent += "# CONTROLA_SERIAL/LOTE_VALIDADE: true/false\n";
    csvContent += "\n";
    csvContent += headers.join(";") + "\n";
    
    // Linha de exemplo
    const exemplo = [
      "",
      "7891234567890",
      "Torneira",
      "Mesa",
      "Cromada",
      "1/2\"",
      "Deca",
      "",
      "Produto",
      "Hidráulica",
      "Deca",
      "torneira,banheiro,metais",
      "",
      "100,00",
      "5",
      "12",
      "9",
      "0",
      "4",
      "FOR-001",
      "180,00",
      "30x20x15",
      "1,5",
      "20",
      "150",
      "50",
      "100",
      "200",
      "0",
      "UN",
      "12",
      "false",
      "false",
      "true"
    ];
    csvContent += exemplo.join(";") + "\n";

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `template_produtos_custos_${dataHoje()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "✓ Template baixado!",
      description: "Preencha produtos e custos conforme os comentários no arquivo.",
      className: "bg-card border border-border/40 dark:bg-muted dark:text-foreground dark:border-border/40",
      duration: 3000
    });
  }, [toast]);

  const handleProcessarImportacaoUnificada = async () => {
    if (!importFile) {
      toast({ title: "Nenhum arquivo selecionado.", variant: "destructive" });
      return;
    }
    setIsProcessingImport(true);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: importFile });
      
      const produtosSchema = {
        type: "object",
        properties: {
          data: {
            type: "array",
            items: {
              type: "object",
              properties: {
                "codigo_interno": { type: "string" },
                "codigo_barras": { type: "string" },
                "campo_hierarquico_1": { type: "string" },
                "campo_hierarquico_2": { type: "string" },
                "campo_hierarquico_3": { type: "string" },
                "campo_hierarquico_4": { type: "string" },
                "campo_hierarquico_5": { type: "string" },
                "nome": { type: "string" },
                "tipo": { type: "string" },
                "categoria": { type: "string" },
                "marca": { type: "string" },
                "tags": { type: "string" },
                "imagem_url": { type: "string" },
                "valor_compra": { type: "number" },
                "frete_percentual": { type: "number" },
                "imposto_1_percentual": { type: "number" },
                "imposto_2_percentual": { type: "number" },
                "desconto_comercial_percentual": { type: "number" },
                "outros_custos_percentual": { type: "number" },
                "fornecedor_codigo": { type: "string" },
                "preco_venda_padrao": { type: "number" },
                "dimensoes_cm": { type: "string" },
                "peso_kg": { type: "number" },
                "tempo_reposicao_dias": { type: "number" },
                "estoque_atual": { type: "number" },
                "estoque_minimo": { type: "number" },
                "estoque_ideal": { type: "number" },
                "estoque_maximo": { type: "number" },
                "estoque_avariado": { type: "number" },
                "unidade_principal": { type: "string" },
                "unidades_por_pacote": { type: "number" },
                "controla_serial": { type: "boolean" },
                "controla_lote_validade": { type: "boolean" },
                "ativo": { type: "boolean" }
              },
              required: ["nome"],
              additionalProperties: true
            }
          }
        }
      };
      
      const extraction = await base44.integrations.Core.ExtractDataFromUploadedFile({ 
        file_url, 
        json_schema: produtosSchema 
      });

      if (extraction.status !== 'success' || !extraction.output || !extraction.output.data) {
        throw new Error(extraction.details || "Falha ao extrair dados.");
      }

      const importedData = extraction.output.data;
      const resumo = { novos: 0, atualizados: 0, erros: [] };
      const produtosValidados = [];

      for (const linha of importedData) {
        const errosLinha = [];
        
        if (!linha.nome) {
          errosLinha.push("Nome é obrigatório");
        }

        if (errosLinha.length > 0) {
          resumo.erros.push(`Produto '${linha.nome || 'Sem nome'}': ${errosLinha.join(', ')}`);
          continue;
        }

        // Verificar se produto já existe (por código de barras)
        let produtoExistente = null;
        if (linha.codigo_barras) {
          produtoExistente = produtos.find(p => p.codigo_barras === String(linha.codigo_barras));
        }
        const isUpdate = !!produtoExistente;

        // Buscar fornecedor pelo código
        let fornecedor_id = '';
        let fornecedor_codigo = '';
        if (linha.fornecedor_codigo) {
          const forn = fornecedores.find(f => f.codigo_interno === String(linha.fornecedor_codigo)); // Ensure string comparison
          if (forn) {
            fornecedor_id = forn.id;
            fornecedor_codigo = forn.codigo_interno;
          }
        }

        // Parse numerical values, handling potential comma decimals
        const parseNumber = (val) => {
          if (typeof val === 'string') {
            return parseFloat(val.replace(',', '.'));
          }
          return parseFloat(val);
        };

        const valorCompra = parseNumber(linha.valor_compra) || 0;
        const fretePercentual = parseNumber(linha.frete_percentual) || 0;
        const imposto1Percentual = parseNumber(linha.imposto_1_percentual) || 0;
        const imposto2Percentual = parseNumber(linha.imposto_2_percentual) || 0;
        const descontoComercialPercentual = parseNumber(linha.desconto_comercial_percentual) || 0;
        const outrosCustosPercentual = parseNumber(linha.outros_custos_percentual) || 0;

        const frete = roundToTwoDecimals(valorCompra * (fretePercentual / 100));
        const imposto1 = roundToTwoDecimals(valorCompra * (imposto1Percentual / 100));
        const imposto2 = roundToTwoDecimals(valorCompra * (imposto2Percentual / 100));
        const desconto = roundToTwoDecimals(valorCompra * (descontoComercialPercentual / 100));
        const outros = roundToTwoDecimals(valorCompra * (outrosCustosPercentual / 100));
        
        // Summing up costs based on the outline's logic
        const custoTotal = roundToTwoDecimals(valorCompra + frete + imposto1 + imposto2 + outros - desconto);

        // Calculate preço de venda e markup automaticamente
        const precoVenda = parseNumber(linha.preco_venda_padrao) || 0;
        
        // Calcular markup percentual baseado no custo e preço de venda
        let markupPercentual = 0;
        if (custoTotal > 0 && precoVenda > custoTotal) {
          markupPercentual = ((precoVenda - custoTotal) / custoTotal) * 100;
        }

        // Process 'tipo' field (Produto/Serviço or 0/1)
        let tipoProduto = 'Produto'; // Default
        if (linha.tipo && (String(linha.tipo).toLowerCase() === 'serviço' || String(linha.tipo) === '1')) {
          tipoProduto = 'Serviço';
        } else if (linha.tipo && (String(linha.tipo).toLowerCase() === 'produto' || String(linha.tipo) === '0')) {
          tipoProduto = 'Produto';
        }

        // Process 'tags' field
        let tagsArray = [];
        if (linha.tags && typeof linha.tags === 'string') {
          tagsArray = linha.tags.split(',').map(t => t.trim()).filter(t => t);
        }

        // Calculate volume_cm3 if dimensions are provided
        let volume_cm3 = 0;
        if (linha.dimensoes_cm) {
            const parts = String(linha.dimensoes_cm).split('x').map(p => parseFloat(p.trim()));
            if (parts.length === 3 && parts.every(p => !isNaN(p) && p > 0)) {
                volume_cm3 = parts[0] * parts[1] * parts[2];
            }
        }
        
        // Gerar nome automaticamente se vazio, concatenando campos hierárquicos
        const h1 = (linha.campo_hierarquico_1 || linha.nome || '').toString().toUpperCase().trim();
        const h2 = (linha.campo_hierarquico_2 || '').toString().toUpperCase().trim();
        const h3 = (linha.campo_hierarquico_3 || '').toString().toUpperCase().trim();
        const h4 = (linha.campo_hierarquico_4 || '').toString().toUpperCase().trim();
        const h5 = (linha.campo_hierarquico_5 || '').toString().toUpperCase().trim();
        const nomeGerado = linha.nome?.trim()
          ? linha.nome.toUpperCase()
          : [h1, h2, h3, h4, h5].filter(Boolean).join(' | ');

        const produtoData = {
          id: isUpdate ? produtoExistente.id : undefined,
          campo_hierarquico_1: h1,
          campo_hierarquico_2: h2 || undefined,
          campo_hierarquico_3: h3 || undefined,
          campo_hierarquico_4: h4 || undefined,
          campo_hierarquico_5: h5 || undefined,
          nome: nomeGerado,
          codigo_barras: String(linha.codigo_barras || ''),
          tipo: tipoProduto,
          categoria_nome: linha.categoria ? linha.categoria.toUpperCase() : '',
          marca: linha.marca ? linha.marca.toUpperCase() : '',
          tags: tagsArray,
          imagem_url: linha.imagem_url || '',
          preco_venda_padrao: precoVenda,
          preco_venda_tipo: 'percentual',
          preco_venda_percentual: markupPercentual,
          preco_custo_calculado: custoTotal,
          valor_compra: valorCompra,
          unidade_principal: linha.unidade_principal || 'UN',
          unidades_por_pacote: parseInt(linha.unidades_por_pacote) || 1,
          estoque_atual: parseNumber(linha.estoque_atual) || 0,
          estoque_minimo: parseNumber(linha.estoque_minimo) || 0,
          estoque_ideal: parseNumber(linha.estoque_ideal) || 0,
          estoque_maximo: parseNumber(linha.estoque_maximo) || 0,
          estoque_avariado: parseNumber(linha.estoque_avariado) || 0,
          fornecedor_padrao_id: fornecedor_id || null,
          fornecedor_padrao_codigo: fornecedor_codigo || null,
          tempo_reposicao_dias: parseInt(linha.tempo_reposicao_dias) || 0,
          peso_kg: parseNumber(linha.peso_kg) || 0,
          dimensoes_cm: linha.dimensoes_cm || '',
          volume_cm3: volume_cm3,
          custo_frete_padrao: frete,
          custo_imposto1_padrao: imposto1,
          custo_imposto2_padrao: imposto2,
          desconto_compra_padrao: desconto,
          custo_outros_padrao: outros,
          controla_serial: (linha.controla_serial === true || String(linha.controla_serial).toLowerCase() === 'true'),
          controla_lote_validade: (linha.controla_lote_validade === true || String(linha.controla_lote_validade).toLowerCase() === 'true'),
          ativo: (linha.ativo === true || String(linha.ativo).toLowerCase() === 'true')
        };

        produtosValidados.push(produtoData);
        if (isUpdate) {
          resumo.atualizados++;
        } else {
          resumo.novos++;
        }
      }

      setPreviewData({ produtos: produtosValidados, resumo });
      setIsImportDialogOpen(false);
      setIsPreviewDialogOpen(true);

    } catch (error) {
      console.error("Erro no processamento da importação unificada:", error);
      toast({ 
        title: "Erro no Processamento", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsProcessingImport(false);
    }
  };

  const handleConfirmarImportacaoUnificada = async () => {
    if (!previewData) return;
    setIsProcessingImport(true);

    try {
      const BATCH_SIZE = 20;
      const novos = [];
      const atualizacoes = [];

      // Separar novos de atualizações
      for (const produtoData of previewData.produtos) {
        const { custos, id, ...productData } = produtoData;
        if (id) {
          atualizacoes.push({ id, data: productData });
        } else {
          novos.push(productData);
        }
      }

      // Processar atualizações em lotes
      for (let i = 0; i < atualizacoes.length; i += BATCH_SIZE) {
        const batch = atualizacoes.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(item => base44.entities.Produto.update(item.id, item.data)));
      }

      // Processar criações em lotes
      for (let i = 0; i < novos.length; i += BATCH_SIZE) {
        const batch = novos.slice(i, i + BATCH_SIZE);
        await base44.entities.Produto.bulkCreate(batch);
      }

      toast({
        title: "✓ Importação Concluída!",
        description: `${previewData.resumo.novos} criados, ${previewData.resumo.atualizados} atualizados.`,
        className: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300",
        duration: 5000
      });

      setPreviewData(null);
      setIsPreviewDialogOpen(false);
      setImportFile(null);
      await loadData();

    } catch (error) {
      console.error("Erro na importação final unificada:", error);
      toast({ 
        title: "Erro na Importação", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsProcessingImport(false);
    }
  };


  const handleBaixarTemplateCustos = () => {
    const headers = [
      "id_produto",
      "codigo_interno",
      "codigo_barras",
      "nome_produto",
      "novo_valor_compra"
    ];

    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += headers.join(";") + "\n";

    // Adicionar alguns exemplos
    produtos.slice(0, 5).forEach(p => {
      const row = [
        p.id || '',
        p.codigo_interno || '',
        p.codigo_barras || '',
        p.nome || '',
        formatarNumero(p.preco_custo_calculado || 0)
      ];
      csvContent += row.join(";") + "\n";
    });

    // Linha de exemplo
    csvContent += ";SKU-999;7899999999999;Produto Exemplo;100,50\n";

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `template_atualizacao_custos_${dataHoje()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "✓ Template baixado!",
      description: "Preencha com os novos valores de compra e importe.",
      className: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
      duration: 3000
    });
  };



  const handleProcessarImportacaoCustos = async () => {
    if (!importCustosFile) {
      toast({ title: "Nenhum arquivo selecionado.", variant: "destructive" });
      return;
    }
    setIsProcessingCustos(true);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: importCustosFile });

      const custosSchema = {
        type: "object",
        properties: {
          data: {
            type: "array",
            items: {
              type: "object",
              properties: {
                "id_produto": { type: "string" },
                "codigo_interno": { type: "string" },
                "codigo_barras": { type: "string" },
                "nome_produto": { type: "string" },
                "novo_valor_compra": { type: "number" }
              },
              required: ["novo_valor_compra"],
              // allow additional properties for flexibility but focus on required ones
              additionalProperties: true
            }
          }
        }
      };

      const extraction = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: custosSchema
      });

      if (extraction.status !== 'success' || !extraction.output || !extraction.output.data) {
        throw new Error(extraction.details || "Falha ao extrair dados.");
      }

      const importedData = extraction.output.data;
      const resumo = { atualizacoes: 0, erros: [], naoEncontrados: [] };
      const atualizacoesValidadas = [];

      for (const linha of importedData) {
        const errosLinha = [];
        const parseNumber = (val) => {
          if (typeof val === 'string') {
            return parseFloat(val.replace(',', '.'));
          }
          return parseFloat(val);
        };

        // Validar se tem identificador
        if (!linha.id_produto && !linha.codigo_interno && !linha.codigo_barras) {
          errosLinha.push("Precisa ter id_produto, codigo_interno ou codigo_barras");
        }

        // Validar valor
        const novoValorCompraParsed = parseNumber(linha.novo_valor_compra);
        if (typeof novoValorCompraParsed !== 'number' || isNaN(novoValorCompraParsed) || novoValorCompraParsed <= 0) {
          errosLinha.push("novo_valor_compra deve ser um número maior que zero");
        }

        if (errosLinha.length > 0) {
          const identificadorLinha = linha.nome_produto || linha.codigo_interno || linha.codigo_barras || JSON.stringify(linha);
          resumo.erros.push(`Produto '${identificadorLinha}': ${errosLinha.join(', ')}`);
          continue;
        }

        // Encontrar produto
        let produto = null;
        if (linha.id_produto) {
          produto = produtos.find(p => p.id === linha.id_produto);
        }
        if (!produto && linha.codigo_interno) {
          produto = produtos.find(p => p.codigo_interno === String(linha.codigo_interno));
        }
        if (!produto && linha.codigo_barras) {
          produto = produtos.find(p => p.codigo_barras === String(linha.codigo_barras));
        }

        if (!produto) {
          resumo.naoEncontrados.push(
            linha.nome_produto || String(linha.codigo_interno) || String(linha.codigo_barras) || 'Desconhecido'
          );
          continue;
        }

        const custoAnterior = produto.preco_custo_calculado || 0;
        
        // Recalcular custo total com o novo valor de compra
        const frete = roundToTwoDecimals(novoValorCompraParsed * ((produto.custo_frete_padrao || 0) / 100));
        const imposto1 = roundToTwoDecimals(novoValorCompraParsed * ((produto.custo_imposto1_padrao || 0) / 100));
        const imposto2 = roundToTwoDecimals(novoValorCompraParsed * ((produto.custo_imposto2_padrao || 0) / 100));
        const desconto = roundToTwoDecimals(novoValorCompraParsed * ((produto.desconto_compra_padrao || 0) / 100));
        const outros = roundToTwoDecimals(novoValorCompraParsed * ((produto.custo_outros_padrao || 0) / 100));
        const novoCustoTotal = roundToTwoDecimals(novoValorCompraParsed + frete + imposto1 + imposto2 + outros - desconto);
        
        // Recalcular preço de venda se for tipo percentual
        let novoPrecoVenda = produto.preco_venda_padrao || 0;
        if (produto.preco_venda_tipo === 'percentual') {
          novoPrecoVenda = novoCustoTotal * (1 + (parseFloat(produto.preco_venda_percentual) || 0) / 100);
        }

        const variacaoCusto = custoAnterior > 0 ?
          ((novoCustoTotal - custoAnterior) / custoAnterior) * 100 :
          (novoCustoTotal > 0 ? 100 : 0);

        atualizacoesValidadas.push({
          produto_id: produto.id,
          nome: produto.nome,
          codigo_interno: produto.codigo_interno,
          valor_compra_anterior: custoAnterior,
          novo_valor_compra: novoValorCompraParsed,
          novo_custo_total: novoCustoTotal,
          novo_preco_venda: novoPrecoVenda,
          variacao_custo: variacaoCusto,
          produto_completo: produto
        });

        resumo.atualizacoes++;
      }

      setPreviewCustosData({ atualizacoes: atualizacoesValidadas, resumo });
      setIsImportCustosDialogOpen(false);
      setIsPreviewCustosDialogOpen(true);

    } catch (error) {
      console.error("Erro no processamento da importação:", error);
      toast({
        title: "Erro no Processamento",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessingCustos(false);
    }
  };

  const handleConfirmarImportacaoCustos = async () => {
    if (!previewCustosData) return;
    setIsProcessingCustos(true);

    try {
      for (const atualizacao of previewCustosData.atualizacoes) {
        const produto = atualizacao.produto_completo;
        
        // Recalcular custos percentuais baseados no novo valor de compra
        const frete = roundToTwoDecimals(atualizacao.novo_valor_compra * ((produto.custo_frete_padrao || 0) / 100));
        const imposto1 = roundToTwoDecimals(atualizacao.novo_valor_compra * ((produto.custo_imposto1_padrao || 0) / 100));
        const imposto2 = roundToTwoDecimals(atualizacao.novo_valor_compra * ((produto.custo_imposto2_padrao || 0) / 100));
        const desconto = roundToTwoDecimals(atualizacao.novo_valor_compra * ((produto.desconto_compra_padrao || 0) / 100));
        const outros = roundToTwoDecimals(atualizacao.novo_valor_compra * ((produto.custo_outros_padrao || 0) / 100));

        await base44.entities.Produto.update(atualizacao.produto_id, {
          valor_compra: atualizacao.novo_valor_compra,
          preco_custo_calculado: atualizacao.novo_custo_total,
          preco_venda_padrao: atualizacao.novo_preco_venda
        });
      }

      toast({
        title: "✓ Custos Atualizados!",
        description: `${previewCustosData.atualizacoes.length} produtos atualizados com sucesso.`,
        className: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300",
        duration: 5000
      });

      setPreviewCustosData(null);
      setIsPreviewCustosDialogOpen(false);
      setImportCustosFile(null);
      await loadData();

    } catch (error) {
      console.error("Erro na importação final de custos:", error);
      toast({
        title: "Erro na Importação",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessingCustos(false);
    }
  };

  const estoqueVirtualAtivo = filters.estoqueVirtual === true;

  const { data: pendentePorProduto = {} } = useQuery({
    queryKey: ['catalogo', 'pendente-estoque'],
    enabled: estoqueVirtualAtivo,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const data = await fetchPedidosCompraParaSugestaoEstoque(base44);
      return buildPendenteAprovadoFinanceiroPorProduto(
        data.pedidosAbertos,
        data.recebidosPorPedidoProduto,
        { embarques: data.embarques, pedidosParaEmbarque: data.pedidosTodos },
      );
    },
  });

  const catalogStockContext = useMemo(
    () => createCatalogStockContext(estoqueVirtualAtivo, pendentePorProduto),
    [estoqueVirtualAtivo, pendentePorProduto],
  );

  const needsSalesVelocity = useMemo(() => {
    const velocityColumns = ['media_30d', 'ponto_esperado_lt', 'ponto_futuro'];
    if (visibleColumns.some((col) => velocityColumns.includes(col))) return true;
    return filtersNeedSalesVelocity(filters);
  }, [visibleColumns, filters]);

  const { data: pedidosVenda90d = [] } = usePedidosVenda90dQuery({
    enabled: needsSalesVelocity,
  });

  const salesVelocityMap = useMemo(() => {
    if (!needsSalesVelocity) return {};
    return buildCatalogSalesVelocityMap(produtos, pedidosVenda90d);
  }, [needsSalesVelocity, produtos, pedidosVenda90d]);

  const filteredProdutosBase = useMemo(
    () => filterProdutos(produtos, filters, { salesVelocityMap, catalogStockContext }),
    [produtos, filters, salesVelocityMap, catalogStockContext],
  );

  const filteredProdutos = useMemo(
    () => [...filteredProdutosBase].sort((a, b) => compareProdutosForCatalogSort(a, b, sortOrder)),
    [filteredProdutosBase, sortOrder],
  );

  const hasFilteredProdutos = filteredProdutos.length > 0;

  const fornecedorMap = useMemo(() => {
    return fornecedores.reduce((acc, f) => {
      acc[f.id] = f.nome;
      return acc;
    }, {});
  }, [fornecedores]);

  const unidadesVitrine = useMemo(() => collectCatalogVitrineUnits(produtos), [produtos]);

  const activeFilterCount = countActiveProdutoFilters(filters);
  const filteredStats = useMemo(
    () => calculateProdutoStats(filteredProdutos, catalogStockContext),
    [filteredProdutos, catalogStockContext],
  );
  const headerStats = useMemo(() => {
    if (podeVerCusto) return filteredStats;
    return { ...filteredStats, valorEstoque: 0, valorEstoqueAtivo: 0 };
  }, [filteredStats, podeVerCusto]);

  const handleGroupTreeByCategoryChange = useCallback((value) => {
    setGroupTreeByCategory(value);
    try {
      localStorage.setItem(CATALOG_GROUP_BY_CATEGORY_KEY, value ? '1' : '0');
    } catch {
      // ignore quota / private mode
    }
  }, []);

  const handleGerarRelatorioEstoque = useCallback(async () => {
    setGerandoRelatorioEstoque(true);
    toast({ title: 'Gerando relatório de estoque...' });
    try {
      const filtersSummary = describeProdutoFilters(filters, { categorias, fornecedores });
      const totals = sumCatalogStockTotals(filteredProdutos, catalogStockContext);
      const hasCategorizedProducts = filteredProdutos.some(
        (p) => String(p?.categoria_nome || '').trim()
      );
      const groupPdfByCategory = groupTreeByCategory || hasCategorizedProducts;

      const { gerarRelatorioCatalogoEstoque } = await import('@/functions/gerarRelatorioCatalogoEstoque');
      const resposta = await gerarRelatorioCatalogoEstoque({
        produtos: filteredProdutos,
        filters_summary: filtersSummary,
        totals,
        layout_mode: viewMode === 'plana' ? 'plana' : 'tree',
        tree_level: treeLevel,
        sort_order: sortOrder,
        group_by_category: groupPdfByCategory,
      });

      const blob = new Blob([resposta.data], { type: 'application/pdf' });
      downloadBlob(blob, `RelatorioEstoque_${dataHoje()}.pdf`);

      toast({ title: 'Relatório de estoque gerado' });
    } catch (error) {
      const msg = error?.message || String(error);
      toast({
        title: 'Erro ao gerar relatório de estoque',
        description: msg.length > 300 ? `${msg.slice(0, 300)}…` : msg,
        variant: 'destructive',
      });
      console.error(error);
    } finally {
      setGerandoRelatorioEstoque(false);
    }
  }, [filteredProdutos, filters, categorias, fornecedores, viewMode, treeLevel, sortOrder, groupTreeByCategory, catalogStockContext, toast]);

  const handleCatalogExpandedKeysChange = useCallback((keys) => {
    catalogExpandedKeysRef.current = keys instanceof Set ? keys : new Set(keys || []);
  }, []);

  const handleGerarRelatorioVendas = useCallback(async (salesWindow = '60d') => {
    const windowKey = normalizeCatalogSalesWindow(salesWindow);
    setGerandoRelatorioVendas(true);
    toast({
      title: 'Gerando relatório de vendas...',
      description: CATALOG_SALES_WINDOW_LABELS[windowKey],
    });
    try {
      const catalogFilters = describeProdutoFilters(filters, { categorias, fornecedores });
      const filtersSummary = [catalogFilters, CATALOG_SALES_WINDOW_LABELS[windowKey]]
        .filter(Boolean)
        .join(' · ');
      const hasCategorizedProducts = filteredProdutos.some(
        (p) => String(p?.categoria_nome || '').trim()
      );
      const groupPdfByCategory = groupTreeByCategory || hasCategorizedProducts;

      let pedidos = queryClient.getQueryData(p38Keys.pedidosVenda90d());
      if (!Array.isArray(pedidos)) {
        toast({ title: 'Buscando vendas dos últimos 90 dias...' });
        const { fetchPedidosVenda90d } = await import('@/lib/fetchPedidosVenda90d');
        pedidos = await fetchPedidosVenda90d();
        queryClient.setQueryData(p38Keys.pedidosVenda90d(), pedidos);
      }

      toast({ title: 'Montando PDF de vendas...' });
      const { generateRelatorioCatalogoVendasPdf } = await import(
        '@/lib/relatorioCatalogoVendasPdf/generateRelatorioCatalogoVendasPdf.js'
      );
      const resposta = await generateRelatorioCatalogoVendasPdf({
        produtos: filteredProdutos,
        pedidos,
        filters_summary: filtersSummary,
        layout_mode: viewMode === 'plana' ? 'plana' : 'tree',
        tree_level: treeLevel,
        sort_order: sortOrder,
        group_by_category: groupPdfByCategory,
        expanded_keys: [...catalogExpandedKeysRef.current],
        sales_window: windowKey,
      });

      const blob = new Blob([resposta.data], { type: 'application/pdf' });
      downloadBlob(blob, `RelatorioVendas_${windowKey}_${dataHoje()}.pdf`);

      toast({
        title: 'Relatório de vendas gerado',
        description: resposta?.version ? `Layout ${resposta.version}` : undefined,
      });
    } catch (error) {
      const msg = error?.message || String(error);
      toast({
        title: 'Erro ao gerar relatório de vendas',
        description: msg.length > 300 ? `${msg.slice(0, 300)}…` : msg,
        variant: 'destructive',
      });
      console.error(error);
    } finally {
      setGerandoRelatorioVendas(false);
    }
  }, [filteredProdutos, filters, categorias, fornecedores, viewMode, treeLevel, sortOrder, groupTreeByCategory, queryClient, toast]);

  const handleGerarRelatorioVendasV2 = useCallback(async () => {
    setGerandoRelatorioVendasV2(true);
    toast({
      title: 'Gerando relatório de vendas v2 (beta)...',
      description: '30 e 60 dias no mesmo PDF, com preço e MKUP',
    });
    try {
      const filtersSummary = describeProdutoFilters(filters, { categorias, fornecedores });
      const hasCategorizedProducts = filteredProdutos.some(
        (p) => String(p?.categoria_nome || '').trim(),
      );
      const groupPdfByCategory = groupTreeByCategory || hasCategorizedProducts;

      let pedidos = queryClient.getQueryData(p38Keys.pedidosVenda90d());
      if (!Array.isArray(pedidos)) {
        toast({ title: 'Buscando vendas dos últimos 90 dias...' });
        const { fetchPedidosVenda90d } = await import('@/lib/fetchPedidosVenda90d');
        pedidos = await fetchPedidosVenda90d();
        queryClient.setQueryData(p38Keys.pedidosVenda90d(), pedidos);
      }

      let pendenteMap = pendentePorProduto;
      if (estoqueVirtualAtivo) {
        const cachedPendente = queryClient.getQueryData(['catalogo', 'pendente-estoque']);
        if (cachedPendente && typeof cachedPendente === 'object') {
          pendenteMap = cachedPendente;
        } else if (!pendenteMap || Object.keys(pendenteMap).length === 0) {
          toast({ title: 'Buscando pedidos em trânsito...' });
          const data = await fetchPedidosCompraParaSugestaoEstoque(base44);
          pendenteMap = buildPendenteAprovadoFinanceiroPorProduto(
            data.pedidosAbertos,
            data.recebidosPorPedidoProduto,
            { embarques: data.embarques, pedidosParaEmbarque: data.pedidosTodos },
          );
          queryClient.setQueryData(['catalogo', 'pendente-estoque'], pendenteMap);
        }
      }

      toast({ title: 'Montando PDF de vendas v2...' });
      const { generateRelatorioCatalogoVendasPdfV2 } = await import(
        '@/lib/relatorioCatalogoVendasPdf/generateRelatorioCatalogoVendasPdfV2.js'
      );
      const resposta = await generateRelatorioCatalogoVendasPdfV2({
        produtos: filteredProdutos,
        pedidos,
        filters_summary: filtersSummary,
        layout_mode: viewMode === 'plana' ? 'plana' : 'tree',
        tree_level: treeLevel,
        sort_order: sortOrder,
        group_by_category: groupPdfByCategory,
        expanded_keys: [...catalogExpandedKeysRef.current],
        estoque_virtual: estoqueVirtualAtivo,
        pendente_por_produto: pendenteMap || {},
      });

      const blob = new Blob([resposta.data], { type: 'application/pdf' });
      downloadBlob(blob, `RelatorioVendas_v2_${dataHoje()}.pdf`);

      toast({
        title: 'Relatório de vendas v2 gerado',
        description: resposta?.version ? `Layout ${resposta.version}` : undefined,
      });
    } catch (error) {
      const msg = error?.message || String(error);
      toast({
        title: 'Erro ao gerar relatório de vendas v2',
        description: msg.length > 300 ? `${msg.slice(0, 300)}…` : msg,
        variant: 'destructive',
      });
      console.error(error);
    } finally {
      setGerandoRelatorioVendasV2(false);
    }
  }, [filteredProdutos, filters, categorias, fornecedores, viewMode, treeLevel, sortOrder, groupTreeByCategory, queryClient, toast, estoqueVirtualAtivo, pendentePorProduto]);

  const handleGerarRelatorioIep = useCallback(async () => {
    setGerandoRelatorioIep(true);
    toast({ title: 'Gerando planilha Curva ABC / IEP...' });
    try {
      const filtersSummary = describeProdutoFilters(filters, { categorias, fornecedores });

      let pedidos = queryClient.getQueryData(p38Keys.pedidosVenda90d());
      if (!Array.isArray(pedidos)) {
        toast({ title: 'Buscando vendas dos últimos 90 dias...' });
        const { fetchPedidosVenda90d } = await import('@/lib/fetchPedidosVenda90d');
        pedidos = await fetchPedidosVenda90d();
        queryClient.setQueryData(p38Keys.pedidosVenda90d(), pedidos);
      }

      toast({ title: 'Montando XLSX Curva ABC / IEP...' });
      const { generateRelatorioCatalogoIepXlsx } = await import(
        '@/lib/relatorioCatalogoIepXlsx/generateRelatorioCatalogoIepXlsx.js'
      );
      const resposta = await generateRelatorioCatalogoIepXlsx({
        produtos: filteredProdutos,
        pedidos,
        filters_summary: filtersSummary,
        sort_order: 'iep_score_desc',
      });

      const blob = new Blob([resposta.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadBlob(blob, `RelatorioCurvaABC_IEP_${dataHoje()}.xlsx`);

      toast({
        title: 'Planilha Curva ABC / IEP gerada',
        description: resposta?.version ? `Layout ${resposta.version}` : undefined,
      });
    } catch (error) {
      const msg = error?.message || String(error);
      toast({
        title: 'Erro ao gerar relatório Curva ABC / IEP',
        description: msg.length > 300 ? `${msg.slice(0, 300)}…` : msg,
        variant: 'destructive',
      });
      console.error(error);
    } finally {
      setGerandoRelatorioIep(false);
    }
  }, [filteredProdutos, filters, categorias, fornecedores, queryClient, toast]);

  const catalogTagFiltersSummary = useMemo(
    () => describeProdutoFilters(filters, { categorias, fornecedores }),
    [filters, categorias, fornecedores],
  );

  useEffect(() => {
    if (relatorioEstoqueAutoRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('relatorioEstoque') !== '1') return;
    if (!produtos.length) return;

    relatorioEstoqueAutoRef.current = true;
    params.delete('relatorioEstoque');
    const nextUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, '', nextUrl);
    handleGerarRelatorioEstoque();
  }, [produtos.length, handleGerarRelatorioEstoque]);

  useEffect(() => {
    if (relatorioVendasAutoRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const relatorioVendasParam = params.get('relatorioVendas');
    const salesWindow =
      relatorioVendasParam === '30d'
        ? '30d'
        : relatorioVendasParam === '1' || relatorioVendasParam === '60d'
          ? '60d'
          : null;
    if (!salesWindow) return;
    if (!produtos.length) return;

    relatorioVendasAutoRef.current = true;
    params.delete('relatorioVendas');
    const nextUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, '', nextUrl);
    handleGerarRelatorioVendas(salesWindow);
  }, [produtos.length, handleGerarRelatorioVendas]);

  const handleOpenCatalogTagPrint = useCallback(() => setIsCatalogTagPrintOpen(true), []);
  const handleOpenMassTag = useCallback(() => setIsMassTagOpen(true), []);
  const handleOpenMassCategory = useCallback(() => setIsMassCategoryOpen(true), []);
  const handleOpenMassPrecificacao = useCallback(() => setIsMassPrecificacaoOpen(true), []);
  const handleOpenPontosPedido = useCallback(() => setIsPontosPedidoOpen(true), []);

  const produtosHeaderProps = useMemo(() => ({
    stats: headerStats,
    podeVerCusto,
    filters,
    categorias,
    fornecedores,
    unidadesVitrine,
    activeFilterCount,
    isSummaryFiltered: activeFilterCount > 0 || filteredStats.total !== stats.total,
    isFilterOpen,
    setIsFilterOpen,
    handleFilterChange,
    handleExportarCatalogo,
    handleBaixarTemplateUnificado,
    setIsMassImageUploaderOpen,
    handleAddNew,
    setFilters,
    formatarNumero,
    hasFilteredProdutos,
    loadData,
    treeLevel,
    setTreeLevel,
    sortOrder,
    setSortOrder,
    setIsColumnSelectorOpen,
    onGerarRelatorioEstoque: handleGerarRelatorioEstoque,
    gerandoRelatorioEstoque,
    onGerarRelatorioVendas: handleGerarRelatorioVendas,
    gerandoRelatorioVendas,
    onGerarRelatorioVendasV2: handleGerarRelatorioVendasV2,
    gerandoRelatorioVendasV2,
    onGerarRelatorioIep: handleGerarRelatorioIep,
    gerandoRelatorioIep,
    onOpenCatalogTagPrint: handleOpenCatalogTagPrint,
    onOpenMassTag: handleOpenMassTag,
    onOpenMassCategory: handleOpenMassCategory,
    onOpenMassPrecificacao: handleOpenMassPrecificacao,
    onOpenPontosPedido: handleOpenPontosPedido,
    groupTreeByCategory,
    onGroupTreeByCategoryChange: handleGroupTreeByCategoryChange,
    onClearFilters: handleClearCatalogFilters,
  }), [
    podeVerCusto,
    headerStats,
    filters,
    categorias,
    fornecedores,
    unidadesVitrine,
    activeFilterCount,
    filteredStats.total,
    stats.total,
    isFilterOpen,
    handleFilterChange,
    handleExportarCatalogo,
    handleBaixarTemplateUnificado,
    handleAddNew,
    formatarNumero,
    hasFilteredProdutos,
    loadData,
    treeLevel,
    sortOrder,
    handleGerarRelatorioEstoque,
    gerandoRelatorioEstoque,
    handleGerarRelatorioVendas,
    gerandoRelatorioVendas,
    handleGerarRelatorioVendasV2,
    gerandoRelatorioVendasV2,
    handleGerarRelatorioIep,
    gerandoRelatorioIep,
    handleOpenCatalogTagPrint,
    handleOpenMassTag,
    handleOpenMassCategory,
    handleOpenMassPrecificacao,
    handleOpenPontosPedido,
    groupTreeByCategory,
    handleGroupTreeByCategoryChange,
    handleClearCatalogFilters,
  ]);

  const mobileCatalogChrome = useMemo(
    () => <ProdutosHeader key="catalog-mobile" {...produtosHeaderProps} />,
    [produtosHeaderProps],
  );

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden w-full max-w-full bg-background">
      {isDesktop && (
        <div className="flex-none">
          <ProdutosHeader key="catalog-desktop" {...produtosHeaderProps} />
        </div>
      )}

      <div className="flex flex-1 min-h-0 h-0 flex-col overflow-hidden w-full min-w-0">
        {isDesktop && (
          <div>
            <ProdutosCommandBar
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              viewMode={viewMode}
              setViewMode={setViewMode}
              groupTreeByCategory={groupTreeByCategory}
              onGroupTreeByCategoryChange={handleGroupTreeByCategoryChange}
            />
          </div>
        )}

        {!isDesktop && (
          <div className="relative flex-1 min-h-0 h-0 w-full overflow-hidden">
            <CatalogoMobileScrollShell catalogChrome={mobileCatalogChrome}>
              <MobileHierarquica produtos={filteredProdutos} onEdit={handleEdit} flatList groupByCategory={false} masterLevel={treeLevel} sortOrder={sortOrder} onExpandedKeysChange={handleCatalogExpandedKeysChange} catalogFilters={filters} salesVelocityMap={salesVelocityMap} catalogStockContext={catalogStockContext} />
            </CatalogoMobileScrollShell>
          </div>
        )}

        {isDesktop && viewMode === 'dinamica' && (
          <div className="flex flex-col w-full h-full min-h-0">
            <TreeGrid produtos={filteredProdutos} onEdit={handleEdit} onDelete={setProdutoParaExcluir} visibleColumns={visibleColumnsEffective} masterLevel={treeLevel} sortOrder={sortOrder} groupByCategory={groupTreeByCategory} onExpandedKeysChange={handleCatalogExpandedKeysChange} salesVelocityMap={salesVelocityMap} catalogStockContext={catalogStockContext} catalogFilters={filters} />
          </div>
        )}

        {isDesktop && viewMode === 'plana' && (
          <ProdutosPlanaTable
            filteredProdutos={filteredProdutos}
            visibleColumns={visibleColumnsEffective}
            handleEdit={handleEdit}
            setProdutoParaExcluir={setProdutoParaExcluir}
            formatarNumero={formatarNumero}
            fornecedorMap={fornecedorMap}
            handleCreateSimilar={handleCreateSimilar}
            salesVelocityMap={salesVelocityMap}
            catalogStockContext={catalogStockContext}
          />
        )}
      </div>

      {/* Tela completa para o formulário */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[70] bg-background dark:bg-[#1f1d22]">
          <Suspense fallback={
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              A carregar formulário…
            </div>
          }>
            <ProdutoFormCompleto
              produto={selectedProduto}
              produtoSimilarBase={produtoSimilarBase}
              onSave={handleSave}
              onClose={() => { setIsFormOpen(false); setProdutoSimilarBase(null); }}
            />
          </Suspense>
        </div>
      )}

      {/* Dialog de Upload Unificado (Produtos + Custos) */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-md dark:bg-background dark:text-foreground dark:border-border/40">
          <DialogHeader>
            <DialogTitle className="text-base font-medium text-foreground">Importar Produtos e Custos</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div>
              <Label htmlFor="importFile" className="text-sm mb-2 block dark:text-foreground">
                Arquivo CSV (.csv, .xlsx)
              </Label>
              <Input 
                id="importFile"
                type="file" 
                accept=".csv,.xlsx,.xls" 
                onChange={(e) => setImportFile(e.target.files[0])} 
                className="border-border/40 dark:border-border/40 dark:bg-muted dark:text-foreground text-sm"
              />
              {importFile && (
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-foreground/90 dark:text-muted-foreground" />
                  {importFile.name}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsImportDialogOpen(false);
                setImportFile(null);
              }}
              className="text-sm dark:bg-muted dark:text-foreground dark:border-border/40 dark:hover:bg-primary/90"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleProcessarImportacaoUnificada} 
              disabled={isProcessingImport || !importFile}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-white text-sm dark:bg-muted dark:hover:bg-muted/400"
            >
              {isProcessingImport && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Processar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Preview de Importação Unificada */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto dark:bg-background dark:text-foreground dark:border-border/40">
          <DialogHeader>
            <DialogTitle className="text-base font-medium text-foreground">Confirmar Importação de Produtos e Custos</DialogTitle>
          </DialogHeader>
          
          {previewData && (
            <div className="space-y-4 py-4">
              {/* Resumo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="text-center p-3 border border-border/40 rounded-lg dark:border-border/40 dark:bg-muted">
                  <div className="text-xl font-semibold text-green-700 dark:text-green-400">
                    {previewData.resumo.novos}
                  </div>
                  <div className="text-xs text-muted-foreground">Novos</div>
                </div>
                <div className="text-center p-3 border border-border/40 rounded-lg dark:border-border/40 dark:bg-muted">
                  <div className="text-xl font-semibold text-blue-700 dark:text-blue-400">
                    {previewData.resumo.atualizados}
                  </div>
                  <div className="text-xs text-muted-foreground">Atualizações</div>
                </div>
                {previewData.resumo.erros.length > 0 && (
                  <div className="text-center p-3 border border-border/40 rounded-lg bg-red-50 dark:bg-red-900/20 dark:border-red-900">
                    <div className="text-xl font-semibold text-red-700 dark:text-red-300">
                      {previewData.resumo.erros.length}
                    </div>
                    <div className="text-xs text-red-600 dark:text-red-300">Erros</div>
                  </div>
                )}
              </div>

              {/* Erros */}
              {previewData.resumo.erros.length > 0 && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200 dark:bg-red-900/20 dark:border-red-900">
                  <div className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">❌ Erros:</div>
                  <ul className="text-xs text-red-600 dark:text-red-300 list-disc ml-4 max-h-24 overflow-y-auto">
                    {previewData.resumo.erros.map((erro, i) => <li key={i}>{erro}</li>)}
                  </ul>
                </div>
              )}

              {/* Preview dos Produtos */}
              {previewData.produtos.length > 0 && (
                <div className="border rounded-lg dark:border-border/40 min-w-0">
                  <div className="max-h-96 overflow-auto">
                    <Table>
                      <TableHeader className="bg-muted/40 sticky top-0 dark:bg-muted">
                        <TableRow>
                          <TableHead className="dark:text-muted-foreground text-xs">Nome</TableHead>
                          <TableHead className="text-right dark:text-muted-foreground text-xs">Custo Calculado</TableHead>
                          <TableHead className="text-right dark:text-muted-foreground text-xs">Preço de venda</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.produtos.map((produto, index) => (
                          <TableRow key={index} className="hover:bg-muted/40 dark:hover:bg-muted/50">
                            <TableCell className="font-medium text-xs dark:text-foreground">{produto.nome}</TableCell>
                            <TableCell className="text-right text-xs dark:text-foreground">R$ {formatarNumero(produto.preco_custo_calculado)}</TableCell>
                            <TableCell className="text-right font-medium text-xs dark:text-foreground">R$ {formatarNumero(produto.preco_venda_padrao)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 dark:bg-blue-900/20 dark:border-blue-900 dark:text-blue-300">
                <strong>ℹ️ Atenção:</strong> Esta operação irá:
                <ul className="list-disc ml-4 mt-1">
                  <li>Criar novos produtos (sem código de barras cadastrado)</li>
                  <li>Atualizar produtos existentes (com código de barras já cadastrado)</li>
                  <li>Atualizar estoque atual dos produtos conforme informado</li>
                  <li>Recalcular preços de custo automaticamente baseado nos percentuais</li>
                  <li>Calcular markup percentual automaticamente baseado no preço de venda informado</li>
                </ul>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsPreviewDialogOpen(false);
                setPreviewData(null);
              }}
              className="text-sm dark:bg-muted dark:text-foreground dark:border-border/40 dark:hover:bg-primary/90"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmarImportacaoUnificada} 
              disabled={
                isProcessingImport || 
                !previewData || 
                previewData.produtos.length === 0
              }
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-white text-sm dark:bg-muted dark:hover:bg-muted/400"
            >
              {isProcessingImport && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Importação ({previewData?.produtos.length || 0})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Dialog de Upload de Custos (Existing) */}
      <Dialog open={isImportCustosDialogOpen} onOpenChange={setIsImportCustosDialogOpen}>
        <DialogContent className="sm:max-w-md dark:bg-background dark:text-foreground dark:border-border/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-medium text-foreground">
              <RefreshCw className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              Importar Atualização de Custos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 dark:bg-blue-900/20 dark:border-blue-900 dark:text-blue-300">
              <p className="font-semibold mb-1">💡 Como funciona:</p>
              <ul className="text-xs list-disc ml-4 space-y-1">
                <li>Baixe o template com seus produtos atuais</li>
                <li>Atualize a coluna <strong>novo_valor_compra</strong></li>
                <li>Importe de volta e confirme as alterações</li>
                <li>O sistema recalculará automaticamente custos totais e preços de venda</li>
              </ul>
            </div>

            <div>
              <Label htmlFor="importCustosFile" className="text-sm font-semibold mb-2 block dark:text-foreground">
                Arquivo CSV (.csv, .xlsx)
              </Label>
              <Input
                id="importCustosFile"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setImportCustosFile(e.target.files[0])}
                className="dark:border-border/40 dark:bg-muted dark:text-foreground text-sm"
              />
              {importCustosFile && (
                <div className="flex items-center gap-2 mt-2 text-sm text-green-600 dark:text-green-300">
                  <CheckCircle className="w-4 h-4" />
                  {importCustosFile.name}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsImportCustosDialogOpen(false);
                setImportCustosFile(null);
              }}
              className="text-sm dark:bg-muted dark:text-foreground dark:border-border/40 dark:hover:bg-primary/90"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleProcessarImportacaoCustos}
              disabled={isProcessingCustos || !importCustosFile}
              className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-600 text-sm"
            >
              {isProcessingCustos && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Processar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Column Selector */}
      {isColumnSelectorOpen && (
        <Suspense fallback={null}>
          <ColumnSelector
            visibleColumns={visibleColumns}
            onColumnsChange={(columns) => {
              setVisibleColumns(columns);
              saveCatalogProdutoColumns(columns);
            }}
            open={isColumnSelectorOpen}
            onClose={() => setIsColumnSelectorOpen(false)}
          />
        </Suspense>
      )}

      {isMassImageUploaderOpen && (
        <Suspense fallback={null}>
          <MassImageUploader
            isOpen={isMassImageUploaderOpen}
            onClose={() => setIsMassImageUploaderOpen(false)}
            onComplete={() => { loadData(); }}
          />
        </Suspense>
      )}

      {isMassTagOpen && (
        <Suspense fallback={null}>
          <MassTagGenerator
            products={filteredProdutos}
            onComplete={loadData}
            open={isMassTagOpen}
            onOpenChange={setIsMassTagOpen}
            hideTrigger
          />
        </Suspense>
      )}

      {isCatalogTagPrintOpen && (
        <Suspense fallback={null}>
          <CatalogTagPrintDialog
            open={isCatalogTagPrintOpen}
            onOpenChange={setIsCatalogTagPrintOpen}
            products={filteredProdutos}
            filtersSummary={catalogTagFiltersSummary}
          />
        </Suspense>
      )}

      {isMassCategoryOpen && (
        <Suspense fallback={null}>
          <MassCategoryClassifier
            products={filteredProdutos}
            onComplete={loadData}
            open={isMassCategoryOpen}
            onOpenChange={setIsMassCategoryOpen}
            hideTrigger
          />
        </Suspense>
      )}

      {isMassPrecificacaoOpen && (
        <Suspense fallback={null}>
          <MassPrecificacaoDialog
            products={filteredProdutos}
            onComplete={loadData}
            open={isMassPrecificacaoOpen}
            onOpenChange={setIsMassPrecificacaoOpen}
            hideTrigger
          />
        </Suspense>
      )}

      {isPontosPedidoOpen && (
        <Suspense fallback={null}>
          <PontosPedidoCatalogoDialog
            products={produtos}
            open={isPontosPedidoOpen}
            onOpenChange={setIsPontosPedidoOpen}
            onComplete={loadData}
          />
        </Suspense>
      )}

      <ExcluirProdutoDialog
        produto={produtoParaExcluir}
        open={!!produtoParaExcluir}
        onClose={() => setProdutoParaExcluir(null)}
        onSuccess={loadData}
      />

      {/* FAB - oculto com formulário aberto (form fica acima do header fixo z-60) */}
      {!isFormOpen && <ProdutoFAB onNovoClicked={handleAddNew} />}

      {/* Dialog de Preview de Custos (Existing) */}
      <Dialog open={isPreviewCustosDialogOpen} onOpenChange={setIsPreviewCustosDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto dark:bg-background dark:text-foreground dark:border-border/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-medium text-foreground">
              <TrendingUp className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              Confirmar Atualização de Custos
            </DialogTitle>
          </DialogHeader>

          {previewCustosData && (
            <div className="space-y-4 py-4">
              {/* Resumo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="text-center p-3 bg-orange-50 rounded-lg border-2 border-orange-200 dark:bg-orange-900/20 dark:border-orange-900">
                  <div className="text-xl font-bold text-orange-700 dark:text-orange-300">
                    {previewCustosData.resumo.atualizacoes}
                  </div>
                  <div className="text-xs text-orange-600 dark:text-orange-300 font-semibold">Produtos a Atualizar</div>
                </div>
                {previewCustosData.resumo.erros.length > 0 && (
                  <div className="text-center p-3 bg-red-50 rounded-lg border-2 border-red-200 dark:bg-red-900/20 dark:border-red-900">
                    <div className="text-xl font-bold text-red-700 dark:text-red-300">
                      {previewCustosData.resumo.erros.length}
                    </div>
                    <div className="text-xs text-red-600 dark:text-red-300 font-semibold">Erros</div>
                  </div>
                )}
                {previewCustosData.resumo.naoEncontrados.length > 0 && (
                  <div className="text-center p-3 bg-yellow-50 rounded-lg border-2 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-900">
                    <div className="text-xl font-bold text-yellow-700 dark:text-yellow-300">
                      {previewCustosData.resumo.naoEncontrados.length}
                    </div>
                    <div className="text-xs text-yellow-600 dark:text-yellow-300 font-semibold">Não Encontrados</div>
                  </div>
                )}
              </div>

              {/* Erros e Avisos */}
              {previewCustosData.resumo.erros.length > 0 && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200 dark:bg-red-900/20 dark:border-red-900">
                  <div className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">❌ Erros:</div>
                  <ul className="text-xs text-red-600 dark:text-red-300 list-disc ml-4 max-h-24 overflow-y-auto">
                    {previewCustosData.resumo.erros.map((erro, i) => <li key={i}>{erro}</li>)}
                  </ul>
                </div>
              )}

              {previewCustosData.resumo.naoEncontrados.length > 0 && (
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-900">
                  <div className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-2">⚠️ Produtos não encontrados:</div>
                  <div className="text-xs text-yellow-700 dark:text-yellow-300 max-h-24 overflow-y-auto">
                    {previewCustosData.resumo.naoEncontrados.join(', ')}
                  </div>
                </div>
              )}

              {/* Tabela de Preview */}
              {previewCustosData.atualizacoes.length > 0 && (
                <div className="border rounded-lg dark:border-border/40 min-w-0">
                  <div className="max-h-96 overflow-auto">
                    <Table>
                      <TableHeader className="bg-muted/40 sticky top-0 dark:bg-muted">
                        <TableRow>
                          <TableHead className="w-[150px] dark:text-muted-foreground text-xs">Produto</TableHead>
                          <TableHead className="text-right dark:text-muted-foreground text-xs">Custo Atual</TableHead>
                          <TableHead className="text-right dark:text-muted-foreground text-xs">Novo Valor Compra</TableHead>
                          <TableHead className="text-right dark:text-muted-foreground text-xs">Novo Custo Total</TableHead>
                          <TableHead className="text-right dark:text-muted-foreground text-xs">Novo preço de venda</TableHead>
                          <TableHead className="text-right dark:text-muted-foreground text-xs">Variação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewCustosData.atualizacoes.map((item, index) => {
                          const isAumento = item.variacao_custo > 0;
                          return (
                            <TableRow key={index} className="hover:bg-muted/40 dark:hover:bg-muted/50">
                              <TableCell>
                                <div className="font-medium text-xs dark:text-foreground">{item.nome}</div>
                                <div className="text-xs text-muted-foreground">{item.codigo_interno}</div>
                              </TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">
                                R$ {formatarNumero(item.valor_compra_anterior)}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-orange-600 dark:text-orange-400 text-xs">
                                R$ {formatarNumero(item.novo_valor_compra)}
                              </TableCell>
                              <TableCell className="text-right font-semibold dark:text-foreground text-xs">
                                R$ {formatarNumero(item.novo_custo_total)}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-green-600 dark:text-green-400 text-xs">
                                R$ {formatarNumero(item.novo_preco_venda)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge
                                  className={`text-[10px] ${
                                    isAumento
                                      ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                                      : item.variacao_custo < 0
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                                        : 'bg-muted text-foreground/90 dark:bg-muted dark:text-foreground/90'
                                  }`}
                                >
                                  {isAumento ? '↑' : item.variacao_custo < 0 ? '↓' : '='}
                                  {Math.abs(item.variacao_custo).toFixed(1)}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 dark:bg-blue-900/20 dark:border-blue-900 dark:text-blue-300">
                <strong>ℹ️ Atenção:</strong> Esta operação irá:
                <ul className="list-disc ml-4 mt-1">
                  <li>Atualizar o "Valor de Compra" base no produto</li>
                  <li>Recalcular automaticamente todos os custos percentuais (frete, impostos, etc)</li>
                  <li>Atualizar o Custo Total calculado</li>
                  <li>Recalcular o Preço de Venda (se estiver em modo Markup %)</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsPreviewCustosDialogOpen(false);
                setPreviewCustosData(null);
              }}
              className="text-sm dark:bg-muted dark:text-foreground dark:border-border/40 dark:hover:bg-primary/90"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarImportacaoCustos}
              disabled={
                isProcessingCustos ||
                !previewCustosData ||
                previewCustosData.atualizacoes.length === 0
              }
              className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-600 text-sm"
            >
              {isProcessingCustos && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Atualização ({previewCustosData?.atualizacoes.length || 0})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ProdutosPage() {
  return (
    <ProdutosAccessGuard>
      <ProdutosPageContent />
    </ProdutosAccessGuard>
  );
}