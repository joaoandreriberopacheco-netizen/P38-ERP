import { subMonths, startOfMonth, endOfMonth, format, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { base44 } from '@/api/base44Client';
import { enrichProdutosComIep } from '@/lib/calcularIepProdutos';
import { fetchDadosVendaAbcd90d } from '@/lib/fetchPedidosVenda90d';
import {
  buildPendenteAprovadoFinanceiroPorProduto,
  buildRecebidosPorPedidoProdutoFromEmbarques,
  pedidoCompraAprovadoNaoConcluido as pedidoCompraAprovadoNaoConcluidoCanonico,
  pedidoCompraTotalmenteRecebido,
} from '@/lib/sugestaoCompraEstoquePendente';
import { fetchPedidosCompraParaSugestaoEstoque } from '@/lib/fetchPedidosCompraParaSugestaoEstoque';
import {
  computeEstoqueLocalizacaoValores,
  resolveProdutoCustoUnitarioBase,
  sumCatalogTransitStockValueByAbcd,
} from '@/lib/catalogStockTotals';
import { resolveProdutoAbcdClasse } from '@/lib/catalogAbcdEnrichment';
import { resolveCustoTotalUnitBaseProduto } from '@/lib/productUnits';
import { fetchProdutosList } from '@/hooks/useP38Entities';
import { p38Keys, P38_STALE_TIME } from '@/lib/p38QueryConfig';
import { inicioDiaSistemaISO, fimDiaSistemaISO } from '@/components/utils/dateUtils';
import {
  getHojeDateKey,
  getOntemDateKey,
  mergeMovimentosById,
} from '@/lib/dashboardIncrementalCache';
import {
  buildEstoqueFisicoPorProdutoNoFimDoMes,
  getMarcaMensalEstoque,
  getMovimentoDeltaReconstrucao,
  movimentoContaNaReconstrucaoEstoque,
} from '@/lib/dashboardEstoqueReconstrucao';

const QUALITY_ORDER = ['A', 'B', 'C', 'D', 'E'];
const QUALITY_LABELS = {
  A: 'Curva A',
  B: 'Curva B',
  C: 'Curva C',
  D: 'Curva D',
  E: 'Curva E',
};

const PEDIDO_VENDA_STATUSES_CMV = new Set([
  'financeiro ok',
  'em separação',
  'em separacao',
  'em rota de entrega',
  'pedido concluído',
  'pedido concluido',
]);

const PERCENT = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
});

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function getMonthBuckets() {
  const now = new Date();
  const reconciliationStart = new Date('2026-04-01T00:00:00');
  const defaultStart = startOfMonth(subMonths(now, 5));
  const rangeStart = isBefore(defaultStart, reconciliationStart) ? reconciliationStart : defaultStart;

  const months = [];
  let monthDate = startOfMonth(rangeStart);
  while (!isAfter(monthDate, now)) {
    months.push({
      key: format(monthDate, 'yyyy-MM'),
      label: format(monthDate, 'MMM/yy', { locale: ptBR }).toUpperCase(),
      start: startOfMonth(monthDate),
      end: endOfMonth(monthDate),
    });
    monthDate = startOfMonth(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1));
  }
  return months;
}

export function getSupplyMonthBuckets() {
  const now = new Date();
  return [2, 1, 0].map((offset) => {
    const monthDate = subMonths(now, offset);
    return {
      key: format(monthDate, 'yyyy-MM'),
      label: format(monthDate, 'MMM/yy', { locale: ptBR }).toUpperCase(),
      start: startOfMonth(monthDate),
      end: endOfMonth(monthDate),
    };
  });
}

function getSupplyStatus(percentage) {
  if (!Number.isFinite(percentage) || percentage === 0) return 'healthy';
  if (percentage > 105) return 'high';
  if (percentage < 95) return 'low';
  return 'healthy';
}

function pedidoVendaContaNoCMV(pedido = {}) {
  const status = normalizeStatus(pedido.status);
  const tipo = normalizeStatus(pedido.tipo);
  if (status === 'cancelado') return false;
  if (tipo === 'orçamento' || tipo === 'orcamento') return false;
  if (PEDIDO_VENDA_STATUSES_CMV.has(status)) return true;
  return status !== 'orçamento' && status !== 'orcamento' && status !== 'aguardando caixa';
}

function pedidoCompraAprovadoNaoConcluido(pedido = {}) {
  return pedidoCompraAprovadoNaoConcluidoCanonico(pedido);
}

