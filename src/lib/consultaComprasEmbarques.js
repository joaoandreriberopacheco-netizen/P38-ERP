import { dataHoje, formatarSoData, toLocalDateKey } from '@/components/utils/dateUtils';
import { getEmbarqueItensLinhas } from '@/lib/fetchEmbarqueItens';
import { resolveEmbarqueQuantidadeComercial, resolveEmbarqueLinhaUnidade, resolveEmbarqueQuantidadeBase } from '@/lib/embarqueQuantityResolve';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { getTotalLinhaPedidoCompra } from '@/lib/pedidoCompraFinanceiro';
import { isNecessidadeRenderizada } from '@/lib/pedidoCompraNecessidade';
import { calculateBaseQuantity, commercialQuantityFromBase, getItemCompraExibicaoVitrine } from '@/lib/productUnits';

const MIN_QTD_PENDENTE_CONSULTA = 0.009;

function hasLinkedItems(embarque) {
  return getEmbarqueItensLinhas(embarque).some(
    (item) => (Number(item?.quantidade_embarcada) || 0) > 0 || (Number(item?.quantidade_recebida) || 0) > 0,
  );
}

function resolveQtyPendenteEmbarqueComercial(sqlLine = {}) {
  const qtyEmb = resolveEmbarqueQuantidadeComercial(sqlLine, 'embarcada');
  const qtyRec = resolveEmbarqueQuantidadeComercial(sqlLine, 'recebida');
  return roundToTwoDecimals(Math.max(0, qtyEmb - qtyRec));
}

/** Embarque concluído na Consulta: não entra na lista (cada split é independente). */
export function isEmbarqueConcluidoParaConsulta(card = {}, embarque = card._embarque) {
  if (!embarque) return false;

  const displayStatus = String(card._display_status || '').trim();
  const statusEmb = String(embarque.status || '').trim();
  const statusReceb = String(embarque.status_recebimento || embarque.status_recebimento_embarque || '').trim();

  if (displayStatus === 'Concluído' || statusEmb === 'Concluído') return true;
  if (statusReceb === 'Recebido OK') return true;

  if (hasLinkedItems(embarque)) {
    return getEmbarqueItensLinhas(embarque).every(
      (line) => resolveQtyPendenteEmbarqueComercial(line) <= MIN_QTD_PENDENTE_CONSULTA,
    );
  }

  return false;
}

/** Linha SQL só com o saldo pendente deste embarque (embarcado − recebido). */
function sqlLineComSaldoPendente(sqlLine = {}) {
  const qtyPendCom = resolveQtyPendenteEmbarqueComercial(sqlLine);
  if (qtyPendCom <= MIN_QTD_PENDENTE_CONSULTA) return null;

  const qtyEmbBase = resolveEmbarqueQuantidadeBase(sqlLine, 'embarcada');
  const qtyRecBase = resolveEmbarqueQuantidadeBase(sqlLine, 'recebida');
  const qtyPendBase = roundToTwoDecimals(Math.max(0, qtyEmbBase - qtyRecBase));
  if (qtyPendBase <= MIN_QTD_PENDENTE_CONSULTA) return null;

  return {
    ...sqlLine,
    quantidade_embarcada_apresentacao: qtyPendCom,
    quantidade_embarcada_comercial: qtyPendCom,
    quantidade_embarcada: qtyPendBase,
    quantidade_embarcada_base: qtyPendBase,
    quantidade_recebida_apresentacao: 0,
    quantidade_recebida_comercial: 0,
    quantidade_recebida: 0,
    quantidade_recebida_base: 0,
  };
}

function resolveQtyBasePedido(pedidoItem = {}, exibPedido = null) {
  const stored = Number(pedidoItem?.quantidade_base);
  if (stored > 0) return stored;
  const exib = exibPedido || getItemCompraExibicaoVitrine(pedidoItem);
  const qty = Number(exib?.quantidade) || Number(pedidoItem?.quantidade) || 0;
  const fator = Number(exib?.fator_conversao) || Number(pedidoItem?.fator_conversao) || 1;
  return calculateBaseQuantity(qty, fator);
}

