/**
 * Regenera manifestos Pulso a partir de routes-lote* + mapa CONTROLS:
 * sensors-geral.json, corridorManifest.generated.js, shipping-geral.json
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const GENERATE_SENSORS = path.join(ROOT, 'scripts/generate-pulse-sensors-geral.mjs');

/**
 * @param {{ quiet?: boolean }} [opts]
 * @returns {void}
 */
export function refreshPulseRoteiro({ quiet = false } = {}) {
  if (!quiet) {
    console.log('[pulse:refresh] A regenerar roteiro (sensores + corredor + shipping)…');
  }

  const result = spawnSync(process.execPath, [GENERATE_SENSORS], {
    cwd: ROOT,
    stdio: quiet ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    const detail = quiet && result.stderr ? `\n${result.stderr.trim()}` : '';
    throw new Error(`[pulse:refresh] Falha ao regenerar roteiro${detail}`);
  }

  if (!quiet) {
    console.log('[pulse:refresh] Roteiro actualizado.');
  }
}
