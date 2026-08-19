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
import { getItemCompraExibicaoVitrine } from '@/lib/productUnits';

/** Mínimo por linha (unidade comercial) para contar como falta real. */
export const MIN_LINHA_PENDENTE_COMERCIAL = 0.01;

/** Soma mínima de faltas comerciais quando nenhuma linha atinge 1 unidade inteira. */
export const MIN_SOMA_PENDENTE_NECESSIDADE = 0.5;

/** Qualquer linha com pelo menos esta qtd comercial conta como necessidade material. */
export const MIN_UNIDADE_INTEIRA_PENDENTE = 1;

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

/** Pelo menos um embarque real (não necessidade) com despacho e quantidades lançadas. */
export function temDespachoRealComItens(embarquesDoPedido = []) {
  const embarquesReais = (embarquesDoPedido || []).filter((embarque) => !isNecessidadeRenderizada(embarque));
  return embarquesReais.some(
    (embarque) => hasEmbarqueItensVinculados(embarque) && hasEmbarqueDespachoVinculado(embarque),
  );
}

function calcularCoberturaComercialPorProduto(embarquesReais = []) {
  return (embarquesReais || []).reduce((acc, embarque) => {
    getEmbarqueItensLinhas(embarque).forEach((item) => {
      const produtoId = item.produto_id;
      if (!produtoId) return;
      const coberto =
        resolveEmbarqueQuantidadeComercial(item, 'recebida') ||
        resolveEmbarqueQuantidadeComercial(item, 'embarcada');
      acc[produtoId] = (acc[produtoId] || 0) + coberto;
    });
    return acc;
  }, {});
}

/** Pendência na unidade comercial (CX/PAC…), pedido vs embarques reais. */
export function calcularPendenciaComercialItens(pedido, embarquesDoPedido = [], produtosMap = {}) {
  const embarquesReais = (embarquesDoPedido || []).filter((embarque) => !isNecessidadeRenderizada(embarque));
  const cobertura = calcularCoberturaComercialPorProduto(embarquesReais);

  return (pedido?.itens || [])
    .map((item) => {
      const produto = produtosMap[item.produto_id] || null;
      const exib = getItemCompraExibicaoVitrine(item, produto);
      const pedida = Number(exib.quantidade) || Number(item.quantidade) || 0;
      const coberta = Number(cobertura[item.produto_id]) || 0;
      const pendente = Math.max(0, pedida - coberta);
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
  const pendenciasBrutas = calcularPendenciaComercialItens(pedido, embarquesDoPedido, produtosMap);
  const pendencias = pendenciasComerciaisRelevantes(pendenciasBrutas);
  const somaPendente = somaPendenciaComercial(pendencias);
  const temDespachoReal = temDespachoRealComItens(embarquesDoPedido);
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
