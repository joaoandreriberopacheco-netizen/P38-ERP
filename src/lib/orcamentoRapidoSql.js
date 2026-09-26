/**
 * Orçamento rápido — entidade `orcamento` + `orcamento_item` (SQL).
 * Legado: leitura em `pedido_venda` até migração 111.
 */
import { base44 } from '@/api/base44Client';
import { inicioDiaSistemaISO, fimDiaSistemaISO } from '@/components/utils/dateUtils';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';
import { gerarNumeroSequencial } from '@/lib/gerarNumeroSequencial';
import { linhasPedidoVendaToLegacyItens } from '@/lib/fetchPedidoVendaItens';
import { getItemUnitKey } from '@/lib/productUnits';
import { isOrcamentoPedidoVendaRow, isPedidoOrcamento } from '@/lib/pedidoVendaEligibility';
import {
  orcamentoPedidoVendaSqlOrFilter,
  PEDIDO_VENDA_STATUS_ORCAMENTO,
  PEDIDO_VENDA_TIPO_ORCAMENTO,
  resolvePedidoVendaTipoStatus,
} from '@/lib/pedidoVendaOrcamentoLabels';

export const ORCAMENTO_STATUS_ABERTO = 'Aberto';
export const ORCAMENTO_ORIGEM_RAPIDO = 'orcamento_rapido';

function sb() {
  if (!isSupabaseBrowserConfigured()) {
    throw new Error('Supabase não configurado — orçamento rápido requer SQL.');
  }
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error('Cliente Supabase indisponível.');
  return client;
}

function orcamentoRowToHeader(row = {}) {
  const dados = row.dados && typeof row.dados === 'object' ? row.dados : {};
  const total = Number(row.total ?? dados.valor_total ?? 0);
  return {
    id: row.id,
    numero: row.numero || '',
    cliente_nome: row.cliente_nome || dados.cliente_nome || '',
    observacoes: row.observacoes || dados.observacoes || '',
    subtotal: Number(row.subtotal ?? dados.subtotal ?? 0),
    valor_desconto: Number(row.valor_desconto ?? dados.valor_desconto ?? 0),
    valor_total: total,
    tabela_preco_id: row.tabela_preco_id || dados.tabela_preco_id || '',
    vendedor_id: row.vendedor_id || '',
    vendedor_nome: row.vendedor_nome || '',
    tipo: PEDIDO_VENDA_TIPO_ORCAMENTO,
    status: row.status === ORCAMENTO_STATUS_ABERTO ? PEDIDO_VENDA_STATUS_ORCAMENTO : (row.status || PEDIDO_VENDA_STATUS_ORCAMENTO),
    created_at: row.created_at || dados.created_date,
    created_date: row.created_at || dados.created_date,
  };
}

function rowToHeaderLegadoPedido(row = {}) {
  const total = Number(row.total ?? row.dados?.valor_total ?? 0);
  const { tipo, status } = resolvePedidoVendaTipoStatus(row);
  return {
    id: row.id,
    numero: row.numero || '',
    cliente_nome: row.cliente_nome || row.dados?.cliente_nome || '',
    observacoes: row.observacoes || row.dados?.observacoes || '',
    subtotal: Number(row.subtotal ?? row.dados?.subtotal ?? 0),
    valor_desconto: Number(row.valor_desconto ?? row.dados?.valor_desconto ?? 0),
    valor_total: total,
    tabela_preco_id: row.tabela_preco_id || row.dados?.tabela_preco_id || '',
    vendedor_id: row.vendedor_id || '',
    vendedor_nome: row.vendedor_nome || '',
    tipo,
    status,
    created_at: row.created_at || row.dados?.created_date,
    created_date: row.created_at || row.dados?.created_date,
  };
}