function buildLinhaConsultaItem(pedido, pedidoItem, sqlLine = null, produto = null, qtyKind = 'embarcada') {
  const linhaPedido = pedidoItem || {};
  const linhaMerged = sqlLine ? { ...linhaPedido, ...sqlLine } : linhaPedido;
  const exibPedido = getItemCompraExibicaoVitrine(linhaPedido, produto);
  const exib = getItemCompraExibicaoVitrine(linhaMerged, produto);
  const unidadeVitrine =
    exib.unidade_medida
    || (sqlLine ? resolveEmbarqueLinhaUnidade(linhaMerged) : null)
    || linhaPedido.unidade_medida
    || 'UN';
  const lineTotalFull = getTotalLinhaPedidoCompra(linhaPedido);
  const qtyBasePedido = resolveQtyBasePedido(linhaPedido, exibPedido) || 1;
  const qtyBaseEmbarque = sqlLine
    ? resolveEmbarqueQuantidadeBase(linhaMerged, qtyKind)
    : qtyBasePedido;

  const valorLinha = qtyBasePedido > 0
    ? roundToTwoDecimals((qtyBaseEmbarque / qtyBasePedido) * lineTotalFull)
    : lineTotalFull;

  const quantidadeDisplay = sqlLine
    ? commercialQuantityFromBase(qtyBaseEmbarque, exib.fator_conversao, unidadeVitrine)
    : exibPedido.quantidade;
  const qShow = quantidadeDisplay > 0 ? quantidadeDisplay : exibPedido.quantidade;
  const precoUnitario = qShow > 0
    ? roundToTwoDecimals(valorLinha / qShow)
    : exib.preco_unitario;

  return {
    produto_id: linhaPedido.produto_id || sqlLine?.produto_id,
    produto_nome: linhaPedido.produto_nome || sqlLine?.produto_nome || 'Produto',
    quantidade: qShow,
    quantidade_pedida: exibPedido.quantidade,
    quantidade_base: qtyBaseEmbarque,
    unidade_medida: unidadeVitrine,
    fator_conversao: exib.fator_conversao,
    custo_unitario: linhaPedido.custo_unitario,
    custo_final_unitario: linhaPedido.custo_final_unitario,
    total: valorLinha,
    valor_total_item: valorLinha,
    preco_unitario: precoUnitario,
  };
}

/**
 * Metodologia consulta por embarque (EmbarqueItem SQL):
 * - Pedido completo primeiro; splits (despacho / Necessidade) são independentes.
 * - Embarque concluído: não aparece na Consulta.
 * - Despacho em trânsito: só saldo pendente deste split (embarcado − recebido).
 * - Necessidade: só o que ainda falta vir neste split.
 */
export function buildConsultaItensEmbarque(card = {}, produtosMap = {}) {
  const pedido = card;
  const embarque = card._embarque;
  const ehNecessidade = card._is_necessidade || isNecessidadeRenderizada(embarque);

  if (isEmbarqueConcluidoParaConsulta(card, embarque)) return [];

  const produtoDaLinha = (pedidoItem, sqlLine) => {
    const pid = pedidoItem?.produto_id || sqlLine?.produto_id;
    return pid ? produtosMap[pid] || null : null;
  };

  if (ehNecessidade) {
    return getEmbarqueItensLinhas(embarque)
      .map((sqlLine) => {
        const pedidoItem = (pedido.itens || []).find((pi) => pi.produto_id === sqlLine.produto_id);
        const qtyPend =
          resolveEmbarqueQuantidadeComercial(sqlLine, 'embarcada')
          || resolveEmbarqueQuantidadeComercial(sqlLine, 'pedida')
          || 0;
        if (qtyPend <= MIN_QTD_PENDENTE_CONSULTA) return null;
        const qtyKind = resolveEmbarqueQuantidadeComercial(sqlLine, 'embarcada') > 0 ? 'embarcada' : 'pedida';
        return buildLinhaConsultaItem(pedido, pedidoItem, sqlLine, produtoDaLinha(pedidoItem, sqlLine), qtyKind);
      })
      .filter(Boolean);
  }

  if (hasLinkedItems(embarque)) {
    return getEmbarqueItensLinhas(embarque)
      .map((sqlLine) => {
        const pedidoItem = (pedido.itens || []).find((pi) => pi.produto_id === sqlLine.produto_id);
        const linhaPendente = sqlLineComSaldoPendente(sqlLine);
        if (!linhaPendente) return null;
        return buildLinhaConsultaItem(
          pedido,
          pedidoItem,
          linhaPendente,
          produtoDaLinha(pedidoItem, linhaPendente),
          'embarcada',
        );
      })
      .filter(Boolean);
  }

  const outrosEmbarques = (pedido._embarques || []).filter(
    (e) => e.id !== embarque?.id && !isNecessidadeRenderizada(e),
  );
  if (outrosEmbarques.some((e) => hasLinkedItems(e))) return [];

  return (pedido.itens || [])
    .map((pedidoItem) => {
      const qty = Number(pedidoItem.quantidade) || 0;
      if (qty <= 0) return null;
      return buildLinhaConsultaItem(
        pedido,
        pedidoItem,
        null,
        produtoDaLinha(pedidoItem, null),
      );
    })
    .filter(Boolean);
}

