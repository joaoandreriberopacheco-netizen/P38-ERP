/**
 * Dados para KPI Margem no job noturno (Supabase service role — sem Base44 browser).
 */
import { createClient } from '@supabase/supabase-js';
import {
  decorateMargemEntityRow,
  decorateMargemPedidoVendaRow,
  normalizeMargemPedidoVendaItem,
} from '@/lib/margemKpiNormalize';
import { competenciaParaIntervalo } from '@/lib/relatorioMargemCalculos';
import { normalizeSupabaseProjectUrl } from '@/lib/supabaseBrowserClient';

const SUPABASE_URL = normalizeSupabaseProjectUrl(
  process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://zhonvxkkqabfdyehyxpu.supabase.co',
);

function getServiceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
}

function competenciaBounds(competencia) {
  const [y, m] = String(competencia || '').slice(0, 7).split('-').map(Number);
  if (!y || !m) return { fromKey: null, toKey: null };
  const lastDay = new Date(y, m, 0).getDate();
  const pad = (n) => String(n).padStart(2, '0');
  return {
    fromKey: `${y}-${pad(m)}-01`,
    toKey: `${y}-${pad(m)}-${pad(lastDay)}`,
  };
}

async function fetchPedidoIdsBySaleDate(sb, fromKey, toKey) {
  const { data, error } = await sb.rpc('p38_margem_kpi_pedido_ids', {
    p_from: fromKey,
    p_to: toKey,
  });
  if (error) throw error;
  return [...new Set((data || []).map((id) => String(id)))];
}

async function fetchPedidosByIds(sb, ids) {
  const rows = [];
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40);
    const { data, error } = await sb.from('pedido_venda').select('*').in('id', chunk);
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

/** Fallback legado: created_at (±45d) quando RPC 088 ainda não aplicada. */
async function fetchAllPedidosCreatedWindow(sb, createdFrom, createdTo) {
  const rows = [];
  let offset = 0;
  const page = 1000;
  while (true) {
    const { data, error } = await sb
      .from('pedido_venda')
      .select('*')
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
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY ou VITE_SUPABASE_ANON_KEY em falta para job KPI margem.',
    );
  }
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

async function fetchPedidosMargemCompetencia(sb, competencia, intervalo) {
  const { fromKey, toKey } = competenciaBounds(competencia);
  if (!fromKey || !toKey) return [];

  try {
    const ids = await fetchPedidoIdsBySaleDate(sb, fromKey, toKey);
    if (ids.length) return fetchPedidosByIds(sb, ids);
  } catch (err) {
    const msg = String(err?.message || err);
    if (!msg.includes('p38_margem_kpi_pedido_ids') && !msg.includes('does not exist')) {
      throw err;
    }
    console.warn('[fetchMargemKpiDataset] RPC p38_margem_kpi_pedido_ids indisponível — fallback created_at');
  }

  const fetchStart = new Date(intervalo.from);
  fetchStart.setDate(fetchStart.getDate() - 45);
  const fetchEnd = new Date(intervalo.to);
  fetchEnd.setDate(fetchEnd.getDate() + 45);
  const pad = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  return fetchAllPedidosCreatedWindow(sb, pad(fetchStart), pad(fetchEnd));
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

  const pedidosRaw = await fetchPedidosMargemCompetencia(sb, competencia, intervalo);
  const ids = pedidosRaw.map((p) => p.id);
  const allItems = await fetchItemsForPedidos(sb, ids);

  const byPed = {};
  for (const it of allItems) {
    if (!byPed[it.pedido_venda_id]) byPed[it.pedido_venda_id] = [];
    byPed[it.pedido_venda_id].push(normalizeMargemPedidoVendaItem(it));
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
    const flat = decorateMargemPedidoVendaRow(p);
    pedidosOrigemTroca[id] = {
      ...flat,
      dados: p.dados && typeof p.dados === 'object' ? p.dados : {},
      itens: its.map(normalizeMargemPedidoVendaItem),
    };
  }

  const sales = pedidosRaw.map((p) => {
    const flat = decorateMargemPedidoVendaRow(p);
    return {
      ...flat,
      dados: p.dados && typeof p.dados === 'object' ? p.dados : {},
      itens: byPed[p.id] || [],
    };
  });

  return {
    sales,
    products: (produtos || []).map(decorateMargemEntityRow),
    devolucoesTroca: devolucoes || [],
    pedidosOrigemTroca,
  };
}