function entityPedidoToHeader(pedido = {}) {
  const total = Number(pedido.total ?? pedido.valor_total ?? 0);
  const { tipo, status } = resolvePedidoVendaTipoStatus(pedido);
  return {
    id: pedido.id,
    numero: pedido.numero || '',
    cliente_nome: pedido.cliente_nome || '',
    observacoes: pedido.observacoes || '',
    subtotal: Number(pedido.subtotal ?? 0),
    valor_desconto: Number(pedido.valor_desconto ?? 0),
    valor_total: total,
    tabela_preco_id: pedido.tabela_preco_id || '',
    vendedor_id: pedido.vendedor_id || '',
    vendedor_nome: pedido.vendedor_nome || '',
    tipo,
    status,
    created_at: pedido.created_at || pedido.created_date,
    created_date: pedido.created_date || pedido.created_at,
  };
}

function applyBuscaOrcamentos(headers, busca) {
  const termo = String(busca || '').trim().toLowerCase();
  if (!termo) return headers;
  return headers.filter((o) =>
    [o.cliente_nome, o.numero, o.observacoes, o.vendedor_nome]
      .some((v) => String(v || '').toLowerCase().includes(termo)),
  );
}

function rowTimestampMs(row = {}) {
  const candidates = [
    row.created_at,
    row.updated_at,
    row.dados?.created_date,
    row.dados?.data_emissao,
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    const ms = Date.parse(String(raw));
    if (Number.isFinite(ms)) return ms;
  }
  return 0;
}

function rowWithinWindow(row, desdeMs) {
  const ms = rowTimestampMs(row);
  if (!ms) return true;
  return ms >= desdeMs;
}

export function quickBudgetItemToLegacy(item = {}) {
  const sigla = item.unidade_medida || item.unidade || 'UN';
  return {
    produto_id: item.produto_id,
    produto_nome: item.produto_nome,
    codigo_interno: item.codigo_interno || '',
    quantidade: Number(item.quantidade) || 0,
    unidade_medida: sigla,
    fator_conversao: Number(item.fator_conversao) || 1,
    quantidade_base: item.quantidade_base ?? (Number(item.quantidade) || 0) * (Number(item.fator_conversao) || 1),
    preco_unitario_praticado: Number(item.preco_unitario) || 0,
    preco_venda_lista: Number(item.preco_venda_lista) || 0,
    total: Number(item.total) || 0,
    produto_unidade_id: item.produto_unidade_id || '',
    tabela_preco_id: item.tabela_preco_id || '',
    tabela_preco_multiplicador: item.tabela_preco_multiplicador || 1,
  };
}

export function legacyItemToQuickBudget(item = {}) {
  const sigla = item.unidade_medida || item.unidade_apresentacao || 'UN';
  const precoUnit = Number(item.preco_unitario_praticado ?? item.preco_unitario) || 0;
  const qtd = Number(item.quantidade) || 0;
  return {
    produto_id: item.produto_id,
    produto_nome: item.produto_nome,
    codigo_interno: item.codigo_interno || '',
    item_key: getItemUnitKey(item.produto_id, sigla),
    quantidade: qtd,
    unidade: sigla,
    unidade_medida: sigla,
    unidade_sigla: sigla,
    fator_conversao: Number(item.fator_conversao) || 1,
    quantidade_base: Number(item.quantidade_base) || qtd * (Number(item.fator_conversao) || 1),
    preco_unitario: precoUnit,
    preco_cheio: precoUnit,
    preco_venda_lista: Number(item.preco_venda_lista) || precoUnit,
    tem_ajuste_tabela: false,
    preco_livre: false,
    desconto: 0,
    total: Number(item.total) || precoUnit * qtd,
    produto_unidade_id: item.produto_unidade_id || '',
  };
}

function orcamentoItemRowAsPviShape(row = {}) {
  return { ...row, pedido_venda_id: row.orcamento_id };
}

async function fetchOrcamentoItensSql(orcamentoIds = []) {
  const ids = [...new Set((orcamentoIds || []).filter(Boolean))];
  const byOrcamento = new Map();
  if (!ids.length) return byOrcamento;

  const client = sb();
  const chunkSize = 40;
  const allRows = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await client
      .from('orcamento_item')
      .select('*')
      .in('orcamento_id', chunk);
    if (error) throw new Error(error.message);
    allRows.push(...(data || []));
  }

  for (const row of allRows) {
    const oid = row?.orcamento_id;
    if (!oid) continue;
    if (!byOrcamento.has(oid)) byOrcamento.set(oid, []);
    byOrcamento.get(oid).push(row);
  }
  for (const rows of byOrcamento.values()) {
    rows.sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
  }
  return byOrcamento;
}

