#!/usr/bin/env node
/**
 * Deploy de todas as Edge Functions em supabase/functions/ (exceto _shared).
 *
 * Requer:
 *   SUPABASE_ACCESS_TOKEN — Personal Access Token (supabase.com/dashboard/account/tokens)
 *   SUPABASE_PROJECT_REF  — ref do projecto (URL https://[ref].supabase.co)
 *
 * Uso:
 *   npm run supabase:deploy:functions
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { resolveSupabaseDeployEnv } from './supabase-env.mjs';

/** CLI estável — evita surpresas de `latest` em CI (bundling API). */
const SUPABASE_CLI_PACKAGE = 'supabase@2.20.12';

const DEPLOY_MAX_ATTEMPTS = 3;
const DEPLOY_RETRY_DELAY_MS = 8000;

function formatDeployFailure(result) {
  const combined = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
  if (!combined) return '(sem output do CLI)';
  const max = 4000;
  if (combined.length <= max) return combined;
  return `…${combined.slice(-max)}`;
}

function deployOneFunction(name, projectRef, token) {
  const deployArgs = [
    '--yes',
    SUPABASE_CLI_PACKAGE,
    'functions',
    'deploy',
    name,
    '--project-ref',
    projectRef,
    '--use-api',
  ];
  if (functionSkipsJwtVerify(name)) {
    deployArgs.push('--no-verify-jwt');
  }

  return spawnSync('npx', deployArgs, {
    cwd: root,
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const functionsDir = path.join(root, 'supabase', 'functions');

function resolveProjectRef() {
  return resolveSupabaseDeployEnv().projectRef || null;
}

function listFunctionNames() {
  if (!fs.existsSync(functionsDir)) return [];
  return fs
    .readdirSync(functionsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== '_shared')
    .map((d) => d.name)
    .sort();
}

function functionSkipsJwtVerify(name) {
  const configPath = path.join(functionsDir, name, 'config.toml');
  if (!fs.existsSync(configPath)) return false;
  const text = fs.readFileSync(configPath, 'utf8');
  return /verify_jwt\s*=\s*false/i.test(text);
}

export async function deploySupabaseFunctions({ dryRun = false } = {}) {
  const { accessToken: token, projectRef } = resolveSupabaseDeployEnv();

  if (!token) {
    throw new Error(
      'SUPABASE_ACCESS_TOKEN é obrigatório (Dashboard → Account → Access Tokens). Aceita também SUPABASE_TOKEN ou secret "supabase" com valor sbp_…'
    );
  }
  if (!projectRef) {
    throw new Error(
      'PROJECT_REF em falta — define VITE_SUPABASE_URL, SUPABASE_PROJECT_REF ou DATABASE_URL com host Supabase.'
    );
  }

  const names = listFunctionNames();
  if (names.length === 0) {
    console.log('[supabase:deploy:functions] Nenhuma função em supabase/functions/.');
    return { deployed: [], projectRef };
  }

  console.log(`[supabase:deploy:functions] Projecto ${projectRef} — ${names.length} função(ões).`);

  const deployed = [];
  for (const name of names) {
    process.stdout.write(`  → ${name} … `);
    if (dryRun) {
      console.log('dry-run');
      deployed.push(name);
      continue;
    }

    let lastResult = null;
    for (let attempt = 1; attempt <= DEPLOY_MAX_ATTEMPTS; attempt += 1) {
      lastResult = deployOneFunction(name, projectRef, token);
      if (lastResult.status === 0) break;
      if (attempt < DEPLOY_MAX_ATTEMPTS) {
        console.log(`retry ${attempt}/${DEPLOY_MAX_ATTEMPTS - 1} …`);
        await sleep(DEPLOY_RETRY_DELAY_MS);
      }
    }

    if (lastResult.status !== 0) {
      console.log('FALHOU');
      throw new Error(`Deploy ${name} falhou: ${formatDeployFailure(lastResult)}`);
    }
    console.log('ok');
    deployed.push(name);
  }

  return { deployed, projectRef };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  try {
    const { deployed, projectRef } = await deploySupabaseFunctions({ dryRun });
    console.log(
      `[supabase:deploy:functions] Concluído (${projectRef}):`,
      deployed.join(', ')
    );
  } catch (err) {
    console.error('[supabase:deploy:functions]', err.message);
    process.exit(1);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}