function embarqueRecebidoAte(embarque = {}, monthEnd) {
  const statusReceb = normalizeStatus(embarque?.status_recebimento);
  const statusEmbarque = normalizeStatus(embarque?.status);
  const recebido =
    statusReceb === 'recebido ok' ||
    statusReceb === 'com divergencia' ||
    statusReceb === 'recebido parcial' ||
    statusEmbarque === 'concluido';
  if (!recebido) return false;

  const dataReceb = parseDate(
    embarque.data_recebimento || embarque.data_conclusao || embarque.updated_date || embarque.created_date,
  );
  return dataReceb && !isAfter(dataReceb, monthEnd);
}

function embarqueEmTransitoNoFimDoMes(embarque = {}, monthEnd) {
  const dataEmbarque = parseDate(embarque.data_embarque || embarque.eta || embarque.created_date);
  if (!dataEmbarque || isAfter(dataEmbarque, monthEnd)) return false;
  if (embarqueRecebidoAte(embarque, monthEnd)) return false;
  return true;
}

/** Pendente de trânsito no fim do mês — mesma regra do card Localização (hoje). */
function buildPendenteLocalizacaoNoFimDoMes(monthEnd, pedidosCompra = [], embarquesCompra = []) {
  const embarquesRecebidosAteMes = embarquesCompra.filter((embarque) => embarqueRecebidoAte(embarque, monthEnd));
  const recebidosPorPedidoProduto = buildRecebidosPorPedidoProdutoFromEmbarques(
    embarquesRecebidosAteMes,
    pedidosCompra,
  );

  const pedidosAteMes = pedidosCompra.filter((pedido) => {
    const dataPedido = parseDate(pedido.data_emissao || pedido.created_date);
    return dataPedido && !isAfter(dataPedido, monthEnd);
  });

  const pedidosAbertosNoFim = pedidosAteMes.filter((pedido) => {
    if (!pedidoCompraAprovadoNaoConcluido(pedido)) return false;
    const recebidos = recebidosPorPedidoProduto[String(pedido.id)] || {};
    return !pedidoCompraTotalmenteRecebido(pedido, recebidos);
  });

  return buildPendenteAprovadoFinanceiroPorProduto(
    pedidosAbertosNoFim,
    recebidosPorPedidoProduto,
    {
      embarques: embarquesCompra.filter((embarque) => embarqueEmTransitoNoFimDoMes(embarque, monthEnd)),
      pedidosParaEmbarque: pedidosAteMes,
    },
  );
}

function getMovimentoDate(movimento = {}) {
  const raw = movimento.data_movimento || movimento.created_date || movimento.data;
  return parseDate(raw);
}

function buildNivelEstoqueSeries({
  monthBuckets,
  produtosComAbcd,
  skuBase,
  movimentosReconstrucao,
  pedidosCompraLista,
  embarquesCompraLista,
  pendentePorProdutoAtual,
}) {
  const sortedMovements = movimentosReconstrucao
    .slice()
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const currentMonthKey = monthBuckets[monthBuckets.length - 1]?.key;
  const deltaAfterBySku = new Map();
  let movIdx = 0;
  const nivelEstoqueSeries = [];

  for (let i = monthBuckets.length - 1; i >= 0; i -= 1) {
    const bucket = monthBuckets[i];
    const monthEnd = bucket.end;
    const isCurrentMonth = bucket.key === currentMonthKey;

    const marcaMensal = getMarcaMensalEstoque(bucket.key);
    if (marcaMensal) {
      nivelEstoqueSeries.unshift({
        periodo: bucket.label,
        valor: marcaMensal.estoqueFisico,
        valorFisico: marcaMensal.estoqueFisico,
        valorVirtual: marcaMensal.transitoFinanceiroAprovado,
        valorGeral: marcaMensal.totalLocalizacao,
      });
      continue;
    }

    while (movIdx < sortedMovements.length && isAfter(sortedMovements[movIdx].date, monthEnd)) {
      const movimento = sortedMovements[movIdx];
      deltaAfterBySku.set(
        movimento.skuId,
        (deltaAfterBySku.get(movimento.skuId) || 0) + movimento.deltaQuantidade,
      );
      movIdx += 1;
    }

    const estoqueFisicoPorProdutoId = buildEstoqueFisicoPorProdutoNoFimDoMes(
      produtosComAbcd,
      skuBase,
      deltaAfterBySku,
    );

    const pendentePorProduto = isCurrentMonth
      ? pendentePorProdutoAtual
      : buildPendenteLocalizacaoNoFimDoMes(monthEnd, pedidosCompraLista, embarquesCompraLista);

    const { estoqueFisico, transitoFinanceiroAprovado, totalLocalizacao } = computeEstoqueLocalizacaoValores(
      produtosComAbcd,
      pendentePorProduto,
      isCurrentMonth ? null : estoqueFisicoPorProdutoId,
    );

    nivelEstoqueSeries.unshift({
      periodo: bucket.label,
      valor: estoqueFisico,
      valorFisico: estoqueFisico,
      valorVirtual: transitoFinanceiroAprovado,
      valorGeral: totalLocalizacao,
    });
  }

  return nivelEstoqueSeries;
}

