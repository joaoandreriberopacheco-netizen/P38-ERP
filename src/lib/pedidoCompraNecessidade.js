/**
 * Regra única para card de Necessidade na lista de embarques.
 *
 * Mostrar somente quando:
 * 1) já houve despacho/recepção real (embarque com itens + transporte/datas), e
 * 2) ainda falta quantidade comercial relevante (não ruído de arredondamento).
 *
 * Pedidos só aguardando pagamento ou primeiro embarque NÃO geram card de necessidade.
 *
 * Cascata ETA: ao encontrar o primeiro pedido (por ETA) com despacho real e falta
 * relevante (ex.: 1 CX), os pedidos a partir dele podem exibir órfãos mesmo sem
 * despacho real próprio (`_cascata_necessidade_liberada`).
 */

import { getEmbarqueItensLinhas } from '@/lib/fetchEmbarqueItens';
import { resolveEmbarqueQuantidadeComercial } from '@/lib/embarqueQuantityResolve';
import { buildConsultaItensPendentes, calcConsultaValorEmbarque } from '@/lib/consultaComprasEmbarques';
import {
  EMBARQUE_CODIGOS_EXCLUIDOS_OPERACIONAL,
  NECESSIDADE_EMBARQUE_CODIGOS_EXCLUIDOS,
  codigoEmbarqueExcluidoOperacional as codigoEmbarqueExcluidoDeNecessidade,
  embarqueExcluidoOperacional as embarqueExcluidoDeNecessidade,
  resolverCodigoEmbarqueExibicao as resolverCodigoEmbarqueNecessidade,
} from '@/lib/embarqueCodigosExcluidos';
import { calcularItensOrfaosPedido, qtyEmbarcadaComercialLinha } from '@/lib/embarqueLogisticaHelpers';
import { calcValorItensPedidoCompra } from '@/lib/pedidoCompraFinanceiro';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { calculateBaseQuantity, commercialQuantityFromBase, getItemCompraExibicaoVitrine } from '@/lib/productUnits';
import { toLocalDateKey } from '@/components/utils/dateUtils';

/** Mínimo por linha (unidade comercial) para contar como falta real. */
export const MIN_LINHA_PENDENTE_COMERCIAL = 0.01;

/** Soma mínima de faltas comerciais quando nenhuma linha atinge 1 unidade inteira. */
export const MIN_SOMA_PENDENTE_NECESSIDADE = 0.5;

/** Qualquer linha com pelo menos esta qtd comercial conta como necessidade material. */
export const MIN_UNIDADE_INTEIRA_PENDENTE = 1;

export {
  EMBARQUE_CODIGOS_EXCLUIDOS_OPERACIONAL,
  NECESSIDADE_EMBARQUE_CODIGOS_EXCLUIDOS,
  codigoEmbarqueExcluidoDeNecessidade,
  embarqueExcluidoDeNecessidade,
  resolverCodigoEmbarqueNecessidade,
};

function filtrarEmbarquesParaCalculoNecessidade(pedido, embarquesDoPedido = []) {
  return (embarquesDoPedido || []).filter((embarque) => !embarqueExcluidoDeNecessidade(pedido, embarque));
}

export function isNecessidadeRenderizada(embarque) {
  if (!embarque) return false;
  if (embarque?.tipo === 'Necessidade') return true;
  return (
    !!embarque?.observacoes &&
    String(embarque.observacoes).includes('criado automaticamente para itens pendentes')
  );
}

export function hasEmbarqueItensVinculados(embarque) {
  return getEmbarqueItensLinhas(embarque).some(
    (item) => (Number(item?.quantidade_embarcada) || 0) > 0 || (Number(item?.quantidade_recebida) || 0) > 0,
  );
}

export function hasEmbarqueDespachoVinculado(embarque) {
  return !!(
    embarque?.data_embarque ||
    embarque?.eta ||
    embarque?.transportadora_id ||
    embarque?.transportadora_nome
  );
}

function statusIndicaRecepcaoReal(embarque) {
  const status = String(embarque?.status_recebimento || embarque?.status_recebimento_embarque || '').trim();
  return ['Recebido OK', 'Recebido Parcial', 'Com Divergência'].includes(status);
}

