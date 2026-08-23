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
  ensurePulseBuild,
} from './lib/pulse-runtime.mjs';
import { createPulseBrowserContext, resolveViewportProfile } from './lib/pulse-viewport.mjs';
// Descomentar junto com o bloco refreshPulseRoteiro() em main():
// import { refreshPulseRoteiro } from './lib/pulse-refresh-roteiro.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'docs/pulse/shipping-geral.json');
const MANIFEST_PILOTO = path.join(ROOT, 'docs/pulse/shipping-piloto.json');
const MANIFEST_CRITICO = path.join(ROOT, 'docs/pulse/shipping-critico.json');
const REPORT_OUT = path.join(ROOT, 'docs/pulse/shipping-report.json');

const ERROR_SELECTORS = [
  'text=Application error',
  'text=Unhandled Runtime Error',
  'text=Internal Server Error',
];

function parseArgs(argv) {
  const args = {
    all: true,
    id: null,
    module: null,
    piloto: false,
    critico: false,
    skipServer: false,
    skipBuild: false,
    writeReport: true,
    tablet: false,
    orientation: 'portrait',
    profile: null,
    modoPaisagem: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--all' || arg === '-a') args.all = true;
    else if (arg === '--piloto') args.piloto = true;
    else if (arg === '--critico') args.critico = true;
    else if (arg === '--tablet') args.tablet = true;
    else if (arg === '--modo-paisagem') args.modoPaisagem = true;
    else if (arg === '--profile' && argv[i + 1]) args.profile = argv[++i];
    else if (arg === '--orientation' && argv[i + 1]) args.orientation = argv[++i];
    else if (arg === '--module' && argv[i + 1]) args.module = argv[++i];
    else if (arg === '--id' && argv[i + 1]) {
      args.id = argv[++i];
      args.all = false;
    } else if (arg === '--skip-server') args.skipServer = true;
    else if (arg === '--skip-build') args.skipBuild = true;
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

async function runShipment(browser, shipment, runOpts) {
  const { context } = await createPulseBrowserContext(browser, runOpts);
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
  --critico           Subconjunto anti-submarino (shipping-critico.json)
  --id <slug>         Um processo (ex: pedidos-compra)
  --module <nome>     Filtrar módulo (vendas, financeiro, logistica, gestao)
  --tablet            Emulação iPad (touch + menu de baixo)
  --orientation <p|l> portrait (default) ou landscape
  --profile <nome>    desktop | tablet-portrait | tablet-landscape
  --modo-paisagem     Grava preferência paisagem antes de cada página
  --skip-server       Servidor já a correr
  --skip-build        Não rebuildar (usa .next actual; pode falhar sem bypass no build)
`);
    process.exit(0);
  }

  // Refresh do roteiro antes do shipping — desligado por defeito (corrida mais rápida).
  // Para job periódico (ex. cron/GitHub Actions scheduled): descomentar import +
  // bloco abaixo OU correr antes: npm run pulse:refresh-roteiro && npm run pulse:shipping
  //
  // refreshPulseRoteiro();

  let shipments;
  if (args.critico) {
    if (!fs.existsSync(MANIFEST)) {
      throw new Error(`Manifesto não encontrado: ${MANIFEST}. Corra: npm run pulse:generate-sensors`);
    }
    if (!fs.existsSync(MANIFEST_CRITICO)) {
      throw new Error(`Manifesto crítico não encontrado: ${MANIFEST_CRITICO}`);
    }
    const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    const critico = JSON.parse(fs.readFileSync(MANIFEST_CRITICO, 'utf8'));
    const ids = critico.shipmentIds || [];
    shipments = manifest.shipments.filter((s) => ids.includes(s.id));
    const missing = ids.filter((id) => !shipments.some((s) => s.id === id));
    if (missing.length) {
      throw new Error(`Shipping crítico em falta no geral: ${missing.join(', ')}`);
    }
  } else {
    const manifestPath = args.piloto ? MANIFEST_PILOTO : MANIFEST;
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Manifesto não encontrado: ${manifestPath}. Corra: npm run pulse:generate-sensors`);
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    shipments = manifest.shipments;
  }
  if (args.id) {
    shipments = shipments.filter((s) => s.id === args.id);
    if (!shipments.length) throw new Error(`Shipping não encontrado: ${args.id}`);
  }
  if (args.module) {
    shipments = shipments.filter((s) => s.module === args.module);
    if (!shipments.length) throw new Error(`Nenhum shipping no módulo: ${args.module}`);
  }

  const viewportProfile = resolveViewportProfile(args);
  const runOpts = {
    profile: viewportProfile,
    modoPaisagem: args.modoPaisagem,
  };

  const chromium = await loadPlaywright();
  let server = null;

  console.log(
    `[pulse:shipping] ${shipments.length} processo(s) — dry run · ${viewportProfile.label}${
      args.critico ? ' · crítico' : ''
    }${args.modoPaisagem ? ' · Modo Paisagem' : ''}`
  );

  try {
    if (!args.skipServer) {
      console.log('[pulse:shipping] A subir next start (bypass auth)…');
      server = await startPulseServer({ bypassAuth: true, skipBuild: args.skipBuild });
    }

    const browser = await chromium.launch({ headless: true });
    const summary = [];
    try {
      for (const shipment of shipments) {
        summary.push(await runShipment(browser, shipment, runOpts));
      }
    } finally {
      await browser.close();
    }

    const passed = summary.filter((s) => s.green).length;
    console.log(`\n[pulse:shipping] Resumo: ${passed}/${summary.length} entregas dry run 🟢`);

    const report = {
      collectedAt: new Date().toISOString(),
      profile: viewportProfile.id,
      profileLabel: viewportProfile.label,
      critico: args.critico,
      modoPaisagem: args.modoPaisagem,
      passed,
      total: summary.length,
      shipments: summary,
    };
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
