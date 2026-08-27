import React, { useState, useCallback, useMemo, useEffect, useLayoutEffect, useRef, createContext, useContext } from 'react';
import { ChevronRight, DollarSign, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useCatalogTreeGrid,
  flattenTree,
  mergeAdjacentDuplicateGroupHeaders,
  catalogProdutosStructureSig,
  collectSkus,
  resolveExpandedKeysForMasterLevel,
  TREE_GRID_EXPAND_ALL_LEVEL,
} from './treegrid/useTreeGrid';
import {
  catalogGroupAnalysisSig,
  getCatalogFlattenOptions,
  pruneTreeForGroupAnalysis,
} from '@/lib/catalogGroupAnalysis';
import {
  aggregateCatalogEstoqueExibicao,
  resolveCatalogEstoqueExibicao,
} from '@/lib/catalogEstoqueVirtual';
import { lineValorCustoTotal } from '@/lib/catalogStockTotals';
import {
  buildPurchaseUnitOptions,
  buildSaleUnitOptions,
  formatEstoqueApresentacao,
  getCatalogoComercialView,
  resolveCustoTotalUnitBaseProduto,
} from '@/lib/productUnits';
import { useVirtualRows } from '@/hooks/useVirtualRows';
import { CATALOGO_VIRTUALIZE_MIN_ROWS } from '@/lib/p38VirtualList';
import {
  p38Table,
  MARGIN_ACCENT_VALUE,
} from '@/lib/p38TableSurfaces';
import { p38Accent } from '@/lib/p38ThemeSurfaces';
import { cn } from '@/components/utils';
import FontScaleControl from '@/components/accessibility/FontScaleControl';
import { FONT_SCALE_CHANGE_EVENT, getStoredFontScale } from '@/lib/fontScale';

const fmtR = (n) => (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN = (n) => (n ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

const CATALOGO_MOBILE_VALUES_GRID = 'grid grid-cols-3 gap-x-1.5 min-w-0';
const CATALOGO_MOBILE_BODY_TEXT = 'font-din-1451 text-base tablet-landscape:text-lg font-normal leading-none';
/** Mesmo tamanho dos valores da tabela; cor mais suave para distinguir rótulos. */
const CATALOGO_MOBILE_HEADER_LABEL = `${CATALOGO_MOBILE_BODY_TEXT} uppercase tracking-tight text-right text-foreground/70 dark:text-muted-foreground min-w-0`;
/** Largura fixa da coluna qtd/un — eixo da linha divisória sagrada (nunca se move). */
const CATALOGO_MOBILE_QTD_W = '3.25rem';
const CATALOG_ROW_PL = 'pl-2.5';
/** Posição horizontal fixa do eixo (pl da linha + largura qtd). Tudo varia exceto isto. */
const CATALOG_AXIS_LEFT = 'calc(0.625rem + 3.25rem)';
const CATALOGO_MOBILE_QTD_COL =
  'relative shrink-0 pr-1.5 pt-3 pb-3 text-right self-stretch';
/** Respiro entre a linha vertical e o texto da descrição. */
const CATALOG_DESC_PL_AFTER_LINE = 12;
/** Recuo dos filhos só à direita da linha (qtd e divisor ficam fixos). */
const CATALOG_INDENT_STEP = 12;
/** Altura fixa para 3 linhas de descrição (12px × leading-relaxed). */
const CATALOGO_MOBILE_DESC_MIN_H = 'min-h-[3.75rem]';
const CATALOGO_MOBILE_DESC_GAP = 'mb-2.5';
const CATALOGO_MOBILE_NOME_TYPO =
  'text-[13px] font-normal leading-relaxed uppercase break-words [overflow-wrap:anywhere]';
const CATALOGO_MOBILE_ROW_H_GROUP = 118;
const CATALOGO_MOBILE_ROW_H_SKU = 196;

/** Faixa de grupo — faixa analítica compacta (≠ linha de produto). */
const CATALOG_MOBILE_GROUP_BAND = {
  root: 'bg-[#4a5240]/10 dark:bg-[#a4ce33]/10 border-b border-[#4a5240]/20 dark:border-[#a4ce33]/25',
  nested: 'bg-muted/45 dark:bg-muted/20 border-b border-border/50',
  category: 'bg-muted/60 dark:bg-muted/25 border-b border-border/60',
};
/** Linha de SKU — cartão de produto dentro da rua. */
const CATALOG_MOBILE_SKU_SURFACE = {
  root: 'bg-background border-b border-border/40',
  nested: 'bg-background/95 border-b border-border/35 shadow-[inset_0_1px_0_0_hsl(var(--border)/0.35)]',
};

const CatalogoMobileScrollContext = createContext(null);

/** Elemento que faz scroll (painel `.p38-stage-panel-scroll` do Layout no mobile). */
export function useCatalogoMobileScrollElement() {
  return useContext(CatalogoMobileScrollContext);
}

/** @deprecated Preferir useCatalogoMobileScrollElement — mantido para compat. */
export function useCatalogoMobileScrollRef() {
  const scrollElement = useCatalogoMobileScrollElement();
  const scrollRef = useRef(null);
  scrollRef.current = scrollElement;
  return scrollRef;
}

/** Mesma diagramação do relatório de margem mobile (2×3 valores). */
const CATALOGO_MOBILE_VALUE_ROWS = [
  [
    { key: 'valorCompra', label: 'COMPRA' },
    { key: 'custoCalculado', label: 'CUSTO' },
    { key: 'markup', label: 'MK%' },
  ],
  [
    { key: 'precoVenda', label: 'VENDA' },
    { key: 'inventarioValorizado', label: 'INVENT.' },
    { key: 'estoqueAtual', label: 'ESTOQUE' },
  ],
];

function getCatalogRowTier(row) {
  if (row?.type === 'group') return (row.level ?? 1) <= 1 ? 'pai' : 'pai-filho';
  return (row.level ?? 1) <= 1 ? 'solteiro' : 'filho';
}

function catalogDescIndent(level = 1) {
  return Math.max(0, level - 1) * CATALOG_INDENT_STEP;
}

function catalogContentPadAfterLine(level = 1) {
  return CATALOG_DESC_PL_AFTER_LINE + catalogDescIndent(level);
}

function catalogNomeColorClass(tier) {
  if (tier === 'filho' || tier === 'pai-filho') return 'text-muted-foreground';
  return 'text-foreground';
}

function CatalogoMobileDescBlock({ nome, tier }) {
  return (
    <div className={cn(CATALOGO_MOBILE_DESC_MIN_H, CATALOGO_MOBILE_DESC_GAP, 'min-w-0 overflow-hidden')}>
      <p lang="pt-BR" className={cn('line-clamp-3', CATALOGO_MOBILE_NOME_TYPO, catalogNomeColorClass(tier))}>
        {nome}
      </p>
    </div>
  );
}

/** Coluna qtd/un com largura fixa (mantém o eixo da linha divisória). */
function CatalogoMobileQtdColShell({ children, className = '' }) {
  return (
    <div className={cn(CATALOGO_MOBILE_QTD_COL, className)} style={{ width: CATALOGO_MOBILE_QTD_W }}>
      {children}
    </div>
  );
}

/** Eixo vertical contínuo — uma só linha ininterrupta, não recua com indentação. */
function CatalogoMobileSacredAxis({ className = '' }) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-y-0 z-[10] w-0',
        'border-l border-border/40 dark:border-white/20',
        className,
      )}
      style={{ left: CATALOG_AXIS_LEFT }}
      aria-hidden
    />
  );
}

