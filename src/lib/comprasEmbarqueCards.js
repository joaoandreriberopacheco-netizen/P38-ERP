import { pedidoLiberadoParaLogistica } from '@/lib/aprovarPedidoCompraFinanceiro';
import {
  evidenciaAprovacaoFinanceiraProcessada,
  calcValorTotalPedidoCompra,
  getTotalLinhaPedidoCompra,
} from '@/lib/pedidoCompraFinanceiro';
import { getEmbarqueItensLinhas } from '@/lib/fetchEmbarqueItens';
import {
  calcularPercentuaisLogistica,
  embarqueRecepcaoDocumentalCompleta,
  embarqueTemDespachoInformado,
  embarqueTemSaldoPendente,
} from '@/lib/embarqueLogisticaHelpers';
import { getEmbarqueDataRecebimento } from '@/lib/embarqueRecebimentoDate';
import {
  buildMapaLiberacaoCascataNecessidade,
  embarqueExcluidoDeNecessidade,
  embarqueNecessidadeTemItensPendentes,
  isNecessidadeRenderizada,
  pedidoDeveExibirCardNecessidade,
  pedidoPermiteCardNecessidade,
  quantidadePendenteNecessidadePedido,
} from '@/lib/pedidoCompraNecessidade';
import { isEmbarqueSaldoPendente } from '@/lib/embarqueTipoSaldoPendente';
import {
  SALDO_EMBARQUE_DISPLAY_STATUS,
  buildDisplayItensSaldoEmbarque,
  buildEmbarqueVirtualSaldoEmbarque,
  calcularSaldoEmbarquePorLinha,
  calcValorSaldoEmbarqueLinhas,
  filtrarLinhasComFaltaOperacional,
  isSaldoEmbarqueRenderizado,
  produtosIdsComSaldoPosRecepcaoBd,
  resumirSaldoEmbarquePedido,
} from '@/lib/pedidoCompraSaldoEmbarque';
import { calcValorEmbarqueCard, calcValorEmbarcadoPedido, resolveValorLinhaEmbarqueProporcional } from '@/lib/embarqueValorFinanceiro';
import { resolveEmbarqueQuantidadeBase, resolveEmbarqueQuantidadeComercial } from '@/lib/embarqueQuantityResolve';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { getItemCompraExibicaoVitrine } from '@/lib/productUnits';
import { buildConsultaItensEmbarque, calcConsultaValorEmbarque } from '@/lib/consultaComprasEmbarques';
import {
  ordinalEmbarqueLabel,
  resolveEmbarqueCodigoExibicao,
  sortEmbarquesParaExibicao,
} from '@/lib/embarqueDisplayUtils';

import { COMPRAS_STATUS_FILTRO_AGUARDANDO_PGTO } from '@/lib/comprasEmbarquesPalette';

const STATUS_AGUARDANDO_PAGAMENTO = new Set([
  COMPRAS_STATUS_FILTRO_AGUARDANDO_PGTO,
  'Aguardando Aprovação Financeira',
  'Aguardando Liberação Financeira',
  'Aguardando Liberação',
]);

function hasLinkedItems(embarque) {
  return getEmbarqueItensLinhas(embarque).some(
    (item) => (Number(item?.quantidade_embarcada) || 0) > 0 || (Number(item?.quantidade_recebida) || 0) > 0,
  );
}

function hasDespachoVinculado(embarque) {
  return embarqueTemDespachoInformado(embarque);
}

/** Despachado só com transporte/datas; sem despacho → Pendente (saldo a embarcar). */
function resolveStatusTransitoOuConclusao(embarque) {
  if (!hasDespachoVinculado(embarque)) {
    return embarqueTemSaldoPendente(embarque) || hasLinkedItems(embarque) ? 'Pendente' : 'Concluído';
  }
  return embarqueTemSaldoPendente(embarque) ? 'Despachado' : 'Concluído';
}

function getDisplayEmbarqueCode(pedido, embarque, embarquesDoPedido = []) {
  return resolveEmbarqueCodigoExibicao(
    { ...pedido, _embarques: embarquesDoPedido.length ? embarquesDoPedido : (pedido?._embarques || []) },
    embarque,
  );
}

function getDisplayEmbarqueOrdinal(embarque, pedido, embarquesDoPedido = []) {
  return ordinalEmbarqueLabel(embarque, { ...pedido, _embarques: embarquesDoPedido });
}

export function pedidoNaoConcluido(pedido = {}) {
  const status = String(pedido?.status || '').trim();
  const statusReceb = String(pedido?.status_recebimento_geral || '').trim();
  return status !== 'Concluído' && !statusReceb.startsWith('Concluído');
}

