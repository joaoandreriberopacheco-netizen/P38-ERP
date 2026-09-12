import {
  getSupabaseBrowserClient,
  isSupabaseBrowserConfigured,
  normalizeSupabaseProjectUrl,
} from '@/lib/supabaseBrowserClient';
import { p38PublicEnv } from '@/lib/p38PublicEnv';

/** Projecto P38 em produção — fallback quando VITE_SUPABASE_URL não entrou no bundle. */
const P38_SUPABASE_URL_FALLBACK = 'https://zhonvxkkqabfdyehyxpu.supabase.co';

/**
 * Produto com galeria clicável: piloto PISO* ou qualquer um com imagem_url.
 * (PDV, tabela de preços, orçamento usam ProdutoThumb com esta regra por defeito.)
 */
export function isProdutoPilotoGaleria(produto) {
  if (!produto?.id) return false;
  const nome = String(produto?.nome || produto?.produto_nome || '').trim().toUpperCase();
  if (nome.startsWith('PISO')) return true;
  return Boolean(String(produto?.imagem_url || '').trim());
}

const cache = new Map();

export function clearProdutoImagensCache(produtoId) {
  if (produtoId) cache.delete(produtoId);
  else cache.clear();
}

function getSupabaseAnonKey() {
  return String(p38PublicEnv('VITE_SUPABASE_ANON_KEY') || '').trim();
}

function resolveSupabaseRestBaseUrl() {
  const fromEnv = normalizeSupabaseProjectUrl(p38PublicEnv('VITE_SUPABASE_URL') || '');
  return fromEnv || P38_SUPABASE_URL_FALLBACK;
}

function canFetchProdutoImagensRest() {
  return Boolean(getSupabaseAnonKey());
}

async function fetchProdutoImagensViaRest(produtoId) {
  const anonKey = getSupabaseAnonKey();
  if (!anonKey) return [];

  const baseUrl = resolveSupabaseRestBaseUrl();
  const query = new URLSearchParams({
    select: 'id,url,tipo,ordem,principal',
    produto_id: `eq.${produtoId}`,
    ativo: 'eq.true',
    order: 'ordem.asc',
  });

  try {
    const res = await fetch(`${baseUrl}/rest/v1/produto_imagem?${query}`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });

    if (!res.ok) {
      console.warn('[produtoImagens] REST failed', produtoId, res.status);
      return [];
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('[produtoImagens] REST error', produtoId, err?.message || err);
    return [];
  }
}

/**
 * Busca galeria ativa do produto (ordenada). Usa cache em memória por sessão.
 * @returns {Promise<Array<{ id?: string, url: string, tipo: string, ordem?: number, principal?: boolean }>>}
 */
export async function fetchProdutoImagens(produtoId) {
  if (!produtoId) return [];
  if (cache.has(produtoId)) return cache.get(produtoId);

  let imagens = [];

  if (isSupabaseBrowserConfigured()) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('produto_imagem')
      .select('id, url, tipo, ordem, principal')
      .eq('produto_id', produtoId)
      .eq('ativo', true)
      .order('ordem', { ascending: true });

    if (error) {
      console.warn('[produtoImagens] fetch failed', produtoId, error.message);
    } else if (Array.isArray(data)) {
      imagens = data;
    }
  } else if (canFetchProdutoImagensRest()) {
    imagens = await fetchProdutoImagensViaRest(produtoId);
  }

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
