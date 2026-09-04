import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG_DIR = process.env.P38_PRINT_AGENT_CONFIG_DIR || join(homedir(), '.p38-print-agent');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export function loadConfig() {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

export function saveConfig(partial) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const next = { ...loadConfig(), ...partial };
  writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2));
  return next;
}

export function resolveConfig() {
  const file = loadConfig();
  return {
    port: Number(process.env.P38_PRINT_AGENT_PORT || file.port || 3920),
    supabaseUrl: process.env.P38_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || file.supabaseUrl || '',
    supabaseAnonKey: process.env.P38_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || file.supabaseAnonKey || '',
    agentToken: process.env.P38_PRINT_AGENT_TOKEN || file.agentToken || '',
    agentId: process.env.P38_PRINT_AGENT_ID || file.agentId || '',
    printerHost: process.env.P38_PRINTER_HOST || file.printerHost || '',
    printerPort: Number(process.env.P38_PRINTER_PORT || file.printerPort || 9100),
    pollIntervalMs: Number(process.env.P38_PRINT_AGENT_POLL_MS || file.pollIntervalMs || 4000),
    configDir: CONFIG_DIR,
    configFile: CONFIG_FILE,
  };
}

export { generateAgentPairingCode, normalizePairingCode, formatPairingCode, isValidPairingCode } from './pairing-code.mjs';

/** @deprecated use generateAgentPairingCode */
export function generateAgentToken() {
  return generateAgentPairingCode();
}
