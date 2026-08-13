import { base44 } from '@/api/base44Client';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';

/** Mesmo charset do Base44/SQL (`_gerar_bloco_aleatorio`). Códigos: `XXX-XXX` alfanumérico. */
const SEQUENCIAL_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function gerarBlocoAleatorio(tamanho = 3) {
  const bytes = new Uint8Array(tamanho);
  crypto.getRandomValues(bytes);
  let resultado = '';
  for (let i = 0; i < tamanho; i++) {
    resultado += SEQUENCIAL_CHARSET[bytes[i] % SEQUENCIAL_CHARSET.length];
  }
  return resultado;
}

/** Ex.: `K7M-4N2` — usado em pedidos de compra, vendas, consumo interno, etc. */
function gerarCodigoAleatorioSequencial() {
  return `${gerarBlocoAleatorio(3)}-${gerarBlocoAleatorio(3)}`;
}

function extractNumero(response) {
  if (!response) return null;
  if (typeof response === 'string') return response;
  return response?.numero ?? response?.data?.numero ?? null;
}

/**
 * Gera código único alfanumérico (ex.: `K7M-4N2`) para documentos P38.
 * Embarques usam sufixo no pedido: `{numero}-A`, `{numero}-B`, …
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
    console.warn('[P38] gerarNumeroSequencial edge indisponível, usando fallback alfanumérico:', msg);
  }

  return gerarCodigoAleatorioSequencial();
}
