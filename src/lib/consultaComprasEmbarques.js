import { toLocalDateKey } from '@/components/utils/dateUtils';
import { getEmbarqueItensLinhas } from '@/lib/fetchEmbarqueItens';
import { resolveEmbarqueQuantidadeComercial } from '@/lib/embarqueQuantityResolve';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { getTotalLinhaPedidoCompra } from '@/lib/pedidoCompraFinanceiro';
import { getItemCompraExibicaoVitrine } from '@/lib/productUnits';

function isNecessidadeRenderizada(embarque) {
  if (!embarque) return false;
  if (embarque?.tipo === 'Necessidade') return true;
  return !!embarque?.observacoes && String(embarque.observacoes).includes('criado automaticamente para itens pendentes');
}

function hasLinkedItems(embarque) {
  return getEmbarqueItensLinhas(embarque).some(
    (item) => (Number(item?.quantidade_embarcada) || 0) > 0 || (Number(item?.quantidade_recebida) || 0) > 0,
  );
}

function buildLinhaConsultaPendente(pedido, pedidoItem, quantidadePendente, sqlLine = null) {
  const merged = sqlLine ? { ...pedidoItem, ...sqlLine } : { ...(pedidoItem || {}) };
  const exib = getItemCompraExibicaoVitrine(merged);
  const lineTotalFull = getTotalLinhaPedidoCompra(pedidoItem || merged);
  const qtyRef = Number(pedidoItem?.quantidade) || Number(exib.quantidade) || quantidadePendente || 1;
  const valorPendente = qtyRef > 0
    ? roundToTwoDecimals((quantidadePendente / qtyRef) * lineTotalFull)
    : lineTotalFull;

  return {
    produto_id: pedidoItem?.produto_id || sqlLine?.produto_id,
    produto_nome: pedidoItem?.produto_nome || sqlLine?.produto_nome || 'Produto',
    quantidade: quantidadePendente,
    quantidade_pedida: qtyRef,
    unidade_medida: exib.unidade_medida || pedidoItem?.unidade_medida || 'UN',
    fator_conversao: exib.fator_conversao,
    custo_unitario: pedidoItem?.custo_unitario,
    custo_final_unitario: pedidoItem?.custo_final_unitario,
    total: valorPendente,
    valor_total_item: valorPendente,
    preco_unitario: exib.preco_unitario,
  };
}

/** Itens ainda pendentes de recebimento num card de embarque (fonte: linhas SQL EmbarqueItem). */
export function buildConsultaItensPendentes(card = {}) {
  const pedido = card;
  const embarque = card._embarque;
  const ehNecessidade = card._is_necessidade || isNecessidadeRenderizada(embarque);

  if (ehNecessidade) {
    return getEmbarqueItensLinhas(embarque)
      .map((sqlLine) => {
        const pedidoItem = (pedido.itens || []).find((pi) => pi.produto_id === sqlLine.produto_id);
        const qtyPend =
          resolveEmbarqueQuantidadeComercial(sqlLine, 'embarcada')
          || resolveEmbarqueQuantidadeComercial(sqlLine, 'pedida')
          || 0;
        if (qtyPend <= 0) return null;
        return buildLinhaConsultaPendente(pedido, pedidoItem, qtyPend, sqlLine);
      })
      .filter(Boolean);
  }

  if (hasLinkedItems(embarque)) {
    return getEmbarqueItensLinhas(embarque)
      .map((sqlLine) => {
        const pedidoItem = (pedido.itens || []).find((pi) => pi.produto_id === sqlLine.produto_id);
        const qtyEmb = resolveEmbarqueQuantidadeComercial(sqlLine, 'embarcada');
        const qtyRec = resolveEmbarqueQuantidadeComercial(sqlLine, 'recebida');
        const qtyPend = Math.max(0, qtyEmb - qtyRec);
        if (qtyPend <= 0) return null;
        return buildLinhaConsultaPendente(pedido, pedidoItem, qtyPend, sqlLine);
      })
      .filter(Boolean);
  }

  const outrosEmbarques = (pedido._embarques || []).filter(
    (e) => e.id !== embarque?.id && !isNecessidadeRenderizada(e),
  );
  if (outrosEmbarques.some((e) => hasLinkedItems(e))) return [];

  if (card._display_status === 'Concluído') return [];

  return (pedido.itens || [])
    .map((pedidoItem) => {
      const qtyPend = Number(pedidoItem.quantidade) || 0;
      if (qtyPend <= 0) return null;
      return buildLinhaConsultaPendente(pedido, pedidoItem, qtyPend);
    })
    .filter(Boolean);
}

export function calcConsultaValorPendenteEmbarque(card, itensPendentes) {
  const itens = itensPendentes || buildConsultaItensPendentes(card);
  if (!itens.length) return 0;
  return roundToTwoDecimals(
    itens.reduce((acc, item) => acc + (Number(item.valor_total_item) || Number(item.total) || 0), 0),
  );
}

export function enrichEmbarqueParaConsulta(card) {
  const itens = buildConsultaItensPendentes(card);
  return {
    ...card,
    _consulta_itens: itens,
    _consulta_valor: calcConsultaValorPendenteEmbarque(card, itens),
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
