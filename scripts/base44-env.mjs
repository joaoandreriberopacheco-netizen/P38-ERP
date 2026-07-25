/**
 * Carrega `.env` / `.env.local` e cria cliente Base44 para scripts Node.
 * Usado por flare:*, audit:fluxo-dia, etc.
 */
import { createClient } from '@base44/sdk';
import { loadP38SecretsBundle } from './load-p38-secrets-bundle.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '..');

let dotenvLoaded = false;

/** Preenche `process.env` a partir de `.env` e `.env.local`. */
export function loadDotEnvFiles() {
  if (dotenvLoaded) return;
  dotenvLoaded = true;
  for (const name of ['.env', '.env.local']) {
    const filePath = path.join(REPO_ROOT, name);
    if (!fs.existsSync(filePath)) continue;
    const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    for (let line of text.split(/\r?\n/)) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;
      if (/^export\s+/i.test(line)) line = line.replace(/^export\s+/i, '').trim();
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      val = val.replace(/\\n/g, '\n');
      process.env[key] = val;
    }
  }
  // Ficheiro mestre João (secrets/p38-chaves.txt) — prioridade sobre painel Cursor
  loadP38SecretsBundle();
}

export function getBase44Env() {
  loadDotEnvFiles();
  const appId = process.env.VITE_BASE44_APP_ID || process.env.BASE44_APP_ID || '';
  const serverUrl =
    process.env.VITE_BASE44_BACKEND_URL || process.env.BASE44_BACKEND_URL || 'https://base44.app';
  const token = (process.env.BASE44_ACCESS_TOKEN || process.env.ACCESS_TOKEN || '').trim();
  const apiKey = (process.env.BASE44_API_KEY || process.env.VITE_BASE44_API_KEY || '').trim();
  return { appId, serverUrl, token, apiKey };
}

export function tryBase44Client() {
  const { appId, serverUrl, token, apiKey } = getBase44Env();
  if (!appId || (!token && !apiKey)) return null;
  return createClient({
    appId,
    serverUrl,
    ...(token ? { token } : {}),
    ...(apiKey ? { headers: { api_key: apiKey } } : {}),
    requiresAuth: Boolean(token || apiKey),
  });
}

export function requireBase44Client() {
  const client = tryBase44Client();
  if (!client) {
    console.error(
      '[base44] Credenciais em falta. Defina no Cursor Cloud Agent (Secrets) ou em .env.local:\n' +
        '  VITE_BASE44_APP_ID\n' +
        '  VITE_BASE44_BACKEND_URL=https://p38.base44.app\n' +
        '  BASE44_ACCESS_TOKEN  (JWT do browser)  ou  BASE44_API_KEY\n' +
        'Ver docs/migration/BASE44_TO_SUPABASE_GITHUB.md e AGENTS.md.',
    );
    process.exit(1);
  }
  return client;
}
