/**
 * Normaliza resposta do InvokeLLM (Base44, p38-core Edge, string JSON).
 */
export function normalizeInvokeLlmJsonResponse(aiRes) {
  if (aiRes == null) return null;
  if (typeof aiRes === 'string') {
    try {
      return JSON.parse(aiRes);
    } catch {
      return null;
    }
  }
  if (typeof aiRes !== 'object') return null;
  if (aiRes.response_json && typeof aiRes.response_json === 'object') return aiRes.response_json;
  if (aiRes.response && typeof aiRes.response === 'object') return aiRes.response;
  if (aiRes.data && typeof aiRes.data === 'object') return aiRes.data;
  if (aiRes.result) {
    if (typeof aiRes.result === 'object') return aiRes.result;
    if (typeof aiRes.result === 'string') {
      try {
        return JSON.parse(aiRes.result);
      } catch {
        return null;
      }
    }
  }
  return aiRes;
}

export function describeInvokeLlmError(error) {
  const msg = String(error?.message || error || '');
  if (/failed to send a request to the Edge Function|FunctionsFetchError|Failed to fetch/i.test(msg)) {
    return 'Não foi possível contactar a Edge Function p38-core no Supabase. '
      + 'Confirme que a função está publicada (npm run supabase:deploy:functions) '
      + 'e que OPENAI_API_KEY está nos secrets do projecto. '
      + 'Pode usar "Migrar por regras" enquanto isso.';
  }
  if (/OPENAI_API_KEY/i.test(msg)) {
    return 'OPENAI_API_KEY não configurada na Edge Function p38-core (Dashboard Supabase → Edge Functions → Secrets).';
  }
  if (/não autenticado|unauthorized|401/i.test(msg)) {
    return 'Sessão expirada. Saia e entre novamente.';
  }
  return msg || 'Erro ao chamar IA';
}
