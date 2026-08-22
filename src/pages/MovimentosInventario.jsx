import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowDownCircle,
  ArrowRight,
  ArrowUpCircle,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { filterAndSortProducts } from '@/components/compras/productMatchingUtils';
import {
  buildSaleUnitOptions,
  calculateBaseQuantity,
  formatCommercialQuantity,
  formatUnitConversion,
  getItemUnitKey,
  normalizeUnitCode,
  resolvePrimaryFromFactorOne,
} from '@/lib/productUnits';
import { P38MobileLine, P38MobileLineList, P38StatusLabel, p38AccentKeyFromTone } from '@/components/ui/p38-mobile-line';
import { p38Accent } from '@/lib/p38ThemeSurfaces';
import { P38PageHeader } from '@/components/layout/P38PageHeader';

const P38_ACCENT_TEXT = p38Accent.success.text;
const P38_ACCENT_RING = 'ring-1 ring-[#4A5D23]/40 dark:ring-[#a4ce33]/40';
const P38_STEP_ACTIVE = 'border-[#4A5D23]/30 bg-secondary/60 text-foreground dark:border-[#a4ce33]/30 dark:bg-secondary/40';
const P38_STEP_ACTIVE_DOT = 'bg-[#4A5D23] text-white dark:bg-[#a4ce33] dark:text-[#1f1d22]';

const REFERENCIA_MOVIMENTO_INVENTARIO = 'MovimentoInventario';
const MOTIVOS_ENTRADA = ['Ajuste pontual de inventário', 'Entrada manual', 'Devolução ao estoque', 'Correção de saldo'];
const MOTIVOS_SAIDA = ['Ajuste pontual de inventário', 'Perda / avaria', 'Consumo interno', 'Correção de saldo'];

const round6 = (value) => Math.round((Number(value) || 0) * 1_000_000) / 1_000_000;

