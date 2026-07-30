import React, { useEffect, useMemo, useState } from 'react';
import { subMonths, startOfMonth, endOfMonth, format, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { base44 } from '@/api/base44Client';
import { pedidoLiberadoParaLogistica } from '@/lib/aprovarPedidoCompraFinanceiro';
import { enrichProdutosComIep } from '@/lib/calcularIepProdutos';
import { resolveProdutoAbcdClasse } from '@/lib/catalogAbcdEnrichment';
import { fetchDadosVendaAbcd90d } from '@/lib/fetchPedidosVenda90d';
import {
  FILTRO_COMPRAS_SOMENTE_NAO_CONCLUIDOS_DEFAULT,
  FILTRO_COMPRAS_ULTIMOS_30_DIAS_DEFAULT,
  passaFiltroVisibilidadePedidosCompra,
} from '@/lib/filtroVisibilidadePedidosCompra';
import {
  calcValorItensPedidoCompra,
  calcValorTotalPedidoCompra,
  getTotalLinhaPedidoCompra,
} from '@/lib/pedidoCompraFinanceiro';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useP38DashboardSurfaces } from '@/paiol/components/dashboard/useP38DashboardSurfaces';
import {
  buildCartesianGridProps,
  buildXAxisProps,
  buildYAxisProps,
  DASHBOARD_CHART_MARGIN,
} from '@/lib/dashboardChartLayout';
import { useDashboardChartTheme } from '@/lib/useDashboardChartTheme';
import { toLocalDateKey } from '@/components/utils/dateUtils';
import { AlertCircle, Gauge, Layers, Package, Truck } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const PERCENT = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
});

const QUALITY_ORDER = ['A', 'B', 'C', 'D', 'E'];
const QUALITY_LABELS = {
  A: 'Curva A',
  B: 'Curva B',
  C: 'Curva C',
  D: 'Curva D',
  E: 'Curva E',
};

const QUALITY_COLORS = {
  A: '#84CC16',
  B: '#65A30D',
  C: '#9CA3AF',
  D: '#A8A29E',
  E: '#6B7280',
};

const SUPPLY_RING_COLORS = {
  healthy: '#84CC16',
  healthyDark: '#65A30D',
  high: '#A3E635',
  highDark: '#84CC16',
  low: '#9CA3AF',
  lowDark: '#6B7280',
  muted: '#E5E7EB',
};

const LOCATION_COLORS = {
  fisico: '#84CC16',
  transito: '#9CA3AF',
};

const STOCK_BAR_COLORS = ['#BEF264', '#A3E635', '#84CC16', '#65A30D', '#4D7C0F', '#3F6212'];

const PEDIDO_VENDA_STATUSES_CMV = new Set([
  'financeiro ok',
  'em separação',
  'em separacao',
  'em rota de entrega',
  'pedido concluído',
  'pedido concluido',
]);

const PEDIDO_COMPRA_APPROVED_STATUSES = new Set([
  'aprovado financeiramente',
  'aprovado',
]);

