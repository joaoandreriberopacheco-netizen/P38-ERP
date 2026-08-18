import {
  agora,
  codigoOrdenacaoDesdeDataSomente,
  codigoOrdenacaoDesdeInstante,
  toLocalDateKey,
} from '@/components/utils/dateUtils';
import { codigoOrdemLancamento, diaChaveOrdemLancamento, instanteDesdeCodigoOrdenacao } from '@/lib/lancamentoOrdemMeta';

/**
 * Arredonda número (ou string numérica) para 2 casas decimais.
 * Evita caudas de ponto flutuante em totais de caixa, quantidades embarcadas, etc.
 */
export const roundToTwoDecimals = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

/**
 * Valor monetário de pedido de venda: coluna `total` (pós-migração 029) tem prioridade
 * sobre `valor_total` legado em `dados` (muitos registos têm dados.valor_total=0).
 */
export function resolveValorPedidoVenda(pedido) {
  if (!pedido) return 0;
  const col = Number(pedido.total);
  const legado = Number(pedido.valor_total);
  let v = 0;
  if (Number.isFinite(col) && col > 0) v = col;
  else if (Number.isFinite(legado) && legado > 0) v = legado;
  else if (Number.isFinite(col)) v = col;
  else if (Number.isFinite(legado)) v = legado;
  return roundToTwoDecimals(v);
}

/**
 * Valor exibido de orçamento (pedido_venda tipo Orçamento).
 * Após sync de linhas, `total` pode ficar inflado (soma de tabela); prioriza
 * `dados.valor_total` gravado pelo orçamento rápido quando diverge.
 */
export function resolveValorOrcamentoPedidoVenda(pedido) {
  if (!pedido) return 0;
  const desconto = roundToTwoDecimals(pedido.valor_desconto ?? 0);
  const frete = roundToTwoDecimals(pedido.valor_frete ?? 0);
  const dadosTotal = Number(pedido.dados?.valor_total);
  const colTotal = Number(pedido.total);

  if (Number.isFinite(dadosTotal) && dadosTotal > 0) {
    if (!Number.isFinite(colTotal) || colTotal <= 0 || colTotal > dadosTotal * 1.15) {
      return roundToTwoDecimals(dadosTotal);
    }
  }

  const subtotal = Number(pedido.subtotal);
  if (Number.isFinite(subtotal) && subtotal > 0) {
    return roundToTwoDecimals(subtotal - desconto + frete);
  }

  return resolveValorPedidoVenda(pedido);
}

/** Valor para listagens na gestão de vendas. */
export function resolveValorPedidoVendaGestao(pedido) {
  if (!pedido) return 0;
  const status = String(pedido.status || '').trim().toLowerCase();
  const tipo = String(pedido.tipo || '').trim().toLowerCase();
  if (status === 'orçamento' || status === 'orcamento' || tipo === 'orçamento' || tipo === 'orcamento') {
    return resolveValorOrcamentoPedidoVenda(pedido);
  }
  return resolveValorPedidoVenda(pedido);
}

/** Comparação de pagamento no caixa — tolerância de 1 centavo (ex.: 5000,00 vs 4999,999744). */
export function pagamentosCobremTotal(totalPago, valorTotal, toleranciaCentavos = 0.01) {
  const pago = roundToTwoDecimals(totalPago);
  const total = roundToTwoDecimals(valorTotal);
  return pago + toleranciaCentavos >= total;
}

/**
 * Exibe quantidade com no máximo 2 decimais (pt-BR), sem poluir a UI com IEEE 754.
 */
