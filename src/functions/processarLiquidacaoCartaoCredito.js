import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';
import { invokeFunction } from './_invokeHelper';

/**
 * Liquida vendas em cartão (débito/crédito) cuja data prevista chegou.
 * Supabase: RPC `job_liquidar_cartao_credito` (pg_cron diário + disparo manual).
 * Legado Base44: Edge `processarLiquidacaoCartaoCredito`.
 */
export async function processarLiquidacaoCartaoCredito(body = {}) {
  if (isSupabaseBrowserConfigured()) {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const { data, error } = await supabase.rpc('job_liquidar_cartao_credito');
      if (!error && data) {
        return { data };
      }
      if (data?.error) {
        throw new Error(String(data.error));
      }
      if (error) {
        console.warn('[P38] job_liquidar_cartao_credito RPC:', error.message);
      }
    }
  }

  return invokeFunction('processarLiquidacaoCartaoCredito', body);
}
