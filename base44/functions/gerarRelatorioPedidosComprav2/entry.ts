import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { jsPDF } from 'npm:jspdf@2.5.2';

/** Escala só no eixo Y (glifos mais altos, largura inalterada). PDF Tm: sx=1, sy>1. */
const PDF_GLYPH_STRETCH_Y = 1.1;

/**
 * Aplica alongamento vertical no texto do PDF via matriz interna do jsPDF (não aumenta fontSize).
 * Preserva options.angle se já for uma Matrix (ex.: rotação customizada).
 */
const patchPdfTextVerticalStretch = (doc) => {
  const PdfMatrix = jsPDF.API?.Matrix;
  if (!PdfMatrix) return;
  const origText = doc.text.bind(doc);
  doc.text = function (text, x, y, options, transform) {
    if (options != null && typeof options === 'object' && options.angle instanceof PdfMatrix) {
      return origText(text, x, y, options, transform);
    }
    const stretch = new PdfMatrix(1, 0, 0, PDF_GLYPH_STRETCH_Y, 0, 0);
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

// V2: total dos itens calculado pelo mesmo engine limpo (qtd × custo_unitario × fator),
// inline para evitar forward reference. Sem heurística.
const getTotalItensAjustadoPedido = (pedido, produtosMap = {}) => {
  const itens = getItensRelatorio(pedido);
  return itens.reduce((acc, item) => {
    const qtd = Number(item._qtdEfetiva ?? item.quantidade ?? item.quantidade_embarcada ?? item.quantidade_pedida) || 0;
    const prod = produtosMap[item.produto_id] || {};
    const vlrUnit = getValorUnitarioComercialItem(item, prod, pedido);
    return acc + qtd * (Number.isFinite(vlrUnit) && vlrUnit > 0 ? vlrUnit : 0);
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

/**
 * V2 — Resolução de fator comercial com **prioridade máxima ao nome do produto**.
 *
 * Motivação: quando os números (cadastro, `qb/q`, `total/(q × cu)`) divergem entre si,
 * temos uma fonte que está acima de todas e foi digitada explicitamente pelo user no
 * cadastro: o **nome** do produto (ex. "PISO 60X120 GRAN PHOENIX RT POL (2,16M²/CX)").
 * Esse texto não é envenenado por bugs legados de cálculo nem por typos em
 * `unidades_alternativas`, então é a verdade que o user de fato afirmou.
 *
 * Ordem (primeiro que produzir fator plausível vence):
 *   1. **Regex do nome do produto** (ex. "(2,16M²/CX)" → 2,16). Vence sempre.
 *   2. Sigla `unidade_medida` da linha → opção em `PDF_BUILD_PURCHASE_OPTS(produto)`.
 *   3. `pickDefault` do produto: opção não-principal com `fator_conversao` > 1.
 *   4. `total / (quantidade × custo_unitario)` da linha (reconciliação aritmética).
 *   5. `quantidade_base / quantidade` da linha.
 *   6. `item.fator_conversao` da linha.
 *
 * Nenhum dos passos der > 1 → fator = 1 (linha já em fator-1 puro).
 */
const v2NormalizarSigla = (raw: any) =>
  String(raw || '').trim().toUpperCase()
    .replace('CAIXAS', 'CX').replace('CAIXA', 'CX')
    .replace('M²', 'M2').replace('METRO QUADRADO', 'M2');

/** Tenta extrair `<n>M²/CX` (ou `CX <n>M²`) do nome do produto.
 *  Aceita "CAIXA"/"CAIXAS" como sinônimo de CX e separadores comuns ("/", " ", "x").
 */
const v2ExtrairFatorDoNome = (...nomes: any[]): number | null => {
  for (const raw of nomes) {
    if (!raw) continue;
    const s = String(raw)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace('METRO QUADRADO', 'M2').replace('M²', 'M2')
      .replace(/CAIXAS?/g, 'CX');
    const padroes = [
      // "2,16M2/CX", "2,16 M2 / CX", "1,68M² CAIXA" → "1,68M2 CX"
      /(\d+(?:[.,]\d+)?)\s*M2\s*[\/xX\\\s]*\s*CX/i,
      // "CX 2,50 M2", "CX2,1M2"
      /CX\s*(\d+(?:[.,]\d+)?)\s*M2/i,
      // "(2,16M2)" — quando faltar a sigla mas há parênteses (assume CX por convenção pisos).
      /\(\s*(\d+(?:[.,]\d+)?)\s*M2\s*\)/i,
    ];
    for (const re of padroes) {
      const m = re.exec(s);
      if (m) {
        const v = Number(String(m[1]).replace(',', '.'));
        if (Number.isFinite(v) && v > 1 && v < 100) return Math.round(v * 10000) / 10000;
      }
    }
  }
  return null;
};

const v2DerivarFatorDoTotal = (item: any = {}) => {
  const cu = Number(item?.custo_unitario) || 0;
  const q = Number(item?.quantidade) || 0;
  const total = Number(
    item?.total ?? item?.valor_total_item ?? item?.valor_total ?? item?.subtotal,
  ) || 0;
  if (!(cu > 0 && q > 0 && total > 0)) return null;
  const fNat = total / (q * cu);
  if (!Number.isFinite(fNat) || fNat < 0.5 || fNat > 100) return null;
  return Math.round(fNat * 10000) / 10000;
};

const v2ResolveFatorComercial = (item: any = {}, prod: any = {}) => {
  // 1) Nome do produto — fonte canônica acima de cadastro/linha (resolve typos em ambos).
  const fNome = v2ExtrairFatorDoNome(prod?.nome, item?.produto_nome, item?.descricao);
  if (fNome && fNome > 1.0001) return fNome;

  const opcoes = prod ? PDF_BUILD_PURCHASE_OPTS(prod) : [];

  // 2) Sigla da linha → fator do produto.
  const sigla = v2NormalizarSigla(item?.unidade_medida);
  if (sigla && opcoes.length) {
    const match = opcoes.find((o: any) => v2NormalizarSigla(o.unidade) === sigla);
    if (match && Number(match.fator_conversao) > 1) {
      return Number(match.fator_conversao);
    }
  }

  // 3) Default de compra do cadastro (opção não-principal com fator > 1).
  if (opcoes.length) {
    const principal = v2NormalizarSigla(prod?.unidade_principal);
    const naoPrincipal = opcoes.find((o: any) =>
      v2NormalizarSigla(o.unidade) !== principal && Number(o.fator_conversao) > 1);
    if (naoPrincipal) return Number(naoPrincipal.fator_conversao);
  }

  // 4) total ÷ (quantidade × custo_unitario): fator natural da linha.
  const fNatural = v2DerivarFatorDoTotal(item);
  if (fNatural && fNatural > 1.0001) return fNatural;

  // 5) qb / q da linha.
  const qtd = Number(item?.quantidade);
  const qb = Number(item?.quantidade_base);
  if (qtd > 0 && qb > 0) {
    const derivado = qb / qtd;
    if (Number.isFinite(derivado) && derivado > 1.0001) {
      return Math.round(derivado * 10000) / 10000;
    }
  }

  // 6) Último recurso: o que está na linha.
  const f = Number(item?.fator_conversao);
  return Number.isFinite(f) && f > 0 ? f : 1;
};

const v2ResolveSiglaComercial = (item: any = {}, prod: any = {}, fator: number = 1) => {
  if (fator > 1) {
    const opcoes = PDF_BUILD_PURCHASE_OPTS(prod);
    const match = opcoes.find((o: any) => Math.abs(Number(o.fator_conversao) - fator) < 1e-4 && Number(o.fator_conversao) > 1);
    if (match?.unidade) return match.unidade;
  }
  return safe(item?.unidade_medida || prod?.unidade_principal || 'UN');
};

/**
 * V2 — Resolver de métricas com regras LIMPAS, espelhando exatamente a dialog de Atualizar Preços.
 *
 *   - `custo_unitario` da linha é a verdade fator-1 (R$/[unidade base]).
 *   - O **fator de exibição** é derivado igual a dialog (qb/q → casamento de sigla → default de compra → linha).
 *   - VLR UN = custo_unitario × fator.
 *   - QTD comercial = quantidade_base / fator (se fator > 1) — mantém embarque fiel.
 *   - FRETE/OUTROS/VENDA vêm do catálogo (em fator-1) e são convertidos pelo mesmo fator.
 *   - CUSTO = VLR UN + FRETE + OUTROS. TOTAL = QTD × VLR UN. MARKUP = (VENDA − CUSTO) / CUSTO.
 *
 * Sem heurística por eixo, sem `total / quantidade_base`, sem fallback de `_base`/`_apresentacao`.
 */
const calcularLinhav2 = (item: any = {}, prod: any = {}, _pedido: any = {}) => {
  const fator = v2ResolveFatorComercial(item, prod);
  const un = v2ResolveSiglaComercial(item, prod, fator);

  // QTD comercial: `quantidade_base` é fonte da verdade (espelho de commercialQuantityFromBase).
  const qLinha = Number(item._qtdEfetiva ?? item.quantidade ?? item.quantidade_embarcada ?? item.quantidade_pedida) || 0;
  const qbLinha = Number(item.quantidade_base) || 0;
  const qtd =
    qbLinha > 0 && fator > 1
      ? PDF_COMMERCIAL_QTY_FROM_BASE(qbLinha, fator, un)
      : qLinha;

  const linhaRef = {
    ...item,
    _qtdEfetiva: qtd,
    quantidade: qtd,
    quantidade_base: qbLinha > 0 ? qbLinha : item.quantidade_base,
    fator_conversao: fator,
    unidade_medida: un,
  };
  const vlrUnit = getValorUnitarioComercialItem(linhaRef, prod, _pedido);

  const freteFator1 = Number(prod.custo_frete_padrao) || 0;
  const freteUnit = freteFator1 * fator;

  const outrosFator1 =
    (Number(prod.custo_imposto1_padrao) || 0) +
    (Number(prod.custo_imposto2_padrao) || 0) +
    (Number(prod.custo_outros_padrao) || 0);
  const outrosUnit = outrosFator1 * fator;

  const custoUnit = (Number.isFinite(vlrUnit) ? vlrUnit : 0) + freteUnit + outrosUnit;
  const totalLinha = qtd * (Number.isFinite(vlrUnit) ? vlrUnit : 0);

  const vendaFator1 = Number(prod.preco_venda_padrao) || 0;
  const vendaUnit = vendaFator1 * fator;

  const markup = custoUnit > 0 ? ((vendaUnit - custoUnit) / custoUnit) * 100 : NaN;

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

// Alias para o nome usado pelos draw* no copy-base. Toda referência a `resolveMetricasItemPdf`
// na V2 cai no resolver limpo.
const resolveMetricasItemPdf = calcularLinhav2;

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
  if (version === 'mobile_com_alma') return 'expandida_mobile';
  if (version === 'compacta') return 'expandida';
  if (version === 'expandida_mobile') return 'expandida_mobile';
  if (version === 'expandida') return 'expandida';
  return 'expandida';
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const {
      pedidos = [],
      version = 'compacta',
      filtros_desc = 'Pedidos filtrados na tela',
      kpis = {},
      grupos = [],
      produtos_map: produtosMapPayload = null,
    } = payload;
    const normalizedVersion = normalizeReportVersion(version);

    const isMobile = normalizedVersion === 'expandida_mobile';

    // V2: aceita produtos_map vindo do frontend (snapshot já carregado lá).
    // Se não vier, busca individualmente — mantendo compatibilidade com chamadas antigas.
    let produtosMap: Record<string, any> = {};
    if (produtosMapPayload && typeof produtosMapPayload === 'object') {
      produtosMap = produtosMapPayload;
    } else {
      const produtoIds = [...new Set(
        pedidos.flatMap((p) => (p._display_itens || p.itens || []).map((i) => i.produto_id).filter(Boolean))
      )];
      const produtos = produtoIds.length ? await Promise.all(produtoIds.map((id) => base44.asServiceRole.entities.Produto.get(id).catch(() => null))) : [];
      produtosMap = Object.fromEntries((produtos || []).filter(Boolean).map((p) => [p.id, p]));
    }

    // ── Criação do documento ─────────────────────────────────────────────────
    const MOBILE_W = 100; // mm — largura estilo smartphone
    // Mobile: página alta (uma coluna “infinita”) para rolar no leitor PDF com menos quebras abruptas
    const MOBILE_PAGE_H = 1200;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: isMobile ? [MOBILE_W, MOBILE_PAGE_H] : 'a4',
    });
    const usarNoto = await registerPdfFonts(doc);
    const pdfFontFamily = usarNoto ? 'NotoSans' : 'helvetica';
    patchPdfTextVerticalStretch(doc);

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

    let y = 16;

    const ensureSpace = (needed = 24) => {
      const bottomPad = isMobile ? 4 : 10;
      if (y + needed > pageH - bottomPad) {
        doc.addPage();
        y = 14;
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

    const drawWideValueColumnHeaders = (baselineY, fontSize = EXPANDED_ITEMS_TABLE_FONT_SIZE) => {
      const cols = EXPANDED_ITEMS_TABLE_COLUMNS;
      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(fontSize);
      doc.setTextColor(...SLATE500);
      doc.text('QTD', TM + cols.qtd, baselineY);
      doc.text('UN', TM + cols.unidade, baselineY);
      doc.text('VLR. UN.', TM + cols.vlrUnit, baselineY, { align: 'right' });
      doc.text('FRETE', TM + cols.frete, baselineY, { align: 'right' });
      doc.text('OUTROS', TM + cols.outros, baselineY, { align: 'right' });
      doc.text('CUSTO', TM + cols.custo, baselineY, { align: 'right' });
      doc.text('TOTAL', TM + cols.total, baselineY, { align: 'right' });
      doc.text('VENDA', TM + cols.venda, baselineY, { align: 'right' });
      doc.text('MARKUP', TM + cols.markup, baselineY, { align: 'right' });
    };

    // ════════════════════════════════════════════════════════════════════════
    //  HEADER
    // ════════════════════════════════════════════════════════════════════════
    const drawHeader = () => {
      if (isMobile) {
        // Header mobile: hierarquia clara, filtros em até 3 linhas, tipografia legível no celular
        let hy = 12;
        doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
        doc.setFontSize(12);
        doc.setTextColor(...C.text);
        doc.text('Embarques', M, hy);
        hy += 5;

        doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
        doc.setFontSize(6.5);
        doc.setTextColor(...C.muted);
        doc.text('Relatório para celular', M, hy);
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

      // Desktop header
      doc.setFillColor(...C.panel);
      doc.roundedRect(M, y, CW, 26, 4, 4, 'F');
      doc.setFillColor(...C.teal);
      doc.roundedRect(M + 5, y + 5, 2.4, 10, 1.2, 1.2, 'F');
      doc.setTextColor(...C.text);
      doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
      doc.setFontSize(16);
      const titulo = normalizedVersion === 'expandida_mobile'
        ? 'Relatorio mobile de embarques'
        : 'Relatorio expandido de embarques';
      doc.text(safe(titulo), M + 11, y + 9);
      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(9);
      doc.setTextColor(...C.muted);
      doc.text(safe(filtros_desc), M + 11, y + 15);
      doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, M + 11, y + 21);
      y += 32;
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

      if (isMobile) {
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
      if (isMobile || !Array.isArray(grupos) || grupos.length === 0) return;
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
        vs: 1.35,
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
      const margemLinhaInferiorItem = 1.3 * vs;

      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize((layout === 'wide' ? cfg.nomeFontSize : 7) * cfg.fontScale);
      const nomeMaxW = cfg.nomeMaxW;
      const nomeX = cfg.itemMl;
      const nomeLinhas = doc.splitTextToSize(
        toTitleCase(safe(item.produto_nome || prod.nome || '-')),
        nomeMaxW,
      );
      const nomeTop = y0 + 3.4 * vs;
      const lastNomeBaseline = nomeTop + Math.max(0, nomeLinhas.length - 1) * nomeLineStep;

      if (layout === 'wide') {
        const gapNomeValores = 2.65 * vs;
        const valoresRowH = 4.5 * vs;
        const valoresY = lastNomeBaseline + gapNomeValores;
        let detEnd = valoresY + valoresRowH;
        if (met.warningText) {
          doc.setFontSize(5.5 * cfg.fontScale);
          const warnLinhas = doc.splitTextToSize(met.warningText, cfg.nomeMaxW);
          detEnd = valoresY + valoresRowH + 1.2 * vs + warnLinhas.length * 2.8 * vs;
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
      const auxDetailStep = 2.95 * vs;
      const gapNomeDetalhe = 2.4 * vs;
      doc.setFontSize(5.65 * cfg.fontScale);
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

      doc.setFillColor(203, 213, 225);
      doc.rect(cfg.lineX, y0, 0.12, rowBlockH, 'F');
      doc.rect(cfg.lineX, branchY, cfg.lineWidth, 0.12, 'F');

      const qtdFs = layout === 'wide' ? (cfg.qtdFontSize ?? 6.8) : 6.8;
      const unFs = layout === 'wide' ? (cfg.unFontSize ?? 5.9) : 5.9;
      doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
      doc.setFontSize(qtdFs * cfg.fontScale);
      doc.setTextColor(...SLATE900);
      const qtdYOff = 1.2;
      const unYOff = layout === 'wide' ? 4.6 : 4.6;
      doc.text(fmtQuantidadePdf(Number(met.qtd) || 0), cfg.qtdColRight, nomeTop + qtdYOff, { align: 'right' });
      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(unFs * cfg.fontScale);
      doc.setTextColor(...SLATE700);
      doc.text(met.un, cfg.qtdColRight, nomeTop + unYOff, { align: 'right' });

      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize((layout === 'wide' ? cfg.nomeFontSize : 7) * cfg.fontScale);
      doc.setTextColor(...SLATE700);
      nomeLinhas.forEach((line, li) => {
        doc.text(line, nomeX, nomeTop + li * nomeLineStep);
      });

      if (layout === 'wide') {
        const valoresY = measured.valoresY;
        const cols = cfg.cols;
        doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
        doc.setFontSize(cfg.valuesFontSize * cfg.fontScale);
        doc.setTextColor(...SLATE500);
        doc.text(moedaSemSimboloOuTraco(met.vlrUnit), TM + cols.vlrUnit, valoresY, { align: 'right' });
        doc.text(moedaSemSimboloOuTraco(met.freteUnit), TM + cols.frete, valoresY, { align: 'right' });
        doc.text(moedaSemSimboloOuTraco(met.outrosUnit), TM + cols.outros, valoresY, { align: 'right' });
        doc.text(moedaSemSimboloOuTraco(met.custoUnit), TM + cols.custo, valoresY, { align: 'right' });
        doc.text(moedaSemSimboloOuTraco(met.totalLinha), TM + cols.total, valoresY, { align: 'right' });
        doc.text(moedaSemSimboloOuTraco(met.vendaUnit), TM + cols.venda, valoresY, { align: 'right' });
        doc.text(percentualOuTraco(met.markup), TM + cols.markup, valoresY, { align: 'right' });
        if (met.warningText) {
          doc.setFontSize(5.5 * cfg.fontScale);
          doc.setTextColor(...SLATE500);
          const warnLinhas = doc.splitTextToSize(met.warningText, cfg.nomeMaxW);
          warnLinhas.forEach((line, wi) => {
            doc.text(line, cfg.itemMl, valoresY + 3.2 * vs + wi * 2.8 * vs);
          });
        }
      } else {
        const { auxValoresLinhas, det, auxDetailStep, gapNomeDetalhe } = measured;
        const lastNomeBaseline = nomeTop + Math.max(0, nomeLinhas.length - 1) * nomeLineStep;
        const detAux1 = lastNomeBaseline + gapNomeDetalhe;
        const detAux2 = detAux1 + auxValoresLinhas.length * auxDetailStep;
        doc.setFontSize(5.65 * cfg.fontScale);
        doc.setTextColor(...SLATE500);
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

      const sepX0 = layout === 'wide' ? (cfg.sepLineX0 ?? cfg.itemMl) : cfg.itemMl;
      const sepX1 = layout === 'wide' ? (cfg.sepLineX1 ?? cfg.contentRight) : cfg.contentRight;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.15);
      doc.line(sepX0, y0 + rowBlockH, sepX1, y0 + rowBlockH);

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
    //  MOBILE: card limpo modo claro
    // ════════════════════════════════════════════════════════════════════════
    const drawMobileCard = (pedido) => {
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

      // Mesma ideia do desktop (minPedidoH): cabeçalho do pedido + 1.ª linha de itens na mesma página
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

      // Total com rótulo explícito
      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(6);
      doc.setTextColor(...SLATE500);
      doc.text('Total', M + 3, cy);
      doc.setFont(pdfFontFamily, PDF_FONT_BOLD);
      doc.setFontSize(9);
      doc.setTextColor(...SLATE900);
      doc.text(valorHeader, M + CW - 3, cy, { align: 'right' });
      cy += totalRowH;

      // Metadados (até 2 linhas)
      doc.setFont(pdfFontFamily, PDF_FONT_NORMAL);
      doc.setFontSize(6);
      doc.setTextColor(...SLATE500);
      metaLines.forEach((line, ml) => {
        doc.text(line, M + 3, cy + ml * metaLineStep);
      });
      cy += metaBlock + 1;

      drawProgressBar(pedido._display_status || pedido.status, cy);
      y = cardTop + cardHeight + 3;

      // ── Itens (mesmo layout limpo do expandido, página estreita) ──
      itens.forEach((item) => {
        const rowH = computeExpandedItemRowH(pedido, item, 'narrow', y);
        ensureSpace(rowH + 6);
        const drawn = drawExpandedItemRowClean(pedido, item, 'narrow', y, 0);
        y += drawn.rowBlockH;
      });

      y += 4; // espaço entre pedidos
    };

    // ════════════════════════════════════════════════════════════════════════
    //  RENDER PRINCIPAL
    // ════════════════════════════════════════════════════════════════════════
    drawHeader();
    drawKpis();
    drawGroupSummary();

    const renderPedido = (pedido) => {
      if (isMobile)              return drawMobileCard(pedido);
      return drawExpandido(pedido);
    };

    const renderGrupo = (grupo) => {
      ensureSpace(14);
      if (isMobile) {
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
        (grupo.pedidos || []).forEach(renderPedido);
        M = m0;
        TM = tm0;
        syncLayoutWidths();
        y += 5;
        return;
      }
      (grupo.pedidos || []).forEach(renderPedido);
    };

    if (Array.isArray(grupos) && grupos.length > 0) {
      grupos.forEach(renderGrupo);
    } else {
      pedidos.forEach(renderPedido);
    }

    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="relatorio-pedidos-${normalizedVersion}.pdf"`,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});