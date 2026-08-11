import { getSupabaseBrowserClient } from '@/lib/supabaseBrowserClient';

function sb() {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error('Supabase não configurado');
  return client;
}

export async function fetchModeloLinhas() {
  const { data, error } = await sb()
    .from('modelo_linha')
    .select('*')
    .eq('ativo', true)
    .order('ordem')
    .order('nome');
  if (error) throw error;
  return data || [];
}

export async function fetchModeloProdutosCompra(linhaId) {
  if (!linhaId) return [];
  const { data, error } = await sb()
    .from('modelo_produto_compra')
    .select('*')
    .eq('linha_id', linhaId)
    .eq('ativo', true)
    .order('nome');
  if (error) throw error;
  return data || [];
}

export async function fetchAllModeloProdutosCompra() {
  const { data, error } = await sb()
    .from('modelo_produto_compra')
    .select('*')
    .eq('ativo', true)
    .order('nome');
  if (error) throw error;
  return data || [];
}

export async function fetchModeloEixoValores({ linhaId, produtoCompraId }) {
  let q = sb().from('modelo_eixo_valor').select('*').eq('ativo', true);
  if (produtoCompraId) q = q.eq('produto_compra_id', produtoCompraId);
  else if (linhaId) q = q.eq('linha_id', linhaId).is('produto_compra_id', null);
  else return [];
  const { data, error } = await q.order('nome');
  if (error) throw error;
  return data || [];
}

export async function fetchModeloSkus() {
  const { data, error } = await sb()
    .from('modelo_sku')
    .select('*')
    .eq('ativo', true)
    .order('nome');
  if (error) throw error;
  return data || [];
}

export async function fetchModeloSkuById(id) {
  const { data, error } = await sb()
    .from('modelo_sku')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function insertModeloLinha(row) {
  const { data, error } = await sb().from('modelo_linha').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function insertModeloProdutoCompra(row) {
  const { data, error } = await sb().from('modelo_produto_compra').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function ensureEixoValor({ linhaId, produtoCompraId, eixo, texto }) {
  const t = String(texto || '').trim();
  if (!t) return null;
  const codigo = t.slice(0, 48);
  const existing = await fetchModeloEixoValores({ linhaId, produtoCompraId });
  const hit = existing.find((e) => e.eixo === eixo && e.nome.toLowerCase() === t.toLowerCase());
  if (hit) return hit;
  const payload = {
    linha_id: produtoCompraId ? null : linhaId,
    produto_compra_id: produtoCompraId || null,
    eixo,
    codigo,
    nome: t,
    ativo: true,
  };
  const { data, error } = await sb().from('modelo_eixo_valor').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function saveModeloSku(row) {
  const payload = { ...row, updated_at: new Date().toISOString() };
  if (row.id) {
    const { data, error } = await sb().from('modelo_sku').update(payload).eq('id', row.id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await sb().from('modelo_sku').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function inativarModeloSku(id) {
  const { error } = await sb().from('modelo_sku').update({ ativo: false, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

/** Lê produto de produção (read-only) para espelho */
export async function fetchProdutoProducaoByCodigo(codigo) {
  const c = String(codigo || '').trim();
  if (!c) return null;
  const { data, error } = await sb()
    .from('produto')
    .select('id, codigo_interno, nome, marca, categoria_nome, estoque_atual, estoque_minimo, campo_hierarquico_1, campo_hierarquico_2, campo_hierarquico_3, campo_hierarquico_4, campo_hierarquico_5, ativo')
    .eq('codigo_interno', c)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function searchProdutosProducao(term, limit = 12) {
  const q = String(term || '').trim();
  if (!q) return [];
  const { data, error } = await sb()
    .from('produto')
    .select('id, codigo_interno, nome, marca, categoria_nome, estoque_atual, ativo')
    .eq('ativo', true)
    .or(`nome.ilike.%${q}%,codigo_interno.ilike.%${q}%`)
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function fetchProdutoProducaoById(id) {
  if (!id) return null;
  const { data, error } = await sb()
    .from('produto')
    .select('id, codigo_interno, nome, marca, categoria_nome, estoque_atual, estoque_minimo, campo_hierarquico_1, campo_hierarquico_2, campo_hierarquico_3, campo_hierarquico_4, campo_hierarquico_5, ativo')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
