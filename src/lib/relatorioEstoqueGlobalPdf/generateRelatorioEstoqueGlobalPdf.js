import { jsPDF } from 'jspdf';
import { resolveProdutoCustoUnitarioBase } from '@/lib/catalogStockTotals';
import { formatEstoqueApresentacao } from '@/lib/productUnits';
import { registerJsPdfBarlowFonts, normalizePdfText } from '@/lib/jspdfNotoFont';
import { resolveProdutoAbcdClasse } from '@/lib/catalogAbcdEnrichment';
import {
  filtrarCardsEmbarqueEmTransito,
  materializePedidosCompraView,
  valorPendenteCardEmbarque,
} from '@/lib/comprasEmbarqueCards';
import { buildConsultaItensEmbarque } from '@/lib/consultaComprasEmbarques';

export const PDF_BUILD = 'estoque-reuniao-v10';

const BRL_KPI = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const BRL_TAB = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const PRECO_MED_TAB = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function fmtTabValor(valor) {
  return BRL_TAB.format(Number(valor) || 0);
}

function fmtPrecoMedio(valor) {
  return PRECO_MED_TAB.format(Number(valor) || 0);
}

const BRL_UNIT = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const QTD = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const QTD_CELL = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COLORS = {
  ink: [24, 24, 27],
  muted: [113, 113, 122],
  line: [220, 220, 224],
  accent: [39, 39, 42],
};

/** Alinhado a `generateRelatorioSugestaoCompraPdf` (ENXUTO). */
const FONT = {
  title: 15,
  subtitle: 10,
  kpi: 14.5,
  kpiLabel: 8.2,
  section: 11.5,
  tableHead: 9.8,
  tableRow: 10,
  tableRowSmall: 8.8,
  footer: 8.5,
};

const GRID = {
  lineWidth: 0.1,
  rowH: 6.1,
  headerH: 7.4,
  padX: 2,
  padY: 2.4,
  cellPadTop: 4.1,
  headerPadTop: 5.2,
  qtySplitRatio: 0.62,
  qtyLineStep: 3.7,
};

const TABLE_LIMITS = {
  /** Teto de segurança — o ajuste real é dinâmico pelo espaço na página. */
  maxRows: 40,
};

const LAYOUT = {
  blockGapBefore: 6,
  sectionTitleH: 5.2,
  titleToTable: 4.8,
  sectionGapAfter: 9,
  sectionGapBetween: 7,
};

const FOOTER_RESERVE = 15;

const ABCD_ORDER = ['A', 'B', 'C', 'D', 'E'];
const CERAMICA_H1 = new Set(['PISO', 'CERAMICA', 'REVESTIMENTO']);

