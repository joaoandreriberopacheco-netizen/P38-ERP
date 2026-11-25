/**
 * Consistência entre PedidoCompra e LancamentoFinanceiro na reabertura / reenvio ao financeiro.
 * Itens do pedido: fonte canónica PedidoCompraItem — ver loadPedidosCompraComItensCanonico.
 */
export {
  loadPedidoCompraComItensCanonico,
  loadPedidosCompraComItensCanonico,
} from '@/lib/fetchPedidoCompraItens';

import {
  calcTotalItemCompraPedido,
  repararLinhaCompraApresentacaoComProduto,
  syncItemDescontoApresentacao,
} from '@/lib/productUnits';
import { isLancamentoCancelado, isLancamentoPago } from '@/lib/lancamentoFinanceiroStatus';
import { dataHoje, formatarLogTime } from '@/components/utils/dateUtils';
import { getPedidoCompraDataPagamentoChave } from '@/lib/pedidoCompraDataPagamento';

const roundToTwoDecimals = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Evita import circular com pedidoCompraDespesasRateadas — mesma regra de soma persistível. */
function somaDespesasRateadasNoPedido(pedido = {}) {
  const raw = pedido.despesas_rateadas ?? pedido?.dados?.despesas_rateadas;
  if (!Array.isArray(raw)) return 0;
  return roundToTwoDecimals(
    raw.reduce((acc, row) => {
      const valor = Math.max(0, Number(row?.valor) || 0);
      const descricao = String(row?.descricao || '').trim();
      if (!descricao && valor <= 0) return acc;
      return acc + valor;
    }, 0),
  );
}

function qtdComercialItemPedido(item = {}) {
  const q = Number(item?.quantidade ?? item?.quantidade_comercial);
  return Number.isFinite(q) && q > 0 ? q : 0;
}

/**
 * Valor sugerido do acordo órfão: soma (qtd no acordo × custo unit. da linha do pedido),
 * na mesma unidade comercial do pedido.
 */
export function calcularValorSugeridoAcordoOrfao(
  itensOrfaos = [],
  qtdBaixaComercialMap = {},
  pedido = {},
) {
  let total = 0;
  for (const orfao of itensOrfaos) {
    const itemPedido = (pedido?.itens || []).find(
      (it) => String(it?.produto_id) === String(orfao?.produto_id),
    );
    if (!itemPedido) continue;
    const qAcordo = parseFloat(qtdBaixaComercialMap[orfao.produto_id]) || 0;
    if (qAcordo <= 0) continue;

    const unitApres = Number(itemPedido.custo_final_unitario_apresentacao);
    if (Number.isFinite(unitApres) && unitApres > 0) {
      total += qAcordo * unitApres;
      continue;
    }

    const qPed = qtdComercialItemPedido(itemPedido);
    if (qPed > 0) {
      total += (qAcordo / qPed) * getTotalLinhaPedidoCompra(itemPedido);
    }
  }
  return roundToTwoDecimals(total);
}

/** Total da linha: prioriza `total` gravado no item (formulário); senão recalcula. */
export function getTotalLinhaPedidoCompra(item = {}) {
  const totalDireto = Number(item?.total ?? item?.valor_total_item ?? item?.subtotal);
  if (Number.isFinite(totalDireto) && totalDireto > 0) return totalDireto;
  return calcTotalItemCompraPedido(item);
}

/**
 * Recalcula total da linha com regras de CX/unidade (ignora `item.total` desatualizado).
 * Use no formulário de pedido quando o catálogo do produto está disponível.
 */
export function totalLinhaPedidoCompraAtualizado(item = {}, produto = null) {
  const base = produto ? repararLinhaCompraApresentacaoComProduto(item, produto) : item;
  const synced = syncItemDescontoApresentacao(base);
  return calcTotalItemCompraPedido(synced);
}

/** Linha com `total` / `subtotal` alinhados ao cálculo comercial atual. */
export function prepareLinhaPedidoCompraParaTotais(item = {}, produto = null) {
  const base = produto ? repararLinhaCompraApresentacaoComProduto(item, produto) : item;
  const synced = syncItemDescontoApresentacao(base);
  const total = calcTotalItemCompraPedido(synced);
  return {
    ...synced,
    total,
    valor_total_item: total,
    subtotal: total,
  };
}

