#!/usr/bin/env node
/**
 * Pulso diário — trem + shipping com auto-reparo seguro (refresh roteiro + retry)
 * e resumo para notificação ao João André.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { refreshPulseRoteiro } from './lib/pulse-refresh-roteiro.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SENSORS_REPORT = path.join(ROOT, 'docs/pulse/sensors-report.json');
const SHIPPING_REPORT = path.join(ROOT, 'docs/pulse/shipping-report.json');
const SUMMARY_OUT = path.join(ROOT, 'docs/pulse/pulse-diario-summary.json');

function parseArgs(argv) {
  const args = { skipRefresh: false, skipNotify: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--skip-refresh') args.skipRefresh = true;
    else if (arg === '--skip-notify') args.skipNotify = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function runPulseScript(scriptName) {
  const result = spawnSync('npm', ['run', scriptName], {
    cwd: ROOT,
    stdio: 'inherit',
    encoding: 'utf8',
    shell: true,
  });
  return result.status === 0;
}

function readReport(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function failuresFromSensors(report) {
  if (!report?.screens) return [];
  return report.screens
    .filter((s) => !s.green)
    .map((s) => ({
      kind: 'trem',
      route: s.route,
      failedAt: s.failedAt,
      error: s.error || null,
    }));
}

function failuresFromShipping(report) {
  if (!report?.shipments) return [];
  return report.shipments
    .filter((s) => !s.green)
    .map((s) => ({
      kind: 'shipping',
      id: s.id,
      label: s.label,
      failedAt: s.failedAt,
      error: s.error || null,
    }));
}

async function runPhase(label, scriptName, autoFixes, skipRefresh) {
  const attempts = [];
  let ok = runPulseScript(scriptName);
  attempts.push({ attempt: 1, ok });

  if (!ok && !skipRefresh) {
    console.log(`\n[pulse:diario] ${label} falhou — auto-reparo: regenerar roteiro e repetir…`);
    refreshPulseRoteiro();
    autoFixes.push({
      phase: label,
      action: 'Regenerámos o roteiro (manifestos) e repetimos a corrida',
    });
    ok = runPulseScript(scriptName);
    attempts.push({ attempt: 2, ok, afterAutoFix: true });
  }

  return { ok, attempts };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`Uso: node scripts/pulse-diario.mjs [opções]

Opções:
  --skip-refresh   Não regenerar roteiro no início nem no auto-reparo
  --skip-notify    Não enviar notificação (só gerar summary JSON)
`);
    process.exit(0);
  }

  const autoFixes = [];
  const startedAt = new Date().toISOString();

  console.log('[pulse:diario] Debugger automático — trem + shipping\n');

  if (!args.skipRefresh) {
    refreshPulseRoteiro();
  }

  const trem = await runPhase('Trem', 'pulse:sensors', autoFixes, args.skipRefresh);
  let shipping = { ok: true, attempts: [{ attempt: 0, ok: true, skipped: true }] };

  if (trem.ok) {
    shipping = await runPhase('Shipping', 'pulse:shipping', autoFixes, args.skipRefresh);
  } else {
    console.log('[pulse:diario] Shipping não corrido — trem ainda vermelho após auto-reparo.');
    shipping = { ok: false, attempts: [{ attempt: 0, ok: false, skipped: true }] };
  }

  let celulasSanity = { ok: true, skipped: true };
  if (process.env.DATABASE_URL) {
    console.log('\n[pulse:diario] Células dashboard — sanity check…');
    const ok = runPulseScript('dashboard:celulas-sanity');
    celulasSanity = { ok, skipped: false };
    if (!ok) {
      console.warn('[pulse:diario] dashboard:celulas-sanity falhou (não bloqueia trem/shipping).');
    }
  } else {
    console.log('[pulse:diario] dashboard:celulas-sanity ignorado — DATABASE_URL em falta.');
  }

  const sensorsReport = readReport(SENSORS_REPORT);
  const shippingReport = readReport(SHIPPING_REPORT);

  const status =
    trem.ok && shipping.ok
      ? autoFixes.length > 0
        ? 'fixed'
        : 'ok'
      : 'needs_review';

  const summary = {
    collectedAt: startedAt,
    finishedAt: new Date().toISOString(),
    status,
    statusLabel:
      status === 'ok'
        ? 'Tudo OK'
        : status === 'fixed'
          ? 'Corrigido automaticamente — confirma'
          : 'Precisa da tua revisão',
    trem: {
      ok: trem.ok,
      passed: sensorsReport?.passed ?? null,
      total: sensorsReport?.total ?? null,
      attempts: trem.attempts,
      failures: failuresFromSensors(sensorsReport),
    },
    shipping: {
      ok: shipping.ok,
      passed: shippingReport?.passed ?? null,
      total: shippingReport?.total ?? null,
      attempts: shipping.attempts,
      failures: failuresFromShipping(shippingReport),
    },
    celulasSanity,
    autoFixes,
    workflowUrl: process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : null,
  };

  fs.writeFileSync(SUMMARY_OUT, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`\n[pulse:diario] Resumo → ${SUMMARY_OUT}`);
  console.log(`[pulse:diario] Estado: ${summary.statusLabel}`);

  if (!args.skipNotify) {
    const notify = spawnSync(process.execPath, [path.join(__dirname, 'pulse-diario-notify.mjs')], {
      cwd: ROOT,
      stdio: 'inherit',
    });
    if (notify.status !== 0) {
      console.warn('[pulse:diario] Notificação falhou (corrida continua)');
    }
  }

  if (!trem.ok || !shipping.ok) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[pulse:diario]', err.message);
  process.exit(1);
});