export function embarqueNecessidadeTemItensPendentes(embarque) {
  if (!isNecessidadeRenderizada(embarque)) return false;
  return getEmbarqueItensLinhas(embarque).some((item) => {
    const q =
      resolveEmbarqueQuantidadeComercial(item, 'embarcada') ||
      resolveEmbarqueQuantidadeComercial(item, 'pedida') ||
      qtyEmbarcadaComercialLinha(item);
    return (Number(q) || 0) > 0;
  });
}

/** Pelo menos um embarque real com recepção/despacho, ou embarque Necessidade pós-recepção. */
export function temDespachoRealComItens(embarquesDoPedido = []) {
  const embarquesReais = (embarquesDoPedido || []).filter((embarque) => !isNecessidadeRenderizada(embarque));
  const teveOperacaoReal = embarquesReais.some((embarque) => {
    if (!hasEmbarqueItensVinculados(embarque)) return false;
    if (statusIndicaRecepcaoReal(embarque)) return true;
    return hasEmbarqueDespachoVinculado(embarque);
  });
  if (teveOperacaoReal) return true;
  return (embarquesDoPedido || []).some((embarque) => embarqueNecessidadeTemItensPendentes(embarque));
}

function mapOrfaosParaPendenciasComerciais(itensOrfaos = [], produtosMap = {}) {
  return (itensOrfaos || [])
    .map((item) => {
      const produto = produtosMap[item.produto_id] || null;
      const exib = getItemCompraExibicaoVitrine(item, produto);
      const pendenteBase = Number(item.qtd_pendente) || 0;
      const pendenteComercial = Number(item.qtd_pendente_comercial);
      const pendente = pendenteComercial > 0
        ? pendenteComercial
        : commercialQuantityFromBase(
          pendenteBase,
          exib.fator_conversao,
          exib.unidade_medida,
        );
      if (pendente <= 0.009) return null;
      return { item, exib, pendente };
    })
    .filter(Boolean);
}

/** Pendência comercial — alinhada aos itens órfãos da aba Logística (saldo pós-recepção). */
export function calcularPendenciaComercialItens(pedido, embarquesDoPedido = [], produtosMap = {}) {
  const embarquesConsiderados = filtrarEmbarquesParaCalculoNecessidade(pedido, embarquesDoPedido);
  if (!temDespachoRealComItens(embarquesConsiderados)) return [];

  return mapOrfaosParaPendenciasComerciais(
    calcularItensOrfaosPedido(pedido, embarquesConsiderados, produtosMap),
    produtosMap,
  );
}

/** Pendência por órfãos sem exigir despacho real no próprio pedido (cascata ETA). */
export function calcularPendenciaOrfaosItens(pedido, embarquesDoPedido = [], produtosMap = {}) {
  const embarquesConsiderados = filtrarEmbarquesParaCalculoNecessidade(pedido, embarquesDoPedido);
  return mapOrfaosParaPendenciasComerciais(
    calcularItensOrfaosPedido(pedido, embarquesConsiderados, produtosMap),
    produtosMap,
  );
}

export function somaPendenciaComercial(pendencias = []) {
  return pendencias.reduce((acc, row) => acc + (Number(row.pendente) || 0), 0);
}

function pendenciasComerciaisRelevantes(pendenciasBrutas = []) {
  return pendenciasBrutas.filter((p) => p.pendente >= MIN_LINHA_PENDENTE_COMERCIAL);
}

function faltaComercialRelevante(pendencias = []) {
  if (!pendencias.length) return false;
  const soma = somaPendenciaComercial(pendencias);
  if (soma >= MIN_SOMA_PENDENTE_NECESSIDADE) return true;
  return pendencias.some((p) => p.pendente >= MIN_UNIDADE_INTEIRA_PENDENTE);
}

function resolveOpcoesNecessidadePedido(pedido = {}, options = {}) {
  const liberadoPorCascata = options.liberadoPorCascata ?? !!pedido._cascata_necessidade_liberada;
  return { liberadoPorCascata };
}

