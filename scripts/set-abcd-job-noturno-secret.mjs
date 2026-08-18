#!/usr/bin/env node
/**
 * Activa ABCD_JOB_NOTURNO=true nos secrets da Edge Function calcular-iep (Supabase).
 *
 * Uso: npm run abcd:enable-noturno
 * Requer: SUPABASE_ACCESS_TOKEN + VITE_SUPABASE_URL (ou SUPABASE_PROJECT_REF)
 */
import { spawnSync } from 'node:child_process';
import { resolveSupabaseDeployEnv } from './supabase-env.mjs';

const { accessToken, projectRef } = resolveSupabaseDeployEnv();

if (!accessToken) {
  console.error('[abcd:enable-noturno] SUPABASE_ACCESS_TOKEN em falta.');
  process.exit(1);
}
if (!projectRef) {
  console.error('[abcd:enable-noturno] PROJECT_REF em falta (VITE_SUPABASE_URL ou SUPABASE_PROJECT_REF).');
  process.exit(1);
}

const result = spawnSync(
  'npx',
  ['--yes', 'supabase@latest', 'secrets', 'set', 'ABCD_JOB_NOTURNO=true', '--project-ref', projectRef],
  {
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: accessToken },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

if (result.status !== 0) {
  const err = (result.stderr || result.stdout || '').trim();
  console.error('[abcd:enable-noturno] Falhou:', err.slice(0, 600));
  process.exit(1);
}

console.log(`[abcd:enable-noturno] ABCD_JOB_NOTURNO=true gravado no projecto ${projectRef}.`);