function formatCatalogoMobileNum(val) {
  return (val ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCatalogoMobilePct(val) {
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return `${n.toFixed(1).replace('.', ',')}%`;
}

function buildCatalogoMobileTabulatedValues(produto, catalogStockContext = null) {
  const cat = getCatalogoComercialView(produto);
  const inventario = lineValorCustoTotal(produto, catalogStockContext);
  const inventarioFmt = inventario > 0 ? formatCatalogoMobileNum(inventario) : '—';
  const markupPct = cat.markupSobreCustoPct > 0
    ? cat.markupSobreCustoPct
    : (produto?.preco_venda_percentual || 0);
  const est = resolveCatalogEstoqueExibicao(produto, catalogStockContext);
  const estoqueFmt = est.virtual && est.pendente > 0
    ? `~${fmtN(est.quantidade)}`
    : fmtN(est.quantidade);

  return {
    valorCompra: cat.valorCompraNaEmbalagem > 0 ? formatCatalogoMobileNum(cat.valorCompraNaEmbalagem) : '—',
    custoCalculado: cat.custoNaEmbalagem > 0 ? formatCatalogoMobileNum(cat.custoNaEmbalagem) : '—',
    markup: formatCatalogoMobilePct(markupPct),
    inventarioValorizado: inventarioFmt,
    precoVenda: cat.precoVenda > 0 ? formatCatalogoMobileNum(cat.precoVenda) : '—',
    estoqueAtual: estoqueFmt,
  };
}

function catalogStockAccentKey(stockTone) {
  if (stockTone === 'danger') return 'danger';
  if (stockTone === 'warning') return 'warning';
  if (stockTone === 'muted') return 'muted';
  return 'success';
}

/** Coluna esquerda: qtd + UN empilhados; border-r separa do bloco descrição/valores à direita. */
function CatalogoMobileQtdUnCol({
  quantidade,
  unidade,
  stockTone = 'success',
  virtualActive = false,
  emphasis = false,
}) {
  const accentKey = catalogStockAccentKey(stockTone);
  const dotClass = p38Accent[accentKey]?.dot || p38Table.accentDot;
  const qtyClass = emphasis
    ? `${CATALOGO_MOBILE_BODY_TEXT} tabular-nums leading-none text-foreground font-semibold`
    : `${CATALOGO_MOBILE_BODY_TEXT} tabular-nums leading-none text-foreground`;

  return (
    <CatalogoMobileQtdColShell>
      <div className="flex items-start justify-end gap-1 min-w-0">
        <span className={`mt-1 w-1.5 h-1.5 shrink-0 rounded-full ${dotClass}`} aria-hidden />
        <div className="min-w-0 text-right">
          <p className={qtyClass}>
            {virtualActive ? '~' : ''}{fmtN(quantidade)}
          </p>
          <p className={`${CATALOGO_MOBILE_BODY_TEXT} uppercase text-muted-foreground mt-1.5 leading-none truncate ${emphasis ? 'font-medium' : ''}`}>
            {unidade}
          </p>
        </div>
      </div>
    </CatalogoMobileQtdColShell>
  );
}

function catalogoGroupMetricValueClass(key) {
  if (key === 'markup') return `${MARGIN_ACCENT_VALUE} font-normal`;
  if (key === 'inventarioValorizado') return 'text-foreground font-medium';
  return 'text-muted-foreground font-light';
}

function catalogoGroupBandClass(row) {
  if (row?.isCategoryBand) return CATALOG_MOBILE_GROUP_BAND.category;
  if ((row?.level ?? 1) <= 1) return CATALOG_MOBILE_GROUP_BAND.root;
  return CATALOG_MOBILE_GROUP_BAND.nested;
}

function catalogoSkuSurfaceClass(row, underOpenGroup = false) {
  if (underOpenGroup || (row?.level ?? 1) > 1) {
    return CATALOG_MOBILE_SKU_SURFACE.nested;
  }
  return CATALOG_MOBILE_SKU_SURFACE.root;
}
function catalogoMetricValueClass(key) {
  if (key === 'markup') {
    return `${MARGIN_ACCENT_VALUE} font-medium`;
  }
  if (key === 'valorCompra' || key === 'custoCalculado') {
    return 'text-foreground/75 font-normal dark:text-muted-foreground dark:font-light';
  }
  return 'text-foreground font-normal dark:text-foreground/90 dark:font-light';
}

function buildUnitOptions(produto) {
  const purchaseOptions = buildPurchaseUnitOptions(produto);
  const saleOptions = buildSaleUnitOptions(produto);
  const byUnit = new Map();

  purchaseOptions.forEach((option) => {
    if (!option?.unidade) return;
    byUnit.set(option.unidade, {
      sigla: option.unidade,
      label: option.nome || option.rotulo || option.unidade,
      fator: Number(option.fator_conversao) || 1,
    });
  });

  saleOptions.forEach((option) => {
    if (!option?.unidade) return;
    const current = byUnit.get(option.unidade) || {
      sigla: option.unidade,
      label: option.nome || option.rotulo || option.unidade,
      fator: Number(option.fator_conversao) || 1,
    };
    byUnit.set(option.unidade, {
      ...current,
      label: current.label || option.nome || option.rotulo || option.unidade,
      fator: Number(current.fator || option.fator_conversao) || 1,
    });
  });

  if (byUnit.size === 0) {
    const fallback = produto?.unidade_principal || 'UN';
    byUnit.set(fallback, { sigla: fallback, label: 'Unidade base', fator: 1 });
  }

  return Array.from(byUnit.values());
}

function getPricingForUnit(produto, unitOption) {
  const fator = Number(unitOption?.fator) > 0 ? Number(unitOption.fator) : 1;
  const scale = (value) => Number(value || 0) * fator;
  const custoBase = resolveCustoTotalUnitBaseProduto(produto);
  const saleOptions = buildSaleUnitOptions(produto);
  const sale = saleOptions.find((option) => option.unidade === unitOption?.sigla);
  const precoVenda = Number(sale?.valor_unitario ?? (produto?.preco_venda_padrao || 0) * fator) || 0;
  const custo = custoBase * fator;
  const valorCompra = scale(produto?.valor_compra);
  const frete = scale(produto?.custo_frete_padrao);
  const imposto1 = scale(produto?.custo_imposto1_padrao);
  const imposto2 = scale(produto?.custo_imposto2_padrao);
  const desconto = scale(produto?.desconto_compra_padrao);
  const outros = scale(produto?.custo_outros_padrao);
  const margem = precoVenda > 0 ? ((precoVenda - custo) / precoVenda) * 100 : 0;
  const markup = custo > 0 ? ((precoVenda - custo) / custo) * 100 : 0;
  return { fator, precoVenda, custo, valorCompra, frete, imposto1, imposto2, desconto, outros, margem, markup };
}

/** rem proporcional a --app-font-scale (html); mantém diagramação ao usar A+/A++. */
const PRICING_LABEL_CLASS = 'text-[0.72rem] uppercase tracking-tight text-muted-foreground leading-tight';
const PRICING_VALUE_CLASS = 'text-[0.86rem] font-light tabular-nums leading-tight';
const PRICING_HINT_CLASS = 'text-[0.68rem] text-muted-foreground/80 font-light leading-tight';
const PRICING_SECTIONS_GRID = 'grid grid-cols-2 gap-2 min-w-0 [&>*]:min-w-0';

function pricingValueClass(tone = 'default') {
  if (tone === 'positive') return `${MARGIN_ACCENT_VALUE} font-normal`;
  if (tone === 'warning') return 'text-amber-600 dark:text-amber-400 font-normal';
  if (tone === 'danger') return 'text-red-600 dark:text-red-400 font-normal';
  return 'text-foreground font-light';
}

function PricingLine({ label, value, tone = 'default', hint }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-0.5 items-start py-1.5 border-b border-border/40 last:border-b-0 dark:border-border/30">
      <div className="min-w-0">
        <div className={cn(PRICING_LABEL_CLASS, 'break-words')}>{label}</div>
        {hint ? <div className={cn(PRICING_HINT_CLASS, 'mt-0.5 break-words')}>{hint}</div> : null}
      </div>
      <div className={cn(PRICING_VALUE_CLASS, 'text-right whitespace-nowrap shrink-0', pricingValueClass(tone))}>
        {value}
      </div>
    </div>
  );
}

function PricingSection({ title, children }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card px-2.5 py-2 shadow-sm dark:border-border/40 dark:bg-background/70 dark:shadow-none min-w-0">
      <div className={`${PRICING_LABEL_CLASS} mb-1.5 font-medium text-foreground/80`}>{title}</div>
      {children}
    </div>
  );
}

