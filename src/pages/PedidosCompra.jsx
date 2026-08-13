import { useState, useEffect, useMemo } from 'react';
import { useCompactShell } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { buildBypassAuthPayload } from '@/components/auth/operacaoAuthFlags';
import { enviarPedidoCompraFinanceiroLote } from '@/lib/enviarPedidoCompraFinanceiro';
import { pedidoLiberadoParaLogistica } from '@/lib/aprovarPedidoCompraFinanceiro';
import { gerarNumeroSequencial } from '@/lib/gerarNumeroSequencial';
import {
  calcValorItensPedidoCompra,
  calcValorTotalPedidoCompra,
  getTotalLinhaPedidoCompra,
} from '@/lib/pedidoCompraFinanceiro';

import { hydratePedidosCompraItensFromSql } from '@/lib/fetchPedidoCompraItens';
import { hydrateEmbarquesFromSql, getEmbarqueItensLinhas } from '@/lib/fetchEmbarqueItens';
import { fetchPedidosCompraGestaoInicial } from '@/lib/fetchPedidosCompraGestao';
import { carregarProdutosMap } from '@/lib/embarqueVitrineHelpers';
import { qtyEmbarcadaComercialLinha } from '@/lib/embarqueLogisticaHelpers';
import { resolveEmbarqueQuantidadeComercial } from '@/lib/embarqueQuantityResolve';
import { compareEmbarquesConsulta, enrichEmbarqueParaConsulta } from '@/lib/consultaComprasEmbarques';
import { omitPedidoCompraEspelho } from '@/lib/omitEspelhoPersist';
import ImportadorNotaFiscal from '@/components/compras/ImportadorNotaFiscal';
import FiltrosCompras from '@/components/compras/FiltrosCompras';
import ListaPedidosCompra from '@/components/compras/ListaPedidosCompra';
import ConsultaComprasPedidos from '@/components/compras/ConsultaComprasPedidos';
import StatusPedidoCompraPicker from '@/components/compras/StatusPedidoCompraPicker';
import ActionMenuComprasV2 from '@/components/compras/ActionMenuComprasV2';
import EnvioFinanceiroLoteDialog from '@/components/compras/EnvioFinanceiroLoteDialog';
import AtualizarPrecosFiltradosDialog from '@/components/compras/AtualizarPrecosFiltradosDialog';
import PedidosCompraOrganizer from '@/components/compras/PedidosCompraOrganizer';
import { GlacialTabsList, GlacialTabsTrigger } from '@/components/ui/GlacialTabs';
import { Package, Receipt } from 'lucide-react';
import {
  buildPurchaseUnitOptions,
  normalizeUnitCode,
  commercialQuantityFromBase,
  normalizeItemToCanonicalFactorOne,
  getItemCompraExibicaoVitrine,
  linhaPrecoNoEixoFatorUm,
} from '@/lib/productUnits';
import { toLocalDateKey, formatarSoData, dataHoje } from '@/components/utils/dateUtils';
import {
  FILTRO_COMPRAS_SOMENTE_NAO_CONCLUIDOS_DEFAULT,
  FILTRO_COMPRAS_ULTIMOS_30_DIAS_DEFAULT,
  passaFiltroVisibilidadePedidosCompra,
} from '@/lib/filtroVisibilidadePedidosCompra';
const toLocalDate = (d) => toLocalDateKey(new Date(d));

const etaMatchesFilter = (embarque, modo, dataRef, inicial, final) => {
  if (!modo) return true;

  const etaKey = embarque?.eta ? toLocalDateKey(embarque.eta) : '';
  if (!etaKey) return false;

  if (modo === 'antes') {
    return !dataRef || etaKey <= dataRef;
  }
  if (modo === 'depois') {
    return !dataRef || etaKey >= dataRef;
  }
  if (modo === 'entre') {
    if (!inicial && !final) return true;
    if (inicial && etaKey < inicial) return false;
    if (final && etaKey > final) return false;
    return true;
  }
  if (modo === 'personalizado') {
    if (!inicial && !final) return true;
    if (inicial && etaKey < inicial) return false;
    if (final && etaKey > final) return false;
    return true;
  }
  return true;
};

const STATUS_EMBARQUE_VIRTUAIS = [
  'Rascunho',
  'Aguardando',
  'Aguardando Aprovação Financeira',
  'Aguardando Liberação Financeira',
  'Aguardando Liberação',
  'Aprovado',
  'Despachado',
  'Concluído',
];

const normalizeStatusFiltro = (status) => {
  if (status === 'Aguardando Liberação') {
    return ['Aguardando Liberação', 'Aguardando Aprovação Financeira', 'Aguardando Liberação Financeira'];
  }
  return [status];
};

const cardMatchesSearch = (card, searchLower, { includeProdutos = false } = {}) => {
  const embarque = card._embarque;
  if (card.numero?.toLowerCase().includes(searchLower)) return true;
  if (card.fornecedor_nome?.toLowerCase().includes(searchLower)) return true;
  if (embarque?.transportadora_nome?.toLowerCase().includes(searchLower)) return true;
  if (includeProdutos && (card.itens || []).some((item) => item.produto_nome?.toLowerCase().includes(searchLower))) {
    return true;
  }
  return false;
};

