import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast as sonnerToast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import FornecedorLinhaSelect from '@/components/compras/FornecedorLinhaSelect';
import FiltrosSugestaoCompra, {
  DEFAULT_SUGESTAO_COMPRA_FILTERS,
} from '@/components/compras/FiltrosSugestaoCompra';
import SugestaoCompraTreeGrid, { TREE_GRID_EXPAND_ALL_LEVEL } from '@/components/compras/SugestaoCompraTreeGrid';
import SugestaoCompraMobileCatalog, { SugestaoCompraMobileScrollShell } from '@/components/compras/SugestaoCompraMobileCatalog';
import SugestaoCompraMobileToolbar from '@/components/compras/SugestaoCompraMobileToolbar';
import SugestaoCompraDesktopToolbar from '@/components/compras/SugestaoCompraDesktopToolbar';
import SugestaoCompraRelatorioDialog from '@/components/compras/SugestaoCompraRelatorioDialog';
import { ShoppingCart, RefreshCw, CheckCircle, FileText } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/components/utils';
import { cn } from '@/components/utils';
import { dataHoje } from '@/components/utils/dateUtils';
import { downloadBlob } from '@/lib/mobilePrintAndShare';
import { useCompactShell } from '@/hooks/use-breakpoint';
import { buildSnapshotExibicaoComercial, resolveCommercialDisplay, resolveCustoTotalUnitBaseProduto } from '@/lib/productUnits';
import {
  buildLinhasSugestaoCompra,
  distribuirQuantidadeGrupo,
} from '@/lib/calcularSugestaoCompraHierarquia';
import { fetchPedidosVenda90d, fetchDadosVendaAbcd90d } from '@/lib/fetchPedidosVenda90d';
import { buildCatalogSalesVelocityMap } from '@/lib/catalogSalesVelocity';
import {
  applySugestaoOperationalMode,
  SUGESTAO_OPERATIONAL_MODES,
} from '@/lib/sugestaoCompraOperationalMode';
import { fetchProdutosAtivos } from '@/lib/fetchProdutosAtivos';
import { withRateLimitRetry } from '@/lib/p38ApiErrors';
import {
  buildSugestaoCompraLinhaLookup,
  enrichSugestaoLinhasComAbcd,
  extractProdutosFromSugestaoLinhas,
} from '@/lib/sugestaoCompraTree';
import {
  DEFAULT_SUGESTAO_COLUMN_SORT,
  SUGESTAO_COMPRA_SORT_COLUMNS,
  sortSugestaoCompraLinhasByColumn,
} from '@/lib/sugestaoCompraColumnSort';
import { buildUltimoFornecedorPorProduto } from '@/lib/buildUltimoFornecedorPorProduto';
import { buildPendenteAprovadoFinanceiroPorProduto } from '@/lib/sugestaoCompraEstoquePendente';
import { fetchPedidosCompraParaSugestaoEstoque } from '@/lib/fetchPedidosCompraParaSugestaoEstoque';
import {
  collectSugestaoTags,
  collectSugestaoVitrineUnits,
  countActiveSugestaoCompraFilters,
  describeSugestaoCompraFilters,
  filterSugestaoCompraLinhas,
  linhaAbaixoPontoFuturo,
} from '@/lib/filterSugestaoCompraLinhas';
import { readPortalSupplyBridge } from '@/lib/hierarquiaPortal/portalSupplyBridge';
const SUGESTAO_TREE_LEVEL_KEY = 'sugestaoCompra.treeLevel';
const SUGESTAO_GROUP_CATEGORY_KEY = 'sugestaoCompra.groupByCategory';
const SUGESTAO_OPERATIONAL_MODE_KEY = 'sugestaoCompra.operationalMode';
const SUGESTAO_COLUMN_SORT_KEY = 'sugestaoCompra.columnSort';

function readColumnSort() {
  try {
    const raw = localStorage.getItem(SUGESTAO_COLUMN_SORT_KEY);
    if (!raw) return { ...DEFAULT_SUGESTAO_COLUMN_SORT };
    const parsed = JSON.parse(raw);
    if (!SUGESTAO_COMPRA_SORT_COLUMNS.some((c) => c.id === parsed?.column)) {
      return { ...DEFAULT_SUGESTAO_COLUMN_SORT };
    }
    return {
      column: parsed.column,
      direction: parsed.direction === 'desc' ? 'desc' : 'asc',
    };
  } catch {
    return { ...DEFAULT_SUGESTAO_COLUMN_SORT };
  }
}

function readSugestaoTreeLevel() {
  try {
    const raw = localStorage.getItem(SUGESTAO_TREE_LEVEL_KEY);
    const n = Number(raw);
    return Number.isFinite(n) && n >= 1 ? n : 1;
  } catch {
    return 1;
  }
}

function readSugestaoGroupByCategory() {
  try {
    return localStorage.getItem(SUGESTAO_GROUP_CATEGORY_KEY) === '1';
  } catch {
    return false;
  }
}

function readSugestaoOperationalMode() {
  try {
    const raw = localStorage.getItem(SUGESTAO_OPERATIONAL_MODE_KEY);
    if (raw === SUGESTAO_OPERATIONAL_MODES.radar || raw === SUGESTAO_OPERATIONAL_MODES.bisturi) {
      return raw;
    }
    return SUGESTAO_OPERATIONAL_MODES.livre;
  } catch {
    return SUGESTAO_OPERATIONAL_MODES.livre;
  }
}

