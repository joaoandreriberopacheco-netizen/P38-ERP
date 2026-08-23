#!/usr/bin/env node
/**
 * Pulso — testador automático código → interface.
 * Metáfora: envia um pulso por cada rota; LEDs 1–8; verde no fim = OK.
 *
 * Uso:
 *   npm run pulse                  # lote1, modo rápido (LEDs 1–4)
 *   npm run pulse:slow             # lote1, modo lento (LEDs 1–8)
 *   node scripts/pulse.mjs --route /Compras
 *   node scripts/pulse.mjs --batch lote1 --slow
 */
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { setTimeout as sleep } from 'timers/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PORT = Number(process.env.PULSE_PORT || process.env.SMOKE_PORT || 3099);
const BASE = `http://127.0.0.1:${PORT}`;

const LEDS = [
  { id: 1, key: 'build', label: 'Compila' },
  { id: 2, key: 'imports', label: 'Imports' },
  { id: 3, key: 'route', label: 'Rota' },
  { id: 4, key: 'bundle', label: 'Bundle' },
  { id: 5, key: 'data', label: 'Dados' },
  { id: 6, key: 'render', label: 'Render' },
  { id: 7, key: 'interaction', label: 'Interação' },
  { id: 8, key: 'console', label: 'Console' },
];

const CRASH_PATTERNS = [
  /Application error: a client-side exception has occurred/i,
  /Internal Server Error/i,
  /Unhandled Runtime Error/i,
  /Hydration failed/i,
  /Minified React error/i,
  /"page"\s*:\s*"\/_error"/i,
];

const CONSOLE_PATTERNS = [
  /hydration/i,
  /chunkloaderror/i,
  /failed to fetch dynamically imported module/i,
];

const INTERACTION_PATTERN = /<(?:button|a\s+[^>]*href|input|select|textarea|form)\b/i;

