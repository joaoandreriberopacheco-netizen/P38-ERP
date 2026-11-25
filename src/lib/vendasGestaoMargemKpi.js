/**
 * KPIs de margem na Gestão de Vendas — mesma base do Relatório de Margem / dashboard.
 */
import { calcularMargemKpiIntervalo } from '@/lib/dashboardKpiMargemCompute';

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * Margem sobre o conjunto de pedidos já filtrado na tela (sem re-filtrar por data de venda).
 */
export function calcularMargemKpiVendasGestaoFiltradas({
  pedidos = [],
  produtos = [],
  devolucoesTroca = [],
  pedidosOrigemTroca = {},
}) {
  if (!Array.isArray(pedidos) || !pedidos.length) return null;
  if (!Array.isArray(produtos) || !produtos.length) return null;

  const pedidosComItens = pedidos.filter(
    (p) => Array.isArray(p.itens) && p.itens.length > 0,
  );
  if (!pedidosComItens.length) return null;

  return calcularMargemKpiIntervalo({
    pedidos: pedidosComItens,
    produtos,
    devolucoesTroca,
    pedidosOrigemTroca,
    intervalo: { from: null, to: null },
    pedidoCount: pedidosComItens.length,
  });
}

/** Margem de contribuição (mC) = lucro / receita líquida — espelho de `margem_percentual` no Relatório de Margem. */
export function margemContribuicaoPercent(profit, salesNet) {
  const net = Number(salesNet) || 0;
  if (net <= 0) return 0;
  return roundMoney((Number(profit) / net) * 100);
}

export function formatMargemPctGestao(val) {
  return `${(Number(val) || 0).toFixed(1).replace('.', ',')}%`;
}
