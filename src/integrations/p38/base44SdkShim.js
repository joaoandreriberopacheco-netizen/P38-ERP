/** Shim de build Next (produção Supabase) — scripts legados usam o SDK real via devDependency. */
export function createClient() {
  throw new Error('[P38] @base44/sdk não disponível no bundle de produção Supabase.');
}

export function getAccessToken() {
  return null;
}