function PricingDialog({ produto, open, onOpenChange }) {
  const unitOptions = useMemo(() => buildUnitOptions(produto || {}), [produto]);
  const cat = useMemo(() => produto ? getCatalogoComercialView(produto) : null, [produto]);
  const defaultUnit = cat?.sigla || unitOptions[0]?.sigla || produto?.unidade_principal || 'UN';
  const [selectedUnit, setSelectedUnit] = useState(defaultUnit);
  const [fontScale, setFontScale] = useState(() => getStoredFontScale());

  useEffect(() => {
    if (open) setSelectedUnit(defaultUnit);
  }, [defaultUnit, open]);

  useEffect(() => {
    const onFontScaleChange = (event) => {
      setFontScale(event.detail?.scale ?? getStoredFontScale());
    };
    window.addEventListener(FONT_SCALE_CHANGE_EVENT, onFontScaleChange);
    return () => window.removeEventListener(FONT_SCALE_CHANGE_EVENT, onFontScaleChange);
  }, []);

  if (!produto) return null;

  const selectedOption = unitOptions.find((option) => option.sigla === selectedUnit) || unitOptions[0];
  const pricing = getPricingForUnit(produto, selectedOption);
  const estoqueBase = Number(produto.estoque_atual || 0);
  const estoqueNaUnidade = pricing.fator > 0 ? estoqueBase / pricing.fator : estoqueBase;
  const unidadeSelecionada = selectedOption?.sigla || selectedUnit;
  const margemTone = pricing.margem >= 30 ? 'positive' : pricing.margem > 0 ? 'warning' : 'danger';
  const markupTone = pricing.markup >= 40 ? 'positive' : pricing.markup > 0 ? 'warning' : 'danger';

  const unitHint = `/${unidadeSelecionada}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'w-[94vw] rounded-3xl border border-border/40 bg-muted/40 p-3 text-foreground shadow-2xl dark:border-border/40 dark:bg-background',
          fontScale >= 1.125 ? 'max-w-md' : 'max-w-sm',
        )}
      >
        <DialogHeader className="text-left space-y-1 pr-8">
          <DialogTitle className="text-[0.95rem] font-semibold text-foreground flex items-center gap-2">
            <span className="w-8 h-8 rounded-2xl p38-catalog-icon-well flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4" />
            </span>
            Precificação
          </DialogTitle>
          <p className="text-[0.78rem] text-muted-foreground uppercase leading-snug line-clamp-2 font-light">{produto.nome}</p>
        </DialogHeader>

        <div className="space-y-2 min-w-0">
          <div className="rounded-2xl border border-border/40 bg-card px-2.5 py-2 shadow-sm dark:border-border/40 dark:bg-background/70 dark:shadow-none min-w-0">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 items-center">
              <div className="min-w-0">
                <div className={PRICING_LABEL_CLASS}>Unidade</div>
                <div className={cn(PRICING_HINT_CLASS, 'mt-0.5')}>consulta, sem editar</div>
              </div>
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger className="min-h-8 h-auto w-[4.5rem] rounded-xl border-border/40 bg-muted/50 text-[0.86rem] font-light text-foreground focus:ring-0 dark:border-border/40 dark:bg-background px-2 py-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[80] border border-border/40 bg-card text-foreground dark:border-border/40 dark:bg-card">
                  {unitOptions.map((option) => (
                    <SelectItem key={option.sigla} value={option.sigla} className="text-[0.86rem]">
                      {option.sigla}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className={PRICING_SECTIONS_GRID}>
            <PricingSection title="Custos">
              <PricingLine label="V. compra" value={`R$ ${fmtR(pricing.valorCompra)}`} hint={unitHint} />
              {pricing.frete !== 0 && <PricingLine label="Frete" value={`R$ ${fmtR(pricing.frete)}`} hint={unitHint} />}
              {pricing.imposto1 !== 0 && <PricingLine label="Imp. 1" value={`R$ ${fmtR(pricing.imposto1)}`} hint={unitHint} />}
              {pricing.imposto2 !== 0 && <PricingLine label="Imp. 2" value={`R$ ${fmtR(pricing.imposto2)}`} hint={unitHint} />}
              {pricing.desconto !== 0 && (
                <PricingLine
                  label="Desc."
                  value={`- R$ ${fmtR(pricing.desconto)}`}
                  hint={unitHint}
                  tone={pricing.desconto > 0 ? 'positive' : 'default'}
                />
              )}
              {pricing.outros !== 0 && <PricingLine label="Outros" value={`R$ ${fmtR(pricing.outros)}`} hint={unitHint} />}
              <PricingLine label="Custo total" value={`R$ ${fmtR(pricing.custo)}`} hint={unitHint} />
            </PricingSection>
            <PricingSection title="Venda">
              <PricingLine label="P. venda" value={`R$ ${fmtR(pricing.precoVenda)}`} hint={unitHint} />
              <PricingLine label="MK%" value={`${fmtN(pricing.markup)}%`} tone={markupTone} />
              <PricingLine label="Margem" value={`${fmtN(pricing.margem)}%`} tone={margemTone} />
              <PricingLine
                label="Estoque"
                value={`${fmtN(estoqueNaUnidade)} ${unidadeSelecionada}`}
                hint={`base ${fmtN(estoqueBase)} ${produto.unidade_principal || 'UN'}`}
              />
            </PricingSection>
          </div>

          <div className="rounded-2xl border border-border/40 bg-card/60 px-2.5 py-2 dark:border-border/40 dark:bg-background/50">
            <FontScaleControl compact />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CatalogoMobileColumnHeader({ className = '', invisible = false, pinStyle = null }) {
  return (
    <div
      className={cn(
        p38Table.catalogMobileHeader,
        'relative',
        invisible && 'invisible pointer-events-none',
        pinStyle && 'fixed z-[60]',
        className,
      )}
      style={pinStyle || undefined}
    >
      <CatalogoMobileSacredAxis />
      <div className={cn('relative flex min-w-0 py-3.5 pr-12', CATALOG_ROW_PL)}>
        <CatalogoMobileQtdColShell className="!py-2">
          <p className={`${CATALOGO_MOBILE_HEADER_LABEL} text-right`}>EST.</p>
          <p className={`${CATALOGO_MOBILE_HEADER_LABEL} text-right mt-1.5`}>UN</p>
        </CatalogoMobileQtdColShell>
        <div
          className="flex-1 min-w-0"
          style={{ paddingLeft: catalogContentPadAfterLine(1) }}
        >
          {CATALOGO_MOBILE_VALUE_ROWS.map((valueRow, rowIdx) => (
            <div
              key={rowIdx}
              className={`${CATALOGO_MOBILE_VALUES_GRID} ${rowIdx === 0 ? '' : 'mt-1.5'}`}
            >
              {valueRow.map(({ label }) => (
                <p key={label} className={CATALOGO_MOBILE_HEADER_LABEL}>
                  {label}
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CatalogoMobileTabulatedValues({ produto, catalogStockContext = null, className = '' }) {
  const values = buildCatalogoMobileTabulatedValues(produto, catalogStockContext);

  return (
    <div className={cn('min-w-0 overflow-hidden', className)}>
      {CATALOGO_MOBILE_VALUE_ROWS.map((valueRow, rowIdx) => (
        <div
          key={rowIdx}
          className={`${CATALOGO_MOBILE_VALUES_GRID} ${rowIdx === 0 ? '' : 'mt-1.5'}`}
        >
          {valueRow.map(({ key }) => (
            <p
              key={key}
              className={`${CATALOGO_MOBILE_BODY_TEXT} tabular-nums text-right truncate ${catalogoMetricValueClass(key)}`}
            >
              {values[key]}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Linha de SKU — cartão de produto (grelha completa, ≠ faixa de família) ─────
const SkuCard = React.memo(function SkuCard({ row, onEdit, onOpenPricing, catalogStockContext = null, underOpenGroup = false }) {
  const p = row.produto;
  const est = resolveCatalogEstoqueExibicao(p, catalogStockContext);
  const estoqueExibicao = est.quantidade;
  const unidadeExibicao = est.unidade || p.unidade_principal || 'UN';
  const virtualActive = est.virtual && est.pendente > 0;
  const m = p.estoque_minimo || 0;
  const stockTone = !p.ativo ? 'muted' : estoqueExibicao <= 0 ? 'danger' : estoqueExibicao <= m ? 'warning' : 'success';
  const tier = getCatalogRowTier(row);
  const apresent = formatEstoqueApresentacao(p);
  const isNested = underOpenGroup || (row.level ?? 1) > 1;

  return (
    <div className={cn(
      p38Table.catalogMobileRow,
      'flex min-w-0 max-w-full py-4 tablet-portrait:py-5',
      catalogoSkuSurfaceClass(row, underOpenGroup),
    )}>
      <button
        type="button"
        className="flex flex-1 min-w-0 text-left active:bg-secondary/20 dark:active:bg-secondary/40"
        onClick={() => onEdit(p)}
      >
        <div className={cn('flex flex-1 min-w-0 items-stretch', CATALOG_ROW_PL)}>
          <CatalogoMobileQtdUnCol
            quantidade={estoqueExibicao}
            unidade={unidadeExibicao}
            stockTone={stockTone}
            virtualActive={virtualActive}
          />
          <div
            className={cn(
              'flex-1 min-w-0 overflow-hidden py-1 pr-2',
              isNested && 'border-l border-dashed border-border/35 dark:border-white/10',
            )}
            style={{ paddingLeft: catalogContentPadAfterLine(row.level ?? 1) }}
          >
            <div className="mb-1 flex items-center gap-1.5">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-[#a8942e] dark:text-[#a4ce33]/90">
                SKU
              </span>
              {p.codigo_interno && (
                <span className="text-[10px] font-mono truncate text-foreground/75 dark:text-muted-foreground">
                  #{p.codigo_interno}
                </span>
              )}
            </div>
            <CatalogoMobileDescBlock nome={p.nome} tier={tier} />
            <CatalogoMobileTabulatedValues produto={p} catalogStockContext={catalogStockContext} className="mt-0.5" />
            {apresent && (
              <p className="mt-2 text-[9px] text-muted-foreground truncate">
                {apresent.rotulo || 'unidade de exibição'}
              </p>
            )}
          </div>
        </div>
      </button>

      <div className="flex items-start justify-center pt-4 pr-3 w-12 flex-shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={(event) => {
            event.stopPropagation();
            onOpenPricing(p);
          }}
          className="h-9 w-9 tablet-landscape:h-11 tablet-landscape:w-11 rounded-lg bg-secondary/80 text-primary dark:text-[#a4ce33] hover:bg-secondary"
          title="Ver precificação"
        >
          <DollarSign className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
});

function buildGroupMobileMetrics(row, catalogStockContext = null) {
  const skus = collectSkus(row?.node);
  const est = aggregateCatalogEstoqueExibicao(skus, catalogStockContext);
  let inventario = 0;
  for (const sku of skus) {
    inventario += lineValorCustoTotal(sku, catalogStockContext);
  }
  return { est, inventario, skuCount: row?.count ?? skus.length };
}

function resolveGroupStockColumn(est, row) {
  if (!est || est.mode === 'empty') {
    return {
      quantidade: 0,
      unidade: '—',
      virtualActive: false,
      stockTone: 'muted',
    };
  }
  if (est.mode === 'mixed') {
    return {
      quantidade: est.quantidade,
      unidade: 'MIX',
      virtualActive: est.virtual === true,
      stockTone: row?.criticalCount > 0 ? 'warning' : 'muted',
    };
  }
  return {
    quantidade: est.quantidade,
    unidade: est.sigla || 'UN',
    virtualActive: est.virtual && est.pendente > 0,
    stockTone: row?.criticalCount > 0 ? 'danger' : 'success',
  };
}

function groupHierarchyLabel(row) {
  if (row?.isCategoryBand) return 'Categoria';
  const level = row?.level ?? 1;
  if (level <= 1) return 'Família';
  if (row?.isLeafGroup) return 'Grupo';
  return 'Subfamília';
}

function buildGroupMobileTabulatedValues(row, catalogStockContext = null) {
  const skus = collectSkus(row?.node);
  let inventario = 0;
  for (const sku of skus) {
    inventario += lineValorCustoTotal(sku, catalogStockContext);
  }
  const tildeNum = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? `~${formatCatalogoMobileNum(n)}` : '—';
  };
  const tildePct = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? `~${formatCatalogoMobilePct(n)}` : '—';
  };

  return {
    valorCompra: tildeNum(row?.valorCompraMedio),
    custoCalculado: tildeNum(row?.custoMedio),
    markup: tildePct(row?.markupMedio),
    precoVenda: tildeNum(row?.precoMedio),
    inventarioValorizado: inventario > 0 ? formatCatalogoMobileNum(inventario) : '—',
    estoqueAtual: '—',
  };
}

function CatalogoMobileGroupAnalyticsStrip({ row, catalogStockContext = null }) {
  const values = useMemo(
    () => buildGroupMobileTabulatedValues(row, catalogStockContext),
    [row, catalogStockContext],
  );

  return (
    <div className="min-w-0 overflow-hidden mt-1.5">
      {CATALOGO_MOBILE_VALUE_ROWS.map((valueRow, rowIdx) => (
        <div
          key={rowIdx}
          className={`${CATALOGO_MOBILE_VALUES_GRID} ${rowIdx === 0 ? '' : 'mt-1.5'}`}
        >
          {valueRow.map(({ key }) => (
            <p
              key={key}
              className={cn(
                CATALOGO_MOBILE_BODY_TEXT,
                'tabular-nums text-right truncate',
                catalogoGroupMetricValueClass(key),
              )}
            >
              {values[key]}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Barra expandir/colapsar (mobile) ───────────────────────────────────────────
function CatalogoMobileTreeToolbar({ onExpandAll, onCollapseAll }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/40 bg-muted/25 px-3 py-2 dark:border-white/10">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Árvore
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 rounded-lg px-2.5 text-[10px] font-medium"
          onClick={onCollapseAll}
        >
          Colapsar tudo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 rounded-lg px-2.5 text-[10px] font-medium"
          onClick={onExpandAll}
        >
          Expandir tudo
        </Button>
      </div>
    </div>
  );
}

// ── Faixa de grupo (resumo analítico — não é linha de produto) ─────────────────
const GroupHeader = React.memo(function GroupHeader({ row, isExpanded, onToggle, catalogStockContext = null }) {
  const metrics = useMemo(
    () => buildGroupMobileMetrics(row, catalogStockContext),
    [row, catalogStockContext],
  );
  const stockCol = useMemo(
    () => resolveGroupStockColumn(metrics.est, row),
    [metrics.est, row],
  );
  const hierarchyLabel = groupHierarchyLabel(row);
  const level = row?.level ?? 1;

  return (
    <button
      type="button"
      onClick={() => onToggle(row.key)}
      aria-expanded={isExpanded}
      className={cn(
        p38Table.catalogMobileRow,
        'flex w-full min-w-0 text-left overflow-hidden py-2.5',
        catalogoGroupBandClass(row),
      )}
    >
      <div className={cn('flex flex-1 min-w-0 items-stretch', CATALOG_ROW_PL)}>
        <CatalogoMobileQtdUnCol
          quantidade={stockCol.quantidade}
          unidade={stockCol.unidade}
          stockTone={stockCol.stockTone}
          virtualActive={stockCol.virtualActive}
          emphasis
        />
        <div
          className="flex-1 min-w-0 overflow-hidden pr-2"
          style={{ paddingLeft: catalogContentPadAfterLine(level) }}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <ChevronRight
              className={cn(
                'h-4 w-4 flex-shrink-0 text-foreground/70 md:transition-transform md:duration-150',
                isExpanded && 'rotate-90',
              )}
            />
            <span className="text-[9px] font-bold uppercase tracking-wider text-foreground/75 dark:text-foreground/85">
              {hierarchyLabel}
            </span>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {metrics.skuCount} {metrics.skuCount === 1 ? 'SKU' : 'SKUs'}
            </span>
            {row.criticalCount > 0 && (
              <Badge variant="outline" className="h-5 truncate border-red-200 px-1.5 text-[10px] font-medium text-red-600 dark:border-red-800 dark:text-red-400">
                {row.criticalCount} crít.
              </Badge>
            )}
          </div>
          <p
            lang="pt-BR"
            className={cn(
              'mt-0.5 line-clamp-1 uppercase tracking-wide',
              level <= 1
                ? 'text-[12px] font-semibold text-foreground'
                : 'text-[11px] font-medium text-foreground/85',
            )}
          >
            {row.label}
          </p>
          <CatalogoMobileGroupAnalyticsStrip row={row} catalogStockContext={catalogStockContext} />
        </div>
      </div>
    </button>
  );
});

function useCatalogColumnHeaderPin(scrollElement) {
  const sentinelRef = useRef(null);
  const [pinned, setPinned] = useState(false);
  const [pinFrame, setPinFrame] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !scrollElement) return;

    const sync = () => {
      const scrollEl = scrollElement;
      const sentinelRect = sentinel.getBoundingClientRect();
      const usesInnerScroll = Boolean(
        scrollEl && scrollEl.scrollHeight > scrollEl.clientHeight + 1,
      );
      const scrollRect = scrollEl?.getBoundingClientRect();
      const anchorTop = usesInnerScroll && scrollRect
        ? scrollRect.top
        : 48;
      const anchorLeft = scrollRect?.left ?? 0;
      const anchorWidth = scrollRect?.width ?? window.innerWidth;

      setPinned(sentinelRect.top < anchorTop + 0.5);
      setPinFrame({
        top: anchorTop,
        left: anchorLeft,
        width: anchorWidth,
      });
    };

    const scrollEl = scrollElement;
    scrollEl?.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    const resizeObserver = new ResizeObserver(sync);
    if (scrollEl) resizeObserver.observe(scrollEl);
    resizeObserver.observe(sentinel);
    sync();
    const frame = window.requestAnimationFrame(sync);

    return () => {
      window.cancelAnimationFrame(frame);
      scrollEl?.removeEventListener('scroll', sync);
      window.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
      resizeObserver.disconnect();
    };
  }, [scrollElement]);

  return { sentinelRef, pinned, pinFrame };
}

/** Catálogo mobile — scroll no painel do Layout (como VendasGestao); cabeçalho amarelo some ao rolar. */
export function CatalogoMobileScrollShell({ catalogChrome, children }) {
  const hostRef = useRef(null);
  const [scrollElement, setScrollElement] = useState(null);
  const { sentinelRef, pinned, pinFrame } = useCatalogColumnHeaderPin(scrollElement);
  const pinStyle = pinned
    ? { top: pinFrame.top, left: pinFrame.left, width: pinFrame.width }
    : null;

  useLayoutEffect(() => {
    const resolve = () => hostRef.current?.closest('.p38-stage-panel-scroll') || null;
    setScrollElement(resolve());
    const frame = window.requestAnimationFrame(() => setScrollElement(resolve()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <CatalogoMobileScrollContext.Provider value={scrollElement}>
      <div ref={hostRef} className="w-full min-w-0 pb-[var(--p38-scroll-pad-below-nav)]">
        {catalogChrome}
        <div ref={sentinelRef} className="h-px w-full shrink-0" aria-hidden />
        <CatalogoMobileColumnHeader
          className="border-x border-border/40 dark:border-white/10"
          invisible={pinned}
        />
        {pinned ? (
          <CatalogoMobileColumnHeader
            className="border-x border-border/40 dark:border-white/10"
            pinStyle={pinStyle}
          />
        ) : null}
        {children}
      </div>
    </CatalogoMobileScrollContext.Provider>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function MobileHierarquica({ produtos, onEdit, groupByCategory = false, masterLevel = 2, sortOrder = 'az', onExpandedKeysChange, catalogFilters = null, salesVelocityMap = {}, catalogStockContext = null, flatList = false }) {
  const scrollElement = useCatalogoMobileScrollElement();
  const [expandedKeys, setExpandedKeys] = useState(new Set());
  const [pricingProduto, setPricingProduto] = useState(null);
  const pendingScrollRestoreRef = useRef(null);

  const effectiveGroupByCategory = flatList ? false : groupByCategory;
  const rawTree = useCatalogTreeGrid(produtos, { groupByCategory: effectiveGroupByCategory });
  const tree = useMemo(
    () =>
      pruneTreeForGroupAnalysis(rawTree, {
        filters: catalogFilters,
        salesVelocityMap,
        catalogStockContext,
      }),
    [rawTree, catalogFilters, salesVelocityMap, catalogStockContext],
  );
  const produtosStructureSig = useMemo(
    () => catalogProdutosStructureSig(produtos, { groupByCategory: effectiveGroupByCategory }),
    [produtos, effectiveGroupByCategory]
  );
  const groupAnalysisSig = useMemo(
    () => catalogGroupAnalysisSig(catalogFilters),
    [catalogFilters]
  );
  const flattenOptions = useMemo(
    () => getCatalogFlattenOptions(catalogFilters),
    [catalogFilters]
  );

  // Reinicia expansão só quando filtros/hierarquia mudam — não a cada rebuild por ABCD/IEP ou preços.
  useEffect(() => {
    const level = flatList ? TREE_GRID_EXPAND_ALL_LEVEL : masterLevel;
    setExpandedKeys(
      resolveExpandedKeysForMasterLevel(tree, level, effectiveGroupByCategory),
    );
    const scrollEl = scrollElement;
    if (scrollEl) scrollEl.scrollTop = 0;
  }, [produtosStructureSig, effectiveGroupByCategory, masterLevel, groupAnalysisSig, scrollElement, tree, flatList]);

  useEffect(() => {
    onExpandedKeysChange?.(expandedKeys);
  }, [expandedKeys, onExpandedKeysChange]);

  const rows = useMemo(() => {
    const all = mergeAdjacentDuplicateGroupHeaders(
      flattenTree(tree, expandedKeys, '', 0, sortOrder, flattenOptions),
    );
    const filtered = all.filter(r => !(r.type === 'group' && r.count === 0));
    if (!flatList) return filtered;
    return filtered
      .filter((r) => r.type === 'sku')
      .map((r) => ({ ...r, level: 1 }));
  }, [tree, expandedKeys, sortOrder, flattenOptions, flatList]);

  const shouldVirtualizeRows = rows.length >= CATALOGO_VIRTUALIZE_MIN_ROWS;

  const estimateRowSize = useCallback(
    (index) => (rows[index]?.type === 'group' ? CATALOGO_MOBILE_ROW_H_GROUP : CATALOGO_MOBILE_ROW_H_SKU),
    [rows]
  );

  const scrollRef = useRef(scrollElement);
  scrollRef.current = scrollElement;

  const virtualRows = useVirtualRows({
    itemCount: rows.length,
    estimateSize: estimateRowSize,
    overscan: 6,
    scrollElementRef: scrollRef,
    scrollElement,
  });

  const visibleRows = useMemo(
    () => shouldVirtualizeRows ? rows.slice(virtualRows.startIndex, virtualRows.endIndex) : rows,
    [rows, shouldVirtualizeRows, virtualRows.endIndex, virtualRows.startIndex]
  );

  const paddingTop = shouldVirtualizeRows ? virtualRows.paddingTop : 0;
  const paddingBottom = shouldVirtualizeRows ? virtualRows.paddingBottom : 0;

  useLayoutEffect(() => {
    const scrollEl = scrollElement;
    if (scrollEl) pendingScrollRestoreRef.current = scrollEl.scrollTop;
  }, [expandedKeys, rows.length, scrollElement]);

  useLayoutEffect(() => {
    const scrollEl = scrollElement;
    const top = pendingScrollRestoreRef.current;
    if (scrollEl != null && top != null) {
      scrollEl.scrollTop = top;
      pendingScrollRestoreRef.current = null;
    }
  }, [expandedKeys, rows.length, scrollElement]);

  const handleToggle = useCallback((key) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    pendingScrollRestoreRef.current = scrollElement?.scrollTop ?? 0;
    setExpandedKeys(resolveExpandedKeysForMasterLevel(tree, TREE_GRID_EXPAND_ALL_LEVEL, groupByCategory));
  }, [tree, groupByCategory, scrollElement]);

  const handleCollapseAll = useCallback(() => {
    pendingScrollRestoreRef.current = scrollElement?.scrollTop ?? 0;
    setExpandedKeys(resolveExpandedKeysForMasterLevel(tree, 1, groupByCategory));
  }, [tree, groupByCategory, scrollElement]);

  if (produtos.length === 0) {
    return (
      <div className="py-16 text-center px-8 border-x border-t-0 border-border/40 dark:border-white/10">
        <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Package className="w-7 h-7 text-muted-foreground dark:text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Nenhum produto encontrado</p>
        <p className="text-xs text-muted-foreground mt-1">Tente ajustar os filtros de busca</p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full">
      {!flatList ? (
        <CatalogoMobileTreeToolbar
          onExpandAll={handleExpandAll}
          onCollapseAll={handleCollapseAll}
        />
      ) : null}
      <div className="relative border-x border-t-0 border-border/40 dark:border-white/10">
        <CatalogoMobileSacredAxis />
        <div className="relative border-b border-border/40 dark:border-white/10 bg-background">
          {paddingTop > 0 && <div aria-hidden="true" style={{ height: paddingTop }} />}
          {visibleRows.map((row, index) => {
            const prev = index > 0 ? visibleRows[index - 1] : null;
            const underOpenGroup = row.type === 'sku'
              && prev?.type === 'group'
              && expandedKeys.has(prev.key);

            return (
              <div key={row.key}>
                {row.type === 'group' ? (
                  <GroupHeader
                    row={row}
                    isExpanded={expandedKeys.has(row.key)}
                    onToggle={handleToggle}
                    catalogStockContext={catalogStockContext}
                  />
                ) : (
                  <SkuCard
                    row={row}
                    onEdit={onEdit}
                    onOpenPricing={setPricingProduto}
                    catalogStockContext={catalogStockContext}
                    underOpenGroup={underOpenGroup}
                  />
                )}
              </div>
            );
          })}
          {paddingBottom > 0 && <div aria-hidden="true" style={{ height: paddingBottom }} />}
        </div>
      </div>
      <PricingDialog
        produto={pricingProduto}
        open={!!pricingProduto}
        onOpenChange={(open) => {
          if (!open) setPricingProduto(null);
        }}
      />
    </div>
  );
}
