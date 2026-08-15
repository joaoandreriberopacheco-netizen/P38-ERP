import { jsPDF } from 'jspdf';
import { registerJsPdfDin1451Fonts } from '@/lib/jspdfNotoFont';
import { appendAnexosToPdfDoc } from '@/lib/appendAnexosToPdfDoc';

/** Escala só no eixo Y (glifos mais altos, largura inalterada). PDF Tm: sx=1, sy>1. */
const PDF_GLYPH_STRETCH_Y = 1.1;

/**
 * Aplica alongamento vertical no texto do PDF via matriz interna do jsPDF (não aumenta fontSize).
 * Preserva options.angle se já for uma Matrix (ex.: rotação customizada).
 */
const patchPdfTextVerticalStretch = (doc, stretchY = PDF_GLYPH_STRETCH_Y) => {
  const PdfMatrix = jsPDF.API?.Matrix;
  if (!PdfMatrix) return;
  const origText = doc.text.bind(doc);
  doc.text = function (text, x, y, options, transform) {
    if (options != null && typeof options === 'object' && options.angle instanceof PdfMatrix) {
      return origText(text, x, y, options, transform);
    }
    const stretch = new PdfMatrix(1, 0, 0, stretchY, 0, 0);
    if (options != null && typeof options === 'object' && !Array.isArray(options)) {
      return origText(text, x, y, { ...options, angle: stretch }, transform);
    }
    return origText(text, x, y, { angle: stretch }, transform);
  };
};

const PDF_FONT_BOLD = 'bold';
const PDF_FONT_NORMAL = 'normal';
const NOTO_REGULAR_URL = 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf';
const NOTO_BOLD_URL = 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf';
const fontCache = { regular: null, bold: null };

