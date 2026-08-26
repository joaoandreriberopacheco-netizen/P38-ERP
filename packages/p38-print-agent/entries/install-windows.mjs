#!/usr/bin/env node
/**
 * Instalador interativo — Windows (Node ou .exe via pkg).
 * Grava config em ~/.p38-print-agent/config.json e mostra o token para ligar no P38.
 */
import readline from 'readline';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { homedir, platform } from 'os';
import { dirname, join } from 'path';
import { generateAgentToken, resolveConfig, saveConfig } from '../src/config.mjs';

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
  // Desenvolvimento (node / .bat): pasta do pacote print-agent
  return join(process.cwd(), 'packages/p38-print-agent');
}

function createWindowsShortcut(installRoot) {
  const desktop = join(homedir(), 'Desktop');
  if (!existsSync(desktop)) return;

  const iniciarExe = join(installRoot, 'P38-Iniciar-Agente.exe');
  const iniciarBat = join(installRoot, 'iniciar-agente.bat');
  const shortcutBat = join(desktop, 'P38 Agente Impressao.bat');

  let launcher;
  if (existsSync(iniciarExe)) {
    launcher = `@echo off\r\ntitle P38 Print Agent\r\ncd /d "${installRoot}"\r\nstart "" "${iniciarExe}"\r\n`;
  } else if (existsSync(iniciarBat)) {
    launcher = `@echo off\r\ntitle P38 Print Agent\r\ncd /d "${installRoot}"\r\n"${iniciarBat}"\r\n`;
  } else {
    launcher = `@echo off\r\ntitle P38 Print Agent\r\ncd /d "${installRoot}"\r\nnode packages/p38-print-agent/bin/start.mjs\r\npause\r\n`;
  }

  writeFileSync(shortcutBat, launcher, 'utf8');
  console.log(`Atalho criado: ${shortcutBat}`);
}

async function main() {
  console.log('');
  console.log('========================================');
  console.log('  P38 — Instalação do Agente de Impressão');
  console.log('  (impressora térmica na rede da loja)');
  console.log('========================================');
  console.log('');

  const cfg = resolveConfig();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('Preencha os dados abaixo (Enter aceita o valor entre [ ]).');
  console.log('');

  const supabaseUrl = await ask(
    rl,
    'URL Supabase',
    cfg.supabaseUrl || process.env.P38_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  );

  let supabaseAnonKey = cfg.supabaseAnonKey || process.env.P38_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  if (!supabaseAnonKey) {
    supabaseAnonKey = await ask(rl, 'Chave anon Supabase (eyJ...)', '');
  } else {
    const k = await ask(rl, 'Chave anon Supabase (Enter = manter a atual)', '(manter)');
    if (k && k !== '(manter)') supabaseAnonKey = k;
  }

  const printerHost = await ask(rl, 'IP da impressora térmica', cfg.printerHost || '192.168.1.100');
  const printerPort = await ask(rl, 'Porta da impressora', String(cfg.printerPort || 9100));

  rl.close();

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('\nErro: URL e chave anon Supabase são obrigatórias.');
    await pause();
    process.exit(1);
  }

  const token = generateAgentToken();
  const saved = saveConfig({
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
    } catch (e) {
      console.warn('Não foi possível criar atalho no Ambiente de Trabalho:', e?.message || e);
    }
  }

  console.log('');
  console.log('=== Instalação concluída ===');
  console.log('');
  console.log('Config gravada em:', saved.configFile || join(homedir(), '.p38-print-agent', 'config.json'));
  console.log('');
  console.log('--- TOKEN (use uma vez no P38) ---');
  console.log('');
  console.log(`  ${token}`);
  console.log('');
  console.log('Próximos passos:');
  console.log('  1. Abra o P38 no browser (PC do caixa) → Comprovante de venda');
  console.log('  2. IP impressora:', printerHost);
  console.log('  3. Cole o TOKEN acima → botão "Ligar agente"');
  console.log('  4. Inicie o agente: duplo clique em "P38 Agente Impressao" (Ambiente de Trabalho)');
  console.log('     ou execute P38-Iniciar-Agente.exe na pasta deste instalador');
  console.log('');
  console.log('Teste: abra http://127.0.0.1:3920/health com o agente a correr.');
  console.log('');

  await pause();
}

main().catch(async (e) => {
  console.error('\nErro na instalação:', e?.message || e);
  await pause();
  process.exit(1);
});
