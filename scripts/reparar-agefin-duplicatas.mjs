#!/usr/bin/env node
/**
 * Repara filhos duplicados do planejamento na competência (mantém a editada no mês).
 *
 *   npx vite-node --config legacy/vite/vite.config.js scripts/reparar-agefin-duplicatas.mjs --competencia=2026-10
 *   npx vite-node --config legacy/vite/vite.config.js scripts/reparar-agefin-duplicatas.mjs --competencia=2026-10 --apply
 */
import { loadDotEnvFiles } from './base44-env.mjs';
import { loadP38SecretsBundle } from './load-p38-secrets-bundle.mjs';
import { resolveP38Secrets, P38_CANONICAL_PROJECT_REF } from './p38-secrets.mjs';
import { requireP38SupabaseScriptClient, asP38LegacyClient } from './p38-supabase-script-client.mjs';

const apply = process.argv.includes('--apply');
const competencia =
  (process.argv.find((a) => a.startsWith('--competencia=')) || '').slice(14).trim() || '2026-10';

loadDotEnvFiles();
loadP38SecretsBundle();
const secrets = resolveP38Secrets();
const url =
  secrets.supabaseUrl ||
  (secrets.projectRef || P38_CANONICAL_PROJECT_REF
    ? `https://${secrets.projectRef || P38_CANONICAL_PROJECT_REF}.supabase.co`
    : '');

if (url) {
  process.env.VITE_P38_PROVIDER = 'supabase';
  process.env.VITE_SUPABASE_URL = url;
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
}

const legacy = asP38LegacyClient(requireP38SupabaseScriptClient());
const { base44 } = await import('../src/api/base44Client.js');
Object.assign(base44.entities, legacy.entities);
if (legacy.functions) base44.functions = legacy.functions;

const { repararFilhosDuplicadosCompetenciaPlanejamento } = await import(
  '../src/lib/agefinPrevisaoService.js'
);

console.log(`AGEFIN reparo | competência=${competencia} | apply=${apply}`);

if (!apply) {
  console.log('Dry-run: nada gravado. Adicione --apply para cancelar duplicatas (fica a editada no mês).');
  process.exit(0);
}

const result = await repararFilhosDuplicadosCompetenciaPlanejamento(competencia);
console.log(JSON.stringify(result, null, 2));
console.log('Concluído. Atualize a AGEFIN (F5) em outubro/2026.');
