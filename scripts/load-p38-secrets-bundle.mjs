/**
 * Carrega o ficheiro mestre de chaves P38 (`secrets/p38-chaves.txt`).
 * Quando existe, sobrepõe secrets do Cursor Cloud — útil quando o painel
 * tem valores antigos/errados e o João prefere colar tudo num só sítio.
 *
 * NUNCA commitar `secrets/p38-chaves.txt` (está no .gitignore).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

export const P38_SECRETS_BUNDLE_PATH = path.join(REPO_ROOT, 'secrets', 'p38-chaves.txt');
export const P38_SECRETS_BUNDLE_EXAMPLE = path.join(REPO_ROOT, 'secrets', 'p38-chaves.exemplo.txt');

let bundleLoaded = false;

/**
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function parseEnvText(text) {
  /** @type {Record<string, string>} */
  const out = {};
  for (let line of text.split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    if (/^export\s+/i.test(line)) line = line.replace(/^export\s+/i, '').trim();
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    val = val.replace(/\\n/g, '\n');
    if (val) out[key] = val;
  }
  return out;
}

/**
 * Preenche `process.env` a partir de `secrets/p38-chaves.txt` (prioridade alta).
 * @returns {{ loaded: boolean, keys: string[] }}
 */
export function loadP38SecretsBundle() {
  if (bundleLoaded) {
    return { loaded: fs.existsSync(P38_SECRETS_BUNDLE_PATH), keys: [] };
  }
  bundleLoaded = true;

  if (!fs.existsSync(P38_SECRETS_BUNDLE_PATH)) {
    return { loaded: false, keys: [] };
  }

  const text = fs.readFileSync(P38_SECRETS_BUNDLE_PATH, 'utf8').replace(/^\uFEFF/, '');
  const parsed = parseEnvText(text);
  const keys = Object.keys(parsed);
  for (const [key, val] of Object.entries(parsed)) {
    process.env[key] = val;
  }
  return { loaded: true, keys };
}

/**
 * Cria `secrets/p38-chaves.txt` a partir do exemplo se ainda não existir.
 * @returns {boolean} true se criou ficheiro novo
 */
export function initP38SecretsBundle() {
  if (fs.existsSync(P38_SECRETS_BUNDLE_PATH)) return false;
  if (!fs.existsSync(P38_SECRETS_BUNDLE_EXAMPLE)) {
    throw new Error(`Modelo em falta: ${P38_SECRETS_BUNDLE_EXAMPLE}`);
  }
  fs.mkdirSync(path.dirname(P38_SECRETS_BUNDLE_PATH), { recursive: true });
  fs.copyFileSync(P38_SECRETS_BUNDLE_EXAMPLE, P38_SECRETS_BUNDLE_PATH);
  return true;
}
