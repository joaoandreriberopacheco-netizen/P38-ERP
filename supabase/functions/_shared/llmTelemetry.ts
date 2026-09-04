import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type LlmUsage = {
  provider: 'gemini' | 'openai';
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
};

export type LlmTelemetryContext = {
  source?: string;
  catalog_product_count?: number;
  file_count?: number;
  prompt_chars?: number;
};

export type LlmTelemetryRow = LlmTelemetryContext & {
  usuario_id?: string | null;
  duration_ms?: number;
  success: boolean;
  error_message?: string | null;
} & LlmUsage;

/** USD por 1M tokens — ordem de grandeza Gemini 2.0 Flash / GPT-4o-mini. */
function estimateCostUsd(usage: LlmUsage): number {
  const inM = usage.input_tokens / 1_000_000;
  const outM = usage.output_tokens / 1_000_000;
  if (usage.provider === 'gemini') {
    return inM * 0.1 + outM * 0.4;
  }
  return inM * 0.15 + outM * 0.6;
}

export async function logLlmTelemetry(
  client: SupabaseClient,
  row: Partial<LlmTelemetryRow> & { success: boolean },
): Promise<void> {
  const usage: LlmUsage = {
    provider: row.provider || 'gemini',
    model: row.model || '',
    input_tokens: row.input_tokens ?? 0,
    output_tokens: row.output_tokens ?? 0,
    total_tokens: row.total_tokens ?? (row.input_tokens ?? 0) + (row.output_tokens ?? 0),
  };

  const payload = {
    usuario_id: row.usuario_id ?? null,
    source: row.source || 'invoke_llm',
    provider: usage.provider,
    model: usage.model,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    total_tokens: usage.total_tokens,
    prompt_chars: row.prompt_chars ?? 0,
    catalog_product_count: row.catalog_product_count ?? 0,
    file_count: row.file_count ?? 0,
    duration_ms: row.duration_ms ?? null,
    success: row.success,
    error_message: row.error_message ?? null,
    cost_estimate_usd: row.success ? estimateCostUsd(usage) : 0,
  };

  const { error } = await client.from('p38_llm_telemetry').insert(payload);
  if (error) {
    console.warn('[P38][llmTelemetry] insert falhou:', error.message);
  }
}