/** Outros por unidade fator-1 sem a parte rateada (manual). */
export function resolveOutrosUnitarioManual(item = {}) {
  if (item.outros_unitario_fator1_manual != null) {
    return Math.max(0, Number(item.outros_unitario_fator1_manual) || 0);
  }
  const outros = Number(item.outros_unitario_fator1 ?? item.custo_outros_unitario) || 0;
  const rateado = Number(item.despesa_rateada_outros_fator1) || 0;
  return Math.max(0, outros - rateado);
}

/** Valor de mercadoria da linha (sem rateio de despesas em `outros`). */
export function valorFinanceiroLinhaPedido(item = {}, produto = null) {
  const manual = resolveOutrosUnitarioManual(item);
  const base = {
    ...item,
    outros_unitario_fator1: manual,
    custo_outros_unitario: manual,
    despesa_rateada_outros_fator1: 0,
  };
  return Math.max(0, totalLinhaPedidoCompraAtualizado(base, produto));
}

/** Soma itens do pedido usando totais recalculados (evita `item.total` legado errado em CX). */
export function calcValorItensPedidoCompraComCatalogo(pedido = {}, produtosById = {}) {
  const itens = pedido.itens || [];
  if (!itens.length) return calcValorItensPedidoCompra(pedido);
  return roundToTwoDecimals(
    itens.reduce(
      (acc, item) => acc + totalLinhaPedidoCompraAtualizado(item, produtosById[item?.produto_id]),
      0,
    ),
  );
}

/** Soma dos totais de linha; `valor_itens` só entra se não houver itens no espelho. */
export function calcValorItensPedidoCompra(pedido = {}) {
  const itens = pedido.itens || [];
  if (itens.length > 0) {
    return roundToTwoDecimals(
      itens.reduce((acc, item) => acc + getTotalLinhaPedidoCompra(item), 0),
    );
  }
  const valorItensDireto = Number(pedido.valor_itens);
  if (Number.isFinite(valorItensDireto) && valorItensDireto > 0) {
    return roundToTwoDecimals(valorItensDireto);
  }
  return 0;
}

/**
 * Mercadoria no formulário: preço base dos itens, sem rateio em `outros`.
 * O acréscimo `despesas_rateadas` soma-se no total do pedido à parte.
 */
export function calcValorMercadoriaPedidoCompraBase(pedido = {}, produtosById = {}) {
  const itens = pedido.itens || [];
  if (!itens.length) {
    const valorItensDireto = Number(pedido.valor_itens);
    if (Number.isFinite(valorItensDireto) && valorItensDireto >= 0) {
      return roundToTwoDecimals(valorItensDireto);
    }
    return 0;
  }
  return roundToTwoDecimals(
    itens.reduce(
      (acc, item) => acc + valorFinanceiroLinhaPedido(item, produtosById[item?.produto_id]),
      0,
    ),
  );
}

/** @deprecated Use calcValorMercadoriaPedidoCompraBase */
export function calcValorMercadoriaPedidoCompraComRateio(pedido = {}, produtosById = {}) {
  return calcValorMercadoriaPedidoCompraBase(pedido, produtosById);
}

/** Total do pedido: mercadoria base + frete − desconto + despesas rateadas (formulário / financeiro). */
export function calcValorTotalPedidoCompra(pedido = {}, produtosById = {}) {
  const mercadoriaHeader = Number(pedido.valor_itens);
  const mercadoria = Number.isFinite(mercadoriaHeader) && mercadoriaHeader >= 0
    ? roundToTwoDecimals(mercadoriaHeader)
    : calcValorMercadoriaPedidoCompraBase(pedido, produtosById);
  const frete = Number(pedido.valor_frete) || 0;
  const desconto = Number(pedido.valor_desconto) || 0;
  const despesas = somaDespesasRateadasNoPedido(pedido);
  return roundToTwoDecimals(mercadoria + frete - desconto + despesas);
}

const statusCancelavel = (l) =>
  l?.status === 'Em Aberto' || l?.status === 'Vencido';

export async function listarLancamentosPedidoCompra(base44, pedidoId) {
  if (!pedidoId) return [];
  const [porVinculo, porReferencia] = await Promise.all([
    base44.entities.LancamentoFinanceiro.filter({ pedido_compra_vinculado_id: pedidoId }),
    base44.entities.LancamentoFinanceiro.filter({
      referencia_id: pedidoId,
      referencia_tipo: 'PedidoCompra',
    }),
  ]);
  const merged = [...(porVinculo || []), ...(porReferencia || [])];
  return merged.filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index);
}