function fornecedorPadraoLinha(linha, ultimoFornecedorPorProduto = {}) {
  for (const produto of linha.skus || []) {
    const ultimo = ultimoFornecedorPorProduto[produto.id];
    if (ultimo) return ultimo;
  }
  const ids = linha.skus.map((p) => p.fornecedor_padrao_id).filter(Boolean);
  if (!ids.length) return '';
  const freq = {};
  ids.forEach((id) => {
    freq[id] = (freq[id] || 0) + 1;
  });
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
}

function buildFornecedorInicialPorLinha(linhas, ultimoFornecedorPorProduto = {}) {
  const map = {};
  linhas.forEach((linha) => {
    const id = fornecedorPadraoLinha(linha, ultimoFornecedorPorProduto);
    if (id) map[linha.id] = id;
  });
  return map;
}

export default function SugestaoCompra({ onStatsChange }) {
  const [linhas, setLinhas] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState({});
  const [fornecedorPorLinha, setFornecedorPorLinha] = useState({});
  const [quantidadeOverrideBase, setQuantidadeOverrideBase] = useState({});

  const [filters, setFilters] = useState(() => ({ ...DEFAULT_SUGESTAO_COMPRA_FILTERS }));
  const { roundingMode, agruparHierarquia } = filters;
  const [columnSort, setColumnSort] = useState(readColumnSort);
  const [treeLevel, setTreeLevel] = useState(readSugestaoTreeLevel);
  const [groupByCategory, setGroupByCategory] = useState(readSugestaoGroupByCategory);
  const [operationalMode, setOperationalMode] = useState(readSugestaoOperationalMode);
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);
  const [relatorioDialogOpen, setRelatorioDialogOpen] = useState(false);
  const [loadStats, setLoadStats] = useState({
    totalAtivos: 0,
    elegiveis: 0,
    semVenda: 0,
    abaixoPontoFuturo: 0,
    linhasGrupo: 0,
  });

  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useCompactShell();

  useEffect(() => {
    const bridge = readPortalSupplyBridge();
    if (!bridge?.searchTerm) return;
    setFilters((f) => ({ ...f, searchTerm: bridge.searchTerm }));
    const extra = bridge.ponto_futuro ? ` · P.FUT ${bridge.ponto_futuro}` : '';
    toast({
      title: 'Portal SMART SUPPLY',
      description: `Cotação pré-filtrada: ${bridge.searchTerm}${extra}`,
    });
  }, [toast]);
  const calcContextRef = useRef({
    pedidos: [],
    movsPorProduto: {},
    prods: [],
    pending: {},
    vendasDados: null,
    salesVelocityMap: {},
    ultimoFornecedorPorProduto: {},
  });
  const abcdLoadRef = useRef(0);
  const filtersRef = useRef(filters);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const incluirPedidosAprovadosAtual = useCallback(
    () => filtersRef.current.considerarPedidosAprovadosEstoque === true,
    [],
  );

  const allTags = useMemo(() => collectSugestaoTags(linhas), [linhas]);
  const unidadesVitrine = useMemo(() => collectSugestaoVitrineUnits(linhas), [linhas]);

  const produtoParaCompra = (produto) => buildSnapshotExibicaoComercial(produto);

  const calcQuantityLinha = useCallback((linha) => {
    if (quantidadeOverrideBase[linha.id] != null) {
      return quantidadeOverrideBase[linha.id];
    }
    return linha.sugestao?.quantidade_sugerida_base || 0;
  }, [quantidadeOverrideBase]);

  const resolveFornecedorIdLinha = useCallback((linha) => {
    return fornecedorPorLinha[linha.id]
      || fornecedorPadraoLinha(linha, calcContextRef.current.ultimoFornecedorPorProduto);
  }, [fornecedorPorLinha]);

  const filterOptions = useMemo(
    () => ({
      resolveFornecedorId: resolveFornecedorIdLinha,
      quantidadeBaseLinha: calcQuantityLinha,
    }),
    [resolveFornecedorIdLinha, calcQuantityLinha],
  );

  const sortCtx = useMemo(
    () => ({
      quantidadeBase: calcQuantityLinha,
      fornecedorNome: (linha) => {
        const id = resolveFornecedorIdLinha(linha);
        return fornecedores.find((f) => f.id === id)?.nome || '';
      },
    }),
    [calcQuantityLinha, resolveFornecedorIdLinha, fornecedores],
  );

  const handleQuantidadeLinhaChange = useCallback((linha, qtyComercial) => {
    const snap = produtoParaCompra(linha.produto);
    const disp = resolveCommercialDisplay(
      snap,
      0,
      linha.produto.unidade_principal || 'UN',
    );
    const fator = disp.fator_conversao || 1;
    const parsed = Number(String(qtyComercial).replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) return;
    const base = parsed * fator;
    setQuantidadeOverrideBase((prev) => ({
      ...prev,
      [linha.id]: base,
    }));
  }, []);

  const sugestaoDisplayLinha = (linha) => {
    const qBase = calcQuantityLinha(linha);
    return resolveCommercialDisplay(
      produtoParaCompra(linha.produto),
      qBase,
      linha.produto.unidade_principal || 'UN',
    );
  };

  const recomputarLinhas = useCallback(
    (prods, pedidos, movsPorProduto, pending, opts = {}) => {
      const agrupar = opts.agruparHierarquia ?? agruparHierarquia;
      const round = opts.roundingMode ?? roundingMode;
      const salesVelocityMap = opts.salesVelocityMap
        ?? buildCatalogSalesVelocityMap(prods, pedidos);
      return buildLinhasSugestaoCompra(prods, pedidos, movsPorProduto, pending, {
        agruparHierarquia: agrupar,
        roundingMode: round,
        fonte: 'velocidade',
        salesVelocityMap,
        incluirTodoCatalogo: true,
        catalogoCompleto: true,
        considerarPedidosAprovadosEstoque: opts.considerarPedidosAprovadosEstoque === true,
      });
    },
    [agruparHierarquia, roundingMode],
  );

  const aplicarLinhas = useCallback((prods, pedidos, movsPorProduto, pending, opts = {}) => {
    const novasLinhas = recomputarLinhas(prods, pedidos, movsPorProduto, pending, opts);
    const abaixoPonto = novasLinhas.filter(linhaAbaixoPontoFuturo).length;
    const semVenda = novasLinhas.filter((l) => !l.sugestao?.media_30d_texto).length;

    setLoadStats({
      totalAtivos: prods.length,
      elegiveis: abaixoPonto,
      comGiro: novasLinhas.filter((l) => l.sugestao?.media_dia > 0 || l.sugestao?.media_30d_texto).length,
      semVenda,
      abaixoPontoFuturo: abaixoPonto,
      linhasGrupo: novasLinhas.filter((l) => l.tipo === 'grupo').length,
    });
    setLinhas(novasLinhas);
    return novasLinhas;
  }, [recomputarLinhas]);

  const aplicarLinhasComContexto = useCallback((overrides = {}) => {
    const ctx = calcContextRef.current;
    if (!ctx.prods?.length) return null;
    const filtros = filtersRef.current;
    const incluir = overrides.considerarPedidosAprovadosEstoque ?? incluirPedidosAprovadosAtual();
    let next = recomputarLinhas(ctx.prods, ctx.pedidos, ctx.movsPorProduto, ctx.pending, {
      agruparHierarquia: overrides.agruparHierarquia ?? filtros.agruparHierarquia,
      roundingMode: overrides.roundingMode ?? filtros.roundingMode,
      salesVelocityMap: overrides.salesVelocityMap ?? ctx.salesVelocityMap,
      considerarPedidosAprovadosEstoque: incluir,
    });
    if (ctx.vendasDados) {
      next = enrichSugestaoLinhasComAbcd(next, ctx.prods, ctx.vendasDados);
    }
    setLinhas(next);
    return next;
  }, [recomputarLinhas, incluirPedidosAprovadosAtual]);

  const loadData = async () => {
    setIsLoading(true);
    const abcdLoadId = ++abcdLoadRef.current;
    try {
      const [prods, forn, cats] = await Promise.all([
        fetchProdutosAtivos(),
        base44.entities.Terceiro.list(),
        base44.entities.Categoria.list(),
      ]);

      setFornecedores(forn);
      setCategorias(cats);

      const movsPorProduto = {};
      const pending = {};
      const salesVelocityMapVazio = buildCatalogSalesVelocityMap(prods, []);
      calcContextRef.current = {
        pedidos: [],
        movsPorProduto,
        prods,
        pending,
        salesVelocityMap: salesVelocityMapVazio,
        ultimoFornecedorPorProduto: {},
      };

      const linhasIniciais = aplicarLinhas(prods, [], movsPorProduto, pending, {
        salesVelocityMap: salesVelocityMapVazio,
      });
      setQuantidadeOverrideBase({});
      setFornecedorPorLinha(buildFornecedorInicialPorLinha(linhasIniciais));
    } catch (error) {
      toast({ title: 'Erro ao carregar', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }

    const ctx = calcContextRef.current;
    if (!ctx.prods?.length) return;

    const atualizarComPedidos = (pedidos, extra = {}) => {
      const salesVelocityMap = buildCatalogSalesVelocityMap(ctx.prods, pedidos);
      calcContextRef.current = {
        ...calcContextRef.current,
        pedidos,
        salesVelocityMap,
        ...extra,
      };
      const next = aplicarLinhas(
        ctx.prods,
        pedidos,
        ctx.movsPorProduto,
        extra.pending ?? ctx.pending,
        {
          salesVelocityMap,
          considerarPedidosAprovadosEstoque:
            extra.considerarPedidosAprovadosEstoque ?? incluirPedidosAprovadosAtual(),
        },
      );
      if (calcContextRef.current.vendasDados) {
        setLinhas(enrichSugestaoLinhasComAbcd(next, ctx.prods, calcContextRef.current.vendasDados));
      }
    };

    fetchPedidosCompraParaSugestaoEstoque(base44)
      .then(({ pedidosTodos, pedidosAbertos, embarques, recebidosPorPedidoProduto }) => {
        const pedidosCompra = pedidosTodos;
        const pendingMap = buildPendenteAprovadoFinanceiroPorProduto(
          pedidosAbertos,
          recebidosPorPedidoProduto,
          { embarques, pedidosParaEmbarque: pedidosTodos },
        );
        const ultimoFornecedorPorProduto = buildUltimoFornecedorPorProduto(pedidosCompra);
        calcContextRef.current = {
          ...calcContextRef.current,
          pedidosCompra,
          pending: pendingMap,
          ultimoFornecedorPorProduto,
        };
        setFornecedorPorLinha((prev) => {
          const merged = { ...prev };
          setLinhas((currentLinhas) => {
            currentLinhas.forEach((l) => {
              if (!merged[l.id]) {
                const id = fornecedorPadraoLinha(l, ultimoFornecedorPorProduto);
                if (id) merged[l.id] = id;
              }
            });
            return currentLinhas;
          });
          return merged;
        });
        if (calcContextRef.current.pedidos?.length) {
          atualizarComPedidos(calcContextRef.current.pedidos, {
            pending: pendingMap,
            ultimoFornecedorPorProduto,
            considerarPedidosAprovadosEstoque: incluirPedidosAprovadosAtual(),
          });
        } else {
          aplicarLinhas(
            ctx.prods,
            [],
            calcContextRef.current.movsPorProduto,
            pendingMap,
            {
              salesVelocityMap: calcContextRef.current.salesVelocityMap,
              considerarPedidosAprovadosEstoque: incluirPedidosAprovadosAtual(),
            },
          );
        }
      })
      .catch(() => {
        toast({
          title: 'Pedidos de compra não carregados',
          description: 'Estoque com pedidos em trânsito pode estar incompleto até reconectar.',
          variant: 'destructive',
        });
      });

    withRateLimitRetry(() => fetchPedidosVenda90d(), {
      maxAttempts: 3,
      baseDelayMs: 800,
    })
      .then((pedidos) => {
        atualizarComPedidos(pedidos);
      })
      .catch(() => {
        toast({
          title: 'Vendas ainda não carregadas',
          description: 'O catálogo já está visível. Média 30d e ponto futuro atualizam ao reconectar.',
          variant: 'destructive',
        });
      });

    withRateLimitRetry(() => fetchDadosVendaAbcd90d(), {
      maxAttempts: 3,
      baseDelayMs: 800,
    })
      .then((vendasDados) => {
        if (abcdLoadId !== abcdLoadRef.current) return;
        const pedidos = vendasDados.pedidos90d?.length
          ? vendasDados.pedidos90d
          : calcContextRef.current.pedidos;
        const salesVelocityMap = buildCatalogSalesVelocityMap(ctx.prods, pedidos);
        calcContextRef.current = {
          ...calcContextRef.current,
          pedidos,
          vendasDados,
          salesVelocityMap,
        };
        const next = recomputarLinhas(
          ctx.prods,
          pedidos,
          calcContextRef.current.movsPorProduto,
          calcContextRef.current.pending,
          {
            salesVelocityMap,
            considerarPedidosAprovadosEstoque: incluirPedidosAprovadosAtual(),
          },
        );
        setLinhas(enrichSugestaoLinhasComAbcd(next, ctx.prods, vendasDados));
      })
      .catch(() => {
        /* ABCD ao vivo é opcional */
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const ctx = calcContextRef.current;
    if (!ctx.prods?.length) return;
    aplicarLinhasComContexto();
  }, [roundingMode, agruparHierarquia, filters.considerarPedidosAprovadosEstoque, aplicarLinhasComContexto]);

  const filteredLinhas = useMemo(
    () => filterSugestaoCompraLinhas(linhas, filters, filterOptions),
    [linhas, filters, filterOptions],
  );

  const sortedLinhas = useMemo(
    () => sortSugestaoCompraLinhasByColumn(filteredLinhas, columnSort, sortCtx),
    [filteredLinhas, columnSort, sortCtx],
  );

  const mobileLinhas = sortedLinhas;

  const treeProdutos = useMemo(
    () => extractProdutosFromSugestaoLinhas(filteredLinhas),
    [filteredLinhas],
  );
  const linhaLookup = useMemo(
    () => buildSugestaoCompraLinhaLookup(filteredLinhas),
    [filteredLinhas],
  );

  const salesVelocityMap = useMemo(
    () => calcContextRef.current.salesVelocityMap || {},
    [linhas],
  );

  const activeFilterCount = useMemo(
    () => countActiveSugestaoCompraFilters(filters),
    [filters],
  );

  const handleToggleSomenteAbaixo = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      somenteAbaixoPontoFuturo: !prev.somenteAbaixoPontoFuturo,
    }));
  }, []);

  const handleToggleConsiderarPedidos = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      considerarPedidosAprovadosEstoque: !prev.considerarPedidosAprovadosEstoque,
    }));
  }, []);

  const applyOperationalMode = useCallback((mode) => {
    const preset = applySugestaoOperationalMode(mode, {
      treeLevel,
      groupByCategory,
      columnSort,
      considerarPedidosAprovadosEstoque: filters.considerarPedidosAprovadosEstoque,
    });
    setOperationalMode(mode);
    try {
      localStorage.setItem(SUGESTAO_OPERATIONAL_MODE_KEY, mode);
    } catch {
      // ignore
    }
    if (preset.treeLevel != null) setTreeLevel(preset.treeLevel);
    if (preset.groupByCategory != null) {
      setGroupByCategory(preset.groupByCategory);
      try {
        localStorage.setItem(SUGESTAO_GROUP_CATEGORY_KEY, preset.groupByCategory ? '1' : '0');
      } catch {
        // ignore
      }
    }
    if (preset.columnSort) {
      setColumnSort(preset.columnSort);
      try {
        localStorage.setItem(SUGESTAO_COLUMN_SORT_KEY, JSON.stringify(preset.columnSort));
      } catch {
        // ignore
      }
    }
    if (preset.filtersPatch && Object.keys(preset.filtersPatch).length) {
      setFilters((prev) => ({ ...prev, ...preset.filtersPatch }));
    }
    try {
      localStorage.setItem(SUGESTAO_TREE_LEVEL_KEY, String(preset.treeLevel ?? treeLevel));
    } catch {
      // ignore
    }
  }, [columnSort, filters.considerarPedidosAprovadosEstoque, groupByCategory, treeLevel]);

  const handleGerarRelatorio = useCallback(async ({ format = 'pdf', agruparNivel = 0 } = {}) => {
    if (!filteredLinhas.length) {
      toast({
        title: 'Nada para exportar',
        description: 'Ajuste os filtros ou aguarde o carregamento da lista.',
        variant: 'destructive',
      });
      return;
    }

    const isPdf = format === 'pdf';
    setGerandoRelatorio(true);
    toast({
      title: isPdf
        ? 'Gerando PDF da sugestão de compra...'
        : 'Gerando planilha da sugestão de compra...',
    });
    try {
      const filtersSummary = describeSugestaoCompraFilters(filters, { categorias, fornecedores });
      const fornecedorNomeById = Object.fromEntries(
        fornecedores.map((f) => [f.id, f.nome]),
      );
      const reportPayload = {
        linhas: sortedLinhas,
        filters_summary: filtersSummary,
        agrupar_nivel: agruparNivel,
        ctx: {
          incluirPedidosAprovados: filters.considerarPedidosAprovadosEstoque === true,
          quantidadeBaseLinha: calcQuantityLinha,
          resolveFornecedorId: resolveFornecedorIdLinha,
          fornecedorNomeById,
          fornecedores,
        },
      };

      if (isPdf) {
        const { generateRelatorioSugestaoCompraPdf } = await import(
          '@/lib/relatorioSugestaoCompra/generateRelatorioSugestaoCompraPdf.js'
        );
        const resposta = await generateRelatorioSugestaoCompraPdf(reportPayload);
        const blob = new Blob([resposta.data], { type: 'application/pdf' });
        downloadBlob(blob, `SugestaoCompra_ABCD_${dataHoje()}.pdf`);
        toast({
          title: 'PDF gerado',
          description: `${resposta.rowCount} item(ns) · A4 retrato${agruparNivel ? ` · nível ${agruparNivel}` : ''}${resposta?.version ? ` · ${resposta.version}` : ''}`,
        });
      } else {
        const { generateRelatorioSugestaoCompraXlsx } = await import(
          '@/lib/relatorioSugestaoCompraXlsx/generateRelatorioSugestaoCompraXlsx.js'
        );
        const resposta = await generateRelatorioSugestaoCompraXlsx(reportPayload);
        const blob = new Blob([resposta.data], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        downloadBlob(blob, `SugestaoCompra_ABCD_${dataHoje()}.xlsx`);
        toast({
          title: 'Planilha gerada',
          description: `${resposta.rowCount} item(ns) em abas por curva ABCD${agruparNivel ? ` · nível ${agruparNivel}` : ''}${resposta?.version ? ` · ${resposta.version}` : ''}`,
        });
      }
      setRelatorioDialogOpen(false);
    } catch (error) {
      const msg = error?.message || String(error);
      toast({
        title: 'Erro ao gerar relatório',
        description: msg.length > 300 ? `${msg.slice(0, 300)}…` : msg,
        variant: 'destructive',
      });
      console.error(error);
    } finally {
      setGerandoRelatorio(false);
    }
  }, [
    filteredLinhas.length,
    sortedLinhas,
    filters,
    categorias,
    fornecedores,
    calcQuantityLinha,
    resolveFornecedorIdLinha,
    toast,
  ]);

  const handleColumnSort = useCallback((column) => {
    setColumnSort((prev) => {
      const next = prev?.column === column
        ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: 'asc' };
      try {
        localStorage.setItem(SUGESTAO_COLUMN_SORT_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const handleMobileSortColumn = handleColumnSort;

  const handleTreeLevelChange = useCallback((next) => {
    setTreeLevel(next);
    try {
      localStorage.setItem(SUGESTAO_TREE_LEVEL_KEY, String(next));
    } catch {
      /* ignore */
    }
  }, []);

  const handleGroupByCategoryChange = useCallback((next) => {
    setGroupByCategory(next);
    try {
      localStorage.setItem(SUGESTAO_GROUP_CATEGORY_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const selectedCount = Object.keys(selectedItems).length;
  const allVisibleSelected =
    filteredLinhas.length > 0 && filteredLinhas.every((l) => selectedItems[l.id]);
  const someVisibleSelected = filteredLinhas.some((l) => selectedItems[l.id]);

  useEffect(() => {
    onStatsChange?.({
      total: filteredLinhas.length,
      selected: selectedCount,
      catalogo: linhas.length,
      ...loadStats,
    });
  }, [filteredLinhas.length, selectedCount, linhas.length, loadStats, onStatsChange]);

  const handleSelectAll = (checked) => {
    if (checked) {
      const all = {};
      filteredLinhas.forEach((l) => {
        all[l.id] = true;
      });
      setSelectedItems(all);
    } else {
      setSelectedItems({});
    }
  };

  const limparFiltros = () => {
    setFilters({ ...DEFAULT_SUGESTAO_COMPRA_FILTERS });
  };

  const expandirLinhaItens = (linha) => {
    const { pedidos } = calcContextRef.current;
    if (linha.tipo === 'sku') {
      const p = linha.produto;
      const qBase = calcQuantityLinha(linha);
      return [{ produto: p, quantidade_base: qBase, nome: p.nome }];
    }

    const total = calcQuantityLinha(linha);
    const partes = distribuirQuantidadeGrupo(linha.skus, total, pedidos, roundingMode);
    return partes.map(({ produto, quantidade_base }) => ({
      produto,
      quantidade_base,
      nome:
        linha.skus.length > 1
          ? `${linha.label} (${produto.campo_hierarquico_5 || produto.marca || produto.nome})`
          : linha.label,
    }));
  };

  const fornecedorLinha = (linha) => resolveFornecedorIdLinha(linha);

  const handleGenerate = async () => {
    const selected = filteredLinhas.filter((l) => selectedItems[l.id]);
    if (selected.length === 0) return;

    const semFornecedor = selected.filter((l) => !fornecedorLinha(l));
    if (semFornecedor.length > 0) {
      toast({
        title: 'Itens sem fornecedor',
        description: `${semFornecedor.length} linha(s) sem fornecedor`,
        variant: 'destructive',
      });
      return;
    }

    const bySupplier = {};
    selected.forEach((linha) => {
      const sid = fornecedorLinha(linha);
      const supplier = fornecedores.find((f) => f.id === sid);
      if (!bySupplier[sid]) {
        bySupplier[sid] = { fornecedor_id: sid, fornecedor_nome: supplier?.nome || 'N/A', itens: [] };
      }

      expandirLinhaItens(linha).forEach(({ produto, quantidade_base, nome }) => {
        const snap = produtoParaCompra(produto);
        const disp = resolveCommercialDisplay(snap, quantidade_base, produto.unidade_principal || 'UN');
        const custoBase = resolveCustoTotalUnitBaseProduto(produto);
        const custoUnitCompra = custoBase * (disp.fator_conversao || 1);
        bySupplier[sid].itens.push({
          produto_id: produto.id,
          produto_nome: nome,
          quantidade: disp.quantidade,
          quantidade_base,
          fator_conversao: disp.fator_conversao,
          unidade: disp.unidade,
          custo_unitario: custoUnitCompra,
          total: quantidade_base * custoBase,
        });
      });
    });

    try {
      const all = await base44.entities.PedidoCompra.list();
      let num =
        (all.length > 0 ? Math.max(...all.map((x) => parseInt(x.numero?.split('-')[1] || 0, 10))) : 0) + 1;

      const numerosCriados = [];
      await Promise.all(
        Object.values(bySupplier).map((data) => {
          const total = data.itens.reduce((sum, i) => sum + i.total, 0);
          const numero = `PC-${String(num++).padStart(5, '0')}`;
          numerosCriados.push(numero);
          return base44.entities.PedidoCompra.create({
            ...data,
            numero,
            status: 'Rascunho',
            valor_total: total,
          });
        }),
      );

      const qtd = numerosCriados.length;
      const resumoNumeros = numerosCriados.slice(0, 3).join(', ');
      sonnerToast.success('Pedidos gerados', {
        description:
          qtd === 1
            ? `${numerosCriados[0]} criado em rascunho`
            : `${qtd} pedidos (${resumoNumeros}${qtd > 3 ? '…' : ''})`,
        action: {
          label: 'Ir para Embarques',
          onClick: () => navigate(createPageUrl('PedidosCompra')),
        },
      });
      setSelectedItems({});
      loadData();
    } catch (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const handleQuote = async () => {
    const selected = filteredLinhas.filter((l) => selectedItems[l.id]);
    if (selected.length === 0) return;

    try {
      const all = await base44.entities.Cotacao.list();
      const num =
        (all.length > 0 ? Math.max(...all.map((c) => parseInt(c.numero?.split('-')[1] || 0, 10))) : 0) + 1;

      const itens = [];
      const supplierIds = new Set();

      selected.forEach((linha) => {
        const sid = fornecedorLinha(linha);
        if (sid) supplierIds.add(sid);

        if (linha.tipo === 'grupo') {
          const qBase = calcQuantityLinha(linha);
          const disp = sugestaoDisplayLinha(linha);
          itens.push({
            produto_id: linha.produto.id,
            produto_nome: linha.label,
            quantidade: disp.quantidade,
            unidade: disp.unidade,
            quantidade_base: qBase,
            fator_conversao: disp.fator_conversao,
            observacao: `${linha.skus.length} modelo(s) — família hierárquica`,
          });
        } else {
          expandirLinhaItens(linha).forEach(({ produto, quantidade_base, nome }) => {
            const disp = resolveCommercialDisplay(
              produtoParaCompra(produto),
              quantidade_base,
              produto.unidade_principal || 'UN',
            );
            itens.push({
              produto_id: produto.id,
              produto_nome: nome,
              quantidade: disp.quantidade,
              unidade: disp.unidade,
              quantidade_base,
              fator_conversao: disp.fator_conversao,
            });
          });
        }
      });

      await base44.entities.Cotacao.create({
        numero: `COT-${String(num).padStart(5, '0')}`,
        titulo: `Cotação - ${new Date().toLocaleDateString()}`,
        status: 'Rascunho',
        data_abertura: dataHoje(),
        itens,
        fornecedores: [...supplierIds].map((id) => {
          const f = fornecedores.find((x) => x.id === id);
          return { fornecedor_id: id, fornecedor_nome: f?.nome || 'N/A', status_envio: 'Pendente' };
        }),
      });

      toast({ title: 'Cotação criada', className: 'bg-blue-100 text-blue-800' });
      setSelectedItems({});
    } catch (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const renderFornecedorSelect = (linha, className = '') => (
    <FornecedorLinhaSelect
      value={fornecedorLinha(linha)}
      onChange={(v) =>
        setFornecedorPorLinha({
          ...fornecedorPorLinha,
          [linha.id]: v,
        })
      }
      fornecedores={fornecedores}
      className={className || 'h-8 max-w-[14rem] rounded-lg text-xs'}
    />
  );

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center', isMobile ? 'h-full min-h-[12rem]' : 'py-16')}>
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const mobileFornecedorClass =
    'h-9 w-full min-w-0 max-w-full rounded-lg border-0 bg-muted/50 text-[11px] px-2';

  const emptyCatalogo = (
    <div className="flex flex-col items-center gap-3 py-14 px-4 text-center max-w-lg mx-auto">
      <CheckCircle className="w-9 h-9 text-muted-foreground/40" />
      <p className="text-sm text-foreground/90 font-medium">Nenhuma sugestão no momento</p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {loadStats.totalAtivos > 0 ? (
          <>
            {loadStats.totalAtivos} produto(s) no catálogo.
            {loadStats.comGiro === 0
              ? ' Aguardando histórico de vendas para calcular média 30d e ponto futuro.'
              : ` ${loadStats.comGiro} com giro nos últimos 60 dias.`}
          </>
        ) : (
          <>Não foi possível carregar produtos do catálogo. Tente atualizar a página.</>
        )}
      </p>
      <Button type="button" variant="outline" size="sm" className="mt-1 rounded-2xl" asChild>
        <Link to={createPageUrl('Produtos')}>Ver catálogo e histórico de vendas</Link>
      </Button>
    </div>
  );

  const semFiltro = (
    <div className="py-14 text-center text-sm text-muted-foreground">
      Nenhum item corresponde aos filtros.
    </div>
  );

  const relatorioDialog = (
    <SugestaoCompraRelatorioDialog
      open={relatorioDialogOpen}
      onOpenChange={setRelatorioDialogOpen}
      filteredCount={filteredLinhas.length}
      isGenerating={gerandoRelatorio}
      onConfirm={handleGerarRelatorio}
    />
  );

  if (isMobile) {
    return (
      <div className="flex flex-col h-full min-h-0 overflow-hidden w-full max-w-full bg-background">
        <SugestaoCompraMobileScrollShell
          chrome={(
            <>
              <div className="shrink-0 px-2.5 pt-1">
                <FiltrosSugestaoCompra
                  filters={filters}
                  onFiltersChange={setFilters}
                  categorias={categorias}
                  fornecedores={fornecedores}
                  allTags={allTags}
                  unidadesVitrine={unidadesVitrine}
                  onLimparFiltros={limparFiltros}
                  drawerOpen={filtersDrawerOpen}
                  onDrawerOpenChange={setFiltersDrawerOpen}
                />
              </div>
              <p className="shrink-0 px-2.5 text-xs text-foreground/85 leading-relaxed">
                <span className="font-medium text-foreground">{filteredLinhas.length}</span> itens
                {selectedCount > 0 ? ` · ${selectedCount} selecionados` : ''}
              </p>
              {linhas.length > 0 && filteredLinhas.length > 0 ? (
                <SugestaoCompraMobileToolbar
                  filteredCount={filteredLinhas.length}
                  selectedCount={selectedCount}
                  allSelected={filteredLinhas.length > 0 && filteredLinhas.every((l) => selectedItems[l.id])}
                  onSelectAll={handleSelectAll}
                  columnSort={columnSort}
                  onSortColumn={handleMobileSortColumn}
                  activeFilterCount={activeFilterCount}
                  onOpenFilters={() => setFiltersDrawerOpen(true)}
                  somenteAbaixoPontoFuturo={filters.somenteAbaixoPontoFuturo === true}
                  onToggleSomenteAbaixo={handleToggleSomenteAbaixo}
                  considerarPedidosAprovadosEstoque={filters.considerarPedidosAprovadosEstoque === true}
                  onToggleConsiderarPedidos={handleToggleConsiderarPedidos}
                  onOpenRelatorio={() => setRelatorioDialogOpen(true)}
                  gerandoRelatorio={gerandoRelatorio}
                  onRefresh={loadData}
                  isLoading={isLoading}
                />
              ) : null}
            </>
          )}
        >
          {linhas.length === 0
            ? emptyCatalogo
            : filteredLinhas.length === 0
              ? semFiltro
              : (
                <SugestaoCompraMobileCatalog
                  linhas={mobileLinhas}
                  incluirPedidosAprovados={filters.considerarPedidosAprovadosEstoque === true}
                  selectedItems={selectedItems}
                  onToggleSelected={(id, checked) =>
                    setSelectedItems((prev) =>
                      checked ? { ...prev, [id]: true } : { ...prev, [id]: undefined },
                    )
                  }
                  sugestaoDisplayLinha={sugestaoDisplayLinha}
                  onQuantidadeLinhaChange={handleQuantidadeLinhaChange}
                  renderFornecedorSelect={(linha) => renderFornecedorSelect(linha, mobileFornecedorClass)}
                />
              )}
        </SugestaoCompraMobileScrollShell>

        <div className="fixed inset-x-0 bottom-[var(--p38-bottom-nav-total,0px)] z-40 max-w-[100vw] border-t border-border/40 bg-card/95 backdrop-blur-sm px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.12)] pointer-events-none">
          <div className="flex gap-2 max-w-7xl mx-auto pointer-events-auto">
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1 rounded-2xl gap-2 text-sm font-medium"
              disabled={selectedCount === 0}
              onClick={handleQuote}
            >
              <FileText className="w-4 h-4 shrink-0" />
              Cotação
            </Button>
            <Button
              type="button"
              className="h-12 flex-1 rounded-2xl gap-2 text-sm font-medium"
              disabled={selectedCount === 0}
              onClick={handleGenerate}
            >
              <ShoppingCart className="w-4 h-4 shrink-0" />
              Pedido{selectedCount > 0 ? ` (${selectedCount})` : ''}
            </Button>
          </div>
        </div>
        {relatorioDialog}
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full min-w-0 max-w-full overflow-x-clip">
      <FiltrosSugestaoCompra
        filters={filters}
        onFiltersChange={setFilters}
        categorias={categorias}
        fornecedores={fornecedores}
        allTags={allTags}
        unidadesVitrine={unidadesVitrine}
        onLimparFiltros={limparFiltros}
        drawerOpen={filtersDrawerOpen}
        onDrawerOpenChange={setFiltersDrawerOpen}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground/85">
          {filteredLinhas.length} item(ns)
          {loadStats.totalAtivos > 0 ? ` · ${loadStats.totalAtivos} no catálogo` : ''}
          {loadStats.abaixoPontoFuturo > 0 ? ` · ${loadStats.abaixoPontoFuturo} abaixo do ponto futuro` : ''}
          {loadStats.linhasGrupo > 0 ? ` · ${loadStats.linhasGrupo} família(s)` : ''}
          {selectedCount > 0 ? ` · ${selectedCount} selecionada(s)` : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-11 rounded-2xl gap-1.5"
            disabled={selectedCount === 0}
            onClick={handleQuote}
          >
            <FileText className="w-4 h-4" />
            Cotação
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-11 rounded-2xl gap-1.5"
            disabled={selectedCount === 0}
            onClick={handleGenerate}
          >
            <ShoppingCart className="w-4 h-4" />
            Gerar pedido{selectedCount > 0 ? ` (${selectedCount})` : ''}
          </Button>
        </div>
      </div>

      {linhas.length === 0 ? (
        emptyCatalogo
      ) : filteredLinhas.length === 0 ? (
        semFiltro
      ) : (
        <div className="min-w-0 w-full max-w-full space-y-2 overflow-x-clip">
          <SugestaoCompraDesktopToolbar
            filteredCount={filteredLinhas.length}
            selectedCount={selectedCount}
            allSelected={allVisibleSelected}
            someSelected={someVisibleSelected}
            onSelectAllVisible={handleSelectAll}
            columnSort={columnSort}
            onSortColumn={handleMobileSortColumn}
            groupByCategory={groupByCategory}
            onGroupByCategoryChange={handleGroupByCategoryChange}
            somenteAbaixoPontoFuturo={filters.somenteAbaixoPontoFuturo === true}
            onToggleSomenteAbaixo={handleToggleSomenteAbaixo}
            considerarPedidosAprovadosEstoque={filters.considerarPedidosAprovadosEstoque === true}
            onToggleConsiderarPedidos={handleToggleConsiderarPedidos}
            operationalMode={operationalMode}
            onOperationalModeChange={applyOperationalMode}
            onOpenRelatorio={() => setRelatorioDialogOpen(true)}
            gerandoRelatorio={gerandoRelatorio}
            activeFilterCount={activeFilterCount}
            onOpenFilters={() => setFiltersDrawerOpen(true)}
            onRefresh={loadData}
            isLoading={isLoading}
            treeLevel={treeLevel}
            onTreeLevelChange={handleTreeLevelChange}
          />
          <SugestaoCompraTreeGrid
            produtos={treeProdutos}
            linhaLookup={linhaLookup}
            agruparHierarquia={agruparHierarquia}
            operationalMode={operationalMode}
            incluirPedidosAprovados={filters.considerarPedidosAprovadosEstoque === true}
            columnSort={columnSort}
            onColumnSort={handleColumnSort}
            sortCtx={sortCtx}
            groupByCategory={groupByCategory}
            masterLevel={treeLevel === TREE_GRID_EXPAND_ALL_LEVEL ? TREE_GRID_EXPAND_ALL_LEVEL : treeLevel}
            salesVelocityMap={salesVelocityMap}
            selectedItems={selectedItems}
            onToggleSelected={(id, checked) =>
              setSelectedItems((prev) =>
                checked ? { ...prev, [id]: true } : { ...prev, [id]: undefined },
              )
            }
            allVisibleSelected={allVisibleSelected}
            someVisibleSelected={someVisibleSelected}
            onSelectAllVisible={handleSelectAll}
            sugestaoDisplayLinha={sugestaoDisplayLinha}
            onQuantidadeLinhaChange={handleQuantidadeLinhaChange}
            renderFornecedorSelect={(linha) =>
              renderFornecedorSelect(linha, 'h-8 w-full max-w-[14rem] rounded-md border-0 bg-muted/30 text-xs')
            }
          />
        </div>
      )}
      {relatorioDialog}
    </div>
  );
}