/** Mesma regra visual da lista Embarques (`getBorrowedStatus` em PedidosCompra.jsx). */
export function getBorrowedStatus(pedido, embarque, produtosMap = {}, embarquesDoPedido = []) {
  if (!embarque) return pedido?.status || 'Rascunho';

  const temDespachoVinculado = hasDespachoVinculado(embarque);
  const statusRecebimento = String(
    embarque?.status_recebimento || embarque?.status_recebimento_embarque || '',
  ).trim();
  const recepcaoPendente = !statusRecebimento || statusRecebimento === 'Pendente';
  const temItensAssociados = hasLinkedItems(embarque);
  const exibirNecessidade = pedidoDeveExibirCardNecessidade(pedido, embarquesDoPedido, produtosMap);
  const quantidadePendente = isNecessidadeRenderizada(embarque)
    ? quantidadePendenteNecessidadePedido(pedido, embarquesDoPedido, produtosMap)
    : 0;
  const ehNecessidade = isNecessidadeRenderizada(embarque);
  const ehSaldoEmbarque = isSaldoEmbarqueRenderizado(embarque);
  const precisaPreenchimento = ehNecessidade && !temDespachoVinculado && exibirNecessidade && quantidadePendente > 0;

  if (ehSaldoEmbarque) {
    return SALDO_EMBARQUE_DISPLAY_STATUS;
  }

  if (!pedidoNaoConcluido(pedido) && !(ehNecessidade && exibirNecessidade && quantidadePendente > 0)) {
    return 'Concluído';
  }

  if (embarqueRecepcaoDocumentalCompleta(embarque)) {
    return 'Concluído';
  }

  // Split Necessidade sem transporte/datas — aguardando novo despacho (label: Pendente).
  if (ehNecessidade && !temDespachoVinculado) {
    const temPendencia =
      (exibirNecessidade && quantidadePendente > 0)
      || embarqueNecessidadeTemItensPendentes(embarque);
    return temPendencia ? 'Pendente' : 'Aprovado';
  }

  // Embarque real com despacho informado, aguardando recepção (ex.: AB6-PPQ-B).
  if (
    !ehNecessidade
    && recepcaoPendente
    && embarqueTemSaldoPendente(embarque)
    && temDespachoVinculado
  ) {
    return 'Despachado';
  }

  if (embarqueExcluidoDeNecessidade(pedido, embarque)) {
    if (temDespachoVinculado) {
      return resolveStatusTransitoOuConclusao(embarque);
    }
    return 'Aprovado';
  }

  if (
    statusRecebimento === 'Recebido OK'
    || statusRecebimento === 'Com Divergência'
    || statusRecebimento === 'Recebido Parcial'
    || (!recepcaoPendente && embarque.status === 'Concluído')
  ) {
    return resolveStatusTransitoOuConclusao(embarque);
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
      || pedido?.status === 'Aguardando Liberação Financeira'
      || saf === 'Aguardando Aprovação Financeira'
      || saf === 'Aguardando Liberação Financeira'
    ) {
      return COMPRAS_STATUS_FILTRO_AGUARDANDO_PGTO;
    }

    if (pedidoLiberadoParaLogistica(pedido)) {
      return 'Aprovado';
    }

    return 'Rascunho';
  }

  if (temDespachoVinculado) {
    return 'Despachado';
  }

  if (precisaPreenchimento) {
    return 'Pendente';
  }

  return 'Rascunho';
}

function getEmbarqueDisplayDate(pedido) {
  return pedido?.data_aprovacao_financeira || pedido?.data_emissao || pedido?.created_date;
}

