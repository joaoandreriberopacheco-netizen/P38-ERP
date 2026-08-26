import React, { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Loader2, ArrowLeft, Search, X, ChevronDown, ChevronRight, Type, TrendingUp, DollarSign, Percent, Package, BarChart3, SlidersHorizontal, PanelTopClose, PanelTopOpen } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LevelControl } from '@/components/produtos/treegrid/LevelControl';
import {
  buildMarginTree,
  flattenMarginTree,
  buildExpandedForLevel,
  buildMarginFlatRows,
  collectAllMarginLeaves,
  formatMarginGroupUnidadeLabel,
} from '@/lib/marginTree';
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { loadJsPDF } from '@/lib/lazyPdfLibs';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import CalendarPopup from '@/components/relatorios/CalendarPopup';
import { resolveCommercialDisplay, formatCommercialQuantity } from '@/lib/productUnits';
import { fetchPedidosVendaParaMargem } from '@/lib/fetchPedidosVenda90d';
import { fetchAllProdutosCatalogo } from '@/lib/fetchProdutosAtivos';
import {
  pedidoElegivelMargem,
  alocarReceitaPedidoNasLinhas,
  resolveMargemProdutoKey,
  resolveCustoUnitarioMargem,
  resolveCustoComponentesUnitBaseMargem,
  acumularCustoComponentesMargem,
  calcularCustoTotalDosComponentes,
  criarCamposCustoComponentesZerados,
  somarCamposCustoComponentes,
  buildCustoBreakdownLineMargem,
  labelComposicaoCustoMargem,
  escalarValorCustoMargemUnidadeExibicao,
  resolvePrecoVendaLiquidoUnitarioMargem,
  CUSTO_MARGEM_CAMPOS,
  vendaNoIntervaloConsulta,
} from '@/lib/relatorioMargemCalculos';
import { registerJsPdfDin1451Fonts, normalizePdfText } from '@/lib/jspdfNotoFont';
import {
  p38Table,
  MARGIN_TABLE_PANEL,
  MARGIN_TABLE_HEAD,
  MARGIN_TABLE_BORDER,
  MARGIN_TABLE_ROW,
  MARGIN_ACCENT_VALUE,
  MARGIN_MUTED_VALUE,
  MARGIN_BODY_TEXT,
  MARGIN_TABLE_MICRO,
} from '@/lib/p38TableSurfaces';
import { useVirtualRows } from '@/hooks/useVirtualRows';
import { parseSearchTerms } from '@/lib/searchTokens';
import { isP38Dev } from '@/lib/p38PublicEnv';


const PDF_COL_GAP_MM = 2;
const MOBILE_PDF_W_MM = 100;
const MOBILE_PDF_H_MM = 1200;
/** A partir deste número de linhas, só renderiza a janela visível (desktop + mobile). */
const MARGIN_VIRTUALIZE_MIN_ROWS = 50;
const MARGIN_TABLE_COL_COUNT = 9;
const MARGIN_DESKTOP_ROW_H_GROUP = 42;
const MARGIN_DESKTOP_ROW_H_PRODUTO = 48;
const MARGIN_MOBILE_ROW_H_GROUP = 88;
const MARGIN_MOBILE_ROW_H_GROUP_COLLAPSED = 50;
const MARGIN_MOBILE_ROW_H_PRODUTO = 100;

/** Paleta e colunas alinhadas ao PDF mobile (`exportToPDF('expandida_mobile')`). */
const MARGIN_MOBILE_STORM = '#2d333b';
/** Destaque de lucro/markup: oliva (claro) e limão (escuro). */
const MARGIN_ACCENT_HEX_LIGHT = '#4a5240';
const MARGIN_ACCENT_HEX_DARK = '#a4ce33';
const MARGIN_ACCENT_RGB = [74, 82, 64];
/** Limão — destaque no painel/PDF mobile escuro. */
const MARGIN_ACCENT_LIME_RGB = [164, 206, 51];

const MARGIN_MOBILE_VALUE_ROWS = [
  [
    { key: 'custoUnit', label: 'CUSTO UN' },
    { key: 'precoVenda', label: 'PREÇO VENDA' },
    { key: 'markup', label: 'MK %' },
  ],
  [
    { key: 'custoTotal', label: 'CUSTO TOTAL' },
    { key: 'vendaTotal', label: 'RECEITA TOTAL' },
    { key: 'lucro', label: 'LUCRO' },
  ],
];

const MARGIN_MOBILE_VALUES_GRID = 'grid grid-cols-3 gap-x-1 min-w-0';
const MARGIN_MOBILE_HEADER_LABEL = `${MARGIN_TABLE_MICRO} uppercase tracking-wide text-right leading-none opacity-90 truncate min-w-0`;

const MARGIN_METRIC_KEYS = MARGIN_MOBILE_VALUE_ROWS.flat().map(({ key }) => key);

const MARGIN_METRIC_SORT_FIELD = {
  custoUnit: 'custo_unitario_calc',
  precoVenda: 'valor_unitario_medio',
  markup: 'markup_percentual',
  custoTotal: 'custo_total',
  vendaTotal: 'receita_liquida',
  lucro: 'lucro_total',
};

function getRowMarkup(row) {
  if (row.markup_percentual != null && !Number.isNaN(row.markup_percentual)) {
    return row.markup_percentual;
  }
  const custo = row.custo_total ?? 0;
  return custo > 0 ? ((row.lucro_total || 0) / custo) * 100 : 0;
}

function getRowPrecoMedio(row) {
  return resolvePrecoVendaLiquidoUnitarioMargem(row);
}

function getRowCustoUnitCalc(row) {
  const qtd = row.quantidade_vendida || 0;
  if (qtd > 0 && row.custo_total != null) {
    return (row.custo_total || 0) / qtd;
  }
  return row.custo_unitario_cadastro ?? 0;
}

const formatNumDisplay = (val) =>
  (val ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatPctShortDisplay = (val) => `${(val ?? 0).toFixed(1).replace('.', ',')}%`;

function buildMarginMobileTabulatedValues(row) {
  return {
    custoUnit: formatNumDisplay(getRowCustoUnitCalc(row)),
    precoVenda: formatNumDisplay(getRowPrecoMedio(row)),
    markup: formatPctShortDisplay(getRowMarkup(row)),
    custoTotal: formatNumDisplay(row.custo_total || 0),
    vendaTotal: formatNumDisplay(row.receita_liquida || 0),
    lucro: formatNumDisplay(row.lucro_total || 0),
  };
}

/** `pai` = grupo; `solteiro` = produto nível 1; `filho` = produto em grupo. */
function getMarginRowTier(treeRow) {
  if (treeRow?.type === 'group') return 'pai';
  return (treeRow?.level ?? 1) <= 1 ? 'solteiro' : 'filho';
}

function marginMetricValueClass(key, tier = 'filho') {
  if (key === 'markup' || key === 'lucro') return `${MARGIN_ACCENT_VALUE} font-semibold`;
  if (key === 'custoUnit' || key === 'custoTotal') {
    return `${MARGIN_MUTED_VALUE} font-medium dark:font-normal`;
  }
  if (tier === 'filho') return `${MARGIN_MUTED_VALUE} font-medium dark:font-normal`;
  return 'text-foreground dark:text-foreground font-semibold';
}

function marginDesktopDescClass(tier) {
  if (tier === 'filho') {
    return `${MARGIN_BODY_TEXT} font-medium dark:font-normal text-muted-foreground uppercase`;
  }
  return `${MARGIN_BODY_TEXT} font-semibold text-foreground dark:text-foreground uppercase tracking-wide`;
}

function marginDesktopQuantClass(tier) {
  if (tier === 'filho') {
    return `${MARGIN_BODY_TEXT} tabular-nums text-center text-foreground/90 dark:text-muted-foreground font-medium dark:font-normal`;
  }
  return `${MARGIN_BODY_TEXT} tabular-nums text-center text-foreground font-semibold`;
}

function buildCustoBreakdownLine(row, mode = 'unit') {
  return buildCustoBreakdownLineMargem(row, { mode, formatNum: formatNumDisplay });
}

function MargemCustoValorTooltip({ row, mode = 'unit', children, className = '' }) {
  const line = buildCustoBreakdownLine(row, mode);
  const unidade = String(row?.unidade_exibicao || '').trim().toUpperCase();
  if (!line) {
    return <span className={className}>{children}</span>;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`cursor-default underline decoration-dotted decoration-muted-foreground/35 underline-offset-2 ${className}`}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-[min(100vw-2rem,28rem)] bg-popover text-popover-foreground border border-border text-xs font-normal normal-case tracking-normal"
      >
        {mode === 'unit' && unidade ? (
          <p className="text-[10px] text-muted-foreground mb-1">Valores por {unidade}</p>
        ) : null}
        {line}
      </TooltipContent>
    </Tooltip>
  );
}

