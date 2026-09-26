/**
 * Motor JS alinhado à view SQL `pedido_compra_saldo_a_embarcar_v` (migration 103/106).
 *
 * Agrega em BASE (M²); vitrine (CX) só na leitura. Embarque CX usa fator da linha (dados JSONB).
 */

import { getEmbarqueItensLinhas } from '@/lib/fetchEmbarqueItens';
import {
  calculateBaseQuantity,
  commercialQuantityFromBase,
  getItemCompraExibicaoVitrine,
} from '@/lib/productUnits';
import { resolveEmbarqueQuantidadeBase } from '@/lib/embarqueQuantityResolve';
import { getTotalLinhaPedidoCompra } from '@/lib/pedidoCompraFinanceiro';
import { roundToTwoDecimals } from '@/lib/financialUtils';
import { isEmbarqueSaldoPendente } from '@/lib/embarqueTipoSaldoPendente';
import { enrichEmbarquesComFatorPedido } from '@/lib/embarqueLogisticaHelpers';

/** Tolerância numérica — mesma ordem de grandeza que a view SQL (0.009). */
export const SALDO_EMBARQUE_EPS = 0.009;

/** Mesma regra visual que Necessidade: pedido desmembrado com falta operacional. */
export const SALDO_EMBARQUE_DISPLAY_STATUS = 'Pendente';
export const SALDO_EMBARQUE_TIPO = 'SaldoEmbarque';

function n(v) {
  return Number(v) || 0;
}

function pedidaBaseItem(item = {}) {
  const base = n(item.quantidade_base);
  if (base > 0) return base;
  const com = n(item.quantidade ?? item.quantidade_comercial);
  const fator = n(item.fator_aplicado ?? item.fator_conversao, 1) || 1;
  return calculateBaseQuantity(com, fator);
}

function faltaParaVitrine(faltaBase, item = {}, produto = null) {
  const exib = getItemCompraExibicaoVitrine(item, produto);
  return commercialQuantityFromBase(faltaBase, exib.fator_conversao, exib.unidade_medida);
}

export function isEmbarqueReal(embarque) {
  return !isEmbarqueSaldoPendente(embarque);
}

export function isNecessidadeEmbarque(embarque) {
  return !isEmbarqueReal(embarque);
}

export function isSaldoEmbarqueRenderizado(embarque) {
  if (!embarque) return false;
  if (embarque?.tipo === SALDO_EMBARQUE_TIPO) return true;
  return String(embarque?.id || '').startsWith('virtual-saldo-');
}

/** Produtos já registados em embarque tipo Necessidade (pós-recepção) — evita dupla contagem no virtual. */
export function produtosIdsComSaldoPosRecepcaoBd(embarques = []) {
  const ids = new Set();
  (embarques || [])
    .filter((emb) => isNecessidadeEmbarque(emb) && !isSaldoEmbarqueRenderizado(emb))
    .forEach((emb) => {
      getEmbarqueItensLinhas(emb).forEach((linha) => {
        const q = resolveEmbarqueQuantidadeBase(linha, 'embarcada');
        if (q > SALDO_EMBARQUE_EPS && linha?.produto_id) ids.add(linha.produto_id);
      });
    });
  return ids;
}

/**
 * Agrega quantidades por produto_id em BASE a partir de embarques + linhas.
 * @param {object[]} embarques
 * @param {(emb: object) => object[]} getLinhas
 */
export function agregarEmbarquesPorProduto(embarques = [], getLinhas) {
  const resolveLinhas = typeof getLinhas === 'function'
    ? getLinhas
    : (emb) => emb?._linhas || emb?.itens || [];

  const reais = {};
  const necessidade = {};

  (embarques || []).forEach((emb) => {
    const real = isEmbarqueReal(emb);
    const bucket = real ? reais : necessidade;

    resolveLinhas(emb).forEach((linha) => {
      const pid = linha?.produto_id;
      if (!pid) return;

      if (!bucket[pid]) {
        bucket[pid] = {
          quantidade_embarcada_real_base: 0,
          quantidade_recebida_real_base: 0,
          quantidade_em_transito_base: 0,
          saldo_pos_recepcao_base: 0,
        };
      }

      const embBase = resolveEmbarqueQuantidadeBase(linha, 'embarcada');
      const recBase = resolveEmbarqueQuantidadeBase(linha, 'recebida');

      if (real) {
        bucket[pid].quantidade_embarcada_real_base += embBase;
        bucket[pid].quantidade_recebida_real_base += recBase;
        bucket[pid].quantidade_em_transito_base += Math.max(embBase - recBase, 0);
      } else {
        bucket[pid].saldo_pos_recepcao_base += Math.max(embBase, 0);
      }
    });
  });

  return { reais, necessidade };
}