const passaFiltrosEmbarqueCard = (
  card,
  {
    search,
    statusSel,
    filtroUltimos30Dias,
    filtroSomenteNaoConcluidos,
    tagsSel,
    dataInicial,
    dataFinal,
    etaFiltroModo,
    etaData,
    etaInicial,
    etaFinal,
    skipSearch = false,
    searchIncludeProdutos = false,
  },
) => {
  const searchLower = search.toLowerCase();
  const dataPedido = card.data_emissao || (card.created_date ? toLocalDate(card.created_date) : '');
  const statusExplicitos = statusSel.filter((status) => status !== '__nao_concluido__');
  const statusPaiSel = statusExplicitos.filter((s) => !STATUS_EMBARQUE_VIRTUAIS.includes(s));
  const statusEmbSel = statusExplicitos.filter((s) => STATUS_EMBARQUE_VIRTUAIS.includes(s));
  const embarque = card._embarque;

  if (!skipSearch && search && !cardMatchesSearch(card, searchLower, { includeProdutos: searchIncludeProdutos })) {
    return false;
  }

  const ocultarConcluidos = (filtroSomenteNaoConcluidos || statusSel.includes('__nao_concluido__'))
    && statusExplicitos.length === 0;
  if (!passaFiltroVisibilidadePedidosCompra(card, {
    somenteNaoConcluidos: ocultarConcluidos,
    ultimos30Dias: filtroUltimos30Dias,
    getDataPedido: (item) => item.data_emissao || (item.created_date ? toLocalDate(item.created_date) : ''),
    isConcluido: (item) => item._display_status === 'Concluído',
  })) return false;

  if (statusExplicitos.length > 0) {
    const statusPaiExpandido = statusPaiSel.flatMap(normalizeStatusFiltro);
    const statusEmbExpandido = statusEmbSel.flatMap(normalizeStatusFiltro);
    const matchPai = statusPaiExpandido.includes(card.status) || statusPaiExpandido.includes(card._display_status);
    const matchEmbarque = statusEmbExpandido.some((s) => {
      if (s === 'Aguardando Embarque') return !embarque?.transportadora_nome && !embarque?.eta;
      if (s === 'Original') return false;
      return embarque?.status_recebimento === s || embarque?.status === s || card._display_status === s;
    });
    if (!matchPai && !matchEmbarque) return false;
  }

  if (tagsSel.length > 0 && !tagsSel.some((t) => (card.tags || []).includes(t))) return false;
  if (dataInicial && (!dataPedido || dataPedido < dataInicial)) return false;
  if (dataFinal && (!dataPedido || dataPedido > dataFinal)) return false;
  if (!etaMatchesFilter(embarque, etaFiltroModo, etaData, etaInicial, etaFinal)) return false;
  return true;
};

const isSemEtaGrupo = (grupo) => {
  const eta = String(grupo?.orderValue || '').split('|')[0];
  return eta === 'sem-eta' || grupo?.key === 'eta_transportadora:sem-dados';
};

const compareGruposPedidosCompra = (a, b, sortOrder, groupBy) => {
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
};

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const isNecessidadeRenderizada = (embarque) => {
  if (!embarque) return false;
  if (embarque?.tipo === 'Necessidade') return true;
  return !!embarque?.observacoes && String(embarque.observacoes).includes('criado automaticamente para itens pendentes');
};

const getEmbarqueSuffixIndex = (embarque, pedido) => {
  const embarquesDoPedido = (pedido?._embarques || [])
    .slice()
    .sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0));
  const idxPorOrdem = embarquesDoPedido.findIndex((item) => item.id === embarque?.id);
  return idxPorOrdem >= 0 ? idxPorOrdem : 0;
};

const getEmbarqueSuffix = (embarque, pedido) => LETTERS[getEmbarqueSuffixIndex(embarque, pedido)] || 'A';

const getDisplayEmbarqueCode = (pedido, embarque) => {
  const baseCode = String(pedido?.numero || '').replace(/\s+/g, '');
  return `${baseCode}-${getEmbarqueSuffix(embarque, pedido)}`;
};

const getDisplayEmbarqueOrdinal = (embarque, pedido) => `#${String(getEmbarqueSuffixIndex(embarque, pedido) + 1).padStart(2, '0')}`;

const hasLinkedItems = (embarque) => getEmbarqueItensLinhas(embarque).some((item) => (Number(item?.quantidade_embarcada) || 0) > 0 || (Number(item?.quantidade_recebida) || 0) > 0);

const hasDespachoVinculado = (embarque) => !!(embarque?.data_embarque || embarque?.eta || embarque?.transportadora_id || embarque?.transportadora_nome);

const getQuantidadePendenteNecessidade = (pedido, embarque) => {
  if (!isNecessidadeRenderizada(embarque)) return 0;

  const itensNecessidade = getEmbarqueItensLinhas(embarque);
  const quantidadeDoEmbarque = itensNecessidade.reduce((acc, item) => {
    return acc + qtyEmbarcadaComercialLinha(item);
  }, 0);

  if (quantidadeDoEmbarque > 0) return quantidadeDoEmbarque;

  return (pedido.itens || []).reduce((acc, item) => {
    const quantidade = Number(item.quantidade) || 0;
    const quantidadeVinculada = Number(item.quantidade_vinculada) || 0;
    return acc + Math.max(0, quantidade - quantidadeVinculada);
  }, 0);
};