function getPedidoEtaSortKey(pedido = {}, embarquesDoPedido = []) {
  const embarquesReais = (embarquesDoPedido || []).filter((embarque) => !isNecessidadeRenderizada(embarque));
  const comEta = embarquesReais.find((embarque) => embarque?.eta);
  if (comEta?.eta) return toLocalDateKey(new Date(comEta.eta));
  if (pedido?.data_prevista_entrega) return String(pedido.data_prevista_entrega).slice(0, 10);
  return '';
}

/** Pedido gatilho: já teve despacho real e ainda falta quantidade comercial relevante (ex.: 1 CX). */
export function pedidoEhGatilhoCascataNecessidade(pedido, embarquesDoPedido = [], produtosMap = {}) {
  const embarquesConsiderados = filtrarEmbarquesParaCalculoNecessidade(pedido, embarquesDoPedido);
  if (!temDespachoRealComItens(embarquesConsiderados)) return false;

  const pendencias = pendenciasComerciaisRelevantes(
    calcularPendenciaComercialItens(pedido, embarquesDoPedido, produtosMap),
  );
  return faltaComercialRelevante(pendencias);
}

/**
 * A partir do primeiro pedido gatilho (por ETA), libera exibição de órfãos nos pedidos seguintes.
 * @returns {Map<string, boolean>}
 */
export function buildMapaLiberacaoCascataNecessidade(pedidos = [], embarquesPorPedido = {}, produtosMap = {}) {
  const mapa = new Map();
  const pedidosOrdenados = [...pedidos].sort((a, b) => {
    const keyA = getPedidoEtaSortKey(a, embarquesPorPedido[a.id] || []);
    const keyB = getPedidoEtaSortKey(b, embarquesPorPedido[b.id] || []);
    if (!keyA && !keyB) return String(a.numero || '').localeCompare(String(b.numero || ''), 'pt-BR');
    if (!keyA) return -1;
    if (!keyB) return 1;
    const cmp = keyA.localeCompare(keyB, 'pt-BR');
    if (cmp !== 0) return cmp;
    return String(a.numero || '').localeCompare(String(b.numero || ''), 'pt-BR');
  });

  let cascataAtiva = false;
  pedidosOrdenados.forEach((pedido) => {
    const embarques = embarquesPorPedido[pedido.id] || [];
    if (!cascataAtiva && pedidoEhGatilhoCascataNecessidade(pedido, embarques, produtosMap)) {
      cascataAtiva = true;
    }
    mapa.set(pedido.id, cascataAtiva);
  });

  return mapa;
}

/**
 * Avalia se o pedido deve exibir card(s) de necessidade.
 * @returns {{ exibir: boolean, pendencias: Array, somaPendente: number, temDespachoReal: boolean, liberadoPorCascata: boolean }}
 */
export function avaliarNecessidadeComercialPedido(
  pedido,
  embarquesDoPedido = [],
  produtosMap = {},
  options = {},
) {
  const { liberadoPorCascata } = resolveOpcoesNecessidadePedido(pedido, options);
  const embarquesConsiderados = filtrarEmbarquesParaCalculoNecessidade(pedido, embarquesDoPedido);
  const temDespachoReal = temDespachoRealComItens(embarquesConsiderados);

  const pendenciasBrutas = temDespachoReal
    ? calcularPendenciaComercialItens(pedido, embarquesDoPedido, produtosMap)
    : (liberadoPorCascata
      ? calcularPendenciaOrfaosItens(pedido, embarquesDoPedido, produtosMap)
      : []);
  const pendencias = pendenciasComerciaisRelevantes(pendenciasBrutas);
  const somaPendente = somaPendenciaComercial(pendencias);
  const exibir = (temDespachoReal || liberadoPorCascata) && faltaComercialRelevante(pendencias);

  return { exibir, pendencias, somaPendente, temDespachoReal, liberadoPorCascata };
}

/** Atalho — regra única para filtros e virtual necessidade. */
export function pedidoDeveExibirCardNecessidade(
  pedido,
  embarquesDoPedido = [],
  produtosMap = {},
  options = {},
) {
  return avaliarNecessidadeComercialPedido(pedido, embarquesDoPedido, produtosMap, options).exibir;
}

