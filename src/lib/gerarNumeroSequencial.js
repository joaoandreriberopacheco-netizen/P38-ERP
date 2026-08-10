import { base44 } from '@/api/base44Client';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';

function extractNumero(response) {
  if (!response) return null;
  if (typeof response === 'string') return response;
  return response?.numero ?? response?.data?.numero ?? null;
}

/**
 * Gera código único (ex.: ABC-123) para documentos P38.
 * Supabase: RPC `gerar_numero_sequencial` (sem depender de Edge Function).
 * Legado Base44: `gerarNumeroSequencial` via functions.invoke.
 */
export async function gerarNumeroSequencial(tipo) {
  if (!tipo) {
    throw new Error('Tipo de sequência obrigatório.');
  }

  if (isSupabaseBrowserConfigured()) {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const { data, error } = await supabase.rpc('gerar_numero_sequencial', { p_tipo: tipo });
      if (!error && data?.numero) {
        return String(data.numero);
      }
      if (data?.error) {
        throw new Error(String(data.error));
      }
      if (error) {
        console.warn('[P38] gerar_numero_sequencial RPC:', error.message);
      }
    }
  }

  try {
    const response = await base44.functions.invoke('gerarNumeroSequencial', { tipo });
    const numero = extractNumero(response);
    if (numero) return String(numero);
  } catch (err) {
    const msg = String(err?.message || err || '');
    const edgeUnavailable = /edge function|functionshttp|not\.found|404|não foi migrada/i.test(msg);
    if (!edgeUnavailable) {
      throw err;
    }
    console.warn('[P38] gerarNumeroSequencial edge indisponível, usando fallback:', msg);
  }

  return `${tipo}-${Date.now()}`;
}