function parseArgs(argv) {
  const args = { slow: false, batch: 'lote1', routes: [], skipServer: false, noServer: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--slow' || arg === '-s') args.slow = true;
    else if (arg === '--fast' || arg === '-f') args.slow = false;
    else if (arg === '--skip-server') args.skipServer = true;
    else if (arg === '--no-server') args.noServer = true;
    else if (arg === '--batch' && argv[i + 1]) {
      args.batch = argv[++i];
    } else if ((arg === '--route' || arg === '-r') && argv[i + 1]) {
      args.routes.push(argv[++i]);
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Uso: node scripts/pulse.mjs [opções]

Opções:
  --fast, -f          Modo rápido — LEDs 1–4 (default)
  --slow, -s          Modo lento — LEDs 1–8
  --batch <nome>      Lote do manifesto (default: lote1)
  --route, -r <path>  Testar uma rota específica
  --skip-server       Servidor já a correr em PULSE_PORT
  --no-server         Só LEDs 1–3 (sem HTTP)
  --help, -h          Esta ajuda
`);
}

function loadPageNames() {
  const file = path.join(ROOT, 'src/lib/p38PageNames.generated.js');
  if (!fs.existsSync(file)) {
    throw new Error('pageRegistry não gerado — corra npm run build ou generate-next-page-registry');
  }
  const content = fs.readFileSync(file, 'utf8');
  const match = content.match(/P38_PAGE_NAMES\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) throw new Error('Não foi possível ler P38_PAGE_NAMES');
  return JSON.parse(match[1]);
}

function loadBatchRoutes(batch) {
  const file = path.join(ROOT, 'docs/pulse', `routes-${batch}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Manifesto não encontrado: docs/pulse/routes-${batch}.json`);
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return data.routes;
}

function routeFromPath(routePath, pageNames) {
  if (routePath === '/' || routePath === '') {
    return { path: '/', label: 'Home', public: false, pageName: 'Home' };
  }
  const name = routePath.replace(/^\//, '');
  if (!name || name.includes('/')) {
    return { path: routePath, label: routePath, public: true, pageName: null };
  }
  if (pageNames.includes(name)) {
    return { path: `/${name}`, label: name, public: false, pageName: name };
  }
  return { path: routePath, label: routePath, public: true, pageName: null };
}

function ledResult(ok, detail = '') {
  return { ok, detail, skipped: false };
}

function ledSkipped(reason = 'N/A') {
  return { ok: true, detail: reason, skipped: true };
}

function checkBuild() {
  const nextDir = path.join(ROOT, '.next');
  if (!fs.existsSync(nextDir)) {
    return ledResult(false, '.next não encontrado — corra npm run build');
  }
  const buildId = path.join(nextDir, 'BUILD_ID');
  if (!fs.existsSync(buildId)) {
    return ledResult(false, 'BUILD_ID em falta — build incompleto');
  }
  return ledResult(true);
}

function checkImports(route) {
  if (!route.pageName) return ledSkipped('rota estática');
  const pageFile = path.join(ROOT, 'src/pages', `${route.pageName}.jsx`);
  if (!fs.existsSync(pageFile)) {
    return ledResult(false, `ficheiro em falta: src/pages/${route.pageName}.jsx`);
  }
  const content = fs.readFileSync(pageFile, 'utf8');
  const hasDefaultExport =
    /export\s+default\b/.test(content) || /export\s*\{\s*default\b/.test(content);
  if (!hasDefaultExport) {
    return ledResult(false, 'sem export default');
  }
  return ledResult(true);
}

function checkRouteRegistry(route, pageNames) {
  if (!route.pageName) return ledSkipped('rota estática');
  if (!pageNames.includes(route.pageName)) {
    return ledResult(false, `${route.pageName} não está em P38_PAGE_NAMES`);
  }
  return ledResult(true);
}

async function fetchRoute(routePath) {
  const res = await fetch(`${BASE}${routePath}`, { redirect: 'manual' });
  const text = await res.text();
  return { status: res.status, text, headers: res.headers };
}

function checkBundle(http) {
  if (http.status >= 500) {
    return ledResult(false, `HTTP ${http.status}`);
  }
  if (http.status === 404) {
    return ledResult(false, 'HTTP 404');
  }
  if (!http.text || http.text.length < 50) {
    return ledResult(false, 'resposta vazia ou demasiado curta');
  }
  return ledResult(true, `HTTP ${http.status}`);
}

function supabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co',
    key:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ci1wbGFjZWhvbGRlcg',
  };
}

function checkData(http) {
  const { url, key } = supabaseEnv();
  if (!url || !key) {
    return ledResult(false, 'variáveis Supabase em falta');
  }
  if (/invalid supabase/i.test(http.text)) {
    return ledResult(false, 'erro de configuração Supabase no HTML');
  }
  return ledResult(true);
}

function checkRender(http) {
  for (const pattern of CRASH_PATTERNS) {
    if (pattern.test(http.text)) {
      return ledResult(false, `padrão de crash: ${pattern.source}`);
    }
  }
  return ledResult(true);
}

function checkInteraction(http) {
  if (!INTERACTION_PATTERN.test(http.text)) {
    return ledResult(false, 'nenhum elemento interativo encontrado no HTML');
  }
  return ledResult(true);
}

function checkConsole(http) {
  for (const pattern of CONSOLE_PATTERNS) {
    if (pattern.test(http.text)) {
      return ledResult(false, `padrão de erro: ${pattern.source}`);
    }
  }
  if (/"err"\s*:\s*\{/.test(http.text) && /__NEXT_DATA__/.test(http.text)) {
    return ledResult(false, 'erro embutido em __NEXT_DATA__');
  }
  return ledResult(true);
}

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

function pulseEnv() {
  const supa = supabaseEnv();
  return {
    ...process.env,
    PORT: String(PORT),
    NEXT_PUBLIC_P38_PROVIDER: process.env.NEXT_PUBLIC_P38_PROVIDER || 'supabase',
    NEXT_PUBLIC_SUPABASE_URL: supa.url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supa.key,
    VITE_P38_PROVIDER: process.env.VITE_P38_PROVIDER || 'supabase',
    VITE_SUPABASE_URL: supa.url,
    VITE_SUPABASE_ANON_KEY: supa.key,
  };
}

async function startServer() {
  const child = spawn('npx', ['next', 'start', '--port', String(PORT)], {
    cwd: ROOT,
    env: pulseEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ready = await waitForServer();
  if (!ready) {
    child.kill('SIGKILL');
    throw new Error('next start não respondeu a tempo');
  }
  return child;
}

async function stopServer(child) {
  if (!child) return;
  child.kill('SIGTERM');
  await sleep(300);
  if (!child.killed) child.kill('SIGKILL');
}

function formatLedLine(led, result) {
  const icon = result.skipped ? '⏭️' : result.ok ? '✅' : '❌';
  const suffix = result.detail ? `  ${result.detail}` : '';
  return `  LED ${led.id} ${led.label.padEnd(12)} ${icon}${suffix}`;
}

async function pulseRoute(route, { slow, pageNames, httpCache }) {
  const maxLed = slow ? 8 : 4;
  const results = {};
  let failedAt = null;

  console.log(`\nPULSE ${route.path}${route.label ? ` (${route.label})` : ''}`);

  for (const led of LEDS) {
    if (led.id > maxLed) break;

    if (failedAt) {
      results[led.key] = { ok: false, detail: 'não testado', skipped: true };
      console.log(formatLedLine(led, results[led.key]));
      continue;
    }

    let result;
    try {
      if (led.key === 'build') {
        result = checkBuild();
      } else if (led.key === 'imports') {
        result = checkImports(route);
      } else if (led.key === 'route') {
        result = checkRouteRegistry(route, pageNames);
      } else {
        if (!httpCache) {
          httpCache = await fetchRoute(route.path);
        }
        if (led.key === 'bundle') result = checkBundle(httpCache);
        else if (led.key === 'data') result = checkData(httpCache);
        else if (led.key === 'render') result = checkRender(httpCache);
        else if (led.key === 'interaction') result = checkInteraction(httpCache);
        else if (led.key === 'console') result = checkConsole(httpCache);
      }
    } catch (err) {
      result = ledResult(false, err.message);
    }

    results[led.key] = result;
    console.log(formatLedLine(led, result));

    if (!result.ok && !result.skipped) {
      failedAt = led.id;
    }
  }

  const green = !failedAt;
  console.log(`  VERDE                ${green ? '🟢' : '❌'}${failedAt ? `  parou no LED ${failedAt}` : ''}`);

  return { route: route.path, green, failedAt, results };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const pageNames = loadPageNames();
  let routes;
  if (args.routes.length > 0) {
    routes = args.routes.map((p) => routeFromPath(p, pageNames));
  } else {
    routes = loadBatchRoutes(args.batch);
  }

  const needsHttp = !args.noServer && (args.slow || true);
  let server = null;

  console.log(`[pulse] modo ${args.slow ? 'lento (LEDs 1–8)' : 'rápido (LEDs 1–4)'} — ${routes.length} rota(s)`);

  try {
    if (needsHttp && !args.skipServer) {
      console.log(`[pulse] A subir next start na porta ${PORT}…`);
      server = await startServer();
    }

    const summary = [];
    for (const route of routes) {
      let httpCache = null;
      if (needsHttp && !args.noServer) {
        try {
          httpCache = await fetchRoute(route.path);
        } catch (err) {
          httpCache = { status: 0, text: '', error: err.message };
        }
      }
      const result = await pulseRoute(route, {
        slow: args.slow,
        pageNames,
        httpCache: httpCache?.error ? { status: 503, text: httpCache.error } : httpCache,
      });
      summary.push(result);
    }

    const passed = summary.filter((s) => s.green).length;
    const failed = summary.length - passed;

    console.log(`\n[pulse] Resumo: ${passed}/${summary.length} rotas com VERDE 🟢`);
    if (failed > 0) {
      const bad = summary.filter((s) => !s.green).map((s) => s.route);
      console.error(`[pulse] Falharam: ${bad.join(', ')}`);
      process.exit(1);
    }
  } finally {
    await stopServer(server);
  }
}

main().catch((err) => {
  console.error('[pulse]', err.message);
  process.exit(1);
});
