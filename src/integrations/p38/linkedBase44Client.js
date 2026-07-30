import { isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';
import { isP38Dev, p38PublicEnv } from '@/lib/p38PublicEnv';
import { createLegacyClientWithoutSupabaseEnv, createSupabaseLegacyClient } from './supabaseAdapter';
import { getP38Providers, hasBase44Credentials, resolveP38ProviderName } from './providers';

/**
 * Devolve o client legado exposto como `p38.legacyClient` (alias `base44`).
 *
 * Dois ecossistemas separados (sem modo híbrido Base44+Postgres):
 * - **Casa nova:** `VITE_P38_PROVIDER=supabase` → cliente só Supabase (`createSupabaseLegacyClient`).
 * - **P38 Base44:** qualquer outro ramo com SDK → `base44SdkClient` (dados na DB Base44).
 *
 * `VITE_USE_SUPABASE_ENTITIES` deixou de ter efeito — evitar ruído entre dois destinos de dados.
 */
export function resolveLegacyClient(base44SdkClient) {
  const providers = getP38Providers();
  const providerName = resolveP38ProviderName();

  if (providerName === providers.SUPABASE) {
    if (!isSupabaseBrowserConfigured()) {
      console.warn(
        '[P38] VITE_P38_PROVIDER=supabase mas VITE_SUPABASE_URL/ANON_KEY ausentes — ' +
          'usando bypass local (sem dados reais). Preenche legacy/varejosync/.env.local e reinicia npm run dev.'
      );
      return createLegacyClientWithoutSupabaseEnv();
    }
    return createSupabaseLegacyClient();
  }

  if (providerName === providers.BASE44 && !hasBase44Credentials()) {
    console.warn(
      '[P38] Nenhum provider explícito / sem credenciais Base44 — shell local com bypass. ' +
        'Para dados reais: adiciona legacy/varejosync/.env.local (VITE_SUPABASE_*) e/ou VITE_P38_PROVIDER=supabase.'
    );
    return createLegacyClientWithoutSupabaseEnv();
  }

  if (
    isP38Dev() &&
    String(p38PublicEnv('VITE_USE_SUPABASE_ENTITIES') || '').toLowerCase().trim() === 'true'
  ) {
    console.warn(
      '[P38] VITE_USE_SUPABASE_ENTITIES ignorado: modo híbrido foi removido. ' +
        'Base44 → só SDK (DB Base44). Casa nova → VITE_P38_PROVIDER=supabase.'
    );
  }

  return base44SdkClient;
}
