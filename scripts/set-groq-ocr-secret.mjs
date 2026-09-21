#!/usr/bin/env node
/**
 * Grava GROQ_API_KEY nos secrets das Edge Functions (Supabase).
 *
 * Uso:
 *   GROQ_API_KEY=gsk_… npm run groq:set-secret
 *
 * Requer: SUPABASE_ACCESS_TOKEN + project ref (VITE_SUPABASE_URL ou DATABASE_URL)
 */
import { spawnSync } from 'node:child_process';
import { resolveSupabaseDeployEnv } from './supabase-env.mjs';

const groqKey = String(process.env.GROQ_API_KEY || '').trim();
const { accessToken, projectRef } = resolveSupabaseDeployEnv();

if (!groqKey) {
  console.error('[groq:set-secret] GROQ_API_KEY em falta.');
  console.error('  → Crie em https://console.groq.com/keys e exporte GROQ_API_KEY=gsk_…');
  process.exit(1);
}
if (!accessToken) {
  console.error('[groq:set-secret] SUPABASE_ACCESS_TOKEN em falta.');
  process.exit(1);
}
if (!projectRef) {
  console.error('[groq:set-secret] PROJECT_REF em falta (VITE_SUPABASE_URL ou SUPABASE_PROJECT_REF).');
  process.exit(1);
}

const model = String(process.env.GROQ_OCR_MODEL || 'llama-3.3-70b-versatile').trim();
const args = [
  '--yes',
  'supabase@latest',
  'secrets',
  'set',
  `GROQ_API_KEY=${groqKey}`,
  `GROQ_OCR_MODEL=${model}`,
  '--project-ref',
  projectRef,
];

const result = spawnSync('npx', args, {
  env: { ...process.env, SUPABASE_ACCESS_TOKEN: accessToken },
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

if (result.status !== 0) {
  const err = (result.stderr || result.stdout || '').trim();
  console.error('[groq:set-secret] Falhou:', err.slice(0, 600));
  process.exit(1);
}

console.log(`[groq:set-secret] GROQ_API_KEY + GROQ_OCR_MODEL=${model} gravados em ${projectRef}.`);
console.log('[groq:set-secret] Edge Functions já em execução passam a usar o fallback OCR (passo ③).');
