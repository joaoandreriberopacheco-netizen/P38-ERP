import { base44 } from '@/api/base44Client';
import {
  iso90DiasAtras,
  isoDiasAtrasDateKey,
  pedidoDentroJanela90d,
  pedidoElegivelIep,
} from '@/lib/calcularIepProdutos';
import { STATUS_PEDIDO_CONTA_NO_TURNO_CAIXA } from '@/lib/pdvCaixaTurnoVendas';

const PEDIDO_IDS_CHUNK = 40;
export const TIPOS_VENDA_PDV = ['PDV', 'PDV Supermercado', 'PDV Autosserviço', 'Pedido'];

function normalizeItemVenda(it) {
  return {
    ...it,
    produto_id: it?.produto_id ?? it?.produtoId,
    produtoId: it?.produto_id ?? it?.produtoId,
    quantidade_base: it?.quantidade_base,
    quantidade: it?.quantidade ?? it?.quantidade_comercial,
    fator_conversao: it?.fator_conversao ?? it?.fator_aplicado ?? 1,
    preco_final_unitario_fator1: it?.preco_final_unitario_fator1,
    preco_unitario_fator1: it?.preco_unitario_fator1 ?? it?.preco_unitario_praticado,
    preco_unitario_praticado: it?.preco_unitario_praticado ?? it?.preco_unitario_fator1,
    preco_unitario_comercial: it?.preco_unitario_comercial,
    total: it?.total,
  };
}

function appendItemToIndexes(itensPorProduto, itensPorPedido, pedidoId, rawItem) {
  const item = normalizeItemVenda(rawItem);
  const pid = String(item?.produto_id ?? item?.produtoId ?? '').trim();
  const pvid = String(pedidoId ?? rawItem?.pedido_venda_id ?? '').trim();

  if (pid) {
    if (!itensPorProduto[pid]) itensPorProduto[pid] = [];
    itensPorProduto[pid].push(item);
  }
  if (pvid) {
    if (!itensPorPedido[pvid]) itensPorPedido[pvid] = [];
    itensPorPedido[pvid].push(item);
  }
}

export function buildItensPorProdutoFromPedidos(pedidos90d) {
  const itensPorProduto = {};
  const itensPorPedido = {};
  for (const pedido of pedidos90d || []) {
    for (const raw of pedido?.itens || []) {
      appendItemToIndexes(itensPorProduto, itensPorPedido, pedido.id, raw);
    }
  }
  return itensPorProduto;
}

function countLinhasItens(itensPorProduto) {
  let total = 0;
  for (const linhas of Object.values(itensPorProduto || {})) {
    total += Array.isArray(linhas) ? linhas.length : 0;
  }
  return total;
}

function countLinhasPedido(itensPorPedido) {
  let total = 0;
  for (const linhas of Object.values(itensPorPedido || {})) {
    total += Array.isArray(linhas) ? linhas.length : 0;
  }
  return total;
}

function rowsFromApi(batch) {
  return Array.isArray(batch) ? batch : batch?.data ?? [];
}

function hydratePedidosComItens(pedidos, itensPorPedido) {
  return pedidos.map((pedido) => {
    const carregados = itensPorPedido[String(pedido.id)] || [];
    const { itens: _i, ...rest } = pedido;
    return { ...rest, itens: carregados, _itens_fonte: carregados.length ? 'sql' : 'vazio' };
  });
}

function pedidoTemItens(pedido) {
  return Array.isArray(pedido?.itens) && pedido.itens.length > 0;
}

async function carregarPedidoVendaItensPorIds(pedidoIds, itensPorProduto, itensPorPedido) {
  if (!pedidoIds.length || !base44.entities.PedidoVendaItem?.filter) return;

  for (let i = 0; i < pedidoIds.length; i += PEDIDO_IDS_CHUNK) {
    const chunk = pedidoIds.slice(i, i + PEDIDO_IDS_CHUNK);
    try {
      const batch = await base44.entities.PedidoVendaItem.filter({
        pedido_venda_id: { $in: chunk },
      });
      for (const it of rowsFromApi(batch)) {
        appendItemToIndexes(itensPorProduto, itensPorPedido, it.pedido_venda_id, it);
      }
    } catch {
      for (const pedidoId of chunk) {
        try {
          const batch = await base44.entities.PedidoVendaItem.filter({
            pedido_venda_id: pedidoId,
          });
          for (const it of rowsFromApi(batch)) {
            appendItemToIndexes(itensPorProduto, itensPorPedido, pedidoId, it);
          }
        } catch {
          /* pedido sem linhas canónicas */
        }
      }
    }
  }
}