/**
 * Calcula saldo por linha de pedido — espelho de pedido_compra_saldo_a_embarcar_v.
 * @param {object} pedido — com itens (legacy mirror ou SQL)
 * @param {object[]} embarques — embarques do pedido hidratados
 * @param {(emb: object) => object[]} [getLinhas]
 * @param {object} [produtosMap]
 */
export function calcularSaldoEmbarquePorLinha(pedido, embarques = [], getLinhas, produtosMap = {}) {
  const embarquesNorm = enrichEmbarquesComFatorPedido(embarques, pedido?.itens || []);
  const { reais, necessidade } = agregarEmbarquesPorProduto(embarquesNorm, getLinhas);
  const itens = pedido?.itens || [];

  return itens.map((item) => {
    const pid = item?.produto_id;
    const pedidaBase = pedidaBaseItem(item);
    const tr = reais[pid] || {};
    const tn = necessidade[pid] || {};
    const produto = produtosMap[pid] || null;

    const embarcadaRealBase = n(tr.quantidade_embarcada_real_base);
    const recebidaRealBase = n(tr.quantidade_recebida_real_base);
    const emTransitoBase = n(tr.quantidade_em_transito_base);
    const saldoPosRecepcaoBase = n(tn.saldo_pos_recepcao_base);

    const saldoNuncaEmbarcadoBase = Math.max(pedidaBase - embarcadaRealBase, 0);
    const faltaOperacionalBase = Math.max(pedidaBase - recebidaRealBase - emTransitoBase, 0);

    const exib = getItemCompraExibicaoVitrine(item, produto);
    const pedidaVitrine = n(item.quantidade ?? item.quantidade_comercial) || exib.quantidade;
    const embarcadaReal = commercialQuantityFromBase(embarcadaRealBase, exib.fator_conversao, exib.unidade_medida);
    const recebidaReal = commercialQuantityFromBase(recebidaRealBase, exib.fator_conversao, exib.unidade_medida);
    const emTransito = commercialQuantityFromBase(emTransitoBase, exib.fator_conversao, exib.unidade_medida);
    const faltaOperacional = faltaParaVitrine(faltaOperacionalBase, item, produto);

    let diagnostico = 'REVISAR';
    if (faltaOperacionalBase > SALDO_EMBARQUE_EPS) diagnostico = 'FALTA_EMBARCAR';
    else if (emTransitoBase > SALDO_EMBARQUE_EPS) diagnostico = 'EM_TRANSITO';
    else if (pedidaBase - recebidaRealBase <= SALDO_EMBARQUE_EPS) diagnostico = 'OK';

    return {
      pedido_compra_id: pedido?.id,
      pedido_compra_numero: pedido?.numero,
      pedido_item_id: item?.id,
      produto_id: pid,
      produto_nome: item?.produto_nome,
      unidade_sigla: exib.unidade_medida || item?.unidade_medida || item?.unidade_sigla || 'UN',
      quantidade_pedida_comercial: pedidaVitrine,
      quantidade_pedida_base: pedidaBase,
      quantidade_embarcada_real: embarcadaReal,
      quantidade_embarcada_real_base: embarcadaRealBase,
      quantidade_recebida_real: recebidaReal,
      quantidade_recebida_real_base: recebidaRealBase,
      quantidade_em_transito: emTransito,
      quantidade_em_transito_base: emTransitoBase,
      saldo_nunca_embarcado: faltaParaVitrine(saldoNuncaEmbarcadoBase, item, produto),
      saldo_nunca_embarcado_base: saldoNuncaEmbarcadoBase,
      saldo_pos_recepcao: commercialQuantityFromBase(saldoPosRecepcaoBase, exib.fator_conversao, exib.unidade_medida),
      saldo_pos_recepcao_base: saldoPosRecepcaoBase,
      falta_operacional: faltaOperacional,
      falta_operacional_base: faltaOperacionalBase,
      fator_vitrine: exib.fator_conversao,
      diagnostico,
    };
  });
}