function MargemCustoDetalheTotais({ totals }) {
  const items = CUSTO_MARGEM_CAMPOS.map((campo) => ({
    label: campo.label,
    value: campo.subtract ? -(totals?.[campo.totalKey] || 0) : (totals?.[campo.totalKey] || 0),
  })).filter((item) => Math.abs(item.value) > 0.0001);

  if (!items.length) return null;

  return (
    <div className={`mx-3 md:mx-0 mt-2 rounded-lg border ${MARGIN_TABLE_BORDER} ${MARGIN_TABLE_PANEL} px-3 py-2.5`}>
      <p className={`${MARGIN_TABLE_MICRO} uppercase tracking-wide text-muted-foreground`}>
        {labelComposicaoCustoMargem(totals, { porUnidade: false })}
      </p>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-3 gap-y-2">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <p className={`${MARGIN_TABLE_MICRO} uppercase tracking-wide text-muted-foreground leading-none truncate`}>
              {item.label}
            </p>
            <p className={`${MARGIN_BODY_TEXT} tabular-nums mt-1 truncate ${MARGIN_MUTED_VALUE}`}>
              {formatMoneyDisplay(item.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MargemDesktopMetricCells({ dataRow, showMetrics = true, tier = 'filho' }) {
  if (!showMetrics) {
    return MARGIN_METRIC_KEYS.map((key) => <td key={key} className="py-1.5 px-1.5" />);
  }
  const values = buildMarginMobileTabulatedValues(dataRow);
  return MARGIN_METRIC_KEYS.map((key) => {
    const value = values[key];
    const isCusto = key === 'custoUnit' || key === 'custoTotal';
    const content = isCusto ? (
      <MargemCustoValorTooltip row={dataRow} mode={key === 'custoUnit' ? 'unit' : 'total'}>
        {value}
      </MargemCustoValorTooltip>
    ) : (
      value
    );
    return (
      <td
        key={key}
        className={`py-1.5 px-1.5 text-right ${MARGIN_BODY_TEXT} tabular-nums ${marginMetricValueClass(key, tier)}`}
        style={{ lineHeight: 1.2 }}
      >
        {content}
      </td>
    );
  });
}

function buildMarginFiltrosDesc({ dateRange, searchTerm, treeLevel, viewMode = 'plana' }) {
  const parts = [];
  if (dateRange?.from && dateRange?.to) {
    parts.push(
      `Período: ${format(dateRange.from, 'dd/MM/yyyy')} a ${format(dateRange.to, 'dd/MM/yyyy')}`
    );
  }
  if (searchTerm?.trim()) parts.push(`Busca: ${searchTerm.trim()}`);
  if (viewMode === 'plana') {
    parts.push('Lista plana');
  } else if (treeLevel !== 99) {
    parts.push(`Nível: ${treeLevel}`);
  }
  return parts.length ? parts.join(' · ') : 'Sem filtros adicionais';
}

/** Paleta alinhada a `gerarRelatorioPedidosComprav2` (relatório expandido de embarques). */
const PDF_EMBARQUES_C = {
  text: [31, 41, 55],
  muted: [107, 114, 128],
  mutedLight: [156, 163, 175],
  panel: [248, 250, 252],
  soft: [243, 244, 246],
  rowAlt: [249, 250, 251],
  dark: [17, 24, 39],
  white: [255, 255, 255],
  teal: [45, 212, 191],
  tealDark: [15, 118, 110],
  kpiBg: [250, 250, 250],
  border: [229, 231, 235],
  profit: [15, 118, 110],
};

/** Larguras fixas (mm); descrição ocupa o restante de contentWidth menos os gaps. */
function buildPdfColumnLayout(contentWidth) {
  const colWidths = {
    quant: 11,
    un: 8,
    custoUnit: 14,
    precoVenda: 14,
    markup: 11,
    custoTotal: 14,
    vendaTotal: 14,
    lucro: 14,
  };
  const colKeys = [
    'quant',
    'un',
    'desc',
    'custoUnit',
    'precoVenda',
    'markup',
    'custoTotal',
    'vendaTotal',
    'lucro',
  ];
  const fixedSum = colKeys
    .filter((k) => k !== 'desc')
    .reduce((sum, k) => sum + colWidths[k], 0);
  colWidths.desc = Math.max(
    40,
    contentWidth - fixedSum - PDF_COL_GAP_MM * (colKeys.length - 1)
  );

  const colX = {};
  const colRight = {};
  let xAcc = 0;
  colKeys.forEach((key, idx) => {
    colX[key] = xAcc;
    colRight[key] = xAcc + colWidths[key];
    xAcc += colWidths[key] + (idx < colKeys.length - 1 ? PDF_COL_GAP_MM : 0);
  });

  return { colKeys, colWidths, colX, colRight };
}

function drawJustifiedPdfLine(pdf, line, x, y, maxWidth) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    pdf.text(trimmed, x, y);
    return;
  }
  const wordWidths = words.map((w) => pdf.getTextWidth(w));
  const textWidth = wordWidths.reduce((a, b) => a + b, 0);
  const extra = maxWidth - textWidth;
  if (extra <= 0.5) {
    pdf.text(trimmed, x, y);
    return;
  }
  const space = extra / (words.length - 1);
  let cursor = x;
  words.forEach((word, i) => {
    pdf.text(word, cursor, y);
    cursor += wordWidths[i] + (i < words.length - 1 ? space : 0);
  });
}

function wrapDescLinesPdf(pdf, text, maxWidth) {
  const raw = String(text || '?').trim();
  const lines = [];
  raw.split(/\n/).forEach((paragraph) => {
    const chunk = paragraph.trim();
    if (!chunk) return;
    lines.push(...pdf.splitTextToSize(chunk, maxWidth));
  });
  return lines.length ? lines : ['?'];
}

/** Título de coluna no header A4: centrado H/V (exceto `alignLeft`). */
function drawPdfA4HeaderCell(pdf, label, colLeft, colRight, headerTop, headerH, fontSize, { alignLeft = false } = {}) {
  const pad = 0.8;
  const colW = Math.max(4, colRight - colLeft - pad * 2);
  const lines = wrapDescLinesPdf(pdf, normalizePdfText(label), colW);
  const lineH = fontSize * 0.42;
  const textBlockH = lines.length * lineH;
  const startY = headerTop + (headerH - textBlockH) / 2 + lineH * 0.85;
  const x = alignLeft ? colLeft + pad : (colLeft + colRight) / 2;
  pdf.setFontSize(fontSize);
  lines.forEach((line, i) => {
    pdf.text(line, x, startY + i * lineH, { align: alignLeft ? 'left' : 'center' });
  });
}

function formatQuant(val, unitCode) {
  return formatCommercialQuantity(val, unitCode);
}

/** Coluna UN: folhas usam sigla; grupos só quando todas as folhas coincidem, senão "MIX". */
function formatMarginTreeUnidade(row, { isGroup = false } = {}) {
  if (isGroup) return formatMarginGroupUnidadeLabel(row.unidade_exibicao);
  return row.unidade_exibicao || 'UN';
}

const formatMoneyDisplay = (val) =>
  `R$ ${(val ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatPercentDisplay = (val) => `${(val ?? 0).toFixed(2)}%`;

/** Coluna de texto: seta à esquerda; pais e solteiros no mesmo alinhamento. */
const INDENT_GROUP = 14;
const INDENT_GROUP_MOBILE = 10;
const CHEVRON_SLOT_W = 14;
const CHEVRON_GAP = 6;
const CHEVRON_PULL = CHEVRON_SLOT_W + CHEVRON_GAP;
const CHEVRON_GAP_MOBILE = 4;
const CHEVRON_PULL_MOBILE = CHEVRON_SLOT_W + CHEVRON_GAP_MOBILE;
/** Início do texto (após área da seta) — nível 1 pais = solteiros. */
const MARGIN_DESC_TEXT_COL = CHEVRON_PULL;
const MARGIN_DESC_TEXT_COL_MOBILE = CHEVRON_PULL_MOBILE;

function marginDescTextStart(level) {
  return MARGIN_DESC_TEXT_COL + Math.max(0, (level ?? 1) - 1) * INDENT_GROUP;
}

function marginDescTextStartMobile(level) {
  return MARGIN_DESC_TEXT_COL_MOBILE + Math.max(0, (level ?? 1) - 1) * INDENT_GROUP_MOBILE;
}

function marginDescChevronLeft(textStart, chevronPull = CHEVRON_PULL) {
  return Math.max(0, textStart - chevronPull);
}

function marginDescTextStartPdfMm(level, pdfIndentProdutoMm, pdfIndentGroupMm) {
  const px = marginDescTextStart(level);
  const pxPerMm = 8 / pdfIndentProdutoMm;
  return 1 + px / pxPerMm;
}

function MargemDescricaoTexto({
  textStart,
  showChevron = false,
  expanded = false,
  chevronPull = CHEVRON_PULL,
  children,
  className = '',
}) {
  const chevronLeft = marginDescChevronLeft(textStart, chevronPull);
  return (
    <div className={`relative min-w-0 ${className}`} style={{ paddingLeft: textStart }}>
      {showChevron ? (
        <ChevronRight
          className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground transition-transform ${
            expanded ? 'rotate-90' : ''
          }`}
          style={{ left: chevronLeft }}
        />
      ) : null}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Corpo: entrelinha +50% (~1,5) e padding +20% (~1,2) em relação ao layout compacto anterior. */
const BODY_LINE_HEIGHT_MULT = 1.5;
const BODY_PAD_MULT = 1.2;

function MargemMobileReportHeader({ filtrosDesc }) {
  return (
    <div className={`relative mx-3 md:mx-0 mt-3 rounded-lg overflow-hidden ${MARGIN_TABLE_PANEL} border ${MARGIN_TABLE_BORDER}`}>
      <div className={`absolute left-3 top-4 bottom-4 w-[3px] rounded-sm ${p38Table.panelAccentBar}`} aria-hidden />
      <div className="pl-7 pr-3 py-3">
        <p className={`${MARGIN_BODY_TEXT} font-semibold tracking-wide uppercase leading-tight`}>
          Margem de vendas
        </p>
        <p className="text-[10px] text-white/60 mt-0.5 uppercase tracking-wide">Relatório técnico · mobile</p>
        <p className="text-[10px] text-white/55 mt-2 line-clamp-2 leading-snug">{filtrosDesc}</p>
        <p className="text-[9px] text-white/45 mt-2 text-right tabular-nums">
          Gerado {format(new Date(), 'dd/MM/yyyy HH:mm')}
        </p>
      </div>
    </div>
  );
}

