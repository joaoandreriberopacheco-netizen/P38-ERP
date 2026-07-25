import { useState, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DollarSign, Warehouse, Settings, Save, X, Plus, Upload, Loader2, ChevronRight, Truck, Box, FileText, Tag, TrendingUp, Target, History, Undo2, Redo2, Copy, Trash2, Package, Boxes, BarChart3 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useUnsavedChangesWarning } from '../utils/useUnsavedChangesWarning';
import TagGenerator from './TagGenerator';
import CurrencyInput from './CurrencyInput';
import UnidadesAlternativasEditor from './UnidadesAlternativasEditor';
import ProductUnitSelectorDialog from './ProductUnitSelectorDialog';
import { useToast } from "@/components/ui/use-toast";
import ProdutoHistoricoEstoqueTab from '@/components/produtos/ProdutoHistoricoEstoqueTab';
import ProdutoIepTab from '@/components/produtos/ProdutoIepTab';
import { applyUnidadesToProduto, makeUnidade, normalizeSigla } from '@/lib/productUnitsCrud';
import {
  buildProductSnapshotForPricing,
  buildSaleUnitOptions,
  custoDisplayScale,
  getPrecoVendaNaUnidadeCatalogo,
  precoVendaPadraoFromPrecoCatalogo,
  resolvePrimaryFromFactorOne,
  resolveUnidadeExibicao,
  resolveCommercialDisplay,
} from '@/lib/productUnits';
import {
  fetchEmbalagensByProdutoId,
  isProdutoEmbalagemEntityFlagOn,
  patchProdutoUnidadesFromEmbalagensRows,
  replaceEmbalagensForProduto,
} from '@/lib/produtoEmbalagensEntity';
import { embalagensRowsToLegacyProdutoPatch, legacyProdutoToEmbalagensRows } from '@/lib/produtoEmbalagensAdapter';
import { syncIsComercialOnAlternativas } from '@/components/produtos/massa/embalagensPlanilhaUtils';
import { cn } from '@/components/utils';
import { useCompactShell } from '@/hooks/use-breakpoint';
import { useBottomNavScrollVisibility } from '@/hooks/useBottomNavScrollVisibility';
import { formatProductCode, generateRandomProductCode } from '@/lib/productCode';

const P38_FORM_ROOT = 'flex flex-col h-full overflow-hidden font-din-1451 bg-background dark:bg-[#1f1d22]';
const P38_FORM_HEADER = 'flex-none border-b border-border/40 dark:border-white/10 bg-card dark:bg-[#2d333b]';
const P38_TAB_LIST = 'grid grid-cols-6 w-full bg-transparent border-b border-border/40 dark:border-white/10 rounded-none h-auto p-0 flex-shrink-0';
const P38_TAB_TRIGGER = 'group border-b-2 border-transparent data-[state=active]:border-[#4a5240] dark:data-[state=active]:border-[#a4ce33] data-[state=active]:bg-[#26262e]/35 dark:data-[state=active]:bg-[#26262e]/70 rounded-none py-3 text-xs md:text-sm';
const P38_TAB_ICON = 'w-4 h-4 md:w-5 md:h-5 text-muted-foreground group-data-[state=active]:text-[#4a5240] dark:group-data-[state=active]:text-[#a4ce33]';
const P38_TAB_LABEL = 'hidden sm:inline ml-2 text-muted-foreground group-data-[state=active]:text-foreground';
const P38_INPUT = 'bg-secondary/80 dark:bg-[#26262e] border-0 rounded-lg h-10 text-sm text-foreground shadow-none focus-visible:ring-1 focus-visible:ring-border/60';
const P38_INPUT_UNDERLINE = 'bg-transparent border-0 border-b border-border/40 dark:border-white/10 rounded-none px-0 h-9 text-sm text-foreground focus:border-[#4a5240] dark:focus:border-[#a4ce33]';
const P38_SECTION = 'rounded-lg border border-border/40 dark:border-white/10 bg-card/70 dark:bg-[#2d333b]/90 p-4';
const P38_SAVE_BTN = 'bg-[#4a5240] hover:bg-[#4a5240]/90 text-white dark:bg-[#a4ce33] dark:hover:bg-[#a4ce33]/90 dark:text-[#1f1d22] h-10 w-10';
/** Portal do Select fica no body; precisa ficar acima do shell do formulário (z-[70] / z-[80]). */
const P38_FORM_SELECT_CONTENT = 'z-[90] max-h-96 dark:bg-muted dark:border-border/40';

/** Id estável para linhas legadas sem `id` (evita novo UUID a cada render / reabrir formulário). */
function hashString(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return (h >>> 0).toString(36);
}

function syntheticAlternativaId(row) {
  const sig = normalizeSigla(row?.unidade) || '';
  const rot = String(row?.rotulo || '').trim();
  const nome = String(row?.nome || '').trim();
  const fator = String(Number(row?.fator_conversao) || '');
  const body = [sig, rot, nome, fator].join('\u0001');
  if (!body.replace(/\u0001/g, '')) {
    return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `alt-${Date.now().toString(36)}`;
  }
  return `alt-${hashString(body)}`;
}