function bucketLancamentosPorMes(lancamentosLista, supplyMonthBuckets) {
  const cmvEfetivoByMonth = new Map(supplyMonthBuckets.map((bucket) => [bucket.key, 0]));

  for (const lancamento of lancamentosLista) {
    if (normalizeStatus(lancamento.status) === 'cancelado') continue;
    const dataPagamento = parseDate(lancamento.data_pagamento);
    if (!dataPagamento) continue;

    for (const bucket of supplyMonthBuckets) {
      if (!isBefore(dataPagamento, bucket.start) && !isAfter(dataPagamento, bucket.end)) {
        cmvEfetivoByMonth.set(
          bucket.key,
          (cmvEfetivoByMonth.get(bucket.key) || 0) + Number(lancamento.valor || 0),
        );
        break;
      }
    }
  }

  return cmvEfetivoByMonth;
}

function bucketCmvVendidoPorMes(pedidosVendaLista, supplyMonthBuckets, custoProdutoMap) {
  const cmvVendidoByMonth = new Map(supplyMonthBuckets.map((bucket) => [bucket.key, 0]));

  for (const pedido of pedidosVendaLista) {
    if (!pedidoVendaContaNoCMV(pedido)) continue;
    const saleDate = parseDate(pedido.created_date);
    if (!saleDate) continue;

    for (const bucket of supplyMonthBuckets) {
      if (!isBefore(saleDate, bucket.start) && !isAfter(saleDate, bucket.end)) {
        const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
        const totalPedido = itens.reduce((sumItens, item) => {
          const quantidade = Number(item.quantidade_base || item.quantidade || 0);
          const custoFallback = Number(custoProdutoMap.get(item.produto_id) || 0);
          const custoUnitario = Number(item.custo_unitario_momento || custoFallback || 0);
          return sumItens + quantidade * custoUnitario;
        }, 0);
        cmvVendidoByMonth.set(bucket.key, (cmvVendidoByMonth.get(bucket.key) || 0) + totalPedido);
        break;
      }
    }
  }

  return cmvVendidoByMonth;
}

async function ensureCached(queryClient, key, queryFn, staleTime = P38_STALE_TIME) {
  if (!queryClient) return queryFn();
  return queryClient.ensureQueryData({ queryKey: key, queryFn, staleTime });
}

async function fetchMovimentacoesIncremental(queryClient, nivelStartISO, endISO) {
  const hoje = getHojeDateKey();
  const ontem = getOntemDateKey();
  const ontemISO = ontem <= endISO.slice(0, 10) ? ontem : endISO.slice(0, 10);

  const fetchHistoric = () =>
    base44.entities.MovimentacaoEstoque.filter(
      {
        created_date: {
          $gte: inicioDiaSistemaISO(nivelStartISO),
          $lte: fimDiaSistemaISO(ontemISO),
        },
      },
      '-created_date',
      10000,
    ).catch(() => []);

  const fetchHoje = () =>
    base44.entities.MovimentacaoEstoque.filter(
      {
        created_date: {
          $gte: inicioDiaSistemaISO(hoje),
          $lte: fimDiaSistemaISO(hoje),
        },
      },
      '-created_date',
      500,
    ).catch(() => []);

  const [historic, todayRows] = await Promise.all([
    ensureCached(
      queryClient,
      p38Keys.dashboardEstoqueMovimentosAteOntem(ontem, nivelStartISO),
      fetchHistoric,
      Number.POSITIVE_INFINITY,
    ),
    ensureCached(
      queryClient,
      p38Keys.dashboardEstoqueMovimentosHoje(hoje),
      fetchHoje,
      2 * 60 * 1000,
    ),
  ]);

  return mergeMovimentosById(
    Array.isArray(historic) ? historic : [],
    Array.isArray(todayRows) ? todayRows : [],
  );
}

/**
 * Carrega e calcula métricas do dashboard de estoque.
 * Reutiliza cache React Query de produtos; movimentos até ontem + hoje; ABCD opcional.
 */
