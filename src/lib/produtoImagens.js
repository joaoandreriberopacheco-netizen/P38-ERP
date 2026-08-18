import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';

/** Piloto: produtos cuja descrição começa com "PISO". */
export function isProdutoPilotoGaleria(produto) {
  const nome = String(produto?.nome || produto?.produto_nome || '').trim().toUpperCase();
  return nome.startsWith('PISO');
}

const cache = new Map();

export function clearProdutoImagensCache(produtoId) {
  if (produtoId) cache.delete(produtoId);
  else cache.clear();
}

/**
 * Busca galeria ativa do produto (ordenada). Usa cache em memória por sessão.
 * @returns {Promise<Array<{ id?: string, url: string, tipo: string, ordem?: number, principal?: boolean }>>}
 */
export async function fetchProdutoImagens(produtoId) {
  if (!produtoId) return [];
  if (cache.has(produtoId)) return cache.get(produtoId);

  if (!isSupabaseBrowserConfigured()) {
    cache.set(produtoId, []);
    return [];
  }

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('produto_imagem')
    .select('id, url, tipo, ordem, principal')
    .eq('produto_id', produtoId)
    .eq('ativo', true)
    .order('ordem', { ascending: true });

  if (error) {
    console.warn('[produtoImagens] fetch failed', produtoId, error.message);
    cache.set(produtoId, []);
    return [];
  }

  const imagens = data || [];
  cache.set(produtoId, imagens);
  return imagens;
}

/** Monta lista para galeria: DB primeiro, fallback para imagem_url do produto. */
export async function resolveProdutoGaleria(produto) {
  const imagens = await fetchProdutoImagens(produto?.id);
  if (imagens.length > 0) return imagens;

  const url = String(produto?.imagem_url || '').trim();
  if (!url) return [];

  return [{ url, tipo: 'principal', principal: true, ordem: 0 }];
}
