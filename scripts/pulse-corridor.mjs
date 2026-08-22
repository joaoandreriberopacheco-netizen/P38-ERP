#!/usr/bin/env node
/**
 * Pulso — comboio no corredor vertical.
 * Uma passagem: cada estação deixa a saca de cartas; o trem recolhe e gera relatório.
 *
 * Uso: npm run pulse:corridor
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  PULSE_BASE,
  startPulseServer,
  stopPulseServer,
} from './lib/pulse-runtime.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CORRIDOR_ROUTE = '/pulse/corredor';
const REPORT_OUT = path.join(ROOT, 'docs/pulse/corridor-report.json');

function parseArgs(argv) {
  const args = { skipServer: false, writeReport: true };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--skip-server') args.skipServer = true;
    else if (argv[i] === '--no-report') args.writeReport = false;
    else if (argv[i] === '--help' || argv[i] === '-h') args.help = true;
  }
  return args;
}

async function loadPlaywright() {
  try {
    const mod = await import('playwright');
    return mod.chromium;
  } catch {
    throw new Error('Playwright não instalado. Corra: npx playwright install chromium');
  }
}

async function collectMailbag(station) {
  const pageName = await station.getAttribute('data-pulse-station');
  const route = await station.getAttribute('data-pulse-route');
  const mailRaw = await station.locator('[data-pulse-mail]').textContent();
  let mailMeta = null;
  try {
    mailMeta = JSON.parse(mailRaw || '{}');
  } catch {
    mailMeta = { parseError: true };
  }

  const letters = [];
  const sensors = await station.locator('[data-pulse-sensor]').all();
  let green = true;
  let failedAt = null;

  for (const sensor of sensors) {
    const id = await sensor.getAttribute('data-pulse-sensor');
    const label = await sensor.getAttribute('data-pulse-letter');
    try {
      await sensor.waitFor({ state: 'attached', timeout: 5000 });
      letters.push({ id, label, ok: true });
    } catch (err) {
      green = false;
      failedAt = id;
      letters.push({ id, label, ok: false, error: err.message });
      break;
    }
  }

  return {
    station: pageName,
    route,
    label: mailMeta?.label || pageName,
    module: mailMeta?.module || null,
    green,
    failedAt,
    letters,
    mail: mailMeta,
  };
}

async function runTrain(browser) {
  const context = await browser.newContext({ viewport: { width: 900, height: 1200 } });
  const page = await context.newPage();

  console.log(`\n🚂 COMBOIO → ${CORRIDOR_ROUTE}`);

  await page.goto(`${PULSE_BASE}${CORRIDOR_ROUTE}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('[data-pulse-corridor]').waitFor({ state: 'visible', timeout: 15000 });

  const expectedCount = Number(await page.locator('[data-pulse-corridor]').getAttribute('data-pulse-station-count'));
  const stationLocs = await page.locator('[data-pulse-station]').all();

  console.log(`   ${stationLocs.length} estações na linha (manifesto: ${expectedCount})`);

  const mailbags = [];
  for (const station of stationLocs) {
    const bag = await collectMailbag(station);
    mailbags.push(bag);
    const icon = bag.green ? '📬' : '❌';
    const letterCount = bag.letters.filter((l) => l.ok).length;
    console.log(`   ${icon} ${bag.station.padEnd(22)} ${letterCount}/${bag.letters.length} cartas${bag.failedAt ? ` · parou em ${bag.failedAt}` : ''}`);
  }

  await page.locator('[data-pulse-terminal]').waitFor({ state: 'visible', timeout: 5000 });

  const passed = mailbags.filter((b) => b.green).length;
  const allGreen = passed === mailbags.length && mailbags.length === expectedCount;

  console.log(`\n   TERMINAL ${allGreen ? '🟢' : '❌'}  ${passed}/${mailbags.length} sacas OK`);

  await context.close();

  return {
    route: CORRIDOR_ROUTE,
    expectedStations: expectedCount,
    collectedStations: mailbags.length,
    passed,
    allGreen,
    mailbags,
    collectedAt: new Date().toISOString(),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log('Uso: node scripts/pulse-corridor.mjs [--skip-server] [--no-report]');
    process.exit(0);
  }

  const chromium = await loadPlaywright();
  let server = null;

  try {
    if (!args.skipServer) {
      console.log('[pulse:corridor] A subir next start…');
      server = await startPulseServer({ bypassAuth: true });
    }

    const browser = await chromium.launch({ headless: true });
    let report;
    try {
      report = await runTrain(browser);
    } finally {
      await browser.close();
    }

    if (args.writeReport) {
      fs.writeFileSync(REPORT_OUT, `${JSON.stringify(report, null, 2)}\n`);
      console.log(`[pulse:corridor] Relatório → ${REPORT_OUT}`);
    }

    if (!report.allGreen) {
      const bad = report.mailbags.filter((b) => !b.green).map((b) => b.station);
      console.error(`[pulse:corridor] Estações com saca incompleta: ${bad.join(', ')}`);
      process.exit(1);
    }
  } finally {
    await stopPulseServer(server);
  }
}

main().catch((err) => {
  console.error('[pulse:corridor]', err.message);
  process.exit(1);
});