export async function fetchDashboardEstoqueMetrics(queryClient, options = {}) {
  const { includeAbcdEnrichment = false } = options;
  const monthBuckets = getMonthBuckets();
  const supplyMonthBuckets = getSupplyMonthBuckets();

  const startDate = monthBuckets[0]?.start;
  const endDate = monthBuckets[monthBuckets.length - 1]?.end;
  const nivelEstoqueStartDate = monthBuckets[0]?.start || startDate;

  const supplyStartISO = format(supplyMonthBuckets[0]?.start || startDate, 'yyyy-MM-dd');
  const supplyEndISO = format(supplyMonthBuckets[supplyMonthBuckets.length - 1]?.end || endDate, 'yyyy-MM-dd');
  const endISO = format(endDate, 'yyyy-MM-dd');
  const nivelStartISO = format(nivelEstoqueStartDate, 'yyyy-MM-dd');

  const [produtos, movimentacoesEstoqueRaw, lancamentosFinanceiros, pedidosVenda, sugestaoEstoqueData] =
    await Promise.all([
      ensureCached(queryClient, p38Keys.produtos(), () => fetchProdutosList()),
      fetchMovimentacoesIncremental(queryClient, nivelStartISO, endISO),
      base44.entities.LancamentoFinanceiro.filter(
        {
          tipo: 'Despesa',
          is_custo_mercadoria: true,
          data_pagamento: { $gte: supplyStartISO, $lte: supplyEndISO },
        },
        '-data_pagamento',
        20000,
      ),
      base44.entities.PedidoVenda.filter(
        {
          tipo: 'PDV',
          created_date: {
            $gte: inicioDiaSistemaISO(supplyStartISO),
            $lte: fimDiaSistemaISO(supplyEndISO),
          },
        },
        '-created_date',
        3000,
      ).catch(() => []),
      ensureCached(
        queryClient,
        p38Keys.pedidosCompraSugestao(),
        () => fetchPedidosCompraParaSugestaoEstoque(base44),
        P38_STALE_TIME,
      ).catch(() => null),
    ]);

  let dadosVendaAbcd90d = null;
  if (includeAbcdEnrichment) {
    dadosVendaAbcd90d = await ensureCached(
      queryClient,
      p38Keys.dadosVendaAbcd90d(),
      () => fetchDadosVendaAbcd90d(),
      10 * 60 * 1000,
    ).catch(() => null);
  }

  const pedidosCompraLista = Array.isArray(sugestaoEstoqueData?.pedidosTodos)
    ? sugestaoEstoqueData.pedidosTodos
    : [];
  const embarquesCompraLista = Array.isArray(sugestaoEstoqueData?.embarques)
    ? sugestaoEstoqueData.embarques
    : [];

  const produtosLista = Array.isArray(produtos) ? produtos : [];
  const produtosComAbcdCatalogo = Array.isArray(dadosVendaAbcd90d?.pedidos90d)
    ? enrichProdutosComIep(produtosLista, dadosVendaAbcd90d)
    : produtosLista;

  const movimentacoesEstoqueLista = Array.isArray(movimentacoesEstoqueRaw)
    ? movimentacoesEstoqueRaw.filter((movimento) => {
      const date = getMovimentoDate(movimento);
      if (!date) return false;
      return !isBefore(date, nivelEstoqueStartDate);
    })
    : [];

  const lancamentosLista = Array.isArray(lancamentosFinanceiros) ? lancamentosFinanceiros : [];
  const pedidosVendaLista = Array.isArray(pedidosVenda) ? pedidosVenda : [];

  const pendentePorProdutoCatalogo = sugestaoEstoqueData
    ? buildPendenteAprovadoFinanceiroPorProduto(
      sugestaoEstoqueData.pedidosAbertos,
      sugestaoEstoqueData.recebidosPorPedidoProduto,
      {
        embarques: sugestaoEstoqueData.embarques,
        pedidosParaEmbarque: sugestaoEstoqueData.pedidosTodos,
      },
    )
    : {};

  const qualityAccumulator = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  const qualityTransitRawAccumulator = sumCatalogTransitStockValueByAbcd(
    produtosComAbcdCatalogo,
    pendentePorProdutoCatalogo,
    QUALITY_ORDER,
  );

  produtosComAbcdCatalogo.forEach((produto) => {
    if (!produto?.ativo) return;
    const custoUnitario = resolveProdutoCustoUnitarioBase(produto);
    const estoqueAtual = Number(produto.estoque_atual || 0);
    const estoqueGerencial = Math.max(0, estoqueAtual);
    const valorEstoque = estoqueGerencial * custoUnitario;

    const curva = resolveProdutoAbcdClasse(produto);
    if (QUALITY_ORDER.includes(curva)) {
      qualityAccumulator[curva] += valorEstoque;
    }
  });

  const skuBase = new Map(
    produtosLista.map((produto) => [
      produto.id,
      {
        estoqueAtual: Number(produto.estoque_atual || 0),
        custoAtual: Number(resolveCustoTotalUnitBaseProduto(produto)),
      },
    ]),
  );

  const movimentosReconstrucao = movimentacoesEstoqueLista
    .filter((movimento) => movimentoContaNaReconstrucaoEstoque(movimento))
    .map((movimento) => ({
      skuId: movimento.produto_id,
      date: getMovimentoDate(movimento),
      deltaQuantidade: getMovimentoDeltaReconstrucao(movimento),
    }))
    .filter((movimento) => movimento.skuId && movimento.date && movimento.deltaQuantidade !== 0);

  const custoProdutoMap = new Map(
    produtosLista.map((produto) => [produto.id, Number(resolveCustoTotalUnitBaseProduto(produto))]),
  );

  const nivelEstoqueSeries = buildNivelEstoqueSeries({
    monthBuckets,
    produtosComAbcd: produtosComAbcdCatalogo,
    skuBase,
    movimentosReconstrucao,
    pedidosCompraLista,
    embarquesCompraLista,
    pendentePorProdutoAtual: pendentePorProdutoCatalogo,
  });

  const cmvEfetivoByMonth = bucketLancamentosPorMes(lancamentosLista, supplyMonthBuckets);
  const cmvVendidoByMonth = bucketCmvVendidoPorMes(pedidosVendaLista, supplyMonthBuckets, custoProdutoMap);

  const supplyByMonth = supplyMonthBuckets.map((bucket) => {
    const cmvEfetivo = cmvEfetivoByMonth.get(bucket.key) || 0;
    const cmvVendido = cmvVendidoByMonth.get(bucket.key) || 0;
    const ratioPercent = cmvVendido > 0 ? (cmvEfetivo / cmvVendido) * 100 : 0;
    return {
      key: bucket.key,
      label: bucket.label,
      cmvEfetivo,
      cmvVendido,
      ratioPercent,
      diff: cmvEfetivo - cmvVendido,
      status: getSupplyStatus(ratioPercent),
    };
  });

  const { estoqueFisico, transitoFinanceiroAprovado, totalLocalizacao } = computeEstoqueLocalizacaoValores(
    produtosComAbcdCatalogo,
    pendentePorProdutoCatalogo,
  );

  const qualityTotal = QUALITY_ORDER.reduce((sum, key) => sum + qualityAccumulator[key], 0);

  const QUALITY_COLORS = {
    A: '#abc85a',
    B: '#7f9850',
    C: '#6f82a1',
    D: '#8f6f63',
    E: '#64748b',
  };

  const qualityDistribution = QUALITY_ORDER.map((key) => {
    const valor = qualityAccumulator[key];
    const share = qualityTotal > 0 ? valor / qualityTotal : 0;
    return {
      key,
      label: QUALITY_LABELS[key],
      valor,
      share,
      percentText: PERCENT.format(share),
      color: QUALITY_COLORS[key],
    };
  });

  const qualityDistributionGeral = QUALITY_ORDER.map((key) => {
    const valorFisico = qualityAccumulator[key];
    const valorTransito = Number(qualityTransitRawAccumulator[key] || 0);
    const valor = valorFisico + valorTransito;
    return {
      key,
      label: QUALITY_LABELS[key],
      valor,
      color: QUALITY_COLORS[key],
    };
  });

  const qualityTotalGeral = qualityDistributionGeral.reduce(
    (sum, bucket) => sum + Number(bucket.valor || 0),
    0,
  );

  const qualityDistributionGeralComPct = qualityDistributionGeral.map((bucket) => {
    const share = qualityTotalGeral > 0 ? bucket.valor / qualityTotalGeral : 0;
    return {
      ...bucket,
      share,
      percentText: PERCENT.format(share),
    };
  });

  return {
    nivelEstoqueSeries,
    supplyByMonth,
    qualityDistribution,
    qualityDistributionGeral: qualityDistributionGeralComPct,
    estoqueFisico,
    transitoFinanceiroAprovado,
    totalLocalizacao,
  };
}
