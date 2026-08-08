import { useState, useEffect, Fragment } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog.jsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import ProductUnitSelectorDialog from '@/components/produtos/ProductUnitSelectorDialog';
import AtualizarPrecosMobileView from '@/components/compras/AtualizarPrecosMobileView';
import { COMPRAS_CHIP_ACTIVE, COMPRAS_CHIP_INACTIVE, COMPRAS_CTA } from '@/lib/comprasEmbarquesPalette';
import { base44 } from '@/api/base44Client';
import { toast } from '@/components/ui/use-toast';
import { runOperacaoAuthBypass } from '@/components/auth/runOperacaoAuthBypass';
import {
  resolvePrimaryFromFactorOne,
  formatUnitConversion,
  buildPurchaseUnitOptions,
  pickDefaultPurchaseUnit,
  hasAlternativeUnits,
  getCustoCompraLiquidoFator1,
  getDescontoPctApresentacaoItem,
  isItemAcrescimoCompra,
  calcPrecoCustoFromComponents,
  resolveCustoTotalUnitBaseProduto,
} from '@/lib/productUnits';

const findProduto = (produtos, produtoId) =>
  produtos.find((p) => String(p.id) === String(produtoId));

// Formata número para string BR
const fmt = (v) => (parseFloat(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Parseia string BR para número
const parse = (s) => {
  if (!s && s !== 0) return 0;
  if (typeof s === 'number') return s;
  return parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0;
};

// Calcula custo total a partir dos campos
const calcCusto = (c) => calcPrecoCustoFromComponents(c);

// Calcula preço venda a partir do custo e markup
const calcPreco = (custo, markup) => custo > 0 ? custo * (1 + markup / 100) : 0;

// Calcula markup a partir do custo e preço venda
const calcMarkup = (custo, preco) => custo > 0 ? ((preco / custo) - 1) * 100 : 0;

const COST_FIELDS = ['valor_compra', 'custo_frete_padrao', 'custo_imposto1_padrao', 'custo_imposto2_padrao', 'custo_outros_padrao', 'avaria_percentual'];

/** Normalização de siglas para casar unidades equivalentes no cadastro / linha do pedido. */
function normalizarSiglaUnidade(raw) {
  return String(raw || '').trim().toUpperCase()
    .replace('CAIXAS', 'CX')
    .replace('CAIXA', 'CX')
    .replace('M²', 'M2')
    .replace('METRO QUADRADO', 'M2');
}

/**
 * Fator da **linha do pedido**: converte custo_unitario → valor_compra na unidade base do cadastro.
 * (Quando a linha está na unidade base, isto é 1.)
 */
function resolveFatorPedidoParaBase(item, produto) {
  const qtd = Number(item?.quantidade);
  const qb = Number(item?.quantidade_base);
  if (qtd > 0 && qb > 0) {
    const derivado = qb / qtd;
    if (Number.isFinite(derivado) && derivado > 0) {
      return Math.round(derivado * 10000) / 10000;
    }
  }
  const sigla = normalizarSiglaUnidade(item?.unidade_medida || '');
  if (produto && sigla) {
    const opcoes = buildPurchaseUnitOptions(produto);
    const match = opcoes.find((o) => normalizarSiglaUnidade(o.unidade) === sigla);
    if (match && Number(match.fator_conversao) > 0) {
      return Number(match.fator_conversao);
    }
  }
  const f = Number(item?.fator_conversao);
  return Number.isFinite(f) && f > 0 ? f : 1;
}

/**
 * Unidade/fator de negociação de compra no cadastro — igual ao formulário do pedido (`pickDefaultPurchaseUnit`).
 * Unidade padrão de compra com fator ≠ 1 → exibe nessa unidade; gravação segue na unidade base do cadastro.
 */
function resolveFatorComercialCadastro(produto) {
  if (!produto) return 1;
  const pu = pickDefaultPurchaseUnit(produto);
  if (!pu || Number(pu.fator_conversao) <= 1) return 1;
  return Number(pu.fator_conversao);
}

/**
 * Fator para exibir: unidade da linha do pedido (se ≠ base), senão unidade padrão de compra do cadastro.
 */
function resolveFatorExibicaoComercial(item, produto) {
  const fp = resolveFatorPedidoParaBase(item, produto);
  if (fp > 1) return fp;
  const fc = resolveFatorComercialCadastro(produto);
  return fc > 1 ? fc : 1;
}

/** Multiplicador visual: na unidade comercial, valores monetários = base × fator. */
function multiplicadorVisual(unidadeVisualizacao, fator) {
  if (unidadeVisualizacao !== 'comercial') return 1;
  return fator > 0 ? fator : 1;
}

const sanitizeTwoDecimalInput = (value) => {
  const raw = String(value ?? '');
  const cleaned = raw.replace(/[^0-9,.-]/g, '');
  const isNegative = cleaned.includes('-');
  const unsigned = cleaned.replace(/-/g, '');
  const hasComma = unsigned.includes(',');
  const hasDot = unsigned.includes('.');

  const separator = hasComma ? ',' : hasDot ? '.' : null;

  if (separator) {
    const parts = unsigned.split(separator);
    const integerPart = (parts.shift() || '').replace(/[,.]/g, '');
    const decimalPart = parts.join('').replace(/[,.]/g, '');
    const normalizedInteger = integerPart.replace(/^0+(?=\d)/, '') || '0';
    return `${isNegative ? '-' : ''}${normalizedInteger}${separator}${decimalPart.slice(0, 2)}`;
  }

  const normalizedInteger = unsigned.replace(/[,.]/g, '').replace(/^0+(?=\d)/, '') || '0';
  return `${isNegative ? '-' : ''}${normalizedInteger}`;
};

export default function AtualizarPrecosDialog({
  isOpen,
  onClose,
  itens = [],
  produtos = [],
  titulo,
  subtitulo,
  getItemSubtitulo,
  secoesAgrupamento = null,
}) {
  const [selecionados, setSelecionados] = useState({});
  const [processando, setProcessando] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState(null);
  // Estado principal (valores numéricos)
  const [costs, setCosts] = useState({});
  // Estado local dos inputs (strings para digitação livre)
  const [inputs, setInputs] = useState({});
  const [isMobile, setIsMobile] = useState(false);
  /** Padrão: valores na unidade de compra configurada; alternativa é só unidade base do cadastro. */
  const [unidadeVisualizacao, setUnidadeVisualizacao] = useState('comercial');
  /** Sobrescreve fator/sigla de exibição por produto (como «Outra unidade» no pedido). */
  const [unidadeExibicaoLinha, setUnidadeExibicaoLinha] = useState({});
  const [unitSelectorPreco, setUnitSelectorPreco] = useState({ open: false, product: null, produtoId: null });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Recalcula desconto absoluto a partir do %
  const recalcDesconto = (c) => {
    const pct = c.desconto_pct || 0;
    const base = c.valor_compra || 0;
    const absVal = parseFloat((base * Math.abs(pct) / 100).toFixed(2));
    return pct < 0 ? -absVal : absVal;
  };

  const resolveFatorLinha = (item, produto) => {
    const ov = unidadeExibicaoLinha[item?.produto_id];
    if (ov?.fator > 0) return ov.fator;
    return resolveFatorExibicaoComercial(item, produto);
  };

  const resolveDescontoPctItem = (item) => {
    const storedPct = parseFloat(item?.desconto_pct_item);
    if (Number.isFinite(storedPct) && storedPct !== 0) {
      return isItemAcrescimoCompra(item) ? -Math.abs(storedPct) : Math.abs(storedPct);
    }
    const pct = getDescontoPctApresentacaoItem(item);
    if (!pct) return 0;
    return isItemAcrescimoCompra(item) ? -pct : pct;
  };

  // Inicializa estado ao abrir — custos sempre na unidade base do cadastro; custo_unitario da linha pode estar na unidade do pedido
  useEffect(() => {
    if (!isOpen || !itens.length) return;
    const modoInicial = 'comercial';
    setUnidadeVisualizacao(modoInicial);
    setUnidadeExibicaoLinha({});

    const initialCosts = {};
    const initialInputs = {};
    itens.forEach(item => {
      const p = findProduto(produtos, item.produto_id);
      if (!p) return;

      const valorCompraLiquidoBase = getCustoCompraLiquidoFator1(item) || (p.valor_compra || 0);

      const c = {
        valor_compra: valorCompraLiquidoBase,
        custo_frete_padrao: p.custo_frete_padrao || 0,
        custo_imposto1_padrao: p.custo_imposto1_padrao || 0,
        custo_imposto2_padrao: p.custo_imposto2_padrao || 0,
        custo_outros_padrao: p.custo_outros_padrao || 0,
        avaria_percentual: p.avaria_percentual || 0,
        desconto_pct: 0,
        desconto_compra_padrao: 0,
        preco_venda_percentual: p.preco_venda_percentual || 40,
        preco_venda_padrao: p.preco_venda_padrao || 0,
      };
      if (!c.preco_venda_padrao) {
        c.preco_venda_padrao = calcPreco(calcCusto(c), c.preco_venda_percentual);
      }
      initialCosts[item.produto_id] = c;

      const mult = multiplicadorVisual(modoInicial, resolveFatorLinha(item, p));
      COST_FIELDS.forEach(field => {
        const multField = field === 'avaria_percentual' ? 1 : mult;
        initialInputs[`${item.produto_id}_${field}`] = field === 'avaria_percentual'
          ? String(c[field] || 0)
          : fmt((c[field] || 0) * multField);
      });
      initialInputs[`${item.produto_id}_desconto_pct`] = String(Math.round((c.desconto_pct || 0) * 100) / 100);
      initialInputs[`${item.produto_id}_markup`] = String(Math.round((c.preco_venda_percentual || 40) * 100) / 100);
      initialInputs[`${item.produto_id}_preco`] = fmt((c.preco_venda_padrao || 0) * mult);
    });
    setCosts(initialCosts);
    setInputs(initialInputs);
  }, [isOpen, itens, produtos]);

  const resolveSiglaLinha = (item, produto, fallbackLegenda) => {
    const ov = unidadeExibicaoLinha[item?.produto_id];
    if (ov?.unidade) return normalizarSiglaUnidade(ov.unidade);
    return fallbackLegenda;
  };

  const refreshInputsProduto = (produtoId, fatorExibicao) => {
    const c = costs[produtoId];
    if (!c) return;
    const item = itens.find((i) => String(i.produto_id) === String(produtoId));
    const mult = multiplicadorVisual(unidadeVisualizacao, fatorExibicao);
    setInputs((prev) => {
      const next = { ...prev };
      COST_FIELDS.forEach((field) => {
        const multField = field === 'avaria_percentual' ? 1 : mult;
        next[`${produtoId}_${field}`] = field === 'avaria_percentual'
          ? String(c[field] || 0)
          : fmt((c[field] || 0) * multField);
      });
      next[`${produtoId}_desconto_pct`] = String(Math.round((c.desconto_pct || 0) * 100) / 100);
      next[`${produtoId}_markup`] = String(Math.round((c.preco_venda_percentual || 40) * 100) / 100);
      next[`${produtoId}_preco`] = fmt((c.preco_venda_padrao || 0) * mult);
      return next;
    });
    void item;
  };

  const handleConfirmUnidadeLinha = (unitOption) => {
    const produtoId = unitSelectorPreco.produtoId;
    if (!produtoId || !unitOption) return;
    const fator = Number(unitOption.fator_conversao) > 0 ? Number(unitOption.fator_conversao) : 1;
    setUnidadeExibicaoLinha((prev) => ({
      ...prev,
      [produtoId]: { unidade: unitOption.unidade, fator },
    }));
    refreshInputsProduto(produtoId, fator);
    setUnitSelectorPreco({ open: false, product: null, produtoId: null });
  };

  const alternarUnidadeVisualizacao = (modo) => {
    if (modo === unidadeVisualizacao) return;
    setUnidadeVisualizacao(modo);
    setInputs((prev) => {
      const next = { ...prev };
      itens.forEach((item) => {
        const id = item.produto_id;
        const c = costs[id];
        if (!c) return;
        const pRow = findProduto(produtos, id);
        const mult = multiplicadorVisual(modo, resolveFatorLinha(item, pRow));
        COST_FIELDS.forEach((field) => {
          const multField = field === 'avaria_percentual' ? 1 : mult;
          next[`${id}_${field}`] = field === 'avaria_percentual'
            ? String(c[field] || 0)
            : fmt((c[field] || 0) * multField);
        });
        next[`${id}_desconto_pct`] = String(Math.round((c.desconto_pct || 0) * 100) / 100);
        next[`${id}_markup`] = String(Math.round((c.preco_venda_percentual || 40) * 100) / 100);
        next[`${id}_preco`] = fmt((c.preco_venda_padrao || 0) * mult);
      });
      return next;
    });
  };

  // Ao sair de um campo de custo: commita valor e recalcula preço venda mantendo markup
  const handleCostBlur = (produtoId, field) => {
    const raw = inputs[`${produtoId}_${field}`];
    const item = itens.find((i) => String(i.produto_id) === String(produtoId));
    const prodRow = findProduto(produtos, produtoId);
    const m = multiplicadorVisual(unidadeVisualizacao, resolveFatorLinha(item || {}, prodRow));
    const val = field === 'avaria_percentual' ? parse(raw) : parse(raw) / m;
    setCosts(prev => {
      if (!prev[produtoId]) return prev;
      const c = { ...prev[produtoId], [field]: val };
      // Se mudou valor_compra, recalcular desconto absoluto baseado no %
      if (field === 'valor_compra') {
        c.desconto_compra_padrao = recalcDesconto(c);
      }
      const custo = calcCusto(c);
      const markup = c.preco_venda_percentual || 0;
      const novoPreco = calcPreco(custo, markup);
      const next = { ...c, preco_venda_padrao: novoPreco };
      const dm = multiplicadorVisual(unidadeVisualizacao, resolveFatorLinha(item || {}, prodRow));
      setInputs(p2 => ({
        ...p2,
        [`${produtoId}_${field}`]: field === 'avaria_percentual' ? String(val) : fmt(val * dm),
        [`${produtoId}_preco`]: fmt(novoPreco * dm),
      }));
      return { ...prev, [produtoId]: next };
    });
  };

  // Ao sair do campo desconto %
  const handleDescontoPctBlur = (produtoId) => {
    const raw = inputs[`${produtoId}_desconto_pct`];
    const normalized = String(raw).replace(',', '.');
    const pct = parseFloat(normalized) || 0;
    handleDescontoPctBlurDirect(produtoId, Math.round(pct * 100) / 100);
  };

  // Versão direta (usada pelo toggle)
  const handleDescontoPctBlurDirect = (produtoId, pct) => {
    const linha = itens.find((i) => String(i.produto_id) === String(produtoId));
    const prodRow = findProduto(produtos, produtoId);
    const dm = multiplicadorVisual(unidadeVisualizacao, resolveFatorLinha(linha || {}, prodRow));
    setCosts(prev => {
      if (!prev[produtoId]) return prev;
      const c = { ...prev[produtoId], desconto_pct: pct };
      c.desconto_compra_padrao = recalcDesconto(c);
      const custo = calcCusto(c);
      const markup = c.preco_venda_percentual || 0;
      const novoPreco = calcPreco(custo, markup);
      const next = { ...c, preco_venda_padrao: novoPreco };
      setInputs(p2 => ({
        ...p2,
        [`${produtoId}_desconto_pct`]: String(Math.round(pct * 100) / 100),
        [`${produtoId}_preco`]: fmt(novoPreco * dm),
      }));
      return { ...prev, [produtoId]: next };
    });
  };

  const handleMarkupBlurDirect = (produtoId, markup) => {
    const linha = itens.find((i) => String(i.produto_id) === String(produtoId));
    const prodRow = findProduto(produtos, produtoId);
    const dm = multiplicadorVisual(unidadeVisualizacao, resolveFatorLinha(linha || {}, prodRow));
    setCosts((prev) => {
      if (!prev[produtoId]) return prev;
      const c = { ...prev[produtoId], preco_venda_percentual: markup };
      const custo = calcCusto(c);
      const novoPreco = calcPreco(custo, markup);
      const next = { ...c, preco_venda_padrao: novoPreco };
      setInputs((p2) => ({
        ...p2,
        [`${produtoId}_markup`]: String(Math.round(markup * 100) / 100),
        [`${produtoId}_preco`]: fmt(novoPreco * dm),
      }));
      return { ...prev, [produtoId]: next };
    });
  };

  // Ao sair do markup: recalcula preço venda
  const handleMarkupBlur = (produtoId) => {
    const raw = inputs[`${produtoId}_markup`];
    const markup = parseFloat(raw) || 0;
    handleMarkupBlurDirect(produtoId, markup);
  };

  // Ao sair do preço venda: recalcula markup
  const handlePrecoBlur = (produtoId) => {
    const raw = inputs[`${produtoId}_preco`];
    const item = itens.find((i) => String(i.produto_id) === String(produtoId));
    const prodRow = findProduto(produtos, produtoId);
    const m = multiplicadorVisual(unidadeVisualizacao, resolveFatorLinha(item || {}, prodRow));
    const preco = parse(raw) / m;
    setCosts(prev => {
      const c = prev[produtoId];
      if (!c) return prev;
      const custo = calcCusto(c);
      const novoMarkup = Math.max(0, calcMarkup(custo, preco));
      const next = { ...c, preco_venda_padrao: preco, preco_venda_percentual: novoMarkup };
      const dm = multiplicadorVisual(unidadeVisualizacao, resolveFatorLinha(item || {}, prodRow));
      setInputs(p2 => ({
        ...p2,
        [`${produtoId}_preco`]: fmt(preco * dm),
        [`${produtoId}_markup`]: String(Math.round(novoMarkup * 100) / 100),
      }));
      return { ...prev, [produtoId]: next };
    });
  };

  // Dados calculados por item para exibição (custos internos sempre na unidade base do cadastro)
  const itensCalc = itens.map(item => {
    const p = findProduto(produtos, item.produto_id);
    if (!p) return null;
    const c = costs[item.produto_id] || {};
    const novoCusto = calcCusto(c);
    const custoAtual = resolveCustoTotalUnitBaseProduto(p);
    const diferencaCusto = novoCusto - custoAtual;
    const temDiferenca = Math.abs(diferencaCusto) > 0.01;
    const principal = resolvePrimaryFromFactorOne(p, 'UN');
    const unidadeCompraPadrao = pickDefaultPurchaseUnit(p);
    const fatorPedido = resolveFatorPedidoParaBase(item, p);
    const fatorExibicao = resolveFatorLinha(item, p);
    const multDisplay = multiplicadorVisual(unidadeVisualizacao, fatorExibicao);
    const unidadeBase = principal;
    const linhaSigla = normalizarSiglaUnidade(item?.unidade_medida || '');
    const siglaPadraoCompra =
      unidadeCompraPadrao && Number(unidadeCompraPadrao.fator_conversao) > 1
        ? normalizarSiglaUnidade(unidadeCompraPadrao.unidade)
        : null;
    /** Siglas vindas do cadastro (unidade padrão de compra) ou da linha do pedido. */
    let unidadeComercialLegenda = null;
    if (fatorPedido > 1) {
      unidadeComercialLegenda = linhaSigla || null;
      if (!unidadeComercialLegenda) {
        const opcoes = buildPurchaseUnitOptions(p);
        const porFatorPedido = opcoes.find(
          (o) => Math.abs(Number(o.fator_conversao) - fatorPedido) < 0.02,
        );
        if (porFatorPedido) unidadeComercialLegenda = normalizarSiglaUnidade(porFatorPedido.unidade);
      }
      if (!unidadeComercialLegenda && siglaPadraoCompra) unidadeComercialLegenda = siglaPadraoCompra;
    } else if (siglaPadraoCompra) {
      unidadeComercialLegenda = siglaPadraoCompra;
    }
    unidadeComercialLegenda = resolveSiglaLinha(item, p, unidadeComercialLegenda);
    return {
      ...item,
      produto: p,
      novoCusto,
      custoAtual,
      diferencaCusto,
      temDiferenca,
      c,
      fatorExibicao,
      multDisplay,
      unidadeBase,
      unidadeComercialLegenda,
    };
  }).filter(Boolean);

  const algumItemComConversao = itensCalc.some((i) => i.fatorExibicao !== 1);
  const siglasComerciais = [...new Set(itensCalc.filter((i) => i.fatorExibicao !== 1).map((i) => i.unidadeComercialLegenda).filter(Boolean))];

  const qtdComDiferenca = itensCalc.filter(i => i.temDiferenca).length;
  const itensSemCadastro = itens.length - itensCalc.length;

  const handleToggle = (id) => setSelecionados(prev => ({ ...prev, [id]: !prev[id] }));

  const handleSelecionarTodos = () => {
    const todos = {};
    itensCalc.forEach(i => { if (i.temDiferenca) todos[i.produto_id] = true; });
    setSelecionados(todos);
  };

  const handleInitiateUpdate = () => {
    const sel = itensCalc.filter(i => selecionados[i.produto_id]);
    if (!sel.length) {
      toast({ title: "Nenhum item selecionado", description: "Selecione ao menos um item para atualizar", variant: "destructive" });
      return;
    }
    setPendingUpdate(sel);
    void runOperacaoAuthBypass((authData) => handleAuthSuccess(authData, sel));
  };

  const handleAuthSuccess = async (authData, itensParaAtualizar = pendingUpdate) => {
    if (!itensParaAtualizar?.length) return;
    setProcessando(true);
    try {
      for (const item of itensParaAtualizar) {
        const c = costs[item.produto_id];
        if (!c) continue;
        await base44.entities.Produto.update(item.produto_id, {
          valor_compra: c.valor_compra,
          custo_frete_padrao: c.custo_frete_padrao,
          custo_imposto1_padrao: c.custo_imposto1_padrao,
          custo_imposto2_padrao: c.custo_imposto2_padrao,
          custo_outros_padrao: c.custo_outros_padrao,
          avaria_percentual: c.avaria_percentual || 0,
          desconto_compra_padrao: 0,
          desconto_perc: 0,
          preco_custo_calculado: calcCusto(c),
          preco_venda_percentual: c.preco_venda_percentual,
          preco_venda_padrao: c.preco_venda_padrao,
        });
      }
      toast({ title: "✓ Preços atualizados", description: `${itensParaAtualizar.length} produto(s) atualizado(s) [Auth: ${authData.intervenienteName}]`, className: "bg-emerald-100 text-emerald-800" });
      onClose(true);
    } catch (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    } finally {
      setProcessando(false);
      setPendingUpdate(null);
    }
  };

  const inp = (produtoId, field) => inputs[`${produtoId}_${field}`] ?? '';
  const setInp = (produtoId, field, val) => setInputs(prev => ({ ...prev, [`${produtoId}_${field}`]: val }));

  const numSel = Object.keys(selecionados).filter(k => selecionados[k]).length;

  const secoesRender = (() => {
    if (!secoesAgrupamento?.length) {
      return [{ label: null, items: itensCalc }];
    }
    const byProduto = new Map(itensCalc.map((row) => [String(row.produto_id), row]));
    return secoesAgrupamento
      .map((sec) => ({
        label: sec.label,
        items: (sec.items || [])
          .map((raw) => byProduto.get(String(raw.produto_id)))
          .filter(Boolean),
      }))
      .filter((sec) => sec.items.length > 0);
  })();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(false); }}>
      <DialogContent className={`${isMobile ? '!max-w-[100vw] !w-[100vw] h-[100vh] !rounded-none p-0 font-din-1451 bg-background' : '!max-w-[95vw]'} max-h-[90vh] overflow-y-auto`}>
        <DialogHeader className={isMobile ? 'px-4 pt-4 pb-2 border-b border-border/40 dark:border-white/10' : ''}>
          <DialogTitle className="flex items-center gap-2 text-foreground text-lg font-medium">
            <DollarSign className={`w-5 h-5 ${isMobile ? 'text-cyan-600 dark:text-cyan-400' : 'text-foreground'}`} />
            {titulo || 'Revisar Preços de Venda'}
          </DialogTitle>
          <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground mt-1 leading-snug`}>
            {subtitulo || (qtdComDiferenca > 0
              ? `${qtdComDiferenca} produto(s) com alteração de custo detectada. Revise e selecione quais preços deseja atualizar.`
              : 'Nenhuma alteração de custo detectada. Você pode revisar os preços atuais dos produtos.')}
          </p>
          {!isMobile && (
            <p className="text-xs text-muted-foreground mt-2">
              Para cada produto, os valores monetários usam a <strong className="font-semibold text-foreground">unidade de compra definida no cadastro</strong> (alternativas e conversões, como no lançamento do pedido) — veja a coluna <strong className="font-semibold text-foreground">Unidade</strong> para a sigla de cada linha.
              Ao salvar, o sistema grava custos e preços na <strong className="font-semibold text-foreground">unidade base</strong> do produto. Sem alternativa com conversão, a grade permanece na unidade base (fator 1).
            </p>
          )}
        </DialogHeader>

        <div className={isMobile ? 'mt-2' : 'mt-4'}>
          {algumItemComConversao && (
            <div className={`flex flex-wrap items-center gap-2 mb-3 ${isMobile ? 'px-4 pt-3' : ''}`}>
              {!isMobile && <span className="text-xs text-muted-foreground">Alternar apenas a visualização:</span>}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`h-9 text-xs rounded-full px-3 ${unidadeVisualizacao === 'comercial' ? COMPRAS_CHIP_ACTIVE : COMPRAS_CHIP_INACTIVE}`}
                onClick={() => alternarUnidadeVisualizacao('comercial')}
              >
                {isMobile ? 'Un. compra' : `Unidade de compra (cadastro)${siglasComerciais.length ? ` · ${siglasComerciais.join(', ')}` : ''}`}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`h-9 text-xs rounded-full px-3 ${unidadeVisualizacao === 'base' ? COMPRAS_CHIP_ACTIVE : COMPRAS_CHIP_INACTIVE}`}
                onClick={() => alternarUnidadeVisualizacao('base')}
              >
                {isMobile ? 'Un. base' : 'Apenas na unidade base do produto'}
              </Button>
            </div>
          )}
          {!isMobile && (
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-foreground/90 font-medium">
              {itensCalc.length} produto(s) no pedido
              {qtdComDiferenca > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-muted text-foreground dark:bg-muted dark:text-foreground rounded text-[10px] font-semibold">
                  {qtdComDiferenca} com alteração
                </span>
              )}
            </p>
            {qtdComDiferenca > 0 && (
              <Button variant="ghost" size="sm" onClick={handleSelecionarTodos} className="text-xs h-7 shadow-sm">
                Selecionar Alterados
              </Button>
            )}
          </div>
          )}

          {itensSemCadastro > 0 && (
            <div className={`mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200 ${isMobile ? 'mx-4' : ''}`}>
              {itensSemCadastro} {itensSemCadastro === 1 ? 'item não foi encontrado' : 'itens não foram encontrados'} no cadastro de produtos e não aparecem na grade abaixo.
            </div>
          )}

          {itensCalc.length === 0 ? (
            <div className={`rounded-lg border border-dashed border-border/60 px-4 py-10 text-center text-sm text-muted-foreground ${isMobile ? 'mx-4' : ''}`}>
              Nenhum produto do pedido pôde ser carregado para revisão. Verifique se os itens têm produto vinculado no cadastro.
            </div>
          ) : isMobile ? (
            <div className="px-4 pb-4">
              <AtualizarPrecosMobileView
                secoesRender={secoesRender}
                costs={costs}
                inputs={inputs}
                setInputs={setInputs}
                selecionados={selecionados}
                onToggleSelect={handleToggle}
                onSelecionarTodos={handleSelecionarTodos}
                qtdComDiferenca={qtdComDiferenca}
                totalItens={itensCalc.length}
                unidadeVisualizacao={unidadeVisualizacao}
                onCostBlur={handleCostBlur}
                onDescontoPctBlur={handleDescontoPctBlur}
                onDescontoPctBlurDirect={handleDescontoPctBlurDirect}
                onMarkupBlur={handleMarkupBlur}
                onMarkupBlurDirect={handleMarkupBlurDirect}
                onPrecoBlur={handlePrecoBlur}
                getItemSubtitulo={getItemSubtitulo}
                onOpenUnitSelector={(item) => setUnitSelectorPreco({ open: true, product: item.produto, produtoId: item.produto_id })}
              />
            </div>
          ) : (
            <div className="rounded-lg overflow-x-auto shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-muted/90 text-foreground/90">
                  <tr>
                    <th className="w-8 p-2"></th>
                    <th className="text-left p-2 w-[96px] min-w-[88px]">Unidade</th>
                    <th className="text-left p-2 min-w-[200px]">Produto</th>
                    <th className="text-center p-2 w-[100px]">
                      <span className="block">Preço compra</span>
                      <span className="block text-[10px] font-normal text-muted-foreground">
                        {unidadeVisualizacao === 'comercial' ? 'unidade de compra' : 'unidade base'}
                      </span>
                    </th>
                    <th className="text-center p-2 w-[90px]">Desc/Acrésc %</th>
                    <th className="text-center p-2 w-[90px]">
                      <span className="block">Frete</span>
                      <span className="block text-[10px] font-normal text-muted-foreground">
                        {unidadeVisualizacao === 'comercial' ? 'unid. compra' : 'base'}
                      </span>
                    </th>
                    <th className="text-center p-2 w-[90px]">
                      <span className="block">Imp 1</span>
                      <span className="block text-[10px] font-normal text-muted-foreground">
                        {unidadeVisualizacao === 'comercial' ? 'unid. compra' : 'base'}
                      </span>
                    </th>
                    <th className="text-center p-2 w-[90px]">
                      <span className="block">Imp 2</span>
                      <span className="block text-[10px] font-normal text-muted-foreground">
                        {unidadeVisualizacao === 'comercial' ? 'unid. compra' : 'base'}
                      </span>
                    </th>
                    <th className="text-center p-2 w-[90px]">
                      <span className="block">Outros</span>
                      <span className="block text-[10px] font-normal text-muted-foreground">
                        {unidadeVisualizacao === 'comercial' ? 'unid. compra' : 'base'}
                      </span>
                    </th>
                    <th className="text-center p-2 w-[110px] bg-muted font-bold">
                      <span className="block">Custo total</span>
                      <span className="block text-[10px] font-normal opacity-90">
                        {unidadeVisualizacao === 'comercial' ? 'unid. compra' : 'unidade base'}
                      </span>
                    </th>
                    <th className="text-center p-2 w-[80px]">Markup %</th>
                    <th className="text-center p-2 w-[110px] bg-muted font-bold">
                      <span className="block">Preço venda</span>
                      <span className="block text-[10px] font-normal opacity-90">
                        {unidadeVisualizacao === 'comercial' ? 'unid. compra' : 'unidade base'}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {secoesRender.map((secao) => (
                    <Fragment key={secao.label || 'all'}>
                      {secao.label ? (
                        <tr className="bg-muted/60">
                          <td colSpan={12} className="p-2 text-xs font-semibold uppercase tracking-wide text-foreground/80">
                            {secao.label}
                          </td>
                        </tr>
                      ) : null}
                  {secao.items.map(item => (
                    <tr key={item.produto_id} className="border-b border-border/40/70 hover:bg-muted/40 dark:hover:bg-muted/50">
                      <td className="p-2 text-center">
                        {item.temDiferenca && (
                          <Checkbox checked={selecionados[item.produto_id] || false} onCheckedChange={() => handleToggle(item.produto_id)} />
                        )}
                      </td>
                      <td className="p-2 align-top bg-muted/40/90 dark:bg-background/35 border-r border-border/40">
                        {hasAlternativeUnits(item.produto) && buildPurchaseUnitOptions(item.produto).length > 1 && (
                          <button
                            type="button"
                            className="text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:underline mb-1 block"
                            onClick={() => setUnitSelectorPreco({ open: true, product: item.produto, produtoId: item.produto_id })}
                          >
                            Outra unidade
                          </button>
                        )}
                        {item.fatorExibicao > 1 && item.unidadeComercialLegenda ? (
                          <div>
                            <div className="text-xs font-bold text-foreground dark:text-foreground">{item.unidadeComercialLegenda}</div>
                            <div className="text-[10px] text-muted-foreground leading-snug mt-1">
                              {formatUnitConversion({ unidade: item.unidadeComercialLegenda, fator_conversao: item.fatorExibicao }, item.unidadeBase)}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs font-medium text-foreground/90">{item.unidadeBase}</div>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="font-medium text-foreground dark:text-foreground">{item.produto_nome}</div>
                        {getItemSubtitulo?.(item) ? (
                          <p className="text-[11px] text-muted-foreground mt-0.5">{getItemSubtitulo(item)}</p>
                        ) : null}
                        {item.temDiferenca && (
                          <div className="flex items-center gap-1 text-xs mt-0.5">
                            {item.diferencaCusto > 0 ? (
                              <><TrendingUp className="w-3 h-3 text-red-500" /><span className="text-red-600 dark:text-red-400 font-medium">+R$ {fmt(item.diferencaCusto * item.multDisplay)}</span></>
                            ) : (
                              <><TrendingDown className="w-3 h-3 text-green-500" /><span className="text-green-600 dark:text-green-400 font-medium">-R$ {fmt(Math.abs(item.diferencaCusto * item.multDisplay))}</span></>
                            )}
                          </div>
                        )}
                      </td>
                      {/* Preço Compra */}
                      <td className="p-2">
                        <Input
                          type="text"
                          value={inp(item.produto_id, 'valor_compra')}
                          onChange={(e) => setInp(item.produto_id, 'valor_compra', e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => handleCostBlur(item.produto_id, 'valor_compra')}
                          className="h-8 text-center text-sm bg-background border border-input shadow-sm"
                        />
                      </td>
                      {/* Desconto/Acréscimo % com toggle */}
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const rawInput = inputs[`${item.produto_id}_desconto_pct`];
                              const currentTyped = Math.round((parse(String(rawInput)) || 0) * 100) / 100;
                              const currentState = costs[item.produto_id]?.desconto_pct || 0;
                              const baseValue = currentTyped || currentState;
                              const flipped = baseValue === 0
                                ? (currentState < 0 ? 1 : -1)
                                : -baseValue;
                              setInputs(p => ({ ...p, [`${item.produto_id}_desconto_pct`]: String(Math.round(flipped * 100) / 100) }));
                              handleDescontoPctBlurDirect(item.produto_id, flipped);
                            }}
                            className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                              (costs[item.produto_id]?.desconto_pct || 0) < 0
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                            }`}
                            title={(costs[item.produto_id]?.desconto_pct || 0) < 0 ? 'Acréscimo → Desconto' : 'Desconto → Acréscimo'}
                          >
                            {(costs[item.produto_id]?.desconto_pct || 0) < 0
                              ? <TrendingUp className="w-3.5 h-3.5" />
                              : <TrendingDown className="w-3.5 h-3.5" />}
                          </button>
                          <Input
                            type="text"
                            value={inp(item.produto_id, 'desconto_pct')}
                            onChange={(e) => setInp(item.produto_id, 'desconto_pct', sanitizeTwoDecimalInput(e.target.value))}
                            onFocus={(e) => e.target.select()}
                            onBlur={() => handleDescontoPctBlur(item.produto_id)}
                            className={`h-8 text-center text-sm font-medium shadow-sm border flex-1 min-w-0 ${
                              (costs[item.produto_id]?.desconto_pct || 0) < 0
                                ? 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                                : (costs[item.produto_id]?.desconto_pct || 0) > 0
                                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                                : 'border-input bg-background text-foreground'
                            }`}
                          />
                        </div>
                      </td>
                      {/* Frete, Imp1, Imp2, Outros */}
                      {['custo_frete_padrao', 'custo_imposto1_padrao', 'custo_imposto2_padrao', 'custo_outros_padrao'].map(field => (
                        <td key={field} className="p-2">
                          <Input
                            type="text"
                            value={inp(item.produto_id, field)}
                            onChange={(e) => setInp(item.produto_id, field, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onBlur={() => handleCostBlur(item.produto_id, field)}
                            className="h-8 text-center text-sm bg-background border border-input shadow-sm"
                          />
                        </td>
                      ))}
                      <td className="p-2 bg-muted/50">
                        <div className="text-center font-bold text-foreground dark:text-foreground">R$ {fmt(item.novoCusto * item.multDisplay)}</div>
                      </td>
                      <td className="p-2">
                        <Input
                          type="text"
                          value={inp(item.produto_id, 'markup')}
                          onChange={(e) => setInp(item.produto_id, 'markup', e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => handleMarkupBlur(item.produto_id)}
                          className="h-8 text-center text-sm bg-background border border-input shadow-sm"
                        />
                      </td>
                      <td className="p-2 bg-muted/50">
                        <Input
                          type="text"
                          value={inp(item.produto_id, 'preco')}
                          onChange={(e) => setInp(item.produto_id, 'preco', e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onBlur={() => handlePrecoBlur(item.produto_id)}
                          className="h-8 text-center text-sm bg-background border border-input shadow-sm font-bold"
                        />
                      </td>
                    </tr>
                  ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={`flex items-center justify-between gap-3 mt-6 pt-4 border-t border-border/40 dark:border-white/10 ${isMobile ? 'px-4 pb-4' : ''}`}>
          <Button variant="outline" onClick={() => onClose(false)} disabled={processando} className="border-0 shadow-sm">
            {qtdComDiferenca > 0 ? 'Ignorar' : 'Fechar'}
          </Button>
          {qtdComDiferenca > 0 && (
            <Button onClick={handleInitiateUpdate} disabled={processando || numSel === 0} className={isMobile ? COMPRAS_CTA : 'shadow-sm'}>
              {processando ? 'Aplicando...' : `Aplicar ${numSel} Selecionado(s)`}
            </Button>
          )}
        </div>

      </DialogContent>
      <ProductUnitSelectorDialog
        open={unitSelectorPreco.open}
        product={unitSelectorPreco.product}
        mode="purchase"
        onClose={() => setUnitSelectorPreco({ open: false, product: null, produtoId: null })}
        onConfirm={handleConfirmUnidadeLinha}
      />
    </Dialog>
  );
}