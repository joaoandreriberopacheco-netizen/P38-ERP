#!/usr/bin/env node
import { resolveConfig, saveConfig } from '../src/config.mjs';
import { formatPairingCode, generateAgentPairingCode } from '../src/pairing-code.mjs';

const cfg = resolveConfig();
const token = process.argv.includes('--keep-token') && cfg.agentToken
  ? cfg.agentToken
  : generateAgentPairingCode();

const next = saveConfig({
  agentToken: token,
  supabaseUrl: process.env.P38_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || cfg.supabaseUrl || '',
  supabaseAnonKey: process.env.P38_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || cfg.supabaseAnonKey || '',
  printerHost: process.env.P38_PRINTER_HOST || cfg.printerHost || '',
  printerPort: Number(process.env.P38_PRINTER_PORT || cfg.printerPort || 9100),
});

console.log('');
console.log('=== P38 Print Agent — configuração ===');
console.log('');
console.log('Ficheiro:', next.configFile || '(memória)');
console.log('');
console.log('1) Código gerado (digite uma vez no P38 → Ligar agente):');
console.log(`   ${formatPairingCode(token)}`);
console.log('');
console.log('2) No sistema (logado), registe o agente uma vez:');
console.log('   Comprovante → botão "Ligar agente"');
console.log('   ou chame printAgent action=register com este token');
console.log('');
console.log('3) IP impressora padrão:', next.printerHost || '(defina P38_PRINTER_HOST ou no registo)');
console.log('');
console.log('4) Inicie o agente:');
console.log('   npm run print-agent:start');
console.log('');