const getBorrowedStatus = (pedido, embarque) => {
  if (!embarque) return pedido?.status || 'Rascunho';

  const temDespachoVinculado = hasDespachoVinculado(embarque);
  const statusRecebimento = embarque.status_recebimento;
  const temItensAssociados = hasLinkedItems(embarque);
  const quantidadePendente = getQuantidadePendenteNecessidade(pedido, embarque);
  const ehNecessidade = isNecessidadeRenderizada(embarque);
  const precisaPreenchimento = ehNecessidade && !temDespachoVinculado && quantidadePendente > 0;

  if (statusRecebimento === 'Recebido OK' || statusRecebimento === 'Com Divergência' || embarque.status === 'Concluído') {
    return 'Concluído';
  }

  if (statusRecebimento === 'Recebido Parcial') {
    return 'Despachado';
  }

  if (ehNecessidade && !temDespachoVinculado) {
    return 'Aguardando';
  }

  if (!ehNecessidade && !temDespachoVinculado) {
    const saf = pedido?.status_aprovacao_financeira || '';
    if (
      pedido?.status === 'Aguardando Aprovação Financeira' ||
      pedido?.status === 'Aguardando Liberação' ||
      saf === 'Aguardando Aprovação Financeira'
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
};

const getEmbarqueDisplayDate = (pedido) => pedido?.data_aprovacao_financeira || pedido?.data_emissao || pedido?.created_date;

const pedidoNaoConcluido = (pedido = {}) => {
  const status = String(pedido?.status || '').trim();
  const statusReceb = String(pedido?.status_recebimento_geral || '').trim();
  return status !== 'Concluído' && !statusReceb.startsWith('Concluído');
};

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

  const qtd = Number(item.quantidade_base || item.quantidade) || 0;
  const totalItem = Number(item.total);
  if (Number.isFinite(totalItem) && qtd > 0) {
    const unitFromTotal = totalItem / qtd;
    if (Math.abs(unitFromTotal - baseUnit) > 0.01) return true;
  }

  return false;
};

const getValorUnitarioEfetivoItemPedido = (item = {}, pedido = {}) => {
  const custoUnitario = Number(item.custo_unitario);
  const baseUnit = Number.isFinite(custoUnitario) ? custoUnitario : 0;
  const percentualAjustePedido = getPercentualAjustePedido(pedido);
  const multiplicadorPedido = 1 - (percentualAjustePedido / 100);
  const temAjusteManualItem = hasAjusteManualNoItem(item, baseUnit);

  const custoFinalUnitario = Number(item.custo_final_unitario);
  if (Number.isFinite(custoFinalUnitario) && custoFinalUnitario > 0) {
    return temAjusteManualItem ? custoFinalUnitario : (baseUnit * multiplicadorPedido);
  }

  const qtdBase = Number(item.quantidade_base) || 0;
  const qtdComm = Number(item.quantidade) || 0;
  const fator = Number(item.fator_conversao) || 1;
  const totalItem = Number(item.total);
  if (Number.isFinite(totalItem) && totalItem > 0) {
    const eixoF1 = linhaPrecoNoEixoFatorUm(item);
    const divisor =
      eixoF1 && qtdBase > 0
        ? qtdBase
        : qtdComm > 0
          ? qtdComm
          : qtdBase || qtdComm;
    if (divisor > 0) {
      const unitFromTotal = totalItem / divisor;
      return temAjusteManualItem ? unitFromTotal : baseUnit * multiplicadorPedido;
    }
  }

  const descontoOuAcrescimo = Number(item.valor_desconto_item);
  if (Number.isFinite(custoUnitario) && Number.isFinite(descontoOuAcrescimo)) {
    const unitComAjuste = custoUnitario - descontoOuAcrescimo;
    return temAjusteManualItem ? unitComAjuste : (unitComAjuste * multiplicadorPedido);
  }

  return baseUnit * multiplicadorPedido;
};

/** Exibição em unidade vitrine (CX…); totais vêm do item gravado. */
const normalizeDisplayItemCommercial = (produto = null, pedidoItem = {}, item = {}) => {
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
};

const buildDisplayItensFromEmbarque = (pedido, embarque, produtosMap = {}) => {
  return getEmbarqueItensLinhas(embarque).map((item) => {
    const pedidoItem = (pedido.itens || []).find((pedidoItem) => pedidoItem.produto_id === item.produto_id);
    const produto = produtosMap[item.produto_id] || produtosMap[pedidoItem?.produto_id] || null;
    return normalizeDisplayItemCommercial(produto, pedidoItem, item);
  });
};

/** Valor do card de embarque: parcela proporcional do total do pedido (itens + frete/desconto rateados). */
const getDisplayValorEmbarque = (pedido, embarque) => {
  const itensEmbarque = getEmbarqueItensLinhas(embarque);
  const valorItensPedido = calcValorItensPedidoCompra(pedido);
  if (!itensEmbarque.length) return calcValorTotalPedidoCompra(pedido);

  let valorEmbarqueItens = 0;
  for (const itemEmb of itensEmbarque) {
    const pedidoItem = (pedido.itens || []).find((pi) => pi.produto_id === itemEmb.produto_id);
    if (!pedidoItem) continue;
    const lineTotal = getTotalLinhaPedidoCompra(pedidoItem);
    const qtyEmb =
      Number(itemEmb.quantidade_embarcada) ||
      Number(itemEmb.quantidade_pedida) ||
      Number(itemEmb.quantidade) ||
      0;
    const qtyPed = Number(pedidoItem.quantidade) || 0;
    if (qtyPed > 0 && lineTotal > 0) {
      valorEmbarqueItens += (qtyEmb / qtyPed) * lineTotal;
    } else if (lineTotal > 0) {
      valorEmbarqueItens += lineTotal;
    }
  }

  if (!valorItensPedido) return Number(valorEmbarqueItens.toFixed(2));

  const frete = Number(pedido?.valor_frete) || 0;
  const desconto = Number(pedido?.valor_desconto) || 0;
  const proporcao = valorEmbarqueItens / valorItensPedido;
  return Number((valorEmbarqueItens + proporcao * (frete - desconto)).toFixed(2));
};

const buildVirtualNecessidade = (pedido, embarquesDoPedido) => {
  const embarquesReais = (embarquesDoPedido || []).filter((embarque) => !isNecessidadeRenderizada(embarque));
  const temDespachoReal = embarquesReais.some((embarque) => hasLinkedItems(embarque) && hasDespachoVinculado(embarque));
  if (!temDespachoReal) return null;

  const recebidosPorProduto = embarquesReais.reduce((acc, embarque) => {
    getEmbarqueItensLinhas(embarque).forEach((item) => {
      const produtoId = item.produto_id;
      if (!produtoId) return;
      const recebido =
        resolveEmbarqueQuantidadeComercial(item, 'recebida')
        || resolveEmbarqueQuantidadeComercial(item, 'embarcada');
      acc[produtoId] = (acc[produtoId] || 0) + recebido;
    });
    return acc;
  }, {});

  const itensPendentes = (pedido.itens || []).map((item) => {
    const quantidadePedida = Number(item.quantidade) || 0;
    const quantidadeRecebida = Number(recebidosPorProduto[item.produto_id]) || 0;
    const quantidadePendente = Math.max(0, quantidadePedida - quantidadeRecebida);
    if (!quantidadePendente) return null;
    return {
      produto_id: item.produto_id,
      produto_nome: item.produto_nome,
      quantidade_pedida: quantidadePedida,
      quantidade_embarcada: quantidadePendente,
      quantidade_recebida: 0,
      unidade_medida: item.unidade_medida || '',
    };
  }).filter(Boolean);

  if (!itensPendentes.length) return null;

  return {
    id: `virtual-necessidade-${pedido.id}`,
    pedido_compra_id: pedido.id,
    numero: `${pedido.numero || 'PC'}-NEC`,
    tipo: 'Necessidade',
    status: 'Pendente',
    status_recebimento: 'Pendente',
    observacoes: 'Embarque de necessidade criado automaticamente para itens pendentes.',
    _linhas: itensPendentes,
    _itens_fonte: 'virtual',
    created_date: new Date().toISOString(),
  };
};

function materializePedidosCompraView(pcs, embarquesDb, produtosMap = {}) {
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
    const valorEmbarcado = embarquesDoPedido.reduce((acc, embarque) => {
        const valorEmbarque = getEmbarqueItensLinhas(embarque).reduce((itemAcc, item) => {
        const pedidoItem = (pedido.itens || []).find((candidate) => candidate.produto_id === item.produto_id);
        const custoUnitarioEfetivo = getValorUnitarioEfetivoItemPedido(pedidoItem || {}, pedido);
        return itemAcc + ((Number(item.quantidade_embarcada) || 0) * custoUnitarioEfetivo);
      }, 0);
      return acc + valorEmbarque;
    }, 0);
    const percentualReal = totalPedido > 0 ? Math.min(100, (valorEmbarcado / totalPedido) * 100) : 0;
    const ultimoEmbarque = [...embarquesDoPedido].sort((a, b) => new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date))[0] || null;

    let statusRecebimentoReal = 'Nenhum';
    if (embarquesDoPedido.length > 0) {
      const recebimentos = embarquesDoPedido.map((embarque) => embarque.status_recebimento).filter(Boolean);
      if (recebimentos.some((status) => status === 'Com Divergência')) statusRecebimentoReal = 'Concluído com Divergência';
      else if (recebimentos.length > 0 && recebimentos.every((status) => status === 'Recebido OK')) statusRecebimentoReal = 'Concluído OK';
      else if (recebimentos.some((status) => status === 'Recebido Parcial')) statusRecebimentoReal = 'Recebido Parcial';
      else statusRecebimentoReal = 'Pendente';
    }

    let statusEmbarqueReal = 'Nenhum';
    if (embarquesDoPedido.length > 0) {
      statusEmbarqueReal = percentualReal >= 100 ? 'Total' : 'Parcial';
    }

    return {
      ...pedido,
      _embarques: embarquesDoPedido,
      _embarque_principal: ultimoEmbarque,
      percentual_valor_embarcado: percentualReal,
      status_embarque: statusEmbarqueReal,
      status_recebimento_geral: statusRecebimentoReal,
      data_prevista_entrega: ultimoEmbarque?.eta ? String(ultimoEmbarque.eta).slice(0, 10) : pedido.data_prevista_entrega,
    };
  });

  const cardsDeEmbarque = pcs.flatMap((pedido) => {
    const embarquesDoPedido = (embarquesPorPedido[pedido.id] || []).slice()
      .sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0));

    const embarquesReais = embarquesDoPedido.filter((embarque) => !isNecessidadeRenderizada(embarque));
    const embarquesNecessidade = embarquesDoPedido.filter((embarque) => isNecessidadeRenderizada(embarque));
    const embarqueOriginal = embarquesReais[0] || null;
    const necessidadeVirtual = embarquesNecessidade.length === 0 ? buildVirtualNecessidade(pedido, embarquesDoPedido) : null;

    const embarquesRenderizados = embarquesDoPedido.length > 0
      ? [...embarquesReais, ...embarquesNecessidade, ...(necessidadeVirtual ? [necessidadeVirtual] : [])]
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
      const quantidadePendente = getQuantidadePendenteNecessidade(pedido, embarque);
      const ehNecessidade = isNecessidadeRenderizada(embarque);
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
                }, pedido);
              }));

      return {
        ...pedido,
        _virtual_key: `${pedido.id}_${embarque.id}`,
        _embarque: embarque,
        _display_code: getDisplayEmbarqueCode(pedido, embarque),
        _display_ordinal: getDisplayEmbarqueOrdinal(embarque, { ...pedido, _embarques: embarquesRenderizados }),
        _display_status: getBorrowedStatus(pedido, embarque),
        _display_valor: hasLinkedItems(embarque) || ehNecessidade ? getDisplayValorEmbarque(pedido, embarque, produtosMap) : calcValorTotalPedidoCompra(pedido),
        _display_itens: itensDoCard,
        _display_date: getEmbarqueDisplayDate(pedido),
        _display_fornecedor: pedido.fornecedor_nome || '—',
        _quantidade_pendente: quantidadePendente,
        _is_original: !!embarqueOriginal && embarque.id === embarqueOriginal.id,
        _is_necessidade: ehNecessidade,
      };
    });
  });

  return { pedidosComResumoReal, cardsDeEmbarque };
}