function parseQuantidade(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const str = String(value ?? '').trim();
  if (!str) return 0;
  const normalized = str.includes(',') ? str.replace(/\./g, '').replace(',', '.') : str;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getProdutoNome(produto) {
  return (
    produto?.nome ||
    [produto?.campo_hierarquico_1, produto?.campo_hierarquico_2, produto?.campo_hierarquico_3]
      .filter(Boolean)
      .join(' ') ||
    'Produto sem nome'
  );
}

function getProdutoCodigo(produto) {
  return produto?.codigo_interno || produto?.codigo_barras || produto?.id || '';
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getUnitOptions(produto) {
  if (!produto) return [];
  const fallback = normalizeUnitCode(produto?.unidade_principal) || 'UN';
  const options = buildSaleUnitOptions(produto, 1);
  if (options.length > 0) {
    return options.map((option) => ({
      ...option,
      id: option.id || option.unidade || 'primary',
      unidade: normalizeUnitCode(option.unidade) || fallback,
      fator_conversao: Number(option.fator_conversao) > 0 ? Number(option.fator_conversao) : 1,
    }));
  }
  return [{
    id: 'primary',
    nome: 'Unidade base',
    unidade: fallback,
    fator_conversao: 1,
    is_primary: true,
  }];
}

function getProdutoUnidadeId(unit) {
  if (!unit) return 'principal';
  if (unit.is_primary || unit.id === 'primary') return 'principal';
  return unit.id || unit.unidade;
}

function getCartKey(produtoId, unidade) {
  return getItemUnitKey(produtoId, unidade || 'UN');
}

function isInventarioManual(movimento) {
  return (
    movimento?.referencia_tipo === REFERENCIA_MOVIMENTO_INVENTARIO ||
    movimento?.origem_tipo === REFERENCIA_MOVIMENTO_INVENTARIO
  );
}

function createCartItem(produto, unit, quantidadeComercial) {
  const fator = Number(unit?.fator_conversao) > 0 ? Number(unit.fator_conversao) : 1;
  const unidade = normalizeUnitCode(unit?.unidade) || normalizeUnitCode(produto?.unidade_principal) || 'UN';
  const quantidade = round6(quantidadeComercial);
  const quantidadeBase = round6(calculateBaseQuantity(quantidade, fator));
  const unidadeBase = normalizeUnitCode(resolvePrimaryFromFactorOne(produto, produto?.unidade_principal || unidade)) || 'UN';

  return {
    item_key: getCartKey(produto.id, unidade),
    produto_id: produto.id,
    produto_nome: getProdutoNome(produto),
    codigo_produto: getProdutoCodigo(produto),
    quantidade_comercial: quantidade,
    quantidade_base: quantidadeBase,
    unidade_medida: unidade,
    unidade_sigla: unidade,
    produto_unidade_id: getProdutoUnidadeId(unit),
    fator_conversao: fator,
    unidade_base: unidadeBase,
    estoque_atual_base: round6(produto?.estoque_atual),
    produto_snapshot: produto,
  };
}

function StepPill({ number, title, description, active = false, done = false, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm ${
      active
        ? P38_STEP_ACTIVE
        : 'border-border/40 bg-card text-foreground/90 dark:border-border/40 dark:bg-background dark:text-foreground/90'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          done
            ? 'bg-[#4A5D23] text-white dark:bg-[#a4ce33] dark:text-[#1f1d22]'
            : active
              ? P38_STEP_ACTIVE_DOT
              : 'bg-muted text-muted-foreground dark:bg-muted'
        }`}>
          {done ? <CheckCircle2 className="h-4 w-4" /> : number}
        </div>
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="mt-0.5 text-xs opacity-75">{description}</p>
        </div>
      </div>
    </button>
  );
}

function ProductRow({ product, active, inCart, onSelect, striped }) {
  const unidadeBase = resolvePrimaryFromFactorOne(product, product?.unidade_principal || 'UN');
  const accent = active ? 'info' : inCart ? 'success' : 'default';

  return (
    <P38MobileLine
      as="button"
      type="button"
      striped={striped}
      accent={p38AccentKeyFromTone(accent)}
      onClick={() => onSelect(product)}
      className={`w-full text-left flex items-start gap-3 p-4 min-h-[52px] ${active ? P38_ACCENT_RING : ''}`}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
        <Package className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold">{getProdutoNome(product)}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {getProdutoCodigo(product) && <span>#{getProdutoCodigo(product)}</span>}
          <span>Estoque: {formatCommercialQuantity(product.estoque_atual, unidadeBase)} {unidadeBase}</span>
        </div>
      </div>
      {inCart && (
        <Badge className="border-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-100 shrink-0">
          no carrinho
        </Badge>
      )}
    </P38MobileLine>
  );
}

function SelectedProductEditor({
  product,
  unitCode,
  quantityInput,
  editingKey,
  onUnitChange,
  onQuantityInput,
  onIncrement,
  onAdd,
  onCancelEdit,
}) {
  if (!product) {
    return (
      <div className="rounded-2xl border border-dashed border-border/40 bg-muted/40 p-8 text-center dark:border-border/40 dark:bg-background/60">
        <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="font-medium text-foreground/90">Escolha um produto na lista</p>
        <p className="mt-1 text-sm text-muted-foreground">Depois informe unidade e quantidade no mesmo painel.</p>
      </div>
    );
  }

  const units = getUnitOptions(product);
  const selectedUnit = units.find((unit) => unit.unidade === unitCode) || units[0];
  const unidadeBase = resolvePrimaryFromFactorOne(product, product.unidade_principal || 'UN');
  const qtd = parseQuantidade(quantityInput);
  const quantidadeBase = selectedUnit
    ? round6(calculateBaseQuantity(qtd, selectedUnit.fator_conversao || 1))
    : 0;

  return (
    <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm dark:bg-background">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-xs font-semibold uppercase tracking-wide ${P38_ACCENT_TEXT}`}>
            Produto selecionado
          </p>
          <h3 className="mt-1 line-clamp-2 font-semibold text-foreground dark:text-white">{getProdutoNome(product)}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Estoque atual: {formatCommercialQuantity(product.estoque_atual, unidadeBase)} {unidadeBase}
          </p>
        </div>
        {editingKey && <Badge variant="secondary">editando</Badge>}
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <Label className="mb-1.5 block text-xs">Unidade do ajuste</Label>
          <Select value={selectedUnit?.unidade || ''} onValueChange={onUnitChange}>
            <SelectTrigger className="h-12 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {units.map((unit) => (
                <SelectItem key={`${unit.id}-${unit.unidade}`} value={unit.unidade}>
                  {unit.unidade} · {formatUnitConversion(unit, unidadeBase)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-1.5 block text-xs">Quantidade</Label>
          <div className="flex h-12 items-center rounded-xl border border-input bg-background">
            <button
              type="button"
              onClick={() => onIncrement(-1)}
              className="flex h-full w-12 items-center justify-center text-muted-foreground hover:text-foreground dark:hover:text-white"
            >
              <Minus className="h-4 w-4" />
            </button>
            <Input
              value={quantityInput}
              onChange={(event) => onQuantityInput(event.target.value)}
              inputMode="decimal"
              className="h-full border-0 bg-transparent text-center text-lg font-semibold shadow-none focus-visible:ring-0"
              onFocus={(event) => event.target.select()}
            />
            <button
              type="button"
              onClick={() => onIncrement(1)}
              className="flex h-full w-12 items-center justify-center text-muted-foreground hover:text-foreground dark:hover:text-white"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-xl bg-muted/40 p-3 text-sm dark:bg-background md:flex-row md:items-center md:justify-between">
        <div>
          <span className="block text-xs uppercase tracking-wide text-muted-foreground">Conversão para estoque</span>
          <strong className="text-foreground">
            {formatCommercialQuantity(qtd, selectedUnit?.unidade)} {selectedUnit?.unidade} = {formatCommercialQuantity(quantidadeBase, unidadeBase)} {unidadeBase}
          </strong>
        </div>
        <div className="flex gap-2">
          {editingKey && (
            <Button variant="outline" onClick={onCancelEdit}>
              Cancelar edição
            </Button>
          )}
          <Button onClick={onAdd} disabled={!selectedUnit || quantidadeBase <= 0}>
            {editingKey ? 'Salvar no carrinho' : 'Adicionar ao carrinho'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CartPanel({ items, tipo, onEdit, onRemove }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/40 p-8 text-center dark:border-border/40">
        <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="font-medium text-foreground/90">Carrinho vazio</p>
        <p className="mt-1 text-sm text-muted-foreground">Adicione produtos para montar o ajuste.</p>
      </div>
    );
  }

  return (
    <P38MobileLineList>
      {items.map((item, index) => (
        <P38MobileLine
          key={item.item_key}
          striped={index % 2 === 1}
          accent={p38AccentKeyFromTone(tipo === 'Entrada' ? 'success' : 'danger')}
          className="flex items-start gap-3 p-3"
        >
          <button type="button" onClick={() => onEdit(item)} className="min-w-0 flex-1 text-left">
            <p className="line-clamp-2 text-sm font-semibold">{item.produto_nome}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatCommercialQuantity(item.quantidade_comercial, item.unidade_medida)} {item.unidade_medida}
              {' '}= {formatCommercialQuantity(item.quantidade_base, item.unidade_base)} {item.unidade_base}
            </p>
            <P38StatusLabel tone={tipo === 'Entrada' ? 'success' : 'danger'} className="mt-1">
              {tipo}
            </P38StatusLabel>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
            onClick={() => onRemove(item.item_key)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </P38MobileLine>
      ))}
    </P38MobileLineList>
  );
}

function ReviewPanel({ rows, tipo }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/40 p-6 text-center text-sm text-muted-foreground dark:border-border/40">
        A prévia aparece depois que o carrinho tiver itens.
      </div>
    );
  }

  return (
    <P38MobileLineList>
      {rows.map((row, index) => (
        <P38MobileLine
          key={row.produto_id}
          striped={index % 2 === 1}
          accent={p38AccentKeyFromTone(row.estoque_depois < 0 ? 'danger' : tipo === 'Entrada' ? 'success' : 'warning')}
          className="flex-col items-stretch gap-3 p-3"
        >
          <p className="line-clamp-2 text-sm font-semibold">{row.produto_nome}</p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-card border border-border p-2">
              <span className="block text-muted-foreground">Antes</span>
              <strong className="tabular-nums">{formatCommercialQuantity(row.estoque_antes, row.unidade_base)} {row.unidade_base}</strong>
            </div>
            <div className="rounded-xl bg-card border border-border p-2">
              <span className="block text-muted-foreground">{tipo}</span>
              <strong className={tipo === 'Entrada' ? 'text-emerald-700' : 'text-red-700'}>
                {tipo === 'Entrada' ? '+' : '-'}{formatCommercialQuantity(row.quantidade_base, row.unidade_base)}
              </strong>
            </div>
            <div className="rounded-xl bg-card border border-border p-2">
              <span className="block text-muted-foreground">Depois</span>
              <strong className={row.estoque_depois < 0 ? 'text-red-700' : 'tabular-nums'}>
                {formatCommercialQuantity(row.estoque_depois, row.unidade_base)} {row.unidade_base}
              </strong>
            </div>
          </div>
        </P38MobileLine>
      ))}
    </P38MobileLineList>
  );
}

function RecentMovements({ movimentos }) {
  if (movimentos.length === 0) return null;
  return (
    <Card className="border-border/40">
      <CardHeader>
        <CardTitle className="text-base">Últimos ajustes</CardTitle>
      </CardHeader>
      <CardContent>
        <P38MobileLineList>
          {movimentos.slice(0, 5).map((movimento, index) => (
            <P38MobileLine
              key={movimento.id || `${movimento.produto_id}-${movimento.created_date}`}
              striped={index % 2 === 1}
              accent={p38AccentKeyFromTone(movimento.tipo === 'Entrada' ? 'success' : 'danger')}
              title={movimento.produto_nome || movimento.produto_id || 'Produto'}
              subtitle={
                <>
                  {formatDate(movimento.created_date || movimento.created_at)}
                  {' · '}
                  {formatCommercialQuantity(movimento.quantidade_comercial || movimento.quantidade, movimento.unidade_medida)}{' '}
                  {movimento.unidade_medida || 'base'}
                </>
              }
              trailing={
                <P38StatusLabel tone={movimento.tipo === 'Entrada' ? 'success' : 'danger'}>
                  {movimento.tipo}
                </P38StatusLabel>
              }
            />
          ))}
        </P38MobileLineList>
      </CardContent>
    </Card>
  );
}

function StepFooter({ activeStep, canGoNext, onPrevious, onNext }) {
  const isFirst = activeStep === 'setup';
  const isLast = activeStep === 'review';
  return (
    <div className="mt-6 flex flex-col gap-3 border-t border-border/40 pt-4 dark:border-border/40 sm:flex-row sm:items-center sm:justify-between">
      <Button variant="outline" onClick={onPrevious} disabled={isFirst} className="rounded-2xl">
        Anterior
      </Button>
      <div className="text-center text-xs text-muted-foreground">
        {isFirst ? 'Configure o ajuste' : isLast ? 'Confira e conclua' : 'Adicione os produtos ao carrinho'}
      </div>
      <Button onClick={onNext} disabled={isLast || !canGoNext} className="rounded-2xl">
        Próxima
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

export default function MovimentosInventario() {
  const [produtos, setProdutos] = useState([]);
  const [movimentosRecentes, setMovimentosRecentes] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tipo, setTipo] = useState('Entrada');
  const [motivo, setMotivo] = useState('Ajuste pontual de inventário');
  const [documentoReferencia, setDocumentoReferencia] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedUnitCode, setSelectedUnitCode] = useState('');
  const [quantityInput, setQuantityInput] = useState('1');
  const [editingKey, setEditingKey] = useState('');
  const [cartItems, setCartItems] = useState([]);
  const [activeStep, setActiveStep] = useState('setup');

  useEffect(() => {
    loadInitialData();
  }, []);

  const motivosDisponiveis = tipo === 'Entrada' ? MOTIVOS_ENTRADA : MOTIVOS_SAIDA;

  useEffect(() => {
    if (!motivosDisponiveis.includes(motivo)) {
      setMotivo(motivosDisponiveis[0]);
    }
  }, [motivo, motivosDisponiveis]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [userData, produtosData, movimentosData] = await Promise.all([
        base44.auth.me().catch(() => null),
        base44.entities.Produto.filter({ ativo: true }, '-created_date').catch(() => []),
        base44.entities.MovimentacaoEstoque.list('-created_date', 80).catch(() => []),
      ]);
      setCurrentUser(userData);
      setProdutos(Array.isArray(produtosData) ? produtosData.filter((p) => p?.id) : []);
      setMovimentosRecentes((Array.isArray(movimentosData) ? movimentosData : [])
        .filter(isInventarioManual)
        .slice(0, 12));
    } catch (error) {
      console.error('Erro ao carregar movimentos de inventário:', error);
      toast.error('Erro ao carregar dados de inventário.');
    } finally {
      setLoading(false);
    }
  };

  const filteredProdutos = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return filterAndSortProducts(produtos, searchTerm, { limit: 30 });
  }, [produtos, searchTerm]);

  const cartByKey = useMemo(() => {
    const map = new Map();
    cartItems.forEach((item) => map.set(item.item_key, item));
    return map;
  }, [cartItems]);

  const unitOptions = useMemo(() => getUnitOptions(selectedProduct), [selectedProduct]);
  const selectedUnit = unitOptions.find((unit) => unit.unidade === selectedUnitCode) || unitOptions[0];

  const reviewRows = useMemo(() => {
    const grouped = new Map();
    cartItems.forEach((item) => {
      const current = grouped.get(item.produto_id) || {
        produto_id: item.produto_id,
        produto_nome: item.produto_nome,
        unidade_base: item.unidade_base,
        estoque_antes: item.estoque_atual_base,
        quantidade_base: 0,
      };
      current.quantidade_base = round6(current.quantidade_base + item.quantidade_base);
      grouped.set(item.produto_id, current);
    });
    return [...grouped.values()].map((row) => {
      const delta = tipo === 'Entrada' ? row.quantidade_base : -row.quantidade_base;
      return { ...row, estoque_depois: round6(row.estoque_antes + delta) };
    }).sort((a, b) => a.produto_nome.localeCompare(b.produto_nome, 'pt-BR'));
  }, [cartItems, tipo]);

  const hasNegativeStock = reviewRows.some((row) => row.estoque_depois < 0);
  const setupReady = Boolean(tipo && motivo);
  const cartReady = cartItems.length > 0;
  const activeStepIndex = ['setup', 'items', 'review'].indexOf(activeStep);
  const canGoNext = activeStep === 'setup' || (activeStep === 'items' && cartReady);

  const goPreviousStep = () => {
    if (activeStep === 'items') setActiveStep('setup');
    if (activeStep === 'review') setActiveStep('items');
  };

  const goNextStep = () => {
    if (activeStep === 'setup') setActiveStep('items');
    if (activeStep === 'items') {
      if (!cartReady) {
        toast.error('Adicione pelo menos um item ao carrinho para revisar.');
        return;
      }
      setActiveStep('review');
    }
  };

  const handleSelectProduct = async (produto) => {
    setSelectedProduct(produto);
    setSelectedUnitCode(getUnitOptions(produto)[0]?.unidade || '');
    setQuantityInput('1');
    setEditingKey('');
    try {
      const full = await base44.entities.Produto.get(produto.id);
      if (!full?.id) return;
      setProdutos((prev) => prev.map((p) => (p.id === full.id ? { ...p, ...full } : p)));
      setSelectedProduct((prev) => (prev?.id === full.id ? { ...prev, ...full } : prev));
      setSelectedUnitCode(getUnitOptions(full)[0]?.unidade || '');
    } catch (error) {
      console.warn('[MovimentosInventario] Produto.get falhou; usando linha da lista.', error);
    }
  };

  const handleIncrementQuantity = (delta) => {
    const next = Math.max(0, round6(parseQuantidade(quantityInput) + delta));
    setQuantityInput(formatCommercialQuantity(next, selectedUnit?.unidade));
  };

  const handleQuantityInput = (value) => {
    if (/^[\d.,]*$/.test(value)) setQuantityInput(value);
  };

  const handleAddToCart = () => {
    if (!selectedProduct || !selectedUnit) {
      toast.error('Selecione um produto.');
      return;
    }
    const quantity = parseQuantidade(quantityInput);
    if (quantity <= 0) {
      toast.error('Informe uma quantidade maior que zero.');
      return;
    }
    const item = createCartItem(selectedProduct, selectedUnit, quantity);
    setCartItems((prev) => {
      const keyToReplace = editingKey || item.item_key;
      const rest = prev.filter((cartItem) => cartItem.item_key !== keyToReplace);
      return [...rest, item].sort((a, b) => a.produto_nome.localeCompare(b.produto_nome, 'pt-BR'));
    });
    setEditingKey('');
    setQuantityInput('1');
    toast.success('Item adicionado ao carrinho.');
  };

  const handleEditItem = (item) => {
    setSelectedProduct(item.produto_snapshot);
    setSelectedUnitCode(item.unidade_medida);
    setQuantityInput(formatCommercialQuantity(item.quantidade_comercial, item.unidade_medida));
    setEditingKey(item.item_key);
    setSearchTerm(item.produto_nome);
    setActiveStep('items');
  };

  const handleRemoveItem = (itemKey) => {
    setCartItems((prev) => prev.filter((item) => item.item_key !== itemKey));
    if (editingKey === itemKey) {
      setEditingKey('');
      setQuantityInput('1');
    }
  };

  const handleCancelEdit = () => {
    setEditingKey('');
    setQuantityInput('1');
  };

  const handleConcluir = async () => {
    if (cartItems.length === 0) {
      toast.error('Adicione pelo menos um item ao carrinho.');
      return;
    }
    if (hasNegativeStock) {
      toast.error('Há item que deixaria estoque negativo. Ajuste antes de concluir.');
      return;
    }

    setSaving(true);
    try {
      const produtosAtuais = await Promise.all(
        [...new Set(cartItems.map((item) => item.produto_id))].map((id) => base44.entities.Produto.get(id))
      );
      const produtosMap = new Map(produtosAtuais.filter(Boolean).map((produto) => [produto.id, produto]));
      const usuario = currentUser?.full_name || currentUser?.email || 'Sistema';
      const referenciaNumero = documentoReferencia.trim();
      const createdMovements = [];
      const updatedProducts = [];

      for (const row of reviewRows) {
        const produto = produtosMap.get(row.produto_id) || cartItems.find((item) => item.produto_id === row.produto_id)?.produto_snapshot;
        const estoqueAntesReal = round6(produto?.estoque_atual);
        const estoqueDepoisReal = tipo === 'Entrada'
          ? round6(estoqueAntesReal + row.quantidade_base)
          : round6(estoqueAntesReal - row.quantidade_base);

        if (estoqueDepoisReal < 0) {
          toast.error(`A saída deixaria ${getProdutoNome(produto)} com estoque negativo.`);
          return;
        }

        const itensProduto = cartItems.filter((item) => item.produto_id === row.produto_id);
        for (const item of itensProduto) {
          const obsContexto = [
            observacoes.trim(),
            `Estoque: ${formatCommercialQuantity(estoqueAntesReal, row.unidade_base)} ${row.unidade_base} -> ${formatCommercialQuantity(estoqueDepoisReal, row.unidade_base)} ${row.unidade_base}`,
            `Lancado em ${formatCommercialQuantity(item.quantidade_comercial, item.unidade_medida)} ${item.unidade_medida} (fator ${item.fator_conversao})`,
          ].filter(Boolean).join(' | ');

          const payloadMovimento = {
            produto_id: item.produto_id,
            produto_nome: item.produto_nome,
            tipo,
            motivo,
            quantidade: item.quantidade_base,
            quantidade_base: item.quantidade_base,
            quantidade_comercial: item.quantidade_comercial,
            unidade_medida: item.unidade_medida,
            unidade_sigla: item.unidade_sigla,
            produto_unidade_id: item.produto_unidade_id,
            fator_conversao: item.fator_conversao,
            custo_unitario: Number(produto?.preco_custo_calculado) || Number(produto?.valor_compra) || 0,
            documento_referencia: referenciaNumero,
            referencia_tipo: REFERENCIA_MOVIMENTO_INVENTARIO,
            referencia_numero: referenciaNumero || 'Ajuste manual',
            origem_tipo: REFERENCIA_MOVIMENTO_INVENTARIO,
            origem_id: referenciaNumero || null,
            observacoes: obsContexto,
            usuario_responsavel: usuario,
          };
          const created = await base44.entities.MovimentacaoEstoque.create(payloadMovimento);
          createdMovements.push({ ...payloadMovimento, ...created });
        }

        const updated = await base44.entities.Produto.update(row.produto_id, { estoque_atual: estoqueDepoisReal });
        updatedProducts.push({ ...produto, ...updated, estoque_atual: estoqueDepoisReal });
      }

      const productMap = new Map(updatedProducts.map((product) => [product.id, product]));
      setProdutos((prev) => prev.map((produto) => (
        productMap.has(produto.id) ? { ...produto, ...productMap.get(produto.id) } : produto
      )));
      setMovimentosRecentes((prev) => [...createdMovements, ...prev].slice(0, 12));
      setCartItems([]);
      setSelectedProduct(null);
      setEditingKey('');
      setQuantityInput('1');
      setDocumentoReferencia('');
      setObservacoes('');
      setActiveStep('setup');
      toast.success(`${createdMovements.length} movimento(s) registrado(s) com sucesso.`);
    } catch (error) {
      console.error('Erro ao concluir movimentos de inventário:', error);
      toast.error(error?.message || 'Erro ao concluir movimentos de inventário.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-din-1451 p-4 pb-[var(--p38-scroll-pad-below-nav)] md:p-8 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <P38PageHeader
            variant="page"
            kicker="Estoque"
            title="Movimentos de Inventário"
            description="Ajuste pontual com caminho único: configure o tipo, adicione produtos ao carrinho, confira antes/depois e conclua."
          />
          <Button variant="outline" onClick={loadInitialData} disabled={loading || saving}>
            Atualizar dados
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <StepPill
            number="1"
            title="Configurar"
            description="Entrada/saída, motivo e referência"
            active={activeStep === 'setup'}
            done={setupReady && activeStepIndex > 0}
            onClick={() => setActiveStep('setup')}
          />
          <StepPill
            number="2"
            title="Adicionar itens"
            description="Buscar produto, unidade e quantidade"
            active={activeStep === 'items'}
            done={cartReady && activeStepIndex > 1}
            onClick={() => setActiveStep('items')}
          />
          <StepPill
            number="3"
            title="Conferir e concluir"
            description="Validar antes/depois do estoque"
            active={activeStep === 'review'}
            done={false}
            onClick={() => setActiveStep('review')}
          />
        </div>

        {activeStep === 'setup' && (
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheck className={`h-5 w-5 ${P38_ACCENT_TEXT}`} />
              1. Configuração do ajuste
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="rounded-2xl bg-muted p-1 dark:bg-background">
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setTipo('Entrada')}
                    className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${
                      tipo === 'Entrada'
                        ? 'bg-card text-emerald-700 shadow-sm dark:bg-muted dark:text-emerald-400'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <ArrowUpCircle className="h-4 w-4" />
                    Entrada
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipo('Saída')}
                    className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${
                      tipo === 'Saída'
                        ? 'bg-card text-red-700 shadow-sm dark:bg-muted dark:text-red-400'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <ArrowDownCircle className="h-4 w-4" />
                    Saída
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block text-xs">Motivo</Label>
                  <Select value={motivo} onValueChange={setMotivo}>
                    <SelectTrigger className="h-12 rounded-2xl bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {motivosDisponiveis.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="documento-referencia" className="mb-1.5 block text-xs">Referência opcional</Label>
                  <Input
                    id="documento-referencia"
                    value={documentoReferencia}
                    onChange={(event) => setDocumentoReferencia(event.target.value)}
                    placeholder="Ex: ajuste balcão, OS, romaneio"
                    className="h-12 rounded-2xl bg-card"
                  />
                </div>
              </div>
            </div>
            <StepFooter
              activeStep={activeStep}
              canGoNext={canGoNext}
              onPrevious={goPreviousStep}
              onNext={goNextStep}
            />
          </CardContent>
        </Card>
        )}

        {activeStep === 'items' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
          <Card className="border-border/40">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Search className={`h-5 w-5 ${P38_ACCENT_TEXT}`} />
                2. Adicionar produtos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar produto por nome, código ou marca..."
                  className="h-12 rounded-2xl p38-search-field border-0 pl-12 text-base shadow-none"
                />
              </div>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
                <div className="min-h-[420px] space-y-2">
                  {!searchTerm.trim() ? (
                    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-border/40 bg-card p-8 text-center dark:border-border/40 dark:bg-background">
                      <Search className="mb-4 h-14 w-14 text-muted-foreground" />
                      <p className="font-semibold text-foreground">Digite para buscar um produto</p>
                      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                        O próximo passo aparece no painel ao lado: unidade, quantidade e botão para adicionar ao carrinho.
                      </p>
                    </div>
                  ) : filteredProdutos.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-border/40 bg-card p-8 text-center text-muted-foreground dark:border-border/40 dark:bg-background">
                      Nenhum produto encontrado para "{searchTerm}".
                    </div>
                  ) : (
                    <P38MobileLineList allViewports className="max-h-[420px] overflow-y-auto rounded-2xl">
                      {filteredProdutos.map((product, index) => {
                        const units = getUnitOptions(product);
                        const anyInCart = units.some((unit) => cartByKey.has(getCartKey(product.id, unit.unidade)));
                        return (
                          <ProductRow
                            key={product.id}
                            product={product}
                            striped={index % 2 === 1}
                            active={selectedProduct?.id === product.id}
                            inCart={anyInCart}
                            onSelect={handleSelectProduct}
                          />
                        );
                      })}
                    </P38MobileLineList>
                  )}
                </div>

                <SelectedProductEditor
                  product={selectedProduct}
                  unitCode={selectedUnitCode}
                  quantityInput={quantityInput}
                  editingKey={editingKey}
                  onUnitChange={setSelectedUnitCode}
                  onQuantityInput={handleQuantityInput}
                  onIncrement={handleIncrementQuantity}
                  onAdd={handleAddToCart}
                  onCancelEdit={handleCancelEdit}
                />
              </div>
              <StepFooter
                activeStep={activeStep}
                canGoNext={canGoNext}
                onPrevious={goPreviousStep}
                onNext={goNextStep}
              />
            </CardContent>
          </Card>

          <div className="space-y-6 xl:sticky xl:top-4 xl:self-start">
            <Card className="border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-lg">
                  <span className="flex items-center gap-2">
                    <ShoppingCart className={`h-5 w-5 ${P38_ACCENT_TEXT}`} />
                    3. Carrinho e conclusão
                  </span>
                  <Badge variant="secondary">{cartItems.length} {cartItems.length === 1 ? 'item' : 'itens'}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <CartPanel items={cartItems} tipo={tipo} onEdit={handleEditItem} onRemove={handleRemoveItem} />
                <Button
                  variant="outline"
                  className="h-12 w-full rounded-2xl"
                  onClick={() => setActiveStep('review')}
                  disabled={cartItems.length === 0}
                >
                  Conferir antes/depois
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <RecentMovements movimentos={movimentosRecentes} />
          </div>
        </div>
        )}

        {activeStep === 'review' && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
            <Card className="border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShoppingCart className={`h-5 w-5 ${P38_ACCENT_TEXT}`} />
                  3. Conferir carrinho
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <CartPanel items={cartItems} tipo={tipo} onEdit={handleEditItem} onRemove={handleRemoveItem} />
                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações gerais</Label>
                  <Textarea
                    id="observacoes"
                    value={observacoes}
                    onChange={(event) => setObservacoes(event.target.value)}
                    placeholder="Explique rapidamente o motivo operacional do ajuste."
                    className="min-h-24 rounded-2xl"
                  />
                </div>
                <StepFooter
                  activeStep={activeStep}
                  canGoNext={canGoNext}
                  onPrevious={goPreviousStep}
                  onNext={goNextStep}
                />
              </CardContent>
            </Card>

            <Card className="border-border/40 xl:sticky xl:top-4 xl:self-start">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-lg">
                  <span>Antes e depois</span>
                  {hasNegativeStock && <Badge variant="destructive">corrigir saída</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <ReviewPanel rows={reviewRows} tipo={tipo} />
                {hasNegativeStock && (
                  <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                    Há produto que ficaria negativo. Edite ou remova o item antes de concluir.
                  </div>
                )}
                <Button
                  className="h-12 w-full rounded-2xl"
                  onClick={handleConcluir}
                  disabled={saving || cartItems.length === 0 || hasNegativeStock}
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                  Concluir movimentos
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
