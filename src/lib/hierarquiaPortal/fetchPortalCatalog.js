import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';
import {
  setPortalCatalogCache,
  patchPortalCatalogReservaLocal,
} from '@/lib/hierarquiaPortal/portalCatalogStore';
import manifest from '@/data/portalExcelManifest.generated.json';

function sb() {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error('Supabase não configurado');
  return client;
}

function manifestRowsFromJson() {
  const skus = manifest.skus || {};
  return Object.values(skus).map((sku) => ({
    id: sku.codigo_interno,
    codigo_interno: String(sku.codigo_interno || '').trim().toUpperCase(),
    produto_id: null,
    categoria_nome: sku.categoria || 'E - PISOS E REVESTIMENTOS',
    linha_codigo: sku.linha_codigo,
    linha_nome: sku.linha_nome,
    linha_tipo: 'portfolio',
    linha_ordem: sku.linha_codigo === 'CERAMICA_RETIF' ? 20 : 10,
    produto_compra_codigo: sku.produto_compra_codigo || null,
    produto_compra_nome: sku.produto_compra || null,
    eixo_a_texto: sku.ex_a || '',
    eixo_b_texto: sku.ex_b || '',
    novo_sku: sku.novo_sku || sku.codigo_interno,
    reserva_portal: false,
    fonte: 'manifest',
    ativo: true,
  }));
}

/** Carrega portal_catalog (Supabase) ou manifest JSON em cache. */
export async function loadPortalCatalog() {
  if (isSupabaseBrowserConfigured()) {
    try {
      const { data, error } = await sb()
        .from('portal_catalog')
        .select('*')
        .eq('ativo', true)
        .order('linha_ordem')
        .order('novo_sku');
      if (!error && Array.isArray(data) && data.length > 0) {
        setPortalCatalogCache(data, 'supabase');
        return { source: 'supabase', count: data.length };
      }
      if (error) console.warn('[loadPortalCatalog]', error.message);
    } catch (e) {
      console.warn('[loadPortalCatalog]', e?.message || e);
    }
  }

  const rows = manifestRowsFromJson();
  setPortalCatalogCache(rows, 'manifest');
  return { source: 'manifest', count: rows.length };
}

export async function setPortalCatalogReserva(codigosInternos = [], reserva = true) {
  const codigos = [...new Set(
    codigosInternos.map((c) => String(c || '').trim().toUpperCase()).filter(Boolean),
  )];
  if (!codigos.length) return 0;

  if (!isSupabaseBrowserConfigured()) {
    patchPortalCatalogReservaLocal(codigos, reserva);
    return codigos.length;
  }

  const { error } = await sb()
    .from('portal_catalog')
    .update({ reserva_portal: reserva, updated_at: new Date().toISOString() })
    .in('codigo_interno', codigos)
    .eq('ativo', true);

  if (error) throw error;
  patchPortalCatalogReservaLocal(codigos, reserva);
  return codigos.length;
}

export async function reativarPortalCatalogReserva(codigosInternos = []) {
  return setPortalCatalogReserva(codigosInternos, false);
}

export async function enviarPortalCatalogParaReserva(codigosInternos = []) {
  return setPortalCatalogReserva(codigosInternos, true);
}