export default function PedidosCompraPage() {
  const isPhone = useCompactShell();
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState([]);
  const [embarques, setEmbarques] = useState([]);
  const [search, setSearch] = useState('');
  const [statusSel, setStatusSel] = useState([]);
  const [filtroUltimos30Dias, setFiltroUltimos30Dias] = useState(FILTRO_COMPRAS_ULTIMOS_30_DIAS_DEFAULT);
  const [filtroSomenteNaoConcluidos, setFiltroSomenteNaoConcluidos] = useState(FILTRO_COMPRAS_SOMENTE_NAO_CONCLUIDOS_DEFAULT);
  const [tagsSel, setTagsSel] = useState([]);
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [etaFiltroModo, setEtaFiltroModo] = useState('');
  const [etaData, setEtaData] = useState('');
  const [etaInicial, setEtaInicial] = useState('');
  const [etaFinal, setEtaFinal] = useState('');
  const [showImportador, setShowImportador] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selecionadosIds, setSelecionadosIds] = useState([]);
  const [enviandoLote, setEnviandoLote] = useState(false);
  const [modoSelecao, setModoSelecao] = useState(false);
  const [showEnvioDialog, setShowEnvioDialog] = useState(false);
  const [formaPagamentoLote, setFormaPagamentoLote] = useState('Parcelado');
  const [dataPrimeiroVencimentoLote, setDataPrimeiroVencimentoLote] = useState('');
  const [groupBy, setGroupBy] = useState('eta_transportadora');
  const [sortOrder, setSortOrder] = useState('asc');
  const [activeView, setActiveView] = useState('embarques');
  const [showAtualizarPrecosFiltrados, setShowAtualizarPrecosFiltrados] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const gestao = await fetchPedidosCompraGestaoInicial(base44);

      const pcs = gestao.pedidos;
      const embarquesHeaders = gestao.embarques;

      const primeiraPassagem = materializePedidosCompraView(pcs, embarquesHeaders, {});
      setPedidos(primeiraPassagem.pedidosComResumoReal);
      setEmbarques(primeiraPassagem.cardsDeEmbarque);
      setLoading(false);

      const embarquesDb = await hydrateEmbarquesFromSql(base44, embarquesHeaders);
      const produtoIds = [...new Set([
        ...pcs.flatMap((p) => (p.itens || []).map((i) => i.produto_id).filter(Boolean)),
        ...embarquesDb.flatMap((e) => getEmbarqueItensLinhas(e).map((i) => i.produto_id).filter(Boolean)),
      ])];
      const produtosMap = await carregarProdutosMap(produtoIds.map((id) => ({ produto_id: id })));
      const refinado = materializePedidosCompraView(pcs, embarquesDb, produtosMap);
      setPedidos(refinado.pedidosComResumoReal);
      setEmbarques(refinado.cardsDeEmbarque);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error(error?.message || 'Erro ao carregar embarques');
      setLoading(false);
    }
  };

  const handleSave = async (pedidoData) => {
    const sanitizedDataBase = {
      ...pedidoData,
      valor_total: Number(pedidoData.valor_total) || 0,
    };
    const sanitizedData = omitPedidoCompraEspelho(
      (pedidoNaoConcluido(sanitizedDataBase) && Array.isArray(sanitizedDataBase.itens))
        ? { ...sanitizedDataBase, itens: sanitizedDataBase.itens.map((item) => normalizeItemToCanonicalFactorOne(item, 'custo')) }
        : sanitizedDataBase,
    );

    if (sanitizedData.id) {
      await base44.entities.PedidoCompra.update(sanitizedData.id, sanitizedData);
    } else {
      const { id, ...newPedido } = sanitizedData;
      if (!newPedido.numero) {
        newPedido.numero = await gerarNumeroSequencial('PC');
      }
      await base44.entities.PedidoCompra.create(newPedido);
    }
    await loadData();
  };

  const handleDownloadTemplate = () => {
    navigate('/TemplatesCompra');
  };

  const handleOpenPedido = (pedido) => {
    navigate(`/PedidoCompraDetalhe?id=${pedido.id}${pedido._embarque?.id ? `&embarque=${pedido._embarque.id}` : ''}`);
  };

  const handleNovoPedido = () => {
    navigate('/PedidoCompraDetalhe?id=novo');
  };

  const handleImportarPedido = () => {
    navigate('/PedidoCompraDetalhe?id=novo&autoImportador=1');
  };

  const handleToggleSelecao = (pedido) => {
    setSelecionadosIds((prev) => prev.includes(pedido.id)
      ? prev.filter((id) => id !== pedido.id)
      : [...prev, pedido.id]);
  };

  const handleToggleModoSelecao = () => {
    setModoSelecao((prev) => !prev);
    setSelecionadosIds([]);
  };

  const handleAbrirEnvioFinanceiroLote = () => {
    if (!selecionadosIds.length) {
      toast.error('Selecione ao menos um pedido');
      return;
    }
    if (!dataPrimeiroVencimentoLote) {
      setDataPrimeiroVencimentoLote(dataHoje());
    }
    setShowEnvioDialog(true);
  };

  const confirmarEnvioFinanceiroLote = async () => {
    if (!selecionadosIds.length) {
      toast.error('Selecione ao menos um pedido');
      return;
    }

    if (!dataPrimeiroVencimentoLote) {
      toast.error('Informe a data de pagamento ou primeiro vencimento');
      return;
    }

    const pedidosPorId = Object.fromEntries(
      pedidos.filter((p) => selecionadosIds.includes(p.id)).map((p) => [p.id, p]),
    );
    const idsUnicos = [...new Set(selecionadosIds)];

    if (!idsUnicos.length) {
      toast.error('Nenhum pedido válido na seleção');
      return;
    }

    setEnviandoLote(true);
    try {
      const user = await base44.auth.me();
      const authData = await buildBypassAuthPayload(() => base44.auth.me());
      const { enviados, erros } = await enviarPedidoCompraFinanceiroLote({
        base44,
        pedidoIds: idsUnicos,
        pedidosPorId,
        user,
        formaPagamento: formaPagamentoLote,
        dataPrimeiroVencimento: dataPrimeiroVencimentoLote,
        authData,
      });

      setSelecionadosIds([]);
      setModoSelecao(false);
      setShowEnvioDialog(false);

      if (enviados.length) {
        toast.success(`${enviados.length} pedido(s) enviados ao financeiro com conta a pagar criada`);
      }
      if (erros.length) {
        toast.error(
          `${erros.length} pedido(s) não enviados`,
          { description: erros.map((e) => `${e.numero}: ${e.mensagem}`).join(' · ') },
        );
      }

      await loadData();
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'Erro ao enviar pedidos em lote');
    } finally {
      setEnviandoLote(false);
    }
  };

  const todasTags = useMemo(() => {
    const set = new Set();
    pedidos.forEach(p => (p.tags || []).forEach(t => t && set.add(t)));
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [pedidos]);

  const filtrosCompras = useMemo(
    () => ({
      search,
      statusSel,
      filtroUltimos30Dias,
      filtroSomenteNaoConcluidos,
      tagsSel,
      dataInicial,
      dataFinal,
      etaFiltroModo,
      etaData,
      etaInicial,
      etaFinal,
    }),
    [
      search,
      statusSel,
      filtroUltimos30Dias,
      filtroSomenteNaoConcluidos,
      tagsSel,
      dataInicial,
      dataFinal,
      etaFiltroModo,
      etaData,
      etaInicial,
      etaFinal,
    ],
  );

  const filtrados = useMemo(
    () => embarques.filter((card) => passaFiltrosEmbarqueCard(card, filtrosCompras)),
    [embarques, filtrosCompras],
  );

  const filtradosSemBusca = useMemo(
    () => embarques.filter((card) => passaFiltrosEmbarqueCard(card, { ...filtrosCompras, skipSearch: true })),
    [embarques, filtrosCompras],
  );

  const calcularValorPendentePedido = (pedido) => {
    const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
    const embarques = Array.isArray(pedido._embarques) ? pedido._embarques : [];

    const recebidosPorProduto = embarques.reduce((acc, embarque) => {
      getEmbarqueItensLinhas(embarque).forEach((item) => {
        const produtoId = item.produto_id;
        if (!produtoId) return;
        acc[produtoId] = (acc[produtoId] || 0) + (Number(item.quantidade_recebida) || 0);
      });
      return acc;
    }, {});

    return itens.reduce((acc, item) => {
      const quantidade = Number(item.quantidade) || 0;
      const recebida = recebidosPorProduto[item.produto_id] || 0;
      const pendente = Math.max(0, quantidade - recebida);
      const custoUnitario = getValorUnitarioEfetivoItemPedido(item, pedido);
      return acc + (pendente * custoUnitario);
    }, 0);
  };

  const pedidosPagosPendentes = useMemo(() => {
    return filtrados.filter((pedido) => {
      const aprovadoFinanceiro =
        pedidoLiberadoParaLogistica(pedido) ||
        pedido._display_status === 'Aprovado';
      const ehNecessidade = !!pedido._is_necessidade || pedido._embarque?.tipo === 'Necessidade';
      const aindaNaoRecebido = pedido._display_status !== 'Concluído';
      const aindaNaoEhAguardandoPagamento = ehNecessidade || !['Aguardando Aprovação Financeira', 'Aguardando Liberação Financeira', 'Aguardando Liberação', 'Aguardando'].includes(pedido._display_status);
      return aprovadoFinanceiro && aindaNaoRecebido && aindaNaoEhAguardandoPagamento;
    });
  }, [filtrados]);

  const valorTotal = useMemo(() => {
    return filtrados.reduce((acc, pedido) => acc + (pedido._display_valor ?? pedido.valor_total ?? 0), 0);
  }, [filtrados]);

  const valorPagoNaoEntregue = useMemo(() => {
    return pedidosPagosPendentes.reduce((acc, pedido) => acc + Number(pedido._display_valor || 0), 0);
  }, [pedidosPagosPendentes]);

  const STATUS_VIRTUAL_CONCLUIDOS = ['Recebido OK', 'Concluído'];

  const grupos = useMemo(() => {
    const getGroupMeta = (pedido, embarque) => {
      if (groupBy === 'fornecedor') {
        const fornecedor = pedido.fornecedor_nome?.trim() || 'Sem fornecedor';
        return { key: `fornecedor:${fornecedor}`, label: fornecedor, orderValue: fornecedor.toLowerCase() };
      }

      if (groupBy === 'status') {
        const status = pedido._display_status || pedido.status || 'Sem status';
        return { key: `status:${status}`, label: status, orderValue: status.toLowerCase() };
      }

      if (groupBy === 'eta_transportadora') {
        const eta = embarque?.eta ? toLocalDate(embarque.eta) : 'sem-eta';
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

      const dataKey = pedido.data_emissao || (pedido.created_date ? toLocalDate(pedido.created_date) : null);
      const key = dataKey || 'sem-data';
      const hoje = dataHoje();
      let label = 'Sem data';
      if (key !== 'sem-data') {
        label = key === hoje ? 'Hoje' : formatarSoData(key);
      }
      return { key: `data_pedido:${key}`, label, orderValue: key };
    };

    const compareValues = (a, b) => {
      if (sortOrder === 'asc') return String(a).localeCompare(String(b), 'pt-BR');
      return String(b).localeCompare(String(a), 'pt-BR');
    };

    const map = {};

    filtrados.forEach((pedido) => {
      const embarque = pedido._embarque;
      const meta = getGroupMeta(pedido, embarque);

      if (!map[meta.key]) {
        map[meta.key] = {
          key: meta.key,
          label: meta.label,
          orderValue: meta.orderValue,
          groupDate: meta.groupDate ?? null,
          groupCarrier: meta.groupCarrier ?? null,
          pedidos: [],
        };
      }

      map[meta.key].pedidos.push({
        ...pedido,
        _is_virtual_concluido: STATUS_VIRTUAL_CONCLUIDOS.includes(pedido._display_status),
        valor_pendente_entrega: pedido.status === 'Concluído' ? 0 : calcularValorPendentePedido(pedido)
      });
    });

    return Object.values(map)
      .sort((a, b) => compareGruposPedidosCompra(a, b, sortOrder, groupBy))
      .map((grupo) => {
        const pedidosSort = grupo.pedidos.sort((a, b) => {
          const valorA = a.data_emissao || a.created_date || '';
          const valorB = b.data_emissao || b.created_date || '';
          return compareValues(valorA, valorB);
        });

        return {
          key: grupo.key,
          label: grupo.label,
          groupDate: grupo.groupDate,
          groupCarrier: grupo.groupCarrier,
          pedidos: pedidosSort,
          _total_eta: pedidosSort.reduce((acc, p) => acc + (p._display_valor || 0), 0)
        };
      });
  }, [filtrados, groupBy, sortOrder]);

  const hasEtaFilter = etaFiltroModo && (
    (['antes', 'depois'].includes(etaFiltroModo) && etaData) ||
    (etaFiltroModo === 'entre' && (etaInicial || etaFinal)) ||
    (etaFiltroModo === 'personalizado' && (etaInicial || etaFinal))
  );
  const hasActiveFilters = search || tagsSel.length > 0 || dataInicial || dataFinal || hasEtaFilter || statusSel.length > 0
    || filtroUltimos30Dias !== FILTRO_COMPRAS_ULTIMOS_30_DIAS_DEFAULT
    || filtroSomenteNaoConcluidos !== FILTRO_COMPRAS_SOMENTE_NAO_CONCLUIDOS_DEFAULT;

  const pedidosConsulta = useMemo(() => {
    const keysVisiveis = new Set(filtrados.map((card) => card._virtual_key));

    if (search) {
      const searchLower = search.toLowerCase();
      filtradosSemBusca.forEach((card) => {
        if (keysVisiveis.has(card._virtual_key)) return;
        if (cardMatchesSearch(card, searchLower, { includeProdutos: true })) {
          keysVisiveis.add(card._virtual_key);
        }
      });
    }

    return embarques
      .filter((card) => keysVisiveis.has(card._virtual_key))
      .map(enrichEmbarqueParaConsulta)
      .filter((card) => (card._consulta_itens || []).length > 0)
      .sort((a, b) => compareEmbarquesConsulta(a, b, sortOrder, groupBy));
  }, [filtrados, filtradosSemBusca, embarques, search, sortOrder, groupBy]);

  return (
    <div className={cn('w-full min-w-0 max-w-full overflow-x-hidden space-y-4 font-din-1451 bg-background', isPhone && 'pb-[var(--p38-scroll-pad-below-nav)]')}>
      {/* Header */}
      <div className="pb-3 mb-1 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <p className="text-xl font-medium text-foreground font-din-1451">
            {activeView === 'consulta' ? 'Consulta de compras' : 'Embarques'}
          </p>
          {activeView === 'consulta' ? (
            <p className="text-sm leading-normal text-foreground/85 font-din-1451">
              {pedidosConsulta.length} embarque{pedidosConsulta.length === 1 ? '' : 's'} no período
            </p>
          ) : (
            <>
              <p className="text-sm leading-normal text-foreground/85 font-din-1451">{filtrados.length} embarques visíveis · R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <p className="text-sm leading-normal text-emerald-600 dark:text-emerald-400">Aprovados financeiramente e ainda não recebidos no filtro: R$ {valorPagoNaoEntregue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </>
          )}
        </div>
        {activeView === 'embarques' || activeView === 'consulta' ? (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {activeView === 'consulta' && pedidosConsulta.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowAtualizarPrecosFiltrados(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card shadow-sm text-sm font-medium text-foreground hover:shadow-md transition"
              >
                Atualizar preços
              </button>
            ) : null}
            <PedidosCompraOrganizer
              groupBy={groupBy}
              sortOrder={sortOrder}
              onGroupByChange={setGroupBy}
              onSortOrderToggle={() => setSortOrder((prev) => prev === 'asc' ? 'desc' : 'asc')}
            />
            <StatusPedidoCompraPicker
              statusSel={statusSel}
              onStatusSel={setStatusSel}
              onFiltroSomenteNaoConcluidos={setFiltroSomenteNaoConcluidos}
            />
          </div>
        ) : null}
      </div>

      <GlacialTabsList className="w-full" scrollable>
        <GlacialTabsTrigger value="embarques" activeValue={activeView} onSelect={setActiveView} label="Embarques" icon={Package} />
        <GlacialTabsTrigger value="consulta" activeValue={activeView} onSelect={setActiveView} label="Consulta" icon={Receipt} />
      </GlacialTabsList>

      {/* Filtros */}
      <FiltrosCompras
        search={search} onSearch={setSearch}
        filtroUltimos30Dias={filtroUltimos30Dias} onFiltroUltimos30Dias={setFiltroUltimos30Dias}
        filtroSomenteNaoConcluidos={filtroSomenteNaoConcluidos} onFiltroSomenteNaoConcluidos={setFiltroSomenteNaoConcluidos}
        statusSel={statusSel} onStatusSel={setStatusSel}
        todasTags={todasTags} tagsSel={tagsSel} onTagsSel={setTagsSel}
        dataInicial={dataInicial} onDataInicial={setDataInicial}
        dataFinal={dataFinal} onDataFinal={setDataFinal}
        etaFiltroModo={etaFiltroModo} onEtaFiltroModo={setEtaFiltroModo}
        etaData={etaData} onEtaData={setEtaData}
        etaInicial={etaInicial} onEtaInicial={setEtaInicial}
        etaFinal={etaFinal} onEtaFinal={setEtaFinal}
        hasActiveFilters={hasActiveFilters}
        onLimparFiltros={() => {
          setSearch('');
          setStatusSel([]);
          setFiltroUltimos30Dias(FILTRO_COMPRAS_ULTIMOS_30_DIAS_DEFAULT);
          setFiltroSomenteNaoConcluidos(FILTRO_COMPRAS_SOMENTE_NAO_CONCLUIDOS_DEFAULT);
          setTagsSel([]);
          setDataInicial('');
          setDataFinal('');
          setEtaFiltroModo('');
          setEtaData('');
          setEtaInicial('');
          setEtaFinal('');
        }}
      />

      {activeView === 'embarques' ? (
        <ListaPedidosCompra
          grupos={grupos}
          loading={loading}
          onEdit={handleOpenPedido}
          onDelete={loadData}
          selecionadosIds={selecionadosIds}
          onToggleSelecao={handleToggleSelecao}
          modoSelecao={modoSelecao}
        />
      ) : loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-border/40" />
        </div>
      ) : (
        <ConsultaComprasPedidos
          pedidosFiltrados={pedidosConsulta}
          onVerPedido={handleOpenPedido}
          groupBy={groupBy}
          sortOrder={sortOrder}
          contextLabel="Resumo do período"
          emptyMessage="Nenhum embarque no período selecionado"
        />
      )}



      <ImportadorNotaFiscal 
        isOpen={showImportador}
        onClose={() => setShowImportador(false)}
        onSuccess={loadData}
      />

      {/* Menu de ações FAB */}
      <ActionMenuComprasV2
        onNovopedido={handleNovoPedido}
        onImportarPedido={handleImportarPedido}
        onImportarNF={() => setShowImportador(true)}
        onDownloadTemplate={handleDownloadTemplate}
        onEnviarFinanceiroLote={handleAbrirEnvioFinanceiroLote}
        onToggleModoSelecao={handleToggleModoSelecao}
        onAtualizarPrecosFiltrados={() => setShowAtualizarPrecosFiltrados(true)}
        modoSelecao={modoSelecao}
        quantidadeSelecionados={selecionadosIds.length}
        enviandoLote={enviandoLote}
        pedidos={filtrados}
        filtrosDesc={`Busca: ${search || 'todas'} · Status: ${statusSel.join(', ') || 'todos'} · Tags: ${tagsSel.length || 0} · Período: ${dataInicial || '-'} até ${dataFinal || '-'} · ETA: ${etaFiltroModo || 'todos'}${etaFiltroModo === 'antes' || etaFiltroModo === 'depois' ? ` (${etaData || '-'})` : ''}${etaFiltroModo === 'entre' || etaFiltroModo === 'personalizado' ? ` (${etaInicial || '-'} até ${etaFinal || '-'})` : ''}`}
        kpis={{
          totalPedidos: filtrados.length,
          totalGeral: valorTotal,
          totalEmAberto: filtrados.filter(p => ['Rascunho', 'Aguardando Aprovação Financeira', 'Aprovado'].includes(p.status)).reduce((acc, p) => acc + Number(p._display_valor || p.valor_total || 0), 0),
          totalPagoNaoEntregue: valorPagoNaoEntregue
        }}
        grupos={grupos}
      />

      <EnvioFinanceiroLoteDialog
        open={showEnvioDialog}
        onOpenChange={setShowEnvioDialog}
        formaPagamento={formaPagamentoLote}
        onFormaPagamentoChange={setFormaPagamentoLote}
        dataPrimeiroVencimento={dataPrimeiroVencimentoLote}
        onDataPrimeiroVencimentoChange={setDataPrimeiroVencimentoLote}
        quantidadeSelecionados={selecionadosIds.length}
        onConfirm={confirmarEnvioFinanceiroLote}
        loading={enviandoLote}
      />

      <AtualizarPrecosFiltradosDialog
        isOpen={showAtualizarPrecosFiltrados}
        onClose={(updated) => {
          setShowAtualizarPrecosFiltrados(false);
          if (updated) loadData();
        }}
        pedidosFiltrados={pedidosConsulta}
      />

    </div>
  );
}