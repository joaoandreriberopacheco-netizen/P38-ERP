/**
 * Dados para KPI Margem no job noturno (Supabase service role — sem Base44 browser).
 */
import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { competenciaParaIntervalo } from '@/lib/relatorioMargemCalculos';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://zhonvxkkqabfdyehyxpu.supabase.co';

function getServiceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
}

function normalizeItem(it) {
  return {
    ...it,
    quantidade: it.quantidade_comercial ?? it.quantidade,
    fator_conversao: it.fator_aplicado ?? it.fator_conversao ?? 1,
    unidade_medida: it.unidade_sigla ?? it.unidade_medida,
  };
}

async function fetchAllPedidos(sb, createdFrom, createdTo) {
  const rows = [];
  let offset = 0;
  const page = 1000;
  while (true) {
    const { data, error } = await sb
      .from('pedido_venda')
      .select('id,numero,status,tipo,dados,created_at,total,valor_desconto')
      .gte('created_at', createdFrom)
      .lt('created_at', createdTo)
      .range(offset, offset + page - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < page) break;
    offset += page;
  }
  return rows;
}

async function fetchItemsForPedidos(sb, ids) {
  const allItems = [];
  for (let i = 0; i < ids.length; i += 40) {
    const { data, error } = await sb
      .from('pedido_venda_item')
      .select('*')
      .in('pedido_venda_id', ids.slice(i, i + 40));
    if (error) throw error;
    allItems.push(...(data || []));
  }
  return allItems;
}

export function createMargemKpiSupabaseClient() {
  const key = getServiceKey();
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY em falta para job KPI margem.');
  return createClient(SUPABASE_URL, key);
}

/** @returns {Promise<string>} YYYY-MM-DD ontem Tabatinga via RPC */
export async function fetchTabatingaOntem(sb) {
  const { data, error } = await sb.rpc('p38_tabatinga_ontem');
  if (!error && data) return String(data).slice(0, 10);
  const now = new Date();
  const tab = new Date(now.getTime() - 5 * 3600000);
  tab.setUTCDate(tab.getUTCDate() - 1);
  return `${tab.getUTCFullYear()}-${String(tab.getUTCMonth() + 1).padStart(2, '0')}-${String(tab.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Carrega pedidos + produtos + trocas para uma competência (YYYY-MM).
 */
export async function fetchMargemKpiDataset(competencia, sb = createMargemKpiSupabaseClient()) {
  const intervalo = competenciaParaIntervalo(competencia);
  if (!intervalo) {
    return {
      sales: [],
      products: [],
      devolucoesTroca: [],
      pedidosOrigemTroca: {},
    };
  }

  const fetchStart = new Date(intervalo.from);
  fetchStart.setDate(fetchStart.getDate() - 20);
  const fetchEnd = new Date(intervalo.to);
  fetchEnd.setDate(fetchEnd.getDate() + 20);
  const createdFrom = format(fetchStart, 'yyyy-MM-dd');
  const createdTo = format(fetchEnd, 'yyyy-MM-dd');

  const pedidosRaw = await fetchAllPedidos(sb, createdFrom, createdTo);
  const ids = pedidosRaw.map((p) => p.id);
  const allItems = await fetchItemsForPedidos(sb, ids);

  const byPed = {};
  for (const it of allItems) {
    if (!byPed[it.pedido_venda_id]) byPed[it.pedido_venda_id] = [];
    byPed[it.pedido_venda_id].push(normalizeItem(it));
  }

  const { data: produtos, error: prodErr } = await sb.from('produto').select('*');
  if (prodErr) throw prodErr;

  const { data: devolucoes, error: devErr } = await sb.from('devolucao_troca').select('*');
  if (devErr) throw devErr;

  const origemIds = [
    ...new Set(
      (devolucoes || [])
        .filter((d) => String(d.status || '').toLowerCase() !== 'cancelada')
        .map((d) => d.pedido_origem_id)
        .filter(Boolean),
    ),
  ];

  const pedidosOrigemTroca = {};
  for (const id of origemIds) {
    const { data: p } = await sb.from('pedido_venda').select('*').eq('id', id).maybeSingle();
    if (!p) continue;
    const its = await fetchItemsForPedidos(sb, [id]);
    pedidosOrigemTroca[id] = {
      ...p,
      status: p.status || p.dados?.status,
      valor_total: p.dados?.valor_total,
      itens: its.map(normalizeItem),
    };
  }

  const sales = pedidosRaw.map((p) => ({
    ...p,
    status: p.status || p.dados?.status,
    tipo: p.tipo || p.dados?.tipo,
    valor_total: p.dados?.valor_total ?? p.total,
    valor_desconto: p.dados?.valor_desconto ?? p.valor_desconto,
    created_date: p.created_at,
    itens: byPed[p.id] || [],
  }));

  return {
    sales,
    products: produtos || [],
    devolucoesTroca: devolucoes || [],
    pedidosOrigemTroca,
  };
}
