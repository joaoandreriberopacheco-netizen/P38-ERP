import { pedidoLiberadoParaLogistica } from '@/lib/aprovarPedidoCompraFinanceiro';
import {
  evidenciaAprovacaoFinanceiraProcessada,
  calcValorTotalPedidoCompra,
  getTotalLinhaPedidoCompra,
} from '@/lib/pedidoCompraFinanceiro';
import { getEmbarqueItensLinhas } from '@/lib/fetchEmbarqueItens';
import { calcularPercentuaisLogistica, embarqueRecepcaoDocumentalCompleta, embarqueTemSaldoPendente } from '@/lib/embarqueLogisticaHelpers';
import { getEmbarqueDataRecebimento } from '@/lib/embarqueRecebimentoDate';
import {
  buildEmbarqueVirtualNecessidade,
  embarqueExcluidoDeNecessidade,
  embarqueNecessidadeTemItensPendentes,
  isNecessidadeRenderizada,
  pedidoDeveExibirCardNecessidade,
  quantidadePendenteNecessidadePedido,
} from '@/lib/pedidoCompraNecessidade';
import { calcValorEmbarqueCard, calcValorEmbarcadoPedido } from '@/lib/embarqueValorFinanceiro';
import { commercialQuantityFromBase, getItemCompraExibicaoVitrine } from '@/lib/productUnits';
import { buildConsultaItensEmbarque, calcConsultaValorEmbarque } from '@/lib/consultaComprasEmbarques';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const STATUS_AGUARDANDO_PAGAMENTO = new Set([
  'Aguardando Aprovação Financeira',
  'Aguardando Liberação Financeira',
  'Aguardando Liberação',
  'Aguardando',
]);

function hasLinkedItems(embarque) {
  return getEmbarqueItensLinhas(embarque).some(
    (item) => (Number(item?.quantidade_embarcada) || 0) > 0 || (Number(item?.quantidade_recebida) || 0) > 0,
  );
}

function hasDespachoVinculado(embarque) {
  return !!(embarque?.data_embarque || embarque?.eta || embarque?.transportadora_id || embarque?.transportadora_nome);
}

function getEmbarqueSuffixIndex(embarque, pedido) {
  const embarquesDoPedido = (pedido?._embarques || [])
    .slice()
    .sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0));
  const idxPorOrdem = embarquesDoPedido.findIndex((item) => item.id === embarque?.id);
  return idxPorOrdem >= 0 ? idxPorOrdem : 0;
}

function getEmbarqueSuffix(embarque, pedido) {
  return LETTERS[getEmbarqueSuffixIndex(embarque, pedido)] || 'A';
}

function getDisplayEmbarqueCode(pedido, embarque) {
  const baseCode = String(pedido?.numero || '').replace(/\s+/g, '');
  return `${baseCode}-${getEmbarqueSuffix(embarque, pedido)}`;
}

function getDisplayEmbarqueOrdinal(embarque, pedido) {
  return `#${String(getEmbarqueSuffixIndex(embarque, pedido) + 1).padStart(2, '0')}`;
}

export function pedidoNaoConcluido(pedido = {}) {
  const status = String(pedido?.status || '').trim();
  const statusReceb = String(pedido?.status_recebimento_geral || '').trim();
  return status !== 'Concluído' && !statusReceb.startsWith('Concluído');
}