function MargemMobileKpis({ totals, totalMarkup }) {
  const cards = [
    { label: 'Receita líq.', value: formatMoneyDisplay(totals.receita_liquida) },
    { label: 'Custo total', value: formatMoneyDisplay(totals.custo_total) },
    { label: 'Lucro', value: formatMoneyDisplay(totals.lucro_total), accent: true },
    { label: 'Markup', value: formatPctShortDisplay(totalMarkup), accent: true },
  ];

  return (
    <div className="mx-3 md:mx-0 mt-3 grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-2">
      {cards.map((card) => (
        <div key={card.label} className="min-w-0">
          <p className={`${MARGIN_TABLE_MICRO} uppercase tracking-wide text-muted-foreground leading-none`}>{card.label}</p>
          <p
            className={`${MARGIN_BODY_TEXT} tabular-nums mt-1 truncate ${
              card.accent ? MARGIN_ACCENT_VALUE : 'text-foreground'
            }`}
          >
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function MargemMobileColumnHeader({ className = '', invisible = false, pinStyle = null }) {
  return (
    <div
      className={`mx-3 md:mx-0 mt-3 mb-1 rounded-lg overflow-hidden ${MARGIN_TABLE_PANEL} border ${MARGIN_TABLE_BORDER} ${
        invisible ? 'invisible pointer-events-none' : ''
      } ${pinStyle ? 'fixed z-[60]' : ''} ${className}`}
      style={pinStyle || undefined}
    >
      <div className="flex">
        <div className="w-[3.25rem] flex-shrink-0 border-r border-white/15 px-1.5 py-2 text-right">
          <p className={`${MARGIN_MOBILE_HEADER_LABEL} text-right`}>Qtd</p>
          <p className={`${MARGIN_MOBILE_HEADER_LABEL} text-right mt-2`}>Un</p>
        </div>
        <div className="flex-1 min-w-0 py-2 pr-2">
          {MARGIN_MOBILE_VALUE_ROWS.map((valueRow, rowIdx) => (
            <div
              key={rowIdx}
              className={`${MARGIN_MOBILE_VALUES_GRID} ${rowIdx === 0 ? '' : 'mt-1.5'}`}
            >
              {valueRow.map(({ label }) => (
                <p key={label} className={MARGIN_MOBILE_HEADER_LABEL}>
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

function MargemMobileQtdUnCol({ qtd, unidade, showAccentDot = true }) {
  return (
    <div className="relative w-[3.25rem] flex-shrink-0 border-r border-border/40 dark:border-white/10 pr-1.5 py-2.5 text-right">
      {showAccentDot ? (
        <span
          className={`absolute left-0 top-3 ${p38Table.accentDot}`}
          aria-hidden
        />
      ) : null}
      <p className={`${MARGIN_BODY_TEXT} tabular-nums text-foreground leading-none`}>
        {formatCommercialQuantity(qtd, unidade)}
      </p>
      <p className={`${MARGIN_BODY_TEXT} uppercase text-muted-foreground mt-1.5 leading-none truncate`}>
        {unidade}
      </p>
    </div>
  );
}

function MargemMobileTabulatedValues({ row, className = '', tier = 'filho' }) {
  const values = buildMarginMobileTabulatedValues(row);

  return (
    <div className={className}>
      {MARGIN_MOBILE_VALUE_ROWS.map((valueRow, rowIdx) => (
        <div
          key={rowIdx}
          className={`${MARGIN_MOBILE_VALUES_GRID} ${rowIdx === 0 ? '' : 'mt-1'}`}
        >
          {valueRow.map(({ key }) => {
            const value = values[key];
            const isCusto = key === 'custoUnit' || key === 'custoTotal';
            const content = isCusto ? (
              <MargemCustoValorTooltip row={row} mode={key === 'custoUnit' ? 'unit' : 'total'} className="block truncate text-right">
                {value}
              </MargemCustoValorTooltip>
            ) : (
              value
            );
            return (
              <div key={key} className="min-w-0">
                <p
                  className={`${MARGIN_BODY_TEXT} tabular-nums text-right truncate ${marginMetricValueClass(key, tier)}`}
                >
                  {content}
                </p>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function MargemLinhaMobile({
  row,
  variant = 'produto',
  level = 1,
  isExpanded,
  isLeaf,
  onToggle,
}) {
  const isSubtotal = variant === 'subtotal';
  const isGroup = variant === 'grupo';
  const titulo = isSubtotal ? row.nome || 'Subtotal' : isGroup ? row.label : row.nome;
  const textStart = marginDescTextStartMobile(level);
  const canExpand = isGroup && !isLeaf && typeof onToggle === 'function';
  const rowBase =
    `mx-3 md:mx-0 border-b ${MARGIN_TABLE_BORDER} bg-background min-w-0 max-w-full touch-pan-y`;
  const productTier = level <= 1 ? 'solteiro' : 'filho';

  if (isGroup || isSubtotal) {
    const showMetrics = !isSubtotal && row.showMetrics !== false;
    const unidade = formatMarginTreeUnidade(row, { isGroup: true });
    const qtd = row.quantidade_vendida || 0;
    const groupTitle = (
      <span
        lang="pt-BR"
        className={`block line-clamp-2 break-words ${marginDesktopDescClass('pai')}`}
      >
        {String(titulo || '').toUpperCase()}
        {row.count != null ? ` (${row.count})` : ''}
      </span>
    );

    if (!showMetrics) {
      const collapsedInner = (
        <MargemDescricaoTexto
          textStart={textStart}
          showChevron={!isLeaf && !isSubtotal}
          expanded={isExpanded}
          chevronPull={CHEVRON_PULL_MOBILE}
          className="flex-1 px-3 py-2.5"
        >
          {groupTitle}
        </MargemDescricaoTexto>
      );

      if (canExpand) {
        return (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isExpanded}
            className={`w-full text-left active:bg-secondary/30 dark:active:bg-secondary/50 ${rowBase}`}
          >
            {collapsedInner}
          </button>
        );
      }

      return <div className={rowBase}>{collapsedInner}</div>;
    }

    const expandedInner = (
      <>
        {canExpand ? (
          <span className="flex-shrink-0 w-6 flex items-start justify-center pt-3 pl-1">
            <ChevronRight
              className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          </span>
        ) : (
          <span className="w-2 flex-shrink-0" aria-hidden />
        )}
        <MargemMobileQtdUnCol qtd={qtd} unidade={unidade} />
        <div className="flex-1 min-w-0 py-2 pr-2">
          {groupTitle}
          <MargemMobileTabulatedValues row={row} className="mt-1" tier="pai" />
        </div>
      </>
    );

    if (canExpand) {
      return (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          className={`w-full text-left flex min-w-0 active:bg-secondary/30 dark:active:bg-secondary/50 ${rowBase}`}
        >
          {expandedInner}
        </button>
      );
    }

    return <div className={`flex min-w-0 ${rowBase}`}>{expandedInner}</div>;
  }

  const unidade = row.unidade_exibicao || 'UN';
  const qtd = row.quantidade_vendida || 0;

  return (
    <div className={`flex ${rowBase}`}>
      <MargemMobileQtdUnCol qtd={qtd} unidade={unidade} />
      <div className="flex-1 min-w-0 py-2 pr-2">
        <p lang="pt-BR" className={`line-clamp-2 break-words leading-snug ${marginDesktopDescClass(productTier)}`}>
          {titulo}
        </p>
        <MargemMobileTabulatedValues row={row} className="mt-1" tier={productTier} />
      </div>
    </div>
  );
}

function useMarginColumnHeaderPin(scrollRef) {
  const sentinelRef = useRef(null);
  const [pinned, setPinned] = useState(false);
  const [pinFrame, setPinFrame] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const sync = () => {
      const scrollEl = scrollRef.current;
      const sentinelRect = sentinel.getBoundingClientRect();
      const usesInnerScroll = Boolean(
        scrollEl && scrollEl.scrollHeight > scrollEl.clientHeight + 1,
      );
      const scrollRect = scrollEl?.getBoundingClientRect();
      const anchorTop = usesInnerScroll && scrollRect ? scrollRect.top : 48;
      const anchorLeft = scrollRect?.left ?? 0;
      const anchorWidth = scrollRect?.width ?? window.innerWidth;

      setPinned(sentinelRect.top < anchorTop + 0.5);
      setPinFrame({
        top: anchorTop,
        left: anchorLeft,
        width: anchorWidth,
      });
    };

    const scrollEl = scrollRef.current;
    scrollEl?.addEventListener('scroll', sync, { passive: true });
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
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
      resizeObserver.disconnect();
    };
  }, [scrollRef]);

  return { sentinelRef, pinned, pinFrame };
}

export default function RelatorioMargemVendas() {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('plana'); // 'dinamica' | 'plana'
  const [treeLevel, setTreeLevel] = useState(99);
  const [expandedKeys, setExpandedKeys] = useState(new Set());
  const [dateRange, setDateRange] = useState({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
  const [searchDraft, setSearchDraft] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('lucro_total');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [toolsCollapsed, setToolsCollapsed] = useState(false);
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load all products to get CURRENT costs
      const prods = await fetchAllProdutosCatalogo();
      setProducts(prods);

      const allSales = await fetchPedidosVendaParaMargem();
      setSales(allSales);

    } catch (error) {
      console.error("Error loading report data", error);
    } finally {
      setLoading(false);
    }
  };

  const processedData = useMemo(() => {
    if (!sales.length || !products.length) return [];

    try {
    const prodMap = products.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});

    const reportMap = {};

    sales.forEach(sale => {
       if (!pedidoElegivelMargem(sale)) return;
       if (!vendaNoIntervaloConsulta(sale, dateRange?.from, dateRange?.to)) return;

       const itens = Array.isArray(sale.itens) ? sale.itens.filter((item) => item && typeof item === 'object') : [];
       const alocacoes = alocarReceitaPedidoNasLinhas(sale);

       itens.forEach((item, index) => {
         const alloc = alocacoes[index] || {
           total_recebido: 0,
           total_desconto_venda: 0,
           receita_liquida: 0,
         };
         const prodKey = resolveMargemProdutoKey(item);
         const prodId = item.produto_id;
         const product = prodId ? prodMap[prodId] : null;
         const custoCalculado = resolveCustoUnitarioMargem(item, product);

         if (!reportMap[prodKey]) {
          const unidadeInicial = product
            ? resolveCommercialDisplay(product, 0, item.unidade_medida || product?.unidade_principal || 'UN')
            : { unidade: item.unidade_medida || 'UN', quantidade: 0 };
           reportMap[prodKey] = {
             produto_id: prodId || null,
             codigo_interno: product?.codigo_interno || '—',
             nome: product?.nome || item.produto_nome || 'Produto sem cadastro',
             categoria: product?.categoria_nome || 'Sem cadastro',
             tags: product?.tags || [],
             campo_hierarquico_1: product?.campo_hierarquico_1 || 'Outros',
             campo_hierarquico_2: product?.campo_hierarquico_2,
             campo_hierarquico_3: product?.campo_hierarquico_3,
             campo_hierarquico_4: product?.campo_hierarquico_4,
            unidade_exibicao: unidadeInicial.unidade || 'UN',
             vendas_count: 0,
             quantidade_vendida: 0,
             quantidade_base_vendida: 0,
             total_recebido: 0,
             total_desconto_venda: 0,
             custo_unitario_cadastro: custoCalculado,
             ...criarCamposCustoComponentesZerados(),
           };
         }

         const entry = reportMap[prodKey];
        const quantidadeBase = Number(item.quantidade_base ?? (item.quantidade * (item.fator_conversao || 1)) ?? item.quantidade ?? 0) || 0;
        const quantidadeResolvida = product
          ? resolveCommercialDisplay(product, quantidadeBase, item.unidade_medida || product?.unidade_principal || 'UN')
          : { quantidade: Number(item.quantidade) || quantidadeBase, unidade: item.unidade_medida || 'UN' };
         entry.vendas_count += 1;
        entry.quantidade_base_vendida += quantidadeBase;
         entry.quantidade_vendida += quantidadeResolvida.quantidade;
        entry.unidade_exibicao = quantidadeResolvida.unidade || entry.unidade_exibicao || 'UN';
         entry.total_recebido += alloc.total_recebido;
         entry.total_desconto_venda += alloc.total_desconto_venda;
         acumularCustoComponentesMargem(
           entry,
           resolveCustoComponentesUnitBaseMargem(product, item),
           quantidadeBase,
         );
       });
     });

    let sorted = Object.values(reportMap).map(item => {
       const custo_total = calcularCustoTotalDosComponentes(item);
       const receita_liquida = item.total_recebido - item.total_desconto_venda;
       const lucro_total = receita_liquida - custo_total;
       const valor_unitario_medio =
         item.quantidade_vendida > 0 ? receita_liquida / item.quantidade_vendida : 0;
       const margem_percentual = receita_liquida > 0 ? (lucro_total / receita_liquida) * 100 : 0;
       const markup_percentual = custo_total > 0 ? (lucro_total / custo_total) * 100 : 0;
       const lucro_marginal = lucro_total / item.quantidade_vendida;
       const custo_unitario_calc =
         item.quantidade_vendida > 0
           ? custo_total / item.quantidade_vendida
           : escalarValorCustoMargemUnidadeExibicao(item.custo_unitario_cadastro ?? 0, item);

      return {
         ...item,
         custo_total,
         receita_liquida,
         lucro_total,
         valor_unitario_medio,
         custo_unitario_calc,
         custo_unitario_exibicao: custo_unitario_calc,
         margem_percentual,
         markup_percentual,
         lucro_marginal
       };
    });

    // Sort first
    sorted.sort((a, b) => {
      const aVal = a[sortField] || 0;
      const bVal = b[sortField] || 0;
      
      if (typeof aVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // Mesmo padrão do catálogo: espaço ou ";" separa termos que devem aparecer no produto.
    const searchTokens = parseSearchTerms(searchTerm);
    if (searchTokens.length > 0) {
      sorted = sorted.filter((item) => {
        const haystack = [
          item.nome,
          item.codigo_interno,
          item.categoria,
          item.campo_hierarquico_1,
          item.campo_hierarquico_2,
          item.campo_hierarquico_3,
          item.campo_hierarquico_4,
          ...(Array.isArray(item.tags) ? item.tags : []),
        ]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());
        return searchTokens.every((term) => haystack.some((value) => value.includes(term)));
      });
    }

    return sorted;
    } catch (error) {
      console.error('Erro ao processar dados do relatório de margem', error);
      return [];
    }
  }, [sales, products, dateRange, searchTerm, sortField, sortOrder]);

  const marginTree = useMemo(
    () => buildMarginTree(Array.isArray(processedData) ? processedData : []),
    [processedData]
  );

  useEffect(() => {
    if (!processedData?.length) {
      setExpandedKeys(new Set());
      return;
    }
    setExpandedKeys(
      treeLevel === 1 ? new Set() : buildExpandedForLevel(marginTree, treeLevel - 1)
    );
  }, [treeLevel, marginTree, processedData?.length]);

  const displayRows = useMemo(() => {
    if (!processedData?.length) return [];
    if (viewMode === 'plana') {
      return buildMarginFlatRows(processedData);
    }
    return flattenMarginTree(marginTree, expandedKeys ?? new Set(), '', 0, sortField, sortOrder);
  }, [viewMode, processedData, marginTree, expandedKeys, sortField, sortOrder]);

  const mainScrollRef = useRef(null);
  const pendingScrollRef = useRef(null);
  const { sentinelRef: mobileHeaderSentinelRef, pinned: mobileHeaderPinned, pinFrame: mobilePinFrame } =
    useMarginColumnHeaderPin(mainScrollRef);
  const mobilePinStyle = mobileHeaderPinned
    ? { top: mobilePinFrame.top, left: mobilePinFrame.left, width: mobilePinFrame.width }
    : null;

  const shouldVirtualizeRows = displayRows.length >= MARGIN_VIRTUALIZE_MIN_ROWS;

  const estimateDesktopRowSize = useCallback(
    (index) =>
      displayRows[index]?.type === 'group'
        ? MARGIN_DESKTOP_ROW_H_GROUP
        : MARGIN_DESKTOP_ROW_H_PRODUTO,
    [displayRows]
  );

  const estimateMobileRowSize = useCallback(
    (index) => {
      const row = displayRows[index];
      if (!row) return MARGIN_MOBILE_ROW_H_PRODUTO;
      if (row.type === 'group') {
        return row.showMetrics !== false
          ? MARGIN_MOBILE_ROW_H_GROUP
          : MARGIN_MOBILE_ROW_H_GROUP_COLLAPSED;
      }
      return MARGIN_MOBILE_ROW_H_PRODUTO;
    },
    [displayRows]
  );

  const desktopVirtual = useVirtualRows({
    itemCount: displayRows.length,
    estimateSize: estimateDesktopRowSize,
    overscan: 12,
    scrollElementRef: mainScrollRef,
  });

  const mobileVirtual = useVirtualRows({
    itemCount: displayRows.length,
    estimateSize: estimateMobileRowSize,
    overscan: 6,
    scrollElementRef: mainScrollRef,
  });

  const visibleDesktopRows = useMemo(
    () =>
      shouldVirtualizeRows
        ? displayRows.slice(desktopVirtual.startIndex, desktopVirtual.endIndex)
        : displayRows,
    [displayRows, shouldVirtualizeRows, desktopVirtual.endIndex, desktopVirtual.startIndex]
  );

  const visibleMobileRows = useMemo(
    () =>
      shouldVirtualizeRows
        ? displayRows.slice(mobileVirtual.startIndex, mobileVirtual.endIndex)
        : displayRows,
    [displayRows, shouldVirtualizeRows, mobileVirtual.endIndex, mobileVirtual.startIndex]
  );

  useLayoutEffect(() => {
    const scrollEl = mainScrollRef.current;
    if (scrollEl) pendingScrollRef.current = scrollEl.scrollTop;
  }, [expandedKeys, treeLevel, viewMode, displayRows.length]);

  useLayoutEffect(() => {
    const scrollEl = mainScrollRef.current;
    const top = pendingScrollRef.current;
    if (scrollEl != null && top != null) {
      scrollEl.scrollTop = top;
      pendingScrollRef.current = null;
    }
  }, [expandedKeys, displayRows.length]);

  const exportRows = useMemo(() => {
    if (!processedData.length) return [];
    if (viewMode === 'plana') return processedData;
    return collectAllMarginLeaves(marginTree, sortField, sortOrder);
  }, [viewMode, processedData, marginTree, sortField, sortOrder]);

  const handleMetricSort = useCallback(
    (metricKey) => {
      const field = MARGIN_METRIC_SORT_FIELD[metricKey];
      if (!field) return;
      if (sortField === field) {
        setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortOrder('desc');
      }
    },
    [sortField]
  );

  const handleToggleGroup = useCallback((key) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const renderMargemDesktopRow = useCallback(
    (treeRow, rowIdx) => {
      if (treeRow.type === 'group') {
        const isExpanded = expandedKeys.has(treeRow.key);
        const isLeaf = treeRow.isLeafGroup;
        const showGroupMetrics = treeRow.showMetrics !== false;
        const tier = 'pai';
        return (
          <tr
            key={treeRow.key}
            onClick={isLeaf ? undefined : () => handleToggleGroup(treeRow.key)}
            className={`${MARGIN_TABLE_ROW} select-none ${
              isLeaf ? '' : 'cursor-pointer'
            }`}
          >
            <td className={`py-1.5 px-2 ${marginDesktopQuantClass(tier)}`} style={{ lineHeight: 1.2 }}>
              {showGroupMetrics ? formatQuant(treeRow.quantidade_vendida, treeRow.unidade_exibicao) : ''}
            </td>
            <td
              className={`py-1.5 px-2 ${MARGIN_BODY_TEXT} text-center ${MARGIN_MUTED_VALUE}`}
              style={{ lineHeight: 1.2 }}
            >
              {showGroupMetrics ? formatMarginTreeUnidade(treeRow, { isGroup: true }) : ''}
            </td>
            <td
              lang="pt-BR"
              className={`py-1.5 px-2 min-w-0 ${marginDesktopDescClass(tier)}`}
              style={{ lineHeight: 1.2, minHeight: 36 }}
            >
              <MargemDescricaoTexto
                textStart={marginDescTextStart(treeRow.level)}
                showChevron={!isLeaf}
                expanded={isExpanded}
              >
                <span className="flex items-center gap-1 min-w-0 truncate">
                  <span className="truncate">{treeRow.label}</span>
                  <span className={`h-5 px-1.5 ${MARGIN_BODY_TEXT} font-medium border border-border/40 text-muted-foreground dark:border-border dark:text-muted-foreground rounded-full flex items-center justify-center normal-case flex-shrink-0`}>
                    {treeRow.count}
                  </span>
                </span>
              </MargemDescricaoTexto>
            </td>
            <MargemDesktopMetricCells dataRow={treeRow} showMetrics={showGroupMetrics} tier={tier} />
          </tr>
        );
      }

      const row = treeRow.item;
      const tier = getMarginRowTier(treeRow);
      return (
        <tr
          key={treeRow.key}
          className={`${MARGIN_TABLE_ROW} transition-colors group`}
        >
          <td className={`py-1.5 px-2 ${marginDesktopQuantClass(tier)}`} style={{ lineHeight: 1.2 }}>
            {formatQuant(row.quantidade_vendida, row.unidade_exibicao)}
          </td>
          <td
            className={`py-1.5 px-2 ${MARGIN_BODY_TEXT} text-center ${MARGIN_MUTED_VALUE}`}
            style={{ lineHeight: 1.2 }}
          >
            {row.unidade_exibicao || 'UN'}
          </td>
          <td
            lang="pt-BR"
            className={`py-1.5 px-2 min-w-0 ${marginDesktopDescClass(tier)}`}
            style={{ lineHeight: 1.2, minHeight: 46 }}
          >
            <MargemDescricaoTexto textStart={marginDescTextStart(treeRow.level)}>
              <span className="block truncate">{row.nome}</span>
            </MargemDescricaoTexto>
          </td>
          <MargemDesktopMetricCells dataRow={row} tier={tier} />
        </tr>
      );
    },
    [expandedKeys, handleToggleGroup]
  );

  const totals = useMemo(() => {
    if (!processedData.length) {
      return {
        quantidade_vendida: 0,
        total_recebido: 0,
        total_desconto_venda: 0,
        receita_liquida: 0,
        custo_total: 0,
        lucro_total: 0,
        ...criarCamposCustoComponentesZerados(),
      };
    }
    const desconto = processedData.reduce((d, item) => d + (item.total_desconto_venda || 0), 0);
    const base = processedData.reduce(
      (acc, item) => ({
        quantidade_vendida: acc.quantidade_vendida + (item.quantidade_vendida || 0),
        total_recebido: acc.total_recebido + (item.total_recebido || 0),
        total_desconto_venda: desconto,
        receita_liquida: acc.receita_liquida + (item.receita_liquida || 0),
        custo_total: acc.custo_total + (item.custo_total || 0),
        lucro_total: acc.lucro_total + (item.lucro_total || 0),
      }),
      {
        quantidade_vendida: 0,
        total_recebido: 0,
        total_desconto_venda: desconto,
        receita_liquida: 0,
        custo_total: 0,
        lucro_total: 0,
      }
    );
    const custoComponentes = processedData.reduce(
      (acc, item) => somarCamposCustoComponentes(acc, item),
      criarCamposCustoComponentesZerados(),
    );
    return { ...base, ...custoComponentes };
  }, [processedData]);

  const totalMarkup = totals.custo_total > 0 ? (totals.lucro_total / totals.custo_total) * 100 : 0;

  const productCount = processedData.length;
  const activeFilterCount = [
    searchTerm.trim(),
    viewMode === 'dinamica' && treeLevel !== 99,
  ].filter(Boolean).length;

  const formatMoney = (val) => `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatPercent = (val) => `${val.toFixed(2)}%`;

  const exportToCSV = () => {
    const flat = exportRows.length ? exportRows : processedData;
    const headers =
      `Produto;Categoria;Quant;Un;Custo Un Calc;Preço Venda Médio;Markup %;Custo Total;Receita Total;Lucro;${CUSTO_MARGEM_CAMPOS.map((c) => c.label).join(';')}\n`;
    const rows = flat
      .map((row) => {
        const values = buildMarginMobileTabulatedValues(row);
        const custoPartes = CUSTO_MARGEM_CAMPOS.map((campo) => {
          const raw = Number(row[campo.totalKey]) || 0;
          const signed = campo.subtract ? -raw : raw;
          return (signed).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }).join(';');
        return `${row.nome};${row.categoria};${row.quantidade_vendida};${row.unidade_exibicao || 'UN'};${values.custoUnit};${values.precoVenda};${values.markup};${values.custoTotal};${values.vendaTotal};${values.lucro};${custoPartes}`;
      })
      .join('\n');
    const csvContent = "data:text/csv;charset=utf-8," + headers + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "relatorio_margem.csv");
    document.body.appendChild(link);
    link.click();
  };

  const exportToPDF = async (version = 'a4') => {
    if (!dateRange.from || !dateRange.to) {
      toast.error('Selecione um período antes de exportar');
      return;
    }

    if (!processedData.length) {
      toast.error('Não há dados para exportar no período selecionado');
      return;
    }

    const isMobilePdf = version === 'expandida_mobile';
    const isEnxutoPdf = version === 'a4_enxuto';

    try {
    if (isEnxutoPdf) {
      const { generateRelatorioMargemEnxutoPdf } = await import('@/lib/relatorioMargemPdf');
      const resposta = await generateRelatorioMargemEnxutoPdf({
        displayRows: displayRows.length ? displayRows : [],
        totals,
        totalMarkup,
        productCount,
        filtersDesc: buildMarginFiltrosDesc({ dateRange, searchTerm, treeLevel, viewMode }),
        generatedAt: format(new Date(), 'dd/MM/yyyy HH:mm'),
      });
      const blob = new Blob([resposta.data], { type: 'application/pdf' });
      const fileDate = format(new Date(), 'yyyy-MM-dd');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `relatorio_margem_enxuto_${fileDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      return;
    }

    if (isMobilePdf) {
      const JsPDF = await loadJsPDF();
      const pdf = new JsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [MOBILE_PDF_W_MM, MOBILE_PDF_H_MM],
      });
      const pdfFontFamily = await registerJsPdfDin1451Fonts(pdf);
      const setPdfFont = (style = 'normal') => pdf.setFont(pdfFontFamily, style);
      const MOBILE_PDF_FONT_SCALE = 1.12;
      const MOBILE_ROW_GAP = 0.65;
      const MOBILE_PDF_DARK = {
        page: [26, 27, 33],
        text: [243, 244, 246],
        textMuted: [139, 139, 147],
        border: [56, 62, 71],
        divider: [45, 51, 59],
      };
      const MOBILE_HUD = {
        storm: [45, 51, 59],
        headerText: [255, 255, 255],
        headerTextMuted: [139, 139, 147],
        accent: MARGIN_ACCENT_LIME_RGB,
        grid: MOBILE_PDF_DARK.border,
      };
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const M = 5;
      const CW = pageW - M * 2;
      const flatRows = displayRows.length ? displayRows : [];
      const filtrosDesc = buildMarginFiltrosDesc({
        dateRange,
        searchTerm,
        treeLevel,
        viewMode,
      });

      const formatNumPdf = (val) =>
        (val ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const formatPctPdf = (val) => `${(val ?? 0).toFixed(1).replace('.', ',')}%`;
      const formatMoneyPdf = (val) => `R$ ${formatNumPdf(val)}`;

      const setColor = (rgb) => pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
      const setFill = (rgb) => pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
      const setDraw = (rgb) => pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);

      let y = 12;
      let mobileTableHeaderOnPage = false;

      const fillMobilePdfPage = () => {
        setFill(MOBILE_PDF_DARK.page);
        pdf.rect(0, 0, pageW, pageH, 'F');
      };

      fillMobilePdfPage();

      const ensureSpace = (needed = 20, { repeatTableHeader = true } = {}) => {
        if (y + needed <= pageH - 6) return;
        pdf.addPage();
        fillMobilePdfPage();
        y = M + 2;
        mobileTableHeaderOnPage = false;
        if (repeatTableHeader) drawMobileColumnHeaders();
      };

      const setPdfMetricColor = (key, tier = 'filho') => {
        if (key === 'markup' || key === 'lucro') setColor(MARGIN_ACCENT_LIME_RGB);
        else if (key === 'custoUnit' || key === 'custoTotal') setColor(MOBILE_PDF_DARK.textMuted);
        else if (tier === 'filho') setColor(MOBILE_PDF_DARK.textMuted);
        else setColor(MOBILE_PDF_DARK.text);
      };

      const drawMobileHeader = () => {
        const panelH = 26;
        setFill(MOBILE_HUD.storm);
        pdf.roundedRect(M, y, CW, panelH, 1.5, 1.5, 'F');
        setFill(MOBILE_HUD.accent);
        pdf.roundedRect(M + 3, y + 4, 1.1, panelH - 8, 0.6, 0.6, 'F');

        setPdfFont('bold');
        pdf.setFontSize(12.5 * MOBILE_PDF_FONT_SCALE);
        setColor(MOBILE_HUD.headerText);
        pdf.text(normalizePdfText('MARGEM DE VENDAS'), M + 7, y + 9);

        setPdfFont('normal');
        pdf.setFontSize(6.5 * MOBILE_PDF_FONT_SCALE);
        setColor(MOBILE_HUD.headerTextMuted);
        pdf.text(normalizePdfText('RELATÓRIO TÉCNICO · MOBILE'), M + 7, y + 14.5);

        const filtrosLinhas = pdf.splitTextToSize(normalizePdfText(filtrosDesc), CW - 10).slice(0, 2);
        let fy = y + 18.5;
        filtrosLinhas.forEach((line) => {
          pdf.text(line, M + 7, fy);
          fy += 3.6;
        });

        pdf.setFontSize(6 * MOBILE_PDF_FONT_SCALE);
        setColor(MOBILE_HUD.headerText);
        pdf.text(
          normalizePdfText(`GERADO ${format(new Date(), 'dd/MM/yyyy HH:mm')}`),
          M + CW - 3,
          y + panelH - 2.8,
          { align: 'right' }
        );

        y += panelH + 3;
      };

      const drawMobileKpis = () => {
        const cards = [
          { label: 'RECEITA LÍQ.', value: formatMoneyPdf(totals.receita_liquida) },
          { label: 'CUSTO TOTAL', value: formatMoneyPdf(totals.custo_total) },
          { label: 'LUCRO', value: formatMoneyPdf(totals.lucro_total), accent: true },
          { label: 'MARKUP', value: formatPctPdf(totalMarkup), accent: true },
        ];
        const colW = (CW - 3) / 2;
        const cardH = 11;
        for (let i = 0; i < cards.length; i += 2) {
          ensureSpace(14);
          [0, 1].forEach((col) => {
            const card = cards[i + col];
            if (!card) return;
            const cx = M + col * (colW + 3);
            setPdfFont('normal');
            pdf.setFontSize(5.2 * MOBILE_PDF_FONT_SCALE);
            setColor(MOBILE_PDF_DARK.textMuted);
            pdf.text(normalizePdfText(card.label), cx, y + 4);
            pdf.setFontSize(7.8 * MOBILE_PDF_FONT_SCALE);
            setColor(card.accent ? MARGIN_ACCENT_LIME_RGB : MOBILE_PDF_DARK.text);
            pdf.text(card.value, cx, y + 9.2);
          });
          y += cardH + 1.5;
        }
        y += 1.5;
      };

      const getMobileRowLayout = () => ({
        itemMl: M + 14.8,
        lineX: M + 12.5,
        qtdColRight: M + 11.5,
        nomeMaxW: M + CW - (M + 14.8) - 3,
        contentRight: M + CW,
        lineWidth: 2.5,
      });

      const buildMobileMarginValueColumns = (itemMl, contentRight, colCount) => {
        const gap = 1.1;
        const count = colCount;
        const colW = (contentRight - itemMl - gap * (count - 1)) / count;
        const colRight = Array.from({ length: count }, (_, idx) => itemMl + (idx + 1) * colW + idx * gap);
        return { colW, colRight, gap, count };
      };

      const drawMobileColumnHeaders = () => {
        if (mobileTableHeaderOnPage) return;
        const cfg = getMobileRowLayout();
        const row1 = buildMobileMarginValueColumns(cfg.itemMl, cfg.contentRight, 3);
        const row2 = buildMobileMarginValueColumns(cfg.itemMl, cfg.contentRight, 3);
        const headerH = 11;

        if (y + headerH + 2 > pageH - 6) {
          pdf.addPage();
          fillMobilePdfPage();
          y = M + 2;
        }

        setFill(MOBILE_HUD.storm);
        pdf.roundedRect(M, y, CW, headerH, 1.2, 1.2, 'F');
        setFill(MOBILE_PDF_DARK.divider);
        pdf.rect(cfg.lineX, y + 1, 0.12, headerH - 2, 'F');

        setPdfFont('normal');
        pdf.setFontSize(5.6 * MOBILE_PDF_FONT_SCALE);
        setColor(MOBILE_HUD.headerText);
        pdf.text('QTD', cfg.qtdColRight, y + 4.8, { align: 'right' });
        pdf.text('UN', cfg.qtdColRight, y + 8.6, { align: 'right' });

        const headerRow1Y = y + 5.2;
        MARGIN_MOBILE_VALUE_ROWS[0].forEach(({ label }, idx) => {
          pdf.text(normalizePdfText(label), row1.colRight[idx], headerRow1Y, { align: 'right' });
        });
        const headerRow2Y = y + 9.2;
        MARGIN_MOBILE_VALUE_ROWS[1].forEach(({ label }, idx) => {
          pdf.text(normalizePdfText(label), row2.colRight[idx], headerRow2Y, { align: 'right' });
        });

        y += headerH + 0.6;
        mobileTableHeaderOnPage = true;
      };

      const drawMobileTabulatedValues = (dataRow, cfg, valoresY, fontScale, tier = 'filho') => {
        const row1 = buildMobileMarginValueColumns(cfg.itemMl, cfg.contentRight, 3);
        const row2 = buildMobileMarginValueColumns(cfg.itemMl, cfg.contentRight, 3);
        const values = {
          custoUnit: formatNumPdf(getRowCustoUnitCalc(dataRow)),
          precoVenda: formatNumPdf(getRowPrecoMedio(dataRow)),
          markup: formatPctPdf(getRowMarkup(dataRow)),
          custoTotal: formatNumPdf(dataRow.custo_total || 0),
          vendaTotal: formatNumPdf(dataRow.receita_liquida || 0),
          lucro: formatNumPdf(dataRow.lucro_total || 0),
        };
        const row2Y = valoresY + 5.2;

        setPdfFont('normal');
        pdf.setFontSize(7.5 * fontScale);
        MARGIN_MOBILE_VALUE_ROWS[0].forEach(({ key }, idx) => {
          setPdfMetricColor(key, tier);
          pdf.text(values[key], row1.colRight[idx], valoresY, { align: 'right' });
        });
        MARGIN_MOBILE_VALUE_ROWS[1].forEach(({ key }, idx) => {
          setPdfMetricColor(key, tier);
          pdf.text(values[key], row2.colRight[idx], row2Y, { align: 'right' });
        });
      };

      const measureMarginCompactRow = (dataRow, y0, { isGroup = false, groupLabel = null, showMetrics = true } = {}) => {
        const cfg = getMobileRowLayout();
        const vs = 1.05;
        const fontScale = MOBILE_PDF_FONT_SCALE;
        const nomeLineStep = 3.75 * vs;
        const margemLinhaInferiorItem = 0.65 * vs;
        const gapNomeValores = 2.6 * vs;
        const valoresLineH = 9.2 * vs;
        const qtdUnBlockBottom = 5.9 * vs;

        const unidade = isGroup
          ? formatMarginTreeUnidade(dataRow, { isGroup: true })
          : dataRow.unidade_exibicao || 'UN';
        const qtd = dataRow.quantidade_vendida || 0;

        const nomeText = isGroup
          ? normalizePdfText(
              `${String(groupLabel || dataRow.label || '').toUpperCase()}${dataRow.count != null ? ` (${dataRow.count})` : ''}`
            )
          : normalizePdfText(String(dataRow?.nome || '?'));

        setPdfFont('normal');
        pdf.setFontSize(7.8 * fontScale);
        const nomeLinhas = pdf.splitTextToSize(nomeText, cfg.nomeMaxW).slice(0, 3);
        const nomeTop = y0 + 2.4 * vs;
        const lastNomeBaseline = nomeTop + Math.max(0, nomeLinhas.length - 1) * nomeLineStep;
        const descBottom = lastNomeBaseline + 0.8 * vs;

        if (isGroup && !showMetrics) {
          const rowBlockH = descBottom + margemLinhaInferiorItem - y0 + 1;
          return { rowBlockH, cfg, vs, fontScale, nomeLinhas, nomeTop, nomeLineStep, isGroup, showMetrics, qtd, unidade };
        }

        const valoresY = Math.max(descBottom, y0 + qtdUnBlockBottom) + gapNomeValores;
        const rowBlockH = valoresY + valoresLineH + margemLinhaInferiorItem - y0;

        return {
          rowBlockH,
          cfg,
          vs,
          fontScale,
          nomeLinhas,
          nomeTop,
          nomeLineStep,
          valoresY,
          qtd,
          unidade,
          isGroup,
          showMetrics,
        };
      };

      const drawMarginCompactRow = (dataRow, y0, opts = {}) => {
        const measured = measureMarginCompactRow(dataRow, y0, opts);
        const {
          rowBlockH,
          cfg,
          vs,
          fontScale,
          nomeLinhas,
          nomeTop,
          nomeLineStep,
          valoresY,
          qtd,
          unidade,
          isGroup,
          showMetrics,
        } = measured;
        const tier = opts.tier ?? (isGroup ? 'pai' : 'filho');
        const descStrong = tier !== 'filho';

        if (isGroup && !showMetrics) {
          setPdfFont('normal');
          pdf.setFontSize(7.4 * fontScale);
          setColor(MOBILE_PDF_DARK.text);
          nomeLinhas.forEach((line, li) => {
            pdf.text(line, M + 3, nomeTop + li * nomeLineStep);
          });
          setDraw(MOBILE_HUD.grid);
          pdf.setLineWidth(0.1);
          pdf.line(M + 3, y0 + rowBlockH, M + CW - 3, y0 + rowBlockH);
          return rowBlockH;
        }

        const branchY = y0 + 2.4 * vs;
        setFill(MOBILE_HUD.accent);
        pdf.circle(cfg.lineX, y0 + 2.1, 0.55, 'F');
        setFill(MOBILE_PDF_DARK.divider);
        pdf.rect(cfg.lineX, y0, 0.12, rowBlockH, 'F');
        pdf.rect(cfg.lineX, branchY, cfg.lineWidth, 0.12, 'F');

        setPdfFont(descStrong ? 'bold' : 'normal');
        pdf.setFontSize(7.4 * fontScale);
        setColor(descStrong ? MOBILE_PDF_DARK.text : MOBILE_PDF_DARK.textMuted);
        pdf.text(formatCommercialQuantity(qtd, unidade), cfg.qtdColRight, nomeTop + 1.1, {
          align: 'right',
        });
        setPdfFont('normal');
        pdf.setFontSize(6.2 * fontScale);
        setColor(MOBILE_PDF_DARK.textMuted);
        pdf.text(normalizePdfText(unidade), cfg.qtdColRight, nomeTop + 4.3, { align: 'right' });

        setPdfFont(descStrong ? 'bold' : 'normal');
        pdf.setFontSize(7.8 * fontScale);
        setColor(descStrong ? MOBILE_PDF_DARK.text : MOBILE_PDF_DARK.textMuted);
        nomeLinhas.forEach((line, li) => {
          pdf.text(line, cfg.itemMl, nomeTop + li * nomeLineStep);
        });

        drawMobileTabulatedValues(dataRow, cfg, valoresY, fontScale, tier);

        setDraw(MOBILE_HUD.grid);
        pdf.setLineWidth(0.1);
        pdf.line(cfg.itemMl, y0 + rowBlockH, cfg.contentRight, y0 + rowBlockH);

        return rowBlockH;
      };

      const drawMobileGroupBand = (treeRow) => {
        const rowH = measureMarginCompactRow(treeRow, y, {
          isGroup: true,
          groupLabel: treeRow.label,
          showMetrics: treeRow.showMetrics !== false,
        }).rowBlockH;
        ensureSpace(rowH + 1);
        drawMarginCompactRow(treeRow, y, {
          isGroup: true,
          groupLabel: treeRow.label,
          showMetrics: treeRow.showMetrics !== false,
          tier: 'pai',
        });
        y += rowH + MOBILE_ROW_GAP;
      };

      const drawMobileProductRow = (dataRow, level = 1) => {
        const tier = level <= 1 ? 'solteiro' : 'filho';
        const rowH = measureMarginCompactRow(dataRow, y).rowBlockH;
        ensureSpace(rowH + 1);
        drawMarginCompactRow(dataRow, y, { tier });
        y += rowH + MOBILE_ROW_GAP;
      };

      drawMobileHeader();
      drawMobileKpis();
      drawMobileColumnHeaders();
      flatRows.forEach((treeRow) => {
        if (treeRow.type === 'group') {
          drawMobileGroupBand(treeRow);
        } else {
          drawMobileProductRow(treeRow.item, treeRow.level);
        }
      });

      ensureSpace(10);
      setPdfFont('normal');
      pdf.setFontSize(6);
      setColor(MOBILE_PDF_DARK.textMuted);
      pdf.text(
        normalizePdfText(`${productCount} produto(s) no relatório`),
        M,
        y + 4
      );

      const fileDate = format(new Date(), 'yyyy-MM-dd');
      pdf.save(`relatorio_margem_mobile_${fileDate}.pdf`);
      return;
    }

    const JsPDF = await loadJsPDF();
    const pdf = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfFontFamily = await registerJsPdfDin1451Fonts(pdf);
    const setPdfFont = (style = 'normal') => pdf.setFont(pdfFontFamily, style);
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    const footerY = pageHeight - 10;
    const lineHeight = 2.9 * BODY_LINE_HEIGHT_MULT;
    const rowMinHeightProduct = 4.6 * BODY_LINE_HEIGHT_MULT;
    const rowPadV = 1.2 * BODY_PAD_MULT;
    const textBaseline = 3.5 * BODY_PAD_MULT;
    const descPad = 2 * BODY_PAD_MULT;

    const C = PDF_EMBARQUES_C;

    const formatNumPdf = (val) =>
      (val ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const formatPctPdf = (val) => `${(val ?? 0).toFixed(1).replace('.', ',')}%`;

    const flatRows = displayRows.length ? displayRows : [];

    const { colWidths, colX, colRight } = buildPdfColumnLayout(contentWidth);
    const tableOriginX = margin;
    const colXAbs = {};
    const colRightAbs = {};
    Object.keys(colX).forEach((key) => {
      colXAbs[key] = tableOriginX + colX[key];
      colRightAbs[key] = tableOriginX + colRight[key];
    });

    let pageNumber = 1;
    let yPos = margin;
    let zebraIndex = 0;

    const setColor = (rgb) => pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
    const setFill = (rgb) => pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
    const setDraw = (rgb) => pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);

    const drawFooter = () => {
      const itemCount = productCount;
      setPdfFont('normal');
      pdf.setFontSize(7);
      setColor(C.muted);
      pdf.text(
        normalizePdfText(
          `Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} • ${itemCount} produto(s)`
        ),
        margin,
        footerY
      );
      pdf.text(normalizePdfText(`Página ${pageNumber}`), pageWidth - margin, footerY, {
        align: 'right',
      });
    };

    const drawReportHeader = () => {
      const headerH = 24;
      setFill(C.panel);
      pdf.roundedRect(margin, yPos, contentWidth, headerH, 4, 4, 'F');
      setFill(C.teal);
      pdf.roundedRect(margin + 5, yPos + 5.5, 2.4, 11, 1.2, 1.2, 'F');

      setPdfFont('normal');
      pdf.setFontSize(15);
      setColor(C.text);
      pdf.text(normalizePdfText('Relatório de Margem de Vendas'), margin + 11, yPos + 9.5);

      pdf.setFontSize(8.5);
      setColor(C.muted);
      pdf.text(
        normalizePdfText(
          `Período: ${format(dateRange.from, 'dd/MM/yyyy')} a ${format(dateRange.to, 'dd/MM/yyyy')}`
        ),
        margin + 11,
        yPos + 16
      );
      yPos += headerH + 4;
    };

    const drawSegmentAccent = () => {
      const segs = 4;
      const segGap = 1.2;
      const segW = (contentWidth - (segs - 1) * segGap) / segs;
      const barH = 1.5;
      for (let s = 0; s < segs; s++) {
        const sx = margin + s * (segW + segGap);
        setFill(s < 3 ? C.teal : [220, 225, 230]);
        pdf.roundedRect(sx, yPos, segW, barH, 0.75, 0.75, 'F');
      }
      yPos += barH + 4;
    };

    const drawSummaryKpis = () => {
      const kpis = [
        { label: 'Receita líquida', value: formatNumPdf(totals.receita_liquida), accent: false },
        { label: 'Custo total', value: formatNumPdf(totals.custo_total), accent: false },
        { label: 'Lucro', value: formatNumPdf(totals.lucro_total), accent: true },
        { label: 'Markup', value: formatPctPdf(totalMarkup), accent: true },
      ];
      const gap = 4;
      const boxW = (contentWidth - gap * (kpis.length - 1)) / kpis.length;
      const boxH = 20;

      kpis.forEach((kpi, i) => {
        const x = margin + i * (boxW + gap);
        setFill(C.kpiBg);
        pdf.roundedRect(x, yPos, boxW, boxH, 3, 3, 'F');

        setPdfFont('normal');
        pdf.setFontSize(7.5);
        setColor(C.muted);
        pdf.text(normalizePdfText(kpi.label), x + 5, yPos + 7);

        pdf.setFontSize(10);
        setColor(kpi.accent ? C.profit : C.dark);
        pdf.text(kpi.value, x + 5, yPos + 14.5);
      });

      yPos += boxH + 4;
      setPdfFont('normal');
      pdf.setFontSize(6.5);
      setColor(C.mutedLight);
      pdf.text(normalizePdfText('Valores monetários em reais (R$).'), margin, yPos);
      yPos += 6;
    };

    const PDF_STORM = [82, 96, 112];

    const drawTableHeader = () => {
      const headerH = 14;
      const headerFontSize = 7.5;
      setFill(PDF_STORM);
      pdf.roundedRect(margin, yPos, contentWidth, headerH, 2, 2, 'F');

      setPdfFont('normal');
      setColor(C.white);

      const headerTop = yPos;
      const headerOpts = { headerTop, headerH, fontSize: headerFontSize };

      drawPdfA4HeaderCell(pdf, 'QUANT', colXAbs.quant, colRightAbs.quant, headerTop, headerH, headerFontSize);
      drawPdfA4HeaderCell(pdf, 'UN', colXAbs.un, colRightAbs.un, headerTop, headerH, headerFontSize);
      drawPdfA4HeaderCell(
        pdf,
        'DESCRIÇÃO',
        colXAbs.desc,
        colRightAbs.desc,
        headerTop,
        headerH,
        headerFontSize,
        { alignLeft: true }
      );

      MARGIN_MOBILE_VALUE_ROWS.flat().forEach(({ label, key }) => {
        drawPdfA4HeaderCell(pdf, label, colXAbs[key], colRightAbs[key], headerTop, headerH, headerFontSize);
      });

      yPos += headerH + 1.2;
    };

    const ensureSpace = (neededHeight) => {
      if (yPos + neededHeight <= footerY - 4) return;
      drawFooter();
      pdf.addPage();
      pageNumber += 1;
      yPos = margin;
      drawTableHeader();
    };

    const drawDescColumn = (lines, descX, descMaxW, textY) => {
      lines.forEach((line, idx) => {
        const lineY = textY + idx * lineHeight;
        if (idx < lines.length - 1) {
          drawJustifiedPdfLine(pdf, line, descX, lineY, descMaxW);
        } else {
          pdf.text(line, descX, lineY);
        }
      });
    };

    const drawMetricsRow = (dataRow, textY, { isGroup = false } = {}) => {
      const quantCenter = (colXAbs.quant + colRightAbs.quant) / 2;
      const unCenter = (colXAbs.un + colRightAbs.un) / 2;

      setPdfFont('normal');
      pdf.setFontSize(7.5);
      setColor(C.text);
      pdf.text(
        formatCommercialQuantity(dataRow.quantidade_vendida || 0, dataRow.unidade_exibicao),
        quantCenter,
        textY,
        { align: 'center' },
      );
      const unLabel = isGroup
        ? formatMarginTreeUnidade(dataRow, { isGroup: true })
        : formatMarginTreeUnidade(dataRow, { isGroup: false });
      pdf.text(normalizePdfText(unLabel), unCenter, textY, { align: 'center' });

      const metricValues = {
        custoUnit: formatNumPdf(getRowCustoUnitCalc(dataRow)),
        precoVenda: formatNumPdf(getRowPrecoMedio(dataRow)),
        markup: formatPctPdf(getRowMarkup(dataRow)),
        custoTotal: formatNumPdf(dataRow.custo_total || 0),
        vendaTotal: formatNumPdf(dataRow.receita_liquida || 0),
        lucro: formatNumPdf(dataRow.lucro_total || 0),
      };

      MARGIN_METRIC_KEYS.forEach((key) => {
        const colCenter = (colXAbs[key] + colRightAbs[key]) / 2;
        if (key === 'markup' || key === 'lucro') setColor(MARGIN_ACCENT_RGB);
        else if (key === 'custoUnit' || key === 'custoTotal') setColor(C.muted);
        else setColor(C.text);
        pdf.text(metricValues[key], colCenter, textY, { align: 'center' });
      });
    };

    const drawTreeRow = (treeRow) => {
      const isGroup = treeRow.type === 'group';
      const showMetrics = !isGroup || treeRow.showMetrics !== false;
      const dataRow = isGroup ? treeRow : treeRow.item;
      const descPadLeft = 1;
      const descX = colXAbs.desc + descPadLeft;
      const descMaxW = Math.max(8, colWidths.desc - descPad - descPadLeft);
      const descText = isGroup
        ? normalizePdfText(`${String(treeRow.label || '').toUpperCase()} (${treeRow.count ?? 0})`)
        : normalizePdfText(dataRow?.nome || '?');
      const descLines = wrapDescLinesPdf(pdf, descText, descMaxW);
      const rowHeight = Math.max(rowMinHeightProduct, descLines.length * lineHeight + rowPadV);

      ensureSpace(rowHeight);

      const rowX = margin;
      const rowW = contentWidth;

      const isZebra = zebraIndex % 2 === 1;
      zebraIndex += 1;
      if (isZebra) {
        setFill(C.rowAlt);
        pdf.roundedRect(rowX, yPos, rowW, rowHeight, 1.5, 1.5, 'F');
      }
      setDraw(C.border);
      pdf.setLineWidth(0.1);
      pdf.line(margin, yPos + rowHeight, pageWidth - margin, yPos + rowHeight);

      const textY = yPos + textBaseline;
      setPdfFont('normal');
      pdf.setFontSize(7.5);
      setColor(C.text);
      drawDescColumn(descLines, descX, descMaxW, textY);
      if (showMetrics) {
        drawMetricsRow(dataRow, textY, { isGroup });
      }

      yPos += rowHeight;
    };

    drawReportHeader();
    drawSegmentAccent();
    drawSummaryKpis();
    drawTableHeader();
    flatRows.forEach(drawTreeRow);
    drawFooter();

    pdf.save('relatorio_margem.pdf');
    } catch (error) {
      console.error('Erro ao gerar PDF do relatório de margem', error);
      const devDetail = isP38Dev() && error?.message ? ` (${error.message})` : '';
      toast.error(`Não foi possível gerar o PDF. Tente novamente.${devDetail}`);
    }
  };

  const handleApplySearchFilter = useCallback(() => {
    setSearchTerm(searchDraft.trim());
  }, [searchDraft]);

  const handleClearFilters = () => {
    setSearchDraft('');
    setSearchTerm('');
    setTreeLevel(99);
    setDateRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
  };

  const periodLabel =
    dateRange?.from && dateRange?.to
      ? `${format(dateRange.from, 'dd/MM/yyyy')} a ${format(dateRange.to, 'dd/MM/yyyy')}`
      : null;

  const desktopPadTop = shouldVirtualizeRows ? desktopVirtual.paddingTop : 0;
  const desktopPadBottom = shouldVirtualizeRows ? desktopVirtual.paddingBottom : 0;
  const mobilePadTop = shouldVirtualizeRows ? mobileVirtual.paddingTop : 0;
  const mobilePadBottom = shouldVirtualizeRows ? mobileVirtual.paddingBottom : 0;
  const desktopRowOffset = shouldVirtualizeRows ? desktopVirtual.startIndex : 0;
  const mobileRowOffset = shouldVirtualizeRows ? mobileVirtual.startIndex : 0;

  const filtrosDesc = buildMarginFiltrosDesc({ dateRange, searchTerm, treeLevel, viewMode });

  return (
    <TooltipProvider delayDuration={200}>
    <div className="font-din-1451 h-full min-h-0 flex flex-col overflow-hidden bg-background md:overflow-x-hidden">
      <div className="max-w-full mx-auto min-w-0 flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Cabeçalho fixo — só título e ações */}
        <div className="flex-none bg-background border-b border-border z-20">
          <div className="w-full min-w-0 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Link to="/Relatorios">
                  <button className="p-1.5 md:p-2 hover:bg-muted dark:hover:bg-muted/80 rounded-lg transition flex-shrink-0">
                    <ArrowLeft className="w-4 md:w-5 h-4 md:h-5 text-foreground/90" />
                  </button>
                </Link>
                <div className="min-w-0">
                  <h1 className="text-lg md:text-xl font-semibold text-foreground truncate">
                    Relatório de Margem
                  </h1>
                  <div className={`hidden md:flex flex-wrap items-center gap-x-3 gap-y-0.5 ${MARGIN_BODY_TEXT} font-normal text-muted-foreground min-w-0`}>
                    <span className="truncate">{productCount} produto{productCount === 1 ? '' : 's'}</span>
                    <span className="truncate">{formatMoney(totals.receita_liquida)} receita</span>
                    <span className="truncate text-muted-foreground">{formatMoney(totals.custo_total)} custo</span>
                    <span className={`truncate ${MARGIN_ACCENT_VALUE}`}>{formatMoney(totals.lucro_total)} lucro</span>
                    <span className={`truncate ${MARGIN_ACCENT_VALUE}`}>{formatPercent(totalMarkup)} markup</span>
                    {periodLabel ? (
                      <span className="truncate text-muted-foreground">{periodLabel}</span>
                    ) : null}
                  </div>
                  <p className="desktop-layout:hidden text-xs text-muted-foreground truncate">
                    {productCount} produto{productCount === 1 ? '' : 's'}
                    {periodLabel ? ` · ${periodLabel}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setToolsCollapsed((collapsed) => !collapsed)}
                  className="h-9 w-9 rounded-xl hover:bg-muted dark:hover:bg-secondary/80 transition text-foreground/90 flex items-center justify-center"
                  title={toolsCollapsed ? 'Mostrar filtros e ferramentas' : 'Ocultar filtros e ferramentas'}
                  aria-expanded={!toolsCollapsed}
                >
                  {toolsCollapsed ? (
                    <PanelTopOpen className="w-4 h-4" />
                  ) : (
                    <PanelTopClose className="w-4 h-4" />
                  )}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="h-9 w-9 rounded-xl hover:bg-muted dark:hover:bg-secondary/80 transition text-foreground/90 flex items-center justify-center flex-shrink-0" title="Opções de impressão">
                      <Printer className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="dark:bg-secondary dark:border-border text-sm">
                    <DropdownMenuItem onClick={() => exportToPDF('a4')} className="dark:hover:bg-muted/80 dark:text-foreground cursor-pointer">
                      PDF (A4)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => exportToPDF('a4_enxuto')}
                      className="dark:hover:bg-muted/80 dark:text-foreground cursor-pointer"
                    >
                      PDF enxuto (A4)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => exportToPDF('expandida_mobile')}
                      className="dark:hover:bg-muted/80 dark:text-foreground cursor-pointer"
                    >
                      PDF mobile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportToCSV} className="dark:hover:bg-muted/80 dark:text-foreground cursor-pointer">
                      CSV
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>

        {/* Calendário acima do Drawer (portal no body; drawer usa z-[310]) */}
        {showCalendar &&
          createPortal(
            <>
              <button
                type="button"
                aria-label="Fechar calendário"
                className="fixed inset-0 z-[320] cursor-default bg-black/50"
                onClick={() => setShowCalendar(false)}
              />
              <div className="fixed inset-0 z-[330] flex items-end md:items-center justify-center pointer-events-none p-3 md:p-4">
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Selecionar período"
                  className="pointer-events-auto w-full max-w-[820px] rounded-[30px] bg-card dark:bg-card p-3 shadow-2xl"
                >
                  <CalendarPopup
                    dateRange={dateRange}
                    setDateRange={setDateRange}
                    onClose={() => setShowCalendar(false)}
                    isModal={true}
                  />
                </div>
              </div>
            </>,
            document.body
          )}

        {/* Área rolável — filtros sobem; cabeçalho da tabela fixa ao rolar (mobile) */}
        <div
          ref={mainScrollRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y pb-[var(--p38-scroll-pad-below-nav)]"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {!toolsCollapsed && (
            <div className="px-3 pt-2 pb-2 space-y-2 border-b border-border/50 bg-background">
              <div className="flex gap-2 min-w-0 items-center">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    autoComplete="off"
                    type="text"
                    data-pulse-sensor="relatorio-margem.busca"
                    placeholder="Produto, código, categoria ou tag (espaço ou ; para combinar termos)..."
                    value={searchDraft}
                    onChange={(event) => setSearchDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleApplySearchFilter();
                    }}
                    className="border-none bg-muted dark:bg-secondary h-10 text-sm pl-9 pr-3 text-foreground/90 shadow-none focus:outline-none focus:ring-0 w-full min-w-0 rounded-xl"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApplySearchFilter}
                  className="h-10 px-3 rounded-xl bg-background dark:bg-secondary text-foreground hover:bg-primary dark:hover:bg-muted transition text-xs font-semibold whitespace-nowrap flex-shrink-0"
                  title="Aplicar busca"
                >
                  Filtrar
                </button>
                <button
                  type="button"
                  className={`h-10 w-10 flex-shrink-0 rounded-xl relative flex items-center justify-center ${showFilterDrawer || activeFilterCount > 0 ? 'bg-muted dark:bg-muted' : 'bg-muted dark:bg-secondary'}`}
                  onClick={() => setShowFilterDrawer((open) => !open)}
                  title="Filtros"
                >
                  <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-muted text-foreground text-[10px] rounded-full flex items-center justify-center font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                {activeFilterCount > 0 && (
                  <button
                    onClick={handleClearFilters}
                    className="h-10 w-10 flex-shrink-0 rounded-xl text-muted-foreground bg-muted dark:bg-secondary hover:bg-muted dark:hover:bg-muted/80 transition flex items-center justify-center"
                    title="Limpar filtros"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {showFilterDrawer && (
                <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                  {viewMode === 'dinamica' && (
                    <div className="flex items-center gap-2 bg-muted dark:bg-secondary rounded-xl md:rounded-lg px-3 h-10 md:h-9 md:col-span-2 overflow-x-auto">
                      <span className="text-xs text-muted-foreground flex-shrink-0">Nível da TreeGrid</span>
                      <LevelControl level={treeLevel} onChange={setTreeLevel} />
                    </div>
                  )}
                  <button
                    onClick={() => {
                      const today = new Date();
                      setDateRange({ from: today, to: today });
                    }}
                    className="px-3 h-10 md:h-9 rounded-xl md:rounded-lg text-sm md:text-xs font-medium bg-muted dark:bg-secondary text-foreground/90 hover:bg-muted dark:hover:bg-muted/80 transition"
                  >
                    Hoje
                  </button>
                  <button
                    onClick={() => {
                      const today = new Date();
                      setDateRange({ from: subDays(today, 30), to: today });
                    }}
                    className="px-3 h-10 md:h-9 rounded-xl md:rounded-lg text-sm md:text-xs font-medium bg-muted dark:bg-secondary text-foreground/90 hover:bg-muted dark:hover:bg-muted/80 transition"
                  >
                    30 dias
                  </button>
                  <button
                    onClick={() => {
                      const today = new Date();
                      setDateRange({ from: startOfMonth(today), to: endOfMonth(today) });
                    }}
                    className="px-3 h-10 md:h-9 rounded-xl md:rounded-lg text-sm md:text-xs font-medium bg-muted dark:bg-secondary text-foreground/90 hover:bg-muted dark:hover:bg-muted/80 transition"
                  >
                    Mês atual
                  </button>
                  <button
                    onClick={() => setShowCalendar(true)}
                    className="px-3 h-10 md:h-9 rounded-xl md:rounded-lg text-sm md:text-xs font-medium bg-muted dark:bg-secondary text-foreground/90 hover:bg-muted dark:hover:bg-muted/80 transition"
                  >
                    {dateRange.from ? `${format(dateRange.from, 'dd/MM')} - ${dateRange.to ? format(dateRange.to, 'dd/MM') : '...'}` : 'Selecionar período'}
                  </button>
                </div>
              )}

              <div className="min-w-0 max-w-full">
                <div className="flex flex-wrap items-center gap-2 min-w-0 [&_button]:!min-h-9 [&_button]:!min-w-9 md:[&_button]:!min-h-6 md:[&_button]:!min-w-6">
                  <div className="flex items-center bg-muted dark:bg-secondary rounded-lg p-0.5 gap-0.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setViewMode('dinamica')}
                      className={`text-[10px] px-2 py-1 rounded transition-colors ${
                        viewMode === 'dinamica'
                          ? 'bg-white dark:bg-muted text-foreground/90 shadow-sm font-medium'
                          : 'text-muted-foreground'
                      }`}
                    >
                      Tree Grid
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('plana')}
                      className={`text-[10px] px-2 py-1 rounded transition-colors ${
                        viewMode === 'plana'
                          ? 'bg-white dark:bg-muted text-foreground/90 shadow-sm font-medium'
                          : 'text-muted-foreground'
                      }`}
                    >
                      Plana
                    </button>
                  </div>
                  {viewMode === 'dinamica' && (
                    <>
                      <div className="hidden md:contents">
                        <LevelControl level={treeLevel} onChange={setTreeLevel} />
                        <div className="w-px h-8 bg-muted dark:bg-muted mx-0.5 flex-shrink-0" />
                      </div>
                    </>
                  )}
                  <div className="relative">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex items-center justify-center w-10 h-10 rounded-xl border border-border/40/80 dark:border-border bg-card dark:bg-secondary hover:bg-muted/40 dark:hover:bg-muted/80 shadow-sm transition" title="Critério de ordenação">
                          {sortField === 'nome' && <Type className="w-4 h-4 text-foreground/90" />}
                          {sortField === 'lucro_total' && <DollarSign className="w-4 h-4 text-foreground/90" />}
                          {sortField === 'receita_liquida' && <TrendingUp className="w-4 h-4 text-foreground/90" />}
                          {sortField === 'markup_percentual' && <Percent className="w-4 h-4 text-foreground/90" />}
                          {sortField === 'valor_unitario_medio' && <DollarSign className="w-4 h-4 text-foreground/90" />}
                          {sortField === 'quantidade_vendida' && <Package className="w-4 h-4 text-foreground/90" />}
                          {sortField === 'custo_total' && <TrendingUp className="w-4 h-4 text-foreground/90 rotate-180" />}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="dark:bg-secondary dark:border-border">
                        <DropdownMenuItem onClick={() => { setSortField('nome'); setSortOrder('asc'); }} className="dark:hover:bg-muted/80 dark:text-foreground cursor-pointer flex items-center gap-2">
                          <Type className="w-4 h-4" />
                          <span>Descrição</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSortField('quantidade_vendida'); setSortOrder('desc'); }} className="dark:hover:bg-muted/80 dark:text-foreground cursor-pointer flex items-center gap-2">
                          <Package className="w-4 h-4" />
                          <span>Quant</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSortField('valor_unitario_medio'); setSortOrder('desc'); }} className="dark:hover:bg-muted/80 dark:text-foreground cursor-pointer flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          <span>Preço un médio</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSortField('receita_liquida'); setSortOrder('desc'); }} className="dark:hover:bg-muted/80 dark:text-foreground cursor-pointer flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          <span>Receita</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSortField('custo_total'); setSortOrder('desc'); }} className="dark:hover:bg-muted/80 dark:text-foreground cursor-pointer flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 rotate-180" />
                          <span>Custo</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSortField('lucro_total'); setSortOrder('desc'); }} className="dark:hover:bg-muted/80 dark:text-foreground cursor-pointer flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          <span>Lucro</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSortField('markup_percentual'); setSortOrder('desc'); }} className="dark:hover:bg-muted/80 dark:text-foreground cursor-pointer flex items-center gap-2">
                          <Percent className="w-4 h-4" />
                          <span>Markup</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="flex items-center justify-center w-11 h-11 md:w-10 md:h-10 flex-shrink-0 rounded-xl border border-border/40/80 dark:border-border bg-card dark:bg-secondary hover:bg-muted/40 dark:hover:bg-muted/80 shadow-sm transition"
                    title="Alternar direção"
                  >
                    <ChevronDown className={`w-4 h-4 text-foreground/90 transition ${
                      sortOrder === 'desc' ? 'rotate-180' : ''
                    }`} />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="min-w-0 max-w-full p-3 desktop-layout:px-4 desktop-layout:pb-4" id="relatorio-table">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-2xl border border-dashed border-border/40 dark:border-border bg-card/60 dark:bg-background/60">
              <Loader2 className="w-9 h-9 animate-spin text-muted-foreground mb-4" />
              <p className="text-sm font-medium text-foreground/90">Carregando relatório...</p>
              <p className="text-xs text-muted-foreground mt-1">Aguarde enquanto calculamos as margens</p>
            </div>
          ) : processedData.length > 0 ? (
            <>

              {/* Desktop: painel resumo + KPIs (rola com a página) */}
              {!toolsCollapsed && (
                <div className="hidden desktop-layout:block mb-3 space-y-3">
                  <MargemMobileReportHeader filtrosDesc={filtrosDesc} />
                  <MargemMobileKpis totals={totals} totalMarkup={totalMarkup} />
                  <MargemCustoDetalheTotais totals={totals} />
                </div>
              )}
              {/* Desktop Table View */}
              <div className="hidden desktop-layout:block min-w-0 rounded-xl border border-border bg-background shadow-sm overflow-hidden">
                <table className={`w-full table-fixed ${MARGIN_BODY_TEXT}`}>
                  <colgroup>
                    <col className="w-[72px]" />
                    <col className="w-[52px]" />
                    <col />
                    {MARGIN_METRIC_KEYS.map((key) => (
                      <col key={key} className="w-[76px]" />
                    ))}
                  </colgroup>
                  <thead className={`sticky top-0 z-30 backdrop-blur-sm ${MARGIN_TABLE_PANEL}`}>
                    <tr className={`border-b ${MARGIN_TABLE_BORDER}`}>
                      <th
                        onClick={() => {
                          if (sortField === 'quantidade_vendida') {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('quantidade_vendida');
                            setSortOrder('desc');
                          }
                        }}
                        className={`text-center py-2 px-2 ${MARGIN_TABLE_HEAD} cursor-pointer hover:text-foreground dark:hover:text-white`}
                      >
                        QUANT {sortField === 'quantidade_vendida' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className={`text-center py-2 px-2 ${MARGIN_TABLE_HEAD}`}>UN</th>
                      <th
                        onClick={() => {
                          if (sortField === 'nome') {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('nome');
                            setSortOrder('asc');
                          }
                        }}
                        className={`text-left py-2 px-2 ${MARGIN_TABLE_HEAD} cursor-pointer hover:text-foreground dark:hover:text-white`}
                      >
                        DESCRIÇÃO {sortField === 'nome' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      {MARGIN_MOBILE_VALUE_ROWS.flat().map(({ key, label }) => {
                        const sortKey = MARGIN_METRIC_SORT_FIELD[key];
                        return (
                          <th
                            key={key}
                            onClick={() => handleMetricSort(key)}
                            className={`text-right py-2 px-1 ${MARGIN_TABLE_HEAD} cursor-pointer hover:text-foreground dark:hover:text-white`}
                          >
                            {label}{' '}
                            {sortField === sortKey && (sortOrder === 'asc' ? '↑' : '↓')}
                          </th>
                        );
                      })}
                      </tr>
                  </thead>
                  <tbody>
                    {desktopPadTop > 0 && (
                      <tr aria-hidden="true">
                        <td
                          colSpan={MARGIN_TABLE_COL_COUNT}
                          style={{ height: desktopPadTop, padding: 0, border: 0 }}
                        />
                      </tr>
                    )}
                    {visibleDesktopRows.map((treeRow, sliceIdx) =>
                      renderMargemDesktopRow(treeRow, desktopRowOffset + sliceIdx)
                    )}
                    {desktopPadBottom > 0 && (
                      <tr aria-hidden="true">
                        <td
                          colSpan={MARGIN_TABLE_COL_COUNT}
                          style={{ height: desktopPadBottom, padding: 0, border: 0 }}
                        />
                      </tr>
                    )}
                  </tbody>
                          </table>
              </div>

              {/* Mobile: diagramação do PDF mobile com cabeçalho de colunas fixo ao rolar */}
              <div className="desktop-layout:hidden min-w-0 max-w-full">
                {!toolsCollapsed && (
                  <>
                    <MargemMobileReportHeader filtrosDesc={filtrosDesc} />
                    <MargemMobileKpis totals={totals} totalMarkup={totalMarkup} />
                    <MargemCustoDetalheTotais totals={totals} />
                  </>
                )}
                <div ref={mobileHeaderSentinelRef} className="h-px w-full shrink-0" aria-hidden />
                <MargemMobileColumnHeader invisible={mobileHeaderPinned} />
                {mobileHeaderPinned ? (
                  <MargemMobileColumnHeader pinStyle={mobilePinStyle} className="shadow-sm" />
                ) : null}
                {mobilePadTop > 0 && (
                  <div aria-hidden="true" style={{ height: mobilePadTop, flexShrink: 0 }} />
                )}
                {visibleMobileRows.map((treeRow) =>
                  treeRow.type === 'group' ? (
                    <MargemLinhaMobile
                      key={treeRow.key}
                      variant="grupo"
                      row={treeRow}
                      level={treeRow.level}
                      isExpanded={expandedKeys.has(treeRow.key)}
                      isLeaf={treeRow.isLeafGroup}
                      onToggle={() => handleToggleGroup(treeRow.key)}
                    />
                  ) : (
                    treeRow.item ? (
                    <MargemLinhaMobile
                      key={treeRow.key}
                      row={treeRow.item}
                      level={treeRow.level}
                    />
                    ) : null
                  )
                )}
                {mobilePadBottom > 0 && (
                  <div aria-hidden="true" style={{ height: mobilePadBottom, flexShrink: 0 }} />
                )}
              </div>

              <div className="mt-3 flex justify-center flex-shrink-0">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted dark:bg-secondary text-muted-foreground">
                  <Package className="w-3.5 h-3.5" />
                  {productCount} produto{productCount === 1 ? '' : 's'}
                </span>
              </div>
            </>
          ) : (
            <div className="py-16 px-4 text-center rounded-2xl border border-dashed border-border/40 dark:border-border bg-card/60 dark:bg-background/60">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 text-muted-foreground dark:text-muted-foreground" />
              <p className="text-base font-medium text-foreground/90">Nenhum dado no período</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Ajuste o período ou os filtros para ver produtos com vendas e margem.
              </p>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