export const formatQuantity = (value) => {
  const r = roundToTwoDecimals(value);
  return r.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

/**
 * Formata um número como moeda brasileira com 2 casas decimais
 */
export const formatCurrency = (value) => {
  if (value === null || value === undefined) return '0,00';
  const rounded = roundToTwoDecimals(value);
  return rounded.toLocaleString('pt-BR', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
};

/**
 * Parse de número com suporte a vírgula decimal (brasileiro)
 */
export const parseFinancialValue = (value) => {
  if (typeof value === 'number') return roundToTwoDecimals(value);
  if (typeof value === 'string') {
    return roundToTwoDecimals(parseFloat(value.replace(',', '.')));
  }
  return 0;
};

/**
 * Dia civil (YYYY-MM-DD) para agrupar/filtrar no fluxo.
 * Prioriza `data_lancamento` (data/hora informada pelo utilizador).
 */
export function getDataChaveLancamento(l) {
  const ordem = diaChaveOrdemLancamento(l);
  if (ordem) return ordem;
  if (l?.forma_pagamento_tipo === 'Cartão Crédito' && l?.status_conciliacao === 'Pendente') {
    const d = l.data_liquidacao_prevista || l.data_vencimento;
    if (d) return toLocalDateKey(d);
  }
  const dr = l?.data_pagamento || l?.data_vencimento;
  return dr ? toLocalDateKey(dr) : null;
}

/** Item base para ordenação (transferência consolidada herda do par). */
function itemBaseOrdenacao(item) {
  return item?._lancamentoDespesa || item?._lancamentoReceita || item;
}

function parseInstanteOrdenacao(valor) {
  if (valor == null || valor === '') return null;
  const s = String(valor).trim();
  if (!s) return null;
  if (/^\d{14}$/.test(s)) {
    const iso = instanteDesdeCodigoOrdenacao(s);
    const t = iso ? Date.parse(iso) : NaN;
    return Number.isFinite(t) ? t : null;
  }
  const normalized = s.length === 10 ? `${s}T12:00:00` : s;
  const t = Date.parse(normalized);
  return Number.isFinite(t) ? t : null;
}

/**
 * Timestamp (ms) para desempate quando o código de dia não traz hora (legado).
 */
export function timestampOrdenacaoLancamento(item) {
  const base = itemBaseOrdenacao(item);
  const candidatos = [
    base?.data_lancamento,
    base?.data_movimento,
    base?.created_date,
    base?.updated_date,
    base?.codigo_lancamento,
    base?.data_pagamento,
    base?.data_vencimento,
  ];
  for (const c of candidatos) {
    const t = parseInstanteOrdenacao(c);
    if (t != null) return t;
  }
  return 0;
}

/**
 * Código AAAAMMDDHHMMSS para ordenar lançamentos no fluxo de caixa.
 * Usa `codigo_lancamento` persistido, depois `data_lancamento`, `created_date`
 * ou data de pagamento/vencimento (00:00:00).
 */
export function codigoOrdenacaoLancamento(item) {
  const base = itemBaseOrdenacao(item);
  const codigo = codigoOrdemLancamento(base);
  if (codigo) return codigo;
  if (base?.created_date) {
    const codigoCreated = codigoOrdenacaoDesdeInstante(base.created_date);
    if (codigoCreated) return codigoCreated;
  }
  if (base?.updated_date) {
    const codigoUpdated = codigoOrdenacaoDesdeInstante(base.updated_date);
    if (codigoUpdated) return codigoUpdated;
  }
  const dataComHora = base?.data_movimento || base?.data_lancamento;
  if (dataComHora && String(dataComHora).includes('T')) {
    const codigoInstante = codigoOrdenacaoDesdeInstante(dataComHora);
    if (codigoInstante) return codigoInstante;
  }
  return codigoOrdenacaoDesdeDataSomente(base?.data_pagamento || base?.data_vencimento || base?.data_movimento)
    || '00000000000000';
}

/**
 * Preenche `data_lancamento` e `codigo_lancamento` ao criar um lançamento.
 * Se `dataLancamento` não for informada, usa o instante atual.
 */
export function prepararMetadadosLancamentoFinanceiro({ dataLancamento } = {}) {
  const iso = dataLancamento || agora();
  return {
    data_lancamento: iso,
    codigo_lancamento: codigoOrdenacaoDesdeInstante(iso),
  };
}

/**
 * Ordena lançamentos por código AAAAMMDDHHMMSS; em empate, ordem alfabética (pt-BR).
 * @param {'desc'|'asc'} [ordem] `desc` = mais recente em cima (padrão do fluxo de caixa)
 */
export function sortLancamentosPorCodigo(items, ordem = 'desc') {
  if (!items?.length) return [];
  const asc = ordem === 'asc';
  return [...items].sort((a, b) => {
    const cmp = codigoOrdenacaoLancamento(a).localeCompare(codigoOrdenacaoLancamento(b));
    if (cmp !== 0) return asc ? cmp : -cmp;
    const ta = timestampOrdenacaoLancamento(a);
    const tb = timestampOrdenacaoLancamento(b);
    if (ta !== tb) return asc ? ta - tb : tb - ta;
    const alpha = (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR', { sensitivity: 'base' });
    return asc ? alpha : -alpha;
  });
}

/** @deprecated Nome legado — use `sortLancamentosPorCodigo`. */
export function sortLancamentosPorDescricao(items, ordem = 'desc') {
  return sortLancamentosPorCodigo(items, ordem);
}

/**
 * Exibe código AAAAMMDDHHMMSS em formato legível (dd/MM/yyyy HH:mm:ss).
 */
export function formatarCodigoLancamentoLegivel(codigo) {
  const s = String(codigo || '');
  if (s.length !== 14 || !/^\d{14}$/.test(s)) return null;
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)} ${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}`;
}