/** Mesma regra visual da lista Embarques (`getBorrowedStatus` em PedidosCompra.jsx). */
export function getBorrowedStatus(pedido, embarque, produtosMap = {}, embarquesDoPedido = []) {
  if (!embarque) return pedido?.status || 'Rascunho';

  if (!pedidoNaoConcluido(pedido)) {
    return 'Concluído';
  }

  const temDespachoVinculado = hasDespachoVinculado(embarque);
  const statusRecebimento = embarque.status_recebimento;
  const temItensAssociados = hasLinkedItems(embarque);
  const exibirNecessidade = pedidoDeveExibirCardNecessidade(pedido, embarquesDoPedido, produtosMap);
  const quantidadePendente = isNecessidadeRenderizada(embarque)
    ? quantidadePendenteNecessidadePedido(pedido, embarquesDoPedido, produtosMap)
    : 0;
  const ehNecessidade = isNecessidadeRenderizada(embarque);
  const precisaPreenchimento = ehNecessidade && !temDespachoVinculado && exibirNecessidade && quantidadePendente > 0;

  if (embarqueRecepcaoDocumentalCompleta(embarque)) {
    return 'Concluído';
  }

  if (embarqueExcluidoDeNecessidade(pedido, embarque)) {
    if (temDespachoVinculado || temItensAssociados) {
      return embarqueTemSaldoPendente(embarque) ? 'Despachado' : 'Concluído';
    }
    return 'Aguardando';
  }

  if (statusRecebimento === 'Recebido OK' || statusRecebimento === 'Com Divergência' || embarque.status === 'Concluído') {
    return embarqueTemSaldoPendente(embarque) ? 'Despachado' : 'Concluído';
  }

  if (statusRecebimento === 'Recebido Parcial') {
    return embarqueTemSaldoPendente(embarque) ? 'Despachado' : 'Concluído';
  }

  if (ehNecessidade && !temDespachoVinculado) {
    return exibirNecessidade && quantidadePendente > 0 ? 'Necessidade' : 'Aguardando';
  }

  if (!ehNecessidade && !temDespachoVinculado) {
    if (
      pedido._financeiro_aprovado_efetivo
      || evidenciaAprovacaoFinanceiraProcessada(pedido, pedido._lancamentos_compra)
    ) {
      return 'Aprovado';
    }

    const saf = pedido?.status_aprovacao_financeira || '';
    if (
      pedido?.status === 'Aguardando Aprovação Financeira'
      || pedido?.status === 'Aguardando Liberação'
      || saf === 'Aguardando Aprovação Financeira'
    ) {
      return 'Aguardando Liberação Financeira';
    }

    if (pedidoLiberadoParaLogistica(pedido)) {
      return 'Aprovado';
    }

    return 'Rascunho';
  }

  if (temDespachoVinculado || temItensAssociados) {
    return 'Despachado';
  }

  if (precisaPreenchimento) {
    return 'Aguardando';
  }

  return 'Rascunho';
}

function getEmbarqueDisplayDate(pedido) {
  return pedido?.data_aprovacao_financeira || pedido?.data_emissao || pedido?.created_date;
}

function normalizeDisplayItemCommercial(produto = null, pedidoItem = {}, item = {}) {
  const linhaMerged = { ...pedidoItem, ...item };
  const exib = getItemCompraExibicaoVitrine(linhaMerged, produto);
  const totalLinha = getTotalLinhaPedidoCompra(linhaMerged);

  const qEmbInput = Number(item?.quantidade_embarcada);
  const hasEmbarqueQty = Number.isFinite(qEmbInput) && qEmbInput > 0;
  let quantidadeEmbarcada = 0;
  if (hasEmbarqueQty) {
    const embBase = Number(item?.quantidade_base);
    const basePedido = Number(linhaMerged.quantidade_base) || 0;
    const qtyPedidoLinha = Number(pedidoItem?.quantidade) || 0;
    let baseEmb = embBase;
    if (!(baseEmb > 0) && basePedido > 0 && qtyPedidoLinha > 0) {
      baseEmb = (qEmbInput / qtyPedidoLinha) * basePedido;
    } else if (!(baseEmb > 0)) {
      baseEmb = qEmbInput * (Number(pedidoItem?.fator_conversao) || 1);
    }
    quantidadeEmbarcada = commercialQuantityFromBase(
      baseEmb,
      exib.fator_conversao,
      exib.unidade_medida,
    );
  }

  return {
    produto_id: item.produto_id || pedidoItem?.produto_id,
    produto_nome: item.produto_nome || pedidoItem?.produto_nome,
    quantidade: exib.quantidade,
    quantidade_embarcada: quantidadeEmbarcada,
    quantidade_pedida: exib.quantidade,
    quantidade_base: exib.quantidade_base,
    fator_conversao: exib.fator_conversao,
    unidade_medida: exib.unidade_medida,
    total: totalLinha,
    valor_total_item: totalLinha,
  };
}

function buildDisplayItensFromEmbarque(pedido, embarque, produtosMap = {}) {
  return getEmbarqueItensLinhas(embarque).map((item) => {
    const pedidoItem = (pedido.itens || []).find((linha) => linha.produto_id === item.produto_id);
    const produto = produtosMap[item.produto_id] || produtosMap[pedidoItem?.produto_id] || null;
    return normalizeDisplayItemCommercial(produto, pedidoItem, item);
  });
}

