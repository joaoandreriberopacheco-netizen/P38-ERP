#!/usr/bin/env node
/** Entrada para .exe — inicia servidor local + fila remota. */
import readline from 'readline';
import { startPrintAgentServer, startRemotePoller } from '../src/server.mjs';

const { cfg } = startPrintAgentServer();
startRemotePoller(cfg);

console.log('');
console.log('[p38-print-agent] Agente activo');
console.log(`[p38-print-agent] http://127.0.0.1:${cfg.port}/health`);
console.log(`[p38-print-agent] Impressora: ${cfg.printerHost || '(defina IP)'}:${cfg.printerPort || 9100}`);
console.log('[p38-print-agent] Deixe esta janela aberta enquanto a loja estiver aberta.');
console.log('');

function pause(message = 'Prima Enter para fechar...') {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

process.on('SIGINT', async () => {
  console.log('\nAgente encerrado.');
  process.exit(0);
});

process.on('uncaughtException', async (err) => {
  console.error('\nErro fatal:', err?.message || err);
  if (process.pkg) await pause();
  process.exit(1);
});