export function quantidadePendenteNecessidadePedido(
  pedido,
  embarquesDoPedido = [],
  produtosMap = {},
  options = {},
) {
  const { exibir, somaPendente } = avaliarNecessidadeComercialPedido(
    pedido,
    embarquesDoPedido,
    produtosMap,
    options,
  );
  return exibir ? somaPendente : 0;
}

function pedidoNaoConcluido(pedido = {}) {
  const status = String(pedido?.status || '').trim();
  const statusReceb = String(pedido?.status_recebimento_geral || '').trim();
  return status !== 'Concluído' && !statusReceb.startsWith('Concluído');
}

/** Embarque virtual quando ainda não existe registro tipo Necessidade no BD. */
export function buildEmbarqueVirtualNecessidade(pedido, embarquesDoPedido = [], produtosMap = {}) {
  if (!pedidoNaoConcluido(pedido)) return null;

  const { exibir, pendencias } = avaliarNecessidadeComercialPedido(pedido, embarquesDoPedido, produtosMap);
  if (!exibir || !pendencias.length) return null;

  const itensPendentes = pendencias.map(({ item, exib, pendente }) => ({
    produto_id: item.produto_id,
    produto_nome: item.produto_nome,
    quantidade_pedida: exib.quantidade,
    quantidade_embarcada: pendente,
    quantidade_embarcada_apresentacao: pendente,
    quantidade_embarcada_base: calculateBaseQuantity(pendente, exib.fator_conversao),
    quantidade_base: calculateBaseQuantity(pendente, exib.fator_conversao),
    quantidade_recebida: 0,
    fator_conversao: exib.fator_conversao,
    fator_apresentacao: exib.fator_conversao,
    unidade_apresentacao: exib.unidade_medida,
    unidade_medida: exib.unidade_medida,
  }));

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
}

export function resolverEmbarqueNecessidadeContexto(pedido, embarqueId, produtosMap = {}) {
  if (!pedido || !embarqueId) return null;
  const embarques = pedido._embarques || [];
  let embarque = embarques.find((item) => String(item.id) === String(embarqueId));
  if (!embarque && String(embarqueId).startsWith('virtual-necessidade-')) {
    embarque = buildEmbarqueVirtualNecessidade(pedido, embarques, produtosMap);
  }
  if (!embarque || !isNecessidadeRenderizada(embarque)) return null;
  if (!pedidoDeveExibirCardNecessidade(pedido, embarques, produtosMap)) return null;
  return embarque;
}

function calcularValorNecessidadeComFrete(pedido, embarque, embarquesDoPedido, produtosMap, itensConsulta) {
  const valorItensNecessidade = calcConsultaValorEmbarque({ ...pedido, _embarque: embarque }, itensConsulta);
  const valorItensPedido = calcValorItensPedidoCompra(pedido);
  if (!valorItensPedido || !itensConsulta.length) return valorItensNecessidade;

  const frete = Number(pedido?.valor_frete) || 0;
  const desconto = Number(pedido?.valor_desconto) || 0;
  const proporcao = valorItensNecessidade / valorItensPedido;
  return roundToTwoDecimals(valorItensNecessidade + proporcao * (frete - desconto));
}

/**
 * Resumo para o cabeçalho do detalhe: "2 itens (R$ total)".
 * @returns {{ qtdItens: number, valorTotal: number } | null}
 */
export function calcularResumoNecessidadeDetalhe(pedido, embarque, embarquesDoPedido = [], produtosMap = {}) {
  if (!pedido || !embarque || !isNecessidadeRenderizada(embarque)) return null;
  if (!pedidoDeveExibirCardNecessidade(pedido, embarquesDoPedido, produtosMap)) return null;

  const card = {
    ...pedido,
    _embarque: embarque,
    _is_necessidade: true,
    _embarques: embarquesDoPedido,
  };
  const itens = buildConsultaItensPendentes(card, produtosMap);
  if (!itens.length) return null;

  return {
    qtdItens: itens.length,
    valorTotal: calcularValorNecessidadeComFrete(pedido, embarque, embarquesDoPedido, produtosMap, itens),
  };
}