export function temLancamentoPagoParaPedido(lancamentos) {
  return (lancamentos || []).some(isLancamentoPago);
}

/** Parcelas CMV / conta a pagar vinculadas ao pedido (exclui canceladas). */
export function filtrarLancamentosCompraPedido(pedidoId, lancamentos = []) {
  if (!pedidoId) return [];
  return (lancamentos || []).filter(
    (l) =>
      !isLancamentoCancelado(l) &&
      (l.referencia_tipo === 'PedidoCompra' ||
        l.pedido_compra_vinculado_id === pedidoId ||
        l.is_custo_mercadoria),
  );
}

/**
 * Parcelas CMV já pagas (valor coberto ou todas quitadas).
 * Usado como evidência de que o financeiro já executou o fluxo — não é o status do pedido.
 */
export function pedidoParcelasCmvPagas(lancamentos, pedido = {}) {
  const compraLancs = filtrarLancamentosCompraPedido(pedido.id, lancamentos);
  if (!compraLancs.length) return false;

  const totalEsperado = calcValorTotalPedidoCompra(pedido);
  const totalPago = compraLancs
    .filter(isLancamentoPago)
    .reduce((sum, l) => sum + Number(l.valor || 0), 0);

  if (totalEsperado > 0 && totalPago >= totalEsperado - 0.02) return true;
  return compraLancs.every(isLancamentoPago);
}

/** @deprecated Prefer pedidoParcelasCmvPagas — nome antigo mantido por compatibilidade. */
export function pedidoPagamentoCompleto(lancamentos, pedido = {}) {
  return pedidoParcelasCmvPagas(lancamentos, pedido);
}