function normH1Key(value) {
  return String(value || '').trim().toUpperCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function tituloFamiliaH1(value) {
  const text = String(value || '').trim();
  return text || 'Sem categoria';
}

function familiaH1Relatorio(value) {
  if (CERAMICA_H1.has(normH1Key(value))) return 'Cerâmica';
  return tituloFamiliaH1(value);
}

function isArgamassaFamilia(familia) {
  const norm = normH1Key(familia);
  return norm === 'ARGAMASSA' || norm.startsWith('ARGAMASSA ');
}

function isCeramicaFamilia(familia) {
  return normH1Key(familia) === 'CERAMICA';
}

function letraFamiliaRelatorio(familia, abcdPorH1) {
  if (isArgamassaFamilia(familia) || isCeramicaFamilia(familia)) return 'A';
  return abcdPorH1.get(familia) || 'E';
}

function comparePorClasseDepoisAlfabetico(a, b) {
  const letraA = a.letra || 'E';
  const letraB = b.letra || 'E';
  const idxA = ABCD_ORDER.indexOf(letraA);
  const idxB = ABCD_ORDER.indexOf(letraB);
  const orderA = idxA >= 0 ? idxA : ABCD_ORDER.length;
  const orderB = idxB >= 0 ? idxB : ABCD_ORDER.length;
  if (orderA !== orderB) return orderA - orderB;
  const labelA = String(a.label || a.familia || '').trim();
  const labelB = String(b.label || b.familia || '').trim();
  return labelA.localeCompare(labelB, 'pt-BR', { sensitivity: 'base' });
}

function normalizarFornecedorRelatorio(nome) {
  const text = String(nome || '').trim();
  if (!text) return '—';
  const lower = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (lower.includes('tintao') || lower.includes('tintão')) return 'Tintão';
  if (lower.includes('fortlev')) return 'Fortlev';
  return text;
}

function buildProdutosLookup(produtos) {
  const lookup = {};
  for (const produto of produtos) {
    if (!produto?.id) continue;
    lookup[produto.id] = produto;
    lookup[String(produto.id)] = produto;
  }
  return lookup;
}

function buildAbcdDominantePorH1(produtos, resolveProdutoAbcdClasse, valorFn) {
  const grupos = new Map();
  for (const produto of produtos) {
    const h1 = familiaH1Relatorio(produto.campo_hierarquico_1);
    if (!grupos.has(h1)) grupos.set(h1, []);
    grupos.get(h1).push(produto);
  }

  const abcdPorH1 = new Map();
  for (const [h1, lista] of grupos) {
    const pesoPorLetra = {};
    for (const produto of lista) {
      const letra = resolveProdutoAbcdClasse(produto) || 'E';
      const valor = valorFn(produto);
      if (valor <= 0) continue;
      pesoPorLetra[letra] = (pesoPorLetra[letra] || 0) + valor;
    }
    const dominante = Object.entries(pesoPorLetra).sort((a, b) => b[1] - a[1])[0]?.[0] || 'E';
    abcdPorH1.set(h1, letraFamiliaRelatorio(h1, new Map([[h1, dominante]])));
  }
  return abcdPorH1;
}

function aggregateValorPorAbcdH1(produtos, abcdPorH1, valorFn) {
  const acc = Object.fromEntries(ABCD_ORDER.map((letter) => [letter, 0]));
  for (const produto of produtos) {
    const valor = valorFn(produto);
    if (valor <= 0) continue;
    const h1 = familiaH1Relatorio(produto.campo_hierarquico_1);
    const letra = letraFamiliaRelatorio(h1, abcdPorH1);
    if (acc[letra] !== undefined) acc[letra] += valor;
  }
  return acc;
}

function rowsTabelaAbcd(valorPorLetra) {
  return ABCD_ORDER
    .map((letra) => ({
      letra,
      valor: valorPorLetra[letra] || 0,
    }))
    .filter((row) => row.valor > 0);
}

function labelOutros(count) {
  const n = Number(count) || 0;
  if (n <= 0) return 'Outros';
  return `Outros (${QTD.format(n)} itens)`;
}

function sumValorRows(rows, key = 'valor') {
  return (rows || []).reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
}

function consolidateTopRows(rows, maxRows, { tipo, labelKey, valorKey = 'valor', mapOutros }) {
  const list = Array.isArray(rows) ? rows : [];
  const cap = Math.min(maxRows, TABLE_LIMITS.maxRows);
  if (list.length <= cap) return list;
  const headCount = Math.max(1, cap - 1);
  const head = list.slice(0, headCount);
  const tail = list.slice(headCount);
  const outros = mapOutros
    ? mapOutros(tail)
    : {
      [labelKey]: labelOutros(tail.length),
      [valorKey]: sumValorRows(tail, valorKey),
    };
  return [...head, outros];
}

function fitTableRows(rawItems, toDisplayRow, columns, maxHeight, consolidateOptions = null) {
  const items = (rawItems || []).slice(0, TABLE_LIMITS.maxRows);
  if (!items.length) return [];

  const displayAll = items.map(toDisplayRow);
  if (estimateGridTableHeight(displayAll, columns) <= maxHeight) return displayAll;

  if (!consolidateOptions) {
    for (let count = items.length - 1; count >= 1; count -= 1) {
      const partial = items.slice(0, count).map(toDisplayRow);
      if (estimateGridTableHeight(partial, columns) <= maxHeight) return partial;
    }
    return items.slice(0, 1).map(toDisplayRow);
  }

  for (let max = items.length; max >= 2; max -= 1) {
    const consolidated = consolidateTopRows(items, max, consolidateOptions);
    const display = consolidated.map(toDisplayRow);
    if (estimateGridTableHeight(display, columns) <= maxHeight) return display;
  }

  return consolidateTopRows(items, 1, consolidateOptions).map(toDisplayRow);
}

function sectionTitleEndY(y) {
  return y + LAYOUT.blockGapBefore + LAYOUT.sectionTitleH + LAYOUT.titleToTable;
}

function availableTableHeight(pageH, tableStartY) {
  return pageH - FOOTER_RESERVE - tableStartY - LAYOUT.sectionGapAfter;
}

function formatEta(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('pt-BR', { timeZone: 'America/Manaus' });
}

function embarqueEmTransito(embarque = {}) {
  const statusReceb = String(embarque.status_recebimento || '').trim().toLowerCase();
  const statusEmb = String(embarque.status || '').trim().toLowerCase();
  if (statusReceb.includes('recebido ok') || statusReceb.includes('diverg') || statusEmb.includes('conclu')) {
    return false;
  }
  return true;
}

function codigoEmbarque(embarque = {}, pedido = null) {
  const pedidoNumero = embarque.pedido_compra_numero || pedido?.numero || '';
  const embarqueNumero = embarque.numero || '';
  if (pedidoNumero && embarqueNumero) return `${pedidoNumero}-${embarqueNumero}`;
  return pedidoNumero || embarqueNumero || '—';
}

function countVolumesEmbarque(embarque = {}) {
  const detalhados = embarque.volumes_detalhados || embarque.dados?.volumes_detalhados;
  if (Array.isArray(detalhados) && detalhados.length) {
    const total = detalhados.reduce((sum, item) => sum + (Number(item?.quantidade) || 0), 0);
    if (total > 0) return total;
  }
  const linhas = embarque._linhas || [];
  return linhas.length > 0 ? linhas.length : 1;
}

function buildResumoTransitoData(
  produtos,
  compraContext,
  {
    resolveProdutoAbcdClasse,
  },
) {
  const { pedidosAbertos, embarquesHydrated } = compraContext;

  const produtosMap = buildProdutosLookup(produtos);
  const produtoMap = new Map(produtos.map((produto) => [String(produto.id), produto]));
  const { cardsDeEmbarque } = materializePedidosCompraView(pedidosAbertos, embarquesHydrated, produtosMap);
  const cardsEmTransito = filtrarCardsEmbarqueEmTransito(cardsDeEmbarque)
    .filter((card) => valorPendenteCardEmbarque(card, produtosMap) > 0);

  const valorPorProduto = {};
  const familiaTransitoAgg = new Map();

  for (const card of cardsEmTransito) {
    const itens = buildConsultaItensEmbarque(card, produtosMap, { modo: 'pendente' });
    for (const item of itens) {
      const produtoId = String(item.produto_id || '');
      const produto = produtoMap.get(produtoId);
      const valor = Number(item.valor_total_item) || Number(item.total) || 0;
      const qtd = Number(item.quantidade) || 0;
      const unidade = String(item.unidade_medida || 'UN').toUpperCase();
      if (valor <= 0) continue;

      valorPorProduto[produtoId] = (valorPorProduto[produtoId] || 0) + valor;

      const familia = familiaH1Relatorio(produto?.campo_hierarquico_1);
      if (!familiaTransitoAgg.has(familia)) {
        familiaTransitoAgg.set(familia, { familia, valor: 0, units: new Map() });
      }
      const agg = familiaTransitoAgg.get(familia);
      agg.valor += valor;
      if (qtd > 0) agg.units.set(unidade, (agg.units.get(unidade) || 0) + qtd);
    }
  }

  const valorTransitoProduto = (produto) => valorPorProduto[String(produto.id)] || 0;
  const produtosEmTransito = produtos.filter((produto) => valorTransitoProduto(produto) > 0);
  const totalTransito = cardsEmTransito.reduce(
    (sum, card) => sum + valorPendenteCardEmbarque(card, produtosMap),
    0,
  );

  const abcdPorH1 = buildAbcdDominantePorH1(produtosEmTransito, resolveProdutoAbcdClasse, valorTransitoProduto);
  const valorPorAbcd = aggregateValorPorAbcdH1(produtosEmTransito, abcdPorH1, valorTransitoProduto);

  const embarquesDetalhe = cardsEmTransito.map((card) => {
    const embarque = card._embarque || {};
    const eta = formatEta(embarque.eta || card.data_prevista_entrega);
    const transportadora = String(embarque.transportadora_nome || '').trim() || 'Sem transportadora';
    return {
      eta,
      transportadora,
      volumes: countVolumesEmbarque(embarque),
      valor: valorPendenteCardEmbarque(card, produtosMap),
      sortEta: eta === '—' ? '9999' : eta,
    };
  });

  const embarquesEtaTransportadoraAgg = new Map();
  for (const row of embarquesDetalhe) {
    const key = `${row.sortEta}|${row.transportadora}`;
    if (!embarquesEtaTransportadoraAgg.has(key)) {
      embarquesEtaTransportadoraAgg.set(key, {
        eta: row.eta,
        transportadora: row.transportadora,
        volumes: 0,
        valor: 0,
        sortEta: row.sortEta,
      });
    }
    const agg = embarquesEtaTransportadoraAgg.get(key);
    agg.volumes += row.volumes;
    agg.valor += row.valor;
  }

  const embarquesPorEtaTransportadora = [...embarquesEtaTransportadoraAgg.values()]
    .sort((a, b) => a.sortEta.localeCompare(b.sortEta) || b.valor - a.valor);

  const volumesTotal = embarquesDetalhe.reduce((sum, row) => sum + row.volumes, 0);

  const fornecedorAgg = new Map();
  for (const card of cardsEmTransito) {
    const valor = valorPendenteCardEmbarque(card, produtosMap);
    if (valor <= 0) continue;
    const key = normalizarFornecedorRelatorio(card.fornecedor_nome || card._display_fornecedor);
    if (!fornecedorAgg.has(key)) {
      fornecedorAgg.set(key, { fornecedor: key, embarques: 0, volumes: 0, valor: 0 });
    }
    const agg = fornecedorAgg.get(key);
    agg.embarques += 1;
    agg.valor += valor;
    agg.volumes += countVolumesEmbarque(card._embarque);
  }

  const porFornecedor = [...fornecedorAgg.values()]
    .sort((a, b) => b.valor - a.valor)
    .map((row) => ({
      fornecedor: row.fornecedor,
      quantidadePartes: [{ numero: QTD_CELL.format(row.embarques), unidade: 'EMB' }],
      volumes: row.volumes,
      valor: row.valor,
      custoMedioTexto: row.embarques > 0 ? BRL_UNIT.format(row.valor / row.embarques) : '—',
    }));

  const familiaAgg = new Map();
  for (const produto of produtosEmTransito) {
    const valor = valorTransitoProduto(produto);
    if (valor <= 0) continue;
    const familia = familiaH1Relatorio(produto.campo_hierarquico_1);
    if (!familiaAgg.has(familia)) {
      familiaAgg.set(familia, { familia, valor: 0, skus: 0, letra: letraFamiliaRelatorio(familia, abcdPorH1) });
    }
    const agg = familiaAgg.get(familia);
    agg.valor += valor;
    agg.skus += 1;
  }

  const porFamiliaH1 = [...familiaAgg.values()]
    .sort(comparePorClasseDepoisAlfabetico)
    .map((row) => ({
      familia: row.familia,
      letra: row.letra,
      skus: row.skus,
      valor: row.valor,
    }));

  const porAbcd = rowsTabelaAbcd(valorPorAbcd).map((row) => ({
    letra: row.letra,
    valor: row.valor,
    custoMedioTexto: '—',
  }));

  const porFamiliaMaiores = [...familiaTransitoAgg.values()]
    .map((agg) => {
      const unidades = [...agg.units.entries()]
        .map(([u, q]) => ({ u, q: Math.round(q * 100) / 100 }))
        .sort((a, b) => b.q - a.q);
      const principal = unidades[0] || { u: 'UN', q: 0 };
      const quantidadePartes = unidades.length
        ? unidades.map(({ u, q }) => ({ numero: QTD_CELL.format(q), unidade: u }))
        : [{ numero: '—', unidade: '' }];
      const precoMedio = principal.q > 0 ? agg.valor / principal.q : 0;
      return {
        familia: agg.familia,
        quantidadePartes,
        precoMedio,
        valor: agg.valor,
      };
    })
    .filter((row) => row.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  const pedidosEmTransito = new Set(cardsEmTransito.map((card) => String(card.id)));

  return {
    totalTransito,
    pedidosAbertos: pedidosEmTransito.size,
    embarquesTransito: cardsEmTransito.length,
    volumesTotal,
    embarquesPorEtaTransportadora,
    porFornecedor,
    porFamiliaH1,
    porAbcd,
    porFamiliaMaiores,
  };
}

function buildResumoData(produtos, { resolveProdutoCustoUnitarioBase, formatEstoqueApresentacao, resolveProdutoAbcdClasse }) {
  const qtd = (p) => {
    const ap = formatEstoqueApresentacao(p);
    return ap ? Number(ap.quantidade) || 0 : Math.max(0, Number(p.estoque_atual) || 0);
  };
  const un = (p) => {
    const ap = formatEstoqueApresentacao(p);
    return ap?.sigla || String(p.unidade_principal || 'UN').toUpperCase();
  };
  const valorFisico = (p) => Math.max(0, Number(p.estoque_atual) || 0) * resolveProdutoCustoUnitarioBase(p);

  let total = 0;
  let skusCom = 0;
  for (const p of produtos) {
    const v = valorFisico(p);
    if (v > 0) {
      total += v;
      skusCom += 1;
    }
  }

  const abcdPorH1 = buildAbcdDominantePorH1(produtos, resolveProdutoAbcdClasse, valorFisico);
  const valorPorAbcd = aggregateValorPorAbcdH1(produtos, abcdPorH1, valorFisico);
  const porAbcd = rowsTabelaAbcd(valorPorAbcd);

  const familiaAgg = new Map();
  for (const produto of produtos) {
    const valor = valorFisico(produto);
    if (valor <= 0 || (Number(produto.estoque_atual) || 0) <= 0) continue;
    const familia = familiaH1Relatorio(produto.campo_hierarquico_1);
    if (!familiaAgg.has(familia)) {
      familiaAgg.set(familia, { label: familia, valor: 0, skus: 0, units: new Map() });
    }
    const agg = familiaAgg.get(familia);
    agg.valor += valor;
    agg.skus += 1;
    const unidade = un(produto);
    agg.units.set(unidade, (agg.units.get(unidade) || 0) + qtd(produto));
  }

  const grupos = [...familiaAgg.values()]
    .map((agg) => {
      const unidades = [...agg.units.entries()]
        .map(([u, q]) => ({ u, q: Math.round(q * 100) / 100 }))
        .sort((a, b) => b.q - a.q);
      const principal = unidades[0] || { u: 'UN', q: 0 };
      const custoMedio = principal.q > 0 ? agg.valor / principal.q : null;
      const quantidadePartes = unidades.length
        ? unidades.map(({ u, q }) => ({ numero: QTD_CELL.format(q), unidade: u }))
        : [{ numero: '—', unidade: '' }];
      return {
        label: agg.label,
        valor: agg.valor,
        skus: agg.skus,
        unidades,
        quantidadePartes,
        quantidadeTexto: unidades.length
          ? unidades.map(({ u, q }) => `${QTD.format(q)} ${u}`).join(' + ')
          : '—',
        custoMedio,
        custoMedioTexto: custoMedio != null ? BRL_UNIT.format(custoMedio) : '—',
        letra: letraFamiliaRelatorio(agg.label, abcdPorH1),
      };
    })
    .sort(comparePorClasseDepoisAlfabetico);

  return {
    geradoEm: new Date().toLocaleString('pt-BR', { timeZone: 'America/Manaus' }),
    total,
    skusCom,
    grupos,
    porAbcd,
  };
}

function setTextColor(doc, c) {
  doc.setTextColor(...c);
}

function drawGridLines(doc, x, y, width, rowHeights, colWidths) {
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(GRID.lineWidth);

  const totalH = rowHeights.reduce((s, h) => s + h, 0);
  let yy = y;
  for (let i = 0; i <= rowHeights.length; i += 1) {
    doc.line(x, yy, x + width, yy);
    if (i < rowHeights.length) yy += rowHeights[i];
  }

  let xx = x;
  for (let i = 0; i <= colWidths.length; i += 1) {
    doc.line(xx, y, xx, y + totalH);
    if (i < colWidths.length) xx += colWidths[i];
  }
}

function getQuantityPartes(row) {
  if (Array.isArray(row?.quantidadePartes) && row.quantidadePartes.length) {
    return row.quantidadePartes;
  }
  return [{ numero: '—', unidade: '' }];
}

function measureQuantityRowHeight(partes) {
  const lines = Math.max(1, partes.length);
  return Math.max(GRID.rowH, GRID.cellPadTop + lines * GRID.qtyLineStep + 1.2);
}

function measureQtyNumberWidth(doc, partes) {
  let max = 0;
  for (const parte of partes) {
    max = Math.max(max, doc.getTextWidth(String(parte.numero ?? '—')));
  }
  return max;
}

function measureTableQtyNumberWidth(doc, rows, fontFamily, rowStyle) {
  doc.setFont(fontFamily, rowStyle);
  doc.setFontSize(FONT.tableRow);
  let max = 0;
  for (const row of rows || []) {
    max = Math.max(max, measureQtyNumberWidth(doc, getQuantityPartes(row)));
  }
  return max;
}

function columnOffsetX(x, colWidths, index) {
  let offset = x;
  for (let i = 0; i < index; i += 1) offset += colWidths[i];
  return offset;
}

function drawGridTable(doc, fontFamily, {
  x,
  y,
  width,
  columns,
  rows,
  headerStyle = 'bold',
  rowStyle = 'normal',
}) {
  const colWidths = columns.map((c) => width * c.width);
  const qtyColIndex = columns.findIndex((c) => c.splitQuantity);
  const bodyHeights = rows.map((row) => (
    qtyColIndex >= 0 ? measureQuantityRowHeight(getQuantityPartes(row)) : GRID.rowH
  ));
  const rowHeights = [GRID.headerH, ...bodyHeights];
  const tableH = rowHeights.reduce((s, h) => s + h, 0);

  drawGridLines(doc, x, y, width, rowHeights, colWidths);

  if (qtyColIndex >= 0) {
    const qtyX = columnOffsetX(x, colWidths, qtyColIndex);
    const splitX = qtyX + colWidths[qtyColIndex] * GRID.qtySplitRatio;
    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(GRID.lineWidth);
    doc.line(splitX, y, splitX, y + tableH);
  }

  doc.setFont(fontFamily, headerStyle);
  doc.setFontSize(FONT.tableHead);
  setTextColor(doc, COLORS.muted);

  let cursorX = x;
  for (let i = 0; i < columns.length; i += 1) {
    const col = columns[i];
    if (col.splitQuantity) {
      const qtyX = cursorX;
      const splitX = qtyX + colWidths[i] * GRID.qtySplitRatio;
      doc.text('QTD', splitX - GRID.padX, y + GRID.headerPadTop, { align: 'right', baseline: 'top' });
      doc.text('UN', splitX + GRID.padX, y + GRID.headerPadTop, { align: 'left', baseline: 'top' });
    } else {
      const cellX = col.align === 'right'
        ? cursorX + colWidths[i] - GRID.padX
        : col.align === 'center'
          ? cursorX + colWidths[i] / 2
          : cursorX + GRID.padX;
      doc.text(col.label, cellX, y + GRID.headerPadTop, { align: col.align || 'left', baseline: 'top' });
    }
    cursorX += colWidths[i];
  }

  let cursorY = y + GRID.headerH;
  doc.setFont(fontFamily, rowStyle);
  doc.setFontSize(FONT.tableRow);
  const qtyNumberWidth = qtyColIndex >= 0
    ? measureTableQtyNumberWidth(doc, rows, fontFamily, rowStyle)
    : 0;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const rowH = bodyHeights[rowIndex];
    const textTop = cursorY + GRID.cellPadTop;
    cursorX = x;

    for (let i = 0; i < columns.length; i += 1) {
      const col = columns[i];
      if (col.splitQuantity) {
        const qtyX = cursorX;
        const splitX = qtyX + colWidths[qtyColIndex] * GRID.qtySplitRatio;
        const partes = getQuantityPartes(row);
        let lineY = textTop;
        setTextColor(doc, COLORS.muted);
        for (const parte of partes) {
          const numero = String(parte.numero ?? '—');
          const numeroX = splitX - GRID.padX - (qtyNumberWidth - doc.getTextWidth(numero));
          doc.text(numero, numeroX, lineY, { align: 'left', baseline: 'top' });
          doc.text(String(parte.unidade ?? ''), splitX + GRID.padX, lineY, { align: 'left', baseline: 'top' });
          lineY += GRID.qtyLineStep;
        }
      } else {
        const raw = row[col.key] ?? '—';
        const text = String(raw);
        const maxW = colWidths[i] - GRID.padX * 2;
        const lines = doc.splitTextToSize(text, maxW);
        const line = lines[0] || '—';
        const cellX = col.align === 'right'
          ? cursorX + colWidths[i] - GRID.padX
          : col.align === 'center'
            ? cursorX + colWidths[i] / 2
            : cursorX + GRID.padX;
        setTextColor(
          doc,
          col.key === 'valor'
            ? COLORS.accent
            : col.key === 'custoMedio' || col.key === 'precoMedio'
              ? COLORS.muted
              : COLORS.ink,
        );
        if (col.key === 'valor') doc.setFont(fontFamily, 'bold');
        doc.text(line, cellX, textTop, { align: col.align || 'left', baseline: 'top' });
        if (col.key === 'valor') doc.setFont(fontFamily, rowStyle);
      }
      cursorX += colWidths[i];
    }

    cursorY += rowH;
  }

  return y + tableH;
}

function estimateGridTableHeight(rows, columns) {
  const qtyColIndex = columns.findIndex((c) => c.splitQuantity);
  const bodyHeights = (rows || []).map((row) => (
    qtyColIndex >= 0 ? measureQuantityRowHeight(getQuantityPartes(row)) : GRID.rowH
  ));
  return GRID.headerH + bodyHeights.reduce((sum, height) => sum + height, 0);
}

function fitsOnPage(startY, blockHeight, pageH, reserve = FOOTER_RESERVE) {
  return startY + blockHeight <= pageH - reserve;
}

function drawPageFooter(doc, fontFamily, normalizePdfText, M, CW, pageH, leftLabel, rightLabel) {
  const footerY = pageH - 10;
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(GRID.lineWidth);
  doc.line(M, footerY - 4, M + CW, footerY - 4);
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(FONT.footer);
  setTextColor(doc, COLORS.muted);
  doc.text(normalizePdfText(leftLabel), M, footerY);
  doc.text(normalizePdfText(rightLabel), M + CW, footerY, { align: 'right' });
}

function drawSectionTitle(doc, fontFamily, normalizePdfText, x, y, title) {
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(FONT.section);
  setTextColor(doc, COLORS.ink);
  doc.text(normalizePdfText(title), x, y);
  return y + LAYOUT.sectionTitleH;
}

function drawTwoColumnBlock(doc, fontFamily, normalizePdfText, layout, y, leftCfg, rightCfg, pageH) {
  const { M, CW } = layout;
  const gap = 5;
  const leftWidth = (CW - gap) * (leftCfg.widthRatio ?? 0.58);
  const rightWidth = CW - gap - leftWidth;
  const leftX = M;
  const rightX = M + leftWidth + gap;

  const sectionY = y + LAYOUT.blockGapBefore;
  const yAfterLeftTitle = drawSectionTitle(doc, fontFamily, normalizePdfText, leftX, sectionY, leftCfg.title);
  const yAfterRightTitle = drawSectionTitle(doc, fontFamily, normalizePdfText, rightX, sectionY, rightCfg.title);
  const tableY = Math.max(yAfterLeftTitle, yAfterRightTitle) + LAYOUT.titleToTable;
  const maxTableHeight = leftCfg.maxHeight
    ?? rightCfg.maxHeight
    ?? availableTableHeight(pageH, tableY);

  const leftRows = leftCfg.rawRows
    ? fitTableRows(leftCfg.rawRows, leftCfg.toDisplay, leftCfg.columns, maxTableHeight, leftCfg.consolidate)
    : leftCfg.rows;
  const rightRows = rightCfg.rawRows
    ? fitTableRows(rightCfg.rawRows, rightCfg.toDisplay, rightCfg.columns, maxTableHeight, rightCfg.consolidate)
    : rightCfg.rows;

  const leftEnd = drawGridTable(doc, fontFamily, {
    x: leftX,
    y: tableY,
    width: leftWidth,
    columns: leftCfg.columns,
    rows: leftRows,
  });
  const rightEnd = drawGridTable(doc, fontFamily, {
    x: rightX,
    y: tableY,
    width: rightWidth,
    columns: rightCfg.columns,
    rows: rightRows,
  });

  return Math.max(leftEnd, rightEnd) + LAYOUT.sectionGapAfter;
}

function drawPage1Fisico(doc, fontFamily, normalizePdfText, data, layout) {
  const { M, CW, pageH } = layout;
  let y = M;
  const text = (str, x, yy, opts = {}) => doc.text(normalizePdfText(str), x, yy, opts);

  const familiasColumns = [
    { key: 'letra', label: 'CL.', width: 0.09, align: 'center' },
    { key: 'familia', label: 'FAMÍLIA', width: 0.35, align: 'left' },
    { key: 'quantidade', label: 'QTD', width: 0.28, align: 'left', splitQuantity: true },
    { key: 'valor', label: 'R$', width: 0.28, align: 'right' },
  ];
  const abcdColumns = [
    { key: 'letra', label: 'CLASSE', width: 0.24, align: 'left' },
    { key: 'valor', label: 'R$', width: 0.76, align: 'right' },
  ];

  doc.setFont(fontFamily, 'heavy');
  doc.setFontSize(FONT.title);
  setTextColor(doc, COLORS.ink);
  text('Estoque físico', M, y);
  y += 7;

  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(FONT.subtitle);
  setTextColor(doc, COLORS.muted);
  text('O que está no armazém hoje — pronto para vender ou separar', M, y);
  y += 4;
  text(`Atualizado em ${data.geradoEm} (Tabatinga)`, M, y);
  y += 7;

  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(GRID.lineWidth);
  doc.line(M, y, M + CW, y);
  y += 8;

  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(FONT.kpiLabel);
  setTextColor(doc, COLORS.muted);
  text('VALOR TOTAL EM ESTOQUE (CUSTO)', M, y);
  y += 6;

  doc.setFont(fontFamily, 'heavy');
  doc.setFontSize(FONT.kpi);
  setTextColor(doc, COLORS.ink);
  text(BRL_KPI.format(data.total), M, y);
  y += 6;

  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(FONT.subtitle);
  setTextColor(doc, COLORS.muted);
  text(`${QTD.format(data.skusCom)} referências com saldo positivo`, M, y);
  y += 8;

  doc.line(M, y, M + CW, y);
  y += LAYOUT.sectionGapBetween;

  const maxTwoColHeight = availableTableHeight(pageH, sectionTitleEndY(y));

  y = drawTwoColumnBlock(doc, fontFamily, normalizePdfText, layout, y, {
    title: 'Resumo por família (nível 1)',
    widthRatio: 0.64,
    columns: familiasColumns,
    rawRows: data.grupos,
    toDisplay: (g) => ({
      letra: g.letra || '—',
      familia: g.label,
      quantidadePartes: g.quantidadePartes,
      valor: fmtTabValor(g.valor),
    }),
    consolidate: {
      tipo: 'famílias',
      labelKey: 'label',
      mapOutros: (tail) => ({
        label: labelOutros(tail.length),
        letra: '—',
        quantidadePartes: [{ numero: '—', unidade: '' }],
        valor: sumValorRows(tail),
      }),
    },
    maxHeight: maxTwoColHeight,
  }, {
    title: 'Por curva ABCD (nível 1)',
    columns: abcdColumns,
    rawRows: data.porAbcd,
    toDisplay: (row) => ({
      letra: row.letra,
      valor: fmtTabValor(row.valor),
    }),
  }, pageH);

  drawPageFooter(
    doc,
    fontFamily,
    normalizePdfText,
    M,
    CW,
    pageH,
    `P38 · Estoque físico · p.1 · ${PDF_BUILD}`,
    'Famílias e curva ABCD no nível hierárquico 1',
  );
}

function drawPage2Transito(doc, fontFamily, normalizePdfText, transito, layout) {
  const { M, CW, pageH } = layout;
  let y = M;
  const text = (str, x, yy, opts = {}) => doc.text(normalizePdfText(str), x, yy, opts);

  doc.setFont(fontFamily, 'heavy');
  doc.setFontSize(FONT.title);
  setTextColor(doc, COLORS.ink);
  text('Estoque em trânsito', M, y);
  y += 7;

  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(FONT.subtitle);
  setTextColor(doc, COLORS.muted);
  text('Compras aprovadas que ainda não entraram no armazém', M, y);
  y += 4;
  text(`Atualizado em ${transito.geradoEm} (Tabatinga)`, M, y);
  y += 7;

  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(GRID.lineWidth);
  doc.line(M, y, M + CW, y);
  y += 8;

  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(FONT.kpiLabel);
  setTextColor(doc, COLORS.muted);
  text('VALOR TOTAL EM TRÂNSITO (CUSTO)', M, y);
  y += 6;

  doc.setFont(fontFamily, 'heavy');
  doc.setFontSize(FONT.kpi);
  setTextColor(doc, COLORS.ink);
  text(BRL_KPI.format(transito.totalTransito), M, y);
  y += 6;

  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(FONT.subtitle);
  setTextColor(doc, COLORS.muted);
  text(
    `${QTD.format(transito.pedidosAbertos)} pedidos · ${QTD.format(transito.embarquesTransito)} embarques · ${QTD.format(transito.volumesTotal)} volumes`,
    M,
    y,
  );
  y += 4;
  text('Compras com financeiro aprovado e pedido ainda não concluído', M, y);
  y += 8;

  doc.line(M, y, M + CW, y);
  y += LAYOUT.sectionGapBetween;

  const familiaColumns = [
    { key: 'familia', label: 'FAMÍLIA', width: 0.52, align: 'left' },
    { key: 'letra', label: 'CL.', width: 0.10, align: 'left' },
    { key: 'valor', label: 'R$', width: 0.38, align: 'right' },
  ];
  const block2ReserveMm = 72;
  const familiaReserveMm = 52;
  const block1TableY = sectionTitleEndY(y);
  const maxBlock1Height = pageH - FOOTER_RESERVE - block1TableY - block2ReserveMm - familiaReserveMm - LAYOUT.sectionGapBetween * 2;

  y = drawTwoColumnBlock(doc, fontFamily, normalizePdfText, layout, y, {
    title: 'Embarques em trânsito',
    widthRatio: 0.56,
    columns: [
      { key: 'eta', label: 'ETA', width: 0.18, align: 'left' },
      { key: 'transportadora', label: 'TRANSPORTADORA', width: 0.36, align: 'left' },
      { key: 'volumes', label: 'VOLUMES', width: 0.16, align: 'right' },
      { key: 'valor', label: 'VALOR (R$)', width: 0.30, align: 'right' },
    ],
    rawRows: transito.embarquesPorEtaTransportadora,
    toDisplay: (row) => ({
      eta: row.eta,
      transportadora: row.transportadora,
      volumes: QTD.format(row.volumes),
      valor: fmtTabValor(row.valor),
    }),
    consolidate: {
      tipo: 'embarques',
      labelKey: 'transportadora',
      mapOutros: (tail) => ({
        eta: '—',
        transportadora: labelOutros(tail.length),
        volumes: QTD.format(tail.reduce((sum, row) => sum + (Number(row.volumes) || 0), 0)),
        valor: sumValorRows(tail),
      }),
    },
    maxHeight: maxBlock1Height,
  }, {
    title: 'Por fornecedor',
    columns: [
      { key: 'fornecedor', label: 'FORNECEDOR', width: 0.48, align: 'left' },
      { key: 'quantidade', label: 'EMB.', width: 0.18, align: 'left', splitQuantity: true },
      { key: 'valor', label: 'R$', width: 0.34, align: 'right' },
    ],
    rawRows: transito.porFornecedor,
    toDisplay: (row) => ({
      fornecedor: row.fornecedor,
      quantidadePartes: row.quantidadePartes,
      valor: fmtTabValor(row.valor),
    }),
    consolidate: {
      tipo: 'fornecedores',
      labelKey: 'fornecedor',
      mapOutros: (tail) => ({
        fornecedor: labelOutros(tail.length),
        quantidadePartes: [{ numero: '—', unidade: '' }],
        valor: sumValorRows(tail),
      }),
    },
    maxHeight: maxBlock1Height,
  }, pageH);

  const block2TableY = sectionTitleEndY(y);
  const maxBlock2Height = pageH - FOOTER_RESERVE - familiaReserveMm - block2TableY - LAYOUT.sectionGapBetween;

  y = drawTwoColumnBlock(doc, fontFamily, normalizePdfText, layout, y, {
    title: 'Por curva ABCD (nível 1)',
    widthRatio: 0.30,
    columns: [
      { key: 'letra', label: 'CLASSE', width: 0.28, align: 'left' },
      { key: 'valor', label: 'R$', width: 0.72, align: 'right' },
    ],
    rawRows: transito.porAbcd,
    toDisplay: (row) => ({
      letra: row.letra,
      valor: fmtTabValor(row.valor),
    }),
    maxHeight: maxBlock2Height,
  }, {
    title: 'Por família (maiores valores)',
    columns: [
      { key: 'familia', label: 'PRODUTO', width: 0.34, align: 'left' },
      { key: 'quantidade', label: 'QUANT.', width: 0.22, align: 'left', splitQuantity: true },
      { key: 'precoMedio', label: 'PREÇO MÉD.', width: 0.22, align: 'right' },
      { key: 'valor', label: 'R$', width: 0.22, align: 'right' },
    ],
    rawRows: transito.porFamiliaMaiores,
    toDisplay: (row) => ({
      familia: row.familia,
      quantidadePartes: row.quantidadePartes,
      precoMedio: fmtPrecoMedio(row.precoMedio),
      valor: fmtTabValor(row.valor),
    }),
    consolidate: {
      tipo: 'famílias',
      labelKey: 'familia',
      mapOutros: (tail) => ({
        familia: labelOutros(tail.length),
        quantidadePartes: [{ numero: '—', unidade: '' }],
        precoMedio: '—',
        valor: sumValorRows(tail),
      }),
    },
    maxHeight: maxBlock2Height,
  }, pageH);

  y += LAYOUT.sectionGapBetween;
  y = drawSectionTitle(doc, fontFamily, normalizePdfText, M, y, 'Por família chegando (nível 1)') + LAYOUT.titleToTable;

  const familiaRows = fitTableRows(
    transito.porFamiliaH1,
    (row) => ({
      familia: row.familia,
      letra: row.letra,
      valor: fmtTabValor(row.valor),
    }),
    familiaColumns,
    availableTableHeight(pageH, y),
    {
      tipo: 'famílias',
      labelKey: 'familia',
      mapOutros: (tail) => ({
        familia: labelOutros(tail.length),
        letra: '—',
        valor: sumValorRows(tail),
      }),
    },
  );

  drawGridTable(doc, fontFamily, {
    x: M,
    y,
    width: CW,
    columns: familiaColumns,
    rows: familiaRows,
  });

  drawPageFooter(
    doc,
    fontFamily,
    normalizePdfText,
    M,
    CW,
    pageH,
    `P38 · Estoque em trânsito · p.2 · ${PDF_BUILD}`,
    'Curva ABCD consolidada por família (campo hierárquico nível 1)',
  );
}


export async function generateRelatorioEstoqueGlobalPdf({ produtos, compraContext }) {
  const fisico = buildResumoData(produtos, {
    resolveProdutoCustoUnitarioBase,
    formatEstoqueApresentacao,
    resolveProdutoAbcdClasse,
  });
  const transito = buildResumoTransitoData(produtos, compraContext, {
    resolveProdutoAbcdClasse,
  });
  transito.geradoEm = fisico.geradoEm;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const fontFamily = await registerJsPdfBarlowFonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const layout = { M: 12, CW: pageW - 24, pageH };

  drawPage1Fisico(doc, fontFamily, normalizePdfText, fisico, layout);
  doc.addPage();
  drawPage2Transito(doc, fontFamily, normalizePdfText, transito, layout);

  const bytes = doc.output('arraybuffer');
  return { data: new Uint8Array(bytes) };
}

export {
  buildResumoData,
  buildResumoTransitoData,
};