const arrayBufferToBase64 = (buffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const loadFontBase64 = async (url, cacheKey) => {
  if (fontCache[cacheKey]) return fontCache[cacheKey];
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Erro ao carregar fonte ${cacheKey}`);
  const base64 = arrayBufferToBase64(await response.arrayBuffer());
  fontCache[cacheKey] = base64;
  return base64;
};

/** Retorna true se NotoSans foi registrada; em falha de rede/CDN usa Helvetica e retorna false. */
const registerPdfFonts = async (doc): Promise<boolean> => {
  try {
    const [regularBase64, boldBase64] = await Promise.all([
      loadFontBase64(NOTO_REGULAR_URL, 'regular'),
      loadFontBase64(NOTO_BOLD_URL, 'bold'),
    ]);
    doc.addFileToVFS('NotoSans-Regular.ttf', regularBase64);
    doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
    doc.addFileToVFS('NotoSans-Bold.ttf', boldBase64);
    doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
    doc.setFont('NotoSans', PDF_FONT_NORMAL);
    return true;
  } catch (err) {
    console.error('gerarRelatorioPedidosCompra: falha ao carregar Noto Sans, usando Helvetica:', err);
    doc.setFont('helvetica', PDF_FONT_NORMAL);
    return false;
  }
};

const safe = (texto) => {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .normalize('NFC')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '-');
};

const toTitleCase = (str) => {
  if (!str) return '';
  return String(str).toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());
};

/** Segmentos preenchidos (1–5) alinhados ao fluxo da tela (getBorrowedStatus / status exibido). */
const STATUS_PROGRESS = {
  'Rascunho': 1,
  'Aguardando': 2,
  'Aguardando Liberacao': 2,
  'Aguardando Liberacao Financeira': 2,
  'Aguardando Aprovacao Financeira': 2,
  'Aguardando Pagamento': 2,
  'Aprovado': 3,
  'Pendencia': 3,
  'Despachado': 4,
  'Em Recepcao': 4,
  'Em Conferencia': 4,
  'Em Transito': 4,
  'Concluido': 5,
  'Devolvido': 2,
  'Cancelado': 0,
};
const normalizeStatusProgressKey = (status) =>
  String(status || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const getStatusProgress = (status) => {
  const key = normalizeStatusProgressKey(status);
  return STATUS_PROGRESS[key] ?? 1;
};

/** Alinha quantidade e sigla ao contracto de embalagens / unidade comercial (espelho de @/lib/productUnits). */
const PDF_NN = (v, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const PDF_NORM_CODE = (v) => String(v ?? '').trim().toUpperCase();
const PDF_IS_SHOW = (p) => p?.unidade_show_ativa !== false;
const PDF_NORM_ALTS = (p) =>
  (Array.isArray(p?.unidades_alternativas) ? p.unidades_alternativas : [])
    .filter((x) => x?.unidade && x?.ativo !== false)
    .map((x) => ({
      unidade: PDF_NORM_CODE(x.unidade),
      fator_conversao: PDF_NN(x.fator_conversao, 1),
      rotulo: typeof x.rotulo === 'string' ? x.rotulo.trim() : '',
      ativo: x.ativo !== false,
    }));
const PDF_RESOLVE_PRIMARY = (p, fallbackUnit = 'UN') => {
  const alts = PDF_NORM_ALTS(p);
  const f1 = alts.filter((a) => PDF_NN(a.fator_conversao, 0) === 1);
  const princAtual = PDF_NORM_CODE(p?.unidade_principal);
  if (f1.length === 1) return f1[0].unidade;
  if (f1.length > 1) {
    const m = f1.find((a) => a.unidade === princAtual);
    return m?.unidade || f1[0].unidade;
  }
  return princAtual || PDF_NORM_CODE(fallbackUnit) || 'UN';
};
const PDF_BUILD_PURCHASE_OPTS = (p) => {
  const up = PDF_RESOLVE_PRIMARY(p, 'UN');
  const custoBase = PDF_NN(p?.valor_compra, 0);
  const princ = { unidade: up, fator_conversao: 1, valor_unitario: custoBase, is_primary: true };
  const alts = PDF_NORM_ALTS(p).map((x) => ({
    unidade: x.unidade,
    fator_conversao: x.fator_conversao,
    valor_unitario: custoBase * x.fator_conversao,
    is_primary: false,
    rotulo: x.rotulo,
  }));
  const seen = new Set();
  const out = [princ, ...alts].filter((o) => {
    if (!o.unidade || seen.has(o.unidade)) return false;
    seen.add(o.unidade);
    return true;
  });
  return out;
};
const PDF_RESOLVE_COMMERCIAL = (p, fallbackUnit = 'UN') => {
  const opts = PDF_BUILD_PURCHASE_OPTS(p);
  if (!opts.length) return PDF_NORM_CODE(fallbackUnit) || 'UN';
  const rPrimary = PDF_RESOLVE_PRIMARY(p, opts[0]?.unidade || fallbackUnit);
  if (!PDF_IS_SHOW(p)) return rPrimary || PDF_NORM_CODE(fallbackUnit) || 'UN';
  const valids = new Set(opts.map((o) => o.unidade));
  const pris = [p?.unidade_apresentacao_default, p?.unidade_show_comercial, rPrimary, fallbackUnit];
  for (const pr of pris) {
    const c = PDF_NORM_CODE(pr);
    if (c && valids.has(c)) return c;
  }
  return opts[0]?.unidade || PDF_NORM_CODE(fallbackUnit) || 'UN';
};
const PDF_DISCRETE_UNITS = new Set(['PAC', 'CX', 'CT', 'FD', 'SC', 'PCT', 'PT', 'DZ', 'GL', 'RL', 'BAL', 'FAR', 'TAM']);
const PDF_DISCRETE_QTY_SNAP_EPSILON = 0.02;
const PDF_IS_EFFECTIVELY_INT = (v: number) => Number.isFinite(v) && Math.abs(v - Math.round(v)) < 1e-9;
const PDF_ROUND2 = (v: number) => Math.round(v * 100) / 100;
/** Espelho de `commercialQuantityFromBase` em @/lib/productUnits (PAC/CX: inteiro + snap perto de inteiro). */
const PDF_FATOR_EH_INTEIRO = (fator: number) => {
  const f = PDF_NN(fator, 1) || 1;
  return Math.abs(f - Math.round(f)) < 1e-6;
};
const PDF_COMMERCIAL_QTY_FROM_BASE = (quantityBase: number, fatorConversao = 1, unitCode = '') => {
  const base = PDF_NN(quantityBase, 0);
  const fator = PDF_NN(fatorConversao, 1) || 1;
  if (!(fator > 0)) return PDF_ROUND2(base);
  const u = PDF_NORM_CODE(unitCode);
  const raw = base / fator;
  if (PDF_DISCRETE_UNITS.has(u)) {
    if (PDF_FATOR_EH_INTEIRO(fator)) {
      const bi = Math.round(base);
      const fi = Math.round(fator);
      if (fi > 0 && bi % fi === 0) return bi / fi;
    }
    const nearest = Math.round(raw);
    if (nearest > 0 && Math.abs(raw - nearest) <= PDF_DISCRETE_QTY_SNAP_EPSILON) return nearest;
  }
  return PDF_ROUND2(raw);
};
const PDF_RESOLVE_COMMERCIAL_DISPLAY = (product, quantityBase, fallbackUnit = 'UN') => {
  if (!PDF_IS_SHOW(product)) {
    const u = PDF_RESOLVE_PRIMARY(product, fallbackUnit);
    return { unidade: u, fator_conversao: 1, quantidade: PDF_NN(quantityBase, 0) };
  }
  const u = PDF_RESOLVE_COMMERCIAL(product, fallbackUnit);
  const opts = PDF_BUILD_PURCHASE_OPTS(product);
  const option = opts.find((o) => o.unidade === u) || opts[0] || null;
  const f = PDF_NN(option?.fator_conversao, 1) || 1;
  const qb = PDF_NN(quantityBase, 0);
  const quantidade = f > 0 ? PDF_COMMERCIAL_QTY_FROM_BASE(qb, f, u) : qb;
  return { unidade: u, fator_conversao: f, quantidade };
};
const PDF_PDV_PREFERIDO = (produto, item) => {
  const op = PDF_BUILD_PURCHASE_OPTS(produto);
  const principal = PDF_NORM_CODE(produto?.unidade_principal) || 'UN';
  const raw = [produto?.unidade_apresentacao_default, item?.unidade_apresentacao_default, produto?.unidade_show_comercial, item?.unidade_show_comercial, item?.unidade_medida, 'UN']
    .map((v) => PDF_NORM_CODE(v))
    .filter(Boolean);
  const mapA = (raw) => (raw === 'CAIXA' || raw === 'CAIXAS' ? 'CX' : raw === 'M²' || raw === 'M2' || raw === 'METRO QUADRADO' ? 'M2' : raw);
  for (const c of raw) {
    const a = mapA(c);
    if (op.find((o) => o.unidade === a)) return a;
  }
  const naoP = op.find((o) => o.unidade !== principal);
  return naoP?.unidade || principal;
};

const moeda = (valor = 0) =>
  `R$ ${Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const moedaSemSimbolo = (valor = 0) =>
  Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Quantidades no relatório: arredondamento visual com até 2 casas decimais (pt-BR). */
const fmtQuantidadePdf = (valor = 0) =>
  Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const percentual = (valor = 0) =>
  `${Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const moedaOuTraco = (valor) => (Number.isFinite(Number(valor)) ? moeda(valor) : '--');
const moedaSemSimboloOuTraco = (valor) => (Number.isFinite(Number(valor)) ? moedaSemSimbolo(valor) : '--');
const percentualOuTraco = (valor) => (Number.isFinite(Number(valor)) ? percentual(valor) : '--');
const dataFmt = (valor) => {
  if (!valor) return '-';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return String(valor);
  return d.toLocaleDateString('pt-BR');
};

const normalizarStatusRelatorio = (status) => {
  if (status === 'Aguardando Liberação Financeira' || status === 'Aguardando Aprovação Financeira') return 'Aguardando Pagamento';
  return status || '-';
};

const getPedidoNumeroRelatorio = (pedido) => safe(pedido._display_code || pedido.numero || 'Sem numero');
const getFornecedorRelatorio = (pedido) => safe(pedido._display_fornecedor || pedido.fornecedor_nome || 'Sem fornecedor');
/** Texto livre do pedido (observações do comprador; sem log de histórico). */
const getTextoPedidoRelatorio = (pedido) => {
  const obs = String(pedido?.observacoes || '').trim();
  if (obs) return obs;
  return '';
};
const getDataRelatorio = (pedido) => pedido._display_date || pedido.data_prevista_entrega || pedido.data_emissao || pedido.created_date;
const getQuantidadeRelatorio = (pedido) => {
  const itens = pedido._display_itens || pedido.itens || [];
  return itens.reduce((a, i) => a + (Number(i.quantidade) || Number(i.quantidade_embarcada) || Number(i.quantidade_pedida) || 0), 0);
};
const getItensRelatorio = (pedido) => pedido._display_itens || pedido.itens || [];
/** Ordem alfabética estável por descrição do item (ou nome do produto em cache). */
const sortItensAlfabeticamente = (itens, produtosMap) =>
  [...itens].sort((a, b) => {
    const na = String(a?.produto_nome || produtosMap[a?.produto_id]?.nome || '').toLocaleLowerCase('pt-BR');
    const nb = String(b?.produto_nome || produtosMap[b?.produto_id]?.nome || '').toLocaleLowerCase('pt-BR');
    return na.localeCompare(nb, 'pt-BR', { sensitivity: 'base' });
  });

/** Custos monetários autoritários costumam estar só em `pedido.itens` (evitar misturar UM do card com totals da linha). */
const findLinhaPedidoOriginal = (pedido = {}, item = {}) => {
  const pid = item.produto_id;
  if (!pid) return {};
  const linhas = (pedido.itens || []).filter((i) => i.produto_id === pid);
  return linhas[0] || {};
};

/**
 * `true` = preços na linha (`custo_*`, `total/q`) estão no **eixo fator-1** (ex. R$/m²).
 * `false` = linha em **UM comercial** (ex. CX): `quantidade × fator_conversao ≈ quantidade_base`.
 * Sem isto, uma linha em caixa era lida como “fator-1” só por números mal guardados e o VLR alternava de eixo.
 */
const linhaPrecoNoEixoFatorUm = (linha = {}) => {
  const qb = Number(linha.quantidade_base) || 0;
  const qv = Number(linha.quantidade) || 0;
  const f = Number(linha.fator_conversao) || 1;
  if (!(qb > 0 && qv > 0)) return false;
  if (Math.abs(qv - qb) < 1e-5) return true;
  if (f > 1 && Math.abs(qv * f - qb) < Math.max(0.015 * qb, 0.05)) return false;
  return false;
};

const linhaQuantidadeIgualBase = linhaPrecoNoEixoFatorUm;

const roundTo2 = (n) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : n);

/**
 * Unitário salvo no pedido pode estar em fator-1 (m²) mesmo com QTD em CX na linha (caso Lombardia).
 * Converte para UM comercial quando: linha já era eixo fator-1;
 * ou total/qtd_base/qtd encaixa em “preço foi por m² × fator → CX”.
 */
const unitarioSalvoParaPrecoComercialPdf = (unit, o, item, f, eixoF1) => {
  if (!(Number.isFinite(unit) && unit > 0)) return NaN;
  if (!(f > 1)) return unit;

  const qb = Number(o.quantidade_base) || Number(item.quantidade_base) || 0;
  const qv = Number(o.quantidade) || Number(item.quantidade) || 0;
  const t =
    Number(
      o.total ?? item.total ?? o.valor_total_item ?? item.valor_total_item ?? o.valor_total ?? item.valor_total ?? 0,
    ) || 0;
  const tol = (x) => Math.max(0.025 * x, 0.35);
  const perCx = qv > 0 && t > 0 ? t / qv : NaN;
  const perB = qb > 0 && t > 0 ? t / qb : NaN;

  if (Number.isFinite(perCx) && perCx > 0 && Math.abs(unit - perCx) <= tol(perCx)) {
    return unit;
  }

  if (eixoF1) {
    if (Number.isFinite(perCx) && perCx > 0 && Math.abs(unit * f - perCx) <= tol(perCx)) {
      return unit * f;
    }
    return unit * f;
  }

  if (qb > 0 && qv > 0 && t > 0) {
    if (Number.isFinite(perB) && Math.abs(unit - perB) <= tol(perB) && Math.abs(unit * f - perCx) <= tol(perCx)) {
      return unit * f;
    }
  }
  return unit * f;
};

/**
 * Preço unitário **sempre na UM comercial do PDF** (igual à coluna UN / QTD).
 * Custos e totais vêm da linha do pedido (`o`); quantidades da fatia (`item`) só para `total/q` coerente com embarque.
 */
const getPrecoUmComercialPdf = (item = {}, pedido = {}, produto = {}) => {
  const o = findLinhaPedidoOriginal(pedido, item);
  const fItem = Number(item.fator_conversao);
  const fO = Number(o.fator_conversao);
  const f = (Number.isFinite(fItem) && fItem > 0 ? fItem : fO) || 1;
  const eixoF1 = linhaPrecoNoEixoFatorUm(o);

  const cf = Number(o.custo_final_unitario ?? item.custo_final_unitario);
  if (Number.isFinite(cf) && cf > 0) return unitarioSalvoParaPrecoComercialPdf(cf, o, item, f, eixoF1);

  const cu = Number(o.custo_unitario ?? item.custo_unitario) || 0;
  const descU = Number(o.valor_desconto_item ?? item.valor_desconto_item) || 0;
  const liqU = roundTo2(cu - descU);
  if (liqU > 0) return unitarioSalvoParaPrecoComercialPdf(liqU, o, item, f, eixoF1);

  const t =
    Number(
      item.total ?? o?.total ?? item.valor_total_item ?? o?.valor_total_item ?? item.valor_total ?? o?.valor_total ?? item.subtotal ?? o?.subtotal ?? 0,
    ) || 0;
  if (!(t > 0)) return NaN;

  const qB = Number(item.quantidade_base) || Number(o.quantidade_base) || 0;
  const qV =
    Number(item.quantidade ?? item.quantidade_embarcada ?? item.quantidade_pedida) || Number(o.quantidade) || 0;

  if (eixoF1 && qB > 0) return (t / qB) * f;
  if (!eixoF1 && qV > 0) return t / qV;
  if (qV > 0) return t / qV;
  if (qB > 0 && f > 0) return (t / qB) * f;
  return NaN;
};

/**
 * Valor total R$ da linha alinhado a `_qtdEfetiva` (UM comercial do PDF).
 * Só usado em **fallback** em `getValorUnitarioComercialItem` quando o `item` não traz `total`/`subtotal` úteis
 * (ex. pedido sem preço preenchido na linha normalizada, mas a linha em `pedido.itens` ainda tem valor).
 * Quando a linha tem `quantidade_base`, o rateio antigo (tL×qComm/qtd_linha) falha se `quantidade`
 * estiver em m² e o PDF em CX — usa (tL×qComm×fator)/quantidade_base.
 */
const valorTotalLinhaPdf = (item = {}, pedido = {}) => {
  const qComm =
    Number(item._qtdEfetiva ?? item.quantidade ?? item.quantidade_embarcada ?? item.quantidade_pedida) ||
    0;
  const linha = findLinhaPedidoOriginal(pedido, item);
  const tL =
    Number(linha.total ?? linha.valor_total_item ?? linha.valor_total ?? linha.subtotal ?? 0);

  const qBaseLinha = Number(linha.quantidade_base);
  const fator =
    Number(item.fator_conversao) ||
    Number(linha.fator_conversao) ||
    1;

  if (Number.isFinite(tL) && tL > 0 && qBaseLinha > 0 && qComm > 0 && fator > 0) {
    return (tL * qComm * fator) / qBaseLinha;
  }

  const qL = Number(linha.quantidade) || 0;
  const eps = 1e-3 * Math.max(1, qComm * fator);
  // Sem quantidade_base: total da linha costuma ser o valor inteiro do item; quantidade na linha pode estar
  // na UM comercial (igual ao PDF) ou na base (ex.: m² = qComm × fator).
  if (Number.isFinite(tL) && tL > 0 && qComm > 0 && qL > 0 && fator > 0) {
    if (Math.abs(qL - qComm) <= eps) return tL;
    if (Math.abs(qL - qComm * fator) <= eps) return tL;
    return (tL * qComm) / qL;
  }

  const direto = Number(item.total ?? item.valor_total_item ?? item.valor_total ?? item.subtotal ?? 0);
  if (Number.isFinite(direto) && direto > 0) return direto;
  return 0;
};

const getTransportadoraRelatorio = (pedido) => pedido._embarque?.transportadora_nome || 'Sem transportadora';
const getEtaRelatorio = (pedido) => pedido._embarque?.eta || null;
const getOrdinalRelatorio = (pedido) => pedido._display_ordinal || pedido._embarque?.numero || '#01';
const isNecessidadeRelatorio = (pedido) => !!pedido._is_necessidade || pedido._embarque?.tipo === 'Necessidade';
const getQuantidadeEfetivaItem = (item = {}) =>
  Number(item.quantidade) || Number(item.quantidade_embarcada) || Number(item.quantidade_pedida) || 0;

const getPercentualAjustePedido = (pedido = {}) => {
  const percentualDireto = Number(pedido.percentual_desconto);
  if (Number.isFinite(percentualDireto) && percentualDireto !== 0) return percentualDireto;

  const valorDesconto = Number(pedido.valor_desconto);
  const valorItens = Number(pedido.valor_itens);
  if (Number.isFinite(valorDesconto) && Number.isFinite(valorItens) && valorItens > 0) {
    return (valorDesconto / valorItens) * 100;
  }

  return 0;
};

const hasAjusteManualNoItem = (item = {}, baseUnit = 0) => {
  const descontoOuAcrescimo = Number(item.valor_desconto_item);
  if (Number.isFinite(descontoOuAcrescimo) && descontoOuAcrescimo !== 0) return true;

  const custoFinalUnitario = Number(item.custo_final_unitario);
  if (Number.isFinite(custoFinalUnitario) && Math.abs(custoFinalUnitario - baseUnit) > 0.01) return true;

  const qtd = getQuantidadeEfetivaItem(item);
  const totalItem = Number(item.total);
  if (Number.isFinite(totalItem) && qtd > 0) {
    const unitFromTotal = totalItem / qtd;
    if (Math.abs(unitFromTotal - baseUnit) > 0.01) return true;
  }

  return false;
};

const getValorUnitarioEfetivoItem = (item = {}, produto = {}, pedido = {}) => {
  const custoUnitario = Number(item.custo_unitario);
  const baseUnit = Number.isFinite(custoUnitario) ? custoUnitario : (Number(produto.valor_compra) || 0);
  const percentualAjustePedido = getPercentualAjustePedido(pedido);
  const multiplicadorPedido = 1 - (percentualAjustePedido / 100);
  const temAjusteManualItem = hasAjusteManualNoItem(item, baseUnit);

  const custoFinalUnitario = Number(item.custo_final_unitario);
  if (Number.isFinite(custoFinalUnitario) && custoFinalUnitario > 0) {
    return temAjusteManualItem ? custoFinalUnitario : (baseUnit * multiplicadorPedido);
  }

  // Regra principal: o cálculo final do item sempre prevalece.
  // Assim, qualquer desconto/acréscimo aplicado no formulário (inclusive via %) é refletido no relatório.
  const totalItem = Number(item.total ?? item.valor_total_item ?? item.valor_total);
  const qtd = getQuantidadeEfetivaItem(item);
  if (Number.isFinite(totalItem) && qtd > 0) {
    const unitFromTotal = totalItem / qtd;
    if (temAjusteManualItem) return unitFromTotal;
    // Lista/catálogo zerado mas linha com total: usar o derivado da linha (evita colunas zeradas no PDF)
    if (!Number.isFinite(baseUnit) || baseUnit <= 0) return unitFromTotal * multiplicadorPedido;
    return baseUnit * multiplicadorPedido;
  }

  const descontoOuAcrescimo = Number(item.valor_desconto_item);
  if (Number.isFinite(custoUnitario) && Number.isFinite(descontoOuAcrescimo)) {
    const unitComAjusteItem = custoUnitario - descontoOuAcrescimo;
    return temAjusteManualItem ? unitComAjusteItem : (unitComAjusteItem * multiplicadorPedido);
  }

  if (Number.isFinite(custoUnitario)) return custoUnitario * multiplicadorPedido;
  return (Number(produto.valor_compra) || 0) * multiplicadorPedido;
};

/**
 * Quando o pedido gravou o total como (qtd comercial × preço fator 1) em vez de (quantidade_base × preço fator 1),
 * o PDF mostra CX na coluna UN mas VLR. UN. continua o do m². Corrige para preço por embalagem = unitBase × fator.
 */
const ajustarPrecoUnitarioComercialSeTotalConfundeBase = (
  item = {},
  pedido = {},
  produto = {},
  liqInicial = 0,
  valorMonetarioRef = 0,
  qtdComm = 0,
) => {
  const f = Number(item.fator_conversao) || 1;
  const qB = Number(item.quantidade_base) || 0;
  const unitBase = getValorUnitarioEfetivoItem(item, produto, pedido);
  if (!(f > 1 && unitBase > 0 && qB > 0 && qtdComm > 0 && Number.isFinite(valorMonetarioRef) && valorMonetarioRef > 0)) {
    return liqInicial;
  }
  const epsQ = 1e-3 * Math.max(1, qtdComm * f);
  if (Math.abs(qB - qtdComm * f) > epsQ) return liqInicial;

  const tol = Math.max(0.05, 0.004 * Math.max(valorMonetarioRef, qB * unitBase, qtdComm * unitBase));
  const totalComoSeQtdComercialFosseSoPrecoBase = qtdComm * unitBase;
  const totalCoerenteEmUnidadeBase = qB * unitBase;
  if (
    Math.abs(valorMonetarioRef - totalComoSeQtdComercialFosseSoPrecoBase) <= tol &&
    Math.abs(valorMonetarioRef - totalCoerenteEmUnidadeBase) > tol
  ) {
    return unitBase * f;
  }
  return liqInicial;
};

/**
 * VLR. UN. (R$) **sempre** na UM comercial do PDF. A regra de eixo é única: `linhaPrecoNoEixoFatorUm` distingue
 * linha em fator-1 (m² = m²) de linha em comercial (qtd×fator≈base). `getPrecoUmComercialPdf` aplica
 * `unitarioSalvoParaPrecoComercialPdf` (coerência por eixo + total) para não mostrar R$/m² na coluna CX.
 * Fallbacks abaixo só para dados incompletos.
 */
const getValorUnitarioComercialItem = (item = {}, produto = {}, pedido = {}) => {
  const qtdComm =
    Number(item._qtdEfetiva) ||
    Number(item._qtdMostrada) ||
    Number(item.quantidade) ||
    Number(item.quantidade_embarcada) ||
    Number(item.quantidade_pedida) ||
    0;
  const fatorComercial = Number(item.fator_conversao) || 1;

  const o = findLinhaPedidoOriginal(pedido, item);
  const precoComercial = getPrecoUmComercialPdf(item, pedido, produto);
  if (Number.isFinite(precoComercial) && precoComercial > 0) return precoComercial;

  const totalDaLinhaNoItem = Number(
    item.total ?? item.valor_total_item ?? item.valor_total ?? item.subtotal ?? 0,
  );
  if (Number.isFinite(totalDaLinhaNoItem) && totalDaLinhaNoItem > 0 && qtdComm > 0) {
    const liq0 = totalDaLinhaNoItem / qtdComm;
    return ajustarPrecoUnitarioComercialSeTotalConfundeBase(
      item,
      pedido,
      produto,
      liq0,
      totalDaLinhaNoItem,
      qtdComm,
    );
  }

  const vLinha = valorTotalLinhaPdf(item, pedido);
  if (Number.isFinite(vLinha) && vLinha > 0 && qtdComm > 0) {
    const liq1 = vLinha / qtdComm;
    return ajustarPrecoUnitarioComercialSeTotalConfundeBase(item, pedido, produto, liq1, vLinha, qtdComm);
  }

  const totalB = Number(item.total ?? item.valor_total_item ?? item.valor_total ?? item.subtotal ?? 0);
  const qtdBase = Number(item.quantidade_base);
  if (Number.isFinite(totalB) && totalB > 0 && qtdBase > 0) {
    const unitBase = totalB / qtdBase;
    const liq2 = unitBase * fatorComercial;
    return ajustarPrecoUnitarioComercialSeTotalConfundeBase(item, pedido, produto, liq2, totalB, qtdComm);
  }

  const unitFallback = getValorUnitarioEfetivoItem(item, produto, pedido);
  const eixoF1Fallback = linhaPrecoNoEixoFatorUm(o);
  const liq3 = eixoF1Fallback && fatorComercial > 0 ? unitFallback * fatorComercial : unitFallback;
  const refMoeda = Number(item.total ?? item.valor_total_item ?? item.valor_total ?? item.subtotal ?? vLinha ?? 0);
  return ajustarPrecoUnitarioComercialSeTotalConfundeBase(item, pedido, produto, liq3, refMoeda, qtdComm);
};

const getTotalItensAjustadoPedido = (pedido, produtosMap = {}) => {
  const itens = getItensRelatorio(pedido);
  return itens.reduce((acc, item) => {
    const produto = produtosMap[item.produto_id] || {};
    const qtd = getQuantidadeEfetivaItem(item);
    const valorUnitarioEfetivo = getValorUnitarioEfetivoItem(item, produto, pedido);
    return acc + (qtd * valorUnitarioEfetivo);
  }, 0);
};

const getValorRelatorio = (pedido, produtosMap = {}) => {
  const valorConhecidoPedido = Number(pedido._display_valor ?? pedido.valor_pendente_entrega ?? pedido.valor_total);
  if (Number.isFinite(valorConhecidoPedido) && valorConhecidoPedido > 0) return valorConhecidoPedido;

  const totalItensAjustado = getTotalItensAjustadoPedido(pedido, produtosMap);
  if (totalItensAjustado > 0) return totalItensAjustado;
  return 0;
};

const custoCalculadoProduto = (produto = {}) =>
  (Number(produto.valor_compra) || 0)
  + (Number(produto.custo_frete_padrao) || 0)
  + (Number(produto.custo_imposto1_padrao) || 0)
  + (Number(produto.custo_imposto2_padrao) || 0)
  + (Number(produto.custo_outros_padrao) || 0)
  - (Number(produto.desconto_compra_padrao) || 0);

const sumOutrosCamposItem = (o = {}) =>
  (Number(o.custo_outros) || 0) +
  (Number(o.custo_imposto1) || 0) +
  (Number(o.custo_imposto2) || 0);

/**
 * Frete unitário (R$) na mesma UM comercial do PDF.
 * Regra única: custos “por fator 1 / base” (ex. R$/m²) viram R$/[UN da coluna] = valor_base × fator de conversão.
 * Se a linha já estiver toda em UM comercial = PDF, total/qtd nessa UM — sem multiplicar fator de novo.
 */
const resolveFreteUnitarioExpanded = (item = {}, prod = {}, pedido = {}, fatorComercial = 1) => {
  const linha = findLinhaPedidoOriginal(pedido, item);
  const fator = Number(item.fator_conversao ?? fatorComercial) || 1;
  const qComm = Number(item._qtdEfetiva ?? item.quantidade) || 0;
  const qL = Number(linha.quantidade) || 0;
  const qBaseL = Number(linha.quantidade_base) || 0;
  const ftL = Number(linha.frete_total);
  const epsQ = 1e-3 * Math.max(1, qComm * fator, qL, qBaseL);

  // 1) Pedido: quantidade da linha = quantidade comercial exibida → frete total / qtd = R$ frete nessa UN (sem × fator)
  if (ftL > 0 && qL > 0 && qComm > 0 && Math.abs(qL - qComm) <= epsQ) {
    return ftL / qL;
  }

  // 2) frete total ÷ quantidade base = R$/[fator 1] → × fator = R$/[UN comercial do PDF]
  if (ftL > 0 && qBaseL > 0) {
    return (ftL / qBaseL) * fator;
  }

  // 3) qtd da linha em m² = qComercial×fator (sem quantidade_base preenchida)
  if (ftL > 0 && qL > 0 && qComm > 0 && Math.abs(qL - qComm * fator) <= epsQ) {
    return (ftL / qL) * fator;
  }

  // 4) frete unitário na linha: em geral R$/[fator 1] (cadastro) → × fator; se linha U.M. = PDF, já é comercial
  const fuL = Number(linha.frete_unitario ?? linha.valor_frete_unitario ?? linha.valor_frete);
  if (Number.isFinite(fuL) && fuL !== 0) {
    if (qL > 0 && qComm > 0 && Math.abs(qL - qComm) <= epsQ) return fuL;
    return fuL * fator;
  }

  if (ftL > 0 && qL > 0) return ftL / qL;

  const fuI = Number(item.frete_unitario ?? item.valor_frete_unitario);
  if (Number.isFinite(fuI) && fuI !== 0) {
    if (fator > 1) return fuI * fator;
    return fuI;
  }
  const ftI = Number(item.frete_total);
  if (ftI > 0 && qComm > 0) return ftI / qComm;

  // 5) Catálogo: custo_frete_padrao = R$ por fator-1
  const padroBase = Number(prod.custo_frete_padrao) || 0;
  return padroBase * fator;
};

const resolveOutrosUnitarioExpanded = (item = {}, prod = {}, pedido = {}, fatorComercial = 1) => {
  const linha = findLinhaPedidoOriginal(pedido, item);
  const fator = Number(item.fator_conversao ?? fatorComercial) || 1;
  const qComm = Number(item._qtdEfetiva ?? item.quantidade) || 0;

  const otL = Number(linha.outros_total);
  const qBaseLinha = Number(linha.quantidade_base);
  if (Number.isFinite(otL) && otL > 0 && qBaseLinha > 0 && fator > 0) {
    return (otL / qBaseLinha) * fator;
  }

  const qL = Number(linha.quantidade) || 0;
  const eps = 1e-3 * Math.max(1, qComm * fator);
  if (Number.isFinite(otL) && otL > 0 && qL > 0 && fator > 0 && qComm > 0) {
    if (Math.abs(qL - qComm * fator) <= eps) return (otL / qL) * fator;
  }

  const temImpLinha = ['custo_outros', 'custo_imposto1', 'custo_imposto2'].some(
    (k) => linha[k] !== undefined && linha[k] !== null,
  );
  if (temImpLinha) {
    const raw = sumOutrosCamposItem(linha);
    if (raw !== 0) {
      if (linhaQuantidadeIgualBase(linha)) return raw * fator;
      return raw;
    }
  }

  if (Number.isFinite(otL) && otL > 0 && qL > 0) return otL / qL;

  const temImpItem = ['custo_outros', 'custo_imposto1', 'custo_imposto2'].some(
    (k) => item[k] !== undefined && item[k] !== null,
  );
  if (temImpItem) {
    const rawItem = sumOutrosCamposItem(item);
    if (rawItem !== 0) return rawItem;
  }

  const otItem = Number(item.outros_total);
  if (Number.isFinite(otItem) && otItem > 0 && qComm > 0) return otItem / qComm;

  return (
    ((Number(prod.custo_imposto1_padrao) || 0) +
      (Number(prod.custo_imposto2_padrao) || 0) +
      (Number(prod.custo_outros_padrao) || 0)) *
    fatorComercial
  );
};

const getQuantidadeComercialPdf = (item = {}) =>
  Number(item._qtdEfetiva ?? item._qtdMostrada ?? item.quantidade ?? item.quantidade_embarcada ?? item.quantidade_pedida) || 0;

/**
 * Contrato simples: confia que `custo_unitario` (ou `custo_final_unitario`) da linha do pedido
 * está no eixo **fator-1** (unidade base do produto). O PDF aplica a conversão para a unidade
 * comercial multiplicando pelo `fator_conversao` em `resolveMetricasItemPdf`.
 *
 * Itens em que o usuário tenha digitado o valor já em comercial saem dobrados — são correções manuais.
 */
const getPrecoBaseFator1Pedido = (item = {}, pedido = {}) => {
  const linha = findLinhaPedidoOriginal(pedido, item);
  const unit = Number(
    linha.custo_final_unitario ??
      linha.custo_unitario ??
      item.custo_final_unitario ??
      item.custo_unitario,
  );
  return Number.isFinite(unit) && unit > 0 ? unit : NaN;
};

const getFreteUnitarioConvertido = (prod = {}, fatorComercial = 1) => {
  const freteBaseCatalogo = Number(prod.custo_frete_padrao);
  if (!(Number.isFinite(freteBaseCatalogo) && freteBaseCatalogo >= 0)) return NaN;
  return freteBaseCatalogo * fatorComercial;
};

const getOutrosUnitarioConvertido = (prod = {}, fatorComercial = 1) => {
  const outrosBaseCatalogo =
    (Number(prod.custo_imposto1_padrao) || 0) +
    (Number(prod.custo_imposto2_padrao) || 0) +
    (Number(prod.custo_outros_padrao) || 0);
  if (!Number.isFinite(outrosBaseCatalogo)) return NaN;
  return outrosBaseCatalogo * fatorComercial;
};

/**
 * Aviso por linha apenas quando faltar o que a fórmula efetivamente usa:
 *  - preço do pedido (custo_final_unitario / custo_unitario da linha) → vira `VLR. UN.`
 *  - frete padrão do catálogo (custo_frete_padrao) → vira `FRETE`
 * `OUTROS` aceita 0 quando o catálogo não tem custos extras (não dispara aviso).
 * `fator_conversao` ausente é tratado como 1 (sem conversão).
 */
const getMissingCamposConversaoItem = (item = {}, pedido = {}) => {
  const missing: string[] = [];
  const precoBase = getPrecoBaseFator1Pedido(item, pedido);
  if (!(Number.isFinite(precoBase) && precoBase > 0)) missing.push('preco_pedido');
  return missing;
};

const resolveMetricasItemPdf = (item = {}, prod = {}, pedido = {}) => {
  const qtd = getQuantidadeComercialPdf(item);
  const un = safe(item.unidade_medida || prod.unidade_principal || 'UN');
  const fatorComercial = Number(item.fator_conversao) || 1;

  const vlrUnit = getValorUnitarioComercialItem(item, prod, pedido);
  const freteUnit = getFreteUnitarioConvertido(prod, fatorComercial);
  const outrosUnit = getOutrosUnitarioConvertido(prod, fatorComercial);
  const custoUnit = vlrUnit + freteUnit + outrosUnit;
  const totalLinha = (Number(qtd) || 0) * (Number(vlrUnit) || 0);
  const vendaUnit = (Number(prod.preco_venda_padrao) || 0) * fatorComercial;
  const markup = Number.isFinite(custoUnit) && custoUnit > 0 ? ((vendaUnit - custoUnit) / custoUnit) * 100 : NaN;

  // Avisos por linha foram removidos do PDF (contrato simples e padding mais enxuto).
  // Mantemos as chaves no retorno só para compatibilidade com chamadores existentes.
  return {
    qtd,
    un,
    vlrUnit,
    freteUnit,
    outrosUnit,
    custoUnit,
    totalLinha,
    vendaUnit,
    markup,
    missingFields: [],
    warningText: '',
  };
};

const TEXT_VERTICAL_SCALE = 1.75;
/** Tipografia do relatório expandido A4 (não aplicar ao mobile). */
const EXPANDED_A4_DESC_HEADER_FONT_SIZE = 8.25; // descrição + cabeçalhos QTD | UN | VLR. UN. | …
const EXPANDED_A4_BODY_VALUES_FONT_SIZE = 7; // valores numéricos no corpo
const EXPANDED_ITEMS_TABLE_FONT_SIZE = EXPANDED_A4_DESC_HEADER_FONT_SIZE;
const EXPANDED_ITEMS_TABLE_BODY_VALUES_FONT_SIZE = EXPANDED_A4_BODY_VALUES_FONT_SIZE;
const EXPANDED_ITEMS_TABLE_HEADER_FONT_SIZE = EXPANDED_A4_DESC_HEADER_FONT_SIZE;
const GROUP_LABEL_OUTDENT_MM = 8; // +0,5 cm à esquerda da margem (quebra visual do agrupador)
const GROUP_AGRUPAMENTO_TO_CARD_GAP_MM = 10; // 1 cm entre resumo/agrupador e card; título ao meio
/** Ajustes finos de altura no expandido A4 (mantém visual “ótimo”; só economiza papel). */
const EXPANDED_A4_TIGHT = {
  codeY0: 6.8,
  gapCodeForn: 2.8,
  gapAfterForn: 1,
  gapAfterMeta: 1.5,
  progH: 2.8,
  gapBeforeColHdr: 2.8,
  colHdrBaselineOffset: 4.5,
  colHdrBlockH: 6.8,
  cardPadBottom: 2.5,
  gapHeaderToItems: 1.5,
  gapAfterCard: 3,
  footerBlockH: 10,
};
const EXPANDED_ITEMS_TABLE_HEADER_HEIGHT = 12;
const EXPANDED_ITEMS_TABLE_ROW_HEIGHT = 7.2;
const EXPANDED_ITEMS_TABLE_TEXT_Y = 4.35;
/** Ancoras X (mm a partir de TM) para texto alinhado à direita; última coluna ≤ TW (evita extravasar a área da tabela). */
const EXPANDED_ITEMS_TABLE_COLUMNS = {
  qtd: 2,
  unidade: 13,
  descricao: 22,
  vlrUnit: 83,
  frete: 98,
  outros: 114,
  custo: 130,
  total: 146,
  venda: 162,
  markup: 178,
};
/** Margem horizontal (mm) entre fim da coluna descrição e coluna VLR. UN. (evita sobreposição ao imprimir). */
const EXPANDED_DESC_TO_VLR_GAP_MM = 15;

const addWrappedText = (doc, text, x, y, maxWidth, lineHeight = 5) => {
  const lines = doc.splitTextToSize(safe(text || '-'), maxWidth);
  doc.text(lines, x, y, { charSpace: 0, horizontalScale: 100 });
  return y + (lines.length * lineHeight * TEXT_VERTICAL_SCALE);
};

const STATUS_PDF_COLORS = {
  'Rascunho':              { dot: [209,213,219], pillBg: [243,244,246], pillText: [107,114,128] },
  'Aguardando':            { dot: [203,213,225], pillBg: [241,245,249], pillText: [71,85,105]   },
  'Aguardando Liberacao':  { dot: [203,213,225], pillBg: [241,245,249], pillText: [71,85,105]   },
  'Aguardando Liberacao Financeira': { dot: [203,213,225], pillBg: [241,245,249], pillText: [71,85,105] },
  'Aguardando Pagamento':  { dot: [203,213,225], pillBg: [241,245,249], pillText: [71,85,105]   },
  'Aprovado':              { dot: [52,211,153],  pillBg: [236,253,245], pillText: [4,120,87]    },
  'Despachado':            { dot: [34,211,238],  pillBg: [236,254,255], pillText: [14,116,144]  },
  'Em Recepcao':           { dot: [34,211,238],  pillBg: [236,254,255], pillText: [14,116,144]  },
  'Em Conferencia':        { dot: [34,211,238],  pillBg: [236,254,255], pillText: [14,116,144]  },
  'Em Transito':           { dot: [56,189,248],  pillBg: [240,249,255], pillText: [3,105,161]   },
  'Pendencia':             { dot: [251,146,60],  pillBg: [255,247,237], pillText: [194,65,12]   },
  'Devolvido':             { dot: [251,113,133], pillBg: [255,241,242], pillText: [190,24,93]   },
  'Concluido':             { dot: [16,185,129],  pillBg: [236,253,245], pillText: [4,120,87]    },
  'Cancelado':             { dot: [209,213,219], pillBg: [243,244,246], pillText: [156,163,175] },
};

const getStatusColors = (status) => {
  const key = normalizeStatusProgressKey(status);
  return STATUS_PDF_COLORS[key] || STATUS_PDF_COLORS['Rascunho'];
};

const normalizeReportVersion = (version) => {
  if (version === 'mobile_com_alma') return 'expandida_mobile_claro';
  if (version === 'compacta') return 'expandida_enxuta';
  if (version === 'expandida_enxuta') return 'expandida_enxuta';
  if (version === 'expandida_mobile_claro') return 'expandida_mobile_claro';
  if (version === 'expandida_mobile') return 'expandida_mobile';
  if (version === 'expandida') return 'expandida';
  if (version === 'expandida_com_anexos') return 'expandida_com_anexos';
  return 'expandida';
};

export async function generateRelatorioPedidosCompraPdf(payload = {}) {
  try {
    const {
      pedidos = [],
      version = 'compacta',
      filtros_desc = 'Pedidos filtrados na tela',
      kpis = {},
      grupos = [],
      produtos_map: produtosMapFromPayload = {},
      anexos_por_pedido: anexosPorPedido = {},
    } = payload;
    const normalizedVersion = normalizeReportVersion(version);

    const includeAnexos = normalizedVersion === 'expandida_com_anexos';
    /** Completo com anexos: minuta mobile (texto do pedido legível no celular) + comprovantes embutidos. */
    const layoutVersion = includeAnexos ? 'expandida_mobile_claro' : normalizedVersion;

    const isMobileClaro = layoutVersion === 'expandida_mobile_claro';
    const isMobileClassico = layoutVersion === 'expandida_mobile';
    const isMobile = isMobileClaro || isMobileClassico;
    const isEnxuta = layoutVersion === 'expandida_enxuta';

    const generatedAtStr = new Date().toLocaleString('pt-BR');
    /** Páginas do relatório completo → metadados do pedido no cabeçalho. */
    const pagePedidoChrome = {};
    const RELATORIO_COMPLETO_CHROME = isMobile
      ? { headerH: 11, footerH: 7, topContentY: 14, bottomPad: 9 }
      : { headerH: 13, footerH: 8, topContentY: 17, bottomPad: 11 };

    const produtosMap = { ...produtosMapFromPayload };

    // ── Criação do documento ─────────────────────────────────────────────────
    const MOBILE_W = 100; // mm — largura estilo smartphone
    // Mobile: página alta (uma coluna “infinita”) para rolar no leitor PDF com menos quebras abruptas
    const MOBILE_PAGE_H = 1200;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: isMobile ? [MOBILE_W, MOBILE_PAGE_H] : 'a4',
    });
    const usarNoto = isEnxuta ? false : await registerPdfFonts(doc);
    const pdfFontFamily = isEnxuta
      ? await registerJsPdfDin1451Fonts(doc)
      : (usarNoto ? 'NotoSans' : 'helvetica');
    patchPdfTextVerticalStretch(doc, (isEnxuta || isMobileClaro) ? 1 : PDF_GLYPH_STRETCH_Y);

    /** Enxuto: DIN 1451, mind map vertical, traços finos uniformes. */
    const ENXUTO_LINE_W = 0.12;
    const ENXUTO = {
      black: [0, 0, 0],
      muted: [72, 72, 72],
      line: [110, 110, 110],
      section: [236, 236, 236],
    };
    /** Recuos do mind map enxuto: 1 embarque → 2 pedido → 3 produtos. */
    const ENXUTO_INDENT = {
      embarque: 0,
      pedidoLine: 5,
      pedido: 7.5,
      produto: 14,
    };
    /** Tipografia enxuta — corpo bem legível (DIN 1451 com tamanhos maiores). */
    const ENXUTO_FONT = {
      kpi: 9.5,
      kpiHighlightLabel: 8.2,
      kpiHighlightValue: 14.5,
      grupo: 10.5,
      grupoMeta: 8.5,
      pedidoCodigo: 9,
      pedidoForn: 12,
      pedidoTotal: 12,
      pedidoMeta: 8.8,
      colHdr: 8.5,
      nome: 10,
      footer: 8.5,
      warn: 7,
    };
    const strokeEnxutoLine = (x0, y0, x1, y1, color = ENXUTO.line) => {
      doc.setDrawColor(...color);
      doc.setLineWidth(ENXUTO_LINE_W);
      doc.line(x0, y0, x1, y1);
    };
    const strokeEnxutoBlackLine = (x0, y0, x1, y1) => strokeEnxutoLine(x0, y0, x1, y1, ENXUTO.black);
    /** Linha vertical enxuta respeitando quebras de página (evita traço “doido”). */
    const drawEnxutoVerticalSpan = (x, yStart, yEnd, startPage, endPage) => {
      const topPad = 14;
      const bottomPad = 10;
      const pageH = doc.internal.pageSize.getHeight();
      const savedPage = doc.internal.getNumberOfPages();
      for (let page = startPage; page <= endPage; page += 1) {
        doc.setPage(page);
        const segTop = page === startPage ? yStart : topPad;
        const segBottom = page === endPage ? yEnd : pageH - bottomPad;
        if (segBottom > segTop + 0.5) {
          strokeEnxutoBlackLine(x, segTop, x, segBottom);
        }
      }
      doc.setPage(savedPage);
    };

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    let M = isMobile ? 5 : 9;           // margem página (reduz faixa lateral)
    let TM = isMobile ? 5 : 11;        // inset da tabela de itens (mais largura útil)
    let CW = pageW - M * 2;             // content width
    let TW = pageW - TM * 2;            // table width
    const syncLayoutWidths = () => {
      CW = pageW - M * 2;
      TW = pageW - TM * 2;
    };

    const C = {
      text:      [31,  41,  55],
      muted:     [107, 114, 128],
      mutedLight:[156, 163, 175],
      panel:     [248, 250, 252],
      soft:      [243, 244, 246],
      rowAlt:    [249, 250, 251],
      dark:      [17,  24,  39],
      white:     [255, 255, 255],
      teal:      [45,  212, 191],
      tealDark:  [15,  118, 110],
    };

    /** Paleta alto contraste para PDF mobile — tinta preta, leitura nítida no celular. */
    const MOBILE_INK = {
      black: [0, 0, 0],
      body:  [18, 18, 18],
      meta:  [58, 58, 58],
      line:  [185, 185, 185],
      track: [228, 228, 228],
    };

    let y = includeAnexos ? RELATORIO_COMPLETO_CHROME.topContentY : 16;

    const getBottomPad = () => {
      if (includeAnexos) return RELATORIO_COMPLETO_CHROME.bottomPad;
      return isMobile ? 4 : 10;
    };
    const getNewPageY = () => {
      if (includeAnexos) return RELATORIO_COMPLETO_CHROME.topContentY;
      return 14;
    };

    const ensureSpace = (needed = 24) => {
      if (y + needed > pageH - getBottomPad()) {
        doc.addPage();
        y = getNewPageY();
      }
    };

    const scaledHeight = (value) => value * TEXT_VERTICAL_SCALE;

    /** Barra de status (1–5 segmentos) — reutiliza desktop e mobile. */
    const drawProgressBar = (status, barY) => {
      const level = getStatusProgress(status);
      const totalSegs = 5;
      const segW = (CW - (totalSegs - 1) * 1) / totalSegs;
      const sc = getStatusColors(status);
      for (let s = 0; s < totalSegs; s++) {
        const sx = M + s * (segW + 1);
        doc.setFillColor(...(s < level ? sc.dot : [220, 225, 230]));
        doc.roundedRect(sx, barY, segW, 1.5, 0.75, 0.75, 'F');
      }
    };

    /** Barra de status mobile claro — preto sólido vs trilho cinza claro. */
    const drawProgressBarMobileClaro = (status, barY) => {
      const level = getStatusProgress(status);
      const totalSegs = 5;
      const segW = (CW - (totalSegs - 1) * 0.8) / totalSegs;
      for (let s = 0; s < totalSegs; s++) {
        const sx = M + s * (segW + 0.8);
        doc.setFillColor(...(s < level ? MOBILE_INK.black : MOBILE_INK.track));
        doc.rect(sx, barY, segW, 1.1, 'F');
      }
    };

    /** Barras de progresso no card A4 (segmentos mais largos, estilo mobile). */
    const drawProgressBarCard = (status, barY) => {
      const level = getStatusProgress(status);
      const totalSegs = 5;
      const padX = 3;
      const barW = CW - padX * 2;
      const segGap = 1.3;
      const segW = (barW - (totalSegs - 1) * segGap) / totalSegs;
      const barH = 2.8;
      const sc = getStatusColors(status);
      for (let s = 0; s < totalSegs; s++) {
        const sx = M + padX + s * (segW + segGap);
        doc.setFillColor(...(s < level ? sc.dot : [226, 232, 240]));
        doc.roundedRect(sx, barY, segW, barH, 1.2, 1.2, 'F');
      }
    };

    /** Títulos das colunas de valores (sem DESCRICAO, sem negrito, alinhados à 2ª linha do item). */
    const drawWideValueColumnHeaders = (
      baselineY,
      opts: { fontSize?: number; tableX?: number; mutedColor?: number[] } = {},
    ) => {
      const {
        fontSize = EXPANDED_ITEMS_TABLE_FONT_SIZE,
        tableX = TM,
        mutedColor = SLATE500,
      } = opts;
      const cols = EXPANDED_ITEMS_TABLE_COLUMNS;
      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(fontSize);
      doc.setTextColor(...mutedColor);
      doc.text('QTD', tableX + cols.qtd, baselineY);
      doc.text('UN', tableX + cols.unidade, baselineY);
      doc.text('VLR. UN.', tableX + cols.vlrUnit, baselineY, { align: 'right' });
      doc.text('FRETE', tableX + cols.frete, baselineY, { align: 'right' });
      doc.text('OUTROS', tableX + cols.outros, baselineY, { align: 'right' });
      doc.text('CUSTO', tableX + cols.custo, baselineY, { align: 'right' });
      doc.text('TOTAL', tableX + cols.total, baselineY, { align: 'right' });
      doc.text('VENDA', tableX + cols.venda, baselineY, { align: 'right' });
      doc.text('MARKUP', tableX + cols.markup, baselineY, { align: 'right' });
    };

    const usesColumnValueLayout = (layout) => layout === 'wide' || layout === 'narrow_enxuto';
    const columnTableX = (cfg) => cfg.tableX ?? TM;

    // ════════════════════════════════════════════════════════════════════════
    //  HEADER
    // ════════════════════════════════════════════════════════════════════════
    const drawHeader = () => {
      if (isEnxuta) {
        doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
        doc.setFontSize(13);
        doc.setTextColor(...ENXUTO.black);
        doc.text(
          includeAnexos ? 'Relatorio COMPLETO de embarques' : 'Relatorio de embarques — ENXUTO',
          M,
          y,
        );
        y += 5.5;
        doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
        doc.setFontSize(8);
        doc.setTextColor(...ENXUTO.muted);
        doc.text(
          includeAnexos
            ? 'Minuta enxuta + comprovantes embutidos por pedido'
            : 'A4 compacto   mind map vertical   DIN 1451',
          M,
          y,
        );
        y += 4.5;
        const filtrosLinhas = doc.splitTextToSize(safe(filtros_desc || '-'), CW);
        doc.setFontSize(8.8);
        doc.text(filtrosLinhas[0] || '-', M, y);
        y += 4.5;
        doc.setFontSize(8.2);
        doc.text(`Gerado em ${generatedAtStr}`, M, y);
        y += 7;
        return;
      }

      if (isMobileClassico) {
        let hy = 12;
        doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
        doc.setFontSize(12);
        doc.setTextColor(...C.text);
        doc.text('Embarques', M, hy);
        hy += 5;

        doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
        doc.setFontSize(6.5);
        doc.setTextColor(...C.muted);
        doc.text('Relatorio para celular (classico)', M, hy);
        hy += 4.2;

        const filtrosLinhas = doc.splitTextToSize(safe(filtros_desc || '-'), CW);
        const maxFiltroLinhas = Math.min(3, filtrosLinhas.length);
        for (let fi = 0; fi < maxFiltroLinhas; fi++) {
          doc.text(filtrosLinhas[fi], M, hy);
          hy += 3.9;
        }
        hy += 1;
        doc.setFontSize(6.2);
        doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, M, hy);
        hy += 4.5;

        doc.setFillColor(...C.soft);
        doc.rect(M, hy, CW, 0.5, 'F');
        hy += 2.5;
        y = hy;
        return;
      }

      if (isMobileClaro) {
        let hy = includeAnexos ? RELATORIO_COMPLETO_CHROME.topContentY + 1 : 12;
        doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
        doc.setFontSize(includeAnexos ? 10 : 11);
        doc.setTextColor(...MOBILE_INK.black);
        doc.text(includeAnexos ? 'Embarques (completo)' : 'Embarques', M, hy);
        hy += includeAnexos ? 3.8 : 4.2;

        doc.setFontSize(6.8);
        doc.setTextColor(...MOBILE_INK.meta);
        doc.text(
          includeAnexos
            ? 'Minuta mobile + comprovantes embutidos por pedido'
            : 'Relatorio para celular (leitura clara)',
          M,
          hy,
        );
        hy += 3.8;

        const filtrosLinhas = doc.splitTextToSize(safe(filtros_desc || '-'), CW);
        const maxFiltroLinhas = Math.min(includeAnexos ? 4 : 3, filtrosLinhas.length);
        doc.setFontSize(6.6);
        doc.setTextColor(...MOBILE_INK.body);
        for (let fi = 0; fi < maxFiltroLinhas; fi++) {
          doc.text(filtrosLinhas[fi], M, hy);
          hy += 3.4;
        }
        hy += 0.5;
        doc.setFontSize(6.2);
        doc.setTextColor(...MOBILE_INK.meta);
        doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, M, hy);
        hy += 4;

        doc.setDrawColor(...MOBILE_INK.black);
        doc.setLineWidth(0.2);
        doc.line(M, hy, M + CW, hy);
        hy += 3;
        y = hy;
        return;
      }

      // Desktop header
      doc.setFillColor(...C.panel);
      doc.roundedRect(M, y, CW, 26, 4, 4, 'F');
      doc.setFillColor(...C.teal);
      doc.roundedRect(M + 5, y + 5, 2.4, 10, 1.2, 1.2, 'F');
      doc.setTextColor(...C.text);
      doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
      doc.setFontSize(16);
      const titulo = includeAnexos
        ? 'Relatorio COMPLETO de embarques'
        : layoutVersion === 'expandida_mobile'
          ? 'Relatorio mobile de embarques'
          : layoutVersion === 'expandida_enxuta'
            ? 'Relatorio ENXUTO de embarques'
            : 'Relatorio EXPANDIDO de embarques';
      doc.text(safe(titulo), M + 11, y + 9);
      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(8);
      doc.setTextColor(...C.muted);
      const subtitulo = layoutVersion === 'expandida'
        ? includeAnexos
          ? 'A4 completo · minuta do pedido + comprovantes e anexos embutidos'
          : 'A4 completo · tabela com colunas QTD, UN, VLR, FRETE, CUSTO, VENDA, MARKUP'
        : '';
      if (subtitulo) {
        doc.text(safe(subtitulo), M + 11, y + 14);
        doc.text(safe(filtros_desc), M + 11, y + 19);
        doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, M + 11, y + 24);
        y += 32;
        return;
      }
      doc.setFontSize(9);
      doc.setTextColor(...C.muted);
      doc.text(safe(filtros_desc), M + 11, y + 15);
      doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, M + 11, y + 21);
      y += 32;
    };

    const getPedidosNoRelatorio = () => {
      if (Array.isArray(grupos) && grupos.length > 0) {
        return grupos.flatMap((grupo) => grupo.pedidos || []);
      }
      return pedidos;
    };

    const getResumoPedidosListados = () => {
      const pedidosListados = getPedidosNoRelatorio();
      const quantidade = pedidosListados.length;
      const soma = pedidosListados.reduce(
        (acc, pedido) => acc + getValorRelatorio(pedido, produtosMap),
        0,
      );
      return { quantidade, soma };
    };

    // ════════════════════════════════════════════════════════════════════════
    //  KPIs
    // ════════════════════════════════════════════════════════════════════════
    const drawKpis = () => {
      const cards = [
        { label: 'Pedidos na lista', value: String(kpis.totalPedidos || pedidos.length || 0) },
        { label: 'Total pendente',   value: moeda(kpis.totalGeral || 0) },
        { label: 'Em aberto',        value: moeda(kpis.totalEmAberto || 0) },
        { label: 'Pago / nao entregue', value: moeda(kpis.totalPagoNaoEntregue || 0) },
      ];

      if (isEnxuta) {
        const { quantidade, soma } = getResumoPedidosListados();
        const boxH = 20;
        const boxPadX = 5;
        const colW = (CW - boxPadX * 2) / 2;
        ensureSpace(boxH + 6);
        const boxY = y;

        doc.setFillColor(...ENXUTO.section);
        doc.roundedRect(M, boxY, CW, boxH, 2.5, 2.5, 'F');
        doc.setDrawColor(...ENXUTO.black);
        doc.setLineWidth(ENXUTO_LINE_W);
        doc.roundedRect(M, boxY, CW, boxH, 2.5, 2.5, 'S');

        const labelY = boxY + 6.2;
        const valueY = boxY + 14.5;
        const leftX = M + boxPadX;
        const rightX = M + boxPadX + colW;

        doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
        doc.setFontSize(ENXUTO_FONT.kpiHighlightLabel);
        doc.setTextColor(...ENXUTO.muted);
        doc.text('Pedidos listados', leftX, labelY);
        doc.text('Total', rightX, labelY);

        doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
        doc.setFontSize(ENXUTO_FONT.kpiHighlightValue);
        doc.setTextColor(...ENXUTO.black);
        doc.text(String(quantidade), leftX, valueY);
        doc.text(moeda(soma), M + CW - boxPadX, valueY, { align: 'right' });

        y = boxY + boxH + 6;
        return;
      }

      if (isMobileClassico) {
        const colW = (CW - 3) / 2;
        const cardH = 14.5;
        for (let i = 0; i < cards.length; i += 2) {
          ensureSpace(18);
          [0, 1].forEach((col) => {
            const card = cards[i + col];
            if (!card) return;
            const cx = M + col * (colW + 3);
            doc.setFillColor(...C.soft);
            doc.roundedRect(cx, y, colW, cardH, 2, 2, 'F');
            doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
            doc.setFontSize(6);
            doc.setTextColor(...C.muted);
            doc.text(safe(card.label), cx + 3, y + 5);
            doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
            doc.setFontSize(8.5);
            doc.setTextColor(...C.dark);
            doc.text(safe(String(card.value)), cx + 3, y + 11.5);
          });
          y += 16.5;
        }
        y += 2;
        return;
      }

      if (isMobileClaro) {
        ensureSpace(16);
        doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
        doc.setFontSize(6.5);
        doc.setTextColor(...MOBILE_INK.black);
        doc.text(`Pedidos: ${kpis.totalPedidos || pedidos.length || 0}`, M, y);
        y += 3.6;
        doc.text(`Pendente: ${moeda(kpis.totalGeral || 0)}`, M, y);
        doc.text(`Em aberto: ${moeda(kpis.totalEmAberto || 0)}`, M + 48, y);
        y += 3.6;
        doc.text(`Pago/nao entregue: ${moeda(kpis.totalPagoNaoEntregue || 0)}`, M, y);
        y += 4;
        doc.setDrawColor(...MOBILE_INK.line);
        doc.setLineWidth(0.15);
        doc.line(M, y, M + CW, y);
        y += 4;
        return;
      }

      const gap = 4;
      const cw = (CW - gap * 3) / 4;
      cards.forEach((card, i) => {
        const x = M + (cw + gap) * i;
        doc.setFillColor(250, 250, 250);
        doc.roundedRect(x, y, cw, 18, 3, 3, 'F');
        doc.setFontSize(8);
        doc.setTextColor(...C.muted);
        doc.text(card.label, x + 4, y + 6);
        doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
        doc.setFontSize(10);
        doc.setTextColor(...C.dark);
        doc.text(safe(String(card.value)), x + 4, y + 13);
        doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      });
      y += 24;
    };

    // ════════════════════════════════════════════════════════════════════════
    //  GROUP SUMMARY (desktop only)
    // ════════════════════════════════════════════════════════════════════════
    const drawGroupSummary = () => {
      if (isMobile || isEnxuta || !Array.isArray(grupos) || grupos.length === 0) return;
      ensureSpace(20);
      doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
      doc.setFontSize(9);
      doc.setTextColor(...C.muted);
      doc.text('Agrupamento aplicado na tela', M, y);
      y += 5;
      grupos.forEach((grupo, idx) => {
        const total = (grupo.pedidos || []).reduce((a, p) => a + getValorRelatorio(p, produtosMap), 0);
        ensureSpace(8);
        if (idx % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.roundedRect(M, y - 1.5, CW, 6.5, 2, 2, 'F');
        }
        doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
        doc.setFontSize(7.5);
        doc.setTextColor(...C.text);
        doc.text(safe(grupo.label || '-'), M + 3, y + 2.5);
        doc.text(`${(grupo.pedidos || []).length} pedidos`, M + 122, y + 2.5);
        doc.text(moeda(total), M + CW - 3, y + 2.5, { align: 'right' });
        y += 7;
      });
    };

    // ════════════════════════════════════════════════════════════════════════
    //  DESKTOP: header compacto do pedido
    // ════════════════════════════════════════════════════════════════════════
    const drawPedidoHeaderCompacto = (pedido) => {
      ensureSpace(30);
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(M, y, CW, 22, 3, 3, 'F');
      doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
      doc.setFontSize(11);
      doc.setTextColor(...C.dark);
      doc.text(getPedidoNumeroRelatorio(pedido), M + 5, y + 7);
      doc.setFontSize(9.5);
      doc.text(getFornecedorRelatorio(pedido), M + 40, y + 7);
      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(8.5);
      doc.setTextColor(...C.muted);
      doc.text(`Data: ${dataFmt(getDataRelatorio(pedido))}`, M + 5, y + 13);
      doc.text(`ETA: ${dataFmt(getEtaRelatorio(pedido))}`, M + 58, y + 13);
      doc.text(`Status: ${normalizarStatusRelatorio(pedido._display_status || pedido.status)}`, M + 105, y + 13);
      doc.text(`Total: ${moeda(getValorRelatorio(pedido, produtosMap))}`, M + 155, y + 13);
      y += 26;
    };

    // ════════════════════════════════════════════════════════════════════════
    //  DESKTOP: header expandido do pedido
    // ════════════════════════════════════════════════════════════════════════
    const drawPedidoHeaderExpandido = (pedido) => {
      ensureSpace(34);
      const sc = getStatusColors(normalizarStatusRelatorio(pedido._display_status || pedido.status));
      doc.setFillColor(...C.panel);
      doc.roundedRect(M, y, CW, 28, 4, 4, 'F');
      doc.setFillColor(...sc.dot);
      doc.circle(M + 5, y + 6.5, 1.3, 'F');
      doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
      doc.setFontSize(11);
      doc.setTextColor(...C.text);
      doc.text(getPedidoNumeroRelatorio(pedido), M + 9, y + 8);
      doc.setFontSize(9.5);
      doc.text(getFornecedorRelatorio(pedido), M + 9, y + 14);
      doc.setFillColor(...sc.pillBg);
      doc.roundedRect(M + 9, y + 17, 33, 6.2, 3, 3, 'F');
      doc.setFontSize(7.1);
      doc.setTextColor(...sc.pillText);
      doc.text(safe(normalizarStatusRelatorio(pedido._display_status || pedido.status)), M + 12, y + 21.2);
      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(7.5);
      doc.setTextColor(...C.muted);
      doc.text(`Data ${dataFmt(getDataRelatorio(pedido))}`, M + 48, y + 20);
      doc.text(`ETA ${dataFmt(getEtaRelatorio(pedido))}`, M + 92, y + 20);
      doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
      doc.setFontSize(10);
      doc.setTextColor(...C.text);
      doc.text(moeda(getValorRelatorio(pedido, produtosMap)), M + CW - 4, y + 10, { align: 'right' });
      const totalLinhas = (pedido._display_itens || pedido.itens || []).length;
      const totalQtd = getQuantidadeRelatorio(pedido);
      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(7.5);
      doc.setTextColor(...C.muted);
      doc.text(`${totalLinhas} itens - ${fmtQuantidadePdf(totalQtd)} un.`, M + CW - 4, y + 16, { align: 'right' });
      y += 32;
    };

    // ════════════════════════════════════════════════════════════════════════
    //  DESKTOP: layout compacto
    // ════════════════════════════════════════════════════════════════════════
    const drawCompacto = (pedido) => {
      const isPendencia = (pedido.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'Pendencia';
      const itensTela = getItensRelatorio(pedido);
      const pedidoParaHeader = {
        ...pedido,
        valor_total: getValorRelatorio(pedido, produtosMap)
      };
      drawPedidoHeaderCompacto(pedidoParaHeader);
      const embarque = pedido._embarque || null;
      const itensEfetivos = itensTela;
      doc.setFontSize(8);
      doc.setTextColor(...C.muted);
      doc.text(`Transportadora: ${safe(getTransportadoraRelatorio(pedido))}`, M + 2, y);
      doc.text(`ETA: ${safe(dataFmt(getEtaRelatorio(pedido)))}`, M + 78, y);
      doc.text(`${getOrdinalRelatorio(pedido)} · ${itensEfetivos.length} itens${isPendencia ? ' pend.' : ''}`, M + 134, y);
      y += 5;
      y = addWrappedText(doc, pedido.observacoes || pedido.historico || '-', M + 2, y, CW - 4, 4) + 4;
    };

    // ════════════════════════════════════════════════════════════════════════
    //  Itens — layout limpo partilhado (expandido A4 + mobile)
    // ════════════════════════════════════════════════════════════════════════
    const SLATE900 = [15, 23, 42];
    const SLATE700 = [51, 65, 85];
    const SLATE500 = [100, 116, 139];

    const getCleanItemLayout = (layout) => {
      if (layout === 'wide') {
        const itemMl = TM + 14;
        const nomeMaxW = Math.max(
          18,
          TM + EXPANDED_ITEMS_TABLE_COLUMNS.vlrUnit - itemMl - EXPANDED_DESC_TO_VLR_GAP_MM,
        );
        return {
          layout: 'wide',
          itemMl,
          nomeMaxW,
          cols: EXPANDED_ITEMS_TABLE_COLUMNS,
          lineX: TM + 11.5,
          qtdColRight: TM + 10.5,
          contentRight: TM + TW,
          sepLineX0: M + 3,
          sepLineX1: M + CW - 3,
          vs: 1.12,
          fontScale: 1,
          lineWidth: 2.5,
          useZebra: false,
          nomeFontSize: EXPANDED_A4_DESC_HEADER_FONT_SIZE,
          valuesFontSize: EXPANDED_A4_BODY_VALUES_FONT_SIZE,
          qtdFontSize: 7.4,
          unFontSize: 6.35,
        };
      }
      if (layout === 'narrow_enxuto') {
        const tableX = M + ENXUTO_INDENT.produto;
        const cols = EXPANDED_ITEMS_TABLE_COLUMNS;
        const itemMl = tableX + 14;
        const nomeMaxW = Math.max(
          18,
          tableX + cols.vlrUnit - itemMl - EXPANDED_DESC_TO_VLR_GAP_MM,
        );
        return {
          layout: 'narrow_enxuto',
          tableX,
          itemMl,
          nomeMaxW,
          cols,
          lineX: tableX + 11.5,
          qtdColRight: tableX + 10.5,
          contentRight: M + CW,
          vs: 1.12,
          fontScale: 1,
          branchLen: 2.4,
          nomeFontSize: ENXUTO_FONT.nome,
          valuesFontSize: ENXUTO_FONT.nome,
          qtdFontSize: ENXUTO_FONT.nome,
          unFontSize: ENXUTO_FONT.nome,
          valuesInlineWithNome: true,
          ink: true,
        };
      }
      if (layout === 'narrow_claro') {
        const itemMl = M + 13.2;
        const lineX = M + 11.2;
        const qtdColRight = M + 10.2;
        return {
          layout: 'narrow_claro',
          itemMl,
          lineX,
          qtdColRight,
          nomeMaxW: M + CW - itemMl - 2,
          contentRight: M + CW,
          vs: includeAnexos ? 1.22 : 1.18,
          fontScale: 1,
          lineWidth: 1.8,
          nomeFontSize: includeAnexos ? 7.8 : 7.4,
          detailFontSize: includeAnexos ? 6.5 : 6.1,
          qtdFontSize: includeAnexos ? 7.2 : 6.9,
          unFontSize: includeAnexos ? 6 : 5.75,
          ink: true,
        };
      }
      const itemMl = M + 14.8;
      const lineX = M + 12.5;
      const qtdColRight = M + 11.5;
      return {
        layout: 'narrow',
        itemMl,
        lineX,
        qtdColRight,
        nomeMaxW: M + CW - itemMl - 3,
        contentRight: M + CW,
        vs: isEnxuta ? 1.18 : 1.35,
        fontScale: 1.05,
        lineWidth: 2.5,
        useZebra: false,
        zebraX: M,
        zebraW: CW,
      };
    };

    const buildExpandedItemDetailText = (layout, item, prod, met) => {
      const un = met.un;
      const fatorItem = Number(item.fator_conversao) || 1;
      const qBase =
        item.quantidade_base != null && item.quantidade_base !== ''
          ? Number(item.quantidade_base)
          : (Number(met.qtd) || 0) * fatorItem;
      const upPrincipal = prod.unidade_principal || '';
      let equivSuf = '';
      if (
        upPrincipal &&
        (fatorItem !== 1 || String(un).toUpperCase() !== String(upPrincipal).toUpperCase())
      ) {
        equivSuf = ` · Equiv. ${fmtQuantidadePdf(qBase)} ${upPrincipal} (base)`;
      }
      if (layout === 'wide') {
        return {
          linha1: `Total ${moedaOuTraco(met.totalLinha)} · Comp. ${moedaOuTraco(met.vlrUnit)} · Frete ${moedaOuTraco(met.freteUnit)} · Outros ${moedaOuTraco(met.outrosUnit)} · Custo ${moedaOuTraco(met.custoUnit)}${equivSuf}`,
          linha2: `Venda ${moedaOuTraco(met.vendaUnit)} · Mk ${percentualOuTraco(met.markup)}`,
          warning: met.warningText || '',
        };
      }
      if (layout === 'narrow_enxuto') {
        const equivEnx = equivSuf ? `  Equiv. ${fmtQuantidadePdf(qBase)} ${upPrincipal} (base)` : '';
        return {
          linha1: `Total ${moedaOuTraco(met.totalLinha)}   ${un}   Comp. ${moedaOuTraco(met.vlrUnit)}   Custo ${moedaOuTraco(met.custoUnit)}${equivEnx}`,
          linha2: `Venda ${moedaOuTraco(met.vendaUnit)}   Mk ${percentualOuTraco(met.markup)}`,
          warning: met.warningText || '',
        };
      }
      return {
        linha1: `Total ${moedaOuTraco(met.totalLinha)} · ${un} · Comp. ${moedaOuTraco(met.vlrUnit)} · Custo ${moedaOuTraco(met.custoUnit)}${equivSuf}`,
        linha2: `Venda ${moedaOuTraco(met.vendaUnit)} · Mk ${percentualOuTraco(met.markup)}`,
        warning: met.warningText || '',
      };
    };

    const measureExpandedItemRow = (pedido, item, layout, y0 = 0) => {
      const cfg = getCleanItemLayout(layout);
      const prod = produtosMap[item.produto_id] || {};
      const met = resolveMetricasItemPdf(item, prod, pedido);
      const vs = cfg.vs;
      const nomeLineStep = 3.85 * vs;
      const margemLinhaInferiorItem = (usesColumnValueLayout(layout) ? 1.2 : 1.3) * vs;

      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      const nomeFsMeasure = usesColumnValueLayout(layout) ? cfg.nomeFontSize : (cfg.nomeFontSize ?? 7);
      doc.setFontSize(nomeFsMeasure * cfg.fontScale);
      const nomeMaxW = cfg.nomeMaxW;
      const nomeX = cfg.itemMl;
      const nomeLinhas = doc.splitTextToSize(
        toTitleCase(safe(item.produto_nome || prod.nome || '-')),
        nomeMaxW,
      );
      const nomeTop = y0 + 3.4 * vs;
      const lastNomeBaseline = nomeTop + Math.max(0, nomeLinhas.length - 1) * nomeLineStep;

      if (usesColumnValueLayout(layout)) {
        const inlineValues = layout === 'narrow_enxuto' || !!cfg.valuesInlineWithNome;
        const gapNomeValores = inlineValues ? 0 : 2.65 * vs;
        const valoresY = inlineValues ? nomeTop : lastNomeBaseline + gapNomeValores;
        const valoresRowH = 4.5 * vs;
        let detEnd;
        if (inlineValues) {
          const qtdUnBottom = nomeTop + 4.6 * vs + 0.8;
          const nomeBottom = lastNomeBaseline;
          detEnd = Math.max(qtdUnBottom, nomeBottom, valoresY + valoresRowH * 0.9);
          if (met.warningText) {
            doc.setFontSize((cfg.warnFontSize ?? 5.5) * cfg.fontScale);
            const warnLinhas = doc.splitTextToSize(met.warningText, cfg.nomeMaxW);
            detEnd = Math.max(detEnd, nomeBottom + 1.2 * vs + warnLinhas.length * 2.8 * vs);
          }
        } else {
          detEnd = valoresY + valoresRowH;
          if (met.warningText) {
            doc.setFontSize(5.5 * cfg.fontScale);
            const warnLinhas = doc.splitTextToSize(met.warningText, cfg.nomeMaxW);
            detEnd = valoresY + valoresRowH + 1.2 * vs + warnLinhas.length * 2.8 * vs;
          }
        }
        const margemWide = 1.2 * vs;
        return {
          rowBlockH: detEnd + margemWide - y0,
          met,
          nomeLinhas,
          nomeX: cfg.itemMl,
          cfg,
          vs,
          nomeLineStep,
          nomeTop,
          valoresY,
          margemLinhaInferiorItem,
        };
      }

      const det = buildExpandedItemDetailText(layout, item, prod, met);
      const auxDetailStep = (layout === 'narrow_enxuto' ? 3.15 : 2.85) * vs;
      const gapNomeDetalhe = (layout === 'narrow_enxuto' ? 2.6 : 2.2) * vs;
      doc.setFontSize((cfg.detailFontSize ?? 5.65) * cfg.fontScale);
      const auxValoresLinhas = doc.splitTextToSize(det.linha1, cfg.nomeMaxW);
      const detAux1 = lastNomeBaseline + gapNomeDetalhe;
      const detAux2 = detAux1 + auxValoresLinhas.length * auxDetailStep;
      let detEnd = detAux2 + auxDetailStep;
      if (det.warning) {
        const warnLinhas = doc.splitTextToSize(det.warning, cfg.nomeMaxW);
        detEnd = detAux2 + auxDetailStep + warnLinhas.length * auxDetailStep;
      }
      return {
        rowBlockH: detEnd + margemLinhaInferiorItem - y0,
        met,
        nomeLinhas,
        nomeX: cfg.itemMl,
        auxValoresLinhas,
        det,
        cfg,
        vs,
        nomeLineStep,
        auxDetailStep,
        gapNomeDetalhe,
        margemLinhaInferiorItem,
        nomeTop,
      };
    };

    const drawExpandedItemRowClean = (pedido, item, layout, y0, idx = 0) => {
      const measured = measureExpandedItemRow(pedido, item, layout, y0);
      const { rowBlockH, met, nomeLinhas, cfg, vs, nomeLineStep, nomeTop } = measured;
      const nomeX = measured.nomeX ?? cfg.itemMl;
      const branchY = y0 + 2.8 * vs;
      const isEnxutoRow = layout === 'narrow_enxuto';
      const ink = !!cfg.ink;
      const inkBlack = isEnxutoRow ? ENXUTO.black : (ink ? MOBILE_INK.black : SLATE900);
      const inkBody = isEnxutoRow ? ENXUTO.black : (ink ? MOBILE_INK.body : SLATE700);
      const inkMeta = isEnxutoRow ? ENXUTO.muted : (ink ? MOBILE_INK.meta : SLATE500);

      if (isEnxutoRow) {
        strokeEnxutoLine(cfg.lineX, y0, cfg.lineX, y0 + rowBlockH);
        strokeEnxutoLine(cfg.lineX, branchY, cfg.lineX + (cfg.branchLen ?? 2.4), branchY);
      } else {
        const inkLine = ink ? MOBILE_INK.line : [203, 213, 225];
        doc.setFillColor(...inkLine);
        doc.rect(cfg.lineX, y0, 0.1, rowBlockH, 'F');
        doc.rect(cfg.lineX, branchY, cfg.lineWidth, 0.1, 'F');
      }

      const qtdFs = usesColumnValueLayout(layout)
        ? (cfg.qtdFontSize ?? 6.8)
        : (cfg.qtdFontSize ?? 6.8);
      const unFs = usesColumnValueLayout(layout) ? (cfg.unFontSize ?? 5.9) : (cfg.unFontSize ?? 5.9);
      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(qtdFs * cfg.fontScale);
      doc.setTextColor(...(isEnxutoRow ? inkBody : inkBlack));
      const qtdYOff = 1.2;
      const unYOff = usesColumnValueLayout(layout) ? 4.6 : 4.6;
      doc.text(fmtQuantidadePdf(Number(met.qtd) || 0), cfg.qtdColRight, nomeTop + qtdYOff, { align: 'right' });
      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(unFs * cfg.fontScale);
      doc.setTextColor(...(isEnxutoRow ? inkBody : inkMeta));
      doc.text(met.un, cfg.qtdColRight, nomeTop + unYOff, { align: 'right' });

      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      const nomeFsDraw = usesColumnValueLayout(layout) ? cfg.nomeFontSize : (cfg.nomeFontSize ?? 7);
      doc.setFontSize(nomeFsDraw * cfg.fontScale);
      doc.setTextColor(...inkBody);
      nomeLinhas.forEach((line, li) => {
        doc.text(line, nomeX, nomeTop + li * nomeLineStep);
      });

      if (usesColumnValueLayout(layout)) {
        const valoresY = measured.valoresY;
        const cols = cfg.cols;
        const tx = columnTableX(cfg);
        const valuesColor = isEnxutoRow ? inkBody : SLATE500;
        doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
        doc.setFontSize(cfg.valuesFontSize * cfg.fontScale);
        doc.setTextColor(...valuesColor);
        doc.text(moedaSemSimboloOuTraco(met.vlrUnit), tx + cols.vlrUnit, valoresY, { align: 'right' });
        doc.text(moedaSemSimboloOuTraco(met.freteUnit), tx + cols.frete, valoresY, { align: 'right' });
        doc.text(moedaSemSimboloOuTraco(met.outrosUnit), tx + cols.outros, valoresY, { align: 'right' });
        doc.text(moedaSemSimboloOuTraco(met.custoUnit), tx + cols.custo, valoresY, { align: 'right' });
        doc.text(moedaSemSimboloOuTraco(met.totalLinha), tx + cols.total, valoresY, { align: 'right' });
        doc.text(moedaSemSimboloOuTraco(met.vendaUnit), tx + cols.venda, valoresY, { align: 'right' });
        doc.text(percentualOuTraco(met.markup), tx + cols.markup, valoresY, { align: 'right' });
        if (met.warningText) {
          const lastNomeBaseline = nomeTop + Math.max(0, nomeLinhas.length - 1) * nomeLineStep;
          const warnBaseY = isEnxutoRow
            ? lastNomeBaseline + 1.2 * vs
            : valoresY + 3.2 * vs;
          doc.setFontSize((isEnxutoRow ? ENXUTO_FONT.warn : 5.5) * cfg.fontScale);
          doc.setTextColor(...(isEnxutoRow ? ENXUTO.muted : SLATE500));
          const warnLinhas = doc.splitTextToSize(met.warningText, cfg.nomeMaxW);
          warnLinhas.forEach((line, wi) => {
            doc.text(line, cfg.itemMl, warnBaseY + wi * 2.8 * vs);
          });
        }
      } else {
        const { auxValoresLinhas, det, auxDetailStep, gapNomeDetalhe } = measured;
        const lastNomeBaseline = nomeTop + Math.max(0, nomeLinhas.length - 1) * nomeLineStep;
        const detAux1 = lastNomeBaseline + gapNomeDetalhe;
        const detAux2 = detAux1 + auxValoresLinhas.length * auxDetailStep;
        doc.setFontSize((cfg.detailFontSize ?? 5.65) * cfg.fontScale);
        doc.setTextColor(...inkMeta);
        auxValoresLinhas.forEach((line, ai) => {
          doc.text(line, cfg.itemMl, detAux1 + ai * auxDetailStep);
        });
        doc.text(det.linha2, cfg.itemMl, detAux2);
        if (det.warning) {
          const warnLinhas = doc.splitTextToSize(det.warning, cfg.nomeMaxW);
          warnLinhas.forEach((line, wi) => {
            doc.text(line, cfg.itemMl, detAux2 + auxDetailStep + wi * auxDetailStep);
          });
        }
      }

      const sepX0 = usesColumnValueLayout(layout) ? (cfg.sepLineX0 ?? cfg.itemMl) : cfg.itemMl;
      const sepX1 = usesColumnValueLayout(layout) ? (cfg.sepLineX1 ?? cfg.contentRight) : cfg.contentRight;
      if (!isEnxutoRow) {
        doc.setDrawColor(...(ink ? MOBILE_INK.line : [226, 232, 240]));
        doc.setLineWidth(0.12);
        doc.line(sepX0, y0 + rowBlockH, sepX1, y0 + rowBlockH);
      }

      const qtd = Number(met.qtd) || 0;
      const totCustoAdd = qtd * (Number(met.custoUnit) || 0);
      const totVendaAdd = qtd * (Number(met.vendaUnit) || 0);
      return { rowBlockH, totCustoAdd, totVendaAdd };
    };

    const computeExpandedItemRowH = (pedido, item, layout, y0 = 0) =>
      measureExpandedItemRow(pedido, item, layout, y0).rowBlockH;

    const mapItensRelatorioComercial = (pedido) =>
      sortItensAlfabeticamente(getItensRelatorio(pedido), produtosMap).map((item) => {
        const prod = produtosMap[item.produto_id] || {};
        const fatorItem = Number(item.fator_conversao) || 1;
        const qtdCompra = Number(item.quantidade) || Number(item.quantidade_embarcada) || Number(item.quantidade_pedida) || 0;
        const qBase = Number(item.quantidade_base) > 0 ? Number(item.quantidade_base) : qtdCompra * fatorItem;
        const pdvPref = PDF_PDV_PREFERIDO(prod, item);
        const snap = { ...prod, unidade_show_ativa: true, unidade_apresentacao_default: pdvPref };
        const res = PDF_RESOLVE_COMMERCIAL_DISPLAY(snap, qBase, item.unidade_medida || prod.unidade_principal || 'UN');
        return {
          ...item,
          quantidade: res.quantidade,
          quantidade_embarcada: res.quantidade,
          quantidade_pedida: res.quantidade,
          unidade_medida: res.unidade,
          fator_conversao: res.fator_conversao,
          quantidade_base: qBase,
          _qtdEfetiva: res.quantidade,
          _qtdMostrada: res.quantidade,
        };
      });

    // ════════════════════════════════════════════════════════════════════════
    //  DESKTOP: layout expandido
    // ════════════════════════════════════════════════════════════════════════
    /**
     * Fórmula única (Expandido e Mobile):
     *   QTD     = quantidade do embarque (já em unidade comercial)
     *   UN      = sigla da unidade comercial
     *   VLR UN  = linha.custo_unitario (assumido fator-1) × fator_conversao
     *   FRETE   = custo_frete_padrao do catálogo × fator_conversao
     *   OUTROS  = (custo_imposto1_padrao + custo_imposto2_padrao + custo_outros_padrao) do catálogo × fator_conversao
     *   CUSTO   = VLR UN + FRETE + OUTROS
     *   TOTAL   = QTD × VLR UN
     *   VENDA   = preco_venda_padrao do catálogo × fator_conversao
     *   MARKUP  = (VENDA − CUSTO) / CUSTO × 100
     * Toda essa lógica está concentrada em `resolveMetricasItemPdf`.
     */
    const drawExpandido = (pedido) => {
      const isPendencia = (pedido.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'Pendencia';
      const statusRelatorio = normalizarStatusRelatorio(pedido._display_status || pedido.status);
      const sc = getStatusColors(statusRelatorio);
      const itens = mapItensRelatorioComercial(pedido);

      const valorHeader = isPendencia
        ? moeda(itens.reduce((a, i) => {
            const prod = produtosMap[i.produto_id] || {};
            const met = resolveMetricasItemPdf(i, prod, pedido);
            return a + met.totalLinha;
          }, 0))
        : moeda(getValorRelatorio(pedido, produtosMap));

      const totalQtdExp = itens.reduce((a, i) => a + (Number(i._qtdEfetiva) || 0), 0);
      const countLabel = isPendencia
        ? `${itens.length} item(ns) pendente(s)`
        : `${itens.length} item(ns) - ${fmtQuantidadePdf(totalQtdExp)} (un. comerc.)`;

      const t = EXPANDED_A4_TIGHT;
      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(7.2);
      const codigoLinhas = doc.splitTextToSize(safe(getPedidoNumeroRelatorio(pedido)), CW - 38).slice(0, 2);
      const codigoLineStep = 4.2;
      doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
      doc.setFontSize(10.5);
      const fornLines = doc.splitTextToSize(getFornecedorRelatorio(pedido), CW - 8).slice(0, 3);
      const metaTexto = `${dataFmt(getDataRelatorio(pedido))} · ETA ${dataFmt(getEtaRelatorio(pedido))} · ${getOrdinalRelatorio(pedido)} · ${countLabel}`;
      const metaLines = doc.splitTextToSize(metaTexto, CW - 8).slice(0, 2);

      const fornLineStep = 4.6;
      const fornBlock = fornLines.length * fornLineStep;
      const totalRowH = 6;
      const metaLineStep = 4;
      const metaBlock = metaLines.length * metaLineStep;
      const codeY0 = t.codeY0;
      const codeBlockH = codigoLinhas.length * codigoLineStep;
      const gapCodeForn = t.gapCodeForn;
      const headerCardH =
        codeY0 + codeBlockH + gapCodeForn + fornBlock + totalRowH + metaBlock
        + t.gapAfterMeta + t.progH + t.gapBeforeColHdr + t.colHdrBlockH + t.cardPadBottom;

      const minPrimeiroItemH = itens.length > 0 ? computeExpandedItemRowH(pedido, itens[0], 'wide', 0) : 0;
      ensureSpace(headerCardH + t.gapHeaderToItems + minPrimeiroItemH + 8);

      const cardTop = y;
      doc.setFillColor(...C.panel);
      doc.roundedRect(M, cardTop, CW, headerCardH, 3, 3, 'F');

      doc.setFillColor(...sc.dot);
      doc.circle(M + 5, cardTop + 7, 2.2, 'F');

      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(7.2);
      doc.setTextColor(...SLATE500);
      codigoLinhas.forEach((line, ci) => {
        doc.text(line, M + 11, cardTop + codeY0 + ci * codigoLineStep);
      });

      doc.setFillColor(...sc.pillBg);
      doc.roundedRect(M + CW - 34, cardTop + 3, 31, 8, 4, 4, 'F');
      doc.setFontSize(6.8);
      doc.setTextColor(...sc.pillText);
      doc.text(safe(statusRelatorio), M + CW - 18.5, cardTop + 8.2, { align: 'center' });

      let cy = cardTop + codeY0 + codeBlockH + gapCodeForn;
      doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
      doc.setFontSize(10.5);
      doc.setTextColor(...SLATE900);
      fornLines.forEach((line, fl) => {
        doc.text(line, M + 4, cy + fl * fornLineStep);
      });
      cy += fornBlock + t.gapAfterForn;

      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(6.8);
      doc.setTextColor(...SLATE500);
      doc.text('Total', M + 4, cy);
      doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
      doc.setFontSize(10.5);
      doc.setTextColor(...SLATE900);
      doc.text(valorHeader, M + CW - 4, cy, { align: 'right' });
      cy += totalRowH;

      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(6.8);
      doc.setTextColor(...SLATE500);
      metaLines.forEach((line, ml) => {
        doc.text(line, M + 4, cy + ml * metaLineStep);
      });
      cy += metaBlock + t.gapAfterMeta;

      drawProgressBarCard(statusRelatorio, cy);
      cy += t.progH + t.gapBeforeColHdr;
      drawWideValueColumnHeaders(cy + t.colHdrBaselineOffset);

      y = cardTop + headerCardH + t.gapHeaderToItems;

      let totCusto = 0;
      let totVenda = 0;
      itens.forEach((item) => {
        const bottomPadExp = 10;
        const maxRowFit = pageH - bottomPadExp - 14;
        let rowH = computeExpandedItemRowH(pedido, item, 'wide', y);
        for (;;) {
          if (y + rowH <= pageH - bottomPadExp) break;
          if (rowH > maxRowFit) break;
          doc.addPage();
          y = 14;
          rowH = computeExpandedItemRowH(pedido, item, 'wide', y);
        }
        const drawn = drawExpandedItemRowClean(pedido, item, 'wide', y, 0);
        totCusto += drawn.totCustoAdd;
        totVenda += drawn.totVendaAdd;
        y += drawn.rowBlockH;
      });

      ensureSpace(14);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.15);
      doc.line(M + 3, y + 0.5, M + CW - 3, y + 0.5);
      y += 4;
      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(7.5);
      doc.setTextColor(...SLATE700);
      doc.text(`Custo total (itens): ${moedaOuTraco(totCusto)}`, M + 4, y + 3);
      doc.text(`Valor de venda total (referência): ${moeda(totVenda)}`, M + 4, y + 8.5);
      y += EXPANDED_A4_TIGHT.footerBlockH + EXPANDED_A4_TIGHT.gapAfterCard;
    };

    // ════════════════════════════════════════════════════════════════════════
    //  MOBILE CLÁSSICO: cards com pills e cores (layout anterior)
    // ════════════════════════════════════════════════════════════════════════
    const drawMobileCardClassico = (pedido) => {
      const isPendencia = (pedido.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'Pendencia';
      const statusRelatorio = normalizarStatusRelatorio(pedido._display_status || pedido.status);
      const sc = getStatusColors(statusRelatorio);

      const itens = mapItensRelatorioComercial(pedido);

      const valorHeader = isPendencia
        ? moeda(itens.reduce((a, i) => {
            const prod = produtosMap[i.produto_id] || {};
            const met = resolveMetricasItemPdf(i, prod, pedido);
            return a + met.totalLinha;
          }, 0))
        : moeda(getValorRelatorio(pedido, produtosMap));

      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(6.5);
      const codigoLinhas = doc.splitTextToSize(safe(getPedidoNumeroRelatorio(pedido)), CW - 34).slice(0, 2);
      const codigoLineStep = 3.8;
      doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
      doc.setFontSize(9);
      const fornLines = doc.splitTextToSize(getFornecedorRelatorio(pedido), CW - 6).slice(0, 3);
      const countLabel = isNecessidadeRelatorio(pedido)
        ? `${itens.length} item(ns) pendente(s)`
        : `${itens.length} item(ns)`;
      const metaTexto = `${dataFmt(getDataRelatorio(pedido))} · ETA ${dataFmt(getEtaRelatorio(pedido))} · ${getOrdinalRelatorio(pedido)} · ${countLabel}`;
      const metaLines = doc.splitTextToSize(metaTexto, CW - 6).slice(0, 2);

      const fornLineStep = 4;
      const fornBlock = fornLines.length * fornLineStep;
      const totalRowH = 5.5;
      const metaLineStep = 3.6;
      const metaBlock = metaLines.length * metaLineStep;
      const progH = 4;
      const cardPadBottom = 3;
      const codeY0 = 6.5;
      const codeBlockH = codigoLinhas.length * codigoLineStep;
      const gapCodeForn = 3;
      const cardHeight = codeY0 + codeBlockH + gapCodeForn + fornBlock + totalRowH + metaBlock + progH + cardPadBottom;

      const minPrimeiroItemH = itens.length > 0 ? computeExpandedItemRowH(pedido, itens[0], 'narrow', 0) : 0;
      ensureSpace(cardHeight + 3 + minPrimeiroItemH + 6);

      const cardTop = y;

      doc.setFillColor(...C.panel);
      doc.roundedRect(M, cardTop, CW, cardHeight, 2.5, 2.5, 'F');

      doc.setFillColor(...sc.dot);
      doc.circle(M + 4.5, cardTop + 6, 2, 'F');

      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(6.5);
      doc.setTextColor(...SLATE500);
      codigoLinhas.forEach((line, ci) => {
        doc.text(line, M + 10, cardTop + codeY0 + ci * codigoLineStep);
      });

      doc.setFillColor(...sc.pillBg);
      doc.roundedRect(M + CW - 30, cardTop + 2, 28, 7, 3.5, 3.5, 'F');
      doc.setFontSize(6);
      doc.setTextColor(...sc.pillText);
      doc.text(safe(statusRelatorio), M + CW - 16, cardTop + 6.8, { align: 'center' });

      let cy = cardTop + codeY0 + codeBlockH + gapCodeForn;
      doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
      doc.setFontSize(9);
      doc.setTextColor(...SLATE900);
      fornLines.forEach((line, fl) => {
        doc.text(line, M + 3, cy + fl * fornLineStep);
      });
      cy += fornBlock + 1;

      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(6);
      doc.setTextColor(...SLATE500);
      doc.text('Total', M + 3, cy);
      doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
      doc.setFontSize(9);
      doc.setTextColor(...SLATE900);
      doc.text(valorHeader, M + CW - 3, cy, { align: 'right' });
      cy += totalRowH;

      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(6);
      doc.setTextColor(...SLATE500);
      metaLines.forEach((line, ml) => {
        doc.text(line, M + 3, cy + ml * metaLineStep);
      });
      cy += metaBlock + 1;

      drawProgressBar(pedido._display_status || pedido.status, cy);
      y = cardTop + cardHeight + 3;

      itens.forEach((item) => {
        const rowH = computeExpandedItemRowH(pedido, item, 'narrow', y);
        ensureSpace(rowH + 6);
        const drawn = drawExpandedItemRowClean(pedido, item, 'narrow', y, 0);
        y += drawn.rowBlockH;
      });

      y += 4;
    };

    // ════════════════════════════════════════════════════════════════════════
    //  MOBILE CLARO: tinta preta, tipografia fina, alto contraste
    // ════════════════════════════════════════════════════════════════════════
    const drawMobileCardClaro = (pedido) => {
      const isPendencia = (pedido.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'Pendencia';
      const statusRelatorio = normalizarStatusRelatorio(pedido._display_status || pedido.status);
      const itens = mapItensRelatorioComercial(pedido);
      const textoPedido = includeAnexos ? getTextoPedidoRelatorio(pedido) : '';
      const transportadora = getTransportadoraRelatorio(pedido);

      const valorHeader = isPendencia
        ? moeda(itens.reduce((a, i) => {
            const prod = produtosMap[i.produto_id] || {};
            const met = resolveMetricasItemPdf(i, prod, pedido);
            return a + met.totalLinha;
          }, 0))
        : moeda(getValorRelatorio(pedido, produtosMap));

      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(includeAnexos ? 6.6 : 6.4);
      const codigoLinhas = doc.splitTextToSize(safe(getPedidoNumeroRelatorio(pedido)), CW - 4).slice(0, 2);
      const codigoLineStep = 3.5;
      const fornMaxLines = includeAnexos ? 4 : 3;
      const fornFontSize = includeAnexos ? 8.6 : 8.2;
      const fornLines = doc.splitTextToSize(getFornecedorRelatorio(pedido), CW - 4).slice(0, fornMaxLines);
      const countLabel = isNecessidadeRelatorio(pedido)
        ? `${itens.length} item(ns) pendente(s)`
        : `${itens.length} item(ns)`;
      const metaParts = [
        dataFmt(getDataRelatorio(pedido)),
        `ETA ${dataFmt(getEtaRelatorio(pedido))}`,
        getOrdinalRelatorio(pedido),
        countLabel,
      ];
      if (includeAnexos && transportadora && transportadora !== 'Sem transportadora') {
        metaParts.splice(2, 0, `Transp. ${transportadora}`);
      }
      const metaTexto = metaParts.join(' · ');
      const metaLines = doc.splitTextToSize(metaTexto, CW - 4).slice(0, includeAnexos ? 3 : 2);
      const textoPedidoLines = textoPedido
        ? doc.splitTextToSize(textoPedido, CW - 6).slice(0, 10)
        : [];

      const fornLineStep = includeAnexos ? 3.9 : 3.7;
      const fornBlock = fornLines.length * fornLineStep;
      const totalRowH = 4.8;
      const metaLineStep = 3.4;
      const metaBlock = metaLines.length * metaLineStep;
      const textoLabelH = textoPedidoLines.length > 0 ? 3.2 : 0;
      const textoLineStep = 3.3;
      const textoBlock = textoPedidoLines.length > 0
        ? textoLabelH + textoPedidoLines.length * textoLineStep + 1.2
        : 0;
      const progH = 2.2;
      const codeY0 = 5.5;
      const codeBlockH = codigoLinhas.length * codigoLineStep;
      const gapCodeForn = 2.2;
      const headerBlockH = codeY0 + codeBlockH + gapCodeForn + fornBlock + totalRowH + metaBlock + textoBlock + progH + 2;

      const itemLayout = 'narrow_claro';
      const minPrimeiroItemH = itens.length > 0 ? computeExpandedItemRowH(pedido, itens[0], itemLayout, 0) : 0;
      ensureSpace(headerBlockH + 2 + minPrimeiroItemH + 5);

      const blockTop = y;

      doc.setDrawColor(...MOBILE_INK.black);
      doc.setLineWidth(0.2);
      doc.line(M, blockTop, M + CW, blockTop);

      doc.setFillColor(...MOBILE_INK.black);
      doc.rect(M, blockTop, 0.9, headerBlockH, 'F');

      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(includeAnexos ? 6.6 : 6.4);
      doc.setTextColor(...MOBILE_INK.meta);
      codigoLinhas.forEach((line, ci) => {
        doc.text(line, M + 3, blockTop + codeY0 + ci * codigoLineStep);
      });

      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(6.2);
      doc.setTextColor(...MOBILE_INK.black);
      doc.text(safe(statusRelatorio), M + CW - 2, blockTop + codeY0, { align: 'right' });

      let cy = blockTop + codeY0 + codeBlockH + gapCodeForn;
      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(fornFontSize);
      doc.setTextColor(...MOBILE_INK.black);
      fornLines.forEach((line, fl) => {
        doc.text(line, M + 3, cy + fl * fornLineStep);
      });
      cy += fornBlock + 0.8;

      doc.setFontSize(6.1);
      doc.setTextColor(...MOBILE_INK.meta);
      doc.text('Total', M + 3, cy);
      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(fornFontSize);
      doc.setTextColor(...MOBILE_INK.black);
      doc.text(valorHeader, M + CW - 2, cy, { align: 'right' });
      cy += totalRowH;

      doc.setFontSize(6.1);
      doc.setTextColor(...MOBILE_INK.meta);
      metaLines.forEach((line, ml) => {
        doc.text(line, M + 3, cy + ml * metaLineStep);
      });
      cy += metaBlock + (textoPedidoLines.length > 0 ? 1.2 : 0);

      if (textoPedidoLines.length > 0) {
        doc.setFontSize(6);
        doc.setTextColor(...MOBILE_INK.meta);
        doc.text('Texto do pedido', M + 3, cy);
        cy += textoLabelH;
        doc.setFontSize(includeAnexos ? 7.2 : 6.8);
        doc.setTextColor(...MOBILE_INK.body);
        textoPedidoLines.forEach((line, tl) => {
          doc.text(line, M + 3, cy + tl * textoLineStep);
        });
        cy += textoPedidoLines.length * textoLineStep + 1;
      }

      drawProgressBarMobileClaro(pedido._display_status || pedido.status, cy);
      y = blockTop + headerBlockH + 2;

      doc.setDrawColor(...MOBILE_INK.line);
      doc.setLineWidth(0.12);
      doc.line(M, y - 1, M + CW, y - 1);

      itens.forEach((item) => {
        const rowH = computeExpandedItemRowH(pedido, item, itemLayout, y);
        ensureSpace(rowH + 4);
        const drawn = drawExpandedItemRowClean(pedido, item, itemLayout, y, 0);
        y += drawn.rowBlockH;
      });

      y += 3;
    };

    // ════════════════════════════════════════════════════════════════════════
    //  ENXUTO A4: limpo, tipografia maior, sem barra de progresso nem decoração
    // ════════════════════════════════════════════════════════════════════════
    const drawEnxuto = (pedido) => {
      const isPendencia = (pedido.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'Pendencia';
      const statusRelatorio = normalizarStatusRelatorio(pedido._display_status || pedido.status);
      const itens = mapItensRelatorioComercial(pedido);

      if (includeAnexos) {
        const colHdrBaselineOffset = 4.2;
        const colHdrBlockH = 6.2;
        const headerBlockH = colHdrBlockH + 3;
        const minPrimeiroItemH = itens.length > 0 ? computeExpandedItemRowH(pedido, itens[0], 'narrow_enxuto', 0) : 0;
        ensureSpace(headerBlockH + minPrimeiroItemH + 12);

        const blockTop = y;
        const enxutoTableX = M + ENXUTO_INDENT.produto;
        drawWideValueColumnHeaders(blockTop + colHdrBaselineOffset, {
          fontSize: ENXUTO_FONT.colHdr,
          tableX: enxutoTableX,
          mutedColor: ENXUTO.muted,
        });
        y = blockTop + headerBlockH + 1.5;

        let totCusto = 0;
        let totVenda = 0;
        itens.forEach((item) => {
          const rowH = computeExpandedItemRowH(pedido, item, 'narrow_enxuto', y);
          ensureSpace(rowH + 5);
          const drawn = drawExpandedItemRowClean(pedido, item, 'narrow_enxuto', y, 0);
          totCusto += drawn.totCustoAdd;
          totVenda += drawn.totVendaAdd;
          y += drawn.rowBlockH;
        });

        if (itens.length > 0) {
          ensureSpace(8);
          y += 2;
          doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
          doc.setFontSize(ENXUTO_FONT.footer);
          doc.setTextColor(...ENXUTO.muted);
          doc.text(
            `Custo: ${moedaOuTraco(totCusto)}   Venda ref.: ${moeda(totVenda)}`,
            M + ENXUTO_INDENT.produto,
            y,
          );
          y += 5;
        }
        y += 4;
        return;
      }

      const pedidoX = M + ENXUTO_INDENT.pedido;
      const pedidoW = CW - ENXUTO_INDENT.pedido;

      const valorHeader = isPendencia
        ? moeda(itens.reduce((a, i) => {
            const prod = produtosMap[i.produto_id] || {};
            const met = resolveMetricasItemPdf(i, prod, pedido);
            return a + met.totalLinha;
          }, 0))
        : moeda(getValorRelatorio(pedido, produtosMap));

      const totalQtdExp = itens.reduce((a, i) => a + (Number(i._qtdEfetiva) || 0), 0);
      const countLabel = isPendencia
        ? `${itens.length} item(ns) pendente(s)`
        : `${itens.length} item(ns)   ${fmtQuantidadePdf(totalQtdExp)} un.`;

      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(ENXUTO_FONT.pedidoCodigo);
      const codigoLinhas = doc.splitTextToSize(safe(getPedidoNumeroRelatorio(pedido)), pedidoW - 2).slice(0, 2);
      const codigoLineStep = 4.5;
      const fornLines = doc.splitTextToSize(getFornecedorRelatorio(pedido), pedidoW - 2).slice(0, 3);
      const metaTexto = `${dataFmt(getDataRelatorio(pedido))}   ETA ${dataFmt(getEtaRelatorio(pedido))}   ${getOrdinalRelatorio(pedido)}   ${countLabel}`;
      const metaLines = doc.splitTextToSize(metaTexto, pedidoW - 2).slice(0, 2);

      const fornLineStep = 4.8;
      const fornBlock = fornLines.length * fornLineStep;
      const totalRowH = 6;
      const metaLineStep = 4.2;
      const metaBlock = metaLines.length * metaLineStep;
      const codeY0 = 5;
      const codeBlockH = codigoLinhas.length * codigoLineStep;
      const gapCodeForn = 2.5;
      const gapBeforeColHdr = 2.2;
      const colHdrBaselineOffset = 4.2;
      const colHdrBlockH = 6.2;
      const headerPadBottom = 2;
      const headerBlockH =
        codeY0 + codeBlockH + gapCodeForn + fornBlock + totalRowH + metaBlock
        + gapBeforeColHdr + colHdrBlockH + headerPadBottom;
      const enxutoTableX = M + ENXUTO_INDENT.produto;

      const minPrimeiroItemH = itens.length > 0 ? computeExpandedItemRowH(pedido, itens[0], 'narrow_enxuto', 0) : 0;
      ensureSpace(headerBlockH + 4 + minPrimeiroItemH + 8);

      const blockTop = y;
      const pedidoStartPage = doc.internal.getNumberOfPages();

      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(ENXUTO_FONT.pedidoCodigo);
      doc.setTextColor(...ENXUTO.muted);
      codigoLinhas.forEach((line, ci) => {
        doc.text(line, pedidoX, blockTop + codeY0 + ci * codigoLineStep);
      });
      doc.setTextColor(...ENXUTO.black);
      doc.text(safe(statusRelatorio), pedidoX + pedidoW, blockTop + codeY0, { align: 'right' });

      let cy = blockTop + codeY0 + codeBlockH + gapCodeForn;
      doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
      doc.setFontSize(ENXUTO_FONT.pedidoForn);
      doc.setTextColor(...ENXUTO.black);
      fornLines.forEach((line, fl) => {
        doc.text(line, pedidoX, cy + fl * fornLineStep);
      });
      cy += fornBlock + 1.2;

      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(ENXUTO_FONT.pedidoCodigo);
      doc.setTextColor(...ENXUTO.muted);
      doc.text('Total', pedidoX, cy);
      doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
      doc.setFontSize(ENXUTO_FONT.pedidoTotal);
      doc.setTextColor(...ENXUTO.black);
      doc.text(valorHeader, pedidoX + pedidoW, cy, { align: 'right' });
      cy += totalRowH;

      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(ENXUTO_FONT.pedidoMeta);
      doc.setTextColor(...ENXUTO.muted);
      metaLines.forEach((line, ml) => {
        doc.text(line, pedidoX, cy + ml * metaLineStep);
      });
      cy += metaBlock + gapBeforeColHdr;

      drawWideValueColumnHeaders(cy + colHdrBaselineOffset, {
        fontSize: ENXUTO_FONT.colHdr,
        tableX: enxutoTableX,
        mutedColor: ENXUTO.muted,
      });

      y = blockTop + headerBlockH + 1.5;

      let totCusto = 0;
      let totVenda = 0;
      itens.forEach((item) => {
        const rowH = computeExpandedItemRowH(pedido, item, 'narrow_enxuto', y);
        ensureSpace(rowH + 5);
        const drawn = drawExpandedItemRowClean(pedido, item, 'narrow_enxuto', y, 0);
        totCusto += drawn.totCustoAdd;
        totVenda += drawn.totVendaAdd;
        y += drawn.rowBlockH;
      });

      if (itens.length > 0) {
        ensureSpace(8);
        y += 2;
        doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
        doc.setFontSize(ENXUTO_FONT.footer);
        doc.setTextColor(...ENXUTO.muted);
        doc.text(
          `Custo: ${moedaOuTraco(totCusto)}   Venda ref.: ${moeda(totVenda)}`,
          M + ENXUTO_INDENT.produto,
          y,
        );
        y += 5;
      }

      const pedidoEndPage = doc.internal.getNumberOfPages();
      drawEnxutoVerticalSpan(
        M + ENXUTO_INDENT.pedidoLine,
        blockTop,
        y,
        pedidoStartPage,
        pedidoEndPage,
      );

      y += 6;
    };

    const buildPedidoChrome = (pedido) => ({
      codigo: getPedidoNumeroRelatorio(pedido),
      fornecedor: getFornecedorRelatorio(pedido),
      data: dataFmt(getDataRelatorio(pedido)),
      eta: dataFmt(getEtaRelatorio(pedido)),
      transportadora: getTransportadoraRelatorio(pedido),
      valor: moeda(getValorRelatorio(pedido, produtosMap)),
      status: normalizarStatusRelatorio(pedido._display_status || pedido.status),
    });

    const marcarPaginasPedido = (startPage, endPage, chrome) => {
      for (let page = startPage; page <= endPage; page += 1) {
        pagePedidoChrome[page] = chrome;
      }
    };

    const applyRelatorioCompletoChrome = () => {
      const total = doc.internal.getNumberOfPages();
      const chromeInk = isMobile ? MOBILE_INK.black : ENXUTO.black;
      const chromeMuted = isMobile ? MOBILE_INK.meta : ENXUTO.muted;
      const titleSize = isMobile ? 7 : 8;
      const metaSize = isMobile ? 6.2 : 7;
      const detailSize = isMobile ? 5.8 : 6.8;
      const footerSize = isMobile ? 6 : 7;
      const lineColor = isMobile ? MOBILE_INK.line : [180, 180, 180];
      const footerLineColor = isMobile ? MOBILE_INK.line : [200, 200, 200];

      for (let page = 1; page <= total; page += 1) {
        doc.setPage(page);
        const ctx = pagePedidoChrome[page];

        doc.setDrawColor(...lineColor);
        doc.setLineWidth(0.2);
        doc.line(M, RELATORIO_COMPLETO_CHROME.headerH, pageW - M, RELATORIO_COMPLETO_CHROME.headerH);

        doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
        doc.setFontSize(titleSize);
        doc.setTextColor(...chromeInk);

        if (ctx) {
          const codigoLinhas = doc.splitTextToSize(safe(ctx.codigo), CW);
          doc.text(codigoLinhas[0] || '-', M, isMobile ? 4.2 : 5);
          doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
          doc.setFontSize(metaSize);
          doc.setTextColor(...chromeMuted);
          const fornLinhas = doc.splitTextToSize(safe(ctx.fornecedor), CW);
          const fornY = isMobile ? 7.2 : 9;
          doc.text(fornLinhas[0] || '-', M, fornY);
          if (isMobile && fornLinhas.length > 1) {
            doc.text(fornLinhas[1], M, fornY + 2.8);
          }
          const linhaMeta = [ctx.data, ctx.valor].filter(Boolean).join('  ·  ');
          doc.setFontSize(detailSize);
          doc.text(doc.splitTextToSize(safe(linhaMeta), CW)[0], M, isMobile ? 10.2 : 12.5);
        } else {
          doc.text(
            isMobile ? 'Embarques completo' : 'Relatorio completo de embarques',
            M,
            isMobile ? 4.2 : 5,
          );
          doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
          doc.setFontSize(metaSize);
          doc.setTextColor(...chromeMuted);
          doc.text('Indice e resumo do periodo filtrado', M, isMobile ? 7.2 : 9);
        }

        doc.setDrawColor(...footerLineColor);
        doc.line(M, pageH - RELATORIO_COMPLETO_CHROME.footerH, pageW - M, pageH - RELATORIO_COMPLETO_CHROME.footerH);
        doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
        doc.setFontSize(footerSize);
        doc.setTextColor(...chromeMuted);
        doc.text(`Gerado em ${generatedAtStr}`, M, pageH - 3.2);
        doc.text(`Pagina ${page} de ${total}`, pageW - M, pageH - 3.2, { align: 'right' });
      }
    };

    // ════════════════════════════════════════════════════════════════════════
    //  RENDER PRINCIPAL
    // ════════════════════════════════════════════════════════════════════════
    drawHeader();
    drawKpis();
    drawGroupSummary();

    const renderPedido = (pedido) => {
      if (isMobileClaro)           return drawMobileCardClaro(pedido);
      if (isMobileClassico)        return drawMobileCardClassico(pedido);
      if (isEnxuta)                return drawEnxuto(pedido);
      return drawExpandido(pedido);
    };

    const appendAnexosDoPedido = async (pedido) => {
      if (!includeAnexos || !pedido?.id) return;
      const anexos = anexosPorPedido[pedido.id] || [];
      if (!anexos.length) return;
      await appendAnexosToPdfDoc(doc, anexos, {
        sectionPrefix: `Anexos ${getPedidoNumeroRelatorio(pedido)}`,
        layout: {
          margin: M,
          titleY: RELATORIO_COMPLETO_CHROME.topContentY + 1,
          contentTop: RELATORIO_COMPLETO_CHROME.topContentY + 6,
          contentBottom: pageH - RELATORIO_COMPLETO_CHROME.bottomPad,
        },
      });
    };

    let pedidoBlocoIndex = 0;

    const renderPedidoComAnexos = async (pedido) => {
      const chrome = buildPedidoChrome(pedido);
      if (includeAnexos && pedidoBlocoIndex > 0) {
        doc.addPage();
        y = getNewPageY();
      }
      pedidoBlocoIndex += 1;
      const startPage = doc.internal.getNumberOfPages();
      renderPedido(pedido);
      await appendAnexosDoPedido(pedido);
      const endPage = doc.internal.getNumberOfPages();
      marcarPaginasPedido(startPage, endPage, chrome);
    };

    const renderGrupo = async (grupo) => {
      ensureSpace(14);
      if (isMobileClassico) {
        y += 2;
        const bandH = 9;
        ensureSpace(bandH + 4);
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(M, y, CW, bandH, 2, 2, 'F');
        doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
        doc.setFontSize(6.5);
        doc.setTextColor(...SLATE900);
        doc.text(safe(grupo.label || '-'), M + 3, y + 5.5);
        doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
        doc.setFontSize(5.8);
        doc.setTextColor(...SLATE500);
        doc.text(`${(grupo.pedidos || []).length} pedido(s)`, M + CW - 3, y + 5.5, { align: 'right' });
        y += bandH + 3;
      } else if (isMobileClaro) {
        y += 2;
        const bandH = 7.5;
        ensureSpace(bandH + 3);
        doc.setDrawColor(...MOBILE_INK.black);
        doc.setLineWidth(0.2);
        doc.line(M, y, M + CW, y);
        y += 2.2;
        doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
        doc.setFontSize(6.6);
        doc.setTextColor(...MOBILE_INK.black);
        doc.text(safe(grupo.label || '-'), M + 1, y + 3.2);
        doc.setFontSize(6.1);
        doc.setTextColor(...MOBILE_INK.meta);
        doc.text(`${(grupo.pedidos || []).length} pedido(s)`, M + CW - 1, y + 3.2, { align: 'right' });
        y += 5.5;
      } else if (isEnxuta) {
        y += 5;
        ensureSpace(12);
        const bandH = 7.5;
        const embarqueX = M + ENXUTO_INDENT.embarque;
        const totalGrupo = (grupo.pedidos || []).reduce((a, p) => a + getValorRelatorio(p, produtosMap), 0);
        doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
        doc.setFontSize(ENXUTO_FONT.grupo);
        doc.setTextColor(...ENXUTO.black);
        doc.text(safe(grupo.label || '-'), embarqueX, y + 3.5);
        doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
        doc.setFontSize(ENXUTO_FONT.grupoMeta);
        doc.setTextColor(...ENXUTO.muted);
        doc.text(
          `${(grupo.pedidos || []).length} ped.   ${moeda(totalGrupo)}`,
          M + CW,
          y + 3.5,
          { align: 'right' },
        );
        y += bandH + 2;
        for (const pedido of grupo.pedidos || []) {
          await renderPedidoComAnexos(pedido);
        }
        y += 4;
        return;
      } else {
        ensureSpace(GROUP_AGRUPAMENTO_TO_CARD_GAP_MM + 12);
        y += GROUP_AGRUPAMENTO_TO_CARD_GAP_MM / 2;
        doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
        doc.setFontSize(8);
        doc.setTextColor(...C.muted);
        doc.text(safe(grupo.label || '-'), Math.max(2, M - GROUP_LABEL_OUTDENT_MM), y);
        y += GROUP_AGRUPAMENTO_TO_CARD_GAP_MM / 2;
        const pedidoInset = 7;
        const m0 = M;
        const tm0 = TM;
        M += pedidoInset;
        TM += pedidoInset;
        syncLayoutWidths();
        for (const pedido of grupo.pedidos || []) {
          await renderPedidoComAnexos(pedido);
        }
        M = m0;
        TM = tm0;
        syncLayoutWidths();
        y += 5;
        return;
      }
      for (const pedido of grupo.pedidos || []) {
        await renderPedidoComAnexos(pedido);
      }
    };

    if (Array.isArray(grupos) && grupos.length > 0) {
      for (const grupo of grupos) {
        await renderGrupo(grupo);
      }
    } else {
      for (const pedido of pedidos) {
        await renderPedidoComAnexos(pedido);
      }
    }

    if (includeAnexos) {
      applyRelatorioCompletoChrome();
    } else if (isEnxuta) {
      const pageCount = doc.internal.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page);
        doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
        doc.setFontSize(ENXUTO_FONT.footer);
        doc.setTextColor(...ENXUTO.muted);
        doc.text(`Página ${page}/${pageCount}`, pageW / 2, pageH - 6, { align: 'center' });
      }
    }

    const pdfBytes = doc.output('arraybuffer');
    return {
      data: pdfBytes,
      version: normalizedVersion,
    };
  } catch (error) {
    throw new Error(error?.message || String(error));
  }
}