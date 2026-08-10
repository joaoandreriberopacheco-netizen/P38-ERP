import { p38PublicEnv } from '@/lib/p38PublicEnv';
import { createBase44Adapter } from './base44Adapter';
import { createSubpayzeAdapter } from './subpayzeAdapter';
import { createSupabaseAdapter } from './supabaseAdapter';
import { createRequestContext } from './requestContext';
import { resolveLegacyClient } from './linkedBase44Client';
import { wrapLegacyClientLancamentoFinanceiro } from '@/lib/lancamentoFinanceiroEntityHook';
import { createBase44StubClient } from './base44StubClient';
import {
  getP38Providers,
  hasBase44Credentials,
  hasSupabaseCredentials,
  isBase44BypassEnabled,
  isP38SafeModeEnabled,
  isSubpayzeReadyForTraffic,
  isSubpayzeRolloutEnabled,
  isSupabaseAuthEnabled,
  resolveP38ProviderName
} from './providers';

const providers = getP38Providers();
const providerName = resolveP38ProviderName();
const bypassBase44 = isBase44BypassEnabled();

const base44SdkClient = createBase44StubClient(
  providerName === providers.SUPABASE || bypassBase44
    ? 'produção Supabase (VITE_P38_PROVIDER=supabase)'
    : 'app Next não carrega SDK Base44 — use scripts/ ou legacy Vite se necessário',
);

/** Exportado como `base44` em `base44Client.js` — pode incluir datalink Supabase nas entidades mapeadas. */
const linkedLegacyClient = resolveLegacyClient(base44SdkClient);

const base44Adapter = createBase44Adapter(base44SdkClient);
const subpayzeAdapter = createSubpayzeAdapter({
  apiUrl: p38PublicEnv('VITE_SUBPAYZE_API_URL'),
  apiKey: p38PublicEnv('VITE_SUBPAYZE_API_KEY'),
  webhookSecret: p38PublicEnv('VITE_SUBPAYZE_WEBHOOK_SECRET')
});
const supabaseAdapter = createSupabaseAdapter();

const safeMode = isP38SafeModeEnabled();
const subpayzeRolloutEnabled = isSubpayzeRolloutEnabled();
const subpayzeReadyForTraffic = isSubpayzeReadyForTraffic();

const shouldUseSubpayze =
  providerName === providers.SUBPAYZE &&
  subpayzeRolloutEnabled &&
  subpayzeReadyForTraffic &&
  subpayzeAdapter.isConfigured;

const shouldUseSupabase =
  providerName === providers.SUPABASE &&
  (supabaseAdapter.isConfigured || bypassBase44);

const activeAdapter = shouldUseSupabase
  ? supabaseAdapter
  : shouldUseSubpayze
    ? subpayzeAdapter
    : base44Adapter;
// Com provider=supabase, o linkedLegacyClient já tem bypass auth ou cliente Supabase real.
// Não usar o stub Base44 quando shouldUseSupabase=false por env em falta no build.
const activeLegacyClient = wrapLegacyClientLancamentoFinanceiro(
  providerName === providers.SUPABASE
    ? linkedLegacyClient
    : activeAdapter.legacyClient || linkedLegacyClient,
);

function withSafeFallback(sectionName, candidateSection, fallbackSection) {
  if (!candidateSection) {
    return fallbackSection || {};
  }

  // Com provider Supabase (ou bypass Base44), nunca voltar ao stub Base44 — mascara o erro real
  // (ex.: PDV Caixa mostrava "Base44 indisponível" quando processar-venda-caixa falhava).
  if (providerName === providers.SUPABASE || bypassBase44) {
    return candidateSection;
  }

  if (!safeMode || !fallbackSection) {
    return candidateSection;
  }
  if (activeAdapter.name === providers.BASE44) {
    return candidateSection;
  }

  return new Proxy(candidateSection || {}, {
    get(target, propKey) {
      const value = target[propKey];
      if (typeof value !== 'function') {
        return value;
      }

      return async (...args) => {
        try {
          return await value(...args);
        } catch (error) {
          console.warn(`[P38] fallback para Base44 em ${sectionName}.${String(propKey)}`, error);
          const fallbackValue = fallbackSection?.[propKey];
          if (typeof fallbackValue === 'function') {
            return fallbackValue(...args);
          }
          throw error;
        }
      };
    }
  });
}

// Com provider=supabase, auth deve vir sempre do cliente Supabase (ou bypass local),
// nunca do stub Base44 — caso contrário auth.me() dispara "Base44 indisponível".
const p38Auth =
  providerName === providers.SUPABASE
    ? linkedLegacyClient.auth
    : withSafeFallback('auth', activeAdapter.auth, base44Adapter?.auth || activeLegacyClient?.auth);

export const p38 = {
  providerName: activeAdapter.name,
  providers,
  safeMode,
  bypassBase44,
  rollout: {
    subpayzeEnabled: subpayzeRolloutEnabled,
    subpayzeReadyForTraffic,
    supabaseConfigured: supabaseAdapter.isConfigured,
    supabaseAuth: isSupabaseAuthEnabled(),
    requestedProvider: providerName,
    usingSubpayze: shouldUseSubpayze,
    usingSupabase: shouldUseSupabase
  },
  adapter: activeAdapter,
  base44Fallback: base44Adapter,
  supabaseAdapter,
  createRequestContext,
  // Mantemos acesso ao client legado durante a fase de compatibilidade.
  legacyClient: activeLegacyClient,
  auth: p38Auth,
  entities: withSafeFallback('entities', activeAdapter.entities, base44Adapter?.entities || activeLegacyClient?.entities),
  functions: withSafeFallback('functions', activeAdapter.functions, base44Adapter?.functions || activeLegacyClient?.functions),
  integrations: withSafeFallback(
    'integrations',
    activeAdapter.integrations,
    base44Adapter?.integrations || activeLegacyClient?.integrations
  )
};

// Log de boot — fundamental para entender, em produção (Vercel), qual provider está ativo
// e por quê. Aparece UMA VEZ no console do navegador, no carregamento do app.
if (typeof window !== 'undefined') {
  const summary = {
    requestedProvider: providerName,
    activeProvider: activeAdapter.name,
    bypassBase44,
    base44Sdk: 'stub',
    base44Credentials: hasBase44Credentials(),
    supabaseCredentials: hasSupabaseCredentials(),
    supabaseAuth: isSupabaseAuthEnabled(),
    safeMode
  };
  if (activeAdapter.name === providers.SUPABASE) {
    console.info('[P38] boot OK — provider=supabase', summary);
  } else if (activeAdapter.name === providers.BASE44) {
    console.error(
      '[P38] boot CRÍTICO — Base44 sem credenciais no build nem em runtime. ' +
        'Gravações (senhas, despesas, lançamentos) vão falhar. ' +
        'No Vercel: defina VITE_BASE44_APP_ID, VITE_BASE44_BACKEND_URL e remova VITE_P38_PROVIDER=supabase.',
      summary
    );
  } else if (
    providerName === providers.BASE44 &&
    activeAdapter.name === providers.SUPABASE
  ) {
    console.error(
      '[P38] boot CRÍTICO — provider pedido=base44 mas adapter ativo=supabase. ' +
        'Corrija as variáveis de ambiente no Vercel.',
      summary
    );
  } else {
    console.info('[P38] boot — provider=' + activeAdapter.name, summary);
  }
}