const NOTA_APROVACAO_FINANCEIRA_RE = /\[(Aprovado Financeiramente|Aprovado:)/i;

/**
 * Evidência de que a aprovação financeira do pedido já ocorreu (no pedido ou nos lançamentos),
 * mesmo quando `status_aprovacao_financeira` do pedido ficou desatualizado.
 */
export function evidenciaAprovacaoFinanceiraProcessada(pedido = {}, lancamentos = []) {
  if (pedido.data_aprovacao_financeira) return true;

  const historico = pedido.historico || '';
  if (NOTA_APROVACAO_FINANCEIRA_RE.test(historico)) return true;

  const compraLancs = filtrarLancamentosCompraPedido(pedido.id, lancamentos);
  if (!compraLancs.length) return false;

  if (pedidoParcelasCmvPagas(lancamentos, pedido)) return true;

  return compraLancs.some((l) => NOTA_APROVACAO_FINANCEIRA_RE.test(l.observacoes || ''));
}

/** Pedido ainda marcado como aguardando aprovação financeira nos campos de status. */
export function pedidoStatusIndicaAguardandoAprovacaoFinanceira(pedido = {}) {
  const status = pedido.status || '';
  const saf = pedido.status_aprovacao_financeira || '';
  return (
    status === 'Aguardando Aprovação Financeira' ||
    status === 'Aguardando Liberação' ||
    saf === 'Aguardando Aprovação Financeira'
  );
}

/** Pedido com status pendente mas lançamentos/histórico indicam aprovação financeira já feita. */
export function pedidoPrecisaSincronizarAprovacaoFinanceira(pedido = {}, lancamentos = []) {
  if (!pedidoStatusIndicaAguardandoAprovacaoFinanceira(pedido)) return false;
  return evidenciaAprovacaoFinanceiraProcessada(pedido, lancamentos);
}

/** Status financeiro efetivo para exibição (considera lançamentos quando o pedido está desatualizado). */
export function getPedidoCompraDisplayStatusFinanceiro(pedido = {}, lancamentos = []) {
  const aprovadoEfetivo =
    pedido._financeiro_aprovado_efetivo || evidenciaAprovacaoFinanceiraProcessada(pedido, lancamentos);

  if (aprovadoEfetivo) return 'Aprovado Financeiramente';

  const saf = pedido.status_aprovacao_financeira || '';
  if (saf === 'Rejeitado Financeiramente' || saf === 'Rejeitado') return saf;
  if (saf === 'Solicitação de Edição Pendente') return saf;
  if (pedidoStatusIndicaAguardandoAprovacaoFinanceira(pedido)) {
    return 'Aguardando Aprovação Financeira';
  }
  if (saf) return saf;
  return pedido.status || 'Rascunho';
}

/** Rótulo curto do status financeiro para cabeçalho / lista. */
export function getPedidoCompraDisplayStatusFinanceiroLabel(status = '') {
  if (
    status === 'Aguardando Liberação Financeira' ||
    status === 'Aguardando Aprovação Financeira' ||
    status === 'Aguardando Liberação'
  ) {
    return 'Aguard. Pgto';
  }
  if (status === 'Aprovado Financeiramente' || status === 'Aprovado') return 'Aprovado';
  return status;
}

const LANCAMENTOS_PEDIDO_CHUNK = 40;

function anexarLancamentosNoMapa(map, lancamento) {
  const l = lancamento || {};
  const candidatos = [
    l.pedido_compra_vinculado_id,
    l.referencia_tipo === 'PedidoCompra' ? l.referencia_id : null,
  ].filter(Boolean);

  for (const pid of candidatos) {
    if (!map.has(pid)) map.set(pid, []);
    const arr = map.get(pid);
    if (!arr.some((x) => x.id === l.id)) arr.push(l);
  }
}

/** Busca lançamentos de compra em lote (evita N×2 filters na lista de gestão). */
export async function carregarLancamentosPedidosCompraMapBatch(base44, pedidoIds = []) {
  const map = new Map();
  const ids = [...new Set((pedidoIds || []).filter(Boolean))];
  if (!ids.length || !base44?.entities?.LancamentoFinanceiro?.filter) return map;

  const lf = base44.entities.LancamentoFinanceiro;
  for (let i = 0; i < ids.length; i += LANCAMENTOS_PEDIDO_CHUNK) {
    const chunk = ids.slice(i, i + LANCAMENTOS_PEDIDO_CHUNK);
    const [porVinculo, porReferencia] = await Promise.all([
      lf.filter({ pedido_compra_vinculado_id: { $in: chunk } }).catch(() => []),
      lf.filter({ referencia_id: { $in: chunk }, referencia_tipo: 'PedidoCompra' }).catch(() => []),
    ]);
    [...(porVinculo || []), ...(porReferencia || [])].forEach((row) => anexarLancamentosNoMapa(map, row));
  }

  for (const rows of map.values()) {
    rows.sort((a, b) => {
      const da = a.data_vencimento || a.data_pagamento || '';
      const db = b.data_vencimento || b.data_pagamento || '';
      return String(da).localeCompare(String(db), 'pt-BR');
    });
  }

  return map;
}

export async function carregarLancamentosPedidosCompraMap(base44, pedidoIds = []) {
  return carregarLancamentosPedidosCompraMapBatch(base44, pedidoIds);
}

export function enriquecerPedidoCompraFinanceiroDisplay(pedido = {}, lancamentos = []) {
  const aprovadoEfetivo = evidenciaAprovacaoFinanceiraProcessada(pedido, lancamentos);
  return {
    ...pedido,
    _lancamentos_compra: lancamentos,
    _financeiro_aprovado_efetivo: aprovadoEfetivo,
    _display_status_financeiro: getPedidoCompraDisplayStatusFinanceiro(
      { ...pedido, _financeiro_aprovado_efetivo: aprovadoEfetivo },
      lancamentos,
    ),
  };
}

/**
 * Enriquece pedidos/cards com evidência financeira para exibição (embarques, cabeçalho).
 * @returns {{ pedidos: Array, cards: Array }}
 */
export async function enriquecerPedidosCompraGestaoFinanceiro(base44, pedidos = [], cards = []) {
  const ids = pedidos.map((p) => p.id).filter(Boolean);
  if (!ids.length) return { pedidos, cards };

  const lancMap = await carregarLancamentosPedidosCompraMapBatch(base44, ids);

  const pedidosEnriquecidos = pedidos.map((pedido) => {
    const lancs = lancMap.get(pedido.id) || [];
    const base = lancs.length
      ? enriquecerPedidoCompraFinanceiroDisplay(pedido, lancs)
      : { ...pedido, _lancamentos_compra: pedido._lancamentos_compra || [] };
    const dataPagamento = getPedidoCompraDataPagamentoChave(base);
    return {
      ...base,
      _data_pagamento_resolvida: dataPagamento || base._data_pagamento_resolvida,
      _display_data_pagamento: dataPagamento,
    };
  });

  const pedidosPorId = new Map(pedidosEnriquecidos.map((p) => [p.id, p]));
  const cardsEnriquecidos = cards.map((card) => {
    const pedidoBase = pedidosPorId.get(card.id);
    if (!pedidoBase) return card;
    const merged = {
      ...card,
      data_primeiro_vencimento:
        pedidoBase.data_primeiro_vencimento ?? card.data_primeiro_vencimento,
      _lancamentos_compra: pedidoBase._lancamentos_compra,
      _financeiro_aprovado_efetivo: pedidoBase._financeiro_aprovado_efetivo,
      _display_status_financeiro: pedidoBase._display_status_financeiro,
      _data_pagamento_resolvida: pedidoBase._data_pagamento_resolvida,
    };
    const dataPagamento = getPedidoCompraDataPagamentoChave(merged);
    return {
      ...merged,
      _display_data_pagamento: dataPagamento,
    };
  });

  return { pedidos: pedidosEnriquecidos, cards: cardsEnriquecidos };
}

/**
 * Cancela parcelas Em Aberto / Vencido vinculadas ao pedido (não pagas).
 * @returns {{ cancelados: number }}
 */
export async function cancelarLancamentosNaoPagosPedidoCompra(base44, pedidoId, notaObservacao) {
  const lancamentos = await listarLancamentosPedidoCompra(base44, pedidoId);
  const alvos = lancamentos.filter((l) => statusCancelavel(l) && !isLancamentoPago(l));
  const sufixo = notaObservacao ? ` ${notaObservacao}` : '';

  await Promise.all(
    alvos.map((l) =>
      base44.entities.LancamentoFinanceiro.update(l.id, {
        status: 'Cancelado',
        observacoes: `${l.observacoes || ''}\n[Cancelado: reabertura/correção do pedido]${sufixo}`.trim(),
      })
    )
  );

  return { cancelados: alvos.length };
}

/**
 * Gera lançamento de ajuste quando um pedido com parcelas pagas muda de valor.
 * Diferenca > 0: despesa (conta a pagar). Diferenca < 0: receita (conta a receber).
 */
export async function criarLancamentoAjustePedidoCompra(base44, {
  pedido = {},
  diferenca = 0,
  valorAnterior = 0,
  valorNovo = 0,
  motivo = '',
  responsavel = '',
} = {}) {
  const diff = roundToTwoDecimals(diferenca);
  if (!pedido?.id || Math.abs(diff) < 0.01) return null;

  const contaPagar = diff > 0;
  const valorAjuste = Math.abs(diff);
  const numeroPedido = pedido.numero || pedido.id;
  const tipo = contaPagar ? 'Despesa' : 'Receita';
  const descricao = contaPagar
    ? `Ajuste de Pedido (diferença a pagar) - ${numeroPedido}`
    : `Ajuste de Pedido (diferença a receber) - ${numeroPedido}`;
  const observacoesBase = [
    '[Ajuste automático por edição de pedido com pagamento já realizado]',
    `Valor anterior: R$ ${Number(valorAnterior || 0).toFixed(2)}`,
    `Valor novo: R$ ${Number(valorNovo || 0).toFixed(2)}`,
    `Diferença: ${contaPagar ? '+' : '-'}R$ ${valorAjuste.toFixed(2)}`,
    motivo ? `Motivo: ${motivo}` : '',
    responsavel ? `Responsável: ${responsavel}` : '',
    `Data: ${formatarLogTime()}`,
  ].filter(Boolean).join('\n');

  return base44.entities.LancamentoFinanceiro.create({
    tipo,
    descricao,
    valor: valorAjuste,
    valor_liquido: valorAjuste,
    status: 'Em Aberto',
    categoria: 'Ajuste de Pedido de Compra',
    tags: [contaPagar ? 'conta_pagar' : 'conta_receber', 'ajuste_pedido_compra'],
    terceiro_id: pedido.fornecedor_id || '',
    terceiro_nome: pedido.fornecedor_nome || '',
    data_vencimento: dataHoje(),
    referencia_id: pedido.id,
    referencia_tipo: 'PedidoCompra',
    referencia_numero: numeroPedido,
    pedido_compra_vinculado_id: pedido.id,
    pedido_compra_vinculado_numero: numeroPedido,
    is_custo_mercadoria: !!contaPagar,
    observacoes: observacoesBase,
  });
}
