#!/usr/bin/env node
/**
 * Pulso — Shipping (dry run de processos). Operação requisitada.
 *
 * Uso:
 *   npm run pulse:shipping
 *   node scripts/pulse-shipping.mjs --id pedidos-compra
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
const MANIFEST = path.join(ROOT, 'docs/pulse/shipping-geral.json');
const MANIFEST_PILOTO = path.join(ROOT, 'docs/pulse/shipping-piloto.json');
const REPORT_OUT = path.join(ROOT, 'docs/pulse/shipping-report.json');

const ERROR_SELECTORS = [
  'text=Application error',
  'text=Unhandled Runtime Error',
  'text=Internal Server Error',
];

function parseArgs(argv) {
  const args = { all: true, id: null, module: null, piloto: false, skipServer: false, writeReport: true };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--all' || arg === '-a') args.all = true;
    else if (arg === '--piloto') args.piloto = true;
    else if (arg === '--module' && argv[i + 1]) args.module = argv[++i];
    else if (arg === '--id' && argv[i + 1]) {
      args.id = argv[++i];
      args.all = false;
    } else if (arg === '--skip-server') args.skipServer = true;
    else if (arg === '--no-report') args.writeReport = false;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function sensorSelector(id) {
  return `[data-pulse-sensor="${id}"]`;
}

async function loadPlaywright() {
  const mod = await import('playwright');
  return mod.chromium;
}

async function assertNoCrash(page) {
  for (const sel of ERROR_SELECTORS) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) {
      throw new Error(`crash detectado: ${sel}`);
    }
  }
}

async function runStep(page, step) {
  switch (step.action) {
    case 'wait': {
      const state = step.state || 'visible';
      await page.locator(sensorSelector(step.sensor)).first().waitFor({ state, timeout: step.timeout || 30000 });
      break;
    }
    case 'click': {
      const loc = page.locator(sensorSelector(step.sensor)).first();
      await loc.waitFor({ state: 'visible', timeout: step.timeout || 20000 });
      await loc.click({ timeout: 5000 });
      await page.waitForTimeout(300);
      break;
    }
    case 'fill': {
      const loc = page.locator(sensorSelector(step.sensor)).first();
      await loc.waitFor({ state: 'visible', timeout: step.timeout || 20000 });
      await loc.fill(step.value ?? '');
      break;
    }
    case 'click_text': {
      await page.getByRole('button', { name: step.text, exact: step.exact ?? false }).first().click({ timeout: 10000 });
      await page.waitForTimeout(300);
      break;
    }
    case 'press': {
      await page.keyboard.press(step.key);
      await page.waitForTimeout(200);
      break;
    }
    case 'wait_url': {
      await page.waitForURL(new RegExp(step.pattern), { timeout: step.timeout || 30000 });
      break;
    }
    case 'sleep': {
      await page.waitForTimeout(step.ms || 500);
      break;
    }
    default:
      throw new Error(`ação desconhecida: ${step.action}`);
  }
  await assertNoCrash(page);
}

async function runShipment(browser, shipment) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const stepResults = [];
  let failedAt = null;

  console.log(`\n📦 SHIPPING ${shipment.id} — ${shipment.label}`);

  try {
    await page.goto(`${PULSE_BASE}${shipment.route}`, { waitUntil: 'networkidle', timeout: 60000 });
    if (shipment.warmupMs) await page.waitForTimeout(shipment.warmupMs);
    await assertNoCrash(page);

    for (const step of shipment.steps) {
      if (failedAt) {
        console.log(`  STEP ${(step.label || step.action).padEnd(28)} ⏭️  não testado`);
        stepResults.push({ ...step, ok: false, skipped: true });
        continue;
      }
      try {
        await runStep(page, step);
        console.log(`  STEP ${(step.label || step.action).padEnd(28)} ✅`);
        stepResults.push({ label: step.label, action: step.action, ok: true });
      } catch (err) {
        failedAt = step.label || step.action;
        console.log(`  STEP ${(step.label || step.action).padEnd(28)} ❌  ${err.message}`);
        stepResults.push({ label: step.label, action: step.action, ok: false, error: err.message });
      }
    }

    const green = !failedAt;
    console.log(`  ENTREGA                        ${green ? '🟢 dry run OK' : '❌  parou em ' + failedAt}`);
    return { id: shipment.id, label: shipment.label, green, failedAt, steps: stepResults };
  } catch (err) {
    console.log(`  ENTREGA                        ❌  ${err.message}`);
    return { id: shipment.id, label: shipment.label, green: false, failedAt: 'fatal', error: err.message, steps: stepResults };
  } finally {
    await context.close();
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`Uso: node scripts/pulse-shipping.mjs [opções]

Opções:
  --all, -a           Todos (shipping-geral.json, default)
  --piloto            Só 3 processos piloto
  --id <slug>         Um processo (ex: pedidos-compra)
  --module <nome>     Filtrar módulo (vendas, financeiro, logistica, gestao)
  --skip-server       Servidor já a correr
`);
    process.exit(0);
  }

  // Refresh do roteiro antes do shipping — desligado por defeito (corrida mais rápida).
  // Para job periódico (ex. cron/GitHub Actions scheduled): descomentar import +
  // bloco abaixo OU correr antes: npm run pulse:refresh-roteiro && npm run pulse:shipping
  //
  // refreshPulseRoteiro();

  const manifestPath = args.piloto ? MANIFEST_PILOTO : MANIFEST;
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifesto não encontrado: ${manifestPath}. Corra: npm run pulse:generate-sensors`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  let shipments = manifest.shipments;
  if (args.id) {
    shipments = shipments.filter((s) => s.id === args.id);
    if (!shipments.length) throw new Error(`Shipping não encontrado: ${args.id}`);
  }
  if (args.module) {
    shipments = shipments.filter((s) => s.module === args.module);
    if (!shipments.length) throw new Error(`Nenhum shipping no módulo: ${args.module}`);
  }

  const chromium = await loadPlaywright();
  let server = null;

  console.log(`[pulse:shipping] ${shipments.length} processo(s) — dry run`);

  try {
    if (!args.skipServer) {
      console.log('[pulse:shipping] A subir next start (bypass auth)…');
      server = await startPulseServer({ bypassAuth: true });
    }

    const browser = await chromium.launch({ headless: true });
    const summary = [];
    try {
      for (const shipment of shipments) {
        summary.push(await runShipment(browser, shipment));
      }
    } finally {
      await browser.close();
    }

    const passed = summary.filter((s) => s.green).length;
    console.log(`\n[pulse:shipping] Resumo: ${passed}/${summary.length} entregas dry run 🟢`);

    const report = { collectedAt: new Date().toISOString(), passed, total: summary.length, shipments: summary };
    if (args.writeReport) {
      fs.writeFileSync(REPORT_OUT, `${JSON.stringify(report, null, 2)}\n`);
      console.log(`[pulse:shipping] Relatório → ${REPORT_OUT}`);
    }

    if (passed < summary.length) {
      const bad = summary.filter((s) => !s.green).map((s) => s.id);
      console.error(`[pulse:shipping] Falharam: ${bad.join(', ')}`);
      process.exit(1);
    }
  } finally {
    await stopPulseServer(server);
  }
}

main().catch((err) => {
  console.error('[pulse:shipping]', err.message);
  process.exit(1);
});