/** Linhas com falta operacional relevante (base). */
export function filtrarLinhasComFaltaOperacional(linhas = [], eps = SALDO_EMBARQUE_EPS) {
  return (linhas || []).filter((l) => n(l.falta_operacional_base ?? l.falta_operacional) > eps);
}

/**
 * Card vermelho só depois de desmembramento iniciado no pedido (João André):
 * olhar o pedido → se já houve embarque/despacho real → aí sim saldo pendente por linha.
 */
export function pedidoTemDesmembramentoIniciado(embarques = [], linhasSaldo = []) {
  const reais = (embarques || []).filter(isEmbarqueReal);
  const despachouAlgo = reais.some((emb) =>
    getEmbarqueItensLinhas(emb).some(
      (linha) => resolveEmbarqueQuantidadeBase(linha, 'embarcada') > SALDO_EMBARQUE_EPS,
    ),
  );
  if (despachouAlgo) return true;

  return (linhasSaldo || []).some(
    (l) => n(l.quantidade_embarcada_real_base ?? l.quantidade_embarcada_real) > SALDO_EMBARQUE_EPS,
  );
}

/** Resumo agregado por pedido. */
export function resumirSaldoEmbarquePedido(linhas = []) {
  const comFalta = filtrarLinhasComFaltaOperacional(linhas);
  const soTransito = (linhas || []).filter(
    (l) =>
      n(l.quantidade_em_transito_base ?? l.quantidade_em_transito) > SALDO_EMBARQUE_EPS
      && n(l.falta_operacional_base ?? l.falta_operacional) <= SALDO_EMBARQUE_EPS,
  );

  return {
    linhas_com_falta: comFalta.length,
    linhas_so_em_transito: soTransito.length,
    soma_falta_operacional: comFalta.reduce((acc, l) => acc + n(l.falta_operacional), 0),
    soma_falta_operacional_base: comFalta.reduce(
      (acc, l) => acc + n(l.falta_operacional_base ?? l.falta_operacional),
      0,
    ),
    soma_em_transito: (linhas || []).reduce((acc, l) => acc + n(l.quantidade_em_transito), 0),
    soma_saldo_pos_recepcao: (linhas || []).reduce((acc, l) => acc + n(l.saldo_pos_recepcao), 0),
    linhas_com_falta_detalhe: comFalta,
  };
}

/**
 * Agrupa falta por pedido (cards operacionais).
 */
export function agruparFaltaPorPedido(linhasComFalta = []) {
  const byPedido = {};
  (linhasComFalta || []).forEach((l) => {
    const key = l.pedido_compra_id || l.pedido_compra_numero;
    if (!byPedido[key]) {
      byPedido[key] = {
        pedido_compra_id: l.pedido_compra_id,
        pedido_compra_numero: l.pedido_compra_numero,
        linhas: [],
        soma_falta: 0,
      };
    }
    byPedido[key].linhas.push(l);
    byPedido[key].soma_falta += n(l.falta_operacional);
  });
  return Object.values(byPedido);
}

function mapLinhaSaldoParaItemEmbarque(pedido, linhaSaldo, produtosMap = {}) {
  const item = (pedido?.itens || []).find((i) => i.produto_id === linhaSaldo.produto_id) || {};
  const produto = produtosMap[linhaSaldo.produto_id] || null;
  const exib = getItemCompraExibicaoVitrine(item, produto);
  const falta = n(linhaSaldo.falta_operacional);
  const faltaBase = n(linhaSaldo.falta_operacional_base) || calculateBaseQuantity(falta, exib.fator_conversao);

  return {
    produto_id: linhaSaldo.produto_id,
    produto_nome: linhaSaldo.produto_nome || item.produto_nome,
    quantidade_pedida: exib.quantidade,
    quantidade_embarcada: falta,
    quantidade_embarcada_apresentacao: falta,
    quantidade_embarcada_comercial: falta,
    quantidade_embarcada_base: faltaBase,
    quantidade_base: faltaBase,
    quantidade_recebida: 0,
    fator_conversao: exib.fator_conversao,
    fator_apresentacao: exib.fator_conversao,
    unidade_apresentacao: exib.unidade_medida,
    unidade_medida: exib.unidade_medida || linhaSaldo.unidade_sigla || 'UN',
  };
}