/** @deprecated alias */
export const buildConsultaItensPendentes = buildConsultaItensEmbarque;

export function calcConsultaValorEmbarque(card, itens) {
  const linhas = itens || buildConsultaItensEmbarque(card);
  if (!linhas.length) return 0;
  return roundToTwoDecimals(
    linhas.reduce((acc, item) => acc + (Number(item.valor_total_item) || Number(item.total) || 0), 0),
  );
}

/** @deprecated alias */
export const calcConsultaValorPendenteEmbarque = calcConsultaValorEmbarque;

export function enrichEmbarqueParaConsulta(card, produtosMap = {}) {
  const itens = buildConsultaItensEmbarque(card, produtosMap);
  const ehNecessidade = card._is_necessidade || isNecessidadeRenderizada(card._embarque);
  return {
    ...card,
    _consulta_itens: itens,
    _consulta_valor: calcConsultaValorEmbarque(card, itens),
    _consulta_papel: ehNecessidade ? 'necessidade' : 'despacho',
  };
}

export function getConsultaEmbarqueSortMeta(card, groupBy) {
  if (groupBy === 'fornecedor') {
    return { value: (card._display_fornecedor || card.fornecedor_nome || '').toLowerCase(), missing: false };
  }
  if (groupBy === 'status') {
    return { value: (card._display_status || card.status || '').toLowerCase(), missing: false };
  }
  if (groupBy === 'data_pedido') {
    const data = card.data_emissao || (card.created_date ? toLocalDateKey(new Date(card.created_date)) : '');
    return { value: data || '0000-00-00', missing: !data };
  }

  const eta = card._embarque?.eta
    ? toLocalDateKey(new Date(card._embarque.eta))
    : (card.data_prevista_entrega || '');
  return { value: eta || '', missing: !eta };
}

export function compareEmbarquesConsulta(a, b, sortOrder, groupBy) {
  const metaA = getConsultaEmbarqueSortMeta(a, groupBy);
  const metaB = getConsultaEmbarqueSortMeta(b, groupBy);

  if (metaA.missing && metaB.missing) {
    return String(a._display_code || a.numero || '').localeCompare(String(b._display_code || b.numero || ''), 'pt-BR');
  }
  if (metaA.missing) return groupBy === 'eta_transportadora' ? -1 : 1;
  if (metaB.missing) return groupBy === 'eta_transportadora' ? 1 : -1;

  const cmp = sortOrder === 'asc'
    ? String(metaA.value).localeCompare(String(metaB.value), 'pt-BR')
    : String(metaB.value).localeCompare(String(metaA.value), 'pt-BR');
  if (cmp !== 0) return cmp;
  return String(a._display_code || a.numero || '').localeCompare(String(b._display_code || b.numero || ''), 'pt-BR');
}

function isSemEtaGrupo(grupo) {
  const eta = String(grupo?.orderValue || '').split('|')[0];
  return eta === 'sem-eta' || grupo?.key === 'eta_transportadora:sem-dados';
}

