import { getSupabaseBrowserClient } from '@/lib/supabaseBrowserClient';

export async function fetchLinhasCompra({ apenasAtivas = true } = {}) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  let q = supabase
    .from('linha_compra')
    .select('*')
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true });
  if (apenasAtivas) q = q.eq('ativo', true);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchProdutosCompraByLinha(linhaId) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !linhaId) return [];
  const { data, error } = await supabase
    .from('produto_compra')
    .select('*')
    .eq('linha_id', linhaId)
    .eq('ativo', true)
    .order('nome', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchEixoValores({ linhaId, produtoCompraId, eixo } = {}) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  let q = supabase.from('eixo_valor').select('*').eq('ativo', true);
  if (eixo) q = q.eq('eixo', eixo);
  if (produtoCompraId) {
    q = q.eq('produto_compra_id', produtoCompraId);
  } else if (linhaId) {
    q = q.eq('linha_id', linhaId).is('produto_compra_id', null);
  }
  q = q.order('nome', { ascending: true });
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