/** Carrega linhas canónicas por data (evita depender do espelho no PedidoVenda). */
async function carregarPedidoVendaItensPorData(dataKey, itensPorProduto, itensPorPedido) {
  if (!base44.entities.PedidoVendaItem?.filter) return 0;

  let skip = 0;
  const pageSize = 500;
  let total = 0;

  while (true) {
    let batch;
    try {
      batch = await base44.entities.PedidoVendaItem.filter(
        { created_date: { $gte: dataKey } },
        '-created_date',
        pageSize,
        skip,
      );
    } catch {
      break;
    }

    const rows = rowsFromApi(batch);
    if (!rows.length) break;

    for (const it of rows) {
      appendItemToIndexes(itensPorProduto, itensPorPedido, it.pedido_venda_id, it);
      total += 1;
    }

    if (rows.length < pageSize) break;
    skip += pageSize;
  }

  return total;
}

async function hidratarPedidosSemItens(pedidos90d, dataKey) {
  const pedidos = Array.isArray(pedidos90d) ? [...pedidos90d] : [];
  const semItens = pedidos.filter((p) => !pedidoTemItens(p));
  if (!semItens.length) return pedidos;

  const itensPorProduto = {};
  const itensPorPedido = {};

  await carregarPedidoVendaItensPorData(dataKey, itensPorProduto, itensPorPedido);

  const idsSemLinhas = semItens
    .filter((p) => !(itensPorPedido[String(p.id)]?.length))
    .map((p) => String(p.id))
    .filter(Boolean);

  if (idsSemLinhas.length) {
    await carregarPedidoVendaItensPorIds(idsSemLinhas, itensPorProduto, itensPorPedido);
  }

  const hidratados = hydratePedidosComItens(semItens, itensPorPedido);
  const porId = Object.fromEntries(hidratados.map((p) => [String(p.id), p]));
  return pedidos.map((p) => porId[String(p.id)] || p);
}

async function fetchPedidosPaginados(query) {
  const dataISO = iso90DiasAtras();
  const cutMs = new Date(dataISO).getTime();
  const todosPedidos = [];
  let skip = 0;
  const pageSize = 500;

  while (true) {
    const batch = await base44.entities.PedidoVenda.filter(
      query,
      '-created_date',
      pageSize,
      skip,
    );
    const rows = rowsFromApi(batch);
    if (!rows.length) break;

    for (const pedido of rows) {
      if (pedidoElegivelIep(pedido) && pedidoDentroJanela90d(pedido, dataISO)) {
        todosPedidos.push(pedido);
      }
    }

    if (rows.length < pageSize) break;

    const last = rows[rows.length - 1];
    const lastRaw = last?.created_date ?? last?.created_at;
    if (lastRaw && new Date(lastRaw).getTime() < cutMs) break;

    skip += pageSize;
  }

  return todosPedidos;
}

async function buscarPedidos90dBase() {
  const dataKey = isoDiasAtrasDateKey(90);
  const porId = new Map();

  for (const tipo of TIPOS_VENDA_PDV) {
    try {
      const rows = await fetchPedidosPaginados({
        tipo,
        status: { $ne: 'Cancelado' },
        created_date: { $gte: dataKey },
      });
      for (const pedido of rows) {
        if (pedido?.id != null) porId.set(String(pedido.id), pedido);
      }
    } catch {
      /* tenta próximo tipo */
    }
  }

  if (porId.size === 0) {
    const fallbacks = [
      {
        tipo: 'PDV',
        status: { $ne: 'Cancelado' },
        created_date: { $gte: iso90DiasAtras() },
      },
      { tipo: 'PDV', status: { $ne: 'Cancelado' } },
      { status: { $ne: 'Cancelado' }, created_date: { $gte: dataKey } },
    ];
    for (const query of fallbacks) {
      try {
        const rows = await fetchPedidosPaginados(query);
        for (const pedido of rows) {
          if (pedido?.id != null) porId.set(String(pedido.id), pedido);
        }
        if (porId.size > 0) break;
      } catch {
        /* próximo fallback */
      }
    }
  }

  return [...porId.values()];
}

