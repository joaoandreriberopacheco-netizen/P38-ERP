import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

export const PULSE_PORT = Number(process.env.PULSE_PORT || process.env.SMOKE_PORT || 3099);
export const PULSE_BASE = `http://127.0.0.1:${PULSE_PORT}`;

export function supabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co',
    key:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ci1wbGFjZWhvbGRlcg',
  };
}

/** Env para pré-deploy: bypass auth local — páginas abrem sem login real. */
export function pulseEnv({ bypassAuth = false } = {}) {
  const supa = supabaseEnv();
  const env = {
    ...process.env,
    PORT: String(PULSE_PORT),
    NEXT_PUBLIC_P38_PROVIDER: process.env.NEXT_PUBLIC_P38_PROVIDER || 'supabase',
    NEXT_PUBLIC_SUPABASE_URL: supa.url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supa.key,
    VITE_P38_PROVIDER: process.env.VITE_P38_PROVIDER || 'supabase',
    VITE_SUPABASE_URL: supa.url,
    VITE_SUPABASE_ANON_KEY: supa.key,
  };
  if (bypassAuth) {
    env.NEXT_PUBLIC_P38_USE_SUPABASE_AUTH = 'false';
    env.VITE_P38_USE_SUPABASE_AUTH = 'false';
    env.NEXT_PUBLIC_P38_BYPASS_BASE44 = 'true';
    env.VITE_P38_BYPASS_BASE44 = 'true';
  }
  return env;
}

export async function waitForServer(maxMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${PULSE_BASE}/login`, { redirect: 'manual' });
      if (res.status < 500) return true;
    } catch {
      // server still booting
    }
    await sleep(500);
  }
  return false;
}

export async function killPulsePort() {
  try {
    const { execSync } = await import('child_process');
    execSync(`fuser -k ${PULSE_PORT}/tcp 2>/dev/null || true`, { stdio: 'ignore' });
    execSync('pkill -9 -f "next-server" 2>/dev/null || true', { stdio: 'ignore' });
    execSync(`pkill -9 -f "next start --port ${PULSE_PORT}" 2>/dev/null || true`, { stdio: 'ignore' });
    await sleep(600);
  } catch {
    // ignore
  }
}

export async function startPulseServer({ bypassAuth = false } = {}) {
  await killPulsePort();
  const child = spawn('npx', ['next', 'start', '--port', String(PULSE_PORT)], {
    cwd: process.cwd(),
    env: pulseEnv({ bypassAuth }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ready = await waitForServer();
  if (!ready) {
    child.kill('SIGKILL');
    throw new Error('next start não respondeu a tempo');
  }
  return child;
}

export async function stopPulseServer(child) {
  if (child) {
    child.kill('SIGTERM');
    await sleep(300);
    if (!child.killed) child.kill('SIGKILL');
  }
  await killPulsePort();
}