/**
 * Embarque virtual único por pedido — falta operacional sem cascata ETA.
 * Exclui produtos já cobertos por registo Necessidade no BD.
 */
export function buildEmbarqueVirtualSaldoEmbarque(
  pedido,
  embarquesDoPedido = [],
  produtosMap = {},
  options = {},
) {
  if (String(pedido?.status || '').trim() === 'Concluído') return null;

  const embarquesNorm = enrichEmbarquesComFatorPedido(embarquesDoPedido, pedido?.itens || []);
  const linhasSaldo = calcularSaldoEmbarquePorLinha(pedido, embarquesNorm, undefined, produtosMap);
  if (!pedidoTemDesmembramentoIniciado(embarquesNorm, linhasSaldo)) return null;

  const excluirProdutos = options.excluirProdutosIds || produtosIdsComSaldoPosRecepcaoBd(embarquesNorm);
  const linhas = filtrarLinhasComFaltaOperacional(linhasSaldo).filter(
    (l) => !excluirProdutos.has(l.produto_id),
  );

  if (!linhas.length) return null;

  const itensPendentes = linhas.map((l) => mapLinhaSaldoParaItemEmbarque(pedido, l, produtosMap));

  return {
    id: `virtual-saldo-${pedido.id}`,
    pedido_compra_id: pedido.id,
    numero: `${pedido.numero || 'PC'}-SAL`,
    tipo: SALDO_EMBARQUE_TIPO,
    status: 'Pendente',
    status_recebimento: 'Pendente',
    observacoes: 'Saldo a embarcar — parte do pedido ainda não colocada em viagem real.',
    _linhas: itensPendentes,
    _itens_fonte: 'saldo_operacional',
    created_date: new Date().toISOString(),
  };
}

/** Valor proporcional das linhas com falta operacional. */
export function calcValorSaldoEmbarqueLinhas(pedido, linhasSaldo = [], produtosMap = {}) {
  return roundToTwoDecimals(
    (linhasSaldo || []).reduce((acc, linha) => {
      const item = (pedido?.itens || []).find((i) => i.produto_id === linha.produto_id) || {};
      const pedidaBase = pedidaBaseItem(item);
      const total = getTotalLinhaPedidoCompra(item);
      const faltaBase = n(linha.falta_operacional_base ?? linha.falta_operacional);
      if (!pedidaBase || !faltaBase) return acc;
      return acc + (faltaBase / pedidaBase) * total;
    }, 0),
  );
}

/** Display items para cards de saldo (lista / consulta / PDF). */
export function buildDisplayItensSaldoEmbarque(pedido, linhasSaldo = [], produtosMap = {}) {
  return (linhasSaldo || []).map((linha) => {
    const item = (pedido?.itens || []).find((i) => i.produto_id === linha.produto_id) || {};
    const produto = produtosMap[linha.produto_id] || null;
    const exib = getItemCompraExibicaoVitrine(item, produto);
    const falta = n(linha.falta_operacional);
    const totalLinha = getTotalLinhaPedidoCompra(item);
    const pedidaBase = pedidaBaseItem(item);
    const faltaBase = n(linha.falta_operacional_base);
    const valor = pedidaBase > 0 ? roundToTwoDecimals((faltaBase / pedidaBase) * totalLinha) : 0;

    return {
      produto_id: linha.produto_id,
      produto_nome: linha.produto_nome || item.produto_nome,
      quantidade: falta,
      quantidade_embarcada: falta,
      quantidade_pedida: exib.quantidade,
      quantidade_base: faltaBase || calculateBaseQuantity(falta, exib.fator_conversao),
      fator_conversao: exib.fator_conversao,
      unidade_medida: exib.unidade_medida || linha.unidade_sigla || 'UN',
      total: valor,
      valor_total_item: valor,
      preco_unitario: falta > 0 ? roundToTwoDecimals(valor / falta) : exib.preco_unitario,
    };
  });
}
