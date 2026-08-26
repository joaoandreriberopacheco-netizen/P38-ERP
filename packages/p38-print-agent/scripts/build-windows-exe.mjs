#!/usr/bin/env node
/**
 * Gera P38-Instalar-Agente.exe e P38-Iniciar-Agente.exe (Windows x64, Node embutido).
 * Correr na raiz do repo: npm run print-agent:build-win
 */
import { execSync } from 'child_process';
import { mkdirSync, copyFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(pkgRoot, 'dist');
const release = join(pkgRoot, 'release');

mkdirSync(dist, { recursive: true });
mkdirSync(release, { recursive: true });

console.log('[build-win] A agrupar scripts com esbuild...');

execSync(
  `npx --yes esbuild "${join(pkgRoot, 'entries/install-windows.mjs')}" --bundle --platform=node --format=cjs --target=node18 --outfile="${join(dist, 'install.cjs')}"`,
  { stdio: 'inherit', cwd: pkgRoot },
);

execSync(
  `npx --yes esbuild "${join(pkgRoot, 'entries/start-windows.mjs')}" --bundle --platform=node --format=cjs --target=node18 --outfile="${join(dist, 'start.cjs')}"`,
  { stdio: 'inherit', cwd: pkgRoot },
);

console.log('[build-win] A gerar .exe com pkg (pode demorar)...');

const pkgBin = 'npx --yes @yao-pkg/pkg@5.16.0';

execSync(
  `${pkgBin} "${join(dist, 'install.cjs')}" --targets node18-win-x64 --output "${join(release, 'P38-Instalar-Agente')}"`,
  { stdio: 'inherit', cwd: pkgRoot },
);

execSync(
  `${pkgBin} "${join(dist, 'start.cjs')}" --targets node18-win-x64 --output "${join(release, 'P38-Iniciar-Agente')}"`,
  { stdio: 'inherit', cwd: pkgRoot },
);

// README rápido na pasta release
writeFileSync(
  join(release, 'LEIA-ME.txt'),
  `P38 — Agente de impressão térmica (CASA ISRAEL / loja)

1. Duplo clique: P38-Instalar-Agente.exe
   (só na primeira vez — gera TOKEN e grava config)

2. No P38 (browser): Comprovante → IP impressora → colar TOKEN → "Ligar agente"

3. Todos os dias: o agente pode abrir SOZINHO ao ligar o PC
   (o instalador pergunta isto — resposta padrão: Sim)

   Manualmente: P38-Iniciar-Agente.exe ou atalho "P38 Agente Impressao"

Teste: http://127.0.0.1:3920/health

Doc completa: docs/print-agent/README.md no repositório P38-ERP.
`,
  'utf8',
);

console.log('');
console.log('[build-win] Pronto:');
console.log(`  ${join(release, 'P38-Instalar-Agente.exe')}`);
console.log(`  ${join(release, 'P38-Iniciar-Agente.exe')}`);
console.log(`  ${join(release, 'LEIA-ME.txt')}`);
console.log('');
console.log('Copie a pasta release/ para um pen drive ou partilha na loja.');
