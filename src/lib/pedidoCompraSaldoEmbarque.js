/**
 * Motor JS alinhado à view SQL `pedido_compra_saldo_a_embarcar_v` (migration 094).
 *
 * Fonte única para KPI "falta embarcar", aba Saldo e card virtual (substitui órfãos/cascata).
 */

import { getEmbarqueItensLinhas } from '@/lib/fetchEmbarqueItens';
import { calculateBaseQuantity, getItemCompraExibicaoVitrine } from '@/lib/productUnits';
import { getTotalLinhaPedidoCompra } from '@/lib/pedidoCompraFinanceiro';
import { roundToTwoDecimals } from '@/lib/financialUtils';

/** Tolerância numérica — mesma ordem de grandeza que a view SQL (0.009). */
export const SALDO_EMBARQUE_EPS = 0.009;

export const SALDO_EMBARQUE_DISPLAY_STATUS = 'Saldo a embarcar';
export const SALDO_EMBARQUE_TIPO = 'SaldoEmbarque';

function n(v) {
  return Number(v) || 0;
}

export function isEmbarqueReal(embarque) {
  return String(embarque?.tipo || 'Embarque').trim() !== 'Necessidade';
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
        const q = n(linha.quantidade_embarcada ?? linha.quantidade_embarcada_comercial);
        if (q > SALDO_EMBARQUE_EPS && linha?.produto_id) ids.add(linha.produto_id);
      });
    });
  return ids;
}

/**
 * Agrega quantidades por produto_id a partir de embarques + linhas (espelho SQL ou _linhas).
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
          quantidade_embarcada_real: 0,
          quantidade_recebida_real: 0,
          quantidade_em_transito: 0,
          saldo_pos_recepcao: 0,
        };
      }

      const embQ = n(linha.quantidade_embarcada ?? linha.quantidade_embarcada_comercial);
      const recQ = n(linha.quantidade_recebida ?? linha.quantidade_recebida_comercial);

      if (real) {
        bucket[pid].quantidade_embarcada_real += embQ;
        bucket[pid].quantidade_recebida_real += recQ;
        bucket[pid].quantidade_em_transito += Math.max(embQ - recQ, 0);
      } else {
        bucket[pid].saldo_pos_recepcao += Math.max(embQ, 0);
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
 */
export function calcularSaldoEmbarquePorLinha(pedido, embarques = [], getLinhas) {
  const { reais, necessidade } = agregarEmbarquesPorProduto(embarques, getLinhas);
  const itens = pedido?.itens || [];

  return itens.map((item) => {
    const pid = item?.produto_id;
    const pedida = n(item.quantidade ?? item.quantidade_comercial);
    const tr = reais[pid] || {};
    const tn = necessidade[pid] || {};

    const embarcadaReal = n(tr.quantidade_embarcada_real);
    const recebidaReal = n(tr.quantidade_recebida_real);
    const emTransito = n(tr.quantidade_em_transito);
    const saldoPosRecepcao = n(tn.saldo_pos_recepcao);

    const saldoNuncaEmbarcado = Math.max(pedida - embarcadaReal, 0);
    const faltaOperacional = Math.max(pedida - recebidaReal - emTransito, 0);

    let diagnostico = 'REVISAR';
    if (faltaOperacional > SALDO_EMBARQUE_EPS) diagnostico = 'FALTA_EMBARCAR';
    else if (emTransito > SALDO_EMBARQUE_EPS) diagnostico = 'EM_TRANSITO';
    else if (pedida - recebidaReal <= SALDO_EMBARQUE_EPS) diagnostico = 'OK';

    return {
      pedido_compra_id: pedido?.id,
      pedido_compra_numero: pedido?.numero,
      pedido_item_id: item?.id,
      produto_id: pid,
      produto_nome: item?.produto_nome,
      unidade_sigla: item?.unidade_medida || item?.unidade_sigla || 'UN',
      quantidade_pedida_comercial: pedida,
      quantidade_embarcada_real: embarcadaReal,
      quantidade_recebida_real: recebidaReal,
      quantidade_em_transito: emTransito,
      saldo_nunca_embarcado: saldoNuncaEmbarcado,
      saldo_pos_recepcao: saldoPosRecepcao,
      falta_operacional: faltaOperacional,
      diagnostico,
    };
  });
}

/** Linhas com falta operacional relevante. */
export function filtrarLinhasComFaltaOperacional(linhas = [], eps = SALDO_EMBARQUE_EPS) {
  return (linhas || []).filter((l) => n(l.falta_operacional) > eps);
}

/** Resumo agregado por pedido. */
export function resumirSaldoEmbarquePedido(linhas = []) {
  const comFalta = filtrarLinhasComFaltaOperacional(linhas);
  const soTransito = (linhas || []).filter(
    (l) => n(l.quantidade_em_transito) > SALDO_EMBARQUE_EPS && n(l.falta_operacional) <= SALDO_EMBARQUE_EPS,
  );

  return {
    linhas_com_falta: comFalta.length,
    linhas_so_em_transito: soTransito.length,
    soma_falta_operacional: comFalta.reduce((acc, l) => acc + n(l.falta_operacional), 0),
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

  return {
    produto_id: linhaSaldo.produto_id,
    produto_nome: linhaSaldo.produto_nome || item.produto_nome,
    quantidade_pedida: exib.quantidade,
    quantidade_embarcada: falta,
    quantidade_embarcada_apresentacao: falta,
    quantidade_embarcada_comercial: falta,
    quantidade_embarcada_base: calculateBaseQuantity(falta, exib.fator_conversao),
    quantidade_base: calculateBaseQuantity(falta, exib.fator_conversao),
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

  const excluirProdutos = options.excluirProdutosIds || produtosIdsComSaldoPosRecepcaoBd(embarquesDoPedido);
  const linhas = filtrarLinhasComFaltaOperacional(
    calcularSaldoEmbarquePorLinha(pedido, embarquesDoPedido),
  ).filter((l) => !excluirProdutos.has(l.produto_id));

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
      const pedida = n(item.quantidade ?? item.quantidade_comercial);
      const total = getTotalLinhaPedidoCompra(item);
      const falta = n(linha.falta_operacional);
      if (!pedida || !falta) return acc;
      return acc + (falta / pedida) * total;
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
    const pedida = n(item.quantidade ?? item.quantidade_comercial);
    const valor = pedida > 0 ? roundToTwoDecimals((falta / pedida) * totalLinha) : 0;

    return {
      produto_id: linha.produto_id,
      produto_nome: linha.produto_nome || item.produto_nome,
      quantidade: falta,
      quantidade_embarcada: falta,
      quantidade_pedida: exib.quantidade,
      quantidade_base: calculateBaseQuantity(falta, exib.fator_conversao),
      fator_conversao: exib.fator_conversao,
      unidade_medida: exib.unidade_medida || linha.unidade_sigla || 'UN',
      total: valor,
      valor_total_item: valor,
      preco_unitario: falta > 0 ? roundToTwoDecimals(valor / falta) : exib.preco_unitario,
    };
  });
}
