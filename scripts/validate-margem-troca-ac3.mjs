#!/usr/bin/env node
/**
 * Valida lucro AC-3 15kg agosto com lógica de troca no margem.
 * Uso: node --import ./scripts/vite-node-alias.mjs scripts/validate-margem-troca-ac3.mjs
 * Ou via npx vite-node scripts/validate-margem-troca-ac3.mjs (com alias do vite.config)
 */
import { createClient } from '@supabase/supabase-js';
import {
  calcularLinhasMargemVendas,
  pedidoElegivelMargem,
  vendaNoIntervaloConsulta,
} from '../src/lib/relatorioMargemCalculos.js';

const AC3_15 = '69bd5b5c1761fd1c2ce2fcc8';
const SWAP = 'PV-03116';
const from = new Date(2026, 7, 1);
const to = new Date(2026, 7, 31, 23, 59, 59, 999);

const sb = createClient(
  'https://zhonvxkkqabfdyehyxpu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function normalizePedido(p, itens) {
  return {
    ...p,
    status: p.status || p.dados?.status,
    valor_total: p.dados?.valor_total,
    created_date: p.created_at,
    itens: (itens || []).map((it) => ({
      ...it,
      quantidade: it.quantidade_comercial ?? it.quantidade,
      fator_conversao: it.fator_aplicado ?? it.fator_conversao ?? 1,
      unidade_medida: it.unidade_sigla ?? it.unidade_medida,
    })),
  };
}

const { data: produtos } = await sb.from('produto').select('*').in('id', [AC3_15, '69bd5b5b67c53b4e06fa6f8f']);
const { data: devolucoes } = await sb.from('devolucao_troca').select('*');
const { data: pedidos } = await sb
  .from('pedido_venda')
  .select('id,numero,status,dados,created_at')
  .gte('created_at', '2026-07-01')
  .lt('created_at', '2026-09-01');

const eligible = (pedidos || []).filter(
  (p) =>
    pedidoElegivelMargem({ ...p, status: p.status || p.dados?.status, created_date: p.created_at }) &&
    vendaNoIntervaloConsulta({ created_date: p.created_at }, from, to),
);
const ids = eligible.map((p) => p.id);
const allItems = [];
for (let i = 0; i < ids.length; i += 40) {
  const { data } = await sb.from('pedido_venda_item').select('*').in('pedido_venda_id', ids.slice(i, i + 40));
  allItems.push(...(data || []));
}
const byPed = {};
for (const it of allItems) {
  if (!byPed[it.pedido_venda_id]) byPed[it.pedido_venda_id] = [];
  byPed[it.pedido_venda_id].push(it);
}
const sales = eligible.map((p) => normalizePedido(p, byPed[p.id]));

const dt = (devolucoes || []).find((d) => d.numero === 'DT-00002');
const { data: origem } = await sb.from('pedido_venda').select('*').eq('id', dt.pedido_origem_id).maybeSingle();
const { data: origemItems } = await sb
  .from('pedido_venda_item')
  .select('*')
  .eq('pedido_venda_id', dt.pedido_origem_id);
const pedidosOrigem = {
  [dt.pedido_origem_id]: normalizePedido(origem, origemItems),
};

const linhas = calcularLinhasMargemVendas(sales, produtos, { from, to }, devolucoes, pedidosOrigem);
const ac3 = linhas.find((l) => l.produto_id === AC3_15);

const swapSale = sales.find((s) => s.numero === SWAP);
const trocaMargem = swapSale
  ? calcularLinhasMargemVendas([swapSale], produtos, { from, to }, devolucoes, pedidosOrigem)
  : [];
const trocaRow = trocaMargem.find((l) => l.produto_id === AC3_15);

const semTroca = calcularLinhasMargemVendas(
  sales.filter((s) => s.numero !== SWAP),
  produtos,
  { from, to },
  devolucoes,
  pedidosOrigem,
);
const semTrocaRow = semTroca.find((l) => l.produto_id === AC3_15);

console.log(
  JSON.stringify(
    {
      ac3_15kg_agosto_total: ac3?.lucro_total,
      vendidas_sem_troca: semTrocaRow?.lucro_total,
      troca_80: trocaRow?.lucro_total,
      troca_receita: trocaRow?.receita_liquida,
      troca_deducao_ac1: trocaRow?.lucro_troca_deducao,
      esperado_total: 2461.79,
      esperado_troca: 366.89,
    },
    null,
    2,
  ),
);
