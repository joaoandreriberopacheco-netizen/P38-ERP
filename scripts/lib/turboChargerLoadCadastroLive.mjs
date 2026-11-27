/**
 * Produtos activos no Supabase que ainda não estão no export 4×3 / TurboCharger.
 */
import { createClient } from '@supabase/supabase-js';
import { P38_CANONICAL_PROJECT_REF } from '../p38-secrets.mjs';

function supabaseClient() {
  const url = `https://${P38_CANONICAL_PROJECT_REF}.supabase.co`;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;
  if (!key) return null;
  return createClient(url, key);
}

/** @param {Set<string>} codigosNo4x3 — upper */
export async function loadProdutosForaDo4x3(codigosNo4x3) {
  const sb = supabaseClient();
  if (!sb) return [];

  const out = [];
  let from = 0;
  try {
    while (true) {
      const { data, error } = await sb
        .from('produto')
        .select(
          'codigo_interno,nome,created_at,campo_hierarquico_1,campo_hierarquico_2,campo_hierarquico_3,campo_hierarquico_4,campo_hierarquico_5',
        )
        .eq('ativo', true)
        .not('codigo_interno', 'is', null)
        .range(from, from + 999);
      if (error) throw error;
      if (!data?.length) break;
      for (const p of data) {
        const cod = String(p.codigo_interno ?? '').trim().toUpperCase();
        if (!cod || codigosNo4x3.has(cod)) continue;
        out.push({
          codigo_interno: cod,
          nome: String(p.nome ?? '').trim(),
          created_at: p.created_at ? String(p.created_at).slice(0, 10) : '',
          camp_hier_1: String(p.campo_hierarquico_1 ?? '').trim(),
          camp_hier_2: String(p.campo_hierarquico_2 ?? '').trim(),
          camp_hier_3: String(p.campo_hierarquico_3 ?? '').trim(),
          camp_hier_4: String(p.campo_hierarquico_4 ?? '').trim(),
          camp_hier_5: String(p.campo_hierarquico_5 ?? '').trim(),
          situacao: 'Cadastro activo — sem linha no P38-catalogo-4x3',
        });
      }
      if (data.length < 1000) break;
      from += 1000;
    }
    out.sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) ||
        a.codigo_interno.localeCompare(b.codigo_interno, 'pt-BR'),
    );
    return out;
  } catch (e) {
    console.warn('[turbocharger:v2] Cadastro live:', e.message);
    return [];
  }
}