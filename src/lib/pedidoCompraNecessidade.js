/**
 * Regra única para card de Necessidade na lista de embarques.
 *
 * Mostrar somente quando:
 * 1) já houve despacho/recepção real (embarque com itens + transporte/datas), e
 * 2) ainda falta quantidade comercial relevante (não ruído de arredondamento).
 *
 * Pedidos só aguardando pagamento ou primeiro embarque NÃO geram card de necessidade.
 */

import { getEmbarqueItensLinhas } from '@/lib/fetchEmbarqueItens';
import { resolveEmbarqueQuantidadeComercial } from '@/lib/embarqueQuantityResolve';
import { buildConsultaItensEmbarque, calcConsultaValorEmbarque } from '@/lib/consultaComprasEmbarques';
import { calcularItensOrfaosPedido, qtyEmbarcadaComercialLinha } from '@/lib/embarqueLogisticaHelpers';
import { calcValorItensPedidoCompra } from '@/lib/pedidoCompraFinanceiro';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { calculateBaseQuantity, getItemCompraExibicaoVitrine } from '@/lib/productUnits';

/** Mínimo por linha (unidade comercial) para contar como falta real. */
export const MIN_LINHA_PENDENTE_COMERCIAL = 0.01;

/** Soma mínima de faltas comerciais quando nenhuma linha atinge 1 unidade inteira. */
export const MIN_SOMA_PENDENTE_NECESSIDADE = 0.5;

/** Qualquer linha com pelo menos esta qtd comercial conta como necessidade material. */
export const MIN_UNIDADE_INTEIRA_PENDENTE = 1;

/**
 * Embarques/cards que não entram na Necessidade (decisão operacional).
 * Normalização: trim, sem espaços, maiúsculas (ex.: E62-67G).
 */
export const NECESSIDADE_EMBARQUE_CODIGOS_EXCLUIDOS = ['E62-67G'];

function normalizarCodigoEmbarque(codigo = '') {
  return String(codigo || '').trim().replace(/\s+/g, '').toUpperCase();
}

export function codigoEmbarqueExcluidoDeNecessidade(codigo = '') {
  const norm = normalizarCodigoEmbarque(codigo);
  return NECESSIDADE_EMBARQUE_CODIGOS_EXCLUIDOS.some(
    (excluido) => normalizarCodigoEmbarque(excluido) === norm,
  );
}

/** Código exibido do embarque (card E62-67G, codigo_exibicao, etc.). */
export function resolverCodigoEmbarqueNecessidade(pedido, embarque) {
  if (!embarque) return '';
  const direto = embarque.codigo_exibicao || embarque.numero || '';
  if (direto) return String(direto).trim();
  const base = String(pedido?.numero || '').replace(/\s+/g, '');
  return base;
}

export function embarqueExcluidoDeNecessidade(pedido, embarque, displayCode = '') {
  const candidatos = [displayCode, embarque?.codigo_exibicao, embarque?.numero].filter(Boolean);
  if (candidatos.some((c) => codigoEmbarqueExcluidoDeNecessidade(c))) return true;
  return codigoEmbarqueExcluidoDeNecessidade(resolverCodigoEmbarqueNecessidade(pedido, embarque));
}

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

/** Pendência comercial — alinhada aos itens órfãos da aba Logística (saldo pós-recepção). */
export function calcularPendenciaComercialItens(pedido, embarquesDoPedido = [], produtosMap = {}) {
  const embarquesConsiderados = filtrarEmbarquesParaCalculoNecessidade(pedido, embarquesDoPedido);
  if (!temDespachoRealComItens(embarquesConsiderados)) return [];

  return calcularItensOrfaosPedido(pedido, embarquesConsiderados)
    .map((item) => {
      const produto = produtosMap[item.produto_id] || null;
      const exib = getItemCompraExibicaoVitrine(item, produto);
      const pendente = Number(item.qtd_pendente) || 0;
      if (pendente <= 0.009) return null;
      return { item, exib, pendente };
    })
    .filter(Boolean);
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

/**
 * Avalia se o pedido deve exibir card(s) de necessidade.
 * @returns {{ exibir: boolean, pendencias: Array, somaPendente: number, temDespachoReal: boolean }}
 */
export function avaliarNecessidadeComercialPedido(pedido, embarquesDoPedido = [], produtosMap = {}) {
  const embarquesConsiderados = filtrarEmbarquesParaCalculoNecessidade(pedido, embarquesDoPedido);
  const pendenciasBrutas = calcularPendenciaComercialItens(pedido, embarquesDoPedido, produtosMap);
  const pendencias = pendenciasComerciaisRelevantes(pendenciasBrutas);
  const somaPendente = somaPendenciaComercial(pendencias);
  const temDespachoReal = temDespachoRealComItens(embarquesConsiderados);
  const exibir = temDespachoReal && faltaComercialRelevante(pendencias);

  return { exibir, pendencias, somaPendente, temDespachoReal };
}

/** Atalho — regra única para filtros e virtual necessidade. */
export function pedidoDeveExibirCardNecessidade(pedido, embarquesDoPedido = [], produtosMap = {}) {
  return avaliarNecessidadeComercialPedido(pedido, embarquesDoPedido, produtosMap).exibir;
}

export function quantidadePendenteNecessidadePedido(pedido, embarquesDoPedido = [], produtosMap = {}) {
  const { exibir, somaPendente } = avaliarNecessidadeComercialPedido(pedido, embarquesDoPedido, produtosMap);
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
  const itens = buildConsultaItensEmbarque(card, produtosMap);
  if (!itens.length) return null;

  return {
    qtdItens: itens.length,
    valorTotal: calcularValorNecessidadeComFrete(pedido, embarque, embarquesDoPedido, produtosMap, itens),
  };
}
