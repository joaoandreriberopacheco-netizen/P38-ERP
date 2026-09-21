/**
 * IA paga (Gemini) desativada por defeito — evita custos inesperados.
 * Reative só com VITE_P38_LLM_ENABLED=true e GEMINI_API_KEY no servidor.
 */

export function isLlmHabilitado() {
  const flag = String(import.meta.env?.VITE_P38_LLM_ENABLED || '').toLowerCase().trim();
  return flag === '1' || flag === 'true' || flag === 'yes';
}

export function assertLlmHabilitado(contexto = 'esta função') {
  if (isLlmHabilitado()) return;
  throw new Error(
    `Leitura com IA desativada (${contexto}). O P38 usa OCR local gratuito nos importadores. ` +
    'Para reativar Gemini, defina VITE_P38_LLM_ENABLED=true e GEMINI_API_KEY no Supabase.',
  );
}