async function fetchItensSqlLegadoPedido(pedidoIds = []) {
  const ids = [...new Set((pedidoIds || []).filter(Boolean))];
  const byPedido = new Map();
  if (!ids.length) return byPedido;

  const client = sb();
  const chunkSize = 40;
  const allRows = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await client
      .from('pedido_venda_item')
      .select('*')
      .in('pedido_venda_id', chunk);
    if (error) throw new Error(error.message);
    allRows.push(...(data || []));
  }

  for (const row of allRows) {
    const pid = row?.pedido_venda_id;
    if (!pid) continue;
    if (!byPedido.has(pid)) byPedido.set(pid, []);
    byPedido.get(pid).push(row);
  }
  for (const rows of byPedido.values()) {
    rows.sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
  }
  return byPedido;
}

async function hydrateOrcamentoItens(headers = []) {
  const ids = headers.map((p) => p.id).filter(Boolean);
  if (!ids.length) return headers.map((p) => ({ ...p, itens: [] }));

  const byOrcamento = await fetchOrcamentoItensSql(ids);
  return headers.map((header) => {
    const linhas = (byOrcamento.get(header.id) || []).map(orcamentoItemRowAsPviShape);
    const itens = linhasPedidoVendaToLegacyItens(linhas);
    return { ...header, itens };
  });
}

async function hydrateItensLegadoPedido(pedidos = []) {
  const ids = pedidos.map((p) => p.id).filter(Boolean);
  if (!ids.length) return pedidos.map((p) => ({ ...p, itens: [] }));

  const byPedido = await fetchItensSqlLegadoPedido(ids);
  return pedidos.map((pedido) => {
    const linhas = byPedido.get(pedido.id) || [];
    const itens = linhasPedidoVendaToLegacyItens(linhas);
    return { ...pedido, itens };
  });
}

async function listarOrcamentosEntidadeTable({ dias = 7, busca = '', limite = 50 } = {}) {
  const client = sb();
  const windowDays = Math.max(1, Number(dias) || 7);
  const desdeMs = Date.now() - windowDays * 86400000;
  const maxRows = Math.min(Math.max(Number(limite) || 50, 50) * 4, 400);

  const { data, error } = await client
    .from('orcamento')
    .select('*')
    .neq('status', 'Cancelado')
    .order('updated_at', { ascending: false })
    .limit(maxRows);

  if (error) {
    if (/orcamento|schema cache|42P01/i.test(error.message || '')) return null;
    throw new Error(error.message);
  }

  const recentRows = (data || [])
    .filter((row) => rowWithinWindow(row, desdeMs))
    .sort((a, b) => rowTimestampMs(b) - rowTimestampMs(a))
    .slice(0, Math.max(1, Number(limite) || 50));

  const headers = applyBuscaOrcamentos(recentRows.map(orcamentoRowToHeader), busca);
  return hydrateOrcamentoItens(headers);
}

async function listarOrcamentosRapidosLegadoPedido({ dias = 7, busca = '', limite = 50 } = {}) {
  const client = sb();
  const windowDays = Math.max(1, Number(dias) || 7);
  const desdeMs = Date.now() - windowDays * 86400000;
  const maxRows = Math.min(Math.max(Number(limite) || 50, 50) * 4, 400);

  const { data, error } = await client
    .from('pedido_venda')
    .select('*')
    .or(orcamentoPedidoVendaSqlOrFilter())
    .order('updated_at', { ascending: false })
    .limit(maxRows);

  if (error) throw new Error(error.message);

  const recentRows = (data || [])
    .filter((row) => isOrcamentoPedidoVendaRow(row) && rowWithinWindow(row, desdeMs))
    .sort((a, b) => rowTimestampMs(b) - rowTimestampMs(a))
    .slice(0, Math.max(1, Number(limite) || 50));

  const headers = applyBuscaOrcamentos(recentRows.map(rowToHeaderLegadoPedido), busca);
  return hydrateItensLegadoPedido(headers);
}

