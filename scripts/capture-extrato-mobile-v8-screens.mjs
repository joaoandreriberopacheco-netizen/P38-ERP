#!/usr/bin/env node
/**
 * Capturas PNG do extrato mobile v8 (app real) — Playwright + pulse server.
 * Uso: PULSE_SKIP_BUILD=1 node scripts/capture-extrato-mobile-v8-screens.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium, devices } from 'playwright';
import { spawn, spawnSync } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

const CAPTURE_PORT = Number(process.env.CAPTURE_PORT || 3098);
const CAPTURE_BASE = `http://127.0.0.1:${CAPTURE_PORT}`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs/prototypes');
const VERSION = 'v8-app';

const SHOTS = [
  { file: `fluxo-caixa-extrato-${VERSION}-light-top.png`, theme: 'light', scroll: 0, filtros: false, fab: false },
  { file: `fluxo-caixa-extrato-${VERSION}-light-collapsed.png`, theme: 'light', scroll: 280, filtros: false, fab: false },
  { file: `fluxo-caixa-extrato-${VERSION}-dark-top.png`, theme: 'dark', scroll: 0, filtros: false, fab: false },
  { file: `fluxo-caixa-extrato-${VERSION}-dark-scrolled.png`, theme: 'dark', scroll: 320, filtros: false, fab: false },
  { file: `fluxo-caixa-extrato-${VERSION}-dark-filtros-open.png`, theme: 'dark', scroll: 0, filtros: true, fab: false },
  { file: `fluxo-caixa-extrato-${VERSION}-dark-fab-open.png`, theme: 'dark', scroll: 0, filtros: false, fab: true },
];

async function applyTheme(page, theme) {
  await page.evaluate((t) => {
    try {
      localStorage.setItem('theme', t);
    } catch {
      /* ignore */
    }
    document.documentElement.classList.toggle('dark', t === 'dark');
  }, theme);
  await page.waitForTimeout(400);
}

async function scrollExtratoList(page, scrollTop) {
  await page.evaluate((top) => {
    const candidates = Array.from(document.querySelectorAll('[class*="touch-pan-y"], [class*="overflow-y-auto"]'));
    const el = candidates.find((n) => n.scrollHeight > n.clientHeight + 40) || candidates[0];
    if (el) {
      el.scrollTop = top;
      el.dispatchEvent(new Event('scroll', { bubbles: true }));
    }
  }, scrollTop);
  await page.waitForTimeout(600);
}

function captureServerEnv() {
  const supabaseUrl = envGet('NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const supabaseAnon = envGet('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const env = { ...process.env, PORT: String(CAPTURE_PORT) };
  const nextPublic = {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnon,
    NEXT_PUBLIC_P38_PROVIDER: 'supabase',
    NEXT_PUBLIC_P38_USE_SUPABASE_AUTH: 'false',
    NEXT_PUBLIC_P38_BYPASS_BASE44: 'true',
    NEXT_PUBLIC_USE_SUPABASE_ENTITIES: 'true',
  };
  Object.assign(env, nextPublic);
  for (const [k, v] of Object.entries(nextPublic)) {
    if (k.startsWith('NEXT_PUBLIC_')) {
      const viteKey = k.replace(/^NEXT_PUBLIC_/, 'VITE_');
      env[viteKey] = v;
    }
  }
  return env;
}

function envGet(...keys) {
  for (const key of keys) {
    const v = process.env[key];
    if (v != null && String(v).trim() !== '') return v;
  }
  return '';
}

async function waitForServer() {
  const start = Date.now();
  while (Date.now() - start < 90000) {
    try {
      const res = await fetch(`${CAPTURE_BASE}/login`, { redirect: 'manual' });
      if (res.status < 500) return true;
    } catch {
      /* booting */
    }
    await sleep(500);
  }
  return false;
}

async function startCaptureServer() {
  if (process.env.CAPTURE_SKIP_BUILD !== '1') {
    const build = spawnSync('npm', ['run', 'build'], {
      cwd: ROOT,
      env: captureServerEnv(),
      stdio: 'inherit',
    });
    if (build.status !== 0) throw new Error('npm run build falhou');
  }
  const child = spawn('npx', ['next', 'start', `--port=${CAPTURE_PORT}`], {
    cwd: ROOT,
    env: captureServerEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ready = await waitForServer();
  if (!ready) {
    child.kill('SIGKILL');
    throw new Error('next start não respondeu');
  }
  return child;
}

async function openExtrato(page) {
  await page.goto(`${CAPTURE_BASE}/FluxoCaixa?aba=fluxo`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  const extrato = page.getByText('Extrato', { exact: true });
  await extrato.waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForTimeout(6000);
}

async function captureState(page, shot) {
  await scrollExtratoList(page, 0);
  if (shot.filtros) {
    const btn = page.getByRole('button', { name: /^Filtros$/i }).first();
    await btn.click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
  if (shot.scroll > 0) {
    await scrollExtratoList(page, shot.scroll);
  }
  if (shot.fab) {
    const fab = page.locator('[data-pulse-sensor="fluxo-caixa.fab"]');
    await fab.scrollIntoViewIfNeeded();
    await fab.click({ timeout: 20000, force: true });
    await page.waitForTimeout(700);
  }
  const outPath = path.join(OUT_DIR, shot.file);
  await page.screenshot({ path: outPath, type: 'png', fullPage: false });
  return outPath;
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = await startCaptureServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    locale: 'pt-BR',
  });
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'p38_bypass_user_v1',
        JSON.stringify({
          id: 'p38-bypass-user',
          email: 'admin@varejosync.local',
          full_name: 'Administrador (bypass)',
          role: 'admin',
          is_bypass: true,
        }),
      );
    } catch {
      /* ignore */
    }
  });
  const page = await context.newPage();
  const written = [];

  try {
    for (const shot of SHOTS) {
      await openExtrato(page);
      await applyTheme(page, shot.theme);
      const p = await captureState(page, shot);
      written.push(p);
      console.log(`[capture] ${shot.file}`);
    }
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }

  console.log(JSON.stringify({ outDir: OUT_DIR, files: written.map((p) => path.basename(p)) }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
