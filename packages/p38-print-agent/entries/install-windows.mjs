#!/usr/bin/env node
/**
 * Instalador plug-and-play — Windows (.exe).
 * Supabase P38 embutido; gera código 000-000; arranque automático.
 */
import readline from 'readline';
import { spawn } from 'child_process';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { homedir, platform } from 'os';
import { dirname, join } from 'path';
import { resolveConfig, saveConfig } from '../src/config.mjs';
import { formatPairingCode, generateAgentPairingCode } from '../src/pairing-code.mjs';
import { P38_SUPABASE_URL, P38_SUPABASE_ANON_KEY } from '../defaults.p38.mjs';

function pause(message = '\nPrima Enter para fechar...') {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

function installDir() {
  if (process.pkg) return dirname(process.execPath);
  return join(process.cwd(), 'packages/p38-print-agent');
}

function buildLauncherBat(installRoot) {
  const iniciarExe = join(installRoot, 'P38-Iniciar-Agente.exe');
  const iniciarBat = join(installRoot, 'iniciar-agente.bat');
  if (existsSync(iniciarExe)) {
    return `@echo off\r\ntitle P38 Print Agent\r\ncd /d "${installRoot}"\r\nstart "" "${iniciarExe}"\r\n`;
  }
  if (existsSync(iniciarBat)) {
    return `@echo off\r\ntitle P38 Print Agent\r\ncd /d "${installRoot}"\r\n"${iniciarBat}"\r\n`;
  }
  return `@echo off\r\ntitle P38 Print Agent\r\ncd /d "${installRoot}"\r\nnode packages/p38-print-agent/bin/start.mjs\r\n`;
}

function windowsStartupDir() {
  const appData = process.env.APPDATA;
  if (!appData) return null;
  return join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
}

function registerWindowsAutoStart(installRoot) {
  const startup = windowsStartupDir();
  if (!startup) return;
  mkdirSync(startup, { recursive: true });
  writeFileSync(join(startup, 'P38 Agente Impressao.bat'), buildLauncherBat(installRoot), 'utf8');
}

function createWindowsShortcut(installRoot) {
  const desktop = join(homedir(), 'Desktop');
  if (!existsSync(desktop)) return;
  writeFileSync(join(desktop, 'P38 Agente Impressao.bat'), buildLauncherBat(installRoot), 'utf8');
}

function startAgentDetached(installRoot) {
  const iniciarExe = join(installRoot, 'P38-Iniciar-Agente.exe');
  if (!existsSync(iniciarExe)) return;
  try {
    spawn(iniciarExe, [], { detached: true, stdio: 'ignore', cwd: installRoot }).unref();
  } catch {
    /* ignore */
  }
}

function resolveSupabaseCredentials(cfg) {
  const url =
    cfg.supabaseUrl ||
    P38_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '';
  const anonKey =
    cfg.supabaseAnonKey ||
    P38_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';
  return { url, anonKey };
}

async function main() {
  const cfg = resolveConfig();
  const { url: supabaseUrl, anonKey: supabaseAnonKey } = resolveSupabaseCredentials(cfg);

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('\nErro: instalador incompleto. Descarregue o .exe mais recente do GitHub.');
    await pause();
    process.exit(1);
  }

  const pairingCode = generateAgentPairingCode();
  const codigoFormatado = formatPairingCode(pairingCode);

  saveConfig({
    agentToken: pairingCode,
    supabaseUrl,
    supabaseAnonKey,
    printerHost: cfg.printerHost || '',
    printerPort: cfg.printerPort || 9100,
  });

  const root = installDir();
  if (platform() === 'win32') {
    try {
      createWindowsShortcut(root);
      registerWindowsAutoStart(root);
      startAgentDetached(root);
    } catch {
      /* ignore */
    }
  }

  console.log('');
  console.log('========================================');
  console.log('  P38 — Agente de impressão instalado');
  console.log('========================================');
  console.log('');
  console.log('  Digite este código UMA VEZ no P38:');
  console.log('');
  console.log(`           ${codigoFormatado}`);
  console.log('');
  console.log('  P38 → Comprovante → "Ligar agente"');
  console.log('');
  console.log('  O agente abre sozinho quando o PC ligar.');
  console.log('');

  await pause();
}

main().catch(async (e) => {
  console.error('\nErro:', e?.message || e);
  await pause();
  process.exit(1);
});