export default function ProdutoFormCompleto({ produto, onSave, onClose, produtoSimilarBase }) {
  const normalizeAlternativas = (lista = []) => (Array.isArray(lista) ? lista : [])
    .slice(0, 5)
    .filter((u) => String(u?.unidade || '').trim())
    .map((u) => {
      const ajuste = Number(u?.ajuste_percentual) || 0;
      const fatorPreco = Number(u?.fator_preco) || 0;
      const siglaCanon = normalizeSigla(u?.unidade) || String(u?.unidade || '').trim().toUpperCase();
      const idExistente = String(u?.id || '').trim();
      return {
        ...u,
        id: idExistente || syntheticAlternativaId({ ...u, unidade: siglaCanon }),
        nome: typeof u?.nome === 'string' ? u.nome.trim() : '',
        unidade: siglaCanon,
        fator_conversao: Number(u?.fator_conversao) || 1,
        fator_preco: fatorPreco > 0 ? fatorPreco : (1 + (ajuste / 100)),
        is_comercial: u?.is_comercial === true,
        is_principal: u?.is_principal === true,
      };
    });

  const gerarNomeCompleto = (data) => {
    const campos = [data.campo_hierarquico_1, data.campo_hierarquico_2, data.campo_hierarquico_3, data.campo_hierarquico_4, data.campo_hierarquico_5];
    return campos.map(c => (c || '').trim()).filter(Boolean).join(' ').trim();
  };

  const buildFormDataFromProduto = (produtoData) => {
    const normalizedAlts = normalizeAlternativas(produtoData?.unidades_alternativas);
    const principalFinal = normalizeSigla(produtoData?.unidade_principal) || 'UN';

    /** Valor já persistido em `unidade_vitrine` (vazio = não usado para esta decisão). */
    const vitrineReadFromColumn = normalizeSigla(produtoData?.unidade_vitrine) || '';
    let vitrine = vitrineReadFromColumn;
    if (!vitrine) {
      vitrine =
        normalizeSigla(produtoData?.unidade_apresentacao_default || produtoData?.unidade_show_comercial) || '';
      if (!vitrine) {
        const cid = String(produtoData?.unidade_comercial_id ?? '').trim();
        if (cid && cid !== 'primary' && cid !== 'principal') {
          const row = normalizedAlts.find((u) => String(u?.id || '').trim() === cid);
          if (row?.unidade) vitrine = normalizeSigla(row.unidade);
        }
      }
      if (!vitrine) {
        const comercialFromJson = normalizedAlts.find((u) => u?.is_comercial === true);
        if (comercialFromJson?.unidade) vitrine = normalizeSigla(comercialFromJson.unidade);
      }
    }

    const validSet = new Set([
      principalFinal,
      ...normalizedAlts.map((u) => normalizeSigla(u?.unidade)).filter(Boolean),
    ]);
    // List/get por vezes omitem alternativas; não apagar `unidade_vitrine` gravada (ex.: import em massa).
    if (vitrine && !validSet.has(vitrine)) {
      if (!vitrineReadFromColumn) vitrine = '';
    }
    const vitrineStored = !vitrine || vitrine === principalFinal ? '' : vitrine;

    const altsComIsComercial = syncIsComercialOnAlternativas(normalizedAlts, vitrineStored, principalFinal);

    let exibicaoSigla = normalizeSigla(produtoData?.unidade_exibicao_sigla) || '';
    if (!exibicaoSigla && vitrineStored) {
      exibicaoSigla = vitrineStored;
    }
    if (exibicaoSigla && !validSet.has(exibicaoSigla)) {
      exibicaoSigla = '';
    }
    const exibicaoStored = !exibicaoSigla || exibicaoSigla === principalFinal ? '' : exibicaoSigla;

    return {
      ...produtoData,
      codigo_interno: formatProductCode(produtoData?.codigo_interno || ''),
      tags: Array.isArray(produtoData?.tags) ? produtoData.tags : [],
      unidades_alternativas: altsComIsComercial,
      tipo: produtoData?.tipo || 'Produto',
      valor_compra: produtoData?.valor_compra || 0,
      preco_venda_padrao: produtoData?.preco_venda_padrao || 0,
      preco_venda_tipo: produtoData?.preco_venda_tipo || 'percentual',
      preco_venda_percentual: produtoData?.preco_venda_percentual || 0,
      unidade_principal: principalFinal,
      unidade_vitrine: vitrineStored,
      unidade_exibicao_sigla: exibicaoStored,
      unidade_show_ativa: typeof produtoData?.unidade_show_ativa === 'boolean' ? produtoData.unidade_show_ativa : true,
      ativo: produtoData?.ativo !== false,
    };
  };

  const [formData, setFormData] = useState(produto ? {
    ...buildFormDataFromProduto(produto)
  } : {
    campo_hierarquico_1: '', campo_hierarquico_2: '', campo_hierarquico_3: '', campo_hierarquico_4: '', campo_hierarquico_5: '',
    nome: '', codigo_barras: '', codigo_interno: '', tipo: 'Produto',
    categoria_id: '', categoria_nome: '', marca: '', tags: [], valor_compra: 0, preco_venda_padrao: 0,
    preco_venda_tipo: 'percentual', preco_venda_percentual: 0, preco_custo_calculado: 0,
    unidade_principal: 'UN', unidade_vitrine: '', unidade_exibicao_sigla: '', unidade_show_ativa: true, unidades_por_pacote: 1, unidades_alternativas: [],
    estoque_atual: 0, estoque_minimo: 0, estoque_ideal: 0, estoque_maximo: 0, estoque_avariado: 0,
    tempo_reposicao_dias: 0, fornecedor_padrao_id: '', fornecedor_padrao_codigo: '',
    controla_serial: false, controla_lote: false, controla_validade: false, peso_kg: 0, dimensoes_cm: '', volume_cm3: 0, ativo: true
  });

  const [fornecedores, setFornecedores] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [produtosSimilares, setProdutosSimilares] = useState([]);
  const [similarSearch, setSimilarSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loadingMovimentacoes, setLoadingMovimentacoes] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('descritivo');
  const isMobile = useCompactShell();
  const historicoChromeExpanded = useBottomNavScrollVisibility(isMobile && abaAtiva === 'historico');
  const collapseHistoricoShell = isMobile && abaAtiva === 'historico';
  const [temAlteracoesNaoSalvas, setTemAlteracoesNaoSalvas] = useState(false);
  const { toast } = useToast();
  
  // Histórico de undo/redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [unitSelectorOpen, setUnitSelectorOpen] = useState(false);

  useUnsavedChangesWarning(temAlteracoesNaoSalvas);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      handleChange('imagem_url', file_url);
      toast({
        title: "Upload concluído",
        description: "Imagem carregada com sucesso.",
        className: "bg-green-100 text-green-800 border-green-200"
      });
    } catch (error) {
      console.error("Erro no upload:", error);
      toast({
        title: "Erro no upload",
        description: error.message || "Falha ao enviar imagem.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const loadDependencies = async () => {
    try {
      const [catsResponse, fornResponse, produtosResponse] = await Promise.all([
        base44.entities.Categoria.list(),
        base44.entities.Terceiro.filter({ tipo: 'Fornecedor' }),
        base44.entities.Produto.list('-updated_date')
      ]);
      setCategorias(catsResponse || []);
      setFornecedores(fornResponse || []);
      setProdutosSimilares((produtosResponse || []).filter(item => item?.id !== produto?.id));
    } catch (error) {
      console.error('Erro ao carregar dependências:', error);
    }
  };

  useEffect(() => {
    loadDependencies();
    if (produto?.id) {
      loadMovimentacoes();
    }
  }, [produto]);

  // ── Reset de formData a partir da prop `produto` ────────────────────────────
  // Mantemos `temAlteracoesNaoSalvas` em uma ref (e NAO no array de deps) para
  // que quando o save flipa o flag de volta pra `false` o efeito NAO dispare e
  // sobrescreva o estado fresco com a prop antiga (que o pai nao atualiza).
  // Esse reset legítimo só roda quando o produto editado realmente troca
  // (id ou updated_date diferentes vindos do servidor).
  const temAlteracoesRef = useRef(temAlteracoesNaoSalvas);
  useEffect(() => {
    temAlteracoesRef.current = temAlteracoesNaoSalvas;
  }, [temAlteracoesNaoSalvas]);

  useEffect(() => {
    if (!produto?.id || temAlteracoesRef.current) return;
    setFormData(buildFormDataFromProduto(produto));
  }, [produto?.id, produto?.updated_date]);

  // Hidratação opcional a partir da entidade auxiliar `ProdutoEmbalagem` (flag).
  useEffect(() => {
    if (!isProdutoEmbalagemEntityFlagOn() || !produto?.id || temAlteracoesRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchEmbalagensByProdutoId(base44, produto.id);
        if (cancelled || temAlteracoesRef.current) return;
        if (!rows.length) return;
        const patch = embalagensRowsToLegacyProdutoPatch(rows);
        if (!Object.keys(patch).length) return;
        setFormData(buildFormDataFromProduto({ ...produto, ...patch }));
      } catch (e) {
        if (import.meta.env?.DEV) {
          console.warn('[ProdutoFormCompleto] embalagens (entidade) hydrate no-op:', e?.message || e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [produto?.id, produto?.updated_date]);

  const loadMovimentacoes = async () => {
    if (!produto?.id) return;
    
    setLoadingMovimentacoes(true);
    try {
      const movs = await base44.entities.MovimentacaoEstoque.filter({ produto_id: produto.id });
      setMovimentacoes(movs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    } catch (error) {
      console.error('Erro ao carregar movimentações:', error);
    } finally {
      setLoadingMovimentacoes(false);
    }
  };

  useEffect(() => {
    if (formData.dimensoes_cm) {
      const parts = formData.dimensoes_cm.split('x').map(p => parseFloat(p.trim()));
      if (parts.length === 3 && parts.every(p => !isNaN(p) && p > 0)) {
        setFormData(prev => ({ ...prev, volume_cm3: parts[0] * parts[1] * parts[2] }));
      }
    }
  }, [formData.dimensoes_cm]);

  // Custo calculado direto dos campos do produto
  const custoBase = parseFloat(formData.valor_compra) || 0;
  const precoCustoCalculado =
    custoBase +
    (parseFloat(formData.custo_frete_padrao) || 0) +
    (parseFloat(formData.custo_imposto1_padrao) || 0) +
    (parseFloat(formData.custo_imposto2_padrao) || 0) +
    (parseFloat(formData.custo_outros_padrao) || 0) -
    (parseFloat(formData.desconto_compra_padrao) || 0);

  const precoVendaCalculado = formData.preco_venda_tipo === 'numerico'
    ? (parseFloat(formData.preco_venda_padrao) || 0)
    : precoCustoCalculado * (1 + (parseFloat(formData.preco_venda_percentual) || 0) / 100);

  const snapshotPrecificacao = useMemo(
    () => buildProductSnapshotForPricing(formData, precoVendaCalculado),
    [
      formData.unidade_principal,
      formData.unidades_alternativas,
      formData.unidade_exibicao_sigla,
      precoVendaCalculado,
    ],
  );

  const precoCatalogo = useMemo(
    () => getPrecoVendaNaUnidadeCatalogo(snapshotPrecificacao, 1),
    [snapshotPrecificacao],
  );

  const custoCatalogoScale = useMemo(
    () => custoDisplayScale(snapshotPrecificacao),
    [snapshotPrecificacao],
  );

  const precoCustoCatalogo = precoCustoCalculado * custoCatalogoScale;

  const margemContribuicao = useMemo(() => {
    const venda = precoCatalogo.valor;
    const custo = precoCustoCatalogo;
    return custo > 0 && venda > 0 ? ((venda - custo) / venda) * 100 : 0;
  }, [precoCatalogo.valor, precoCustoCatalogo]);

  const markupCatalogo = useMemo(() => {
    const venda = precoCatalogo.valor;
    const custo = precoCustoCatalogo;
    return custo > 0 ? ((venda - custo) / custo) * 100 : 0;
  }, [precoCatalogo.valor, precoCustoCatalogo]);

  const vendasUnitOptions = useMemo(
    () => buildSaleUnitOptions(snapshotPrecificacao, 1),
    [snapshotPrecificacao],
  );

  const productForUnitDialog = useMemo(
    () => ({
      ...snapshotPrecificacao,
      nome: formData.nome || 'Produto',
    }),
    [snapshotPrecificacao, formData.nome],
  );

  const saveToHistory = (newData) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newData);
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  };

  /** Atualiza `unidade_vitrine` (vazio = vitrine na base) e espelha `is_comercial` no JSON de embalagens. */
  const applyCommercialUnitSelection = (siglaOuRotuloRaw) => {
    setFormData((prev) => {
      const principal = normalizeSigla(prev.unidade_principal || 'UN') || 'UN';
      const alts = normalizeAlternativas(prev.unidades_alternativas || []);
      const validSet = new Set([principal, ...alts.map((a) => normalizeSigla(a.unidade)).filter(Boolean)]);

      const resolverUnidadeValida = (valor) => {
        const normalizado = normalizeSigla(valor) || String(valor || '').trim().toUpperCase();
        if (!normalizado) return '';
        if (validSet.has(normalizado)) return normalizado;
        const valorRotulo = String(valor || '').trim().toUpperCase();
        const porRotulo = alts.find((u) => u.rotulo && String(u.rotulo).trim().toUpperCase() === valorRotulo);
        return normalizeSigla(porRotulo?.unidade) || '';
      };

      let siglaFinal = resolverUnidadeValida(siglaOuRotuloRaw);
      if (!siglaFinal) {
        const prevSigla = normalizeSigla(prev.unidade_vitrine) || principal;
        if (prevSigla && validSet.has(prevSigla)) return prev;
        siglaFinal = principal;
      }

      const vitrineStored = siglaFinal === principal ? '' : siglaFinal;
      const altsAtualizadas = alts.map((u) => ({
        ...u,
        is_comercial: vitrineStored !== '' && normalizeSigla(u.unidade) === siglaFinal,
      }));

      const updated = {
        ...prev,
        unidade_vitrine: vitrineStored,
        unidades_alternativas: altsAtualizadas,
      };
      saveToHistory(prev);
      return updated;
    });
    setTemAlteracoesNaoSalvas(true);
  };

  const aplicarPrecoVendaCatalogo = (val) => {
    const snap = buildProductSnapshotForPricing(formData, precoVendaCalculado);
    const conv = precoVendaPadraoFromPrecoCatalogo(val, snap, 1);
    if (conv && typeof conv === 'object' && conv.kind === 'fixed_packaging') {
      setFormData((prev) => {
        const raw = [...(prev.unidades_alternativas || [])];
        const ix = raw.findIndex((r) => normalizeSigla(r.unidade) === normalizeSigla(conv.sigla));
        if (ix < 0) return prev;
        const next = [...raw];
        next[ix] = { ...next[ix], preco_venda: conv.preco_venda };
        saveToHistory(prev);
        return {
          ...prev,
          unidades_alternativas: next,
          preco_venda_tipo: 'numerico',
        };
      });
      setTemAlteracoesNaoSalvas(true);
      return;
    }
    const novoBase = typeof conv === 'number' ? conv : precoVendaCalculado;
    setFormData((prev) => {
      saveToHistory(prev);
      const custoBaseLoc = parseFloat(prev.valor_compra) || 0;
      const precoCustoLoc =
        custoBaseLoc +
        (parseFloat(prev.custo_frete_padrao) || 0) +
        (parseFloat(prev.custo_imposto1_padrao) || 0) +
        (parseFloat(prev.custo_imposto2_padrao) || 0) +
        (parseFloat(prev.custo_outros_padrao) || 0) -
        (parseFloat(prev.desconto_compra_padrao) || 0);
      let markup = prev.preco_venda_percentual;
      if (precoCustoLoc > 0) {
        markup = ((novoBase - precoCustoLoc) / precoCustoLoc) * 100;
      }
      return {
        ...prev,
        preco_venda_padrao: novoBase,
        preco_venda_tipo: 'numerico',
        preco_venda_percentual: markup,
      };
    });
    setTemAlteracoesNaoSalvas(true);
  };

  const aplicarUnidadeCatalogoDesdeOpcao = (option) => {
    if (!option) return;
    setFormData((prev) => {
      saveToHistory(prev);
      const nextSigla = option.is_primary ? '' : normalizeSigla(option.unidade) || '';
      return { ...prev, unidade_exibicao_sigla: nextSigla };
    });
    setTemAlteracoesNaoSalvas(true);
  };

  const handleChange = (field, value) => {
    if (field === 'unidade_vitrine') {
      applyCommercialUnitSelection(value);
      return;
    }
    if (field === 'unidade_exibicao_sigla') {
      setFormData((prev) => {
        saveToHistory(prev);
        return { ...prev, unidade_exibicao_sigla: normalizeSigla(value) || '' };
      });
      setTemAlteracoesNaoSalvas(true);
      return;
    }
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'unidade_principal') {
        updated.unidade_principal = normalizeSigla(value) || String(value || '').trim().toUpperCase() || 'UN';
      }
      // Auto-gerar nome ao mudar qualquer campo hierárquico
      if (field.startsWith('campo_hierarquico_')) {
        updated.nome = gerarNomeCompleto(updated);
      }
      saveToHistory(prev);
      return updated;
    });
    setTemAlteracoesNaoSalvas(true);
  };

  const unitOptions = useMemo(() => {
    const principal = normalizeSigla(formData.unidade_principal || 'UN') || 'UN';
    const alternativas = normalizeAlternativas(formData.unidades_alternativas || [])
      .map((u) => normalizeSigla(u?.unidade) || '')
      .filter(Boolean);
    return [principal, ...alternativas.filter((u) => u !== principal)];
  }, [formData.unidade_principal, formData.unidades_alternativas]);

  /** Sigla exibida no select: `unidade_vitrine` vazio → unidade base. */
  const comercialSelectValue = useMemo(() => {
    const principal = normalizeSigla(formData.unidade_principal || 'UN') || 'UN';
    return normalizeSigla(formData.unidade_vitrine) || principal;
  }, [formData.unidade_principal, formData.unidade_vitrine]);

  const commercialUnitIdForEditor = useMemo(() => {
    const principal = normalizeSigla(formData.unidade_principal || 'UN') || 'UN';
    const vitrine = normalizeSigla(formData.unidade_vitrine) || principal;
    if (vitrine === principal) return 'primary';
    const row = normalizeAlternativas(formData.unidades_alternativas || []).find(
      (u) => normalizeSigla(u?.unidade) === vitrine,
    );
    return row?.id ? String(row.id).trim() : 'primary';
  }, [formData.unidade_principal, formData.unidade_vitrine, formData.unidades_alternativas]);

  /** Inclui sigla atual se ainda não estiver na lista (ex.: referência órfã / transição). */
  const commercialSelectOptions = useMemo(() => {
    const base = [...unitOptions];
    if (comercialSelectValue && !base.includes(comercialSelectValue)) base.push(comercialSelectValue);
    return base;
  }, [unitOptions, comercialSelectValue]);

  /** Vitrine na unidade base (interruptor ao lado da sigla principal). */
  const catalogoNaBase = useMemo(() => {
    const principal = normalizeSigla(formData.unidade_principal || 'UN') || 'UN';
    const vitrine = normalizeSigla(formData.unidade_vitrine) || '';
    return !vitrine || vitrine === principal || comercialSelectValue === principal;
  }, [formData.unidade_principal, formData.unidade_vitrine, comercialSelectValue]);

  /** Dados do servidor (prop) divergem entre colunas e JSON — só informativo ao abrir. */
  const vitrineHydrateWarning = useMemo(() => {
    if (!produto?.id) return '';
    const principal = normalizeSigla(produto.unidade_principal) || 'UN';
    const rawVitrine = normalizeSigla(produto.unidade_vitrine) || '';
    const rawLegacy = normalizeSigla(produto.unidade_apresentacao_default || produto.unidade_show_comercial);
    const alts = normalizeAlternativas(produto.unidades_alternativas);
    const jsonCom = alts.find((u) => u?.is_comercial === true);
    const jsonSigla = jsonCom ? normalizeSigla(jsonCom.unidade) : '';

    if (jsonSigla && jsonSigla !== principal && !rawVitrine && rawLegacy === principal) {
      return `No cadastro gravado, o JSON marca «${jsonSigla}» como vitrine, mas «unidade_vitrine» está vazio (base ${principal}). Escolha a vitrine e salve para alinhar.`;
    }
    if (rawVitrine && !alts.some((u) => normalizeSigla(u?.unidade) === rawVitrine) && rawVitrine !== principal) {
      return `A sigla «${rawVitrine}» em unidade_vitrine não existe nas embalagens ativas. Escolha de novo e salve.`;
    }
    return '';
  }, [produto?.id, produto?.unidade_principal, produto?.unidade_vitrine, produto?.unidade_apresentacao_default, produto?.unidades_alternativas]);

  /** `resolveUnidadeExibicao` cairia na base apesar da escolha explícita no form — não esconder fallback. */
  const vitrineResolveFallbackWarning = useMemo(() => {
    if (formData.unidade_show_ativa === false) return '';
    const principal = normalizeSigla(formData.unidade_principal || 'UN') || 'UN';
    const rows = normalizeAlternativas(formData.unidades_alternativas || []);
    const explicitSigla = normalizeSigla(formData.unidade_vitrine) || '';
    const snapshot = {
      unidade_principal: formData.unidade_principal,
      unidades_alternativas: rows.map((u) => ({ ...u, ativo: u.ativo !== false })),
      unidade_vitrine: formData.unidade_vitrine,
      unidade_show_ativa: formData.unidade_show_ativa,
    };
    const resolved = resolveUnidadeExibicao(snapshot, principal).sigla;

    if (explicitSigla && explicitSigla !== principal && resolved === principal) {
      return `Com os dados atuais, listagens cairiam na base (${principal}), não em «${explicitSigla}» que você escolheu. Confira se a sigla existe nas embalagens ativas e salve.`;
    }
    return '';
  }, [
    formData.unidade_principal,
    formData.unidades_alternativas,
    formData.unidade_vitrine,
    formData.unidade_show_ativa,
  ]);

  const commercialSelectWarning = useMemo(() => {
    if (comercialSelectValue && !unitOptions.includes(comercialSelectValue)) {
      return `A sigla “${comercialSelectValue}” não está nas embalagens com sigla preenchida. Confira “Outras embalagens” ou escolha outra opção.`;
    }
    return '';
  }, [comercialSelectValue, unitOptions]);

  /** Só id/sigla/rótulo: evita re-disparar o efeito de correção a cada mudança de fator/preço (combativo com o editor). */
  const unidadesAlternativasLayoutKey = useMemo(
    () =>
      (formData.unidades_alternativas || [])
        .map((u) =>
          [
            String(u?.id || '').trim(),
            normalizeSigla(u?.unidade) || String(u?.unidade || '').trim().toUpperCase(),
            String(u?.rotulo || '').trim().toUpperCase(),
          ].join(':'),
        )
        .join('|'),
    [formData.unidades_alternativas],
  );

  /** Corrige só inconsistências reais (sigla inválida, id órfão, mudança de base/alternativas) — não substitui escolha válida por “primeira linha com a mesma sigla”. */
  useEffect(() => {
    setFormData((prev) => {
      const principal = normalizeSigla(prev.unidade_principal || 'UN') || 'UN';
      const rawAlts = Array.isArray(prev.unidades_alternativas) ? prev.unidades_alternativas : [];
      const alternativasNormalizadas = normalizeAlternativas(rawAlts);
      const meta = alternativasNormalizadas
        .map((u) => ({
          id: String(u?.id || '').trim(),
          unidade: normalizeSigla(u?.unidade) || '',
          rotulo: String(u?.rotulo || '').trim().toUpperCase(),
        }))
        .filter((u) => u.unidade);

      const validSet = new Set([principal, ...meta.map((u) => u.unidade)]);

      const resolverUnidadeValida = (valor) => {
        const normalizado = normalizeSigla(valor) || String(valor || '').trim().toUpperCase();
        if (!normalizado) return '';
        if (validSet.has(normalizado)) return normalizado;
        const valorRotulo = String(valor || '').trim().toUpperCase();
        const porRotulo = meta.find((x) => x.rotulo && x.rotulo === valorRotulo);
        return porRotulo?.unidade || '';
      };

      const fromVitrine = normalizeSigla(prev.unidade_vitrine) || '';
      let vitrineValida = resolverUnidadeValida(fromVitrine);
      if (!vitrineValida && fromVitrine) return prev;
      if (!vitrineValida) vitrineValida = principal;
      if (!validSet.has(vitrineValida)) vitrineValida = principal;

      const vitrineStored = vitrineValida === principal ? '' : vitrineValida;

      if (normalizeSigla(prev.unidade_vitrine) === vitrineStored || (!prev.unidade_vitrine && !vitrineStored)) {
        return prev;
      }

      return {
        ...prev,
        unidade_vitrine: vitrineStored,
      };
    });
  }, [formData.unidade_principal, unidadesAlternativasLayoutKey]);

  useEffect(() => {
    setFormData((prev) => {
      const principal = normalizeSigla(prev.unidade_principal || 'UN') || 'UN';
      const alternativas = normalizeAlternativas(prev.unidades_alternativas || [])
        .map((u) => normalizeSigla(u?.unidade))
        .filter(Boolean);
      const validSet = new Set([principal, ...alternativas]);
      const exib = normalizeSigla(prev.unidade_exibicao_sigla);
      const exibValida = exib && validSet.has(exib) && exib !== principal ? exib : '';
      if (prev.unidade_exibicao_sigla === exibValida) return prev;
      return { ...prev, unidade_exibicao_sigla: exibValida };
    });
  }, [formData.unidade_principal, formData.unidades_alternativas, formData.unidade_exibicao_sigla]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const previousState = history[historyIndex - 1];
      setHistoryIndex(prev => prev - 1);
      if (previousState.formData) {
        setFormData(previousState.formData);
      } else {
        setFormData(previousState);
      }
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setHistoryIndex(prev => prev + 1);
      if (nextState.formData) {
        setFormData(nextState.formData);
      } else {
        setFormData(nextState);
      }
    }
  };

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey && e.key === 'y') || e.key === 'F4') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  const handleAddTag = () => {
    const currentTags = Array.isArray(formData.tags) ? formData.tags : [];
    if (tagInput.trim() && !currentTags.includes(tagInput.trim())) {
      setFormData(prev => ({ ...prev, tags: [...currentTags, tagInput.trim()] }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag) => {
    setFormData(prev => ({ 
      ...prev, 
      tags: Array.isArray(prev.tags) ? prev.tags.filter(t => t !== tag) : [] 
    }));
  };

  const applyProdutoSimilar = (produtoBase) => {
    if (!produtoBase) return;

    const patch = {
      ...produtoBase,
      id: undefined,
      codigo_interno: '',
      codigo_barras: '',
      created_date: undefined,
      updated_date: undefined,
      created_by: undefined,
      estoque_atual: 0,
      nome: produtoBase.nome || '',
      tags: Array.isArray(produtoBase.tags) ? produtoBase.tags : [],
    };

    setFormData(buildFormDataFromProduto(patch));
    setSimilarSearch(produtoBase.nome || '');
    setTemAlteracoesNaoSalvas(true);
    toast({
      title: 'Produto similar aplicado',
      description: 'Agora ajuste descrição, modelo, cor, tamanho e demais campos.',
      className: 'bg-card border border-border/40 dark:bg-muted dark:text-foreground',
    });
  };

  useEffect(() => {
    if (!produto?.id && produtoSimilarBase?.id) {
      applyProdutoSimilar(produtoSimilarBase);
    }
  }, [produtoSimilarBase?.id]);

  const produtosSimilaresFiltrados = useMemo(() => {
    const query = similarSearch.trim().toLowerCase();
    const base = [...produtosSimilares].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    if (!query) return base.slice(0, 8);
    return base.filter(item => (item.nome || '').toLowerCase().includes(query)).slice(0, 8);
  }, [produtosSimilares, similarSearch]);

  const toastSaveBlocked = (title, description) => {
    toast({
      variant: 'destructive',
      title,
      description,
      duration: 8000,
    });
  };

  const describeSaveError = (error) => {
    if (error == null) return 'Erro desconhecido ao salvar. Tente novamente.';
    if (typeof error === 'string' && error.trim()) return error.trim();
    const msg = error?.message;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
    return 'Erro desconhecido ao salvar. Tente novamente ou verifique sua conexão.';
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let codigoInterno = formData.codigo_interno;
      if (!produto?.id && !codigoInterno) {
        try {
          const todosProdutos = await base44.entities.Produto.list();
          codigoInterno = generateRandomProductCode((todosProdutos || []).map((p) => p.codigo_interno));
        } catch (listErr) {
          console.error('[ProdutoFormCompleto] Falha ao listar produtos para código interno:', listErr);
          toastSaveBlocked(
            'Não foi possível gerar o código interno',
            describeSaveError(listErr) + ' Verifique a conexão e tente de novo.',
          );
          return;
        }
      }

      const categoria = categorias.find(c => c.id === formData.categoria_id);
      const nomeNormalizado = (formData.nome || '').trim().toUpperCase();
      const produtoOriginalId = produto?.id || null;
      const produtoDuplicado = produtosSimilares.find(item => item.id !== produtoOriginalId && (item.nome || '').trim().toUpperCase() === nomeNormalizado);

      if (produtoDuplicado) {
        toastSaveBlocked(
          'Descrição já cadastrada',
          'Já existe um produto com a mesma descrição. Ajuste modelo, cor, tamanho ou outro campo hierárquico antes de salvar.',
        );
        return;
      }

      // Monta o array canonico `unidades[]` a partir do estado do form e valida
      // invariantes via productUnitsCrud (unica via legitima de mutacao).
      const unidadePrincipalSigla = normalizeSigla(formData.unidade_principal || 'UN') || 'UN';
      const alternativasNormalizadas = normalizeAlternativas(formData.unidades_alternativas || []);
      const alternativasMeta = alternativasNormalizadas
        .map((u) => ({
          id: String(u?.id || '').trim(),
          unidade: normalizeSigla(u?.unidade) || '',
          rotulo: String(u?.rotulo || '').trim().toUpperCase(),
        }))
        .filter((u) => u.unidade);
      const validSiglaSet = new Set([unidadePrincipalSigla, ...alternativasMeta.map((u) => u.unidade)]);
      const resolverComercialPreferencia = (valor) => {
        const normalizado = normalizeSigla(valor) || String(valor || '').trim().toUpperCase();
        if (normalizado && validSiglaSet.has(normalizado)) return normalizado;
        const valorRotulo = String(valor || '').trim().toUpperCase();
        const porRotulo = alternativasMeta.find((u) => u.rotulo && u.rotulo === valorRotulo);
        if (porRotulo?.unidade && validSiglaSet.has(porRotulo.unidade)) return porRotulo.unidade;
        return '';
      };
      const comercialPreferenciaSiglaRaw =
        normalizeSigla(formData.unidade_vitrine) ||
        unidadePrincipalSigla;
      const comercialPreferenciaSigla =
        resolverComercialPreferencia(comercialPreferenciaSiglaRaw) || unidadePrincipalSigla;
      const exibicaoPreferenciaRaw = normalizeSigla(formData.unidade_exibicao_sigla) || '';
      const exibicaoPreferenciaSigla =
        exibicaoPreferenciaRaw && validSiglaSet.has(exibicaoPreferenciaRaw) && exibicaoPreferenciaRaw !== unidadePrincipalSigla
          ? exibicaoPreferenciaRaw
          : '';
      const comercialIdPreferencia = commercialUnitIdForEditor;

      const principalCanonical = makeUnidade({
        id: 'principal',
        nome: 'Unidade base',
        sigla: unidadePrincipalSigla,
        fator_conversao: 1,
        fator_preco: 1,
        is_principal: true,
        is_comercial: false,
        ativo: true,
      });

      const alternativasCanonical = alternativasNormalizadas.map((u) => {
        const payload = {
          id: u.id,
          nome: u.nome || u.rotulo || u.unidade,
          sigla: u.unidade,
          fator_conversao: Number(u.fator_conversao) || 1,
          fator_preco: Number(u.fator_preco) || 1,
          ajuste_percentual: Number(u.ajuste_percentual) || 0,
          preco_venda: Number(u.preco_venda) || 0,
          is_principal: false,
          is_comercial: false,
          ativo: u.ativo !== false,
        };
        if (
          Object.prototype.hasOwnProperty.call(u, "percentual_preco_vs_principal") &&
          u.percentual_preco_vs_principal != null &&
          u.percentual_preco_vs_principal !== ""
        ) {
          payload.percentual_preco_vs_principal = Number(u.percentual_preco_vs_principal) || 0;
        }
        return makeUnidade(payload);
      });

      const unidadesCanonical = [principalCanonical, ...alternativasCanonical];

      let comercialAplicado = false;
      if (comercialIdPreferencia === 'primary' || comercialIdPreferencia === 'principal') {
        unidadesCanonical[0].is_comercial = true;
        comercialAplicado = true;
      } else if (comercialIdPreferencia) {
        const byId = unidadesCanonical.find((u) => u.id === comercialIdPreferencia);
        if (byId) { byId.is_comercial = true; comercialAplicado = true; }
      }
      if (!comercialAplicado) {
        const bySigla = unidadesCanonical.find((u) => normalizeSigla(u.sigla) === comercialPreferenciaSigla);
        if (bySigla) { bySigla.is_comercial = true; comercialAplicado = true; }
      }
      if (!comercialAplicado && comercialPreferenciaSigla && comercialPreferenciaSigla !== unidadePrincipalSigla) {
        toastSaveBlocked(
          'Unidade de vitrine não reconhecida',
          'A unidade de vitrine precisa ser a sigla da base (UN, M2, KG…) ou de uma linha ativa em "Outras embalagens". Inclua a sigla correspondente, confira se a linha não está inativa ou use o mesmo rótulo cadastrado na alternativa.',
        );
        return;
      }
      if (!comercialAplicado) unidadesCanonical[0].is_comercial = true;

      const applied = applyUnidadesToProduto({}, unidadesCanonical);
      if (!applied.ok) {
        toastSaveBlocked(
          'Validação de unidades',
          (applied.errors || []).filter(Boolean).join(' · ') || 'Revise unidades base, alternativas e vitrine antes de salvar.',
        );
        return;
      }

      const produtoData = {
        ...formData,
        codigo_interno: formatProductCode(codigoInterno),
        nome: formData.nome?.toUpperCase(),
        marca: formData.marca?.toUpperCase(),
        categoria_nome: categoria?.nome?.toUpperCase() || '',
        fornecedor_padrao_codigo: formData.fornecedor_padrao_codigo?.toUpperCase(),
        unidades: applied.produto.unidades,
        unidade_principal: applied.produto.unidade_principal,
        unidade_vitrine: applied.produto.unidade_vitrine,
        unidade_exibicao_sigla: exibicaoPreferenciaSigla,
        unidades_alternativas: applied.produto.unidades_alternativas,
        unidade_show_ativa: formData.unidade_show_ativa !== false,
        preco_custo_calculado: precoCustoCalculado,
        preco_venda_padrao: precoVendaCalculado,
        valor_compra: custoBase,
        preco_venda_tipo: formData.preco_venda_tipo,
        custo_frete_padrao: parseFloat(formData.custo_frete_padrao) || 0,
        custo_imposto1_padrao: parseFloat(formData.custo_imposto1_padrao) || 0,
        custo_imposto2_padrao: parseFloat(formData.custo_imposto2_padrao) || 0,
        custo_outros_padrao: parseFloat(formData.custo_outros_padrao) || 0,
        desconto_compra_padrao: parseFloat(formData.desconto_compra_padrao) || 0,
      };

      let savedPayload = produtoData;
      let produtoId = produto?.id;
      if (import.meta.env?.DEV) {
        console.debug('[ProdutoFormCompleto] enviando ao backend:', {
          id: produtoId,
          unidade_principal: produtoData.unidade_principal,
          unidade_vitrine: produtoData.unidade_vitrine,
          unidades_alternativas: produtoData.unidades_alternativas,
          unidades: produtoData.unidades,
        });
      }
      try {
        if (produtoId) {
          await base44.entities.Produto.update(produtoId, produtoData);
        } else {
          const novoProduto = await base44.entities.Produto.create(produtoData);
          produtoId = novoProduto?.id;
          if (!produtoId) {
            toastSaveBlocked(
              'Resposta inválida do servidor',
              'O cadastro não devolveu o id do novo produto. Atualize a lista e confira se o item foi criado.',
            );
            return;
          }
        }
      } catch (apiErr) {
        console.error('[ProdutoFormCompleto] Falha create/update Produto:', apiErr);
        toastSaveBlocked(
          'Falha ao gravar no servidor',
          describeSaveError(apiErr),
        );
        return;
      }

      if (isProdutoEmbalagemEntityFlagOn() && produtoId) {
        try {
          const embRows = legacyProdutoToEmbalagensRows({ ...produtoData, id: produtoId });
          const rep = await replaceEmbalagensForProduto(base44, produtoId, embRows);
          if (rep.ok && !rep.skipped) {
            await patchProdutoUnidadesFromEmbalagensRows(base44, produtoId, embalagensRowsToLegacyProdutoPatch);
            const freshRows = await fetchEmbalagensByProdutoId(base44, produtoId);
            const entPatch = embalagensRowsToLegacyProdutoPatch(freshRows);
            if (Object.keys(entPatch).length) {
              savedPayload = { ...produtoData, ...entPatch };
            }
          }
        } catch (embErr) {
          if (import.meta.env?.DEV) {
            console.warn('[ProdutoFormCompleto] ProdutoEmbalagem save no-op:', embErr?.message || embErr);
          }
        }
      }

      // Reidrata `formData` IMEDIATAMENTE a partir do payload que acabamos de
      // enviar (verdade canonica). Isso elimina dependencia de cache / leitura
      // staleness do backend e garante feedback visual instantaneo do que foi
      // pra rede.
      setFormData(buildFormDataFromProduto({ ...savedPayload, id: produtoId }));

      // Verificacao adicional: re-le do banco e checa drift contra o payload.
      // Se o backend rejeitou ou transformou algum campo, isso aparece no log
      // ao inves de silenciosamente revertir o form.
      try {
        if (produtoId) {
          const fresh = await base44.entities.Produto.get(produtoId);
          if (fresh) {
            if (import.meta.env?.DEV) {
              console.debug('[ProdutoFormCompleto] GET pós-save — vitrine (servidor):', {
                unidade_vitrine: fresh.unidade_vitrine,
                unidade_principal: fresh.unidade_principal,
                unidade_show_ativa: fresh.unidade_show_ativa,
              });
            }
            const driftSigKeys = ['unidade_vitrine', 'unidade_principal', 'unidade_exibicao_sigla'];
            const UNIT_SNAPSHOT_KEYS = [
              'unidades',
              'unidade_principal',
              'unidades_alternativas',
              'unidade_vitrine',
              'unidade_exibicao_sigla',
              'unidade_show_ativa',
            ];
            const drift = driftSigKeys.filter(
              (k) => normalizeSigla(fresh[k]) !== normalizeSigla(savedPayload[k]),
            );
            if (drift.length > 0) {
              console.warn('[ProdutoFormCompleto] DRIFT pos-save (backend nao gravou ou transformou):', {
                drift,
                enviado: {
                  unidade_vitrine: savedPayload.unidade_vitrine,
                  unidade_exibicao_sigla: savedPayload.unidade_exibicao_sigla,
                  unidade_principal: savedPayload.unidade_principal,
                },
                persistido: {
                  unidade_vitrine: fresh.unidade_vitrine,
                  unidade_exibicao_sigla: fresh.unidade_exibicao_sigla,
                  unidade_principal: fresh.unidade_principal,
                },
              });
              toast({
                title: 'Embalagens: resposta diferente do enviado',
                description:
                  'O servidor devolveu outra combinação de unidade de vitrine. A tela mantém o pacote que você acabou de gravar; confira o cadastro no painel se isto se repetir.',
                duration: 9000,
                className: 'bg-amber-50 text-amber-950 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-50 dark:border-amber-800',
              });
            } else if (import.meta.env?.DEV) {
              console.debug('[ProdutoFormCompleto] persistido OK', {
                unidade_vitrine: fresh.unidade_vitrine,
                unidade_principal: fresh.unidade_principal,
              });
            }
            // Base44 pode omitir ou atrasar campos espelho no GET; mesclar o pacote enviado evita regressão visual.
            const unitOverlay = UNIT_SNAPSHOT_KEYS.reduce((acc, key) => {
              if (savedPayload[key] !== undefined) acc[key] = savedPayload[key];
              return acc;
            }, {});
            setFormData(buildFormDataFromProduto({ ...fresh, ...unitOverlay }));
          }
        }
      } catch (refetchErr) {
        console.warn('Re-fetch pos-save falhou (mantendo estado canonico):', refetchErr?.message || refetchErr);
      }

      toast({
        title: "✓ Produto salvo!",
        description: `${formData.nome} foi ${produto?.id ? 'atualizado' : 'criado'} com sucesso.`,
        className: "bg-card border border-border/40 dark:bg-muted dark:text-foreground",
        duration: 3000
      });

      setTemAlteracoesNaoSalvas(false);
      const unitSnapshot = produtoId
        ? {
            id: produtoId,
            unidade_vitrine: savedPayload.unidade_vitrine,
            unidade_show_ativa: savedPayload.unidade_show_ativa,
            unidades: savedPayload.unidades,
            unidades_alternativas: savedPayload.unidades_alternativas,
            unidade_principal: savedPayload.unidade_principal,
          }
        : null;
      await Promise.resolve(onSave?.(unitSnapshot));
      if (produtoId) loadMovimentacoes();
      // onClose(); // Mantendo aberto para feedback
    } catch (error) {
      console.error('[ProdutoFormCompleto] Erro inesperado no salvamento:', error);
      toastSaveBlocked('Não foi possível salvar', describeSaveError(error));
    } finally {
      setIsSaving(false);
    }
  };

  const formatarNumero = (numero) => {
    if (numero === null || numero === undefined || isNaN(numero)) return '0,00';
    const rounded = Math.round(numero * 100) / 100;
    return rounded.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const catalogUnitsPreview = useMemo(() => {
    const snapshot = {
      unidade_principal: formData.unidade_principal,
      unidades_alternativas: (formData.unidades_alternativas || []).map((u) => ({ ...u, ativo: u.ativo !== false })),
      unidade_vitrine: formData.unidade_vitrine,
      unidade_show_ativa: formData.unidade_show_ativa,
      estoque_atual: formData.estoque_atual,
    };
    const base = resolvePrimaryFromFactorOne(snapshot, formData.unidade_principal || 'UN');
    const comercial = resolveUnidadeExibicao(snapshot, base).sigla;
    const estoqueBase = Number(formData.estoque_atual) || 0;
    const display = resolveCommercialDisplay(snapshot, estoqueBase, base);
    return { base, comercial, display };
  }, [
    formData.unidade_principal,
    formData.unidades_alternativas,
    formData.unidade_vitrine,
    formData.unidade_show_ativa,
    formData.estoque_atual,
  ]);

  return (
    <div className={P38_FORM_ROOT}>
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div
          className={cn(
            'flex-none overflow-hidden transition-[max-height,opacity] duration-300 ease-out',
            'desktop-layout:max-h-none desktop-layout:opacity-100',
            collapseHistoricoShell && (historicoChromeExpanded ? 'max-h-[22rem] opacity-100' : 'max-h-0 opacity-0')
          )}
          aria-hidden={collapseHistoricoShell && !historicoChromeExpanded}
        >
          {/* Header */}
          <div className={P38_FORM_HEADER}>
            <div className="p-4 md:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg md:text-xl font-medium text-foreground truncate">
                    {produto?.id ? 'Editar:' : 'Novo Produto'}
                  </h2>
                  <p className="text-xs md:text-sm text-muted-foreground mt-1 truncate">
                    {formData.nome || 'Sem nome'}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {produto?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleChange('ativo', !formData.ativo)}
                      disabled={isSaving}
                      className={`h-10 w-10 ${formData.ativo ? 'text-red-500' : 'text-green-500'}`}
                      title={formData.ativo ? 'Inativar produto' : 'Reativar produto'}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleUndo}
                    disabled={isSaving || historyIndex <= 0}
                    className="h-10 w-10"
                    title="Desfazer (Ctrl+Z)"
                  >
                    <Undo2 className="w-5 h-5 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRedo}
                    disabled={isSaving || historyIndex >= history.length - 1}
                    className="h-10 w-10"
                    title="Refazer (Ctrl+Y / F4)"
                  >
                    <Redo2 className="w-5 h-5 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={onClose} disabled={isSaving} className="h-10 w-10">
                    <X className="w-5 h-5 text-muted-foreground" />
                  </Button>
                  <Button size="icon" onClick={handleSave} disabled={isSaving} className={P38_SAVE_BTN}>
                    <Save className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {vendasUnitOptions.length > 0 && (
            <div
              className="flex-none border-b border-border/40 dark:border-white/10 bg-[#26262e]/20 dark:bg-[#26262e]/50 px-4 md:px-6 py-3"
              title="Escolhe qual unidade a precificação segue — o mesmo critério do botão «Outra unidade» no PDV."
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Estação de venda
                  </span>
                  <span className="text-sm font-semibold text-foreground dark:text-foreground">
                    {precoCatalogo.sigla}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    R$ {formatarNumero(precoCatalogo.valor)}
                  </span>
                  <span className="text-[11px] text-muted-foreground hidden sm:inline max-w-md truncate">
                    Precificação e custo na embalagem escolhida; gravação continua na unidade base (fator 1).
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {vendasUnitOptions.map((opt) => {
                    const exibNorm = normalizeSigla(formData.unidade_exibicao_sigla || '');
                    const catalogoEhPrincipal = !exibNorm;
                    const active = catalogoEhPrincipal
                      ? Boolean(opt.is_primary)
                      : normalizeSigla(opt.unidade) === exibNorm;
                    return (
                      <button
                        key={opt.unidade}
                        type="button"
                        onClick={() => aplicarUnidadeCatalogoDesdeOpcao(opt)}
                        title={opt.is_primary ? 'Precificação na unidade base' : `Precificação em ${opt.unidade}`}
                        className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all border shadow-sm ${
                          active
                            ? 'border-[#4a5240]/40 bg-[#4a5240] text-white dark:border-[#a4ce33]/40 dark:bg-[#a4ce33] dark:text-[#1f1d22]'
                            : 'border-border/40 bg-card dark:bg-[#26262e] text-foreground/90 hover:border-[#4a5240]/30 dark:hover:border-[#a4ce33]/30'
                        }`}
                      >
                        {opt.unidade}
                      </button>
                    );
                  })}
                  {vendasUnitOptions.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 rounded-xl border-border/40 bg-card shadow-sm dark:border-border/40 dark:bg-background"
                      onClick={() => setUnitSelectorOpen(true)}
                      title="Lista completa com conversão e preço sugerido"
                    >
                      <Boxes className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="hidden sm:inline">Todas</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          <TabsList className={P38_TAB_LIST}>
          <TabsTrigger value="descritivo" className={P38_TAB_TRIGGER}>
            <Package className={P38_TAB_ICON} />
            <span className={P38_TAB_LABEL}>Identificação</span>
          </TabsTrigger>
          <TabsTrigger value="comercial" className={P38_TAB_TRIGGER}>
            <DollarSign className={P38_TAB_ICON} />
            <span className={P38_TAB_LABEL}>Precificação</span>
          </TabsTrigger>
          <TabsTrigger value="logistico" className={P38_TAB_TRIGGER}>
            <Warehouse className={P38_TAB_ICON} />
            <span className={P38_TAB_LABEL}>Embalagens e logística</span>
          </TabsTrigger>
          <TabsTrigger value="historico" className={P38_TAB_TRIGGER} disabled={!produto?.id}>
            <History className={P38_TAB_ICON} />
            <span className={P38_TAB_LABEL}>Histórico</span>
          </TabsTrigger>
          <TabsTrigger value="iep" className={P38_TAB_TRIGGER} disabled={!produto?.id}>
            <BarChart3 className={P38_TAB_ICON} />
            <span className={P38_TAB_LABEL}>Desempenho</span>
          </TabsTrigger>
          <TabsTrigger value="sistema" className={P38_TAB_TRIGGER}>
            <Settings className={P38_TAB_ICON} />
            <span className={P38_TAB_LABEL}>Avançado</span>
          </TabsTrigger>
          </TabsList>
        </div>

        <div
          className={cn(
            'flex-1 min-h-0 px-4 md:px-8 py-6 md:py-8 pb-24 md:pb-8',
            abaAtiva === 'historico'
              ? 'flex flex-col overflow-hidden px-4 py-2 pb-4 md:px-8 md:py-8 md:pb-8'
              : 'overflow-y-auto overscroll-contain'
          )}
        >
          {/* ABA IDENTIFICAÇÃO — `descritivo` no estado interno das abas */}
          <TabsContent value="descritivo" className="space-y-6 mt-0">
            {!produto?.id && (
              <div className={`${P38_SECTION} space-y-3`}>
                <div className="flex items-center gap-2">
                  <Copy className="w-4 h-4 p38-text-accent" />
                  <Label className="text-sm font-semibold text-foreground/90">Produto similar</Label>
                </div>
                <div className="relative">
                  <Input
                    value={similarSearch}
                    onChange={(e) => setSimilarSearch(e.target.value)}
                    placeholder="Buscar similar"
                    className={`${P38_INPUT} h-11`}
                  />
                  {similarSearch.trim() && produtosSimilaresFiltrados.length > 0 ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-xl border border-border/40 dark:border-white/10 bg-card dark:bg-[#2d333b] shadow-lg">
                      <div className="max-h-48 overflow-y-auto p-1">
                        {produtosSimilaresFiltrados.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => applyProdutoSimilar(item)}
                            className="w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary/60 dark:hover:bg-[#26262e]"
                          >
                            <p className="text-sm font-medium text-foreground">{item.nome}</p>
                            <p className="text-xs text-muted-foreground">{item.marca || 'Sem marca'} • {item.categoria_nome || 'Sem categoria'}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            <div className={`flex flex-col sm:flex-row gap-4 items-start ${P38_SECTION}`}>
              <div className="w-28 h-28 shrink-0 bg-secondary/80 dark:bg-[#26262e] rounded-lg flex items-center justify-center overflow-hidden border border-border/40 dark:border-white/10">
                {formData.imagem_url ? (
                  <img src={formData.imagem_url} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-muted-foreground dark:text-muted-foreground text-xs text-center p-2">Sem imagem</div>
                )}
              </div>
              <div className="flex-1 w-full space-y-3">
                <Label className="text-xs text-muted-foreground block">URL da Imagem</Label>
                <div className="flex gap-2">
                  <Input 
                    value={formData.imagem_url || ''} 
                    onChange={e => handleChange('imagem_url', e.target.value)} 
                    placeholder="URL"
                    className={`flex-1 ${P38_INPUT}`}
                  />
                  <div className="relative">
                    <input
                      type="file"
                      id="image-upload"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={isUploading}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={`h-10 px-4 text-sm ${P38_INPUT} border border-border/40 dark:border-white/10`}
                      disabled={isUploading}
                      onClick={() => document.getElementById('image-upload').click()}
                    >
                      {isUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      Upload
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cole a URL ou faça upload de uma imagem do seu computador.
                </p>
              </div>
            </div>

            {/* Campos Hierárquicos */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-3">
                <Label className="text-sm font-semibold p38-text-accent">Descrição Hierárquica</Label>
              </div>

              {/* Preview do nome gerado */}
              {formData.nome && (
                <div className="mb-4 px-3 py-2 rounded-lg border border-border/40 dark:border-white/10 bg-[#26262e]/20 dark:bg-[#26262e]/50">
                  <p className="text-[10px] text-muted-foreground uppercase mb-1">Preview da Descrição Completa</p>
                  <p className="text-sm font-medium text-foreground font-din-1451 uppercase tracking-wide">{formData.nome}</p>
                </div>
              )}

              {[
                { field: 'campo_hierarquico_1', label: 'Campo 1 (Produto base) *', placeholder: '' },
                { field: 'campo_hierarquico_2', label: 'Campo 2 (Subtipo)', placeholder: '' },
                { field: 'campo_hierarquico_3', label: 'Campo 3 (Espessura / Gramatura)', placeholder: '…' },
                { field: 'campo_hierarquico_4', label: 'Campo 4 (Dimensão / Embalagem)', placeholder: '…' },
                { field: 'campo_hierarquico_5', label: 'Campo 5 (Marca / Variante)', placeholder: '…' },
              ].map(({ field, label, placeholder }, idx) => (
                <div key={field} className="grid grid-cols-[20px_1fr] items-center gap-3 py-1">
                  <span className="text-xs font-bold text-muted-foreground text-center">{idx + 1}</span>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
                    <Input
                      value={formData[field] || ''}
                      onChange={e => handleChange(field, e.target.value)}
                      placeholder={placeholder}
                      className={P38_INPUT_UNDERLINE}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Marca (campo independente) */}
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">Marca Oficial (campo independente)</Label>
              <Input
                value={formData.marca || ''}
                onChange={e => handleChange('marca', e.target.value)}
                placeholder=""
                className={P38_INPUT_UNDERLINE}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">Código Interno</Label>
                <Input 
                  value={formData.codigo_interno} 
                  placeholder="Automático"
                  disabled 
                  className="bg-transparent border-0 border-b border-border/40 dark:border-border/40 rounded-none px-0 h-10 text-sm text-muted-foreground dark:text-muted-foreground"
                />
              </div>

              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">Código de Barras</Label>
                <Input 
                  value={formData.codigo_barras} 
                  onChange={e => handleChange('codigo_barras', e.target.value)} 
                  placeholder=""
                  className={P38_INPUT_UNDERLINE}
                />
              </div>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">Categoria (opcional)</Label>
              <Select
                value={formData.categoria_id || '__none__'}
                onValueChange={v => handleChange('categoria_id', v === '__none__' ? '' : v)}
              >
                <SelectTrigger className={`${P38_INPUT_UNDERLINE} h-10`}>
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent className={P38_FORM_SELECT_CONTENT}>
                  <SelectItem value="__none__" className="dark:text-foreground dark:hover:bg-primary/90">Sem categoria</SelectItem>
                  {categorias.map(cat => (
                    <SelectItem key={cat.id} value={cat.id} className="dark:text-foreground dark:hover:bg-primary/90">{cat.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">Fornecedor padrão (opcional)</Label>
              <Select
                value={formData.fornecedor_padrao_id || '__none__'}
                onValueChange={v => {
                  const forn = fornecedores.find(f => f.id === v);
                  handleChange('fornecedor_padrao_id', v === '__none__' ? '' : v);
                  handleChange('fornecedor_padrao_codigo', v === '__none__' ? '' : (forn?.codigo_interno || ''));
                }}
              >
                <SelectTrigger className={`${P38_INPUT_UNDERLINE} h-10`}>
                  <SelectValue placeholder="Fornecedor" />
                </SelectTrigger>
                <SelectContent className={P38_FORM_SELECT_CONTENT}>
                  <SelectItem value="__none__" className="dark:text-foreground dark:hover:bg-primary/90 text-sm">Sem fornecedor</SelectItem>
                  {fornecedores.map(f => (
                    <SelectItem key={f.id} value={f.id} className="dark:text-foreground dark:hover:bg-primary/90 text-sm">
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm text-muted-foreground block">Tags de Agrupamento</Label>
                <TagGenerator 
                  produtoNome={formData.nome} 
                  produtoDescricao={formData.descricao}
                  onTagsGenerated={(tags) => {
                    const newTags = [...new Set([...formData.tags, ...tags])];
                    handleChange('tags', newTags);
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Input 
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  placeholder="…" 
                  className={P38_INPUT_UNDERLINE}
                />
                <Button type="button" onClick={handleAddTag} size="sm" variant="ghost" className="h-10 px-3">
                  <Plus className="w-5 h-5 text-foreground/90 dark:text-muted-foreground" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {formData.tags.map(tag => (
                  <Badge key={tag} className="bg-muted text-foreground/90 border border-border/40 dark:bg-muted dark:text-foreground/90 dark:border-border/40 text-sm py-1 px-3">
                    #{tag}
                    <button onClick={() => handleRemoveTag(tag)} className="ml-2 hover:text-foreground dark:hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ABA COMERCIAL — KPIs primeiro, como no A29 */}
          <TabsContent value="comercial" className="mt-0">
            {false && vendasUnitOptions.length > 0 && (
              <div
                className="mb-6 rounded-2xl border border-border/40 bg-gradient-to-r from-muted/40 to-muted/60 dark:from-muted/40 dark:to-muted/60 px-4 py-3"
                title="Escolha a embalagem para ver preço e custo escalados — alinha com unidade_vitrine e o catálogo."
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Embalagem
                    </span>
                    <span className="text-sm font-semibold text-foreground dark:text-foreground">
                      {precoCatalogo.sigla}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      R$ {formatarNumero(precoCatalogo.valor)}
                    </span>
                    <span className="text-[11px] text-muted-foreground hidden sm:inline max-w-md truncate">
                      Preço e margem na embalagem escolhida; cadastro em base continua por unidade fator 1.
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {vendasUnitOptions.map((opt) => {
                      const vitrineNorm = normalizeSigla(formData.unidade_vitrine || '');
                      const vitrineNaBase = !vitrineNorm;
                      const active = vitrineNaBase
                        ? Boolean(opt.is_primary)
                        : normalizeSigla(opt.unidade) === vitrineNorm;
                      return (
                        <button
                          key={opt.unidade}
                          type="button"
                          onClick={() => aplicarUnidadeCatalogoDesdeOpcao(opt)}
                          title={opt.is_primary ? 'Vitrine na unidade base' : `Vitrine em ${opt.unidade}`}
                          className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all border shadow-sm ${
                            active
                              ? 'border-primary/30 bg-primary text-primary-foreground dark:border-white dark:bg-card dark:text-foreground'
                              : 'border-border/40 bg-card text-foreground/90 hover:border-border/40 dark:border-border/40 dark:bg-muted dark:text-foreground dark:hover:border-border/40'
                          }`}
                        >
                          {opt.unidade}
                        </button>
                      );
                    })}
                    {vendasUnitOptions.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5 rounded-xl border-border/40 bg-card shadow-sm dark:border-border/40 dark:bg-background"
                        onClick={() => setUnitSelectorOpen(true)}
                        title="Lista completa com conversão e preço sugerido"
                      >
                        <Boxes className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="hidden sm:inline">Todas</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-6 mb-8 border-b border-border/40">
              <div className="text-center p-4 bg-muted/50/50 rounded-lg">
                <div className="text-xs text-muted-foreground uppercase mb-1">
                  Custo Total{custoCatalogoScale !== 1 && precoCatalogo.sigla ? ` (${precoCatalogo.sigla})` : ''}
                </div>
                <div className="text-lg font-semibold text-foreground">R$ {formatarNumero(precoCustoCatalogo)}</div>
              </div>
              <div className="text-center p-4 bg-muted/50/50 rounded-lg">
                <div className="text-xs text-muted-foreground uppercase mb-1">
                  Preço de venda{precoCatalogo.sigla ? ` (${precoCatalogo.sigla})` : ''}
                </div>
                <div className="text-lg font-semibold text-foreground">R$ {formatarNumero(precoCatalogo.valor)}</div>
              </div>
              <div className="text-center p-4 bg-muted/50/50 rounded-lg">
                <div className="text-xs text-muted-foreground uppercase mb-1">Markup</div>
                <div className="text-lg font-semibold text-foreground">{formatarNumero(markupCatalogo)}%</div>
              </div>
              <div className="text-center p-4 bg-muted/50/50 rounded-lg">
                <div className="text-xs text-muted-foreground uppercase mb-1">Margem</div>
                <div className="text-lg font-semibold text-foreground">{formatarNumero(margemContribuicao)}%</div>
              </div>
            </div>

            {/* LAYOUT GRID - Desktop: lado a lado | Mobile: empilhado */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
              {/* Composição de Custos - direto dos campos do produto */}
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-base font-semibold text-foreground">Composição de Custos</h3>
                </div>
                {custoCatalogoScale !== 1 && (
                  <p className="text-xs text-muted-foreground mb-4 max-w-xl">
                    Valores por embalagem <strong className="text-foreground/90">{precoCatalogo.sigla}</strong>
                    {' '}(×{formatarNumero(custoCatalogoScale)} vs. base {formData.unidade_principal || 'UN'}). Na base de dados continuam por unidade base.
                  </p>
                )}
                <div className="space-y-1">
                  {[
                    { label: 'Valor de Compra', field: 'valor_compra', icon: <Box className="w-3.5 h-3.5" />, isCurrency: true },
                    { label: 'Frete', field: 'custo_frete_padrao', icon: <Truck className="w-3.5 h-3.5" />, isCurrency: true },
                    { label: 'Imposto 1', field: 'custo_imposto1_padrao', icon: <FileText className="w-3.5 h-3.5" />, isCurrency: true },
                    { label: 'Imposto 2', field: 'custo_imposto2_padrao', icon: <FileText className="w-3.5 h-3.5" />, isCurrency: true },
                    { label: 'Outros Custos', field: 'custo_outros_padrao', icon: <Plus className="w-3.5 h-3.5" />, isCurrency: true },
                    { label: 'Desconto Comercial', field: 'desconto_compra_padrao', icon: <Tag className="w-3.5 h-3.5" />, isCurrency: true, isNegativo: true },
                  ].map(({ label, field, icon, isNegativo }, custoIdx) => {
                    const sc = custoCatalogoScale > 0 ? custoCatalogoScale : 1;
                    const baseVal = parseFloat(formData[field]) || 0;
                    const displayVal = baseVal * sc;
                    return (
                      <div key={field} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 py-2.5 border-b border-border/40 last:border-0">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                          <span className="text-muted-foreground shrink-0">{icon}</span>
                          <span className="truncate">{label}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <CurrencyInput
                            value={displayVal}
                            onChange={(val) => handleChange(field, sc !== 1 ? val / sc : val)}
                            navIndex={custoIdx}
                            placeholder="0"
                            className="bg-transparent border-0 border-b border-border/40 dark:border-border/40 rounded-none px-0 h-8 text-sm w-28 text-right text-foreground focus:border-border/40 font-glacial"
                          />
                          <span className="text-xs text-muted-foreground w-8 shrink-0">(R$)</span>
                        </div>
                        <span className="text-sm font-medium text-foreground text-right tabular-nums font-glacial whitespace-nowrap w-[5.75rem] shrink-0">
                          {isNegativo ? '-' : ''}R$ {formatarNumero(displayVal)}
                        </span>
                      </div>
                    );
                  })}

                  {/* TOTAL */}
                  <div className="flex items-center justify-between pt-6 mt-4 border-t-2 border-border/40 dark:border-border/40">
                    <span className="text-base font-bold text-foreground">CUSTO TOTAL</span>
                    <span className="text-xl font-bold text-foreground">R$ {formatarNumero(precoCustoCatalogo)}</span>
                  </div>
                </div>
              </div>

              {/* Preço de venda */}
              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-base font-semibold text-foreground">Preço de venda</h3>
                </div>

                <div className="space-y-1">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 py-2.5 border-b border-border/40">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                      <span className="text-muted-foreground shrink-0"><DollarSign className="w-3.5 h-3.5" /></span>
                      <span className="truncate">
                        Preço de venda{precoCatalogo.sigla ? ` (${precoCatalogo.sigla})` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <CurrencyInput
                        value={precoCatalogo.valor}
                        onChange={aplicarPrecoVendaCatalogo}
                        navIndex={6}
                        isLast={false}
                        placeholder="0"
                        className="bg-transparent border-0 border-b border-border/40 dark:border-border/40 rounded-none px-0 h-8 text-sm w-28 text-right text-foreground focus:border-border/40 font-glacial"
                      />
                      <span className="text-xs text-muted-foreground w-8 shrink-0">(R$)</span>
                    </div>
                    <span className="text-sm font-medium text-foreground text-right tabular-nums font-glacial whitespace-nowrap w-[5.75rem] shrink-0 invisible">
                      R$ 0,00
                    </span>
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 py-2.5 border-b border-border/40">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                      <span className="text-muted-foreground shrink-0"><TrendingUp className="w-3.5 h-3.5" /></span>
                      <span className="truncate">Markup</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <CurrencyInput
                        value={formData.preco_venda_percentual}
                        onChange={val => {
                          handleChange('preco_venda_percentual', val);
                          handleChange('preco_venda_tipo', 'percentual');
                        }}
                        navIndex={7}
                        isLast
                        placeholder="0"
                        isPercentage={true}
                        className="bg-transparent border-0 border-b border-border/40 dark:border-border/40 rounded-none px-0 h-8 text-sm w-20 text-right text-foreground focus:border-border/40 font-glacial"
                      />
                      <span className="text-xs text-muted-foreground w-8 shrink-0">%</span>
                    </div>
                    <span className="text-sm font-medium text-foreground text-right tabular-nums font-glacial whitespace-nowrap w-[5.75rem] shrink-0 invisible">
                      R$ 0,00
                    </span>
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 py-2.5">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                      <span className="text-muted-foreground shrink-0"><Target className="w-3.5 h-3.5" /></span>
                      <span className="truncate">Margem de Contribuição</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Input
                        type="text"
                        value={formatarNumero(margemContribuicao)}
                        disabled
                        className="bg-muted/50 border-0 border-b border-border/40 rounded-none px-0 h-8 text-sm w-20 text-right text-muted-foreground tabular-nums font-glacial"
                      />
                      <span className="text-xs text-muted-foreground w-8 shrink-0">%</span>
                    </div>
                    <span className="text-sm font-medium text-foreground text-right tabular-nums font-glacial whitespace-nowrap w-[5.75rem] shrink-0 invisible">
                      R$ 0,00
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ABA LOGÍSTICA — medidas, unidade base com «Vitrine», embalagens, lista/avisos, níveis de estoque */}
          <TabsContent value="logistico" className="space-y-6 mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">Dimensões (AxLxP cm)</Label>
                <Input
                  value={formData.dimensoes_cm}
                  onChange={(e) => handleChange('dimensoes_cm', e.target.value)}
                  placeholder="…"
                  className={P38_INPUT_UNDERLINE}
                />
              </div>

              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">Volume (L)</Label>
                <Input
                  value={formData.volume_cm3 ? formatarNumero(formData.volume_cm3 / 1000) : '0,00'}
                  disabled
                  placeholder="Auto"
                  className="bg-transparent border-0 border-b border-border/40 dark:border-border/40 rounded-none px-0 h-10 text-sm text-muted-foreground dark:text-muted-foreground"
                />
              </div>

              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">Peso (kg)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={formData.peso_kg}
                  onChange={(e) => handleChange('peso_kg', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className={P38_INPUT_UNDERLINE}
                />
              </div>

              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">Tempo Reposição (dias)</Label>
                <Input
                  type="number"
                  value={formData.tempo_reposicao_dias}
                  onChange={(e) => handleChange('tempo_reposicao_dias', parseInt(e.target.value, 10) || 0)}
                  placeholder="0"
                  className={P38_INPUT_UNDERLINE}
                />
              </div>

              <div className="md:col-span-2">
                <Label className="text-sm text-muted-foreground mb-2 block">Unidade base (fator 1)</Label>
                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                  <Input
                    value={formData.unidade_principal}
                    onChange={(e) => handleChange('unidade_principal', e.target.value.toUpperCase())}
                    placeholder="…"
                    className="bg-transparent border-0 border-b-2 border-border/40 dark:border-border/40 rounded-none px-0 h-10 text-sm text-foreground flex-1 min-w-0"
                  />
                  <div className="flex items-center gap-2 shrink-0 pb-1 rounded-full bg-muted/90 dark:bg-background/50 px-3 py-1.5 border border-border/40/80 dark:border-border/80">
                    <Switch
                      id="catalogo-unidade-principal"
                      className="scale-90"
                      checked={catalogoNaBase}
                      disabled={formData.unidade_show_ativa === false}
                      title="Vitrine na unidade base (fator 1). Desligue para passar a vitrine à primeira embalagem com interruptor «Vitrine»."
                      onCheckedChange={(checked) => {
                        const p = normalizeSigla(formData.unidade_principal || 'UN') || 'UN';
                        if (checked) {
                          applyCommercialUnitSelection(p);
                          return;
                        }
                        const alts = normalizeAlternativas(formData.unidades_alternativas || []);
                        const first = alts.find((u) => String(u?.unidade || '').trim());
                        if (first?.unidade) applyCommercialUnitSelection(first.unidade);
                      }}
                    />
                    <Label
                      htmlFor="catalogo-unidade-principal"
                      className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap select-none"
                    >
                      Vitrine
                    </Label>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
                  Coluna <code className="text-[10px] rounded bg-muted dark:bg-muted px-1 py-0.5">unidade_principal</code>
                  {' '}— custo, preço padrão e stock contabilizados na base (eixo fator&nbsp;1).
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-border/40 bg-muted/50/50 p-4 md:p-5 space-y-4">
              <div>
                {/* Princípio vitrine (truth only): formulário = tradução da escolha gravada; fallbacks visíveis. */}
                <h3 className="text-sm font-semibold text-foreground">Embalagens e unidades de venda</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                  Alterações ficam no formulário até guardar o produto (ícone de disquete no topo).
                  «Vitrine» define a sigla de exibição em listagens e fluxos de venda (uma de cada vez: base ou embalagem).
                  Ao salvar, o espelho canónico <code className="text-[10px] rounded bg-card/80 dark:bg-background/80 px-1 py-0.5">unidades[]</code> valida o pacote sem alterar os nomes de colunas enviados ao Base44.
                </p>
              </div>

              <div className="flex items-start gap-3 border-t border-border/40 pt-4">
                <Checkbox
                  id="unidade_show_ativa"
                  checked={formData.unidade_show_ativa !== false}
                  onCheckedChange={(v) => handleChange('unidade_show_ativa', v !== false)}
                  className="mt-0.5"
                />
                <div>
                  <Label htmlFor="unidade_show_ativa" className="text-sm text-foreground/90">
                    Usar unidade de vitrine no catálogo
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Coluna <code className="text-[10px]">unidade_show_ativa</code>. Desligado: listagens usam só a base (fator&nbsp;1), sem converter para a vitrine.
                  </p>
                </div>
              </div>

              <UnidadesAlternativasEditor
                unidades={formData.unidades_alternativas || []}
                unidadePrincipal={formData.unidade_principal || 'UN'}
                commercialUnitId={commercialUnitIdForEditor}
                catalogControlsDisabled={formData.unidade_show_ativa === false}
                onChange={(value) => handleChange('unidades_alternativas', value)}
                onPickCatalogPrincipal={() =>
                  applyCommercialUnitSelection(formData.unidade_principal || 'UN')
                }
                onPickCatalogRow={(index) => {
                  const rows = normalizeAlternativas(formData.unidades_alternativas || []);
                  const row = rows[index];
                  if (row?.unidade) applyCommercialUnitSelection(row.unidade);
                }}
              />

              <div className="border-t border-border/40 pt-4 space-y-3">
                <div>
                  <Label className="text-sm text-foreground/90">Unidade de vitrine (lista)</Label>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                    Alternativa aos interruptores «Vitrine»; grava a coluna{' '}
                    <code className="text-[10px] rounded bg-card/80 dark:bg-background/80 px-1 py-0.5">unidade_vitrine</code>
                    {' '}(sigla da embalagem; vazio = unidade base).
                  </p>
                </div>
                <Select
                  value={comercialSelectValue}
                  onValueChange={(v) => applyCommercialUnitSelection(v)}
                >
                  <SelectTrigger
                    className="bg-muted/40 dark:bg-background border border-border/40 rounded-xl max-w-md h-11"
                    disabled={formData.unidade_show_ativa === false}
                  >
                    <SelectValue placeholder="Sigla" />
                  </SelectTrigger>
                  <SelectContent className={P38_FORM_SELECT_CONTENT}>
                    {commercialSelectOptions.map((sigla) => (
                      <SelectItem key={`com-${sigla}`} value={sigla}>
                        {sigla}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {commercialSelectWarning ? (
                  <p className="text-xs text-amber-800 dark:text-amber-200 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40 px-3 py-2">
                    {commercialSelectWarning}
                  </p>
                ) : null}
                {vitrineHydrateWarning ? (
                  <p className="text-xs text-amber-800 dark:text-amber-200 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40 px-3 py-2">
                    {vitrineHydrateWarning}
                  </p>
                ) : null}
                {vitrineResolveFallbackWarning ? (
                  <p className="text-xs text-amber-800 dark:text-amber-200 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40 px-3 py-2">
                    {vitrineResolveFallbackWarning}
                  </p>
                ) : null}
                {formData.unidade_show_ativa !== false && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                      Pré-visualização: base{' '}
                      <span className="font-medium text-foreground/90">{catalogUnitsPreview.base}</span>
                      {catalogUnitsPreview.base !== catalogUnitsPreview.comercial && (
                        <>
                          {' · '}
                          vitrine{' '}
                          <span className="font-medium text-foreground/90">{catalogUnitsPreview.comercial}</span>
                        </>
                      )}
                    </p>
                    {catalogUnitsPreview.base !== catalogUnitsPreview.comercial &&
                      catalogUnitsPreview.display?.fator_conversao > 1 && (
                        <p className="text-[11px]">
                          Com estoque {formatarNumero(Number(formData.estoque_atual) || 0)} na base, o sistema pode mostrar ~{' '}
                          {formatarNumero(catalogUnitsPreview.display.quantidade)} {catalogUnitsPreview.display.unidade}.
                        </p>
                      )}
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground px-1 border-t border-border/40 pt-3">
                Sem embalagem extra no catálogo: o sistema usa a unidade base. A lista de siglas é a base + embalagens com sigla preenchida.
              </p>
            </div>

            <div className="border-t pt-6 dark:border-border/40">
              <h3 className="text-base font-semibold mb-4 text-foreground">Níveis de Estoque</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">Mínimo</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={formData.estoque_minimo}
                    onChange={(e) => handleChange('estoque_minimo', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className={P38_INPUT_UNDERLINE}
                  />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">Ideal</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={formData.estoque_ideal}
                    onChange={(e) => handleChange('estoque_ideal', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className={P38_INPUT_UNDERLINE}
                  />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">Máximo</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={formData.estoque_maximo}
                    onChange={(e) => handleChange('estoque_maximo', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className={P38_INPUT_UNDERLINE}
                  />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">Atual (sistema)</Label>
                  <Input
                    type="number"
                    value={formData.estoque_atual}
                    disabled
                    className="bg-transparent border-0 border-b border-border/40 dark:border-border/40 rounded-none px-0 h-10 text-sm text-muted-foreground dark:text-muted-foreground"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ABA HISTÓRICO — extrato PDV */}
          <TabsContent value="historico" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden px-0 pb-0 pt-2 data-[state=inactive]:hidden">
            <ProdutoHistoricoEstoqueTab
              movimentacoes={movimentacoes}
              estoqueAtual={formData.estoque_atual}
              produto={formData}
              loading={loadingMovimentacoes}
              onRefresh={loadMovimentacoes}
              chromeExpanded={historicoChromeExpanded}
            />
          </TabsContent>

          <TabsContent value="iep" className="space-y-6 mt-0">
            <ProdutoIepTab produto={produto} />
          </TabsContent>

          {/* ABA AVANÇADO — tipo, PDV, rastreio */}
          <TabsContent value="sistema" className="space-y-6 mt-0">
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">Tipo de Produto *</Label>
              <Select value={formData.tipo} onValueChange={v => handleChange('tipo', v)}>
                <SelectTrigger className={`${P38_INPUT_UNDERLINE} h-10`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={P38_FORM_SELECT_CONTENT}>
                  <SelectItem value="Produto" className="dark:text-foreground dark:hover:bg-primary/90">Produto (0)</SelectItem>
                  <SelectItem value="Serviço" className="dark:text-foreground dark:hover:bg-primary/90">Serviço (1)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3 py-3">
              <Checkbox 
                checked={formData.ativo} 
                onCheckedChange={v => handleChange('ativo', v)} 
                id="ativo"
                className="dark:border-border/40 h-5 w-5"
              />
              <Label htmlFor="ativo" className="cursor-pointer text-sm text-foreground/90">Produto Ativo</Label>
            </div>

            {/* Preço Livre e Casas Decimais */}
            <div className="border-t pt-6 dark:border-border/40">
              <h3 className="text-base font-semibold mb-4 text-foreground">Comportamento no PDV</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={formData.preco_livre || false}
                    onCheckedChange={v => handleChange('preco_livre', v)}
                    id="preco_livre"
                    className="dark:border-border/40 h-5 w-5"
                  />
                  <div>
                    <Label htmlFor="preco_livre" className="cursor-pointer text-sm text-foreground/90">Preço Livre</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Permite ao vendedor alterar o preço unitário no PDV (respeitando o custo mínimo)</p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">Casas Decimais na Quantidade</Label>
                  <div className="flex items-center gap-1 bg-muted/50 rounded-lg border border-border/40 overflow-hidden w-fit">
                    {[0, 1, 2, 3].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => handleChange('casas_decimais', n)}
                        className={`w-10 h-9 text-sm font-medium transition-colors ${
                          (formData.casas_decimais ?? 0) === n
                            ? 'bg-muted text-foreground'
                            : 'text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Exemplo: {(formData.casas_decimais ?? 0) === 0 ? '1, 2, 10' : (formData.casas_decimais ?? 0) === 1 ? '1,5 · 2,0' : (formData.casas_decimais ?? 0) === 2 ? '1,50 · 2,75' : '1,500 · 2,750'}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t pt-6 dark:border-border/40">
              <h3 className="text-base font-semibold mb-4 text-foreground">Rastreabilidade</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={formData.controla_serial}
                    onCheckedChange={v => handleChange('controla_serial', v)}
                    id="serial"
                    className="dark:border-border/40 h-5 w-5"
                  />
                  <Label htmlFor="serial" className="cursor-pointer text-sm text-foreground/90">Controla Número de Série</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={formData.controla_lote}
                    onCheckedChange={v => handleChange('controla_lote', v)}
                    id="lote"
                    className="dark:border-border/40 h-5 w-5"
                  />
                  <Label htmlFor="lote" className="cursor-pointer text-sm text-foreground/90">Controla Lote</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={formData.controla_validade}
                    onCheckedChange={v => handleChange('controla_validade', v)}
                    id="validade"
                    className="dark:border-border/40 h-5 w-5"
                  />
                  <Label htmlFor="validade" className="cursor-pointer text-sm text-foreground/90">Controla Validade</Label>
                </div>
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <ProductUnitSelectorDialog
        open={unitSelectorOpen}
        product={productForUnitDialog}
        mode="sale"
        priceMultiplier={1}
        onClose={() => setUnitSelectorOpen(false)}
        onConfirm={(unit) => {
          aplicarUnidadeCatalogoDesdeOpcao(unit);
          setUnitSelectorOpen(false);
        }}
      />
    </div>
  );
}