async function listarOrcamentosRapidosEntidades({ dias = 7, busca = '', limite = 50 } = {}) {
  const windowDays = Math.max(1, Number(dias) || 7);
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - windowDays);
  const startKey = start.toISOString().slice(0, 10);
  const endKey = end.toISOString().slice(0, 10);
  const created_date = {
    $gte: inicioDiaSistemaISO(startKey),
    $lte: fimDiaSistemaISO(endKey),
  };
  const cap = Math.min(Math.max(Number(limite) || 50, 50) * 3, 300);
  const rows = await base44.entities.PedidoVenda.filter({ created_date }, '-created_date', cap);
  const headers = applyBuscaOrcamentos(
    (Array.isArray(rows) ? rows : [])
      .filter(isPedidoOrcamento)
      .map(entityPedidoToHeader)
      .slice(0, Math.max(1, Number(limite) || 50)),
    busca,
  );
  return hydrateItensLegadoPedido(headers);
}

/** Lista orçamentos (tabela `orcamento`; fallback legado `pedido_venda`). */
export async function listarOrcamentosRapidos({ dias = 7, busca = '', limite = 50 } = {}) {
  if (!isSupabaseBrowserConfigured()) {
    return listarOrcamentosRapidosEntidades({ dias, busca, limite });
  }

  try {
    const fromOrcamento = await listarOrcamentosEntidadeTable({ dias, busca, limite });
    if (fromOrcamento !== null) return fromOrcamento;
  } catch (e) {
    console.warn('[orcamentoRapido] listagem orcamento:', e);
  }

  try {
    const fromLegado = await listarOrcamentosRapidosLegadoPedido({ dias, busca, limite });
    if (fromLegado.length > 0) return fromLegado;
  } catch (e) {
    console.warn('[orcamentoRapido] listagem legado pedido_venda:', e);
  }

  return listarOrcamentosRapidosEntidades({ dias, busca, limite });
}

/** Carrega um orçamento com itens. */
export async function obterOrcamentoRapido(id) {
  if (!id) return null;
  const client = sb();

  const { data: orc, error: orcErr } = await client.from('orcamento').select('*').eq('id', id).maybeSingle();
  if (!orcErr && orc) {
    const [hydrated] = await hydrateOrcamentoItens([orcamentoRowToHeader(orc)]);
    return hydrated;
  }

  const { data, error } = await client.from('pedido_venda').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [hydrated] = await hydrateItensLegadoPedido([rowToHeaderLegadoPedido(data)]);
  return hydrated;
}

async function gerarNumeroOrcamento() {
  try {
    const codigo = await gerarNumeroSequencial('OR');
    if (codigo) return codigo;
  } catch {
    /* fallback */
  }
  try {
    const codigo = await gerarNumeroSequencial('PV');
    if (codigo) return codigo;
  } catch {
    /* fallback */
  }
  return `OR-${Date.now().toString().slice(-8)}`;
}

function legacyItemToOrcamentoItemRow(item = {}, idx, orcamentoId, orcamentoNumero) {
  const qtd = Number(item.quantidade) || 0;
  const fator = Number(item.fator_conversao) || 1;
  const preco = Number(item.preco_unitario_praticado) || 0;
  const qBase = Number(item.quantidade_base) || qtd * fator;
  const total = Number(item.total) || preco * qtd;
  return {
    id: `${orcamentoId}_i${idx}`,
    orcamento_id: orcamentoId,
    orcamento_numero: orcamentoNumero || '',
    produto_id: item.produto_id || null,
    produto_nome: item.produto_nome || '',
    produto_unidade_id: item.produto_unidade_id || null,
    unidade_sigla: item.unidade_medida || 'UN',
    fator_aplicado: fator,
    quantidade_comercial: qtd,
    quantidade_base: qBase,
    preco_unitario_fator1: preco,
    preco_unitario_comercial: preco,
    desconto_unitario_fator1: 0,
    preco_final_unitario_fator1: preco,
    custo_unitario_momento: 0,
    total,
    ordem: idx,
    observacoes: '',
    dados: {},
  };
}

