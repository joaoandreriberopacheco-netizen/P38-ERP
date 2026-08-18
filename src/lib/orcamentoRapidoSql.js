/**
 * Orçamento rápido — persistência SQL-only (pedido_venda + pedido_venda_item).
 */
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';
import { gerarNumeroSequencial } from '@/lib/gerarNumeroSequencial';
import { syncPedidoVendaItens } from '@/lib/syncPedidoVendaItens';
import { linhasPedidoVendaToLegacyItens } from '@/lib/fetchPedidoVendaItens';
import { getItemUnitKey } from '@/lib/productUnits';

const TIPO_ORCAMENTO = 'Orçamento';
const STATUS_ORCAMENTO = 'Orçamento';

function sb() {
  if (!isSupabaseBrowserConfigured()) {
    throw new Error('Supabase não configurado — orçamento rápido requer SQL.');
  }
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error('Cliente Supabase indisponível.');
  return client;
}

function rowToHeader(row = {}) {
  const total = Number(row.total ?? row.dados?.valor_total ?? 0);
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
    tipo: row.tipo || row.dados?.tipo || TIPO_ORCAMENTO,
    status: row.status || row.dados?.status || STATUS_ORCAMENTO,
    created_at: row.created_at,
    created_date: row.created_at,
  };
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

async function fetchItensSql(pedidoIds = []) {
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

async function hydrateItens(pedidos = []) {
  const ids = pedidos.map((p) => p.id).filter(Boolean);
  if (!ids.length) return pedidos.map((p) => ({ ...p, itens: [] }));

  const byPedido = await fetchItensSql(ids);

  return pedidos.map((pedido) => {
    const linhas = byPedido.get(pedido.id) || [];
    const itens = linhasPedidoVendaToLegacyItens(linhas);
    return { ...pedido, itens };
  });
}

/** Lista orçamentos rápidos gravados (SQL). */
export async function listarOrcamentosRapidos({ dias = 7, busca = '', limite = 50 } = {}) {
  const client = sb();
  const desde = new Date();
  desde.setDate(desde.getDate() - Math.max(1, Number(dias) || 7));

  let query = client
    .from('pedido_venda')
    .select('*')
    .ilike('tipo', TIPO_ORCAMENTO)
    .gte('created_at', desde.toISOString())
    .order('created_at', { ascending: false })
    .limit(limite);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const headers = (data || []).map(rowToHeader);
  const termo = String(busca || '').trim().toLowerCase();
  const filtrados = termo
    ? headers.filter((o) =>
        [o.cliente_nome, o.numero, o.observacoes, o.vendedor_nome]
          .some((v) => String(v || '').toLowerCase().includes(termo)),
      )
    : headers;

  return hydrateItens(filtrados);
}

/** Carrega um orçamento com itens (SQL). */
export async function obterOrcamentoRapido(id) {
  if (!id) return null;
  const client = sb();
  const { data, error } = await client.from('pedido_venda').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [hydrated] = await hydrateItens([rowToHeader(data)]);
  return hydrated;
}

async function gerarNumeroOrcamento() {
  try {
    const codigo = await gerarNumeroSequencial('PV');
    if (codigo) return codigo;
  } catch {
    /* fallback */
  }
  return `OR-${Date.now().toString().slice(-8)}`;
}

/**
 * Grava orçamento rápido em pedido_venda + pedido_venda_item (SQL).
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
  const payload = {
    cliente_nome: clienteNome?.trim() || '',
    status: STATUS_ORCAMENTO,
    tipo: TIPO_ORCAMENTO,
    subtotal: Number(subtotal) || 0,
    valor_desconto: Number(valorDesconto) || 0,
    valor_frete: 0,
    total: Number(valorTotal) || 0,
    observacoes: observacoes?.trim() || '',
    tabela_preco_id: tabelaPrecoId || null,
    vendedor_id: vendedorId || null,
    vendedor_nome: vendedorNome || '',
    itens: [],
    pagamentos: [],
    updated_at: now,
    dados: {
      valor_total: Number(valorTotal) || 0,
      subtotal: Number(subtotal) || 0,
      valor_desconto: Number(valorDesconto) || 0,
      tipo: TIPO_ORCAMENTO,
      status: STATUS_ORCAMENTO,
      origem: 'orcamento_rapido',
    },
  };

  let pedidoId = id;

  if (pedidoId) {
    const { data, error } = await client
      .from('pedido_venda')
      .update(payload)
      .eq('id', pedidoId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    pedidoId = data?.id || pedidoId;
  } else {
    const numero = await gerarNumeroOrcamento();
    const { data, error } = await client
      .from('pedido_venda')
      .insert({
        ...payload,
        id: crypto.randomUUID(),
        numero,
        created_at: now,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    pedidoId = data?.id;
  }

  const legacyItens = items.map((item) => ({
    ...quickBudgetItemToLegacy(item),
    tabela_preco_id: tabelaPrecoId || '',
    tabela_preco_multiplicador: item.tabela_preco_multiplicador || 1,
  }));

  await syncPedidoVendaItens(pedidoId, legacyItens);

  // Recompor linas pode inflar subtotal/total (preços de tabela); reafirmar totais do UI.
  const { error: fixError } = await client
    .from('pedido_venda')
    .update({
      subtotal: Number(subtotal) || 0,
      valor_desconto: Number(valorDesconto) || 0,
      total: Number(valorTotal) || 0,
      dados: {
        ...payload.dados,
        valor_total: Number(valorTotal) || 0,
        subtotal: Number(subtotal) || 0,
        valor_desconto: Number(valorDesconto) || 0,
      },
    })
    .eq('id', pedidoId);
  if (fixError) throw new Error(fixError.message);

  return obterOrcamentoRapido(pedidoId);
}
