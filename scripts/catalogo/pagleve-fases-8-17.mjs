#!/usr/bin/env node
/**
 * FASE 1 → 2 → 3 (lotes 8–17 Casa Israel)
 * 1) Aguarda runner, consolidado, CSV cascata, publicar + deploy
 * 2) Varredura ficha pontual (pós-match)
 * 3) Aplicar varredura + publicar + deploy
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const ART = '/opt/cursor/artifacts';
const RUNNER_EXIT = path.join(ART, 'pagleve-lotes-8-17-runner.exit');
const STATUS_PATH = path.join(ART, 'pagleve-fases-8-17-status.json');
const DEPLOY_URL_DEFAULT = 'https://catalogo-pague-leve.vercel.app/';

function runNode(script, env = {}) {
  const r = spawnSync(process.execPath, [path.join(__dirname, script)], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  return r.status ?? 1;
}

function runNpm(script) {
  const r = spawnSync('npm', ['run', script], { cwd: ROOT, stdio: 'inherit', shell: true });
  return r.status ?? 1;
}

function deployCatalogo() {
  const deployDir = path.join(ROOT, 'deploy', 'catalogo-pagleve');
  if (!process.env.VERCEL_TOKEN) {
    return {
      ok: false,
      skipped: true,
      motivo: 'VERCEL_TOKEN ausente — deploy manual via push main ou workflow',
      url: DEPLOY_URL_DEFAULT,
    };
  }
  const r = spawnSync(
    'npx',
    ['--yes', 'vercel@latest', 'deploy', '--prod', '--yes', '--token', process.env.VERCEL_TOKEN],
    { cwd: deployDir, encoding: 'utf8' },
  );
  const url = (r.stdout || '').trim().split('\n').pop() || DEPLOY_URL_DEFAULT;
  return { ok: r.status === 0, skipped: false, url, stderr: (r.stderr || '').slice(-500) };
}

function waitRunner(maxMs = 3600000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    if (fs.existsSync(RUNNER_EXIT)) {
      const code = fs.readFileSync(RUNNER_EXIT, 'utf8').trim();
      return Number(code) === 0;
    }
    const sweep = spawnSync('pgrep', ['-f', 'pagleve-lotes-sequenciais-runner'], { encoding: 'utf8' });
    if (!sweep.stdout.trim() && fs.existsSync(path.join(ART, 'pagleve-lote17-cascata.json'))) {
      return true;
    }
    spawnSync('sleep', ['15']);
  }
  return false;
}

function saveStatus(payload) {
  fs.mkdirSync(ART, { recursive: true });
  fs.writeFileSync(STATUS_PATH, JSON.stringify(payload, null, 2));
}

function main() {
  const status = { geradoEm: new Date().toISOString(), fases: {} };

  console.log('\n=== FASE 1 — match + consolidado + catálogo v1 ===\n');
  const runnerOk = waitRunner();
  status.fases.fase1 = { runner_concluido: runnerOk };
  if (!runnerOk) {
    status.erro = 'Runner lotes 8-17 não concluiu a tempo';
    saveStatus(status);
    process.exit(1);
  }

  let code = runNode('pagleve-lotes-consolidar-8-17.mjs');
  status.fases.fase1.consolidado = code === 0 ? 'ok' : `exit ${code}`;
  if (code !== 0) process.exit(code);

  code = runNode('pagleve-aplicar-lotes-cascata-csv.mjs');
  status.fases.fase1.csv_cascata = code === 0 ? 'ok' : `exit ${code}`;
  if (code !== 0) process.exit(code);

  code = runNpm('catalogo:publicar-pagleve');
  status.fases.fase1.publicar = code === 0 ? 'ok' : `exit ${code}`;
  if (code !== 0) process.exit(code);

  const d1 = deployCatalogo();
  status.fases.fase1.deploy = d1;

  console.log('\n=== FASE 2 — varredura ficha (pós-match) ===\n');
  code = runNode('pagleve-varredura-ficha-pos-match.mjs');
  const varredura = JSON.parse(
    fs.readFileSync(path.join(ART, 'pagleve-lotes-8-17-varredura-ficha.json'), 'utf8'),
  );
  status.fases.fase2 = {
    ok: code === 0,
    itens: varredura.itens_casados,
    divergencias: varredura.divergencias_count,
    json: path.join(ART, 'pagleve-lotes-8-17-varredura-ficha.json'),
  };

  console.log('\n=== FASE 3 — catálogo v2 com varredura ===\n');
  code = runNode('pagleve-aplicar-varredura-ficha-csv.mjs');
  status.fases.fase3 = { csv_varredura: code === 0 ? 'ok' : `exit ${code}` };
  if (code !== 0) process.exit(code);

  code = runNpm('catalogo:publicar-pagleve');
  status.fases.fase3.publicar = code === 0 ? 'ok' : `exit ${code}`;
  if (code !== 0) process.exit(code);

  const d2 = deployCatalogo();
  status.fases.fase3.deploy = d2;

  if (fs.existsSync(path.join(ART, 'pagleve-lotes-8-17-resumo.json'))) {
    status.totais = JSON.parse(fs.readFileSync(path.join(ART, 'pagleve-lotes-8-17-resumo.json'), 'utf8')).totais;
  }

  saveStatus(status);
  console.log('\nStatus:', STATUS_PATH);
  console.log(JSON.stringify(status.fases, null, 2));
}

main();