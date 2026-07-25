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
import { resolveSupabaseDeployEnv } from './supabase-env.mjs';

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

    const deployArgs = [
      '--yes',
      'supabase@latest',
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

    const result = spawnSync('npx', deployArgs, {
        cwd: root,
        env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
        encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (result.status !== 0) {
      console.log('FALHOU');
      const errText = (result.stderr || result.stdout || '').trim();
      throw new Error(`Deploy ${name} falhou: ${errText.slice(0, 800)}`);
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
