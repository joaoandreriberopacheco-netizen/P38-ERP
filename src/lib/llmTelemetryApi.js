import { getSupabaseBrowserClient } from '@/lib/supabaseBrowserClient';

/**
 * Resumo de telemetria LLM (RPC p38_llm_telemetry_resumo).
 * @param {number} [dias=30]
 */
export async function fetchLlmTelemetryResumo(dias = 30) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error('Supabase não configurado.');
  }
  const { data, error } = await supabase.rpc('p38_llm_telemetry_resumo', {
    p_dias: dias,
  });
  if (error) throw new Error(error.message);
  return data;
}
