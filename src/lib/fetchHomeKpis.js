import { base44 } from '@/api/base44Client';
import { inicioDiaSistemaISO, fimDiaSistemaISO, dataHoje } from '@/components/utils/dateUtils';
import { resolveValorPedidoVenda, roundToTwoDecimals } from '@/lib/financialUtils';
import { filterPedidosVendaElegiblesKpi } from '@/lib/pedidoVendaEligibility';
import { readHomeKpi } from '@/lib/p38AnotacaoApi';

const PEDIDO_VENDA = () => base44.entities.PedidoVenda;

function somarVendasHoje(pedidos = []) {
  const vendasHoje = filterPedidosVendaElegiblesKpi(pedidos);
  return {
    vendasHoje: vendasHoje.length,
    valorVendasHoje: roundToTwoDecimals(
      vendasHoje.reduce((sum, pedido) => sum + resolveValorPedidoVenda(pedido), 0)
    ),
  };
}

/** Vendas do dia civil (Tabatinga) — Supabase SQL (Fase 6) com fallback Base44. */
export async function fetchHomeVendasHoje(dateKey) {
  const key = dateKey || dataHoje();

  const fromSupabase = await readHomeKpi(key);
  if (fromSupabase) return fromSupabase;

  const pedidosHoje = await PEDIDO_VENDA().filter({
    created_date: {
      $gte: inicioDiaSistemaISO(key),
      $lte: fimDiaSistemaISO(key),
    },
  });
  return somarVendasHoje(pedidosHoje);
}

/** Contagem de vendas aguardando pagamento no caixa (aviso opcional na Home). */
export async function fetchPedidosAguardandoCaixaCount() {
  const pedidos = await PEDIDO_VENDA().filter({ status: 'Aguardando Caixa' });
  return Array.isArray(pedidos) ? pedidos.length : 0;
}

/** @deprecated Use fetchHomeVendasHoje — mantido para invalidação legada. */
export async function fetchHomeKpis(dateKey) {
  const [vendas, pedidosPendentes] = await Promise.all([
    fetchHomeVendasHoje(dateKey),
    fetchPedidosAguardandoCaixaCount(),
  ]);
  return { ...vendas, pedidosPendentes };
}
