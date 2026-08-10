#!/usr/bin/env node
/**
 * Smoke HTTP — rotas públicas após `next build`.
 * CI: corre depois do build; sobe `next start` temporariamente.
 */
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

const PORT = Number(process.env.SMOKE_PORT || 3099);
const BASE = `http://127.0.0.1:${PORT}`;
const ROUTES = ['/login', '/landing.html', '/lab.html'];

async function waitForServer(maxMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${BASE}/login`, { redirect: 'manual' });
      if (res.status < 500) return true;
    } catch {
      // server still booting
    }
    await sleep(500);
  }
  return false;
}

async function checkRoute(path) {
  const res = await fetch(`${BASE}${path}`, { redirect: 'manual' });
  if (res.status >= 400) {
    throw new Error(`${path} → HTTP ${res.status}`);
  }
  const text = await res.text();
  if (text.length < 50) {
    throw new Error(`${path} → resposta vazia ou demasiado curta`);
  }
  console.log(`[smoke:http] OK ${path} (${res.status})`);
}

async function main() {
  const env = {
    ...process.env,
    PORT: String(PORT),
    NEXT_PUBLIC_P38_PROVIDER: process.env.NEXT_PUBLIC_P38_PROVIDER || 'supabase',
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ci1wbGFjZWhvbGRlcg',
  };

  const child = spawn('npx', ['next', 'start', '--port', String(PORT)], {
    cwd: process.cwd(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let failed = false;
  try {
    const ready = await waitForServer();
    if (!ready) throw new Error('next start não respondeu a tempo');

    for (const route of ROUTES) {
      await checkRoute(route);
    }
    console.log('[smoke:http] Todas as rotas OK');
  } catch (err) {
    failed = true;
    console.error('[smoke:http]', err.message);
  } finally {
    child.kill('SIGTERM');
    await sleep(300);
    if (!child.killed) child.kill('SIGKILL');
  }

  process.exit(failed ? 1 : 0);
}

main();
