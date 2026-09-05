/**
 * Catálogo PDV — leitura rápida via Supabase (Fase 7) com fallback Base44.
 */

import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';
import { base44 } from '@/api/base44Client';
import { filterProdutosDisponiveisPdv } from '@/lib/hierarquiaPortal/produtoPdvDisponibilidade';

function mapPdvProdutoRow(row = {}) {
  if (!row?.id) return null;
  return {
    ...row,
    reserva_portal: Boolean(row.reserva_portal),
  };
}

/** @returns {Promise<object[]|null>} */
export async function readPdvCatalogoFromSupabase() {
  if (!isSupabaseBrowserConfigured()) return null;

  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc('pdv_catalogo_read');
    if (error || !Array.isArray(data)) return null;
    return data.map(mapPdvProdutoRow).filter(Boolean);
  } catch {
    return null;
  }
}

export async function fetchProdutosPdvCatalogo() {
  const fromSql = await readPdvCatalogoFromSupabase();
  if (fromSql?.length) {
    return filterProdutosDisponiveisPdv(fromSql);
  }

  const rows = await base44.entities.Produto.filter({ ativo: true });
  return filterProdutosDisponiveisPdv(Array.isArray(rows) ? rows : []);
}

/** Busca um produto por código (barcode / código interno). */
export async function fetchProdutoPdvPorCodigo(codigo) {
  const term = String(codigo || '').trim();
  if (!term) return null;

  const rows = await base44.entities.Produto.filter({ codigo_interno: term }, '-created_date', 3).catch(() => []);
  const lista = Array.isArray(rows) ? rows : [];
  if (lista[0]) return lista[0];

  const barras = await base44.entities.Produto.filter({ codigo_barras: term }, '-created_date', 3).catch(() => []);
  const listaBarras = Array.isArray(barras) ? barras : [];
  return listaBarras[0] || null;
}

/** @returns {Promise<object[]>} */
export async function searchClientesPdv(term, limit = 25) {
  const trimmed = String(term || '').trim();
  if (trimmed.length < 2) return [];

  if (isSupabaseBrowserConfigured()) {
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.rpc('pdv_clientes_search', {
        p_term: trimmed,
        p_limit: limit,
      });
      if (!error && Array.isArray(data)) return data;
    } catch {
      /* fallback */
    }
  }

  const rows = await base44.entities.Terceiro.filter({ tipo: ['Cliente', 'Ambos'] }).catch(() => []);
  const termo = trimmed.toLowerCase();
  return (Array.isArray(rows) ? rows : []).filter((c) =>
    c.nome?.toLowerCase().includes(termo)
    || c.cpf_cnpj?.toLowerCase().includes(termo)
    || c.telefone?.toLowerCase().includes(termo),
  ).slice(0, limit);
}