async function syncOrcamentoItens(orcamentoId, orcamentoNumero, legacyItens = []) {
  const client = sb();
  const items = (legacyItens || []).filter((it) => it.produto_id && Number(it.quantidade) > 0);
  const { error: delErr } = await client.from('orcamento_item').delete().eq('orcamento_id', orcamentoId);
  if (delErr) throw new Error(delErr.message);
  if (!items.length) return;
  const rows = items.map((item, idx) =>
    legacyItemToOrcamentoItemRow(item, idx, orcamentoId, orcamentoNumero),
  );
  const { error } = await client.from('orcamento_item').insert(rows);
  if (error) throw new Error(error.message);
}

/**
 * Grava orçamento rápido em `orcamento` + `orcamento_item`.
 */
export async function salvarOrcamentoRapido({
  id,
  items = [],
  clienteNome = '',
  observacoes = '',
  subtotal = 0,
  valorDesconto = 0,
  valorTotal = 0,
  tabelaPrecoId = '',
  vendedorId = '',
  vendedorNome = '',
} = {}) {
  if (!items.length) throw new Error('Adicione itens antes de salvar o orçamento.');

  const client = sb();
  const now = new Date().toISOString();
  const dados = {
    valor_total: Number(valorTotal) || 0,
    subtotal: Number(subtotal) || 0,
    valor_desconto: Number(valorDesconto) || 0,
    origem: ORCAMENTO_ORIGEM_RAPIDO,
  };

  const payload = {
    cliente_nome: clienteNome?.trim() || '',
    status: ORCAMENTO_STATUS_ABERTO,
    subtotal: Number(subtotal) || 0,
    valor_desconto: Number(valorDesconto) || 0,
    valor_frete: 0,
    total: Number(valorTotal) || 0,
    observacoes: observacoes?.trim() || '',
    tabela_preco_id: tabelaPrecoId || null,
    vendedor_id: vendedorId || null,
    vendedor_nome: vendedorNome || '',
    dados,
    updated_at: now,
  };

  let orcamentoId = id;

  if (orcamentoId) {
    const { data, error } = await client
      .from('orcamento')
      .update(payload)
      .eq('id', orcamentoId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    orcamentoId = data?.id || orcamentoId;
  } else {
    const numero = await gerarNumeroOrcamento();
    orcamentoId = crypto.randomUUID();
    const { data, error } = await client
      .from('orcamento')
      .insert({
        ...payload,
        id: orcamentoId,
        numero,
        legado_pedido_venda_id: null,
        created_at: now,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    orcamentoId = data?.id || orcamentoId;
  }

  const legacyItens = items.map((item) => ({
    ...quickBudgetItemToLegacy(item),
    tabela_preco_id: tabelaPrecoId || '',
    tabela_preco_multiplicador: item.tabela_preco_multiplicador || 1,
  }));

  const numero =
    (await client.from('orcamento').select('numero').eq('id', orcamentoId).maybeSingle()).data?.numero || '';

  await syncOrcamentoItens(orcamentoId, numero, legacyItens);

  const { error: fixError } = await client
    .from('orcamento')
    .update({
      subtotal: Number(subtotal) || 0,
      valor_desconto: Number(valorDesconto) || 0,
      total: Number(valorTotal) || 0,
      dados: {
        ...dados,
        valor_total: Number(valorTotal) || 0,
        subtotal: Number(subtotal) || 0,
        valor_desconto: Number(valorDesconto) || 0,
      },
    })
    .eq('id', orcamentoId);
  if (fixError) throw new Error(fixError.message);

  return obterOrcamentoRapido(orcamentoId);
}