/**
 * Pedidos PDV elegíveis para catálogo / relatório de vendas (últimos 90 dias).
 */
export async function fetchPedidosVenda90d() {
  const dataKey = isoDiasAtrasDateKey(90);
  const pedidosBase = await buscarPedidos90dBase();
  return hidratarPedidosSemItens(pedidosBase, dataKey);
}

/**
 * Índices de venda 90d + pedidos com `itens` preenchidos (job ABCD / relatório IEP).
 */
export async function buildItensIndexes90d(pedidos90d) {
  const pedidos = Array.isArray(pedidos90d) ? pedidos90d : [];
  const itensPorProduto = {};
  const itensPorPedido = {};
  const pedidoIds = pedidos.map((p) => String(p.id)).filter(Boolean);

  for (const pedido of pedidos) {
    for (const it of pedido?.itens || []) {
      appendItemToIndexes(itensPorProduto, itensPorPedido, pedido.id, it);
    }
  }

  if (pedidoIds.length) {
    const dataKey = isoDiasAtrasDateKey(90);
    const pedidosSemEspelho = pedidos.filter((p) => !pedidoTemItens(p)).length;
    const poucasLinhas = countLinhasItens(itensPorProduto) < pedidoIds.length;

    if (pedidosSemEspelho > 0 || poucasLinhas) {
      await carregarPedidoVendaItensPorData(dataKey, itensPorProduto, itensPorPedido);
    }
    if (countLinhasItens(itensPorProduto) < pedidoIds.length) {
      const faltam = pedidoIds.filter((id) => !(itensPorPedido[id]?.length));
      if (faltam.length) {
        await carregarPedidoVendaItensPorIds(faltam, itensPorProduto, itensPorPedido);
      }
    }
  }

  return { itensPorProduto, itensPorPedido };
}

/** Pedidos 90d com itens + índice por produto. */
export async function fetchDadosVendaAbcd90d() {
  const pedidos90d = await fetchPedidosVenda90d();
  const itensPorProduto = buildItensPorProdutoFromPedidos(pedidos90d);

  return {
    pedidos90d,
    itensPorProduto,
    itens_linhas: countLinhasItens(itensPorProduto),
  };
}

/**
 * Mesmo recorte da aba Consulta em VendasGestao (sem filtro de tipo).
 */
export function pedidoElegivelMargemConsulta(pedido) {
  if (!pedido) return false;
  if (String(pedido.status) === 'Cancelado') return false;
  return STATUS_PEDIDO_CONTA_NO_TURNO_CAIXA.includes(pedido.status);
}

async function fetchAllPedidosVendaList() {
  const byId = new Map();
  let skip = 0;
  const pageSize = 500;
  const maxPages = 80;

  for (let page = 0; page < maxPages; page += 1) {
    const batch = await base44.entities.PedidoVenda.list('-created_date', pageSize, skip);
    const rows = rowsFromApi(batch);
    if (!rows.length) break;

    let novos = 0;
    for (const pedido of rows) {
      const id = pedido?.id;
      if (!id || byId.has(String(id))) continue;
      byId.set(String(id), pedido);
      novos += 1;
    }

    if (rows.length < pageSize) break;
    if (novos === 0) break;
    skip += pageSize;
  }

  return [...byId.values()];
}

/**
 * Carrega vendas elegíveis para o Relatório de Margem (mesma base da Consulta de Vendas + hidratação de itens).
 */
export async function fetchPedidosVendaParaMargem() {
  const pedidos = (await fetchAllPedidosVendaList()).filter(pedidoElegivelMargemConsulta);
  const dataKey = isoDiasAtrasDateKey(365);
  return hidratarPedidosSemItens(pedidos, dataKey);
}

export { countLinhasItens };