const toLocalDate = (d) => toLocalDateKey(new Date(d));

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getMonthBuckets() {
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

function getSupplyMonthBuckets() {
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

function formatShort(value) {
  if (!Number.isFinite(value) || value === 0) return 'R$ 0';
  if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}K`;
  return BRL.format(value);
}

function getSupplyStatus(percentage) {
  if (!Number.isFinite(percentage) || percentage === 0) return 'healthy';
  if (percentage > 105) return 'high';
  if (percentage < 95) return 'low';
  return 'healthy';
}

function getSupplyColorByStatus(status) {
  if (status === 'high') return SUPPLY_RING_COLORS.high;
  if (status === 'low') return SUPPLY_RING_COLORS.low;
  return SUPPLY_RING_COLORS.healthy;
}

function getSupplyOverflowColorByStatus(status) {
  if (status === 'high') return SUPPLY_RING_COLORS.highDark;
  if (status === 'low') return SUPPLY_RING_COLORS.lowDark;
  return SUPPLY_RING_COLORS.healthyDark;
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
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
  const statusDisplay = String(pedido.status || '').trim();
  const ehAguardandoPagamento = [
    'Aguardando Aprovação Financeira',
    'Aguardando Liberação Financeira',
    'Aguardando Liberação',
    'Aguardando',
  ].includes(statusDisplay);
  if (ehAguardandoPagamento) return false;

  const statusAprovacao = normalizeStatus(pedido.status_aprovacao_financeira || pedido.status);
  const aprovadoViaStatus = pedidoLiberadoParaLogistica(pedido);
  const aprovado = PEDIDO_COMPRA_APPROVED_STATUSES.has(statusAprovacao);
  if (!aprovado && !aprovadoViaStatus) return false;

  const statusRecebimento = normalizeStatus(pedido.status_recebimento_geral);
  const statusPedido = normalizeStatus(pedido.status);
  const concluidoRecebimento =
    statusRecebimento.startsWith('concluído') || statusRecebimento.startsWith('concluido');
  const concluidoPedido = statusPedido === 'concluído' || statusPedido === 'concluido';

  return !concluidoRecebimento && !concluidoPedido;
}

function percentualPendentePedidoCompra(pedido = {}) {
  const percentualEmbarcado = Number(pedido.percentual_valor_embarcado);
  if (!Number.isFinite(percentualEmbarcado)) return 1;
  const pendente = 1 - Math.min(Math.max(percentualEmbarcado, 0), 100) / 100;
  return Math.max(0, pendente);
}

function calcularValorPendentePedidoCompra(pedido = {}, recebidosPorProdutoExterno = null) {
  const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
  const embarques = Array.isArray(pedido.embarques_registrados) ? pedido.embarques_registrados : [];
  const recebidosPorProduto = recebidosPorProdutoExterno || embarques.reduce((acc, embarque) => {
    const itensEmbarcados = Array.isArray(embarque.itens_embarcados)
      ? embarque.itens_embarcados
      : Array.isArray(embarque.itens)
        ? embarque.itens
        : [];
    itensEmbarcados.forEach((item) => {
      const produtoId = item.produto_id;
      if (!produtoId) return;
      acc[produtoId] = (acc[produtoId] || 0) + (Number(item.quantidade_recebida) || 0);
    });
    return acc;
  }, {});

  const valorPendentePorItens = itens.reduce((acc, item) => {
    const produtoId = item.produto_id;
    const quantidadeItem = Number(item.quantidade_base || item.quantidade || 0);
    const quantidadeRecebida = produtoId ? Number(recebidosPorProduto[produtoId] || 0) : 0;
    const quantidadePendente = Math.max(0, quantidadeItem - quantidadeRecebida);
    const totalItem = Number(item.total || 0);
    const custoViaTotal = quantidadeItem > 0 ? totalItem / quantidadeItem : 0;
    const custoUnitario = Number(item.custo_final_unitario || item.custo_unitario || custoViaTotal || 0);
    return acc + quantidadePendente * custoUnitario;
  }, 0);

  if (valorPendentePorItens > 0) return valorPendentePorItens;
  return Number(pedido.valor_total || 0) * percentualPendentePedidoCompra(pedido);
}

function isNecessidadeRenderizada(embarque = {}) {
  if (!embarque) return false;
  if (embarque?.tipo === 'Necessidade') return true;
  return (
    !!embarque?.observacoes &&
    String(embarque.observacoes).includes('criado automaticamente para itens pendentes')
  );
}

function hasLinkedItems(embarque = {}) {
  const itens = embarque?.itens || embarque?.itens_embarcados || [];
  return Array.isArray(itens) && itens.some((item) => (Number(item?.quantidade_embarcada) || 0) > 0);
}

function hasDespachoVinculado(embarque = {}) {
  return !!(
    embarque?.data_embarque ||
    embarque?.eta ||
    embarque?.transportadora_id ||
    embarque?.transportadora_nome
  );
}

function getQuantidadePendenteNecessidade(pedido = {}, embarque = {}) {
  if (!isNecessidadeRenderizada(embarque)) return 0;

  const itensNecessidade = embarque?.itens || embarque?.itens_embarcados || [];
  const quantidadeDoEmbarque = itensNecessidade.reduce((acc, item) => {
    return acc + (Number(item?.quantidade_embarcada) || Number(item?.quantidade_pedida) || 0);
  }, 0);

  if (quantidadeDoEmbarque > 0) return quantidadeDoEmbarque;

  return (pedido.itens || []).reduce((acc, item) => {
    const quantidade = Number(item.quantidade) || 0;
    const quantidadeVinculada = Number(item.quantidade_vinculada) || 0;
    return acc + Math.max(0, quantidade - quantidadeVinculada);
  }, 0);
}

function getBorrowedStatus(pedido = {}, embarque = {}) {
  if (!embarque) return pedido?.status || 'Rascunho';

  const temDespachoVinculado = hasDespachoVinculado(embarque);
  const statusRecebimento = embarque.status_recebimento;
  const temItensAssociados = hasLinkedItems(embarque);
  const quantidadePendente = getQuantidadePendenteNecessidade(pedido, embarque);
  const ehNecessidade = isNecessidadeRenderizada(embarque);
  const precisaPreenchimento = ehNecessidade && !temDespachoVinculado && quantidadePendente > 0;

  if (
    statusRecebimento === 'Recebido OK' ||
    statusRecebimento === 'Com Divergência' ||
    embarque.status === 'Concluído'
  ) {
    return 'Concluído';
  }
  if (statusRecebimento === 'Recebido Parcial') return 'Despachado';

  if (ehNecessidade && !temDespachoVinculado) return 'Aguardando';

  if (!ehNecessidade && !temDespachoVinculado) {
    const saf = pedido?.status_aprovacao_financeira || '';
    if (
      pedido?.status === 'Aguardando Aprovação Financeira' ||
      pedido?.status === 'Aguardando Liberação' ||
      saf === 'Aguardando Aprovação Financeira'
    ) {
      return 'Aguardando Liberação Financeira';
    }

    if (pedidoLiberadoParaLogistica(pedido)) return 'Aprovado';
    return 'Rascunho';
  }

  if (temDespachoVinculado || temItensAssociados) return 'Despachado';
  if (precisaPreenchimento) return 'Aguardando';
  return 'Rascunho';
}

function getDisplayValorEmbarque(pedido = {}, embarque = {}) {
  const itensEmbarque = embarque?.itens || embarque?.itens_embarcados || [];
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
}

function buildVirtualNecessidade(pedido = {}, embarquesDoPedido = []) {
  const embarquesReais = (embarquesDoPedido || []).filter((embarque) => !isNecessidadeRenderizada(embarque));
  const temDespachoReal = embarquesReais.some(
    (embarque) => hasLinkedItems(embarque) && hasDespachoVinculado(embarque)
  );
  if (!temDespachoReal) return null;

  const recebidosPorProduto = embarquesReais.reduce((acc, embarque) => {
    (embarque?.itens || embarque?.itens_embarcados || []).forEach((item) => {
      const produtoId = item.produto_id;
      if (!produtoId) return;
      acc[produtoId] =
        (acc[produtoId] || 0) + (Number(item.quantidade_recebida) || Number(item.quantidade_embarcada) || 0);
    });
    return acc;
  }, {});

  const itensPendentes = (pedido.itens || [])
    .map((item) => {
      const quantidadePedida = Number(item.quantidade) || 0;
      const quantidadeRecebida = Number(recebidosPorProduto[item.produto_id]) || 0;
      const quantidadePendente = Math.max(0, quantidadePedida - quantidadeRecebida);
      if (!quantidadePendente) return null;
      return {
        produto_id: item.produto_id,
        quantidade_pedida: quantidadePedida,
        quantidade_embarcada: quantidadePendente,
        quantidade_recebida: 0,
      };
    })
    .filter(Boolean);

  if (!itensPendentes.length) return null;

  return {
    id: `virtual-necessidade-${pedido.id}`,
    pedido_compra_id: pedido.id,
    tipo: 'Necessidade',
    status: 'Pendente',
    status_recebimento: 'Pendente',
    observacoes: 'Embarque de necessidade criado automaticamente para itens pendentes.',
    itens: itensPendentes,
    itens_embarcados: itensPendentes,
    created_date: new Date().toISOString(),
  };
}

function movimentoContaNoNivelEstoque(movimento = {}) {
  const motivo = normalizeStatus(movimento.motivo);
  return motivo === 'compra' || motivo === 'venda' || motivo === 'consumo interno';
}

function getMovimentoDate(movimento = {}) {
  const raw = movimento.data_movimento || movimento.created_date || movimento.data;
  const parsed = parseDate(raw);
  return parsed;
}

function getMovimentoDeltaQuantidade(movimento = {}) {
  if (!movimentoContaNoNivelEstoque(movimento)) return 0;
  const quantidade = Number(movimento.quantidade || 0);
  const motivo = normalizeStatus(movimento.motivo);
  const tipo = normalizeStatus(movimento.tipo);

  if (motivo === 'compra') return Math.abs(quantidade);
  if (motivo === 'venda' || motivo === 'consumo interno') return -Math.abs(quantidade);
  if (tipo === 'entrada') return Math.abs(quantidade);
  if (tipo === 'saída' || tipo === 'saida') return -Math.abs(quantidade);
  return 0;
}

export default function EstoqueTab() {
  const p38Dashboard = useP38DashboardSurfaces();
  const chartTheme = useDashboardChartTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [incluirTransitoQualidade, setIncluirTransitoQualidade] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640;
  });
  const monthBuckets = useMemo(() => getMonthBuckets(), []);
  const supplyMonthBuckets = useMemo(() => getSupplyMonthBuckets(), []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadEstoqueDashboard = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const startDate = monthBuckets[0]?.start;
        const endDate = monthBuckets[monthBuckets.length - 1]?.end;
        const startISO = format(startDate, 'yyyy-MM-dd');
        const endISO = format(endDate, 'yyyy-MM-dd');

        const nivelEstoqueStartDate = monthBuckets[0]?.start || startDate;

        const supplyStartISO = format(supplyMonthBuckets[0]?.start || startDate, 'yyyy-MM-dd');
        const supplyEndISO = format(supplyMonthBuckets[supplyMonthBuckets.length - 1]?.end || endDate, 'yyyy-MM-dd');

        const [produtos, movimentacoesEstoqueRaw, lancamentosFinanceiros, pedidosVenda, pedidosCompra, embarquesCompraRaw, dadosVendaAbcd90d] =
          await Promise.all([
            base44.entities.Produto.filter({}, '-created_date', 5000),
            base44.entities.MovimentacaoEstoque.list('-created_date', 50000),
            base44.entities.LancamentoFinanceiro.filter(
              {
                tipo: 'Despesa',
                is_custo_mercadoria: true,
                data_pagamento: { $gte: supplyStartISO, $lte: supplyEndISO },
              },
              '-data_pagamento',
              20000
            ),
            base44.entities.PedidoVenda.filter({ tipo: 'PDV' }, '-created_date', 20000),
            base44.entities.PedidoCompra.list('-created_date', 300),
            base44.entities.Embarque.list('-created_date', 600),
            fetchDadosVendaAbcd90d().catch(() => null),
          ]);

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
        const pedidosCompraLista = Array.isArray(pedidosCompra) ? pedidosCompra : [];
        const embarquesCompraLista = Array.isArray(embarquesCompraRaw) ? embarquesCompraRaw : [];

        const recebidosPorPedidoProduto = embarquesCompraLista.reduce((acc, embarque) => {
          const pedidoId = embarque?.pedido_compra_id;
          if (!pedidoId) return acc;
          const pedidoKey = String(pedidoId);
          if (!acc[pedidoKey]) acc[pedidoKey] = {};
          const itensEmbarcados = Array.isArray(embarque.itens_embarcados)
            ? embarque.itens_embarcados
            : Array.isArray(embarque.itens)
              ? embarque.itens
              : [];
          itensEmbarcados.forEach((item) => {
            const produtoId = item?.produto_id;
            if (!produtoId) return;
            const produtoKey = String(produtoId);
            acc[pedidoKey][produtoKey] =
              (acc[pedidoKey][produtoKey] || 0) + (Number(item.quantidade_recebida) || 0);
          });
          return acc;
        }, {});

        const qualityAccumulator = {
          A: 0,
          B: 0,
          C: 0,
          D: 0,
          E: 0,
        };
        const qualityTransitRawAccumulator = {
          A: 0,
          B: 0,
          C: 0,
          D: 0,
          E: 0,
        };

        let estoqueFisico = 0;
        produtosComAbcdCatalogo.forEach((produto) => {
          const custoUnitario = Number(produto.preco_custo_calculado || produto.valor_compra || 0);
          const estoqueAtual = Number(produto.estoque_atual || 0);
          const estoqueGerencial = Math.max(0, estoqueAtual);
          const valorEstoque = estoqueGerencial * custoUnitario;
          estoqueFisico += valorEstoque;

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
              custoAtual: Number(produto.preco_custo_calculado || produto.valor_compra || 0),
            },
          ])
        );

        const movimentosCompraVenda = movimentacoesEstoqueLista
          .map((movimento) => ({
            skuId: movimento.produto_id,
            date: getMovimentoDate(movimento),
            deltaQuantidade: getMovimentoDeltaQuantidade(movimento),
          }))
          .filter((movimento) => movimento.skuId && movimento.date && movimento.deltaQuantidade !== 0);

        const nivelEstoqueSeries = monthBuckets.map((bucket) => {
          const monthEnd = bucket.end;
          const deltaAfterMonthBySku = new Map();

          movimentosCompraVenda.forEach((movimento) => {
            if (!isAfter(movimento.date, monthEnd)) return;
            const current = deltaAfterMonthBySku.get(movimento.skuId) || 0;
            deltaAfterMonthBySku.set(movimento.skuId, current + movimento.deltaQuantidade);
          });

          let monthValue = 0;
          skuBase.forEach((skuData, skuId) => {
            const deltaAfterMonth = deltaAfterMonthBySku.get(skuId) || 0;
            const estoqueNoFimDoMes = skuData.estoqueAtual - deltaAfterMonth;
            const estoqueGerencial = Math.max(0, estoqueNoFimDoMes);
            monthValue += estoqueGerencial * skuData.custoAtual;
          });

          return {
            periodo: bucket.label,
            valor: monthValue,
          };
        });

        const custoProdutoMap = new Map(
          produtosLista.map((produto) => [produto.id, Number(produto.preco_custo_calculado || produto.valor_compra || 0)])
        );

        const supplyByMonth = supplyMonthBuckets.map((bucket) => {
          const cmvEfetivo = lancamentosLista.reduce((sum, lancamento) => {
            if (normalizeStatus(lancamento.status) === 'cancelado') return sum;
            const dataPagamento = parseDate(lancamento.data_pagamento);
            if (!dataPagamento || isBefore(dataPagamento, bucket.start) || isAfter(dataPagamento, bucket.end)) {
              return sum;
            }
            return sum + Number(lancamento.valor || 0);
          }, 0);

          const cmvVendido = pedidosVendaLista.reduce((sumPedidos, pedido) => {
            if (!pedidoVendaContaNoCMV(pedido)) return sumPedidos;
            const saleDate = parseDate(pedido.created_date);
            if (!saleDate || isBefore(saleDate, bucket.start) || isAfter(saleDate, bucket.end)) {
              return sumPedidos;
            }
            const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
            const totalPedido = itens.reduce((sumItens, item) => {
              const quantidade = Number(item.quantidade_base || item.quantidade || 0);
              const custoFallback = Number(custoProdutoMap.get(item.produto_id) || 0);
              const custoUnitario = Number(item.custo_unitario_momento || custoFallback || 0);
              return sumItens + quantidade * custoUnitario;
            }, 0);
            return sumPedidos + totalPedido;
          }, 0);

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
        const embarquesPorPedido = embarquesCompraLista.reduce((acc, embarque) => {
          const pedidoId = embarque?.pedido_compra_id;
          if (!pedidoId) return acc;
          if (!acc[pedidoId]) acc[pedidoId] = [];
          acc[pedidoId].push(embarque);
          return acc;
        }, {});

        const cardsDeEmbarque = pedidosCompraLista.flatMap((pedido) => {
          const embarquesDoPedido = (embarquesPorPedido[pedido.id] || []).slice()
            .sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0));
          const embarquesReais = embarquesDoPedido.filter((embarque) => !isNecessidadeRenderizada(embarque));
          const embarquesNecessidade = embarquesDoPedido.filter((embarque) => isNecessidadeRenderizada(embarque));
          const necessidadeVirtual =
            embarquesNecessidade.length === 0 ? buildVirtualNecessidade(pedido, embarquesDoPedido) : null;

          const embarquesRenderizados = embarquesDoPedido.length > 0
            ? [...embarquesReais, ...embarquesNecessidade, ...(necessidadeVirtual ? [necessidadeVirtual] : [])]
            : [
                {
                  id: `original-${pedido.id}`,
                  pedido_compra_id: pedido.id,
                  tipo: 'Original',
                  status: 'Pendente',
                  status_recebimento: 'Pendente',
                  itens: [],
                  itens_embarcados: [],
                  observacoes: '',
                  created_date: pedido.created_date,
                },
              ];

          return embarquesRenderizados.map((embarque) => {
            const ehNecessidade = isNecessidadeRenderizada(embarque);
            return {
              ...pedido,
              _embarque: embarque,
              _is_necessidade: ehNecessidade,
              _display_status: getBorrowedStatus(pedido, embarque),
              _display_valor:
                hasLinkedItems(embarque) || ehNecessidade
                  ? getDisplayValorEmbarque(pedido, embarque)
                  : calcValorTotalPedidoCompra(pedido),
            };
          });
        });

        const filtradosPadrao = cardsDeEmbarque.filter((p) =>
          passaFiltroVisibilidadePedidosCompra(p, {
            somenteNaoConcluidos: FILTRO_COMPRAS_SOMENTE_NAO_CONCLUIDOS_DEFAULT,
            ultimos30Dias: FILTRO_COMPRAS_ULTIMOS_30_DIAS_DEFAULT,
            getDataPedido: (item) => item.data_emissao || (item.created_date ? toLocalDate(item.created_date) : ''),
            isConcluido: (item) => item._display_status === 'Concluído',
          })
        );

        const pedidosPagosPendentes = filtradosPadrao.filter((pedido) => {
          const aprovadoFinanceiro = pedidoLiberadoParaLogistica(pedido) || pedido._display_status === 'Aprovado';
          const ehNecessidade = !!pedido._is_necessidade || pedido._embarque?.tipo === 'Necessidade';
          const aindaNaoRecebido = pedido._display_status !== 'Concluído';
          const aindaNaoEhAguardandoPagamento =
            ehNecessidade ||
            ![
              'Aguardando Aprovação Financeira',
              'Aguardando Liberação Financeira',
              'Aguardando Liberação',
              'Aguardando',
            ].includes(pedido._display_status);
          return aprovadoFinanceiro && aindaNaoRecebido && aindaNaoEhAguardandoPagamento;
        });

        const transitoFinanceiroAprovado = pedidosPagosPendentes.reduce(
          (acc, pedido) => acc + Number(pedido._display_valor || 0),
          0
        );

        const produtoById = new Map(
          produtosComAbcdCatalogo.map((produto) => [String(produto.id), produto])
        );

        pedidosCompraLista
          .filter((pedido) => pedidoCompraAprovadoNaoConcluido(pedido))
          .forEach((pedido) => {
            const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
            const recebidosPedido = recebidosPorPedidoProduto[String(pedido.id)] || {};

            itens.forEach((item) => {
              const produtoId = String(item?.produto_id || '');
              if (!produtoId) return;
              const quantidadeTotal = Number(item.quantidade_base || item.quantidade || 0);
              if (!Number.isFinite(quantidadeTotal) || quantidadeTotal <= 0) return;

              const quantidadeRecebida = Number(recebidosPedido[produtoId] || 0);
              const quantidadePendente = Math.max(0, quantidadeTotal - quantidadeRecebida);
              if (!quantidadePendente) return;

              const totalItem = Number(item.total || 0);
              const custoViaTotal = quantidadeTotal > 0 ? totalItem / quantidadeTotal : 0;
              const custoUnitario = Number(item.custo_final_unitario || item.custo_unitario || custoViaTotal || 0);
              const valorPendenteItem = quantidadePendente * Math.max(0, custoUnitario);
              if (valorPendenteItem <= 0) return;

              const produto = produtoById.get(produtoId) || item;
              const curva = resolveProdutoAbcdClasse(produto);
              if (!QUALITY_ORDER.includes(curva)) return;
              qualityTransitRawAccumulator[curva] += valorPendenteItem;
            });
          });

        const totalLocalizacao = estoqueFisico + transitoFinanceiroAprovado;
        const qualityTotal = QUALITY_ORDER.reduce((sum, key) => sum + qualityAccumulator[key], 0);
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
        const qualityTransitRawTotal = QUALITY_ORDER.reduce(
          (sum, key) => sum + Number(qualityTransitRawAccumulator[key] || 0),
          0
        );
        const qualityTransitScale =
          qualityTransitRawTotal > 0 ? transitoFinanceiroAprovado / qualityTransitRawTotal : 0;
        const qualityDistributionGeral = QUALITY_ORDER.map((key) => {
          const valorFisico = qualityAccumulator[key];
          const valorTransito = Number(qualityTransitRawAccumulator[key] || 0) * qualityTransitScale;
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
          0
        );
        const qualityDistributionGeralComPct = qualityDistributionGeral.map((bucket) => {
          const share = qualityTotalGeral > 0 ? bucket.valor / qualityTotalGeral : 0;
          return {
            ...bucket,
            share,
            percentText: PERCENT.format(share),
          };
        });

        if (mounted) {
          setMetrics({
            nivelEstoqueSeries,
            supplyByMonth,
            qualityDistribution,
            qualityDistributionGeral: qualityDistributionGeralComPct,
            estoqueFisico,
            transitoFinanceiroAprovado,
            totalLocalizacao,
          });
        }
      } catch (loadError) {
        console.error('Erro ao carregar indicadores de estoque:', loadError);
        if (mounted) setError(loadError);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadEstoqueDashboard();
    return () => {
      mounted = false;
    };
  }, [monthBuckets, supplyMonthBuckets]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((card) => (
          <Card key={card} className="border-0 shadow-sm bg-card">
            <CardHeader>
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <Card className="border border-red-200 dark:border-red-900/40 bg-card shadow-sm">
        <CardContent className="p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              Não foi possível carregar os indicadores de estoque.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Verifique conexão com dados e tente novamente.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const qualityBase = incluirTransitoQualidade
    ? (metrics.qualityDistributionGeral || metrics.qualityDistribution)
    : metrics.qualityDistribution;
  const totalQualidade = qualityBase.reduce((sum, bucket) => sum + Number(bucket.valor || 0), 0);
  const qualityHalfDonutData = qualityBase.map((bucket) => ({
    name: bucket.label,
    value: Number(bucket.valor || 0),
    color: bucket.color,
    percentText: bucket.percentText,
  }));
  const locationHalfDonutData = [
    { name: 'Físico', value: Number(metrics.estoqueFisico || 0), color: LOCATION_COLORS.fisico },
    { name: 'Em trânsito', value: Number(metrics.transitoFinanceiroAprovado || 0), color: LOCATION_COLORS.transito },
  ];

  return (
    <div className={p38Dashboard.gridRoot}>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-3">
        <Card className={p38Dashboard.card}>
          <CardHeader className="pb-1">
            <CardTitle className={p38Dashboard.sectionTitle}>
              <Package className={`w-4 h-4 ${p38Dashboard.iconAccent}`} />
              Nível de Estoque (Base Hoje)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <div className={`h-[220px] sm:h-[210px] rounded-xl px-1 py-1.5 ${p38Dashboard.inner}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={metrics.nivelEstoqueSeries}
                  margin={DASHBOARD_CHART_MARGIN.categorical}
                  barCategoryGap="20%"
                >
                  <defs>
                    <linearGradient id="stockBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#BEF264" />
                      <stop offset="100%" stopColor="#65A30D" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...buildCartesianGridProps(chartTheme)} />
                  <XAxis
                    {...buildXAxisProps(chartTheme, {
                      dataKey: 'periodo',
                      interval: isMobile ? 1 : 0,
                    })}
                  />
                  <YAxis {...buildYAxisProps(chartTheme)} />
                  <Tooltip
                    formatter={(value) => BRL.format(Number(value || 0))}
                    cursor={{ fill: chartTheme.cursor }}
                    contentStyle={chartTheme.tooltip.contentStyle}
                    labelStyle={chartTheme.tooltip.labelStyle}
                    itemStyle={chartTheme.tooltip.itemStyle}
                  />
                  <Bar dataKey="valor" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {metrics.nivelEstoqueSeries.map((entry, idx) => (
                      <Cell
                        key={`${entry.periodo}-${idx}`}
                        fill={idx === metrics.nivelEstoqueSeries.length - 1 ? 'url(#stockBarGradient)' : STOCK_BAR_COLORS[idx % STOCK_BAR_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className={`mt-2 flex items-center justify-between text-[10px] ${p38Dashboard.legend}`}>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-[2px] w-5 rounded-full bg-primary" />
                tendência mensal
              </span>
              <span className={`font-semibold ${p38Dashboard.title}`}>{formatShort(metrics.nivelEstoqueSeries.at(-1)?.valor || 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className={p38Dashboard.card}>
          <CardHeader className="pb-1">
            <CardTitle className={p38Dashboard.sectionTitle}>
              <Gauge className={`w-4 h-4 ${p38Dashboard.iconAccent}`} />
              Razão de Abastecimento (3 meses)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {metrics.supplyByMonth.map((monthSupply) => {
                const supplyColor = getSupplyColorByStatus(monthSupply.status);
                const overflowColor = getSupplyOverflowColorByStatus(monthSupply.status);
                const ratioPercent = Math.max(monthSupply.ratioPercent, 0);
                const primaryFill = Math.min(ratioPercent, 100);
                const overflowFill = Math.min(Math.max(ratioPercent - 100, 0), 100);
                const primaryRingData = [
                  { name: 'Razão', value: primaryFill, color: supplyColor },
                  {
                    name: 'Restante',
                    value: Math.max(100 - primaryFill, 0),
                    color: SUPPLY_RING_COLORS.muted,
                  },
                ];
                const hasOverflow = overflowFill > 0;
                const overflowRingData = [
                  { name: 'Excedente', value: overflowFill, color: overflowColor },
                  { name: 'ExcedenteRestante', value: Math.max(100 - overflowFill, 0), color: 'transparent' },
                ];

                return (
                  <div key={monthSupply.key} className={`rounded-xl p-2 min-h-44 sm:min-h-0 ${p38Dashboard.inner}`}>
                    <p className="text-[10px] font-semibold text-muted-foreground tracking-wide mb-1">{monthSupply.label}</p>
                    <div className="h-[108px] sm:h-[120px] relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={primaryRingData}
                            innerRadius={28}
                            outerRadius={42}
                            dataKey="value"
                            startAngle={90}
                            endAngle={-270}
                            strokeWidth={0}
                            cornerRadius={2}
                          >
                            {primaryRingData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          {hasOverflow ? (
                            <Pie
                              data={overflowRingData}
                              innerRadius={22}
                              outerRadius={26}
                              dataKey="value"
                              startAngle={90}
                              endAngle={-270}
                              strokeWidth={0}
                              cornerRadius={2}
                            >
                              {overflowRingData.map((entry) => (
                                <Cell key={entry.name} fill={entry.color} />
                              ))}
                            </Pie>
                          ) : null}
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className={p38Dashboard.metricValue}>{monthSupply.ratioPercent.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] text-muted-foreground flex items-center justify-between gap-1.5">
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block h-[2px] w-3 rounded-full bg-[#7a8498]" />
                          vendido
                        </span>
                        <span className={`font-semibold ${p38Dashboard.title}`}>{formatShort(monthSupply.cmvVendido)}</span>
                      </p>
                      <p className="text-[9px] text-muted-foreground flex items-center justify-between gap-1.5">
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block h-[2px] w-3 rounded-full bg-primary" />
                          pago
                        </span>
                        <span className={`font-semibold ${p38Dashboard.title}`}>{formatShort(monthSupply.cmvEfetivo)}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-3">
        <Card className={p38Dashboard.card}>
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className={p38Dashboard.sectionTitle}>
                <Layers className={`w-4 h-4 ${p38Dashboard.iconAccent}`} />
                Qualidade do Estoque
              </CardTitle>
              <label className={`flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide ${p38Dashboard.titleMuted}`}>
                Geral
                <Switch
                  checked={incluirTransitoQualidade}
                  onCheckedChange={setIncluirTransitoQualidade}
                  aria-label="Incluir estoque em trânsito na qualidade do estoque"
                  className="scale-[0.85]"
                />
              </label>
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            <div className={`h-[170px] md:h-[180px] relative rounded-xl px-2 py-1 ${p38Dashboard.inner}`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[{ name: 'track', value: 100 }]}
                    dataKey="value"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={56}
                    outerRadius={84}
                    strokeWidth={0}
                    cornerRadius={3}
                  >
                    <Cell fill="rgba(148,163,184,0.15)" />
                  </Pie>
                  <Pie
                    data={qualityHalfDonutData}
                    dataKey="value"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={56}
                    outerRadius={84}
                    strokeWidth={0}
                  >
                    {qualityHalfDonutData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke={chartTheme.pieStroke} strokeWidth={2} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pt-5">
                <span className="text-[11px] tracking-wide uppercase text-muted-foreground">Total</span>
                <span className={`${p38Dashboard.metricValue} font-semibold`}>{BRL.format(totalQualidade)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              {qualityHalfDonutData.map((entry) => (
                <div key={entry.name} className={`flex items-center justify-between ${p38Dashboard.legendRow}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-[2px] w-4 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-[10px] text-muted-foreground">{entry.name}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-foreground">{entry.percentText}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className={p38Dashboard.card}>
          <CardHeader className="pb-1">
            <CardTitle className={p38Dashboard.sectionTitle}>
              <Truck className={`w-4 h-4 ${p38Dashboard.iconAccent}`} />
              Localização do Estoque
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <div className={`h-[170px] md:h-[180px] relative rounded-xl px-2 py-1 ${p38Dashboard.inner}`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[{ name: 'track', value: 100 }]}
                    dataKey="value"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={56}
                    outerRadius={84}
                    strokeWidth={0}
                    cornerRadius={3}
                  >
                    <Cell fill="rgba(148,163,184,0.15)" />
                  </Pie>
                  <Pie
                    data={locationHalfDonutData}
                    dataKey="value"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={56}
                    outerRadius={84}
                    strokeWidth={0}
                  >
                    {locationHalfDonutData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke={chartTheme.pieStroke} strokeWidth={3} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pt-5">
                <span className="text-[11px] tracking-wide uppercase text-muted-foreground">Total</span>
                <span className={`${p38Dashboard.metricValue} font-semibold`}>
                  {BRL.format(metrics.totalLocalizacao)}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              {locationHalfDonutData.map((entry) => (
                <div key={entry.name} className={`flex items-center justify-between ${p38Dashboard.legendRow}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-[2px] w-4 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-[10px] text-muted-foreground">{entry.name}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-foreground">{BRL.format(entry.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className={p38Dashboard.placeholder}>
          <CardHeader className="pb-1">
            <CardTitle className={`text-sm font-medium uppercase tracking-wide ${p38Dashboard.titleMuted}`}>Em breve</CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            <div className={`h-[180px] rounded-xl p-3 ${p38Dashboard.placeholderInner}`}>
              <div className={`h-2 w-24 rounded mb-3 ${p38Dashboard.skeletonHeader}`} />
              <div className="grid grid-cols-5 gap-1 items-end h-16 mb-3">
                {[30, 44, 26, 52, 36].map((h, idx) => (
                  <div key={`ph-top-${idx}`} className={`rounded-sm ${p38Dashboard.skeletonBar}`} style={{ height: `${h}%` }} />
                ))}
              </div>
              <div className="space-y-2">
                <div className={`h-1.5 rounded w-full ${p38Dashboard.skeletonLine}`} />
                <div className={`h-1.5 rounded w-4/5 ${p38Dashboard.skeletonLine}`} />
                <div className={`h-1.5 rounded w-3/5 ${p38Dashboard.skeletonLine}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-3">
        {[1, 2, 3].map((slot) => (
          <Card
            key={`empty-slot-${slot}`}
            className={p38Dashboard.placeholder}
          >
            <CardHeader className="pb-1">
              <CardTitle className={`text-sm font-medium uppercase tracking-wide ${p38Dashboard.titleMuted}`}>Em breve</CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              <div className={`h-[90px] rounded-xl p-2.5 ${p38Dashboard.placeholderInner}`}>
                <div className={`h-1.5 w-16 rounded mb-2 ${p38Dashboard.skeletonHeader}`} />
                <div className="grid grid-cols-4 gap-1 items-end h-8 mb-2">
                  {[40, 68, 52, 74].map((h, idx) => (
                    <div key={`ph-bottom-${slot}-${idx}`} className={`rounded-sm ${p38Dashboard.skeletonBar}`} style={{ height: `${h}%` }} />
                  ))}
                </div>
                <div className={`h-1.5 rounded w-4/5 ${p38Dashboard.skeletonLine}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
