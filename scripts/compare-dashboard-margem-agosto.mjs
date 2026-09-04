#!/usr/bin/env node
/** Compara lucro Dashboard (snapshot + recálculo) vs Relatório de Margem. */
import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import {
  calcularLinhasMargemVendas,
  calcularTotaisMargem,
  pedidoElegivelMargem,
} from '../src/lib/relatorioMargemCalculos.js';
import { isPedidoVendaElegivelKpi } from '../src/lib/pedidoVendaEligibility.js';
import { resolveValorPedidoVenda } from '../src/lib/financialUtils.js';
import { resolveCustoTotalUnitBaseProduto } from '../src/lib/productUnits.js';

const MONTH = process.argv[2] || '2026-08';
const sb = createClient(
  'https://zhonvxkkqabfdyehyxpu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const [y, m] = MONTH.split('-').map(Number);
const from = new Date(y, m - 1, 1);
const to = new Date(y, m, 0, 23, 59, 59, 999);

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getSaleDate(p) {
  const d = p.dados || {};
  return (
    parseDate(d.data_venda) ||
    parseDate(d.data_emissao) ||
    parseDate(d.data_fechamento) ||
    parseDate(p.created_at)
  );
}

function toRioKey(iso) {
  const d = new Date(iso);
  const l = new Date(d.getTime() - 5 * 3600000);
  return `${l.getUTCFullYear()}-${String(l.getUTCMonth() + 1).padStart(2, '0')}-${String(l.getUTCDate()).padStart(2, '0')}`;
}

function normalizeItem(it) {
  return {
    ...it,
    quantidade: it.quantidade_comercial ?? it.quantidade,
    fator_conversao: it.fator_aplicado ?? it.fator_conversao ?? 1,
    unidade_medida: it.unidade_sigla ?? it.unidade_medida,
  };
}

async function fetchAllPedidos() {
  const rows = [];
  let offset = 0;
  const page = 1000;
  while (true) {
    const { data } = await sb
      .from('pedido_venda')
      .select('id,numero,status,tipo,dados,created_at,total')
      .gte('created_at', '2026-06-01')
      .lt('created_at', '2026-09-15')
      .range(offset, offset + page - 1);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < page) break;
    offset += page;
  }
  return rows;
}

const pedidos = await fetchAllPedidos();
const ids = pedidos.map((p) => p.id);
const allItems = [];
for (let i = 0; i < ids.length; i += 40) {
  const { data } = await sb
    .from('pedido_venda_item')
    .select('*')
    .in('pedido_venda_id', ids.slice(i, i + 40));
  allItems.push(...(data || []));
}

const byPed = {};
for (const it of allItems) {
  if (!byPed[it.pedido_venda_id]) byPed[it.pedido_venda_id] = [];
  byPed[it.pedido_venda_id].push(normalizeItem(it));
}

const { data: produtos } = await sb.from('produto').select('id,preco_custo_calculado');
const costMap = Object.fromEntries(
  (produtos || []).map((p) => [p.id, Number(resolveCustoTotalUnitBaseProduto(p)) || 0]),
);
const { data: devolucoes } = await sb.from('devolucao_troca').select('*');

const origemIds = [
  ...new Set(
    (devolucoes || [])
      .filter((d) => String(d.status || '').toLowerCase() !== 'cancelada')
      .map((d) => d.pedido_origem_id)
      .filter(Boolean),
  ),
];
const pedidosOrigem = {};
for (const id of origemIds) {
  const { data: p } = await sb.from('pedido_venda').select('*').eq('id', id).maybeSingle();
  const { data: its } = await sb.from('pedido_venda_item').select('*').eq('pedido_venda_id', id);
  pedidosOrigem[id] = {
    ...p,
    status: p?.status || p?.dados?.status,
    valor_total: p?.dados?.valor_total,
    itens: (its || []).map(normalizeItem),
  };
}

const sales = pedidos.map((p) => ({
  ...p,
  status: p.status || p.dados?.status,
  tipo: p.tipo || p.dados?.tipo,
  valor_total: p.dados?.valor_total,
  valor_desconto: p.dados?.valor_desconto,
  created_date: p.created_at,
  data_venda: p.dados?.data_venda,
  data_emissao: p.dados?.data_emissao,
  data_fechamento: p.dados?.data_fechamento,
  itens: byPed[p.id] || [],
}));

let dashNet = 0;
let dashCost = 0;
let dashCount = 0;
let onlyDash = 0;
let onlyMargem = 0;
let both = 0;
const margemIds = new Set();

for (const sale of sales) {
  const saleDate = getSaleDate(sale);
  if (!saleDate || format(saleDate, 'yyyy-MM') !== MONTH) continue;

  const dashOk = isPedidoVendaElegivelKpi(sale);
  const margemOk =
    pedidoElegivelMargem(sale) &&
    (() => {
      const key = toRioKey(sale.created_at);
      return key >= `${MONTH}-01` && key <= `${MONTH}-31`;
    })();

  if (dashOk) {
    dashCount += 1;
    const net = resolveValorPedidoVenda(sale);
    const cost = (sale.itens || []).reduce((sum, it) => {
      const qb =
        Number(it.quantidade_base ?? Number(it.quantidade || 0) * Number(it.fator_conversao || 1)) ||
        0;
      const cu = Number(
        it.custo_unitario_momento ?? it.custo_unitario ?? costMap[it.produto_id] ?? 0,
      );
      return sum + qb * cu;
    }, 0);
    dashNet += net;
    dashCost += cost;
  }
  if (margemOk) margemIds.add(sale.id);
  if (dashOk && !margemOk) onlyDash += 1;
  if (!dashOk && margemOk) onlyMargem += 1;
  if (dashOk && margemOk) both += 1;
}

const margemSales = sales.filter((s) => margemIds.has(s.id));
const linhas = calcularLinhasMargemVendas(
  margemSales,
  produtos,
  { from, to },
  devolucoes,
  pedidosOrigem,
);
const totMargem = calcularTotaisMargem(linhas);

const { data: snap } = await sb
  .from('dashboard_kpi_mensal')
  .select('payload')
  .eq('month_key', MONTH)
  .maybeSingle();
const snapT = snap?.payload?.monthlyTotals || {};

const dashLucro = Math.round((dashNet - dashCost) * 100) / 100;

console.log(
  JSON.stringify(
    {
      mes: MONTH,
      dashboard_snapshot_sql: {
        pedidos: null,
        venda_liquida: snapT.salesNet,
        custo: snapT.cost,
        lucro_bruto: snapT.profit,
      },
      dashboard_recalc_cliente: {
        pedidos: dashCount,
        venda_liquida: Math.round(dashNet * 100) / 100,
        custo: Math.round(dashCost * 100) / 100,
        lucro_bruto: dashLucro,
      },
      margem_relatorio: {
        pedidos: margemSales.length,
        venda_liquida: Math.round(totMargem.receita_liquida * 100) / 100,
        custo: Math.round(totMargem.custo_total * 100) / 100,
        lucro_bruto: Math.round(totMargem.lucro_bruto * 100) / 100,
      },
      diferenca_lucro_snapshot_vs_margem:
        Math.round((Number(snapT.profit || 0) - totMargem.lucro_bruto) * 100) / 100,
      diferenca_lucro_recalc_vs_margem: Math.round((dashLucro - totMargem.lucro_bruto) * 100) / 100,
      pedidos_so_dashboard: onlyDash,
      pedidos_so_margem: onlyMargem,
      pedidos_ambos: both,
    },
    null,
    2,
  ),
);
