#!/usr/bin/env node
/**
 * Pulso — sensores UI (pré-deploy).
 * Verifica se o sinal chega a cada botão/ecrã crítico. Não é uma página do P38.
 *
 * Uso:
 *   npm run pulse:sensors
 *   node scripts/pulse-sensors.mjs --batch lote1
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  PULSE_BASE,
  startPulseServer,
  stopPulseServer,
} from './lib/pulse-runtime.mjs';
// Descomentar junto com o bloco refreshPulseRoteiro() em main():
// import { refreshPulseRoteiro } from './lib/pulse-refresh-roteiro.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT_OUT = path.join(ROOT, 'docs/pulse/sensors-report.json');

const ERROR_SELECTORS = [
  'text=Application error',
  'text=Unhandled Runtime Error',
  'text=Internal Server Error',
];

function parseArgs(argv) {
  const args = { batch: null, all: false, skipServer: false, writeReport: true };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--all' || arg === '-a') args.all = true;
    else if (arg === '--batch' && argv[i + 1]) args.batch = argv[++i];
    else if (arg === '--skip-server') args.skipServer = true;
    else if (arg === '--no-report') args.writeReport = false;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  if (!args.batch && !args.all) args.all = true;
  return args;
}

function loadSensors(batch) {
  const file = path.join(ROOT, 'docs/pulse', `sensors-${batch}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Manifesto não encontrado: docs/pulse/sensors-${batch}.json`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadAllSensorScreens() {
  const manifest = loadSensors('geral');
  return manifest.screens;
}

function sensorSelector(id) {
  return `[data-pulse-sensor="${id}"]`;
}

async function loadPlaywright() {
  try {
    const mod = await import('playwright');
    return mod.chromium;
  } catch {
    throw new Error(
      'Playwright não instalado. Corra: npm install && npx playwright install chromium'
    );
  }
}

async function assertNoCrash(page) {
  for (const sel of ERROR_SELECTORS) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) {
      throw new Error(`crash detectado: ${sel}`);
    }
  }
}

async function runPresence(page, sensor) {
  const loc = page.locator(sensorSelector(sensor.id)).first();
  const state = sensor.type === 'attached' || sensor.id.endsWith('.shell') ? 'attached' : 'visible';
  await loc.waitFor({ state, timeout: 20000 });
  if (state === 'visible') {
    const visible = await loc.isVisible();
    if (!visible) throw new Error('sensor não visível');
  }
}

async function runClick(page, sensor) {
  const loc = page.locator(sensorSelector(sensor.id)).first();
  await loc.waitFor({ state: 'visible', timeout: 15000 });
  await loc.click({ timeout: 5000 });
  await page.waitForTimeout(400);
  await assertNoCrash(page);
  if (sensor.expectVisible) {
    const expectLoc = page.locator(sensorSelector(sensor.expectVisible)).first();
    await expectLoc.waitFor({ state: 'visible', timeout: 5000 });
  }
}

async function pulseScreen(browser, screen) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (err) => consoleErrors.push(String(err.message || err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const results = [];
  let failedAt = null;

  console.log(`\nPULSE SENSORES ${screen.route} (${screen.label})`);

  try {
    try {
    await page.goto(`${PULSE_BASE}${screen.route}`, {
      waitUntil: 'networkidle',
      timeout: 45000,
    });
    if (screen.warmupMs) {
      await page.waitForTimeout(screen.warmupMs);
    }
    const firstSensor = screen.sensors.find((s) => s.type !== 'attached' && !s.id.endsWith('.shell'))
      || screen.sensors[0];
    if (firstSensor?.id) {
      const state = firstSensor.type === 'attached' || firstSensor.id.endsWith('.shell') ? 'attached' : 'visible';
      await page.locator(sensorSelector(firstSensor.id)).first().waitFor({
        state,
        timeout: 45000,
      });
    }
    await assertNoCrash(page);

    for (const sensor of screen.sensors) {
      if (failedAt) {
        console.log(`  SENSOR ${sensor.id.padEnd(28)} ⏭️  não testado`);
        results.push({ id: sensor.id, ok: false, skipped: true });
        continue;
      }

      try {
        if (sensor.type === 'presence' || sensor.type === 'attached') {
          await runPresence(page, sensor);
        } else if (sensor.type === 'click') {
          await runClick(page, sensor);
        } else {
          throw new Error(`tipo desconhecido: ${sensor.type}`);
        }
        console.log(`  SENSOR ${sensor.id.padEnd(28)} ✅  ${sensor.label}`);
        results.push({ id: sensor.id, ok: true });
      } catch (err) {
        failedAt = sensor.id;
        console.log(`  SENSOR ${sensor.id.padEnd(28)} ❌  ${err.message}`);
        results.push({ id: sensor.id, ok: false, error: err.message });
      }
    }

    const criticalConsole = consoleErrors.filter((e) => {
      if (/favicon|Failed to load resource|placeholder\.supabase|Failed to fetch|NetworkError|fetch failed/i.test(e)) {
        return false;
      }
      if (/câmera|camera|NotFoundError|getUserMedia|Requested device not found/i.test(e)) {
        return false;
      }
      return true;
    });
    if (!failedAt && criticalConsole.length > 0) {
      failedAt = 'console';
      console.log(`  SENSOR console                 ❌  ${criticalConsole[0]}`);
    }

    const green = !failedAt;
    console.log(`  VERDE                          ${green ? '🟢' : '❌'}${failedAt ? `  parou em ${failedAt}` : ''}`);
    return { route: screen.route, green, failedAt, results };
    } catch (err) {
      console.log(`  VERDE                          ❌  ${err.message}`);
      return { route: screen.route, green: false, failedAt: 'fatal', results, error: err.message };
    }
  } finally {
    await context.close();
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`Uso: node scripts/pulse-sensors.mjs [opções]

Opções:
  --all, -a           Todos os ecrãs (sensors-geral.json) — default
  --batch <nome>      Um lote (ex: lote1, geral)
  --skip-server       Servidor já a correr
`);
    process.exit(0);
  }

  // Refresh do roteiro antes do trem — desligado por defeito (corrida mais rápida).
  // Para job periódico (ex. cron/GitHub Actions scheduled): descomentar import +
  // bloco abaixo OU correr antes: npm run pulse:refresh-roteiro && npm run pulse:sensors
  //
  // refreshPulseRoteiro();

  const screens = args.all || args.batch === 'geral'
    ? loadAllSensorScreens()
    : loadSensors(args.batch || 'lote1').screens;
  const chromium = await loadPlaywright();
  let server = null;

  console.log(`[pulse:sensors] ${screens.length} ecrã(s)`);

  try {
    if (!args.skipServer) {
      console.log('[pulse:sensors] A subir next start (bypass auth para sensores)…');
      server = await startPulseServer({ bypassAuth: true });
    }

    const browser = await chromium.launch({ headless: true });
    const summary = [];

    try {
      for (const screen of screens) {
        summary.push(await pulseScreen(browser, screen));
      }
    } finally {
      await browser.close();
    }

    const passed = summary.filter((s) => s.green).length;
    console.log(`\n[pulse:sensors] Resumo: ${passed}/${summary.length} ecrãs com VERDE 🟢`);

    const report = {
      collectedAt: new Date().toISOString(),
      passed,
      total: summary.length,
      screens: summary,
    };
    if (args.writeReport) {
      fs.writeFileSync(REPORT_OUT, `${JSON.stringify(report, null, 2)}\n`);
      console.log(`[pulse:sensors] Relatório → ${REPORT_OUT}`);
    }

    if (passed < summary.length) {
      const bad = summary.filter((s) => !s.green).map((s) => s.route);
      console.error(`[pulse:sensors] Falharam: ${bad.join(', ')}`);
      process.exit(1);
    }
  } finally {
    await stopPulseServer(server);
  }
}

main().catch((err) => {
  console.error('[pulse:sensors]', err.message);
  process.exit(1);
});