function getDisplayValorEmbarque(pedido, embarque, produtosMap = {}, embarquesDoPedido = []) {
  const card = {
    ...pedido,
    _embarque: embarque,
    _is_necessidade: isNecessidadeRenderizada(embarque),
    _embarques: embarquesDoPedido.length ? embarquesDoPedido : (pedido._embarques || []),
  };
  return calcValorEmbarqueCard(card, produtosMap);
}

/** Materializa cards da lista Embarques (mesma lógica de PedidosCompra.jsx). */
export function materializePedidosCompraView(pcs, embarquesDb, produtosMap = {}) {
  const embarquesPorPedido = embarquesDb.reduce((acc, embarque) => {
    const pedidoId = embarque.pedido_compra_id;
    if (!pedidoId) return acc;
    if (!acc[pedidoId]) acc[pedidoId] = [];
    acc[pedidoId].push(embarque);
    return acc;
  }, {});

  const pedidosComResumoReal = pcs.map((pedido) => {
    const embarquesDoPedido = embarquesPorPedido[pedido.id] || [];
    const totalPedido = calcValorTotalPedidoCompra(pedido);
    const valorEmbarcado = calcValorEmbarcadoPedido(pedido, embarquesDoPedido, produtosMap);
    const percentualReal = totalPedido > 0 ? Math.min(100, (valorEmbarcado / totalPedido) * 100) : 0;
    const ultimoEmbarque = [...embarquesDoPedido].sort(
      (a, b) => new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date),
    )[0] || null;

    let statusRecebimentoReal = 'Nenhum';
    if (embarquesDoPedido.length > 0) {
      const recebimentos = embarquesDoPedido.map((embarque) => {
        if (embarqueRecepcaoDocumentalCompleta(embarque)) return 'Recebido OK';
        return embarque.status_recebimento;
      }).filter(Boolean);
      if (recebimentos.some((status) => status === 'Com Divergência')) statusRecebimentoReal = 'Concluído com Divergência';
      else if (recebimentos.length > 0 && recebimentos.every((status) => status === 'Recebido OK')) statusRecebimentoReal = 'Concluído OK';
      else if (recebimentos.some((status) => status === 'Recebido Parcial')) statusRecebimentoReal = 'Recebido Parcial';
      else statusRecebimentoReal = 'Pendente';
    }

    const percentuaisLogistica = calcularPercentuaisLogistica(pedido, embarquesDoPedido);

    let statusEmbarqueReal = 'Nenhum';
    if (embarquesDoPedido.length > 0) {
      statusEmbarqueReal = percentualReal >= 100 ? 'Total' : 'Parcial';
    }

    return {
      ...pedido,
      _embarques: embarquesDoPedido,
      _embarque_principal: ultimoEmbarque,
      percentual_valor_embarcado: percentualReal,
      percentual_concluido: percentuaisLogistica.concluido,
      percentual_despachado: percentuaisLogistica.despachado,
      status_embarque: statusEmbarqueReal,
      status_recebimento_geral: statusRecebimentoReal,
      data_prevista_entrega: ultimoEmbarque?.eta ? String(ultimoEmbarque.eta).slice(0, 10) : pedido.data_prevista_entrega,
    };
  });

  const cardsDeEmbarque = pedidosComResumoReal.flatMap((pedido) => {
    const embarquesDoPedido = (embarquesPorPedido[pedido.id] || []).slice()
      .sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0));

    const embarquesReais = embarquesDoPedido.filter((embarque) => !isNecessidadeRenderizada(embarque));
    const embarquesNecessidade = embarquesDoPedido.filter((embarque) => isNecessidadeRenderizada(embarque));
    const embarqueOriginal = embarquesReais[0] || null;
    const exibirNecessidadeCard = pedidoDeveExibirCardNecessidade(pedido, embarquesDoPedido, produtosMap);
    const embarquesNecessidadeComItens = embarquesNecessidade.filter((embarque) => embarqueNecessidadeTemItensPendentes(embarque));
    const necessidadeVirtual = exibirNecessidadeCard && pedidoNaoConcluido(pedido) && embarquesNecessidadeComItens.length === 0
      ? buildEmbarqueVirtualNecessidade(pedido, embarquesDoPedido, produtosMap)
      : null;

    const embarquesRenderizados = embarquesDoPedido.length > 0
      ? [...embarquesReais, ...embarquesNecessidade, ...(necessidadeVirtual ? [necessidadeVirtual] : [])]
        .filter((embarque) => {
          if (embarqueExcluidoDeNecessidade(pedido, embarque)) {
            return !isNecessidadeRenderizada(embarque);
          }
          if (!isNecessidadeRenderizada(embarque)) return true;
          if (!pedidoNaoConcluido(pedido)) return false;
          return pedidoDeveExibirCardNecessidade(pedido, embarquesDoPedido, produtosMap);
        })
      : [{
        id: `original-${pedido.id}`,
        pedido_compra_id: pedido.id,
        numero: pedido.numero,
        tipo: 'Original',
        status: 'Pendente',
        status_recebimento: 'Pendente',
        observacoes: '',
        created_date: pedido.created_date,
      }];

    return embarquesRenderizados.map((embarque) => {
      const exibirNecessidade = pedidoDeveExibirCardNecessidade(pedido, embarquesDoPedido, produtosMap);
      const quantidadePendente = quantidadePendenteNecessidadePedido(pedido, embarquesDoPedido, produtosMap);
      const ehNecessidade = isNecessidadeRenderizada(embarque) && exibirNecessidade && !embarqueExcluidoDeNecessidade(pedido, embarque);
      const itensDoCard = ehNecessidade
        ? buildDisplayItensFromEmbarque(pedido, embarque, produtosMap)
        : (hasLinkedItems(embarque)
          ? buildDisplayItensFromEmbarque(pedido, embarque, produtosMap)
          : (pedido.itens || []).map((item) => {
            const produto = produtosMap[item.produto_id] || null;
            return normalizeDisplayItemCommercial(produto, item, {
              produto_id: item.produto_id,
              produto_nome: item.produto_nome,
              quantidade: Number(item.quantidade) || 0,
              quantidade_embarcada: 0,
              quantidade_pedida: Number(item.quantidade) || 0,
              quantidade_base: Number(item.quantidade_base) || 0,
              fator_conversao: Number(item.fator_conversao) || 1,
              unidade_medida: item.unidade_medida || '',
            });
          }));

      const displayCode = getDisplayEmbarqueCode(pedido, embarque);
      const displayStatus = getBorrowedStatus(pedido, embarque, produtosMap, embarquesDoPedido);
      const cardBase = {
        ...pedido,
        _virtual_key: `${pedido.id}_${embarque.id}`,
        _embarque: embarque,
        _display_code: displayCode,
        _display_ordinal: getDisplayEmbarqueOrdinal(embarque, { ...pedido, _embarques: embarquesRenderizados }),
        _display_status: displayStatus,
        _display_valor: hasLinkedItems(embarque) || ehNecessidade
          ? getDisplayValorEmbarque(pedido, embarque, produtosMap, embarquesDoPedido)
          : calcValorTotalPedidoCompra(pedido),
        _display_itens: itensDoCard,
        _display_date: getEmbarqueDisplayDate(pedido),
        _display_fornecedor: pedido.fornecedor_nome || '—',
        _quantidade_pendente: quantidadePendente,
        _is_original: !!embarqueOriginal && embarque.id === embarqueOriginal.id,
        _is_necessidade: ehNecessidade,
        _embarques: embarquesDoPedido,
      };

      return {
        ...cardBase,
        _display_data_recebimento: getEmbarqueDataRecebimento(cardBase),
      };
    });
  });

  return { pedidosComResumoReal, cardsDeEmbarque };
}

/** Mesma regra do KPI "aprovados e ainda não recebidos" na lista Embarques. */
export function cardEmbarqueContaEmTransito(card = {}) {
  const status = card._display_status || '';
  if (status === 'Concluído' || status === 'Rascunho') return false;

  const ehNecessidade = !!card._is_necessidade || card._embarque?.tipo === 'Necessidade';
  const aprovadoFinanceiro =
    pedidoLiberadoParaLogistica(card)
    || status === 'Aprovado'
    || status === 'Despachado'
    || status === 'Necessidade';
  if (!aprovadoFinanceiro) return false;

  if (!ehNecessidade && STATUS_AGUARDANDO_PAGAMENTO.has(status)) return false;
  return true;
}

export function filtrarCardsEmbarqueEmTransito(cards = []) {
  return (cards || []).filter(cardEmbarqueContaEmTransito);
}

export function valorPendenteCardEmbarque(card = {}, produtosMap = {}) {
  const itens = buildConsultaItensEmbarque(card, produtosMap, { modo: 'pendente' });
  return calcConsultaValorEmbarque(card, itens, { modo: 'pendente' });
}
