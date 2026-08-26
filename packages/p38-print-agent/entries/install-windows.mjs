#!/usr/bin/env node
/**
 * Instalador para o PC da loja — Windows (.exe ou Node).
 * Release: Supabase P38 já vem embutido; o cliente só informa IP da impressora.
 */
import readline from 'readline';
import { mkdirSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { homedir, platform } from 'os';
import { dirname, join } from 'path';
import { generateAgentToken, resolveConfig, saveConfig } from '../src/config.mjs';
import { P38_SUPABASE_URL, P38_SUPABASE_ANON_KEY } from '../defaults.p38.mjs';

function ask(rl, question, defaultValue = '') {
  const hint = defaultValue ? ` [${defaultValue}]` : '';
  return new Promise((resolve) => {
    rl.question(`${question}${hint}: `, (answer) => {
      const v = String(answer ?? '').trim();
      resolve(v || defaultValue);
    });
  });
}

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

function registerWindowsAutoStart(installRoot, enabled) {
  const startup = windowsStartupDir();
  if (!startup) return null;

  const startupBat = join(startup, 'P38 Agente Impressao.bat');
  if (!enabled) {
    if (existsSync(startupBat)) {
      try {
        unlinkSync(startupBat);
      } catch {
        /* ignore */
      }
    }
    return null;
  }

  mkdirSync(startup, { recursive: true });
  writeFileSync(startupBat, buildLauncherBat(installRoot), 'utf8');
  console.log('Arranque automático activado (abre ao ligar o PC).');
  return startupBat;
}

function createWindowsShortcut(installRoot) {
  const desktop = join(homedir(), 'Desktop');
  if (!existsSync(desktop)) return;

  const shortcutBat = join(desktop, 'P38 Agente Impressao.bat');
  writeFileSync(shortcutBat, buildLauncherBat(installRoot), 'utf8');
  console.log('Atalho criado no Ambiente de Trabalho.');
}

function resolveSupabaseCredentials(cfg) {
  const bundled = Boolean(P38_SUPABASE_URL && P38_SUPABASE_ANON_KEY);
  const url =
    cfg.supabaseUrl ||
    P38_SUPABASE_URL ||
    process.env.P38_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '';
  const anonKey =
    cfg.supabaseAnonKey ||
    P38_SUPABASE_ANON_KEY ||
    process.env.P38_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';
  return { bundled, url, anonKey };
}

async function main() {
  console.log('');
  console.log('========================================');
  console.log('  P38 — Instalação do Agente de Impressão');
  console.log('========================================');
  console.log('');

  const cfg = resolveConfig();
  const { bundled, url: presetUrl, anonKey: presetAnon } = resolveSupabaseCredentials(cfg);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  let supabaseUrl = presetUrl;
  let supabaseAnonKey = presetAnon;

  if (bundled) {
    console.log('Sistema P38: ligação já configurada neste instalador.');
    console.log('Só precisa do IP da impressora térmica na loja.');
    console.log('');
  } else {
    console.log('(Modo técnico — servidor não embutido no instalador.)');
    console.log('');
    supabaseUrl = await ask(rl, 'URL Supabase', supabaseUrl);
    if (!supabaseAnonKey) {
      supabaseAnonKey = await ask(rl, 'Chave anon Supabase (eyJ...)', '');
    }
  }

  const printerHost = await ask(
    rl,
    'IP da impressora térmica na rede',
    cfg.printerHost || '192.168.1.100',
  );
  const printerPort = await ask(rl, 'Porta da impressora', String(cfg.printerPort || 9100));

  let autoStart = true;
  if (platform() === 'win32') {
    const resp = await ask(
      rl,
      'Abrir agente automaticamente quando o Windows ligar? (S/n)',
      'S',
    );
    autoStart = !/^n/i.test(resp);
  }

  rl.close();

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('\nErro: instalador sem ligação ao P38. Peça o ficheiro .exe correcto à equipa.');
    await pause();
    process.exit(1);
  }

  const token = generateAgentToken();
  saveConfig({
    agentToken: token,
    supabaseUrl,
    supabaseAnonKey,
    printerHost,
    printerPort: Number(printerPort) || 9100,
  });

  const root = installDir();
  if (platform() === 'win32') {
    try {
      createWindowsShortcut(root);
      registerWindowsAutoStart(root, autoStart);
    } catch (e) {
      console.warn('Aviso (atalho/arranque):', e?.message || e);
    }
  }

  console.log('');
  console.log('=== Instalação concluída ===');
  console.log('');
  console.log('--- TOKEN (copie — usa uma vez no P38) ---');
  console.log('');
  console.log(`  ${token}`);
  console.log('');
  console.log('No P38 (browser):');
  console.log('  1. Abra um Comprovante de venda');
  console.log('  2. IP impressora:', printerHost);
  console.log('  3. Cole o TOKEN → botão "Ligar agente"');
  console.log('');
  if (autoStart && platform() === 'win32') {
    console.log('O agente abrirá sozinho quando o PC ligar.');
  } else {
    console.log('Para imprimir: abra "P38 Agente Impressao" no Ambiente de Trabalho.');
  }
  console.log('');

  await pause();
}

main().catch(async (e) => {
  console.error('\nErro:', e?.message || e);
  await pause();
  process.exit(1);
});