function compareGruposConsulta(a, b, sortOrder, groupBy) {
  if (groupBy === 'eta_transportadora') {
    const aSem = isSemEtaGrupo(a);
    const bSem = isSemEtaGrupo(b);
    if (aSem !== bSem) return aSem ? -1 : 1;

    const etaA = String(a.orderValue || '').split('|')[0];
    const etaB = String(b.orderValue || '').split('|')[0];

    if (etaA !== 'sem-eta' && etaB !== 'sem-eta') {
      const dateCmp = sortOrder === 'asc'
        ? etaA.localeCompare(etaB, 'pt-BR')
        : etaB.localeCompare(etaA, 'pt-BR');
      if (dateCmp !== 0) return dateCmp;
    }

    return String(a.orderValue).localeCompare(String(b.orderValue), 'pt-BR');
  }

  if (sortOrder === 'asc') return String(a.orderValue).localeCompare(String(b.orderValue), 'pt-BR');
  return String(b.orderValue).localeCompare(String(a.orderValue), 'pt-BR');
}

function getGrupoConsultaMeta(card, groupBy) {
  const embarque = card._embarque;

  if (groupBy === 'fornecedor') {
    const fornecedor = card.fornecedor_nome?.trim() || card._display_fornecedor?.trim() || 'Sem fornecedor';
    return { key: `fornecedor:${fornecedor}`, label: fornecedor, orderValue: fornecedor.toLowerCase() };
  }

  if (groupBy === 'status') {
    const status = card._display_status || card.status || 'Sem status';
    return { key: `status:${status}`, label: status, orderValue: status.toLowerCase() };
  }

  if (groupBy === 'eta_transportadora') {
    const eta = embarque?.eta ? toLocalDateKey(new Date(embarque.eta)) : 'sem-eta';
    const transportadora = embarque?.transportadora_nome?.trim() || 'Sem transportadora';
    const semDados = eta === 'sem-eta' && transportadora === 'Sem transportadora';
    return {
      key: semDados ? 'eta_transportadora:sem-dados' : `eta_transportadora:${eta}:${transportadora}`,
      label: semDados ? 'Sem ETA / Sem transportadora' : `${eta === 'sem-eta' ? 'Sem ETA' : formatarSoData(eta)} · ${transportadora}`,
      orderValue: `${eta}|${transportadora.toLowerCase()}`,
      groupDate: semDados || eta === 'sem-eta' ? 'Sem ETA' : formatarSoData(eta),
      groupCarrier: semDados ? 'Sem transportadora' : transportadora,
    };
  }

  const dataKey = card.data_emissao || (card.created_date ? toLocalDateKey(new Date(card.created_date)) : null);
  const key = dataKey || 'sem-data';
  const hoje = dataHoje();
  let label = 'Sem data';
  if (key !== 'sem-data') {
    label = key === hoje ? 'Hoje' : formatarSoData(key);
  }
  return { key: `data_pedido:${key}`, label, orderValue: key };
}

/** Agrupa cards da consulta por embarque (mesma lógica da lista Embarques). */
export function buildGruposConsultaEmbarques(cards = [], groupBy = 'eta_transportadora', sortOrder = 'asc') {
  const map = {};

  cards.forEach((card) => {
    const meta = getGrupoConsultaMeta(card, groupBy);
    if (!map[meta.key]) {
      map[meta.key] = {
        key: meta.key,
        label: meta.label,
        orderValue: meta.orderValue,
        groupDate: meta.groupDate ?? null,
        groupCarrier: meta.groupCarrier ?? null,
        cards: [],
      };
    }
    map[meta.key].cards.push(card);
  });

  return Object.values(map)
    .sort((a, b) => compareGruposConsulta(a, b, sortOrder, groupBy))
    .map((grupo) => ({
      ...grupo,
      cards: grupo.cards.sort((a, b) => compareEmbarquesConsulta(a, b, sortOrder, groupBy)),
      totalConsulta: roundToTwoDecimals(
        grupo.cards.reduce((acc, c) => acc + (Number(c._consulta_valor) || 0), 0),
      ),
    }));
}