function normalizeDisplayItemCommercial(produto = null, pedidoItem = {}, item = {}) {
  const linhaMerged = { ...pedidoItem, ...item };
  const exibPedido = getItemCompraExibicaoVitrine(pedidoItem, produto);
  const exib = getItemCompraExibicaoVitrine(linhaMerged, produto);
  const lineTotalFull = getTotalLinhaPedidoCompra(pedidoItem || {});
  const quantidadeEmbarcada = resolveEmbarqueQuantidadeComercial(linhaMerged, 'embarcada');
  const quantidadePedida = resolveEmbarqueQuantidadeComercial(
    { ...pedidoItem, ...item },
    'pedida',
  ) || exibPedido.quantidade;

  const qtyKind = quantidadeEmbarcada > 0 ? 'embarcada' : 'pedida';
  const temFatiaEmbarque = quantidadeEmbarcada > 0;
  const quantidadeExibir = temFatiaEmbarque ? quantidadeEmbarcada : exibPedido.quantidade;
  const valorLinha = temFatiaEmbarque
    ? resolveValorLinhaEmbarqueProporcional(
      pedidoItem || {},
      { ...(pedidoItem || {}), ...item },
      lineTotalFull,
      qtyKind,
      produto,
    )
    : lineTotalFull;
  const qtyBaseEmbarque = temFatiaEmbarque
    ? resolveEmbarqueQuantidadeBase(linhaMerged, qtyKind)
    : exibPedido.quantidade_base;

  return {
    produto_id: item.produto_id || pedidoItem?.produto_id,
    produto_nome: item.produto_nome || pedidoItem?.produto_nome,
    quantidade: quantidadeExibir,
    quantidade_embarcada: quantidadeEmbarcada,
    quantidade_pedida: quantidadePedida,
    quantidade_base: qtyBaseEmbarque > 0 ? qtyBaseEmbarque : exib.quantidade_base,
    fator_conversao: exib.fator_conversao,
    unidade_medida: exib.unidade_medida,
    total: valorLinha,
    valor_total_item: valorLinha,
    preco_unitario: quantidadeExibir > 0
      ? roundToTwoDecimals(valorLinha / quantidadeExibir)
      : exib.preco_unitario,
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
    const embarquesDoPedido = sortEmbarquesParaExibicao(embarquesPorPedido[pedido.id] || [], pedido);
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

  const mapaCascataNecessidade = buildMapaLiberacaoCascataNecessidade(
    pedidosComResumoReal,
    embarquesPorPedido,
    produtosMap,
  );
  const pedidosComCascata = pedidosComResumoReal.map((pedido) => ({
    ...pedido,
    _cascata_necessidade_liberada: mapaCascataNecessidade.get(pedido.id) || false,
  }));

  const cardsDeEmbarque = pedidosComCascata.flatMap((pedido) => {
    const embarquesDoPedido = sortEmbarquesParaExibicao(
      embarquesPorPedido[pedido.id] || [],
      pedido,
    );

    const embarquesReais = embarquesDoPedido.filter((embarque) => !isNecessidadeRenderizada(embarque));
    const embarquesNecessidade = embarquesDoPedido.filter((embarque) => isNecessidadeRenderizada(embarque));
    const embarqueOriginal = embarquesReais[0] || null;
    const embarquesNecessidadeComItens = embarquesNecessidade.filter((embarque) => embarqueNecessidadeTemItensPendentes(embarque));
    const produtosNecessidadeBd = produtosIdsComSaldoPosRecepcaoBd(embarquesNecessidadeComItens);
    const saldoVirtual = pedidoPermiteCardNecessidade(pedido)
      ? buildEmbarqueVirtualSaldoEmbarque(pedido, embarquesDoPedido, produtosMap, {
        excluirProdutosIds: produtosNecessidadeBd,
      })
      : null;

    const embarquesNecessidadeLista = embarquesNecessidade.filter(
      (embarque) => embarqueTemDespachoInformado(embarque) || embarqueNecessidadeTemItensPendentes(embarque),
    );

    const embarquesRenderizados = embarquesDoPedido.length > 0
      ? [...embarquesReais, ...embarquesNecessidadeLista, ...(saldoVirtual ? [saldoVirtual] : [])]
        .filter((embarque) => {
          if (embarqueExcluidoDeNecessidade(pedido, embarque)) {
            return !isNecessidadeRenderizada(embarque);
          }
          if (!isNecessidadeRenderizada(embarque)) return true;
          // Split Necessidade sem despacho informado → card Necessidade (não despacho vazio).
          if (!embarqueTemDespachoInformado(embarque) && !embarqueNecessidadeTemItensPendentes(embarque)) {
            return false;
          }
          if (!pedidoPermiteCardNecessidade(pedido)) return false;
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
      const ehSaldoEmbarque = isSaldoEmbarqueRenderizado(embarque);
      const ehNecessidade = !ehSaldoEmbarque && isNecessidadeRenderizada(embarque) && exibirNecessidade && !embarqueExcluidoDeNecessidade(pedido, embarque);
      const itensDoCard = ehSaldoEmbarque
        ? buildDisplayItensSaldoEmbarque(
          pedido,
          filtrarLinhasComFaltaOperacional(
            calcularSaldoEmbarquePorLinha(pedido, embarquesDoPedido, undefined, produtosMap),
          )
            .filter((l) => !produtosNecessidadeBd.has(l.produto_id)),
          produtosMap,
        )
        : ehNecessidade
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

      const displayCode = getDisplayEmbarqueCode(pedido, embarque, embarquesDoPedido);
      const displayStatus = getBorrowedStatus(pedido, embarque, produtosMap, embarquesDoPedido);
      const cardBase = {
        ...pedido,
        _virtual_key: `${pedido.id}_${embarque.id}`,
        _embarque: embarque,
        _display_code: displayCode,
        _display_ordinal: getDisplayEmbarqueOrdinal(embarque, pedido, embarquesDoPedido),
        _display_status: displayStatus,
        _display_valor: ehSaldoEmbarque
          ? calcValorSaldoEmbarqueLinhas(
            pedido,
            filtrarLinhasComFaltaOperacional(
            calcularSaldoEmbarquePorLinha(pedido, embarquesDoPedido, undefined, produtosMap),
          )
              .filter((l) => !produtosNecessidadeBd.has(l.produto_id)),
            produtosMap,
          )
          : hasLinkedItems(embarque) || ehNecessidade
            ? getDisplayValorEmbarque(pedido, embarque, produtosMap, embarquesDoPedido)
            : calcValorTotalPedidoCompra(pedido),
        _display_itens: itensDoCard,
        _display_date: getEmbarqueDisplayDate(pedido),
        _display_fornecedor: pedido.fornecedor_nome || '—',
        _quantidade_pendente: quantidadePendente,
        _is_original: !!embarqueOriginal && embarque.id === embarqueOriginal.id,
        _is_necessidade: ehNecessidade,
        _is_saldo_embarcar: ehSaldoEmbarque,
        _consulta_papel: ehSaldoEmbarque ? 'saldo_a_embarcar' : (ehNecessidade ? 'necessidade' : 'despacho'),
        _embarques: embarquesDoPedido,
      };

      const quantidadePendenteCard = ehSaldoEmbarque
        ? resumirSaldoEmbarquePedido(
          filtrarLinhasComFaltaOperacional(
            calcularSaldoEmbarquePorLinha(pedido, embarquesDoPedido, undefined, produtosMap),
          ).filter((l) => !produtosNecessidadeBd.has(l.produto_id)),
        ).soma_falta_operacional
        : ehNecessidade
          ? quantidadePendente
          : 0;

      return {
        ...cardBase,
        _quantidade_pendente: quantidadePendenteCard,
        _display_data_recebimento: getEmbarqueDataRecebimento(cardBase),
      };
    });
  });

  return { pedidosComResumoReal: pedidosComCascata, cardsDeEmbarque };
}

/** Mesma regra do KPI "aprovados e ainda não recebidos" na lista Embarques. */
export function cardEmbarqueContaEmTransito(card = {}) {
  const status = card._display_status || '';
  if (status === 'Concluído' || status === 'Rascunho') return false;

  const ehNecessidade =
    !!card._is_necessidade || isEmbarqueSaldoPendente(card._embarque);
  const aprovadoFinanceiro =
    pedidoLiberadoParaLogistica(card)
    || status === 'Aprovado'
    || status === 'Despachado'
    || status === 'Pendente'
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

/**
 * Cards da aba «Saldo a embarcar» — um card por pedido com falta operacional (sem trânsito).
 */
export function materializeSaldoEmbarqueCards(pedidos = [], produtosMap = {}) {
  return (pedidos || []).flatMap((pedido) => {
    const embarquesDoPedido = pedido._embarques || [];
    const linhasSaldo = filtrarLinhasComFaltaOperacional(
      calcularSaldoEmbarquePorLinha(pedido, embarquesDoPedido, undefined, produtosMap),
    );
    if (!linhasSaldo.length) return [];

    const resumo = resumirSaldoEmbarquePedido(linhasSaldo);
    const embarque = buildEmbarqueVirtualSaldoEmbarque(pedido, embarquesDoPedido, produtosMap, {
      excluirProdutosIds: new Set(),
    }) || {
      id: `virtual-saldo-${pedido.id}`,
      pedido_compra_id: pedido.id,
      numero: `${pedido.numero || 'PC'}-SAL`,
      tipo: 'SaldoEmbarque',
      status: 'Pendente',
      status_recebimento: 'Pendente',
      observacoes: 'Saldo a embarcar',
      _linhas: [],
      created_date: pedido.created_date,
    };

    const displayItens = buildDisplayItensSaldoEmbarque(pedido, linhasSaldo, produtosMap);
    const displayCode = pedido.numero || embarque.numero;
    const displayValor = calcValorSaldoEmbarqueLinhas(pedido, linhasSaldo, produtosMap);

    return [{
      ...pedido,
      _virtual_key: `${pedido.id}_saldo_embarcar`,
      _embarque: embarque,
      _display_code: displayCode,
      _display_ordinal: 'Saldo',
      _display_status: SALDO_EMBARQUE_DISPLAY_STATUS,
      _display_valor: displayValor,
      _display_itens: displayItens,
      _display_date: getEmbarqueDisplayDate(pedido),
      _display_fornecedor: pedido.fornecedor_nome || '—',
      _quantidade_pendente: resumo.soma_falta_operacional,
      _quantidade_falta_operacional: resumo.soma_falta_operacional,
      _saldo_linhas: linhasSaldo,
      _is_original: false,
      _is_necessidade: false,
      _is_saldo_embarcar: true,
      _consulta_papel: 'saldo_a_embarcar',
      _embarques: embarquesDoPedido,
      _display_data_recebimento: getEmbarqueDataRecebimento({ ...pedido, _embarque: embarque }),
    }];
  });
}
