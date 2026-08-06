#!/usr/bin/env node
/**
 * Smoke test estrutural — não precisa de Supabase real.
 * CI: npm run smoke:structure
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const required = [
  'README.md',
  'CHANGELOG.md',
  'package.json',
  'vercel.json',
  'app/layout.next.jsx',
  'public/landing.html',
  'legacy/README.md',
  'legacy/vite/vite.config.js',
  'docs/PROFISSIONALIZACAO_P38.md',
  'docs/P38_MODULOS_E_PERFIS.md',
  'supabase/migrations',
];

const forbidden = ['_mcp007.json', '_mcp_chunks'];

let failed = 0;

for (const rel of required) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[smoke] FALTA: ${rel}`);
    failed += 1;
  }
}

for (const rel of forbidden) {
  const abs = path.join(root, rel);
  if (fs.existsSync(abs)) {
    console.error(`[smoke] LIXO na raiz: ${rel}`);
    failed += 1;
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (pkg.name !== 'p38-erp') {
  console.error(`[smoke] package.json name esperado p38-erp, obtido: ${pkg.name}`);
  failed += 1;
}

if (failed > 0) {
  console.error(`[smoke] ${failed} verificação(ões) falharam.`);
  process.exit(1);
}

console.log('[smoke] Estrutura OK — p38-erp v' + (pkg.version || '?'));
